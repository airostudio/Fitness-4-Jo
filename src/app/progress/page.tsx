"use client";
import { useMemo, useState } from "react";
import { formatDateAU } from "@/lib/domain/dates";
import { formatKg } from "@/lib/domain/equipment";
import { mustExercise } from "@/lib/domain/exercises";
import { MILESTONE_DEFS, compareToStart, completionRate, exerciseSeries, inRange, personalBests, sessionsThisMonth, sessionsThisWeek, totalVolume, weeklyCounts, type Range } from "@/lib/domain/stats";
import { deleteSession } from "@/lib/store/actions";
import { exerciseName, finishedSessions, setsFor } from "@/lib/store/selectors";
import { useApp } from "@/lib/store/provider";
import { HeroArt, Ring } from "@/components/art";
import { AccessibleChart } from "@/components/chart";
import { Button, Card, ChoiceGroup, Dialog, EmptyState, PageHeader, Select, Stat, Badge } from "@/components/ui";

const RANGES: { value: Range; label: string }[] = [{ value: "7", label: "Last 7 days" }, { value: "30", label: "Last 30 days" }, { value: "90", label: "Last 90 days" }, { value: "all", label: "All time" }];
const short = (iso: string) => formatDateAU(iso).replace(/ \d{4}$/, "");

