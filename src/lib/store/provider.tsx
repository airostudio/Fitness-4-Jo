"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { isoDateInTz, uuid } from "@/lib/domain/dates";
import { isCloudConfigured } from "@/lib/supabase/config";
import { getSupabase } from "@/lib/supabase/client";
import { clearData, loadData, saveData } from "./persist";
import { flushQueue, pullAndMerge, type SyncStatus } from "./sync-client";
import { refreshSchedule } from "./actions";
import { applyExerciseOverrides } from "@/lib/domain/exercises";
import { setSlotDefault } from "@/lib/domain/program";
import { emptyData, type AppData, type Ctx, type TxResult } from "./types";
import { useOnline } from "@/lib/use-client-env";

export interface Toast { id: number; text: string; }
interface Store {
  data: AppData; ready: boolean; today: string; mode: "cloud" | "local";
  user: { id: string; email: string } | null; sync: SyncStatus;
  run: <T>(fn: (d: AppData, c: Ctx) => TxResult<T>) => T;
  syncNow: () => Promise<void>; signOut: () => Promise<void>; wipeLocal: () => Promise<void>;
  toast: (t: string) => void; toasts: Toast[]; dismissToast: (id: number) => void; online: boolean;
}
const StoreCtx = createContext<Store | null>(null);
export function useApp(): Store { const s = useContext(StoreCtx); if (!s) throw new Error("useApp outside provider"); return s; }

