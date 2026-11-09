"use client";
import { useEffect, useState } from "react";
import { ShieldOff } from "lucide-react";
import { inviteSchema } from "@/lib/domain/schemas";
import { PERMISSION_LABELS, inviteState, NO_SHARING, type SupporterPermissions } from "@/lib/domain/supporter";
import { formatDateAU } from "@/lib/domain/dates";
import { useApp } from "@/lib/store/provider";
import { getSupabase } from "@/lib/supabase/client";
import { Badge, Button, Card, Dialog, Field, Input, Notice, Switch } from "@/components/ui";

interface Row { id: string; email: string; created_at: string; expires_at: string; accepted_at: string | null; revoked_at: string | null; supporter_permissions: { can_see_sessions: boolean; can_see_achievements: boolean; can_see_metrics: boolean; can_see_notes: boolean; can_encourage: boolean }[] | null }
const toPerms = (r: Row["supporter_permissions"]): SupporterPermissions => r?.[0] ? { canSeeSessions: r[0].can_see_sessions, canSeeAchievements: r[0].can_see_achievements, canSeeMetrics: r[0].can_see_metrics, canSeeNotes: r[0].can_see_notes, canEncourage: r[0].can_encourage } : NO_SHARING;
const col: Record<keyof SupporterPermissions, string> = { canSeeSessions: "can_see_sessions", canSeeAchievements: "can_see_achievements", canSeeMetrics: "can_see_metrics", canSeeNotes: "can_see_notes", canEncourage: "can_encourage" };

async function sha256Hex(t: string) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join(""); }
function newToken() { const a = crypto.getRandomValues(new Uint8Array(32)); return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }

