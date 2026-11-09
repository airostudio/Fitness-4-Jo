"use client";
import { useState } from "react";
import { EQUIPMENT_LABELS } from "@/lib/domain/equipment";
import { isValidTimezone } from "@/lib/domain/dates";
import { profileSchema } from "@/lib/domain/schemas";
import type { EquipmentKey, GoalKey, Profile } from "@/lib/domain/types";
import { updateSingle } from "@/lib/store/actions";
import { useApp } from "@/lib/store/provider";
import { DAY_OPTIONS, GOALS, TIMEZONES, parseWeights } from "@/lib/options";
import { Button, Card, CheckGroup, ChoiceGroup, Field, Input, Notice, Select, Switch, Textarea } from "@/components/ui";

export function ProfileCard() {
  const { data, run, toast } = useApp();
  const p = data.profile!;
  const [name, setName] = useState(p.name); const [dob, setDob] = useState(p.dateOfBirth ?? ""); const [h, setH] = useState(p.heightCm?.toString() ?? ""); const [w, setW] = useState(p.weightKg?.toString() ?? "");
  const [err, setErr] = useState<string | null>(null);
  const save = () => {
    const r = profileSchema.pick({ name: true, dateOfBirth: true, heightCm: true, weightKg: true }).safeParse({ name: name.trim(), ...(dob ? { dateOfBirth: dob } : {}), ...(h ? { heightCm: Number(h) } : {}), ...(w ? { weightKg: Number(w) } : {}) });
    if (!r.success) { setErr("Please check the details – name is required, height 80–250 cm, weight 20–300 kg."); return; }
    setErr(null);
    run((d, c) => updateSingle(d, c, "profile", { name: name.trim(), dateOfBirth: dob || undefined, heightCm: h ? Number(h) : undefined, weightKg: w ? Number(w) : undefined } as Partial<Profile>));
    toast("Profile saved.");
  };
  return (
    <Card className="space-y-4" id="profile"><h2 className="text-xl font-bold">About you</h2>
      <Field label="Preferred name" htmlFor="sn"><Input id="sn" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} /></Field>
      <Field label="Date of birth (optional)" htmlFor="sd"><Input id="sd" type="date" value={dob} onChange={(e) => setDob(e.target.value)} /></Field>
      <div className="grid gap-3 sm:grid-cols-2"><Field label="Height, cm (optional)" htmlFor="sh"><Input id="sh" inputMode="decimal" value={h} onChange={(e) => setH(e.target.value)} /></Field><Field label="Body weight, kg (optional)" htmlFor="sw"><Input id="sw" inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} /></Field></div>
      {err && <p role="alert" className="font-semibold text-danger">{err}</p>}
      <Button onClick={save}>Save profile</Button></Card>
  );
}

export function TrainingCard() {
  const { data, run, toast } = useApp();
  const p = data.preferences;
  const [days, setDays] = useState(p.trainingDays);
  return (
    <Card className="space-y-4" id="training"><h2 className="text-xl font-bold">Training</h2>
      <CheckGroup legend="Preferred training days" values={days} onToggle={(v) => setDays((d) => (d.includes(v) ? d.filter((x) => x !== v) : [...d, v].sort()))} options={DAY_OPTIONS} />
      <Button variant="soft" disabled={!days.length} onClick={() => { run((d, c) => updateSingle(d, c, "preferences", { trainingDays: days })); toast("Calendar rebuilt around your days."); }}>Save days</Button>
      <Field label="Preferred time" htmlFor="tt"><Input id="tt" type="time" value={p.trainingTime} onChange={(e) => run((d, c) => updateSingle(d, c, "preferences", { trainingTime: e.target.value }))} /></Field>
      <Field label="Days available per week" htmlFor="dpw"><Select id="dpw" value={p.daysPerWeek} onChange={(e) => run((d, c) => updateSingle(d, c, "preferences", { daysPerWeek: Number(e.target.value) }))}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</Select></Field>
      <Field label="Time available per session" htmlFor="sm"><Select id="sm" value={p.sessionMinutes} onChange={(e) => run((d, c) => updateSingle(d, c, "preferences", { sessionMinutes: Number(e.target.value) }))}>{[20, 30, 45, 60, 90].map((n) => <option key={n} value={n}>{n} minutes</option>)}</Select></Field>
      <Field label="Default rest between sets" htmlFor="rs"><Select id="rs" value={p.restSeconds} onChange={(e) => run((d, c) => updateSingle(d, c, "preferences", { restSeconds: Number(e.target.value) }))}>{[30, 45, 60, 90, 120, 180].map((n) => <option key={n} value={n}>{n} seconds</option>)}</Select></Field>
      <Field label="Timezone" htmlFor="tz"><Select id="tz" value={p.timezone} onChange={(e) => isValidTimezone(e.target.value) && run((d, c) => updateSingle(d, c, "preferences", { timezone: e.target.value }))}>{[...new Set([p.timezone, ...TIMEZONES])].map((z) => <option key={z}>{z}</option>)}</Select></Field>
    </Card>
  );
}

