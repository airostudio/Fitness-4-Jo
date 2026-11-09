import { describe, expect, it } from "vitest";
import { EXERCISES, mustExercise } from "@/lib/domain/exercises";
import { availableRequirements, canDo, nextHeavier, nextLighter, normaliseWeights } from "@/lib/domain/equipment";
import { buildTemplates, estimateMinutes, generateProgram, phaseForWeek, programOverview, screen, setsThatFit, weekPlan, SLOT_OPTIONS } from "@/lib/domain/program";
import { goals, health, inv, prefs, profile } from "./helpers";

const FULL = inv(["mat", "chair", "light_dumbbells", "step", "bands"], [1, 2, 3, 4]);

describe("exercise library", () => {
  it("has at least 30 unique exercises with every required field", () => {
    expect(EXERCISES.length).toBeGreaterThanOrEqual(30);
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
    for (const e of EXERCISES) {
      expect(e.name && e.description && e.startingPosition && e.breathing).toBeTruthy();
      expect(e.muscles.length).toBeGreaterThan(0);
      expect(e.steps.length).toBeGreaterThan(1);
      expect(e.commonMistakes.length).toBeGreaterThan(0);
      expect(e.safetyNotes.length).toBeGreaterThan(0);
      expect(e.media.kind).toBe("none"); // no unlicensed or fabricated media
    }
  });
  it("covers all seven categories", () => {
    expect(new Set(EXERCISES.map((e) => e.category)).size).toBe(7);
  });
  it("progression/regression references resolve", () => {
    const ids = new Set(EXERCISES.map((e) => e.id));
    for (const e of EXERCISES) for (const r of [...e.progressions, ...e.regressions]) expect(ids.has(r), `${e.id} → ${r}`).toBe(true);
  });
  it("every main-lift exercise has an easier or harder variation", () => {
    for (const id of ["chair-squat", "supported-db-row", "wall-push-up", "glute-bridge", "dead-bug", "dumbbell-rdl", "seated-shoulder-press", "supported-low-step-up", "dumbbell-curl", "bird-dog"]) {
      const e = mustExercise(id);
      expect(e.progressions.length + e.regressions.length, id).toBeGreaterThan(0);
    }
  });
  it("all slot options exist", () => { for (const ids of Object.values(SLOT_OPTIONS)) for (const id of ids) mustExercise(id); });
});

describe("equipment", () => {
  it("maps confirmed equipment to requirements; bench stands in for a chair", () => {
    expect(availableRequirements({ items: ["adjustable_dumbbells"] }).has("dumbbells")).toBe(true);
    expect(availableRequirements({ items: ["bench"] }).has("chair")).toBe(true);
    expect(canDo(mustExercise("dumbbell-curl"), { items: ["mat"] })).toBe(false);
  });
  it("weight helpers", () => {
    expect(normaliseWeights([3, 1, 1, -2, 2.5])).toEqual([1, 2.5, 3]);
    expect(nextHeavier([1, 2, 3], 2)).toBe(3); expect(nextHeavier([1, 2, 3], 3)).toBeNull();
    expect(nextLighter([1, 2, 3], 2)).toBe(1); expect(nextLighter([1, 2, 3], 1)).toBeNull();
  });
});

describe("12-week structure", () => {
  it("phases follow the brief", () => {
    expect([1, 4, 5, 8, 9, 12, 13].map(phaseForWeek)).toEqual(["foundation", "foundation", "building", "building", "development", "development", "ongoing"]);
  });
  it("phase 1: two sessions, one set then moving to two", () => {
    expect(weekPlan(1, 3)).toMatchObject({ sessions: 2, sets: 1, repRange: [8, 12] });
    expect(weekPlan(4, 3)).toMatchObject({ sessions: 2, sets: 2 });
  });
  it("phase 2: up to three sessions, two sets; phase 3: two to three sets", () => {
    expect(weekPlan(6, 3)).toMatchObject({ sessions: 3, sets: 2, maxSets: 2 });
    expect(weekPlan(11, 3)).toMatchObject({ sessions: 3, sets: 3, maxSets: 3 });
    expect(weekPlan(9, 3).sets).toBe(2);
  });
  it("never schedules more sessions than days available", () => {
    expect(weekPlan(6, 2).sessions).toBe(2); expect(weekPlan(1, 1).sessions).toBe(1);
  });
  it("continues beyond week 12", () => { expect(weekPlan(20, 3).phase).toBe("ongoing"); });
});

