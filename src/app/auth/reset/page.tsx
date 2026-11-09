"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { Button, Card, Field, Input } from "@/components/ui";

export default function ResetPassword() {
  const router = useRouter();
  const [pw, setPw] = useState(""); const [msg, setMsg] = useState<string | null>(null); const [ok, setOk] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) { setMsg("Please use at least 8 characters."); return; }
    const { error } = await getSupabase()!.auth.updateUser({ password: pw });
    if (error) setMsg("We couldn't update your password. The link may have expired – please request a new one."); else { setOk(true); setMsg("Password updated. You can carry on."); setTimeout(() => router.replace("/"), 1200); }
  }
  return (
    <Card className="space-y-4"><h1 className="text-2xl font-bold">Choose a new password</h1>
      <form onSubmit={submit} className="space-y-4"><Field label="New password" htmlFor="np" hint="At least 8 characters."><Input id="np" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
        {msg && <p role={ok ? "status" : "alert"} className="font-semibold">{msg}</p>}<Button type="submit" size="lg" className="w-full">Update password</Button></form></Card>
  );
}
