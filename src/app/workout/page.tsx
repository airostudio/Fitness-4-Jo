"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Player } from "@/components/workout/player";
import { Checkin } from "@/components/workout/checkin";
import { Summary } from "@/components/workout/summary";
import { Button, Card, Notice, Spinner, buttonClass } from "@/components/ui";
import * as A from "@/lib/store/actions";
import { activeSession } from "@/lib/store/selectors";
import { useApp } from "@/lib/store/provider";
import type { WorkoutLetter } from "@/lib/domain/types";

function WorkoutFlow() {
  const { data, run, today, toast } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const [summaryId, setSummaryId] = useState<string | null>(null);
  const active = activeSession(data);
  const p = data.program;
  if (!p) return <Card>Let&apos;s set up your programme first. <Link className="font-semibold underline" href="/onboarding">Start here</Link></Card>;

  if (summaryId) return <Summary sessionId={summaryId} />;
  if (active) return <Player session={active} onFinished={(id) => (id ? setSummaryId(id) : router.replace("/"))} />;

  // Safety gate: a plan that needs professional guidance is locked until Jo confirms she has it.
  if (p.screening.status === "clearance_recommended" && !data.health.clearanceAcknowledged) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Before we start</h1>
        <Notice tone="warn" title="Please check with a health professional first"><ul className="list-disc pl-5">{p.screening.reasons.map((r) => <li key={r}>{r}</li>)}</ul></Notice>
        <Card className="space-y-3"><p>If you already have advice from your doctor or physiotherapist and they are happy for you to begin, you can confirm below.</p>
          <Button size="lg" onClick={() => { run((d, c) => A.acknowledgeClearance(d, c)); toast("Thank you. You can start whenever you're ready."); }}>I have professional guidance to proceed</Button>
          <Link href="/" className={buttonClass({ variant: "outline", size: "lg" })}>Not yet – back home</Link></Card>
      </div>
    );
  }

  const planned = data.scheduled.find((s) => s.date === today && s.status === "planned");
  const next = [...data.scheduled].filter((s) => s.status === "planned" && s.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
  const askedLetter = params.get("letter");
  const letter = (askedLetter === "A" || askedLetter === "B" ? askedLetter : (planned ?? next)?.letter ?? "A") as WorkoutLetter;
  const scheduledId = (planned && planned.letter === letter ? planned : data.scheduled.find((s) => s.status === "planned" && s.letter === letter && s.date >= today))?.id;

  return (
    <Checkin name={data.profile?.name ?? "Jo"} letter={letter}
      onStart={(answers, mode) => {
        const chk = run((d, c) => A.saveCheckin(d, c, answers, mode));
        const r = run((d, c) => A.startSession(d, c, { letter, mode, scheduledId, checkinId: chk.id }));
        if (!r.ok) toast(r.error ?? "Couldn't start the workout.");
      }}
      onRest={(answers, mode) => { run((d, c) => A.saveCheckin(d, c, answers, mode)); toast("Rest well. Your plan will wait for you."); router.push("/workouts"); }} />
  );
}

export default function WorkoutPage() {
  return <Suspense fallback={<Spinner />}><WorkoutFlow /></Suspense>;
}
