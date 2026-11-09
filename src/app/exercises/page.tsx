"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { EXERCISES, CATEGORY_LABELS } from "@/lib/domain/exercises";
import { canDo } from "@/lib/domain/equipment";
import { useApp } from "@/lib/store/provider";
import { Badge, Card, Input, PageHeader, Select } from "@/components/ui";
import type { ExerciseCategory } from "@/lib/domain/types";

export default function ExerciseLibrary() {
  const { data } = useApp();
  const [q, setQ] = useState(""); const [cat, setCat] = useState<ExerciseCategory | "all">("all"); const [mine, setMine] = useState(false);
  const list = useMemo(() => EXERCISES.filter((e) => (cat === "all" || e.category === cat) && (!mine || canDo(e, data.equipment)) && (!q || e.name.toLowerCase().includes(q.toLowerCase()) || e.muscles.join(" ").toLowerCase().includes(q.toLowerCase()))), [q, cat, mine, data.equipment]);
  return (
    <div className="space-y-5">
      <PageHeader title="Exercise library" sub={`${EXERCISES.length} exercises with step-by-step guidance`} />
      <Card className="grid gap-3 sm:grid-cols-2">
        <div><label htmlFor="q" className="mb-1 block font-semibold">Search</label><Input id="q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. squat, glutes" /></div>
        <div><label htmlFor="cat" className="mb-1 block font-semibold">Type</label><Select id="cat" value={cat} onChange={(e) => setCat(e.target.value as ExerciseCategory | "all")}><option value="all">All exercises</option>{(Object.keys(CATEGORY_LABELS) as ExerciseCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}</Select></div>
        <label className="flex min-h-12 items-center gap-3 font-semibold sm:col-span-2"><input type="checkbox" className="size-6" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Only show exercises I have the equipment for</label>
      </Card>
      <p role="status" className="text-muted">{list.length} exercise{list.length === 1 ? "" : "s"}</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {list.map((e) => (
          <li key={e.id}><Link href={`/exercises/${e.id}`} className="block h-full rounded-card border border-line bg-surface p-4 shadow-card hover:bg-surface2">
            <p className="text-lg font-bold">{e.name}</p><p className="text-sm text-muted">{CATEGORY_LABELS[e.category]} · {e.muscles.join(", ")}</p>
            <div className="mt-2 flex flex-wrap gap-2"><Badge>{["Gentle", "Moderate", "Challenging"][e.difficulty - 1]}</Badge>{!canDo(e, data.equipment) && <Badge tone="warn">Needs equipment you haven&apos;t listed</Badge>}</div></Link></li>
        ))}
      </ul>
    </div>
  );
}
