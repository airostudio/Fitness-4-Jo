import { NextResponse } from "next/server";
import { applyBatch } from "@/lib/domain/sync";
import { syncBatchSchema } from "@/lib/domain/schemas";
import { isCloudConfigured } from "@/lib/supabase/config";
import { supabaseRepo } from "@/lib/supabase/repo";
import { createUserClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const MAX_BYTES = 1_000_000;

export async function POST(req: Request) {
  if (!isCloudConfigured()) return NextResponse.json({ error: "Cloud sync is not configured" }, { status: 503 });
  const sb = await createUserClient();
  // Identity comes from the verified session – NEVER from the request body.
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES) return NextResponse.json({ error: "Too large" }, { status: 413 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = syncBatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const results = await applyBatch(supabaseRepo(sb), user.id, parsed.data.ops);
  return NextResponse.json({ results });
}
