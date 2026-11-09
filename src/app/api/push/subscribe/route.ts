import { NextResponse } from "next/server";
import { z } from "zod";
import { isCloudConfigured } from "@/lib/supabase/config";
import { createUserClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const schema = z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) });

export async function POST(req: Request) {
  if (!isCloudConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const sb = await createUserClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  const { error } = await sb.from("push_subscriptions").upsert({ user_id: user.id, endpoint: p.data.endpoint, p256dh: p.data.keys.p256dh, auth: p.data.keys.auth }, { onConflict: "endpoint" });
  if (error) return NextResponse.json({ error: "Could not save" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
export async function DELETE(req: Request) {
  const sb = await createUserClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { endpoint?: string };
  if (body.endpoint) await sb.from("push_subscriptions").delete().eq("endpoint", body.endpoint);
  return NextResponse.json({ ok: true });
}
