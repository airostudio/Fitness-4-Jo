import { createServerClient } from "@supabase/ssr";
import { createClient as createAdmin, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

/** Request-scoped client acting AS THE SIGNED-IN USER, so Row Level Security applies to every query. */
export async function createUserClient(): Promise<SupabaseClient> {
  const jar = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => { try { list.forEach(({ name, value, options }) => jar.set(name, value, options)); } catch { /* called from a Server Component – safe to ignore */ } },
    },
  });
}

/** Service-role client. Server only; used for account deletion and reminder dispatch. Never import from client code. */
export function createServiceClient(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return createAdmin(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
