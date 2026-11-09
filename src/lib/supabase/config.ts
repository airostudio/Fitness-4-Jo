/** Supabase is optional: without these variables JoStrong runs in "this device only" mode. */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const isCloudConfigured = (): boolean => SUPABASE_URL.startsWith("http") && SUPABASE_ANON_KEY.length > 20;
export const INVITE_ONLY = process.env.NEXT_PUBLIC_INVITE_ONLY === "true";
