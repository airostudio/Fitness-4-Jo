"use client";
import { ArrowRight, CalendarDays, Heart, Play, Sparkles, Trophy } from "lucide-react";
import Link from "next/link";
import { WEEKDAY_NAMES, WEEKDAY_SHORT, diffDays, formatDateAU, hourInTz, isoWeekday } from "@/lib/domain/dates";
import { greeting, restDayMessage, weekSummary } from "@/lib/domain/messages";
import { PHASE_LABELS, phaseForWeek } from "@/lib/domain/program";
import { MILESTONE_DEFS, latestMilestone, personalBests, sessionsThisWeek } from "@/lib/domain/stats";
import { formatKg } from "@/lib/domain/equipment";
import { exerciseName, finishedSessions, activeSession, openRecommendations, daysSinceLast } from "@/lib/store/selectors";
import { confirmWeekReview, weekReviewFor, acknowledgeClearance } from "@/lib/store/actions";
import { useApp } from "@/lib/store/provider";
import { Badge, Button, Card, Notice, ProgressBar, buttonClass } from "@/components/ui";
import { HeroArt, Medal, Ring, RestArt, WeekDots } from "@/components/art";
import { RecommendationCard } from "@/components/recommendation-card";
import { mondayOf, addDays } from "@/lib/domain/dates";

