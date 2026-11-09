"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDateAU } from "@/lib/domain/dates";
import { MILESTONE_DEFS } from "@/lib/domain/stats";
import type { SupporterView } from "@/lib/domain/supporter";
import { getSupabase } from "@/lib/supabase/client";
import { exerciseName } from "@/lib/store/selectors";
import { Button, Card, EmptyState, Field, Notice, Spinner, Textarea } from "@/components/ui";

interface Owner { owner_id: string; owner_name: string; invite_id: string }

/** What a supporter sees. Everything comes from a database function that checks Jo's live permissions on every request. */
export default function SupporterHome() {
  const sb = getSupabase();
  const [owners, setOwners] = useState<Owner[] | null>(null);
  const [views, setViews] = useState<Record<string, SupporterView | "denied">>({});
  const [msg, setMsg] = useState(""); const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    if (!sb) return;
    (async () => {
      const { data } = await sb.rpc("supporter_owners");
      const list = (data as Owner[]) ?? []; setOwners(list);
      for (const o of list) {
        const r = await sb.rpc("supporter_view", { p_owner: o.owner_id });
        setViews((v) => ({ ...v, [o.owner_id]: r.error ? "denied" : (r.data as SupporterView) }));
      }
    })();
  }, [sb]);

  if (!sb) return <Notice>Supporter access needs accounts to be enabled.</Notice>;
  if (!owners) return <Spinner />;
  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between"><h1 className="text-3xl font-bold">Supporter view</h1><Link href="/" className="min-h-11 font-semibold underline">My JoStrong</Link></header>
      {!owners.length && <EmptyState title="Nobody is sharing with you right now">If you were invited, open your invitation link again while signed in with the invited email address. If access was revoked, it ends immediately.</EmptyState>}
      {owners.map((o) => {
        const v = views[o.owner_id];
        if (!v) return <Spinner key={o.invite_id} />;
        if (v === "denied") return <Notice key={o.invite_id} tone="warn">Access to {o.owner_name}&apos;s progress has ended.</Notice>;
        return (
          <section key={o.invite_id} className="space-y-3"><h2 className="text-2xl font-bold">{v.ownerName}&apos;s progress</h2>
            <p className="text-muted">You can only see what {v.ownerName} has chosen to share. You can&apos;t change anything in their plan.</p>
            {v.sessions && <Card><h3 className="font-bold">Training days</h3>{v.sessions.length ? <ul className="mt-1 divide-y divide-line">{v.sessions.slice(0, 20).map((s, i) => <li key={i} className="py-2">{formatDateAU(s.date, "weekday")} · Workout {s.letter}{s.status === "ended_early" ? " (shorter session)" : ""}</li>)}</ul> : <p className="text-muted">No sessions yet.</p>}</Card>}
            {v.achievements && <Card><h3 className="font-bold">Achievements</h3>{v.achievements.length ? <ul className="mt-1 space-y-1">{v.achievements.map((a) => <li key={a.key}>🌟 {MILESTONE_DEFS[a.key]?.title ?? a.key}</li>)}</ul> : <p className="text-muted">Nothing yet – they&apos;re just getting started.</p>}</Card>}
            {v.metrics && <Card><h3 className="font-bold">Strength progress</h3><ul className="mt-1 divide-y divide-line">{v.metrics.slice(0, 20).map((m, i) => <li key={i} className="flex justify-between py-2"><span>{exerciseName(m.exerciseId)}</span><span className="text-muted">{m.weight != null ? `${m.weight} kg × ` : ""}{m.reps}</span></li>)}</ul></Card>}
            {v.notes && <Card><h3 className="font-bold">Shared journal entries</h3>{v.notes.length ? <ul className="mt-1 space-y-2">{v.notes.map((n, i) => <li key={i}><strong>{formatDateAU(n.date)}</strong> {n.feeling} {n.achievement}</li>)}</ul> : <p className="text-muted">No entries shared.</p>}</Card>}
            {v.permissions.canEncourage && (
              <Card className="space-y-3"><h3 className="font-bold">Send a little encouragement</h3>
                <Field label="Your message (kept short and kind)" htmlFor="en"><Textarea id="en" value={msg} maxLength={280} onChange={(e) => setMsg(e.target.value)} /></Field>
                <Button disabled={!msg.trim()} onClick={async () => { const r = await sb.rpc("supporter_send_encouragement", { p_owner: o.owner_id, p_message: msg }); setSent(r.error ? "Couldn't send – access may have changed." : "Sent 💌"); if (!r.error) setMsg(""); }}>Send</Button>
                {sent && <p role="status" className="font-semibold">{sent}</p>}</Card>
            )}
          </section>
        );
      })}
    </div>
  );
}
