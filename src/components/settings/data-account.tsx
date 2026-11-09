"use client";
import { useState } from "react";
import Link from "next/link";
import { Download, LogOut, Trash2 } from "lucide-react";
import { buildExport } from "@/lib/domain/export";
import { useApp } from "@/lib/store/provider";
import { getSupabase } from "@/lib/supabase/client";
import { Button, Card, Dialog, Field, Input, Notice } from "@/components/ui";
import { SyncBadge } from "@/components/shell";

export function DataCard() {
  const { data, toast, signOut, mode, wipeLocal, user } = useApp();
  const [dlg, setDlg] = useState<null | "delete" | "signout">(null);
  const [typed, setTyped] = useState(""); const [busy, setBusy] = useState(false);
  const pending = data.meta.queue.length;

  const exportData = async () => {
    const { meta: _m, ...rest } = data;
    const out = buildExport({ appVersion: "1.0.0", data: rest, now: new Date().toISOString() });
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `jostrong-export-${out.exportedAt.slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(a.href);
    if (user) await getSupabase()?.from("audit_events").insert({ user_id: user.id, event: "data.exported" });
    toast("Your data has been downloaded.");
  };
  const del = async () => {
    setBusy(true);
    try {
      if (mode === "cloud") {
        const r = await fetch("/api/account/delete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: "DELETE" }) });
        if (!r.ok) throw new Error("fail");
      }
      await wipeLocal(); toast("Everything has been deleted.");
      window.location.href = mode === "cloud" ? "/auth/sign-in" : "/";
    } catch { toast("We couldn't complete the deletion. Nothing was changed – please try again."); setBusy(false); }
  };

  return (
    <Card className="space-y-4" id="data"><h2 className="text-xl font-bold">Your data & account</h2>
      <div className="rounded-2xl bg-surface2 p-3"><p className="font-semibold">{mode === "cloud" ? `Signed in as ${user?.email}` : "Using JoStrong on this device only"}</p><SyncBadge /></div>
      <p className="text-muted">Your information belongs to you. Download a copy any time, or delete everything permanently.</p>
      <div className="flex flex-col gap-3 sm:flex-row"><Button variant="soft" onClick={exportData}><Download size={18} aria-hidden /> Download my data</Button>
        <Button variant="outline" onClick={() => (pending ? setDlg("signout") : void signOut())}><LogOut size={18} aria-hidden /> {mode === "cloud" ? "Sign out" : "Clear this device"}</Button></div>
      <Button variant="dangerOutline" onClick={() => { setTyped(""); setDlg("delete"); }}><Trash2 size={18} aria-hidden /> Delete my account and data</Button>
      <p className="text-sm"><Link href="/privacy" className="font-semibold underline">Privacy policy</Link> · <Link href="/terms" className="font-semibold underline">Terms</Link></p>

      <Dialog open={dlg === "signout"} onClose={() => setDlg(null)} title="Some changes aren't saved yet" actions={<><Button variant="outline" onClick={() => setDlg(null)}>Stay signed in</Button><Button variant="danger" onClick={() => void signOut()}>Sign out anyway</Button></>}>
        <p>{pending} change{pending === 1 ? "" : "s"} haven&apos;t reached your account. Signing out clears this device, so those changes would be lost. Connect to the internet for a moment and they&apos;ll save automatically.</p></Dialog>
      <Dialog open={dlg === "delete"} onClose={() => setDlg(null)} title="Delete everything?" actions={<><Button variant="outline" onClick={() => setDlg(null)}>Keep my account</Button><Button variant="danger" disabled={typed !== "DELETE" || busy} onClick={del}>{busy ? "Deleting…" : "Delete permanently"}</Button></>}>
        <Notice tone="danger" title="This can't be undone">{mode === "cloud" ? "Your account, workouts, journal, photos and supporter access will be permanently deleted." : "All JoStrong data on this device will be permanently deleted."} Download your data first if you want a copy.</Notice>
        <Field label='Type DELETE to confirm' htmlFor="dc"><Input id="dc" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" /></Field></Dialog>
    </Card>
  );
}
