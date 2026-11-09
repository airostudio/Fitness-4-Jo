"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EXERCISES } from "@/lib/domain/exercises";
import { getSupabase } from "@/lib/supabase/client";
import { Badge, Button, Card, Field, Input, Notice, Select, Spinner, Switch, Textarea } from "@/components/ui";

interface Health { accounts: number; sessionsLast7Days: number; rejectedSyncOpsLast7Days: number; errorsLast24h: number; activeExercises: number }
interface Row { id: string; name: string; description: string; active: boolean }
interface Err { id: string; created_at: string; area: string; message: string }
interface Slot { letter: string; slot: string; exercise_id: string; optional: boolean }

/**
 * Administration. Everything here runs as the signed-in admin under Row Level Security: admins can maintain reference data
 * (exercises, media, starter template) and see aggregate health – but the database gives them NO access to anyone's
 * health details, journal or workouts. Every change is written to the audit log (event name only – no personal content).
 */
export default function AdminPage() {
  const sb = getSupabase();
  const [state, setState] = useState<"loading" | "denied" | "ok">(sb ? "loading" : "denied");
  const [tick, setTick] = useState(0);
  const [health, setHealth] = useState<Health | null>(null);
  const [rows, setRows] = useState<Row[]>([]); const [errors, setErrors] = useState<Err[]>([]); const [slots, setSlots] = useState<Slot[]>([]);
  const [sel, setSel] = useState<string>(""); const [desc, setDesc] = useState(""); const [url, setUrl] = useState(""); const [licence, setLicence] = useState(""); const [kind, setKind] = useState("video");
  const [msg, setMsg] = useState<string | null>(null);

  const audit = useCallback(async (event: string) => { const { data } = await sb!.auth.getUser(); await sb!.from("audit_events").insert({ user_id: data.user?.id, event }); }, [sb]);
  const load = () => setTick((t) => t + 1);
  useEffect(() => {
    if (!sb) return;
    let live = true;
    (async () => {
      const h = await sb.rpc("admin_health");
      if (!live) return;
      if (h.error) return setState("denied");
      const [ex, er, sl] = await Promise.all([sb.from("exercise_library").select("id,name,description,active").order("name"), sb.from("error_events").select("*").order("created_at", { ascending: false }).limit(15), sb.from("workout_template_exercises").select("letter,slot,exercise_id,optional").order("letter").order("position")]);
      if (!live) return;
      setHealth(h.data as Health); setState("ok");
      setRows((ex.data as Row[]) ?? []); setErrors((er.data as Err[]) ?? []); setSlots((sl.data as Slot[]) ?? []);
    })();
    return () => { live = false; };
  }, [sb, tick]);

  if (state === "loading") return <Spinner />;
  if (state === "denied") return <Notice tone="warn" title="Not authorised">This area is for administrators only. <Link href="/" className="font-semibold underline">Back to JoStrong</Link></Notice>;
  const cur = rows.find((r) => r.id === sel);
  const note = (t: string) => { setMsg(t); setTimeout(() => setMsg(null), 4000); };

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between"><h1 className="text-3xl font-bold">Administration</h1><Link href="/settings" className="min-h-11 font-semibold underline">Back</Link></header>
      <Notice title="What administrators can and can&apos;t do">You can maintain the exercise library, approved media and the starter workouts, and see anonymous health counts. You cannot see any person&apos;s health details, journal or workouts.</Notice>
      {msg && <p role="status" className="rounded-2xl bg-soft p-3 font-semibold text-softfg">{msg}</p>}
      <Card><h2 className="text-xl font-bold">Application health</h2>
        <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5">{health && Object.entries({ Accounts: health.accounts, "Sessions (7d)": health.sessionsLast7Days, "Rejected syncs (7d)": health.rejectedSyncOpsLast7Days, "Errors (24h)": health.errorsLast24h, "Active exercises": health.activeExercises }).map(([k, v]) => <div key={k} className="rounded-2xl bg-surface2 p-3"><dt className="text-sm text-muted">{k}</dt><dd className="text-2xl font-bold">{v}</dd></div>)}</dl></Card>
      <Card className="space-y-3"><h2 className="text-xl font-bold">Exercise library</h2>
        <Field label="Exercise" htmlFor="ae"><Select id="ae" value={sel} onChange={(e) => { setSel(e.target.value); setDesc(rows.find((r) => r.id === e.target.value)?.description ?? ""); }}><option value="">Choose…</option>{rows.map((r) => <option key={r.id} value={r.id}>{r.name}{r.active ? "" : " (hidden)"}</option>)}</Select></Field>
        {cur && <>
          <Field label="Description" htmlFor="ad"><Textarea id="ad" value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
          <Button onClick={async () => { const { error } = await sb!.from("exercise_library").update({ description: desc, updated_at: new Date().toISOString() }).eq("id", cur.id); if (!error) await audit("admin.exercise.updated"); note(error ? "Couldn't save." : "Saved."); load(); }}>Save description</Button>
          <Switch label="Visible in the app" checked={cur.active} onChange={async (v) => { await sb!.from("exercise_library").update({ active: v }).eq("id", cur.id); await audit(v ? "admin.exercise.shown" : "admin.exercise.hidden"); load(); }} />
          <h3 className="pt-2 font-bold">Add demonstration media</h3>
          <Notice>Only media you own or have permission to use. A licence is required and nothing shows to users until you tick approved.</Notice>
          <Field label="HTTPS URL" htmlFor="mu"><Input id="mu" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></Field>
          <Field label="Type" htmlFor="mk"><Select id="mk" value={kind} onChange={(e) => setKind(e.target.value)}><option value="video">Video</option><option value="animation">Animation</option><option value="image">Image</option></Select></Field>
          <Field label="Licence / permission (required)" htmlFor="ml"><Input id="ml" value={licence} onChange={(e) => setLicence(e.target.value)} placeholder="e.g. Original work, owned by JoStrong" /></Field>
          <Button disabled={!url.startsWith("https://") || licence.length < 3} onClick={async () => { const { error } = await sb!.from("exercise_media").insert({ exercise_id: cur.id, kind, url, licence, approved: true }); if (!error) { await audit("admin.media.approved"); setUrl(""); setLicence(""); } note(error ? "Couldn't add media." : "Media approved."); }}>Add &amp; approve</Button>
        </>}
      </Card>
      <Card className="space-y-3"><h2 className="text-xl font-bold">Starter workouts</h2><p className="text-sm text-muted">The first exercise offered for each slot. People&apos;s equipment and comfort settings still apply.</p>
        {slots.map((s) => (
          <div key={`${s.letter}-${s.slot}`} className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">Workout {s.letter} · {s.slot.replace("_", " ")} {s.optional && <Badge>optional</Badge>}</span>
            <label className="sr-only" htmlFor={`s-${s.letter}-${s.slot}`}>Exercise for {s.slot}</label>
            <Select id={`s-${s.letter}-${s.slot}`} className="max-w-64" value={s.exercise_id} onChange={async (e) => { const { error } = await sb!.from("workout_template_exercises").update({ exercise_id: e.target.value }).eq("letter", s.letter).eq("slot", s.slot); if (!error) await audit("admin.template.updated"); note(error ? "Couldn't save." : "Starter workout updated."); load(); }}>
              {EXERCISES.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></div>))}
      </Card>
      <Card><h2 className="text-xl font-bold">Recent technical errors</h2>{errors.length ? <ul className="mt-2 divide-y divide-line">{errors.map((e) => <li key={e.id} className="py-2 text-sm"><span className="font-semibold">{e.area}</span> · {e.message} <span className="text-muted">({new Date(e.created_at).toLocaleString("en-AU")})</span></li>)}</ul> : <p className="text-muted">No errors recorded.</p>}</Card>
    </div>
  );
}