export default function ProgressPage() {
  const { data, today, run, toast } = useApp();
  const [range, setRange] = useState<Range>("30");
  const [exId, setExId] = useState<string>("");
  const [del, setDel] = useState<string | null>(null);
  const sessions = useMemo(() => finishedSessions(data), [data]);
  const inR = sessions.filter((s) => inRange(s.date, range, today));
  const performed = useMemo(() => [...new Set(data.sets.filter((s) => s.completed).map((s) => s.exerciseId))], [data.sets]);
  const selected = exId || performed[0] || "";
  const series = useMemo(() => (selected ? exerciseSeries(selected, data.sets, data.sessions).filter((p) => inRange(p.date, range, today)) : []), [selected, data.sets, data.sessions, range, today]);
  const full = useMemo(() => (selected ? exerciseSeries(selected, data.sets, data.sessions) : []), [selected, data.sets, data.sessions]);
  const cmp = compareToStart(full);
  const unit = selected && mustExercise(selected).loadType === "timed" ? "seconds" : "reps";
  const hasWeight = series.some((p) => p.maxWeight != null);
  const weeks = weeklyCounts(sessions, today, range === "7" ? 2 : range === "30" ? 5 : 12).map((w) => ({ label: short(w.weekStart), Workouts: w.count }));
  const planned = data.scheduled.filter((s) => s.date <= today && inRange(s.date, range, today)).filter((s) => s.status !== "planned");
  const rate = completionRate(planned.filter((s) => s.status === "completed").length, planned.length);
  const pbs = personalBests(data.sets, data.sessions).filter((b) => b.weight != null || b.reps > 0).slice(0, 8);
  const refl = sessions.filter((s) => s.reflection && inRange(s.date, range, today)).sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => ({ label: short(s.date), Confidence: s.reflection?.confidence ?? null, Energy: s.reflection?.energy ?? null, Enjoyment: s.reflection?.enjoyment ?? null }));
  const reached = new Set(data.milestones.map((m) => m.key));
  const decisions = [...data.decisions].sort((a, b) => b.decidedAt.localeCompare(a.decidedAt)).slice(0, 10);

  if (!sessions.length) return (
    <div className="space-y-5"><PageHeader title="Progress" /><EmptyState title="Your progress will grow here">Complete your first workout and your charts, personal bests and milestones will appear. Nothing here is compared with anyone but you.</EmptyState></div>
  );
  return (
    <div className="space-y-6">
      <PageHeader title="Progress" sub="Compared only with your own starting point." />
      <Card><ChoiceGroup legend="Show me" value={range} onChange={setRange} options={RANGES} columns={2} /></Card>

      <section aria-labelledby="cons" className="space-y-3"><h2 id="cons" className="text-xl font-bold">Consistency</h2>
        <div className="hero relative"><HeroArt /><div className="hero-body flex flex-wrap items-center justify-around gap-4 p-6 pb-24">
          <Ring value={sessions.length} max={Math.max(25, sessions.length)} size={120} stroke={12} label="Progress to 25 workouts"><span className="text-3xl font-extrabold leading-none">{sessions.length}</span><span className="text-xs font-semibold uppercase opacity-80">workouts</span></Ring>
          <Ring value={rate ?? 0} max={100} size={120} stroke={12} label="Completion rate"><span className="text-3xl font-extrabold leading-none">{rate == null ? "–" : `${rate}%`}</span><span className="text-xs font-semibold uppercase opacity-80">completed</span></Ring>
        </div></div>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="This week" value={sessionsThisWeek(sessions, today)} /><Stat label="This month" value={sessionsThisMonth(sessions, today)} />
        </div>
        <Card><AccessibleChart title="Workouts per week" kind="bar" data={weeks} xKey="label" series={[{ key: "Workouts", label: "Workouts" }]} summary={`${inR.length} workouts in this period.`} /></Card>
      </section>

      <section aria-labelledby="str" className="space-y-3"><h2 id="str" className="text-xl font-bold">Strength</h2>
        <Card className="space-y-4">
          <div><label htmlFor="exsel" className="mb-1 block font-semibold">Exercise</label>
            <Select id="exsel" value={selected} onChange={(e) => setExId(e.target.value)}>{performed.map((id) => <option key={id} value={id}>{exerciseName(id)}</option>)}</Select></div>
          {cmp && <p className="rounded-2xl bg-soft p-3 text-softfg">Since your first session ({short(cmp.start.date)}): {cmp.start.maxWeight != null && cmp.now.maxWeight != null ? `${formatKg(cmp.start.maxWeight)} → ${formatKg(cmp.now.maxWeight)}, ` : ""}best reps {cmp.start.bestReps} → {cmp.now.bestReps}. 🌱</p>}
          {hasWeight && <AccessibleChart title="Weight used" unit="kg" kind="line" xKey="label" data={series.map((p) => ({ label: short(p.date), Weight: p.maxWeight }))} series={[{ key: "Weight", label: "Heaviest weight" }]}
            summary={series.length ? `From ${series[0]!.maxWeight ?? 0} kg to ${series.at(-1)!.maxWeight ?? 0} kg across ${series.length} sessions.` : ""} />}
          <AccessibleChart title={unit === "seconds" ? "Best hold" : "Repetitions"} unit={unit} kind="line" xKey="label" data={series.map((p) => ({ label: short(p.date), Best: p.bestReps }))} series={[{ key: "Best", label: "Best set" }]}
            summary={series.length ? `From ${series[0]!.bestReps} to ${series.at(-1)!.bestReps} ${unit}.` : ""} empty={<p className="text-muted">No sessions in this period.</p>} />
          {hasWeight && <AccessibleChart title="Estimated training volume" unit="kg" kind="bar" xKey="label" data={series.map((p) => ({ label: short(p.date), Volume: Math.round(p.volume) }))} series={[{ key: "Volume", label: "Weight × reps" }]} summary="Total weight lifted per session." />}
        </Card>
        <Card><h3 className="text-lg font-bold">Personal bests</h3><p className="text-sm text-muted">Total lifted across all sessions: {Math.round(totalVolume(data.sets)).toLocaleString("en-AU")} kg</p>
          <ul className="mt-2 divide-y divide-line">{pbs.map((b) => <li key={b.exerciseId} className="flex justify-between gap-3 py-2"><span className="font-semibold">{exerciseName(b.exerciseId)}</span><span className="text-muted">{b.weight != null ? `${formatKg(b.weight)} × ` : ""}{b.reps} · {short(b.date)}</span></li>)}</ul></Card>
      </section>

      <section aria-labelledby="ms" className="space-y-3"><h2 id="ms" className="text-xl font-bold">Milestones</h2>
        <Card><ul className="space-y-3">{Object.entries(MILESTONE_DEFS).map(([k, m]) => {
          const got = data.milestones.find((x) => x.key === k);
          return <li key={k} className="flex items-start gap-3"><span aria-hidden className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-2 ${reached.has(k) ? "border-primary bg-primary text-primary-fg" : "border-line"}`}>{reached.has(k) ? "✓" : ""}</span>
            <div><p className="font-semibold">{m.title} <span className="sr-only">{reached.has(k) ? "– achieved" : "– not yet"}</span>{got && <span className="ml-2 text-sm font-normal text-muted">{formatDateAU(got.achievedAt.slice(0, 10))}</span>}</p><p className="text-sm text-muted">{reached.has(k) ? m.message : "Coming up"}</p></div></li>;
        })}</ul></Card>
      </section>

      <section aria-labelledby="ref" className="space-y-3"><h2 id="ref" className="text-xl font-bold">How you&apos;ve been feeling</h2>
        <Card><AccessibleChart title="Confidence, energy and enjoyment" kind="line" xKey="label" data={refl} series={[{ key: "Confidence", label: "Confidence" }, { key: "Energy", label: "Energy", color: "var(--accent)" }, { key: "Enjoyment", label: "Enjoyment", color: "var(--danger)" }]}
          summary="Your own 1 to 5 ratings after each workout." empty={<p className="text-muted">After a workout you can rate how it felt – totally optional. Your ratings appear here.</p>} /></Card>
      </section>

      <section aria-labelledby="why" className="space-y-3"><h2 id="why" className="text-xl font-bold">Why my plan changed</h2>
        <Card>{decisions.length ? <ul className="divide-y divide-line">{decisions.map((d) => { const r = data.recommendations.find((x) => x.id === d.recommendationId);
          return <li key={d.id} className="py-3"><p className="font-semibold">{exerciseName(d.exerciseId)} · <Badge tone={d.decision === "accepted" ? "soft" : "lavender"}>{d.decision === "accepted" ? "You said yes" : d.decision === "declined" ? "You said no thanks" : "Asked later"}</Badge></p>
            <p className="text-sm text-muted">{r?.message}</p></li>; })}</ul> : <p className="text-muted">When JoStrong suggests a change and you decide, it is recorded here with the reasons.</p>}</Card>
      </section>

      <section aria-labelledby="hist" className="space-y-3"><h2 id="hist" className="text-xl font-bold">Workout history</h2>
        <Card><ul className="divide-y divide-line">{sessions.slice(0, 15).map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><div><p className="font-semibold">{formatDateAU(s.date, "weekday")} · Workout {s.letter}</p><p className="text-sm text-muted">{setsFor(data, s.id).filter((x) => x.completed).length} sets{s.status === "ended_early" ? " · finished early" : ""}{s.mode === "lighter" ? " · lighter" : ""}</p></div>
            <Button variant="ghost" size="sm" onClick={() => setDel(s.id)} aria-label={`Delete workout on ${formatDateAU(s.date)}`}>Delete</Button></li>))}</ul></Card>
      </section>
      <Dialog open={!!del} onClose={() => setDel(null)} title="Delete this workout?" actions={<><Button variant="outline" onClick={() => setDel(null)}>Keep it</Button><Button variant="danger" onClick={() => { run((d, c) => deleteSession(d, c, del!)); setDel(null); toast("Workout deleted."); }}>Delete workout</Button></>}>
        <p>This permanently removes the workout and every set you logged in it. It can&apos;t be undone.</p></Dialog>
    </div>
  );
}