export default function HomePage() {
  const { data, today, run } = useApp();
  if (!data.profile || !data.program) return null;
  const name = data.profile.name;
  const prog = data.program;
  const sessions = finishedSessions(data);
  const done = sessionsThisWeek(sessions, today);
  const monday = mondayOf(today);
  const plannedThisWeek = data.scheduled.filter((s) => s.date >= monday && s.date < addDays(monday, 7) && s.status !== "skipped").length;
  const todays = data.scheduled.find((s) => s.date === today && s.status !== "skipped");
  const next = [...data.scheduled].filter((s) => s.status === "planned" && s.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
  const tomorrow = next && diffDays(next.date, today) === 1;
  const active = activeSession(data);
  const hour = hourInTz(new Date(), data.preferences.timezone);
  const recs = openRecommendations(data);
  const review = weekReviewFor(data, today);
  const phase = PHASE_LABELS[phaseForWeek(prog.currentWeek)];
  const ms = latestMilestone(data.milestones);
  const pb = personalBests(data.sets, data.sessions).find((b) => b.weight != null);
  const gap = daysSinceLast(data, today);
  const recovery = gap == null ? "Ready whenever you are" : gap === 0 ? "Resting after today's session" : gap === 1 ? "Recovering – a gentle day" : "Fully rested";
  const locked = prog.screening.status === "clearance_recommended" && !data.health.clearanceAcknowledged;
  const completedToday = sessions.some((s) => s.date === today);

  return (
    <div className="space-y-5">
      <section className="hero rise" aria-labelledby="hello">
        <HeroArt />
        <div className="hero-body flex items-start justify-between gap-4 p-6 pb-24">
          <div className="max-w-[16rem]">
            <p className="text-sm font-semibold opacity-90">Week {prog.currentWeek} · {phase.name}</p>
            <h1 id="hello" className="mt-1 text-3xl font-extrabold">{greeting(name, hour)}</h1>
            <p className="mt-2 text-[1.05rem] leading-snug opacity-95">{weekSummary(name, done, plannedThisWeek, today)}</p>
          </div>
          <Ring value={done} max={Math.max(plannedThisWeek, done, 1)} size={104} stroke={11} label="Sessions completed this week">
            <span className="text-2xl font-extrabold leading-none">{done}/{Math.max(plannedThisWeek, done, 1)}</span><span className="text-[0.7rem] font-semibold uppercase tracking-wide opacity-80">this week</span>
          </Ring>
        </div>
      </section>
      <Card className="-mt-2"><WeekDots days={Array.from({ length: 7 }, (_, k) => { const d = addDays(monday, k); const sc = data.scheduled.find((x) => x.date === d && x.status !== "skipped"); return { label: WEEKDAY_SHORT[k]!, today: d === today, letter: sc?.letter, state: sc?.status === "completed" ? "done" as const : sc ? "planned" as const : "rest" as const }; })} /></Card>

      {locked && (
        <Notice tone="warn" title="Please check in with a professional first">
          <ul className="list-disc pl-5">{prog.screening.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          <div className="mt-3"><Button variant="outline" onClick={() => run((d, c) => acknowledgeClearance(d, c))}>I have professional guidance to proceed</Button></div>
        </Notice>
      )}

      {active ? (
        <Card className="space-y-3 border-2 border-primary">
          <h2 className="text-xl font-bold">Your workout is still open</h2><p className="text-muted">Pick up right where you left off – everything you logged is saved.</p>
          <Link href="/workout" className={buttonClass({ size: "xl" })}><Play aria-hidden /> Resume workout</Link>
        </Card>
      ) : todays && todays.status === "planned" && !completedToday ? (
        <Card className="space-y-3 border-0 bg-gradient-to-br from-soft to-surface">
          <Badge tone="peach">Today · Workout {todays.letter}</Badge>
          <h2 className="text-2xl font-bold">Ready for a little strength training?</h2>
          <p className="text-muted">Week {prog.currentWeek} · {phase.name}. {data.preferences.sessionMinutes ? `About ${Math.min(data.preferences.sessionMinutes, 45)} minutes.` : ""}</p>
          <Link href={`/workout?letter=${todays.letter}`} aria-disabled={locked} className={buttonClass({ size: "xl" }, locked ? "pointer-events-none opacity-50" : "")}><Play aria-hidden /> Start Today&apos;s Workout</Link>
        </Card>
      ) : completedToday ? (
        <Card className="space-y-2 bg-soft"><h2 className="flex items-center gap-2 text-2xl font-bold"><Heart aria-hidden size={24} /> Today&apos;s session is done</h2><p className="text-muted">Lovely work, {name}. Rest well.{next ? ` Next up: Workout ${next.letter} on ${formatDateAU(next.date, "weekday")}.` : ""}</p></Card>
      ) : (
        <Card className="relative space-y-2 overflow-hidden bg-lavender text-lavenderfg"><RestArt className="absolute -right-2 top-2 w-32 opacity-40" /><h2 className="text-2xl font-bold">Rest day</h2><p>{restDayMessage(today)}</p>
          {next && <p className="font-semibold">Next training day: {formatDateAU(next.date, "weekday")} (Workout {next.letter})</p>}
          <Link href="/workout" className={buttonClass({ variant: "outline" }, "border-lavenderfg text-lavenderfg")}>Feeling like a session anyway?</Link></Card>
      )}

      {tomorrow && next && !todays && <Notice tone="peach" title="A gentle heads-up">{name}, your strength session is scheduled for tomorrow ({WEEKDAY_NAMES[isoWeekday(next.date) - 1]}).</Notice>}

      {review && (
        <Card className="space-y-3 border-2 border-accent">
          <h2 className="text-xl font-bold">{review.review.title}</h2><p>{review.review.message}</p>
          <ul className="list-disc pl-6 text-sm text-muted">{review.review.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          <div className="flex flex-wrap gap-2">
            {(["advance", "repeat", "ease"] as const).map((o) => (
              <Button key={o} variant={o === review.review.action ? "primary" : "outline"} onClick={() => run((d, c) => confirmWeekReview(d, c, o))}>
                {o === "advance" ? "Move to next week" : o === "repeat" ? "Repeat this week" : "Take an easier week"}{o === review.review.action ? " (suggested)" : ""}
              </Button>
            ))}
          </div>
        </Card>
      )}

      {recs.length > 0 && <section aria-labelledby="sug" className="space-y-3"><h2 id="sug" className="text-xl font-bold">A suggestion for you</h2>{recs.slice(0, 2).map((r) => <RecommendationCard key={r.id} rec={r} />)}</section>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-bold"><CalendarDays aria-hidden size={20} /> This week</h2>
          <p className="text-muted">Week {prog.currentWeek} · {phase.name}</p>
          <ProgressBar value={done} max={Math.max(plannedThisWeek, done, 1)} label="Sessions completed this week" />
          <p className="font-semibold">{done} of {plannedThisWeek || "–"} sessions</p>
          <p className="text-sm text-muted">{phase.blurb}</p>
        </Card>
        <Card className="space-y-2"><h2 className="flex items-center gap-2 text-lg font-bold"><Sparkles aria-hidden size={20} /> Recovery</h2><p className="text-xl font-semibold">{recovery}</p>
          <p className="text-sm text-muted">Rest days are when your muscles adapt.</p></Card>
        <Card className="space-y-2"><div className="flex items-center gap-3"><Medal size={52} /><h2 className="text-lg font-bold">Latest achievement</h2></div>
          {ms ? <><p className="text-xl font-semibold">{MILESTONE_DEFS[ms.key]?.title}</p><p className="text-sm text-muted">{MILESTONE_DEFS[ms.key]?.message}</p></> : <p className="text-muted">Your first milestone is just one session away.</p>}</Card>
        <Card className="space-y-2"><h2 className="flex items-center gap-2 text-lg font-bold"><Trophy aria-hidden size={20} /> Recent personal best</h2>
          {pb ? <><p className="text-xl font-semibold">{exerciseName(pb.exerciseId)}</p><p className="text-sm text-muted">{formatKg(pb.weight)} × {pb.reps} on {formatDateAU(pb.date)}</p></> : <p className="text-muted">Log a weighted exercise and your personal bests will appear here.</p>}</Card>
      </div>

      <Link href="/nutrition" className="lift flex items-center gap-4 rounded-card border border-line bg-gradient-to-br from-soft to-surface p-5 shadow-card">
        <span aria-hidden className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-surface text-3xl">🥗</span>
        <span><span className="block text-lg font-bold">{data.nutrition.enabled ? "Fuel your strength" : "Add gentle nutrition support"}</span>
          <span className="block text-muted">{data.nutrition.enabled ? "Log today's plate and see meal ideas" : "Optional food ideas to support your training – no calorie counting."}</span></span>
        <ArrowRight aria-hidden className="ml-auto shrink-0" size={18} /></Link>

      <Card className="space-y-2"><h2 className="text-lg font-bold">Recommended next step</h2>
        <p className="text-muted">{active ? "Finish your open workout." : todays?.status === "planned" && !completedToday ? "Start today's session when you feel ready." : recs.length ? "Review your suggestion above." : next ? `Enjoy your rest. Next session: ${formatDateAU(next.date, "weekday")}.` : "Check your calendar in My Workouts."}</p>
        <Link href="/workouts" className="inline-flex min-h-11 items-center gap-1 font-semibold text-primary underline">See my schedule <ArrowRight aria-hidden size={16} /></Link></Card>
    </div>
  );
}
