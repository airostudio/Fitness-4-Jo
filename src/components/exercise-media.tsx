import { Dumbbell, ImageOff } from "lucide-react";
import type { Exercise } from "@/lib/domain/types";

/** Shows approved, licensed media only. When none exists we say so plainly instead of faking a demonstration. */
export function ExerciseMedia({ exercise, compact = false }: { exercise: Exercise; compact?: boolean }) {
  const m = exercise.media;
  if (m.approved && m.url && m.kind === "video") {
    return <figure><video controls playsInline preload="metadata" className="w-full rounded-2xl bg-black" src={m.url} aria-label={`Demonstration of ${exercise.name}`} /><figcaption className="mt-1 text-xs text-muted">{m.licence}</figcaption></figure>;
  }
  if (m.approved && m.url && (m.kind === "image" || m.kind === "animation")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <figure><img src={m.url} alt={`Demonstration of ${exercise.name}`} className="w-full rounded-2xl" /><figcaption className="mt-1 text-xs text-muted">{m.licence}</figcaption></figure>;
  }
  return (
    <div role="img" aria-label={`No demonstration video available yet for ${exercise.name}. Follow the written steps.`}
      className={`flex items-center gap-3 rounded-2xl border-2 border-dashed border-line bg-surface2 text-muted ${compact ? "p-3" : "p-6"}`}>
      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-soft text-softfg">{compact ? <Dumbbell size={20} /> : <ImageOff size={20} />}</span>
      <p className="text-sm"><strong className="text-fg">Demonstration video not available yet.</strong> Follow the step-by-step instructions below.</p>
    </div>
  );
}

export function Instructions({ exercise, open }: { exercise: Exercise; open?: boolean }) {
  return (
    <details open={open} className="rounded-2xl border border-line bg-surface2 p-4">
      <summary className="min-h-11 cursor-pointer font-semibold">How to do it</summary>
      <div className="mt-3 space-y-3 text-[0.95rem]">
        <p><strong>Starting position: </strong>{exercise.startingPosition}</p>
        <ol className="list-decimal space-y-1 pl-6">{exercise.steps.map((s) => <li key={s}>{s}</li>)}</ol>
        <p><strong>Breathing: </strong>{exercise.breathing}</p>
        <div><strong>Common mistakes</strong><ul className="list-disc pl-6">{exercise.commonMistakes.map((s) => <li key={s}>{s}</li>)}</ul></div>
        <div><strong>Safety</strong><ul className="list-disc pl-6">{exercise.safetyNotes.map((s) => <li key={s}>{s}</li>)}</ul></div>
      </div>
    </details>
  );
}
