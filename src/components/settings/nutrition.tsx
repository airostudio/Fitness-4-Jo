"use client";
import Link from "next/link";
import { updateNutrition } from "@/lib/store/actions";
import { useApp } from "@/lib/store/provider";
import { Card, Switch, buttonClass } from "@/components/ui";

export function NutritionSettings() {
  const { data, run } = useApp();
  return (
    <Card className="space-y-3" id="nutrition"><h2 className="text-xl font-bold">Nutrition support</h2>
      <p className="text-muted">Optional food ideas and a gentle food-group guide. No calorie counting. Private to you – never shared with a supporter.</p>
      <Switch label="Show nutrition support" checked={data.nutrition.enabled} onChange={(v) => run((d, c) => updateNutrition(d, c, { enabled: v }))} />
      <Link href="/nutrition" className={buttonClass({ variant: "soft" })}>Open nutrition</Link></Card>
  );
}
