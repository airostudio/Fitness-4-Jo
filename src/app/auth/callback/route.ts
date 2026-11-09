import { NextResponse } from "next/server";
import { createUserClient } from "@/lib/supabase/server";

/** Completes magic-link / confirmation / password-recovery flows by exchanging the one-time code for a session cookie. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const raw = url.searchParams.get("next") ?? "/";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/"; // prevent open redirects
  if (code) {
    const sb = await createUserClient();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/auth/sign-in?error=link", url.origin));
}
