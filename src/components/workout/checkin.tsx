"use client";
import Link from "next/link";
import { useState } from "react";
import { assessReadiness, type ReadinessAnswers } from "@/lib/domain/readiness";
import type { ReadinessMode } from "@/lib/domain/types";
import { Button, Card, ChoiceGroup, Notice } from "@/components/ui";

/** Three brief questions. Never encourages training through new or significant pain. */
export function Checkin({ name, onStart, onRest, letter }: { name: string; letter: string; onStart: (a: ReadinessAnswers, mode: "normal" | "lighter") => void; onRest: (a: ReadinessAnswers, mode: ReadinessMode) => void }) {
  const [energy, setEnergy] = useState<ReadinessAnswers["energy"]>();
  const [muscles, setMuscles] = useState<ReadinessAnswers["muscles"]>();
  const [pain, setPain] = useState<ReadinessAnswers["pain"]>();
  const [choice, setChoice] = useState<ReadinessMode>();
  const complete = energy && muscles && pain;
  const advice = complete ? assessReadiness({ energy, muscles, pain }) : null;
  const picked = choice && advice?.options.some((o) => o.mode === choice) ? choice : advice?.recommended;

  return (
    <div className="space-y-5">
      <header><h1 className="text-3xl font-bold">Hi {name}, how are you today?</h1><p className="text-muted">Three quick questions before Workout {letter}. There are no wrong answers.</p></header>
      <Card className="space-y-6">
        <ChoiceGroup legend="How is your energy today?" value={energy} onChange={setEnergy} options={[{ value: "great", label: "Great" }, { value: "good", label: "Good" }, { value: "tired", label: "A little tired" }, { value: "very_tired", label: "Very tired" }]} columns={2} />
        <ChoiceGroup legend="How are your muscles feeling?" value={muscles} onChange={setMuscles} options={[{ value: "recovered", label: "Recovered" }, { value: "mild", label: "Mildly sore" }, { value: "quite_sore", label: "Quite sore" }]} />
        <ChoiceGroup legend="Any pain or discomfort today?" value={pain} onChange={setPain} options={[{ value: "none", label: "No" }, { value: "familiar", label: "Mild, familiar discomfort" }, { value: "new", label: "New or significant pain" }]} />
      </Card>
      {advice && (
        <Card className="space-y-4" aria-live="polite">
          <Notice tone={advice.seekGuidance ? "warn" : "soft"} title={advice.headline}>{advice.detail}</Notice>
          {advice.swapSuggestion && <p className="text-muted">Tip: you can swap any exercise for a gentler option during your workout.</p>}
          {advice.options.length > 1 && <ChoiceGroup legend="What would you like to do?" value={picked} onChange={setChoice} options={advice.options.map((o) => ({ value: o.mode, label: o.label, description: o.description }))} />}
          <div className="flex flex-col gap-3">
            {(picked === "normal" || picked === "lighter") && <Button size="lg" onClick={() => onStart({ energy, muscles, pain } as ReadinessAnswers, picked)}>{picked === "lighter" ? "Start a lighter session" : "Start workout"}</Button>}
            {picked && picked !== "normal" && picked !== "lighter" && (
              <Button size="lg" onClick={() => onRest({ energy, muscles, pain } as ReadinessAnswers, picked)}>Take a rest day</Button>
            )}
            <Link href="/" className="inline-flex min-h-12 items-center justify-center rounded-full border-2 border-inputline px-6 font-semibold">Not today – take me home</Link>
          </div>
        </Card>
      )}
      {!advice && <p className="text-center"><Link href="/" className="inline-flex min-h-12 items-center font-semibold underline">Not today – take me home</Link></p>}
    </div>
  );
}