/** Supporter sharing is OFF by default. Jo chooses exactly what is visible and can revoke at any moment. */
export function SupporterCard() {
  const { mode, toast, user } = useApp();
  const [rows, setRows] = useState<Row[]>([]);
  const [email, setEmail] = useState("");
  const [perms, setPerms] = useState<SupporterPermissions>(NO_SHARING);
  const [link, setLink] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [revoke, setRevoke] = useState<Row | null>(null);
  const [messages, setMessages] = useState<{ id: string; message: string; created_at: string }[]>([]);
  const sb = getSupabase();
  const [tick, setTick] = useState(0);
  const load = () => setTick((t) => t + 1);

  useEffect(() => {
    if (!sb) return;
    let live = true;
    Promise.all([
      sb.from("supporter_invites").select("id,email,created_at,expires_at,accepted_at,revoked_at,supporter_permissions(can_see_sessions,can_see_achievements,can_see_metrics,can_see_notes,can_encourage)").order("created_at", { ascending: false }),
      sb.from("supporter_encouragements").select("id,message,created_at").order("created_at", { ascending: false }).limit(5),
    ]).then(([inv, msg]) => { if (live) { setRows((inv.data as unknown as Row[]) ?? []); setMessages(msg.data ?? []); } });
    return () => { live = false; };
  }, [sb, tick, user?.id]);

  if (mode === "local") return (
    <Card className="space-y-2" id="supporter"><h2 className="text-xl font-bold">Private supporter</h2>
      <Notice>Sharing with a supporter needs an account, so access can be controlled and revoked securely. It&apos;s off, and nothing is shared.</Notice></Card>
  );

  async function invite() {
    setErr(null);
    const parsed = inviteSchema.safeParse({ email: email.trim().toLowerCase(), ...perms });
    if (!parsed.success) { setErr("Please enter a valid email address."); return; }
    const token = newToken();
    const { error } = await sb!.rpc("create_supporter_invite", { p_email: parsed.data.email, p_token_hash: await sha256Hex(token), p_sessions: perms.canSeeSessions, p_achievements: perms.canSeeAchievements, p_metrics: perms.canSeeMetrics, p_notes: perms.canSeeNotes, p_encourage: perms.canEncourage });
    if (error) { setErr("Couldn't create the invitation. Please try again."); return; }
    setLink(`${location.origin}/supporter/accept?token=${token}`); setEmail(""); setPerms(NO_SHARING); load();
  }

  return (
    <Card className="space-y-4" id="supporter"><h2 className="text-xl font-bold">Private supporter</h2>
      <p className="text-muted">Invite someone you trust to see a little of your progress. It&apos;s <strong>off by default</strong>. They can never change your workouts, and your health details are never shared.</p>

      {rows.filter((r) => inviteState(r as never as Parameters<typeof inviteState>[0], new Date()) !== "revoked").map((r) => {
        const st = inviteState({ id: r.id, email: r.email, createdAt: r.created_at, acceptedAt: r.accepted_at, revokedAt: r.revoked_at, expiresAt: r.expires_at }, new Date());
        const p = toPerms(r.supporter_permissions);
        return (
          <div key={r.id} className="space-y-2 rounded-2xl border-2 border-line p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold">{r.email}</p><Badge tone={st === "active" ? "soft" : "warn"}>{st === "active" ? "Active" : st === "pending" ? "Invitation not accepted yet" : "Expired"}</Badge></div>
            <p className="text-sm text-muted">Invited {formatDateAU(r.created_at.slice(0, 10))}</p>
            {(Object.keys(PERMISSION_LABELS) as (keyof SupporterPermissions)[]).map((k) => (
              <Switch key={k} label={PERMISSION_LABELS[k].label} description={PERMISSION_LABELS[k].help} checked={p[k]}
                onChange={async (v) => { await sb!.from("supporter_permissions").update({ [col[k]]: v, updated_at: new Date().toISOString() }).eq("invite_id", r.id); load(); }} />
            ))}
            <Button variant="danger" className="w-full" onClick={() => setRevoke(r)}><ShieldOff size={18} aria-hidden /> Revoke access</Button>
          </div>
        );
      })}

      <details className="rounded-2xl border border-line p-4" open={rows.length === 0 ? false : undefined}>
        <summary className="min-h-11 cursor-pointer font-semibold">Invite a supporter</summary>
        <div className="mt-3 space-y-3">
          <Field label="Their email address" htmlFor="se" error={err ?? undefined}><Input id="se" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" /></Field>
          <p className="font-semibold">What may they see?</p>
          {(Object.keys(PERMISSION_LABELS) as (keyof SupporterPermissions)[]).map((k) => <Switch key={k} label={PERMISSION_LABELS[k].label} description={PERMISSION_LABELS[k].help} checked={perms[k]} onChange={(v) => setPerms((x) => ({ ...x, [k]: v }))} />)}
          <Button onClick={invite} disabled={!email}>Create invitation link</Button>
          {link && <Notice tone="peach" title="Share this link with them (once)"><p className="break-all font-mono text-sm">{link}</p><div className="mt-2 flex gap-2"><Button size="sm" variant="outline" onClick={() => { void navigator.clipboard?.writeText(link); toast("Link copied."); }}>Copy link</Button></div>
            <p className="mt-2 text-sm">They must sign in with <strong>that email address</strong>. The link works once and expires in 14 days. We never email it for you, and we can&apos;t show it again.</p></Notice>}
        </div>
      </details>

      {messages.length > 0 && <div><h3 className="font-bold">Encouragement for you 💌</h3><ul className="mt-1 space-y-1">{messages.map((m) => <li key={m.id} className="rounded-xl bg-soft p-3 text-softfg">{m.message}</li>)}</ul></div>}

      <Dialog open={!!revoke} onClose={() => setRevoke(null)} title="Revoke access?" actions={<><Button variant="outline" onClick={() => setRevoke(null)}>Keep sharing</Button>
        <Button variant="danger" onClick={async () => { const { error } = await sb!.rpc("revoke_supporter", { p_invite: revoke!.id }); setRevoke(null); toast(error ? "Couldn't revoke – please try again." : "Access revoked. They can no longer see anything."); load(); }}>Revoke access now</Button></>}>
        <p>{revoke?.email} will lose access immediately. You can invite them again later if you wish.</p></Dialog>
    </Card>
  );
}
