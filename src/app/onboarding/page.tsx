"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EQUIPMENT_LABELS } from "@/lib/domain/equipment";
import { programOverview, generateProgram, screen } from "@/lib/domain/program";
import { WEEKDAY_NAMES, mondayOf, isValidTimezone } from "@/lib/domain/dates";
import { profileSchema } from "@/lib/domain/schemas";
import type { EquipmentKey, Experience, FitnessGoals, GoalKey, HealthConsiderations, Profile } from "@/lib/domain/types";
import { completeOnboarding } from "@/lib/store/actions";
import { useApp } from "@/lib/store/provider";
import { GOALS, DAY_OPTIONS, TIMEZONES, parseWeights } from "@/lib/options";
import { Button, Card, ChoiceGroup, CheckGroup, Field, Input, Notice, ProgressBar, Select, Textarea } from "@/components/ui";

const STEPS = ["About you", "Your experience", "Comfort & health", "Equipment", "Your goals", "Your programme"];
const defaultHealth = (): Omit<HealthConsiderations, "updatedAt"> => ({
  mobility: "good", chairRise: "easy", armsOverhead: "full", balance: "confident", backDiscomfort: "none", kneeDiscomfort: "none", shoulderDiscomfort: "none",
  previousInjuries: "", conditions: "", hasProfessionalRestrictions: false, clearanceAcknowledged: false, answered: false,
});

