"use client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CATEGORY_LABELS, getExercise } from "@/lib/domain/exercises";
import { canDo } from "@/lib/domain/equipment";
import { lastPerformance } from "@/lib/store/selectors";
import { formatDateAU } from "@/lib/domain/dates";
import { useApp } from "@/lib/store/provider";
import { Badge, Card, Notice } from "@/components/ui";
import { CategoryArt } from "@/components/art";
import { ExerciseMedia } from "@/components/exercise-media";

export function ExerciseDetail({ id }: { id: string }) {
  const { data } = useApp();
  const e = getExercise(id);
  if (!e) return <Card>We couldn&apos;t find that exercise. <Link className="font-semibold underline" href="/exercises">Back to the library</Link></Card>;
  const have = canDo(e, data.equipment);
  const last = lastPerformance(data, e.id);
  const list = (ids: string[]) => ids.map(getExercise).filter(Boolean);
  const unit = e.loadType === "timed" ? "seconds" : "reps";
  return (
    <article className="space-y-5">
      <Link href="/exercises" className="inline-flex min-h-11 items-center gap-1 font-semibold underline"><ArrowLeft size={18} aria-hidden /> Exercise library</Link>
      <header className="flex items-center gap-4"><CategoryArt category={e.category} size={88} /><div><h1 className="text-3xl font-bold">{e.name}</h1><p className="text-muted">{CATEGORY_LABELS[e.category]} · {e.muscles.join(", ")}</p>
        <div className="mt-2 flex flex-wrap gap-2"><Badge>{["Gentle", "Moderate", "Challenging"][e.difficulty - 1]}</Badge>{e.perSide && <Badge tone="lavender">Do each side</Badge>}
          {have ? <Badge>You have the equipment</Badge> : <Badge tone="warn">Needs equipment you haven&apos;t listed</Badge>}</div></div></header>
      <ExerciseMedia exercise={e} />
      <p className="text-lg">{e.description}</p>
      {!have && <Notice tone="warn">This needs: {e.requires.join(", ")}. It won&apos;t be added to your plan unless you add that equipment in Settings.</Notice>}
      {e.cautions.length > 0 && <Notice tone="peach" title="Take extra care if you have">Discomfort in your {e.cautions.join(", ")}. Choose a gentler alternative, or check with a health professional.</Notice>}
      <Card className="space-y-3"><h2 className="text-xl font-bold">How to do it</h2>
        <p><strong>Starting position: </strong>{e.startingPosition}</p>
        <ol className="list-decimal space-y-1 pl-6">{e.steps.map((s) => <li key={s}>{s}</li>)}</ol>
        <p><strong>Breathing: </strong>{e.breathing}</p></Card>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card><h2 className="text-lg font-bold">Common mistakes</h2><ul className="mt-1 list-disc pl-6">{e.commonMistakes.map((s) => <li key={s}>{s}</li>)}</ul></Card>
        <Card><h2 className="text-lg font-bold">Safety notes</h2><ul className="mt-1 list-disc pl-6">{e.safetyNotes.map((s) => <li key={s}>{s}</li>)}</ul></Card>
      </div>
      <Card><h2 className="text-lg font-bold">Suggested</h2><p className="text-muted">{e.sets} sets of {e.repRange[0]}–{e.repRange[1]} {unit}{e.perSide ? " each side" : ""}, resting about {e.restSeconds} seconds.</p>
        {last && <p className="mt-1">Last time ({formatDateAU(last.date)}): {last.weight != null ? `${last.weight} kg × ` : ""}{last.reps.join(", ")}</p>}</Card>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card><h2 className="text-lg font-bold">Easier options</h2>{list(e.regressions).length ? <ul className="mt-1 space-y-1">{list(e.regressions).map((x) => <li key={x!.id}><Link className="font-semibold underline" href={`/exercises/${x!.id}`}>{x!.name}</Link></li>)}</ul> : <p className="text-muted">This is already one of the gentlest options.</p>}</Card>
        <Card><h2 className="text-lg font-bold">More challenging options</h2>{list(e.progressions).length ? <ul className="mt-1 space-y-1">{list(e.progressions).map((x) => <li key={x!.id}><Link className="font-semibold underline" href={`/exercises/${x!.id}`}>{x!.name}</Link></li>)}</ul> : <p className="text-muted">Build quality and weight here first.</p>}</Card>
      </div>
    </article>
  );
}