export function EquipmentCard() {
  const { data, run, toast } = useApp();
  const e = data.equipment;
  const [items, setItems] = useState<EquipmentKey[]>(e.items);
  const [wt, setWt] = useState(e.dumbbellWeightsKg.join(", "));
  const dumbbells = items.includes("light_dumbbells") || items.includes("adjustable_dumbbells");
  const bad = dumbbells && wt.trim() && !parseWeights(wt).length;
  return (
    <Card className="space-y-4" id="equipment"><h2 className="text-xl font-bold">Equipment</h2>
      <CheckGroup legend="What you have" values={items} onToggle={(v) => setItems((x) => (x.includes(v) ? x.filter((y) => y !== v) : v === "none" ? ["none"] : [...x.filter((y) => y !== "none"), v]))} options={(Object.keys(EQUIPMENT_LABELS) as EquipmentKey[]).map((k) => ({ value: k, label: EQUIPMENT_LABELS[k] }))} />
      {dumbbells && <Field label="Dumbbell weights available (kg)" htmlFor="ew" hint="Separate with commas, e.g. 1, 2, 3, 4" error={bad ? "Enter weights in kg, e.g. 1, 2, 3." : undefined}><Input id="ew" inputMode="decimal" value={wt} onChange={(ev) => setWt(ev.target.value)} /></Field>}
      <Notice>Changing equipment updates which exercises can be in your plan. Your history is never deleted.</Notice>
      <Button disabled={!!bad} onClick={() => { run((d, c) => updateSingle(d, c, "equipment", { items: items.length ? items : ["none"], dumbbellWeightsKg: dumbbells ? parseWeights(wt) : [] })); toast("Equipment saved and your plan refreshed."); }}>Save equipment</Button></Card>
  );
}