describe("workouts A and B", () => {
  it("match the programme brief with full equipment", () => {
    const { templates } = buildTemplates(FULL, health());
    const names = (l: string) => templates.find((t) => t.letter === l)!.slots.filter((s) => !s.optional).map((s) => s.exerciseId);
    expect(names("A")).toEqual(["chair-squat", "supported-db-row", "wall-push-up", "glute-bridge", "dead-bug"]);
    expect(names("B")).toEqual(["dumbbell-rdl", "seated-shoulder-press", "supported-low-step-up", "dumbbell-curl", "bird-dog"]);
  });
  it("only prescribes equipment Jo confirmed (no equipment at all)", () => {
    const { templates } = buildTemplates(inv(["none"]), health());
    for (const t of templates) for (const s of t.slots) expect(mustExercise(s.exerciseId).requires, s.exerciseId).toEqual([]);
  });
  it("substitutes bands for dumbbells when only bands are available", () => {
    const { templates } = buildTemplates(inv(["mat", "chair", "bands"]), health());
    const ids = templates.flatMap((t) => t.slots.map((s) => s.exerciseId));
    expect(ids).not.toContain("dumbbell-curl");
    expect(ids).toContain("band-curl");
    expect(ids).toContain("band-row");
  });
  it("avoids overhead pressing and step-ups when arms/balance are limited", () => {
    const { templates } = buildTemplates(FULL, health({ armsOverhead: "no", balance: "not_confident" }));
    const ids = templates.flatMap((t) => t.slots.map((s) => s.exerciseId));
    expect(ids).not.toContain("seated-shoulder-press");
    expect(ids).not.toContain("supported-low-step-up");
  });
  it("avoids back-loading hinge when back discomfort is frequent", () => {
    const ids = buildTemplates(FULL, health({ backDiscomfort: "frequent" })).templates.flatMap((t) => t.slots.map((s) => s.exerciseId));
    expect(ids).not.toContain("dumbbell-rdl");
  });
  it("includes optional calf and extra pulling work", () => {
    const all = buildTemplates(FULL, health()).templates.flatMap((t) => t.slots);
    expect(all.filter((s) => s.optional).map((s) => s.slot).sort()).toEqual(["calf", "extra_pull"]);
  });
  it("estimates duration and trims sets to fit available time, never below 1", () => {
    const t = buildTemplates(FULL, health()).templates[0]!;
    expect(estimateMinutes(t, 2)).toBeGreaterThan(estimateMinutes(t, 1));
    expect(setsThatFit(t, 3, 5)).toBe(1);
    expect(setsThatFit(t, 2, 600)).toBe(2);
  });
});

describe("health screening", () => {
  it("OK for a clear profile", () => { expect(screen(health()).status).toBe("ok"); });
  it("professional restrictions → clearance recommended; program is not unrestricted", () => {
    const s = screen(health({ hasProfessionalRestrictions: true }));
    expect(s.status).toBe("clearance_recommended");
    expect(s.reasons[0]).toMatch(/doctor or physiotherapist/);
  });
  it("frequent discomfort → clearance recommended; occasional → caution", () => {
    expect(screen(health({ kneeDiscomfort: "frequent" })).status).toBe("clearance_recommended");
    expect(screen(health({ kneeDiscomfort: "occasional" })).status).toBe("caution");
  });
  it("difficulty rising from a chair AND poor balance → clearance recommended", () => {
    expect(screen(health({ chairRise: "difficult", balance: "not_confident" })).status).toBe("clearance_recommended");
  });
  it("skipped questions are fine and start gentle", () => {
    const s = screen(health({ answered: false })); expect(s.status).toBe("ok");
  });
  it("never diagnoses", () => {
    const text = JSON.stringify([screen(health({ kneeDiscomfort: "frequent", hasProfessionalRestrictions: true }))]);
    expect(text).not.toMatch(/arthritis|osteo|you have|diagnos/i);
  });
});

describe("generated program + overview", () => {
  it("builds a program and the 'starts here' overview without guessing loads", () => {
    const p = generateProgram({ profile: profile(), preferences: prefs(), equipment: FULL, health: health(), goals: goals(), now: "2026-11-09T00:00:00.000Z", startDate: "2026-11-09", id: "p1" });
    expect(p.currentWeek).toBe(1);
    expect(p.exerciseTargets).toEqual({});
    const o = programOverview(p, prefs(), FULL);
    expect(o.startingPhase.name).toBe("Foundation");
    expect(o.startingResistance).toMatch(/first session/);
    expect(o.estimatedMinutes).toBeGreaterThan(5);
    expect(o.exercises).toHaveLength(2);
  });
});