function applyPrefs(d: AppData) {
  const p = d.preferences;
  const root = document.documentElement;
  const theme = p.theme === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : p.theme;
  root.dataset.theme = theme;
  root.dataset.contrast = p.highContrast ? "high" : "normal";
  root.dataset.motion = p.reducedMotion === "system" ? "system" : p.reducedMotion === "on" ? "reduce" : "full";
  root.style.setProperty("--text-scale", String(p.textScale / 100));
  try { localStorage.setItem("jostrong-prefs", JSON.stringify({ theme: p.theme, textScale: p.textScale, highContrast: p.highContrast, reducedMotion: p.reducedMotion })); } catch { /* ignore */ }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const cloud = isCloudConfigured();
  const [data, setData] = useState<AppData>(emptyData);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<Store["user"]>(null);
  const [sync, setSync] = useState<SyncStatus>(cloud ? { kind: "pending", pending: 0 } : { kind: "local" });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const online = useOnline();
  const [today, setToday] = useState("2026-01-01");
  const ref = useRef<AppData>(data);
  const scope = useRef<string>("local");
  const syncing = useRef(false);

  const commit = useCallback((next: AppData) => { ref.current = next; setData(next); void saveData(scope.current, next); applyPrefs(next); }, []);
  const toast = useCallback((text: string) => { const id = Date.now() + Math.random(); setToasts((t) => [...t, { id, text }]); setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000); }, []);

  const computeToday = useCallback(() => isoDateInTz(new Date(), ref.current.preferences.timezone), []);

  const syncNow = useCallback(async () => {
    const sb = getSupabase();
    if (!sb || syncing.current) return;
    if (!navigator.onLine) { setSync({ kind: "offline", pending: ref.current.meta.queue.length }); return; }
    syncing.current = true; setSync({ kind: "syncing" });
    try {
      const flushed = await flushQueue(ref.current);
      let d = flushed.data;
      if (flushed.status.kind === "signed-out") { setSync(flushed.status); commit(d); return; }
      let pullFailed = false;
      if (flushed.status.kind === "synced" || flushed.status.kind === "pending" || flushed.conflicts > 0) {
        try { d = await pullAndMerge(sb, d); } catch { pullFailed = true; }
      }
      if (flushed.conflicts > 0) toast("Some changes were newer on another device, so we kept the latest version.");
      commit(d);
      setSync(pullFailed && flushed.status.kind === "synced" ? { kind: "error", message: "Couldn't reach the server to confirm your data is up to date.", pending: d.meta.queue.length } : flushed.status);
    } catch { setSync({ kind: "error", message: "Couldn't reach the server. Your changes are safe on this device.", pending: ref.current.meta.queue.length }); }
    finally { syncing.current = false; }
  }, [commit, toast]);

  const run = useCallback(<T,>(fn: (d: AppData, c: Ctx) => TxResult<T>): T => {
    const now = new Date();
    const ctx: Ctx = { now: now.toISOString(), today: isoDateInTz(now, ref.current.preferences.timezone), id: uuid };
    const r = fn(ref.current, ctx);
    if (r.data !== ref.current) {
      commit(r.data);
      if (r.ops.length && cloud) { setSync({ kind: "pending", pending: r.data.meta.queue.length }); setTimeout(() => void syncNow(), 800); }
    }
    return r.result;
  }, [commit, cloud, syncNow]);

  // ---- admin-maintained reference data (exercise wording, approved media, starter slots). Non-personal; cached for offline use.
  const applyReference = useCallback((ref: { exercises?: never[]; media?: never[]; slots?: { slot: string; exercise_id: string }[] }) => {
    try { applyExerciseOverrides(ref.exercises ?? [], ref.media ?? []); (ref.slots ?? []).forEach((s) => setSlotDefault(s.slot as never, s.exercise_id)); } catch { /* ignore bad data */ }
  }, []);

  // ---- boot: identify the account (or local), load its data, then reconcile with the server
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = getSupabase();
      let uid = "local";
      if (sb) {
        const { data: s } = await sb.auth.getSession();           // reads the stored session; works offline
        if (s.session?.user) { uid = s.session.user.id; setUser({ id: uid, email: s.session.user.email ?? "" }); }
        else { setReady(true); return; }                            // proxy normally redirects; if offline with no session, show sign-in
      }
      scope.current = uid;
      try { const cached = localStorage.getItem("jostrong-ref"); if (cached) applyReference(JSON.parse(cached)); } catch { /* ignore */ }
      if (sb && navigator.onLine) {
        const [ex, md, sl] = await Promise.all([sb.from("exercise_library").select("*"), sb.from("exercise_media").select("*"), sb.from("workout_template_exercises").select("slot,exercise_id,optional")]);
        if (!ex.error) { const ref = { exercises: ex.data ?? [], media: md.data ?? [], slots: (sl.data ?? []).filter((x: { optional: boolean }) => !x.optional) }; applyReference(ref as never); try { localStorage.setItem("jostrong-ref", JSON.stringify(ref)); } catch { /* ignore */ } }
      }
      let d = await loadData(uid);
      if (cancelled) return;
      ref.current = d; setData(d); applyPrefs(d);
      setToday(isoDateInTz(new Date(), d.preferences.timezone));
      setReady(true);
      if (d.program) { const r = refreshSchedule(d, { now: new Date().toISOString(), today: isoDateInTz(new Date(), d.preferences.timezone), id: uuid }); if (r.data !== d) { d = r.data; commit(d); } }
      void syncNow();
    })();
    return () => { cancelled = true; };
  }, [commit, syncNow, applyReference]);

  useEffect(() => {
    const on = () => { void syncNow(); }, off = () => { if (cloud) setSync({ kind: "offline", pending: ref.current.meta.queue.length }); };
    const vis = () => { if (document.visibilityState === "visible") { setToday(computeToday()); void syncNow(); } };
    window.addEventListener("online", on); window.addEventListener("offline", off); document.addEventListener("visibilitychange", vis);
    const t = setInterval(() => { setToday(computeToday()); if (cloud && ref.current.meta.queue.length) void syncNow(); }, 60_000);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); document.removeEventListener("visibilitychange", vis); clearInterval(t); };
  }, [cloud, syncNow, computeToday]);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  const wipeLocal = useCallback(async () => { await clearData(scope.current); ref.current = emptyData(); setData(ref.current); }, []);
  const signOut = useCallback(async () => {
    const sb = getSupabase();
    if (sb) { await sb.auth.signOut(); }
    await clearData(scope.current);
    if ("serviceWorker" in navigator) navigator.serviceWorker.controller?.postMessage({ type: "clear-caches" });
    ref.current = emptyData(); setData(ref.current); setUser(null);
    window.location.href = sb ? "/auth/sign-in" : "/";
  }, []);

  const value = useMemo<Store>(() => ({
    data, ready, today, mode: cloud ? "cloud" : "local", user, sync, run, syncNow, signOut, wipeLocal, toast, toasts,
    dismissToast: (id) => setToasts((t) => t.filter((x) => x.id !== id)), online,
  }), [data, ready, today, cloud, user, sync, run, syncNow, signOut, wipeLocal, toast, toasts, online]);

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}
