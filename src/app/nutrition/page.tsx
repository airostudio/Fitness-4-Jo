"use client";
import { Droplets, Minus, Plus, Salad } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { addDays, formatDateAU } from "@/lib/domain/dates";
import * as N from "@/lib/domain/nutrition";
import { adjustServes, clearNutrition, logFor, updateNutrition } from "@/lib/store/actions";
import { finishedSessions } from "@/lib/store/selectors";
import { useApp } from "@/lib/store/provider";
import { AccessibleChart } from "@/components/chart";
import { HeroArt, Ring } from "@/components/art";
import { Plate, GROUP_ICON } from "@/components/nutrition/plate";
import { Badge, Button, Card, CheckGroup, ChoiceGroup, Dialog, Field, Input, Notice, ProgressBar, Switch, Textarea } from "@/components/ui";
import { WEEKDAY_SHORT, isoWeekday } from "@/lib/domain/dates";

const TYPES: { value: N.MealType; label: string }[] = [{ value: "breakfast", label: "Breakfast" }, { value: "lunch", label: "Lunch" }, { value: "dinner", label: "Dinner" }, { value: "snack", label: "Snacks" }];

export default function NutritionPage() {
  const { data, run, today, toast } = useApp();
  const n = data.nutrition, name = data.profile?.name ?? "Jo";
  const [type, setType] = useState<N.MealType>("breakfast");
  const [shuffle, setShuffle] = useState(0);
  const [wipe, setWipe] = useState(false);
  const safety = N.nutritionSafety({ conditionsText: `${data.health.conditions} ${data.health.previousInjuries}`, hasRestrictions: data.health.hasProfessionalRestrictions, clearanceRecommended: data.program?.screening.status === "clearance_recommended" });
  const trainingDay = data.scheduled.some((s) => s.date === today && s.status !== "skipped");
  const trainedToday = finishedSessions(data).some((s) => s.date === today);
  const goals = N.dailyGoals(trainingDay);
  const log = logFor(data, today);
  const score = N.varietyScore(log, goals);
  const guide = N.proteinGuide({ weightKg: data.profile?.weightKg, dateOfBirth: data.profile?.dateOfBirth, today, conditionsText: data.health.conditions, injuriesText: data.health.previousInjuries, hasRestrictions: data.health.hasProfessionalRestrictions, showGuide: n.showProteinGuide });
  const set = (patch: Partial<Omit<N.NutritionPrefs, "updatedAt">>) => run((d, c) => updateNutrition(d, c, patch));
  const ideas = N.suggestMeals(n, type, `${today}:${shuffle}`, 3);
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map((d) => ({ label: WEEKDAY_SHORT[isoWeekday(d) - 1]!, Variety: N.varietyScore(logFor(data, d), N.dailyGoals(false)) }));
  const post = N.postWorkoutIdeas(n, today);

  const Disclaimer = (
    <div className="space-y-1 text-sm text-muted"><p>{N.GENERAL_DISCLAIMER}</p><p>{N.SUPPORT_LINE}</p></div>
  );

  if (!n.enabled) {
    return (
      <div className="space-y-5">
        <section className="hero relative"><HeroArt /><div className="hero-body p-6 pb-24">
          <p className="text-sm font-semibold opacity-90">Optional</p><h1 className="text-3xl font-extrabold">Fuel your strength</h1>
          <p className="mt-2 max-w-sm opacity-95">Gentle, practical food ideas to support your training and your health – no calorie counting, no weighing, no rules.</p>
        </div></section>
        <Card className="space-y-3">
          <h2 className="text-xl font-bold">What you&apos;d get</h2>
          <ul className="list-disc space-y-1 pl-6"><li>A simple daily guide to the five food groups (Australian Guide to Healthy Eating)</li><li>Meal and snack ideas that respect your eating style and any foods you avoid</li><li>Tips for fuelling and recovering around your workouts</li><li>Tap-to-log serves – skip it any day you like</li></ul>
          <p className="text-muted">It&apos;s switched off by default, and you can turn it off and delete everything at any time.</p>
          {safety.message && <Notice tone="warn" title="Before you start">{safety.message}</Notice>}
          <div className="flex flex-col gap-2 sm:flex-row"><Button size="lg" onClick={() => set({ enabled: true })}>Turn on nutrition support</Button><Link href="/" className="inline-flex min-h-14 items-center justify-center rounded-full border-2 border-inputline px-7 text-lg font-semibold">Not for me</Link></div>
        </Card>
        {Disclaimer}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="hero relative" aria-labelledby="nh"><HeroArt /><div className="hero-body flex items-start justify-between gap-4 p-6 pb-24">
        <div className="max-w-[16rem]"><p className="text-sm font-semibold opacity-90">{trainingDay ? "Training day" : "Recovery day"} · {formatDateAU(today, "weekday")}</p>
          <h1 id="nh" className="mt-1 text-3xl font-extrabold">Fuel your strength</h1><p className="mt-2 opacity-95">{N.varietyMessage(score, name)}</p></div>
        <Ring value={score} max={100} size={104} stroke={11} label="Food variety today"><span className="text-2xl font-extrabold leading-none">{score}%</span><span className="text-[0.7rem] font-semibold uppercase tracking-wide opacity-80">variety</span></Ring>
      </div></section>

      {safety.message && <Notice tone="warn" title="Check with a professional">{safety.message}</Notice>}

      <section aria-labelledby="today" className="space-y-3"><h2 id="today" className="text-xl font-bold">Today&apos;s plate</h2>
        <p className="text-sm text-muted">Tap + each time you have a serve. It&apos;s a handy guide, not a test – there&apos;s no pass or fail.</p>
        {N.GROUPS.map((g) => {
          const have = log?.serves[g.key] ?? 0, goal = goals[g.key];
          return (
            <Card key={g.key} className="space-y-2 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3"><span aria-hidden className="flex size-11 items-center justify-center rounded-2xl bg-soft text-2xl">{GROUP_ICON[g.key]}</span>
                  <div><p className="font-bold">{g.label}</p><p className="text-sm text-muted">{have} of {goal} {g.unit}{g.key === "grains" && trainingDay ? " (a little extra today to fuel training)" : ""}</p></div></div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="px-0 w-11" aria-label={`Remove a serve of ${g.label}`} disabled={have === 0} onClick={() => run((d, c) => adjustServes(d, c, today, { group: g.key, delta: -1 }))}><Minus aria-hidden size={18} /></Button>
                  <Button size="sm" className="px-0 w-11" aria-label={`Add a serve of ${g.label}`} onClick={() => run((d, c) => adjustServes(d, c, today, { group: g.key, delta: 1 }))}><Plus aria-hidden size={18} /></Button>
                </div>
              </div>
              <ProgressBar value={have} max={goal} label={`${g.label} serves today`} tone="accent" />
              <details className="text-sm text-muted"><summary className="min-h-11 cursor-pointer font-semibold text-fg">What counts as a serve?</summary><p className="mt-1">{g.example}</p></details>
            </Card>
          );
        })}
        <Card className="flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3"><span aria-hidden className="flex size-11 items-center justify-center rounded-2xl bg-soft text-softfg"><Droplets /></span><div><p className="font-bold">Water</p><p className="text-sm text-muted">{log?.waterCups ?? 0} cups · about {N.WATER_GOAL_CUPS} is a handy guide, and needs vary</p></div></div>
          <div className="flex items-center gap-2"><Button variant="outline" size="sm" className="px-0 w-11" aria-label="Remove a cup of water" disabled={!log?.waterCups} onClick={() => run((d, c) => adjustServes(d, c, today, { waterDelta: -1 }))}><Minus aria-hidden size={18} /></Button>
            <Button size="sm" className="px-0 w-11" aria-label="Add a cup of water" onClick={() => run((d, c) => adjustServes(d, c, today, { waterDelta: 1 }))}><Plus aria-hidden size={18} /></Button></div>
        </Card>
      </section>

      {(trainingDay || trainedToday) && (
        <section aria-labelledby="fuel"><Card className="space-y-2 bg-gradient-to-br from-peach to-surface"><h2 id="fuel" className="text-xl font-bold text-peachfg">Around your workout</h2>
          <ul className="list-disc space-y-1 pl-6 text-peachfg"><li><strong>Before:</strong> if you tend to feel flat, a small snack with carbohydrate (like a banana) 1–2 hours before can help. Training on an empty stomach is fine if that suits you.</li>
            <li><strong>After:</strong> a meal or snack with protein is a good habit. Your total protein across the day matters more than exact timing.</li><li>Sip water as you go.</li></ul>
          {post.length > 0 && <p className="text-peachfg">Ideas for after: {post.map((p) => p.name).join(" · ")}</p>}</Card></section>
      )}

      <section aria-labelledby="ideas" className="space-y-3"><h2 id="ideas" className="text-xl font-bold">Meal ideas for you</h2>
        <p className="text-sm text-muted">Chosen to suit {N.STYLE_LABELS[n.style].toLowerCase()}{n.avoid.length ? ` and without ${n.avoid.join(", ")}` : ""}. Always check ingredient labels – products vary.</p>
        <Card><ChoiceGroup legend="Show ideas for" value={type} onChange={(v) => { setType(v); setShuffle(0); }} options={TYPES} columns={2} /></Card>
        {ideas.length === 0 && <Notice>We couldn&apos;t find ideas that match your settings for this meal. Try loosening your keep-out list, or ask an Accredited Practising Dietitian for ideas.</Notice>}
        {ideas.map((m) => (
          <Card key={m.id} className="space-y-2">
            <div className="flex items-start justify-between gap-3"><h3 className="text-lg font-bold">{m.name}</h3><Badge tone="lavender">{m.prepMinutes} min</Badge></div>
            <p>{m.blurb}</p><p className="text-sm text-muted"><strong className="text-fg">Ingredients: </strong>{m.ingredients.join(", ")}</p>
            <p className="text-sm text-muted">{m.why}</p>
            <div className="flex flex-wrap gap-2 text-sm"><Badge>{m.proteinServes} protein serve{m.proteinServes === 1 ? "" : "s"}</Badge>{m.groups.map((g) => <Badge key={g} tone="peach">{N.GROUPS.find((x) => x.key === g)!.label}</Badge>)}
              {m.contains.length > 0 && <Badge tone="warn">Contains: {m.contains.join(", ")}</Badge>}</div>
          </Card>
        ))}
        {ideas.length > 0 && <Button variant="soft" onClick={() => setShuffle((s) => s + 1)}>Show me different ideas</Button>}
      </section>

      {guide.kind !== "none" && (
        <section aria-labelledby="prot"><Card className="space-y-2"><h2 id="prot" className="text-xl font-bold">Protein for muscle</h2>
          {guide.kind === "range" ? <><p className="text-3xl font-extrabold">about {guide.minG}–{guide.maxG} g a day</p><p>That&apos;s roughly {guide.perMealG[0]}–{guide.perMealG[1]} g at each main meal. A palm-sized portion of meat, fish or tofu, or 2 eggs, gives about 20–25 g.</p><p className="text-sm text-muted">{guide.basis}</p></>
            : <Notice tone="warn">{guide.reason}</Notice>}</Card></section>
      )}

      <section aria-labelledby="week" className="space-y-3"><h2 id="week" className="text-xl font-bold">Your week</h2>
        <Card><AccessibleChart title="Food variety, last 7 days" kind="bar" xKey="label" data={week} series={[{ key: "Variety", label: "Variety" }]} unit="%" yMax={100} summary="Percentage of the daily food-group guide you logged each day. Days you didn't log are shown as zero and that's perfectly fine." /></Card></section>

      <section aria-labelledby="plate" className="space-y-3"><h2 id="plate" className="text-xl font-bold">A balanced plate</h2><Card><Plate /></Card></section>

      <section aria-labelledby="learn" className="space-y-2"><h2 id="learn" className="flex items-center gap-2 text-xl font-bold"><Salad aria-hidden /> Good to know</h2>
        {N.LEARN.map((l) => <details key={l.id} className="rounded-card border border-line bg-surface p-4"><summary className="min-h-11 cursor-pointer font-semibold">{l.title}</summary><p className="mt-2 text-muted">{l.body}</p></details>)}</section>

      <Card className="space-y-4" id="nprefs"><h2 className="text-xl font-bold">Your food preferences</h2>
        <ChoiceGroup legend="How do you eat?" value={n.style} onChange={(v) => set({ style: v })} options={(Object.keys(N.STYLE_LABELS) as N.EatingStyle[]).map((k) => ({ value: k, label: N.STYLE_LABELS[k] }))} />
        <CheckGroup legend="Keep these out of my suggestions" hint="For allergies or intolerances please also talk to your GP or an Accredited Practising Dietitian." values={n.avoid}
          onToggle={(v) => set({ avoid: n.avoid.includes(v) ? n.avoid.filter((x) => x !== v) : [...n.avoid, v] })} options={(Object.keys(N.ALLERGEN_LABELS) as N.Allergen[]).map((k) => ({ value: k, label: N.ALLERGEN_LABELS[k] }))} />
        <Field label="Anything else you avoid? (optional)" htmlFor="ao" hint="We can't filter this automatically, so check ideas yourself."><Input id="ao" value={n.avoidOther} maxLength={200} onChange={(e) => set({ avoidOther: e.target.value })} /></Field>
        <Switch label="Show a protein guide" description="Only shown if you've given your body weight and have no health notes that need professional advice." checked={n.showProteinGuide} onChange={(v) => set({ showProteinGuide: v })} />
        <Field label="Note for today (optional)" htmlFor="nn"><Textarea id="nn" defaultValue={log?.note ?? ""} maxLength={500} onBlur={(e) => run((d, c) => adjustServes(d, c, today, { note: e.target.value }))} /></Field>
        <Button variant="dangerOutline" onClick={() => setWipe(true)}>Turn off and delete my nutrition data</Button></Card>
      {Disclaimer}
      <Dialog open={wipe} onClose={() => setWipe(false)} title="Delete nutrition data?" actions={<><Button variant="outline" onClick={() => setWipe(false)}>Keep it</Button><Button variant="danger" onClick={() => { run((d, c) => clearNutrition(d, c)); setWipe(false); toast("Nutrition support is off and your food logs are deleted."); }}>Delete and turn off</Button></>}>
        <p>This permanently deletes every food log and switches nutrition support off. Your workouts are not affected.</p></Dialog>
    </div>
  );
}
