"use client";
import { ArrowRight, Check, Minus, Pause, Play, Plus, Repeat, SkipForward, Square, Shuffle, Timer } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatKg, nextHeavier, nextLighter } from "@/lib/domain/equipment";
import { mustExercise } from "@/lib/domain/exercises";
import { formatDateAU } from "@/lib/domain/dates";
import { estimateMinutes } from "@/lib/domain/program";
import { calibrationAdvice } from "@/lib/domain/progression";
import type { Effort, ExerciseSet, SetDiscomfort, Technique, WorkoutSession } from "@/lib/domain/types";
import * as A from "@/lib/store/actions";
import { lastPerformance, setsFor } from "@/lib/store/selectors";
import { useApp } from "@/lib/store/provider";
import { Button, Card, ChoiceGroup, Dialog, Field, Input, Notice, ProgressBar, Textarea } from "@/components/ui";
import { ExerciseMedia, Instructions } from "@/components/exercise-media";

function useNow(active: boolean, ms = 250) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (!active) return; const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [active, ms]);
  return now;
}
const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.max(0, Math.floor(sec % 60))).padStart(2, "0")}`;

export function Player({ session, onFinished }: { session: WorkoutSession; onFinished: (id: string) => void }) {
  const { data, run, toast } = useApp();
  const sid = session.id;
  const paused = session.status === "paused";
  const ex = session.exercises[session.currentIndex]!;
  const def = mustExercise(ex.exerciseId);
  const done = setsFor(data, sid, ex.id);
  const last = useMemo(() => lastPerformance(data, ex.exerciseId), [data, ex.exerciseId]);
  const weights = data.equipment.dumbbellWeightsKg;
  const usesWeight = def.loadType === "dumbbell";
  const timed = def.loadType === "timed";
  const firstTime = !last;
  const prevSet = done[done.length - 1];

  const [weight, setWeight] = useState<number | null>(ex.targetWeight);
  const [reps, setReps] = useState<number>(Math.round((ex.repMin + ex.repMax) / 2));
  const [dialog, setDialog] = useState<null | "end" | "swap" | "edit" | "skip">(null);
  const [swapTo, setSwapTo] = useState<string>();
  const [editing, setEditing] = useState<ExerciseSet | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [advice, setAdvice] = useState<string | null>(null);

  // Reset the inputs whenever Jo moves to a different exercise, and carry the last set's numbers forward within one.
  const key = `${ex.id}:${ex.exerciseId}`;
  const seeded = useRef("");
  useEffect(() => {
    if (seeded.current === key) return;
    seeded.current = key;
    setWeight(ex.targetWeight); setReps(Math.round((ex.repMin + ex.repMax) / 2)); setAdvice(null);
  }, [key, ex]);

  const resting = !!session.rest && !paused;
  const inSet = !!session.setInProgressSince;
  const now = useNow(resting || inSet || paused || !!session.rest);
  const restRemaining = session.rest ? Math.max(0, Math.ceil(((session.rest.endsAt ? Date.parse(session.rest.endsAt) - now : (session.rest.pausedRemainingMs ?? 0))) / 1000)) : 0;
  const restPaused = !!session.rest && session.rest.pausedRemainingMs != null && !session.rest.endsAt;
  const setElapsed = session.setInProgressSince ? Math.floor((now - Date.parse(session.setInProgressSince)) / 1000) : 0;
  const exerciseDone = done.length >= ex.targetSets;
  const doneCount = session.exercises.filter((e) => e.status !== "pending").length;

  // Alert when the rest ends (once)
  const alerted = useRef<string>("");
  useEffect(() => {
    if (session.rest?.endsAt && restRemaining === 0 && alerted.current !== session.rest.endsAt) {
      alerted.current = session.rest.endsAt;
      if (data.preferences.vibration && "vibrate" in navigator) navigator.vibrate?.([200, 100, 200]);
      if (data.preferences.sound) { try { const c = new AudioContext(); const o = c.createOscillator(); o.connect(c.destination); o.frequency.value = 660; o.start(); o.stop(c.currentTime + 0.25); } catch { /* ignore */ } }
    }
  }, [restRemaining, session.rest, data.preferences]);

  // Keep the screen awake during a workout where supported
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const get = async () => { try { lock = (await navigator.wakeLock?.request("screen")) ?? null; } catch { /* unsupported or denied */ } };
    if (!paused) void get();
    const vis = () => { if (document.visibilityState === "visible" && !paused) void get(); };
    document.addEventListener("visibilitychange", vis);
    return () => { document.removeEventListener("visibilitychange", vis); void lock?.release().catch(() => undefined); };
  }, [paused]);

  const stepWeight = (dir: 1 | -1) => {
    const cur = weight ?? 0;
    if (weights.length) {
      const n = dir === 1 ? nextHeavier(weights, cur) : nextLighter(weights, cur);
      if (n != null) setWeight(n); else if (dir === -1) setWeight(weight == null ? null : weights[0]! < cur ? weights[0]! : cur);
    } else setWeight(Math.max(0, Math.round((cur + dir * 0.5) * 10) / 10));
  };

  const complete = () => { setAdvice(null); run((d, c) => A.completeSet(d, c, sid, { weight: usesWeight ? weight : null, reps })); };
  const patchLastSet = (patch: Partial<Pick<ExerciseSet, "effort" | "discomfort" | "note">>) => {
    const s = setsFor(data, sid, ex.id).at(-1); if (!s) return;
    run((d, c) => A.editSet(d, c, s.id, patch));
    if (patch.effort && firstTime && usesWeight && done.length === 1) setAdvice(calibrationAdvice(patch.effort, s.weight, weights).message);
  };

  const exSets = done;
  const fresh = !exerciseDone && !resting;
  const minutes = estimateMinutes({ letter: session.letter, name: "", slots: session.exercises.map((e) => ({ slot: e.slot, exerciseId: e.exerciseId })) }, session.exercises[0]?.targetSets ?? 1);

  const endDialog = (() => {
    const total = session.exercises.length;
    const logged = data.sets.filter((s) => s.sessionId === sid && s.completed).length;
    return (
      <Dialog open={dialog === "end"} onClose={() => setDialog(null)} title="End your workout?"
        actions={<>
          <Button variant="outline" onClick={() => setDialog(null)}>Keep going</Button>
          {logged > 0 && doneCount < total && <Button variant="soft" onClick={() => { run((d, c) => A.endSession(d, c, sid, "early")); setDialog(null); onFinished(sid); }}>Finish early</Button>}
          {logged > 0 && doneCount >= total && <Button onClick={() => { run((d, c) => A.endSession(d, c, sid, "finished")); setDialog(null); onFinished(sid); }}>Finish workout</Button>}
          {logged === 0 && <Button variant="dangerOutline" onClick={() => { run((d, c) => A.deleteSession(d, c, sid)); setDialog(null); toast("Workout cancelled. Nothing was saved."); onFinished(""); }}>End without saving</Button>}
        </>}>
        <p>{logged > 0 ? `You've logged ${logged} set${logged === 1 ? "" : "s"}. Finishing early keeps everything you've done – there's no penalty.` : "You haven't logged any sets yet."}</p>
        <p>Not ready to decide? Just leave this screen. Your workout stays open so you can come back to it.</p>
      </Dialog>
    );
  })();

  if (paused) {
    return (
      <div className="space-y-5 text-center">
        <Card className="space-y-4 py-10"><Pause size={40} aria-hidden className="mx-auto text-primary" /><h1 className="text-3xl font-bold">Workout paused</h1><p className="text-muted">Take all the time you need. Your progress is saved.</p>
          <Button size="xl" onClick={() => run((d, c) => A.resumeSession(d, c, sid))}><Play aria-hidden /> Resume workout</Button>
          <Button variant="outline" size="lg" onClick={() => setDialog("end")}>End workout</Button></Card>
        {endDialog}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <div><h1 className="text-xl font-bold">Workout {session.letter} <span className="font-normal text-muted">· {formatDateAU(session.date)}{session.mode === "lighter" ? " · Lighter" : ""}</span></h1>
          <p className="text-sm text-muted">Exercise {session.currentIndex + 1} of {session.exercises.length} · about {minutes} min</p></div>
        <div className="grid grid-cols-2 gap-2"><Button variant="outline" size="sm" onClick={() => run((d, c) => A.pauseSession(d, c, sid))}><Pause size={16} aria-hidden /> Pause workout</Button>
          <Button variant="outline" size="sm" onClick={() => setDialog("end")}><Square size={16} aria-hidden /> End workout</Button></div>
        <ProgressBar value={doneCount} max={session.exercises.length} label="Workout progress" />
        <ol className="flex gap-1.5" aria-label="Exercises">
          {session.exercises.map((e, i) => (
            <li key={e.id} className="flex-1"><button onClick={() => run((d, c) => A.gotoExercise(d, c, sid, i))} aria-label={`${mustExercise(e.exerciseId).name}${e.status === "done" ? ", done" : e.status === "skipped" ? ", skipped" : ""}`} aria-current={i === session.currentIndex ? "step" : undefined}
              className={`flex h-11 w-full items-center justify-center rounded-lg border-2 text-sm font-bold ${i === session.currentIndex ? "border-primary bg-primary text-primary-fg" : "border-line bg-surface"}`}>{e.status === "done" ? "✓" : e.status === "skipped" ? "–" : i + 1}</button></li>
          ))}
        </ol>
      </header>

      <Card className="space-y-3">
        <div>
          <h2 className="text-2xl font-bold">{def.name}{ex.originalExerciseId && <span className="ml-2 align-middle text-sm font-normal text-muted">(swapped from {mustExercise(ex.originalExerciseId).name})</span>}</h2>
          <p className="text-muted">{def.muscles.join(" · ")}{def.perSide && " · each side"}</p>
        </div>
        <ExerciseMedia exercise={def} compact />
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-surface2 p-2"><dt className="text-xs font-semibold text-muted">Set</dt><dd className="text-lg font-bold">{Math.min(done.length + 1, Math.max(ex.targetSets, done.length + 1))} of {Math.max(ex.targetSets, done.length)}</dd></div>
          <div className="rounded-xl bg-surface2 p-2"><dt className="text-xs font-semibold text-muted">{timed ? "Seconds" : "Reps"}</dt><dd className="text-lg font-bold">{ex.repMin}–{ex.repMax}</dd></div>
          {usesWeight ? <div className="rounded-xl bg-surface2 p-2"><dt className="text-xs font-semibold text-muted">Suggested</dt><dd className="text-lg font-bold">{ex.targetWeight != null ? formatKg(ex.targetWeight) : "Find yours"}</dd></div>
            : <div className="rounded-xl bg-surface2 p-2"><dt className="text-xs font-semibold text-muted">Weight</dt><dd className="text-lg font-bold">{def.loadType === "band" ? "Band" : "Body"}</dd></div>}
        </dl>
        <p className="text-sm text-muted">{last ? `Last time (${formatDateAU(last.date)}): ${last.weight != null ? formatKg(last.weight) + " × " : ""}${last.reps.join(", ")}` : usesWeight ? "First time: start light. Choose a weight you could lift about 10 times with at least 3 left in reserve." : "First time with this exercise – take it gently."}</p>
        {advice && <Notice>{advice}</Notice>}
      </Card>

      {exSets.length > 0 && (
        <Card className="space-y-2">
          <h3 className="font-bold">Sets logged</h3>
          <ul className="flex flex-wrap gap-2">
            {exSets.map((s) => (
              <li key={s.id}><button className="min-h-11 rounded-full border-2 border-line bg-surface2 px-4 font-semibold" onClick={() => { setEditing(s); setDialog("edit"); }} aria-label={`Set ${s.setIndex + 1}: ${s.weight != null ? formatKg(s.weight) + ", " : ""}${s.reps} ${timed ? "seconds" : "reps"}. Edit`}>
                <Check size={14} aria-hidden className="mr-1 inline" />{s.weight != null ? `${formatKg(s.weight)} × ` : ""}{s.reps}{timed ? "s" : ""}</button></li>
            ))}
          </ul>
        </Card>
      )}

      {resting && (
        <Card className="space-y-3 bg-lavender text-lavenderfg" role="timer" aria-label="Rest timer">
          <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 font-bold"><Timer aria-hidden size={20} /> Rest</h3><p className="text-4xl font-extrabold tabular-nums" aria-hidden>{fmt(restRemaining)}</p></div>
          <p className="sr-only" aria-live="polite">{restRemaining === 0 ? "Rest finished. Ready for your next set." : restPaused ? "Rest paused" : ""}</p>
          {restRemaining === 0 ? <p className="font-semibold">Rest finished – ready when you are.</p> : <p>{restPaused ? "Paused" : "Breathe, sip some water and shake out your arms."}</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="border-lavenderfg text-lavenderfg" onClick={() => run((d, c) => (restPaused ? A.restResume(d, c, sid) : A.restPause(d, c, sid)))}>{restPaused ? <><Play size={16} aria-hidden /> Resume rest</> : <><Pause size={16} aria-hidden /> Pause rest</>}</Button>
            <Button variant="outline" size="sm" className="border-lavenderfg text-lavenderfg" onClick={() => run((d, c) => A.restAdjust(d, c, sid, 15))}><Plus size={16} aria-hidden /> 15 sec</Button>
            <Button variant="outline" size="sm" className="border-lavenderfg text-lavenderfg" onClick={() => run((d, c) => A.restSkip(d, c, sid))}><SkipForward size={16} aria-hidden /> Skip rest</Button>
          </div>
        </Card>
      )}

      {exSets.length > 0 && (
        <details className="rounded-card border border-line bg-surface p-4" open={done.length === 1 && firstTime}>
          <summary className="min-h-11 cursor-pointer font-semibold">How did that feel? (optional)</summary>
          <div className="mt-3 space-y-4">
            <ChoiceGroup legend="Effort for your last set" value={prevSet?.effort} onChange={(v: Effort) => patchLastSet({ effort: v })} columns={2}
              options={[{ value: "easy", label: "Easy" }, { value: "comfortable", label: "Comfortable" }, { value: "challenging", label: "Challenging" }, { value: "very_hard", label: "Very hard" }]} />
            <ChoiceGroup legend="Any discomfort?" value={prevSet?.discomfort ?? ex.discomfort} onChange={(v: SetDiscomfort) => { patchLastSet({ discomfort: v }); run((d, c) => A.setExerciseFeedback(d, c, sid, { discomfort: v })); }} columns={2}
              options={[{ value: "none", label: "None" }, { value: "mild", label: "A little" }, { value: "concerning", label: "Concerning" }]} />
            {(prevSet?.discomfort === "concerning" || ex.discomfort === "concerning") && <Notice tone="warn" title="Please stop this exercise">Stop here and rest. If the discomfort continues, check in with a doctor or physiotherapist. You can skip or swap this exercise.</Notice>}
            <label className="flex min-h-12 items-center gap-3 font-semibold"><input type="checkbox" className="size-6" checked={!!ex.tooHeavy} onChange={(e) => run((d, c) => A.setExerciseFeedback(d, c, sid, { tooHeavy: e.target.checked }))} /> That weight felt too heavy</label>
            <Field label="Note for this exercise" htmlFor="exnote"><Textarea id="exnote" defaultValue={ex.note ?? ""} maxLength={500} onBlur={(e) => run((d, c) => A.setExerciseFeedback(d, c, sid, { note: e.target.value }))} /></Field>
          </div>
        </details>
      )}

      {exerciseDone && (
        <Card className="space-y-3 border-2 border-primary">
          <h3 className="flex items-center gap-2 text-lg font-bold"><Check aria-hidden /> {def.name} complete</h3>
          <ChoiceGroup legend="How confident did your technique feel? (optional)" value={ex.technique} onChange={(v: Technique) => run((d, c) => A.setExerciseFeedback(d, c, sid, { technique: v }))} columns={2}
            options={[{ value: "unsure", label: "Still learning" }, { value: "ok", label: "Okay" }, { value: "confident", label: "Confident" }]} />
          {session.exercises.some((e, i) => i !== session.currentIndex && e.status === "pending")
            ? <Button size="lg" onClick={() => run((d, c) => A.nextExercise(d, c, sid))}>Next exercise <ArrowRight aria-hidden /></Button>
            : <Button size="lg" onClick={() => { run((d, c) => A.endSession(d, c, sid, "finished")); onFinished(sid); }}>Finish workout <Check aria-hidden /></Button>}
        </Card>
      )}

      {/* Inputs + the big buttons */}
      {fresh || exerciseDone ? (
        <Card className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {usesWeight && (
              <div><p id="wl" className="mb-1 text-center font-semibold">Weight (kg)</p>
                <div className="flex items-center gap-2"><Button variant="outline" size="lg" className="px-0 w-14" aria-label="Lighter weight" onClick={() => stepWeight(-1)}><Minus aria-hidden /></Button>
                  <Input aria-labelledby="wl" inputMode="decimal" className="text-center text-2xl font-bold" value={weight ?? ""} placeholder="–" onChange={(e) => { const v = e.target.value; setWeight(v === "" ? null : Math.max(0, Number(v) || 0)); }} />
                  <Button variant="outline" size="lg" className="px-0 w-14" aria-label="Heavier weight" onClick={() => stepWeight(1)}><Plus aria-hidden /></Button></div></div>
            )}
            <div className={usesWeight ? "" : "col-span-2"}><p id="rl" className="mb-1 text-center font-semibold">{timed ? "Seconds" : "Repetitions"}</p>
              <div className="flex items-center gap-2"><Button variant="outline" size="lg" className="px-0 w-14" aria-label={timed ? "Fewer seconds" : "Fewer repetitions"} onClick={() => setReps((r) => Math.max(0, r - 1))}><Minus aria-hidden /></Button>
                <Input aria-labelledby="rl" inputMode="numeric" className="text-center text-2xl font-bold" value={reps} onChange={(e) => setReps(Math.max(0, Math.floor(Number(e.target.value) || 0)))} />
                <Button variant="outline" size="lg" className="px-0 w-14" aria-label={timed ? "More seconds" : "More repetitions"} onClick={() => setReps((r) => r + 1)}><Plus aria-hidden /></Button></div></div>
          </div>
          {!exerciseDone && (
            <>
              {inSet ? <p role="status" className="text-center font-semibold text-muted">Set in progress · {fmt(setElapsed)}</p> : null}
              {!inSet && <Button size="lg" variant="soft" className="w-full" onClick={() => run((d, c) => A.startSet(d, c, sid))}><Play aria-hidden /> START SET</Button>}
              <Button size="xl" onClick={complete}><Check size={28} aria-hidden /> COMPLETE SET</Button>
            </>
          )}
        </Card>
      ) : (
        <Card className="space-y-3"><p className="text-center font-semibold text-muted">Resting – when you&apos;re ready, log your next set.</p>
          <Button size="xl" onClick={() => run((d, c) => A.restSkip(d, c, sid))}>I&apos;m ready</Button></Card>
      )}

      <Instructions exercise={def} />
      {firstTime && done.length === 0 && <p className="-mt-2 text-center text-sm text-muted">New exercise? Open &ldquo;How to do it&rdquo; above for the steps.</p>}

      <div className="grid grid-cols-2 gap-2 pb-6">
        <Button variant="outline" onClick={() => run((d, c) => A.addExtraSet(d, c, sid))}><Repeat size={18} aria-hidden /> REPEAT SET</Button>
        <Button variant="outline" onClick={() => setDialog("skip")}><SkipForward size={18} aria-hidden /> SKIP EXERCISE</Button>
        <Button variant="outline" className="col-span-2" onClick={() => { setSwapTo(undefined); setDialog("swap"); }} disabled={exSets.length > 0}><Shuffle size={18} aria-hidden /> SUBSTITUTE EXERCISE</Button>
        {exSets.length > 0 && <p className="col-span-2 text-center text-sm text-muted">Swapping is available before you log a set, so your record stays accurate.</p>}
      </div>

      {endDialog}
      <Dialog open={dialog === "skip"} onClose={() => setDialog(null)} title="Skip this exercise?"
        actions={<><Button variant="outline" onClick={() => setDialog(null)}>Keep it</Button><Button onClick={() => { run((d, c) => A.skipExercise(d, c, sid)); setDialog(null); }}>Skip exercise</Button></>}>
        <p>That&apos;s completely fine. Any sets you&apos;ve already logged are kept.</p>
      </Dialog>
      <Dialog open={dialog === "swap"} onClose={() => setDialog(null)} title="Choose a different exercise"
        actions={<><Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button><Button disabled={!swapTo} onClick={() => { const r = run((d, c) => A.substituteExercise(d, c, sid, swapTo!)); if (!r.ok) toast(r.error ?? "Couldn't swap."); setDialog(null); }}>Use this exercise</Button></>}>
        {(() => {
          const subs = A.substitutesFor(data, ex.slot, ex.originalExerciseId ?? ex.exerciseId);
          if (!subs.length) return <p>There&apos;s no other exercise for this movement with the equipment you listed. You can add equipment in Settings.</p>;
          return <ChoiceGroup legend="Options that suit your equipment and comfort" value={swapTo} onChange={setSwapTo} options={subs.map((s) => ({ value: s.id, label: s.name, description: s.difficulty < def.difficulty ? "Gentler" : s.difficulty > def.difficulty ? "More challenging" : "Similar" }))} />;
        })()}
      </Dialog>
      <Dialog open={dialog === "edit" && !!editing} onClose={() => { setDialog(null); setEditing(null); setConfirmDelete(false); }} title={editing ? `Edit set ${editing.setIndex + 1}` : "Edit set"}
        actions={editing && (confirmDelete
          ? <><Button variant="outline" onClick={() => setConfirmDelete(false)}>Keep this set</Button><Button variant="danger" onClick={() => { run((d, c) => A.deleteSet(d, c, editing.id)); setDialog(null); setEditing(null); setConfirmDelete(false); }}>Yes, delete set</Button></>
          : <><Button variant="dangerOutline" onClick={() => setConfirmDelete(true)}>Delete set</Button><Button onClick={() => { setDialog(null); setEditing(null); }}>Done</Button></>)}>
        {editing && (confirmDelete ? <p>Delete this logged set? This removes it from your history.</p> : (
          <div className="space-y-3">
            {usesWeight && <Field label="Weight (kg)" htmlFor="ew"><Input id="ew" inputMode="decimal" defaultValue={editing.weight ?? ""} onChange={(e) => { const v = e.target.value === "" ? null : Number(e.target.value); if (v === null || !Number.isNaN(v)) { run((d, c) => A.editSet(d, c, editing.id, { weight: v })); } }} /></Field>}
            <Field label={timed ? "Seconds" : "Repetitions"} htmlFor="er"><Input id="er" inputMode="numeric" defaultValue={editing.reps ?? ""} onChange={(e) => { const v = Math.max(0, Math.floor(Number(e.target.value) || 0)); run((d, c) => A.editSet(d, c, editing.id, { reps: v })); }} /></Field>
          </div>
        ))}
      </Dialog>
    </div>
  );
}
