import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isCloudConfigured } from "@/lib/supabase/config";

const PUBLIC = [/^\/auth(\/|$)/, /^\/privacy$/, /^\/terms$/, /^\/offline$/, /^\/sw\.js$/, /^\/manifest\.webmanifest$/, /^\/icons\//, /^\/api\/cron\//, /^\/favicon/];

/** Refreshes the Supabase session cookie and sends signed-out visitors to sign-in. Local-only mode is untouched. */
export async function proxy(request: NextRequest) {
  if (!isCloudConfigured()) return NextResponse.next();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  // getUser() validates the token with the Auth server – never trust an unverified cookie.
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  if (!user && !PUBLIC.some((r) => r.test(path))) {
    if (path.startsWith("/api/")) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    const url = request.nextUrl.clone();
    url.pathname = "/auth/sign-in";
    url.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"] };
