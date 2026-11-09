"use client";
import { useState } from "react";
import { useClientEnv } from "@/lib/use-client-env";
import { updateSingle } from "@/lib/store/actions";
import { useApp } from "@/lib/store/provider";
import { DAY_OPTIONS } from "@/lib/options";
import { Button, Card, CheckGroup, Field, Input, Notice, Switch } from "@/components/ui";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const b64 = (s: string) => { const p = "=".repeat((4 - (s.length % 4)) % 4); const r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...r].map((c) => c.charCodeAt(0))); };

export function RemindersCard() {
  const { data, run, toast, mode } = useApp();
  const n = data.notifications;
  const env = useClientEnv();
  const [permNow, setPerm] = useState<string | null>(null);
  const perm = permNow ?? env.perm; const { ios, standalone } = env;
  const set = (patch: Partial<typeof n>) => run((d, c) => updateSingle(d, c, "notifications", patch));
  const pushPossible = mode === "cloud" && !!VAPID && "serviceWorker" in navigator && "PushManager" in window;

  async function enablePush() {
    // Never automatic: permission is requested only because Jo pressed this button.
    const result = await Notification.requestPermission();
    setPerm(result);
    if (result !== "granted") { toast("No problem – you'll still see reminders inside the app."); return; }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(VAPID) }));
      const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      if (!res.ok) throw new Error("save");
      set({ enabled: true }); toast("Reminders are on.");
    } catch { toast("Couldn't turn on push reminders on this device. In-app reminders still work."); }
  }

  return (
    <Card className="space-y-4" id="reminders"><h2 className="text-xl font-bold">Reminders</h2>
      <Switch label="Remind me about my sessions" description="At most one gentle reminder per session. We never send 'you missed it' messages." checked={n.enabled}
        onChange={(v) => { if (v && pushPossible && perm !== "granted") void enablePush(); else set({ enabled: v }); }} />
      {n.enabled && <>
        <CheckGroup legend="Preferred days" values={n.days} onToggle={(v) => set({ days: n.days.includes(v) ? n.days.filter((x) => x !== v) : [...n.days, v].sort() })} options={DAY_OPTIONS} />
        <Field label="Reminder time" htmlFor="rt"><Input id="rt" type="time" value={n.time} onChange={(e) => set({ time: e.target.value })} /></Field>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Quiet hours start" htmlFor="qs"><Input id="qs" type="time" value={n.quietStart} onChange={(e) => set({ quietStart: e.target.value })} /></Field><Field label="Quiet hours end" htmlFor="qe"><Input id="qe" type="time" value={n.quietEnd} onChange={(e) => set({ quietEnd: e.target.value })} /></Field></div>
        <Switch label="Heads-up the day before" checked={n.dayBefore} onChange={(v) => set({ dayBefore: v })} />
        <p className="text-sm text-muted">Times use your timezone ({data.preferences.timezone}).</p>
      </>}
      {ios && !standalone && <Notice tone="peach" title="On iPhone or iPad">Notifications only work once JoStrong is added to your Home Screen: tap Share, then &ldquo;Add to Home Screen&rdquo;, open it from there, then turn reminders on. Requires iOS 16.4 or newer.</Notice>}
      {mode === "local" && <Notice>Push reminders need an account (so we can reach your device). In-app reminders on your Home screen work either way.</Notice>}
      {mode === "cloud" && !VAPID && <Notice>Push notifications aren&apos;t set up on this installation yet, so you&apos;ll see reminders inside the app.</Notice>}
      {perm === "denied" && <Notice tone="warn">Notifications are blocked in your browser settings. You&apos;ll still see in-app reminders.</Notice>}
      {pushPossible && perm !== "granted" && !n.enabled && <Button variant="soft" onClick={() => void enablePush()}>Allow notifications on this device</Button>}
    </Card>
  );
}
