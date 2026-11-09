"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";
import { Button, Card, Notice, buttonClass } from "@/components/ui";

function Accept() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<"idle" | "ok" | "bad">("idle");
  const sb = getSupabase();
  if (!sb) return <Notice>Accounts aren&apos;t enabled on this installation.</Notice>;
  return (
    <Card className="space-y-4"><h1 className="text-2xl font-bold">You&apos;ve been invited as a supporter</h1>
      <p className="text-muted">Someone has chosen to share a little of their strength journey with you. You&apos;ll only see what they allow, and they can stop sharing at any time. You can&apos;t change their workouts.</p>
      {state === "ok" && <Notice title="Welcome">You now have access. <Link className="font-semibold underline" href="/supporter">Open the supporter view</Link></Notice>}
      {state === "bad" && <Notice tone="warn" title="This invitation can't be used">It may have expired, been used already or been withdrawn – or you may be signed in with a different email address than the one invited. Please ask for a new link.</Notice>}
      {state !== "ok" && <Button size="lg" disabled={!token} onClick={async () => { const { error } = await sb.rpc("accept_supporter_invite", { p_token: token }); setState(error ? "bad" : "ok"); }}>Accept invitation</Button>}
      <Link href="/" className={buttonClass({ variant: "outline" })}>Not now</Link></Card>
  );
}
export default function Page() { return <Suspense><Accept /></Suspense>; }
