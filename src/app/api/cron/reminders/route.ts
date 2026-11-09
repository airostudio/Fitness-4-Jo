import { NextResponse } from "next/server";
import * as webpush from "web-push";
import { addDays, hourInTz, isoDateInTz } from "@/lib/domain/dates";
import { reminderCopy } from "@/lib/domain/messages";
import { isCloudConfigured } from "@/lib/supabase/config";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Sends at most ONE gentle reminder per planned session (never "you missed…" messages).
 * Secured with CRON_SECRET (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`).
 * `?catchup=1` ignores the preferred hour – use it with a once-a-day schedule on plans without hourly crons.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!isCloudConfigured() || !pub || !priv || !process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ skipped: "push not configured" });
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:admin@example.com", pub, priv);

  const catchup = new URL(req.url).searchParams.get("catchup") === "1";
  const sb = createServiceClient();
  const { data: prefs } = await sb.from("notification_preferences").select("user_id, time, quiet_start, quiet_end, day_before, last_notified_for").eq("enabled", true);
  let sent = 0;
  for (const p of prefs ?? []) {
    const { data: up } = await sb.from("user_preferences").select("timezone").eq("user_id", p.user_id).maybeSingle();
    const tz = up?.timezone ?? "Australia/Melbourne";
    const now = new Date();
    const today = isoDateInTz(now, tz), hour = hourInTz(now, tz);
    if (!catchup && hour !== Number(String(p.time).slice(0, 2))) continue;
    const qs = Number(String(p.quiet_start).slice(0, 2)), qe = Number(String(p.quiet_end).slice(0, 2));
    const quiet = qs > qe ? hour >= qs || hour < qe : hour >= qs && hour < qe;
    if (!catchup && quiet) continue;
    if (p.last_notified_for === today) continue;
    const { data: sess } = await sb.from("scheduled_workouts").select("date,status").eq("user_id", p.user_id).eq("status", "planned").in("date", [today, addDays(today, 1)]);
    const todayPlanned = sess?.some((s) => s.date === today);
    const tomorrowPlanned = p.day_before && sess?.some((s) => s.date === addDays(today, 1));
    if (!todayPlanned && !tomorrowPlanned) continue;
    const { data: prof } = await sb.from("profiles").select("name").eq("user_id", p.user_id).maybeSingle();
    const body = reminderCopy(prof?.name ?? "there", todayPlanned ? "today" : "dayBefore", `${p.user_id}${today}`);
    const { data: subs } = await sb.from("push_subscriptions").select("endpoint,p256dh,auth").eq("user_id", p.user_id);
    for (const s of subs ?? []) {
      try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title: "JoStrong", body, url: "/" })); sent++; }
      catch (e) { if ((e as { statusCode?: number }).statusCode === 410) await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint); }
    }
    await sb.from("notification_preferences").update({ last_notified_for: today }).eq("user_id", p.user_id);
  }
  return NextResponse.json({ sent });
}