export function HealthCard() {
  const { data, run, toast } = useApp();
  const [h, setH] = useState(data.health);
  const set = <K extends keyof typeof h>(k: K, v: (typeof h)[K]) => setH((x) => ({ ...x, [k]: v, answered: true }));
  return (
    <Card className="space-y-5" id="health"><h2 className="text-xl font-bold">Comfort & health</h2>
      <Notice tone="peach">Optional and private. We use this only to choose gentler exercises. It is not medical advice or a diagnosis.</Notice>
      <ChoiceGroup legend="General mobility" value={h.mobility} onChange={(v) => set("mobility", v)} options={[{ value: "good", label: "Moves freely" }, { value: "some", label: "A little stiff" }, { value: "limited", label: "Quite limited" }]} />
      <ChoiceGroup legend="Rising from a chair" value={h.chairRise} onChange={(v) => set("chairRise", v)} options={[{ value: "easy", label: "Easy" }, { value: "effort", label: "With some effort" }, { value: "difficult", label: "Difficult" }]} />
      <ChoiceGroup legend="Arms overhead" value={h.armsOverhead} onChange={(v) => set("armsOverhead", v)} options={[{ value: "full", label: "Fully" }, { value: "partial", label: "Partly" }, { value: "no", label: "Not comfortably" }]} />
      <ChoiceGroup legend="Balance" value={h.balance} onChange={(v) => set("balance", v)} options={[{ value: "confident", label: "Confident" }, { value: "somewhat", label: "Somewhat" }, { value: "not_confident", label: "Not confident" }]} />
      {(["back", "knee", "shoulder"] as const).map((a) => <ChoiceGroup key={a} legend={`${a[0]!.toUpperCase()}${a.slice(1)} discomfort`} value={h[`${a}Discomfort` as const]} onChange={(v) => set(`${a}Discomfort` as const, v)} options={[{ value: "none", label: "None" }, { value: "occasional", label: "Occasional" }, { value: "frequent", label: "Often" }]} />)}
      <Field label="Previous injuries" htmlFor="pi"><Textarea id="pi" value={h.previousInjuries} maxLength={500} onChange={(e) => set("previousInjuries", e.target.value)} /></Field>
      <Field label="Other relevant notes" htmlFor="pc"><Textarea id="pc" value={h.conditions} maxLength={500} onChange={(e) => set("conditions", e.target.value)} /></Field>
      <Switch label="I have professional exercise restrictions or advice" checked={h.hasProfessionalRestrictions} onChange={(v) => set("hasProfessionalRestrictions", v)} />
      <Button onClick={() => { run((d, c) => updateSingle(d, c, "health", { ...h, clearanceAcknowledged: h.hasProfessionalRestrictions === data.health.hasProfessionalRestrictions ? h.clearanceAcknowledged : false })); toast("Saved. Your plan has been checked against your answers."); }}>Save</Button></Card>
  );
}

export function GoalsCard() {
  const { data, run, toast } = useApp();
  const [g, setG] = useState<GoalKey[]>(data.goals.priorities); const [note, setNote] = useState(data.goals.personalNote);
  return (
    <Card className="space-y-4" id="goals"><h2 className="text-xl font-bold">Your goals</h2>
      <CheckGroup legend="What matters most" columns={1} values={g} onToggle={(v) => setG((x) => (x.includes(v) ? x.filter((y) => y !== v) : [...x, v]))} options={GOALS.map((x) => ({ ...x, label: `${g.includes(x.value) ? `${g.indexOf(x.value) + 1}. ` : ""}${x.label}` }))} />
      <Field label="Personal note" htmlFor="gn"><Textarea id="gn" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} /></Field>
      <Button onClick={() => { run((d, c) => updateSingle(d, c, "goals", { priorities: g, personalNote: note })); toast("Goals saved."); }}>Save goals</Button></Card>
  );
}

export function AppearanceCard() {
  const { data, run } = useApp();
  const p = data.preferences;
  const set = (patch: Partial<typeof p>) => run((d, c) => updateSingle(d, c, "preferences", patch));
  return (
    <Card className="space-y-4" id="appearance"><h2 className="text-xl font-bold">Appearance & accessibility</h2>
      <ChoiceGroup legend="Colour theme" value={p.theme} onChange={(v) => set({ theme: v })} options={[{ value: "system", label: "Match my device" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
      <ChoiceGroup legend="Text size" value={p.textScale} onChange={(v) => set({ textScale: v })} options={[{ value: 100, label: "Standard" }, { value: 115, label: "Large" }, { value: 130, label: "Extra large" }]} />
      <Switch label="High contrast" description="Stronger colours and borders." checked={p.highContrast} onChange={(v) => set({ highContrast: v })} />
      <ChoiceGroup legend="Animation" value={p.reducedMotion} onChange={(v) => set({ reducedMotion: v })} options={[{ value: "system", label: "Follow my device setting" }, { value: "on", label: "Reduce motion" }, { value: "off", label: "Allow motion" }]} />
      <Switch label="Vibrate when rest ends" checked={p.vibration} onChange={(v) => set({ vibration: v })} />
      <Switch label="Play a soft sound when rest ends" checked={p.sound} onChange={(v) => set({ sound: v })} />
      <Switch label="Allow progress photographs" description="Off by default and never required. Photos are stored privately and never shared automatically." checked={p.photosEnabled} onChange={(v) => set({ photosEnabled: v })} />
    </Card>
  );
}
