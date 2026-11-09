"use client";
import { Lightbulb } from "lucide-react";
import { decide } from "@/lib/store/actions";
import { useApp } from "@/lib/store/provider";
import { Button, Card } from "@/components/ui";
import type { ProgressionRecommendation } from "@/lib/domain/types";

const yes: Record<string, string> = {
  increase_weight: "Yes, I'd like to try it", add_set: "Yes, add a set", suggest_variation: "Yes, I'd like to explore it",
  decrease_weight: "Yes, use the lighter weight", return_gently: "Yes, ease me back in", next_band: "Yes, I'll try a firmer band",
};

/** A transparent, optional suggestion. Nothing changes unless Jo says yes. */
export function RecommendationCard({ rec, name }: { rec: ProgressionRecommendation; name?: string }) {
  const { run, toast } = useApp();
  void name;
  return (
    <Card className="space-y-3 border-2 border-accent">
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-full bg-soft text-softfg"><Lightbulb size={20} /></span>
        <div><h3 className="text-lg font-bold">{rec.title}</h3><p>{rec.message}</p></div>
      </div>
      <details className="text-sm text-muted">
        <summary className="min-h-11 cursor-pointer font-semibold text-fg">Why am I seeing this?</summary>
        <ul className="mt-1 list-disc pl-6">{rec.explanation.map((e) => <li key={e}>{e}</li>)}</ul>
        <p className="mt-1">This suggestion comes from fixed rules based on your logged sessions, not a guess. Rules version {rec.ruleVersion}.</p>
      </details>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {rec.proposed && <Button onClick={() => { run((d, c) => decide(d, c, rec.id, "accepted")); toast("Done – we'll use that next time."); }}>{yes[rec.action] ?? "Yes, please"}</Button>}
        {rec.alternatives.map((a, i) => (
          <Button key={a.label} variant="soft" onClick={() => { run((d, c) => decide(d, c, rec.id, "accepted", i)); toast("Done – we'll use that next time."); }}>{a.label}</Button>
        ))}
        <Button variant="outline" onClick={() => { run((d, c) => decide(d, c, rec.id, "declined")); toast("No problem – we'll keep things as they are."); }}>No thanks, keep it as it is</Button>
        <Button variant="ghost" onClick={() => run((d, c) => decide(d, c, rec.id, "deferred"))}>Ask me later</Button>
      </div>
    </Card>
  );
}
