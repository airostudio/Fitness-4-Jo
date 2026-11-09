import { NextResponse } from "next/server";
import { isCloudConfigured } from "@/lib/supabase/config";
import { createServiceClient, createUserClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Permanently deletes the signed-in user's account and every record (foreign keys cascade). */
export async function POST(req: Request) {
  if (!isCloudConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const sb = await createUserClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { confirm?: string };
  if (body.confirm !== "DELETE") return NextResponse.json({ error: "Confirmation required" }, { status: 400 });
  try {
    const admin = createServiceClient();
    // Remove private photographs first (storage objects are not covered by the database cascade)
    const { data: files } = await admin.storage.from("journal-photos").list(user.id, { limit: 1000 });
    if (files?.length) await admin.storage.from("journal-photos").remove(files.map((f) => `${user.id}/${f.name}`));
    await admin.from("audit_events").insert({ user_id: null, event: "account.deleted" }); // no identifier retained
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Account deletion could not be completed. Please try again or contact support." }, { status: 500 });
  }
}
