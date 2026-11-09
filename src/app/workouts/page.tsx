"use client";
import { CalendarDays, Moon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { mondayOf, addDays, formatDateAU, WEEKDAY_SHORT, isoWeekday } from "@/lib/domain/dates";
import { mustExercise } from "@/lib/domain/exercises";
import { estimateMinutes, PHASE_LABELS, phaseForWeek, weekPlan, alternativesForSlot } from "@/lib/domain/program";
import { dayState } from "@/lib/domain/calendar";
import * as A from "@/lib/store/actions";
import { useApp } from "@/lib/store/provider";
import { Badge, Button, Card, CheckGroup, Dialog, Field, Input, Notice, PageHeader, Select, buttonClass } from "@/components/ui";
import { DAY_OPTIONS } from "@/lib/options";
import type { ScheduledWorkout, WorkoutLetter, SlotKey } from "@/lib/domain/types";

export default function WorkoutsPage() {
  const { data, run, today, toast } = useApp();
  const [moving, setMoving] = useState<ScheduledWorkout | null>(null);
  const [newDate, setNewDate] = useState("");
  const [msg, setMsg] = useState<{ text: string; tone: "danger" | "warn" } | null>(null);
  const [editDays, setEditDays] = useState(false);
  const [days, setDays] = useState<number[]>(data.preferences.trainingDays);
  const p = data.program;
  if (!p) return null;
  const wp = weekPlan(p.currentWeek, data.preferences.daysPerWeek);
  const phase = PHASE_LABELS[phaseForWeek(p.currentWeek)];
  const monday = mondayOf(today);
  const weeks = [monday, addDays(monday, 7)];

  const doMove = () => {
    if (!moving) return;
    const r = run((d, c) => A.moveScheduled(d, c, moving.id, newDate));
    if (!r.ok) { setMsg({ text: r.error ?? "Couldn't move that session.", tone: "danger" }); return; }
    toast(r.warning ? `Moved. ${r.warning}` : "Session moved. Your calendar has been updated.");
    setMoving(null); setMsg(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="My Workouts" sub={`Week ${p.currentWeek} · ${phase.name} · ${wp.sessions} session${wp.sessions > 1 ? "s" : ""} this week · ${wp.sets} set${wp.sets > 1 ? "s" : ""} each`} />

      <section aria-labelledby="cal" className="space-y-3">
        <div className="flex items-center justify-between"><h2 id="cal" className="flex items-center gap-2 text-xl font-bold"><CalendarDays aria-hidden size={22} /> Calendar</h2>
          <Button variant="soft" size="sm" onClick={() => { setDays(data.preferences.trainingDays); setEditDays(true); }}>Change my training days</Button></div>
        {weeks.map((wk, i) => (
          <Card key={wk} className="space-y-2">
            <h3 className="font-bold">{i === 0 ? "This week" : "Next week"} <span className="font-normal text-muted">· from {formatDateAU(wk)}</span></h3>
            <ul className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: 7 }, (_, k) => addDays(wk, k)).map((d) => {
                const st = dayState(data.scheduled, d);
                const isToday = d === today;
                return (
                  <li key={d} className={`flex min-h-24 flex-col items-center rounded-xl border-2 p-1 text-center text-xs ${isToday ? "border-primary" : "border-line"} ${st.kind === "rest" ? "bg-surface2 text-muted" : "bg-soft text-softfg"}`}>
                    <span className="font-semibold">{WEEKDAY_SHORT[isoWeekday(d) - 1]}</span><span>{Number(d.slice(8))}</span>
                    {st.kind === "rest" ? <span className="mt-1 flex flex-col items-center"><Moon size={14} aria-hidden /><span>Rest</span></span>
                      : <span className="mt-1 font-bold">{st.item.status === "completed" ? "✓ " : ""}{st.item.letter}</span>}
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
        <ul className="space-y-2">
          {data.scheduled.filter((s) => s.status !== "skipped" && s.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6).map((s) => (
            <li key={s.id}><Card className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div><p className="font-bold">{formatDateAU(s.date, "weekday")}</p><p className="text-muted">Workout {s.letter}{s.moved ? " · moved by you" : ""}</p></div>
              {s.status === "planned" ? (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setMoving(s); setNewDate(s.date); setMsg(null); }}>Move</Button>
                  <Button variant="ghost" size="sm" onClick={() => { run((d, c) => A.skipScheduled(d, c, s.id)); toast("Okay – that session is off the calendar."); }}>Skip</Button>
                </div>) : <Badge>Completed ✓</Badge>}
            </Card></li>
          ))}
          {!data.scheduled.some((s) => s.status === "planned" && s.date >= today) && <li><Notice>Nothing is scheduled right now. Your calendar refills automatically each time you open the app.</Notice></li>}
        </ul>
        <p className="text-sm text-muted">Missed a day? No problem – there is no catch-up. Rest days are never counted as missed.</p>
      </section>

      <section aria-labelledby="progs" className="space-y-3">
        <h2 id="progs" className="text-xl font-bold">Your two workouts</h2>
        {p.screening.status !== "ok" && <Notice tone={p.screening.status === "clearance_recommended" ? "warn" : "soft"} title="Adjustments made for you"><ul className="list-disc pl-5">{[...p.screening.reasons, ...p.screening.modifications].map((r) => <li key={r}>{r}</li>)}</ul></Notice>}
        {p.templates.map((t) => (
          <Card key={t.letter} className="space-y-3">
            <div className="flex items-center justify-between gap-3"><h3 className="text-xl font-bold">{t.name}</h3><Badge>~{estimateMinutes(t, wp.sets)} min</Badge></div>
            <ol className="divide-y divide-line">
              {t.slots.filter((s) => !s.optional).map((s) => {
                const e = mustExercise(s.exerciseId);
                const alts = alternativesForSlot(s.slot as SlotKey, data.equipment, data.health);
                const tgt = p.exerciseTargets[e.id];
                return (
                  <li key={s.slot} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div><Link href={`/exercises/${e.id}`} className="font-semibold underline">{e.name}</Link><p className="text-sm text-muted">{e.muscles.join(", ")}{tgt?.weight != null ? ` · ${tgt.weight} kg` : ""}</p></div>
                    {alts.length > 1 && (
                      <div className="w-full sm:w-64"><label className="sr-only" htmlFor={`sw-${t.letter}-${s.slot}`}>Swap {e.name}</label>
                        <Select id={`sw-${t.letter}-${s.slot}`} value={e.id} onChange={(ev) => { const r = run((d, c) => A.customiseSlot(d, c, t.letter as WorkoutLetter, s.slot as SlotKey, ev.target.value)); toast(r.ok ? "Exercise updated." : r.error ?? "Couldn't change that."); }}>
                          {alts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></div>
                    )}
                  </li>
                );
              })}
            </ol>
            {t.slots.some((s) => s.optional) && <p className="text-sm text-muted">Optional extras: {t.slots.filter((s) => s.optional).map((s) => mustExercise(s.exerciseId).name).join(", ")}</p>}
            <Link href={`/workout?letter=${t.letter}`} className={buttonClass({ variant: "soft" })}>Do Workout {t.letter} now</Link>
          </Card>
        ))}
        <Link href="/exercises" className={buttonClass({ variant: "outline", size: "lg" }, "w-full")}>Browse the exercise library</Link>
        <Link href="/nutrition" className={buttonClass({ variant: "outline", size: "lg" }, "w-full")}>Nutrition ideas to support your training</Link>
      </section>

      <Dialog open={!!moving} onClose={() => setMoving(null)} title="Move this session"
        actions={<><Button variant="outline" onClick={() => setMoving(null)}>Cancel</Button><Button onClick={doMove}>Move session</Button></>}>
        <Field label="New date" htmlFor="nd"><Input id="nd" type="date" min={today} value={newDate} onChange={(e) => setNewDate(e.target.value)} /></Field>
        {msg && <p role="alert" className="font-semibold text-danger">{msg.text}</p>}
        <p>Later sessions are re-planned automatically, so workouts never double up.</p>
      </Dialog>
      <Dialog open={editDays} onClose={() => setEditDays(false)} title="Which days suit you?"
        actions={<><Button variant="outline" onClick={() => setEditDays(false)}>Cancel</Button><Button disabled={!days.length} onClick={() => { run((d, c) => A.updateSingle(d, c, "preferences", { trainingDays: days })); setEditDays(false); toast("Calendar rebuilt around your new days. Your history is untouched."); }}>Save days</Button></>}>
        <CheckGroup legend="Preferred training days" values={days} onToggle={(v) => setDays((d) => (d.includes(v) ? d.filter((x) => x !== v) : [...d, v].sort()))} options={DAY_OPTIONS} />
      </Dialog>
    </div>
  );
}
