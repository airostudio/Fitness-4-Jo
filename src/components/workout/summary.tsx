"use client";
import Link from "next/link";
import { useState } from "react";
import { Confetti, HeroArt, Medal } from "@/components/art";
import { MILESTONE_DEFS } from "@/lib/domain/stats";
import { mustExercise } from "@/lib/domain/exercises";
import { encouragement } from "@/lib/domain/messages";
import { formatKg } from "@/lib/domain/equipment";
import * as A from "@/lib/store/actions";
import { openRecommendations, setsFor } from "@/lib/store/selectors";
import { useApp } from "@/lib/store/provider";
import { Button, Card, ChoiceGroup, Field, Notice, Textarea, buttonClass } from "@/components/ui";
import { RecommendationCard } from "@/components/recommendation-card";

export function Summary({ sessionId }: { sessionId: string }) {
  const { data, run } = useApp();
  const s = data.sessions.find((x) => x.id === sessionId);
  const [energy, setEnergy] = useState<number | undefined>(s?.reflection?.energy);
  const [confidence, setConfidence] = useState<number | undefined>(s?.reflection?.confidence);
  const [enjoyment, setEnjoyment] = useState<number | undefined>(s?.reflection?.enjoyment);
  const [saved, setSaved] = useState(false);
  if (!s) return <Card>That workout could not be found. <Link className="font-semibold underline" href="/">Back home</Link></Card>;
  const sets = setsFor(data, sessionId).filter((x) => x.completed);
  const recs = openRecommendations(data).filter((r) => r.sessionId === sessionId);
  const mins = Math.max(1, Math.round(((Date.parse(s.endedAt ?? s.startedAt) - Date.parse(s.startedAt)) - s.totalPausedMs) / 60000));
  const ms = data.milestones.filter((m) => Math.abs(Date.parse(m.achievedAt) - Date.parse(s.endedAt ?? s.startedAt)) < 5000);
  const rate = [1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }));

  return (
    <div className="space-y-5">
      <section className="hero relative space-y-2 p-8 pb-24 text-center"><HeroArt /><Confetti />
        <div className="hero-body space-y-2"><Medal size={72} className="mx-auto breathe" />
        <h1 className="text-3xl font-bold">{s.status === "completed" ? "Workout complete!" : "Nicely done!"}</h1>
        <p>{sets.length === 0 ? "No sets were logged – that's okay. Come back whenever you like." : `${data.profile?.name ?? "Jo"}, you logged ${sets.length} set${sets.length === 1 ? "" : "s"} in about ${mins} minute${mins === 1 ? "" : "s"}. ${encouragement(sessionId)}`}</p>
        {s.status === "ended_early" && sets.length > 0 && <p className="text-sm">You finished early, and everything you did is saved. That still counts.</p>}
      </div></section>
      {ms.map((m) => <Notice key={m.id} tone="peach" title={MILESTONE_DEFS[m.key]?.title ?? "Milestone"}>{MILESTONE_DEFS[m.key]?.message}</Notice>)}
      {sets.length > 0 && (
        <Card><h2 className="text-lg font-bold">Today at a glance</h2>
          <ul className="mt-2 divide-y divide-line">{[...new Set(sets.map((x) => x.exerciseId))].map((id) => {
            const xs = sets.filter((x) => x.exerciseId === id);
            return <li key={id} className="flex justify-between gap-3 py-2"><span className="font-semibold">{mustExercise(id).name}</span><span className="text-muted">{xs.map((x) => `${x.weight != null ? formatKg(x.weight) + " × " : ""}${x.reps}`).join(", ")}</span></li>;
          })}</ul></Card>
      )}
      {recs.map((r) => <RecommendationCard key={r.id} rec={r} />)}
      {sets.length > 0 && (
        <Card className="space-y-4"><h2 className="text-lg font-bold">How did it go? (optional)</h2>
          <ChoiceGroup legend="Energy (1 low – 5 high)" value={energy} onChange={setEnergy} options={rate} />
          <ChoiceGroup legend="Confidence (1 – 5)" value={confidence} onChange={setConfidence} options={rate} />
          <ChoiceGroup legend="Enjoyment (1 – 5)" value={enjoyment} onChange={setEnjoyment} options={rate} />
          <Field label="Anything to remember?" htmlFor="refl"><Textarea id="refl" defaultValue={s.reflection?.note ?? ""} maxLength={1000} onBlur={(e) => run((d, c) => A.saveReflection(d, c, sessionId, { note: e.target.value }))} /></Field>
          <Button variant="soft" onClick={() => { run((d, c) => A.saveReflection(d, c, sessionId, { energy: energy as 1, confidence: confidence as 1, enjoyment: enjoyment as 1 })); setSaved(true); }}>Save reflection</Button>
          {saved && <p role="status" className="font-semibold text-primary">Saved ✓</p>}</Card>
      )}
      <div className="flex flex-col gap-3 pb-8 sm:flex-row"><Link href="/" className={buttonClass({ size: "lg" }, "flex-1")}>Back to home</Link><Link href="/progress" className={buttonClass({ size: "lg", variant: "outline" }, "flex-1")}>See my progress</Link></div>
    </div>
  );
}
