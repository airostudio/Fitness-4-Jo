import { NextResponse } from "next/server";
import { z } from "zod";
import { isCloudConfigured } from "@/lib/supabase/config";
import { createServiceClient, createUserClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const schema = z.object({ area: z.string().max(60), message: z.string().max(300), code: z.string().max(40).optional() }).strict();

/** Sanitised technical errors only. Callers must be signed in; text is truncated and stripped of anything that looks like personal data. */
export async function POST(req: Request) {
  if (!isCloudConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ ok: true });
  const sb = await createUserClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  const clean = parsed.data.message.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]").replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, "[id]").slice(0, 300);
  await createServiceClient().from("error_events").insert({ area: parsed.data.area, message: clean, code: parsed.data.code ?? null });
  return NextResponse.json({ ok: true });
}
