"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signInSchema } from "@/lib/domain/schemas";
import { INVITE_ONLY, isCloudConfigured } from "@/lib/supabase/config";
import { getSupabase } from "@/lib/supabase/client";
import { Button, Card, Field, Input, Notice, buttonClass } from "@/components/ui";

const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/");

function SignIn() {
  const sb = getSupabase();
  const next = safeNext(useSearchParams().get("next"));
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"in" | "up" | "magic" | "reset">("in");
  const [msg, setMsg] = useState<{ tone: "danger" | "soft"; text: string } | null>(null); const [busy, setBusy] = useState(false);

  if (!isCloudConfigured() || !sb) return (
    <div className="space-y-4"><h1 className="text-3xl font-bold">JoStrong</h1><Notice title="Accounts aren't set up on this installation">JoStrong is running in &ldquo;this device only&rdquo; mode. Your information stays in this browser. To enable accounts, add your Supabase keys (see the README).</Notice>
      <Link href="/" className={buttonClass({ size: "lg" }, "w-full")}>Continue on this device</Link></div>
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    const redirect = `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const parsed = signInSchema.safeParse({ email: email.trim(), password: mode === "in" || mode === "up" ? password : "placeholder-ok" });
    if (!parsed.success) { setMsg({ tone: "danger", text: parsed.error.issues[0]?.message ?? "Please check your details." }); return; }
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await sb!.auth.signInWithPassword({ email: parsed.data.email, password });
        if (error) throw error; window.location.href = next;
      } else if (mode === "up") {
        const { error } = await sb!.auth.signUp({ email: parsed.data.email, password, options: { emailRedirectTo: redirect } });
        if (error) throw error; setMsg({ tone: "soft", text: "Almost there – check your email for a confirmation link." });
      } else if (mode === "magic") {
        const { error } = await sb!.auth.signInWithOtp({ email: parsed.data.email, options: { emailRedirectTo: redirect, shouldCreateUser: !INVITE_ONLY } });
        if (error) throw error; setMsg({ tone: "soft", text: "If that email can sign in, a link is on its way." });
      } else {
        await sb!.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${location.origin}/auth/callback?next=/auth/reset` });
        setMsg({ tone: "soft", text: "If that email has an account, a reset link is on its way." });
      }
    } catch { setMsg({ tone: "danger", text: mode === "in" ? "That email and password didn't match. Please try again." : "Something went wrong. Please try again in a moment." }); }
    finally { setBusy(false); }
  }
  const titles = { in: "Welcome back", up: "Create your private account", magic: "Email me a sign-in link", reset: "Reset your password" } as const;
  return (
    <div className="space-y-5">
      <header className="text-center"><p className="text-3xl font-extrabold text-primary">JoStrong</p><p className="text-muted">A little stronger, every day.</p></header>
      <Card className="space-y-4"><h1 className="text-2xl font-bold">{titles[mode]}</h1>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Email" htmlFor="em"><Input id="em" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
          {(mode === "in" || mode === "up") && <Field label="Password" htmlFor="pw" hint={mode === "up" ? "At least 8 characters." : undefined}><Input id="pw" type="password" autoComplete={mode === "up" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>}
          {msg && <p role={msg.tone === "danger" ? "alert" : "status"} className={`rounded-2xl p-3 font-semibold ${msg.tone === "danger" ? "bg-dangersoft text-danger" : "bg-soft text-softfg"}`}>{msg.text}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "One moment…" : mode === "in" ? "Sign in" : mode === "up" ? "Create account" : mode === "magic" ? "Send me a link" : "Send reset link"}</Button>
        </form>
        <div className="flex flex-col gap-1 text-center">
          {mode !== "in" && <button className="min-h-11 font-semibold underline" onClick={() => setMode("in")}>Sign in with a password</button>}
          {mode === "in" && <button className="min-h-11 font-semibold underline" onClick={() => setMode("magic")}>Email me a sign-in link instead</button>}
          {mode === "in" && <button className="min-h-11 font-semibold underline" onClick={() => setMode("reset")}>I forgot my password</button>}
          {mode === "in" && !INVITE_ONLY && <button className="min-h-11 font-semibold underline" onClick={() => setMode("up")}>New here? Create an account</button>}
          {INVITE_ONLY && mode === "in" && <p className="text-sm text-muted">JoStrong is invitation-only.</p>}
        </div>
      </Card>
      <p className="text-center text-sm text-muted"><Link href="/privacy" className="underline">Privacy</Link> · <Link href="/terms" className="underline">Terms</Link></p>
    </div>
  );
}
export default function Page() { return <Suspense><SignIn /></Suspense>; }