export default function Onboarding() {
  const { run, today, data, toast } = useApp();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [name, setName] = useState("Jo");
  const [dob, setDob] = useState(""); const [height, setHeight] = useState(""); const [weight, setWeight] = useState("");
  const [days, setDays] = useState<number[]>([1, 4]); const [time, setTime] = useState("09:00");
  const [daysPerWeek, setDaysPerWeek] = useState(3); const [minutes, setMinutes] = useState(45);
  const [tz, setTz] = useState(() => { try { const t = Intl.DateTimeFormat().resolvedOptions().timeZone; return isValidTimezone(t) ? t : "Australia/Melbourne"; } catch { return "Australia/Melbourne"; } });
  const [exp, setExp] = useState<Experience>("new"); const [activity, setActivity] = useState<Profile["activityLevel"]>("light"); const [conf, setConf] = useState<Profile["movementConfidence"]>(3);
  const [health, setHealth] = useState(defaultHealth());
  const [equip, setEquip] = useState<EquipmentKey[]>([]); const [weightsText, setWeightsText] = useState(""); const [bands, setBands] = useState(""); const [other, setOther] = useState("");
  const [goals, setGoals] = useState<GoalKey[]>(["build_muscle", "everyday_strength"]); const [note, setNote] = useState("");

  const dumbbells = equip.includes("light_dumbbells") || equip.includes("adjustable_dumbbells");
  const weights = parseWeights(weightsText);
  const equipment = {
    items: equip.length ? equip : (["none"] as EquipmentKey[]), dumbbellWeightsKg: dumbbells ? weights : [], bandLevels: bands.split(",").map((s) => s.trim()).filter(Boolean), other,
  };
  const goalsObj: Omit<FitnessGoals, "updatedAt"> = { priorities: goals, personalNote: note };
  const profileDraft = (): Omit<Profile, "updatedAt" | "onboardedAt"> => ({
    name: name.trim(), experience: exp, activityLevel: activity, movementConfidence: conf,
    ...(dob ? { dateOfBirth: dob } : {}), ...(height ? { heightCm: Number(height) } : {}), ...(weight ? { weightKg: Number(weight) } : {}),
  });
  const screening = screen({ ...health, updatedAt: "" });

  const buildPreview = () => {
    if (step !== 5) return null;
    const now = new Date().toISOString();
    const prefs = { ...data.preferences, timezone: tz, trainingDays: days, trainingTime: time, daysPerWeek, sessionMinutes: minutes, updatedAt: now };
    const eq = { ...equipment, updatedAt: now };
    const h = { ...health, updatedAt: now };
    const prog = generateProgram({ profile: { ...profileDraft(), updatedAt: now }, preferences: prefs, equipment: eq, health: h, goals: { ...goalsObj, updatedAt: now }, now, startDate: mondayOf(today), id: "preview" });
    return { prog, overview: programOverview(prog, prefs, eq) };
  };
  const preview = buildPreview();

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (step === 0) {
      const r = profileSchema.pick({ name: true, dateOfBirth: true, heightCm: true, weightKg: true }).safeParse({ name: name.trim(), ...(dob ? { dateOfBirth: dob } : {}), ...(height ? { heightCm: Number(height) } : {}), ...(weight ? { weightKg: Number(weight) } : {}) });
      if (!r.success) for (const i of r.error.issues) e[String(i.path[0])] = i.path[0] === "name" ? "Please tell us what to call you." : i.path[0] === "heightCm" ? "Height should be between 80 and 250 cm." : i.path[0] === "weightKg" ? "Weight should be between 20 and 300 kg." : "Please check this date.";
      if (!days.length) e.days = "Choose at least one day you could train.";
      if (!isValidTimezone(tz)) e.tz = "Please choose a timezone.";
    }
    if (step === 3 && dumbbells && weightsText.trim() && !weights.length) e.weights = "Enter weights in kilograms, separated by commas – for example 1, 2, 3.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }
  const next = () => { if (validate()) { setStep((s) => s + 1); window.scrollTo({ top: 0 }); } };
  const back = () => { setErrors({}); setStep((s) => Math.max(0, s - 1)); window.scrollTo({ top: 0 }); };

  function finish() {
    run((d, c) => completeOnboarding(d, c, {
      profile: profileDraft(),
      preferences: { timezone: tz, trainingDays: days, trainingTime: time, daysPerWeek, sessionMinutes: minutes },
      equipment, health: { ...health, answered: health.answered }, goals: goalsObj,
    }));
    toast(`Welcome, ${name.trim()}. Your programme is ready.`);
    router.replace("/");
  }
  const setH = <K extends keyof typeof health>(k: K, v: (typeof health)[K]) => setHealth((h) => ({ ...h, [k]: v, answered: true }));

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-muted">Step {step + 1} of {STEPS.length}</p>
        <h1 className="text-3xl font-bold">{step === 0 ? "Welcome to JoStrong" : STEPS[step]}</h1>
        {step === 0 && <p className="mt-1 text-muted">A little stronger, every day. Let&apos;s set things up around you. Everything here is optional unless marked.</p>}
        <div className="mt-3"><ProgressBar value={step + 1} max={STEPS.length} label="Setup progress" /></div>
      </header>

      {step === 0 && (
        <Card className="space-y-5">
          <Field label="What would you like us to call you?" htmlFor="name" error={errors.name}><Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" maxLength={40} aria-required /></Field>
          <Notice title="Why we ask for the next three things">Date of birth, height and weight are <strong>optional</strong>. They are never used to pick your weights or compare you with anyone. You can leave them blank.</Notice>
          <Field label="Date of birth (optional)" htmlFor="dob" error={errors.dateOfBirth}><Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Height in cm (optional)" htmlFor="h" error={errors.heightCm}><Input id="h" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} /></Field>
            <Field label="Body weight in kg (optional)" htmlFor="w" error={errors.weightKg}><Input id="w" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} /></Field>
          </div>
          <div>
            <CheckGroup legend="Which days could you train?" hint="Pick the days that usually suit you. We'll leave a rest day between sessions." values={days}
              onToggle={(v) => setDays((d) => (d.includes(v) ? d.filter((x) => x !== v) : [...d, v].sort()))} options={DAY_OPTIONS} />
            {errors.days && <p role="alert" className="mt-1 text-sm font-semibold text-danger">{errors.days}</p>}
          </div>
          <Field label="Preferred training time" htmlFor="time"><Input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
          <ChoiceGroup legend="How many days a week could you train?" value={daysPerWeek} onChange={setDaysPerWeek} columns={2}
            options={[{ value: 2, label: "2 days" }, { value: 3, label: "3 days", description: "From Week 5, if you feel ready" }, { value: 1, label: "1 day" }, { value: 4, label: "4 or more days (we'll still keep to 3 sessions)" }]} />
          <ChoiceGroup legend="How long could each session be?" value={minutes} onChange={setMinutes} columns={2}
            options={[{ value: 20, label: "About 20 minutes" }, { value: 30, label: "About 30 minutes" }, { value: 45, label: "About 45 minutes" }, { value: 60, label: "About an hour" }]} />
          <Field label="Your timezone" htmlFor="tz" error={errors.tz}>
            <Select id="tz" value={tz} onChange={(e) => setTz(e.target.value)}>{[...new Set([tz, ...TIMEZONES])].map((z) => <option key={z}>{z}</option>)}</Select>
          </Field>
        </Card>
      )}

      {step === 1 && (
        <Card className="space-y-6">
          <ChoiceGroup legend="How would you describe your current exercise experience?" value={exp} onChange={setExp}
            options={[{ value: "new", label: "I'm completely new to strength training" }, { value: "little", label: "I've exercised a little before" }, { value: "regular_past", label: "I've trained regularly in the past" }, { value: "returning", label: "I'm returning after a long break" }]} />
          <ChoiceGroup legend="How active are you at the moment?" value={activity} onChange={setActivity}
            options={[{ value: "mostly_sitting", label: "Mostly sitting" }, { value: "light", label: "Lightly active – short walks, housework" }, { value: "moderate", label: "Moderately active – regular walks or classes" }, { value: "active", label: "Very active" }]} />
          <ChoiceGroup legend="How confident do you feel with basic movements like squatting or pushing?" value={conf} onChange={(v) => setConf(v as Profile["movementConfidence"])}
            options={[{ value: 1, label: "1 – Not very confident" }, { value: 2, label: "2" }, { value: 3, label: "3 – Fairly confident" }, { value: 4, label: "4" }, { value: 5, label: "5 – Very confident" }]} />
          <Notice>Whatever your answer, you&apos;ll start with gentle exercises and find your own starting weights in your first session.</Notice>
        </Card>
      )}

      {step === 2 && (
        <Card className="space-y-6">
          <Notice tone="peach" title="All of these questions are optional">We use your answers only to choose gentler exercise options. JoStrong doesn&apos;t diagnose anything and is not a substitute for medical advice.
            <div className="mt-3"><Button variant="outline" size="sm" onClick={() => { setHealth(defaultHealth()); setStep(3); }}>Skip these questions</Button></div></Notice>
          <ChoiceGroup legend="How is your general mobility?" value={health.mobility} onChange={(v) => setH("mobility", v)} options={[{ value: "good", label: "I move freely" }, { value: "some", label: "A little stiff or limited" }, { value: "limited", label: "Quite limited" }]} />
          <ChoiceGroup legend="Can you rise from a chair comfortably?" value={health.chairRise} onChange={(v) => setH("chairRise", v)} options={[{ value: "easy", label: "Yes, easily" }, { value: "effort", label: "Yes, with some effort" }, { value: "difficult", label: "It's difficult" }]} />
          <ChoiceGroup legend="Can you lift your arms overhead?" value={health.armsOverhead} onChange={(v) => setH("armsOverhead", v)} options={[{ value: "full", label: "Yes, fully" }, { value: "partial", label: "Partly" }, { value: "no", label: "Not comfortably" }]} />
          <ChoiceGroup legend="How confident is your balance?" value={health.balance} onChange={(v) => setH("balance", v)} options={[{ value: "confident", label: "Confident" }, { value: "somewhat", label: "Somewhat" }, { value: "not_confident", label: "Not confident" }]} />
          {(["back", "knee", "shoulder"] as const).map((a) => (
            <ChoiceGroup key={a} legend={`Do you get ${a} discomfort?`} value={health[`${a}Discomfort` as const]} onChange={(v) => setH(`${a}Discomfort` as const, v)}
              options={[{ value: "none", label: "No" }, { value: "occasional", label: "Occasionally" }, { value: "frequent", label: "Often" }]} />
          ))}
          <Field label="Previous injuries you'd like us to know about (optional)" htmlFor="inj"><Textarea id="inj" value={health.previousInjuries} maxLength={500} onChange={(e) => setH("previousInjuries", e.target.value)} /></Field>
          <Field label="Anything else relevant (optional)" htmlFor="cond" hint="For example a condition you manage. This stays private to you."><Textarea id="cond" value={health.conditions} maxLength={500} onChange={(e) => setH("conditions", e.target.value)} /></Field>
          <CheckGroup legend="Professional advice" columns={1} values={health.hasProfessionalRestrictions ? ["r"] : []} onToggle={() => setH("hasProfessionalRestrictions", !health.hasProfessionalRestrictions)}
            options={[{ value: "r", label: "A doctor or physiotherapist has given me exercise restrictions or advice", description: "We'll suggest you check the plan with them before starting." }]} />
          {screening.status !== "ok" && (
            <Notice tone={screening.status === "clearance_recommended" ? "warn" : "soft"} title={screening.status === "clearance_recommended" ? "A quick check with a professional is a good idea" : "We'll make a few gentle adjustments"}>
              <ul className="list-disc pl-5">{[...screening.reasons, ...screening.modifications].map((r) => <li key={r}>{r}</li>)}</ul>
            </Notice>
          )}
        </Card>
      )}

      {step === 3 && (
        <Card className="space-y-6">
          <CheckGroup legend="What equipment do you have?" hint="We only choose exercises you can do with what you tick." values={equip}
            onToggle={(v) => setEquip((e) => (e.includes(v) ? e.filter((x) => x !== v) : v === "none" ? ["none"] : [...e.filter((x) => x !== "none"), v]))}
            options={(Object.keys(EQUIPMENT_LABELS) as EquipmentKey[]).map((k) => ({ value: k, label: EQUIPMENT_LABELS[k] }))} />
          {dumbbells && (
            <Field label="Which dumbbell weights can you use? (kg)" htmlFor="dw" hint="List each weight you have, separated by commas – for example 1, 2, 3, 4. Progress suggestions only ever use weights you list." error={errors.weights}>
              <Input id="dw" inputMode="decimal" value={weightsText} onChange={(e) => setWeightsText(e.target.value)} placeholder="1, 2, 3, 4" />
            </Field>
          )}
          {equip.includes("bands") && <Field label="Which resistance bands do you have? (optional)" htmlFor="bands" hint="For example Light, Medium"><Input id="bands" value={bands} onChange={(e) => setBands(e.target.value)} /></Field>}
          {equip.includes("other") && <Field label="Other equipment" htmlFor="oe"><Input id="oe" value={other} maxLength={200} onChange={(e) => setOther(e.target.value)} /></Field>}
          {!equip.length && <Notice>Nothing ticked? That&apos;s fine – we&apos;ll start with bodyweight exercises. You can add equipment later in Settings.</Notice>}
        </Card>
      )}

      {step === 4 && (
        <Card className="space-y-5">
          <CheckGroup legend="What matters most to you?" hint="Tick as many as you like. The first one you tick is treated as your top priority." columns={1} values={goals}
            onToggle={(v) => setGoals((g) => (g.includes(v) ? g.filter((x) => x !== v) : [...g, v]))} options={GOALS.map((g) => ({ ...g, label: `${goals.includes(g.value) ? `${goals.indexOf(g.value) + 1}. ` : ""}${g.label}` }))} />
          <Field label="Anything you'd like to remember about why you're doing this? (optional)" htmlFor="note"><Textarea id="note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} /></Field>
          <Notice>Balanced strength and muscle development is the default focus. Nothing here is about weight loss.</Notice>
        </Card>
      )}

      {step === 5 && preview && (
        <div className="space-y-4">
          <Card className="space-y-2 bg-soft">
            <h2 className="text-2xl font-bold">{name.trim() || "Jo"}, your strength journey starts here.</h2>
            <p>Your plan is built from what you told us, using simple, fixed rules – no guesswork.</p>
          </Card>
          {preview.prog.screening.status === "clearance_recommended" && (
            <Notice tone="warn" title="Before you start">
              <ul className="list-disc pl-5">{preview.prog.screening.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
              <p className="mt-2">You&apos;ll be able to confirm you have professional guidance on the next screen. Until then your plan is ready but locked.</p>
            </Notice>
          )}
          <Card className="space-y-3">
            <h3 className="text-xl font-bold">Starting phase: {preview.overview.startingPhase.name} (Weeks 1–4)</h3>
            <p className="text-muted">{preview.overview.startingPhase.blurb}</p>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div><dt className="font-semibold">Weekly schedule</dt><dd className="text-muted">{preview.overview.sessionsPerWeek} full-body sessions: {days.slice(0, preview.overview.sessionsPerWeek).map((d) => WEEKDAY_NAMES[d - 1]).join(" & ")} (editable)</dd></div>
              <div><dt className="font-semibold">Each session</dt><dd className="text-muted">About {preview.overview.estimatedMinutes} minutes · {preview.overview.sets} set{preview.overview.sets > 1 ? "s" : ""} of each exercise</dd></div>
              <div><dt className="font-semibold">Recovery</dt><dd className="text-muted">{preview.overview.recoveryNote}</dd></div>
              <div><dt className="font-semibold">Starting weights</dt><dd className="text-muted">{preview.overview.startingResistance}</dd></div>
            </dl>
          </Card>
          {preview.overview.exercises.map((w) => (
            <Card key={w.letter}>
              <h3 className="text-xl font-bold">Workout {w.letter}</h3>
              <ol className="mt-2 list-decimal space-y-1 pl-6">{w.items.filter((i) => !i.optional).map((i) => <li key={i.slot}><span className="font-semibold">{i.exercise.name}</span> <span className="text-muted">– {i.exercise.muscles.join(", ")}</span></li>)}</ol>
              {w.items.some((i) => i.optional) && <p className="mt-2 text-sm text-muted">Optional extras: {w.items.filter((i) => i.optional).map((i) => i.exercise.name).join(", ")}</p>}
            </Card>
          ))}
          <Card><h3 className="text-xl font-bold">How you&apos;ll progress</h3><p className="mt-1 text-muted">{preview.overview.progression} You can customise any exercise in My Workouts after you start.</p></Card>
        </div>
      )}

      <div className="flex gap-3 pb-6">
        {step > 0 && <Button variant="outline" size="lg" onClick={back}>Back</Button>}
        {step < 5 ? <Button size="lg" className="flex-1" onClick={next}>Continue</Button> : <Button size="lg" className="flex-1" onClick={finish}>Start my journey</Button>}
      </div>
    </div>
  );
}
