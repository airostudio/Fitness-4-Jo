import { describe, expect, it } from "vitest";
import { calibrationAdvice, evaluateProgression, reviewWeek, type ProgressionInput } from "@/lib/domain/progression";
import { curl, perf } from "./helpers";

const base = (history: ProgressionInput["history"], o: Partial<ProgressionInput> = {}): ProgressionInput => ({
  name: "Jo", exercise: curl(), history, today: "2026-11-09", availableWeights: [1, 2, 3, 4, 5], hasBands: false, maxSets: 3, ...o,
});

describe("progression engine", () => {
  it("suggests a small step up after two good sessions at the top of the range, with Jo's wording", () => {
    const r = evaluateProgression(base([perf("2026-11-06", 2, [12, 12]), perf("2026-11-02", 2, [11, 11])], { maxSets: 2 }));
    expect(r.action).toBe("increase_weight");
    expect(r.needsDecision).toBe(true);
    expect(r.proposed?.weight).toBe(3);
    expect(r.message).toBe("Jo, you've been handling 2 kg comfortably. Would you like to try 3 kg next time?");
    expect(r.explanation.length).toBeGreaterThan(1);
  });

  it("never progresses on a single good session", () => {
    const r = evaluateProgression(base([perf("2026-11-06", 2, [12, 12])]));
    expect(r.action).toBe("insufficient_evidence");
    expect(r.needsDecision).toBe(false);
  });

  it("does not progress when the previous session was at a different weight", () => {
    const r = evaluateProgression(base([perf("2026-11-06", 3, [12, 12]), perf("2026-11-02", 2, [12, 12])]));
    expect(r.action).toBe("insufficient_evidence");
  });

  it("suggests more repetitions when not yet at the top of the range", () => {
    const r = evaluateProgression(base([perf("2026-11-06", 2, [10, 11])]));
    expect(r.action).toBe("increase_reps");
    expect(r.proposed?.targetReps).toBe(11);
  });

  it("holds when effort is demanding even at the top of the range", () => {
    const r = evaluateProgression(base([perf("2026-11-06", 2, [12, 12], { effort: "challenging" }), perf("2026-11-02", 2, [12, 12])]));
    expect(r.action).toBe("hold");
  });

  it("never increases after concerning discomfort and points to professional advice", () => {
    const r = evaluateProgression(base([perf("2026-11-06", 2, [12, 12], { discomfort: "concerning" }), perf("2026-11-02", 2, [12, 12])]));
    expect(r.action).toBe("consult");
    expect(r.proposed).toBeNull();
    expect(r.message).toMatch(/physiotherapist|doctor/);
  });

  it("blocks progression on any discomfort reported on a set", () => {
    const h = perf("2026-11-06", 2, [12, 12]);
    h.sets[0]!.discomfort = "concerning";
    expect(evaluateProgression(base([h, perf("2026-11-02", 2, [12, 12])])).action).toBe("consult");
  });

  it("holds (no progression) on mild discomfort", () => {
    const r = evaluateProgression(base([perf("2026-11-06", 2, [12, 12], { discomfort: "mild" }), perf("2026-11-02", 2, [12, 12])]));
    expect(r.action).toBe("hold");
  });

  it("does not progress when technique confidence is low", () => {
    const r = evaluateProgression(base([perf("2026-11-06", 2, [12, 12], { technique: "unsure" }), perf("2026-11-02", 2, [12, 12])]));
    expect(r.action).toBe("hold");
  });

  it("pauses progression after two tired/sore check-ins", () => {
    const r = evaluateProgression(base([perf("2026-11-06", 2, [12, 12]), perf("2026-11-02", 2, [12, 12])], {
      recentReadiness: [{ energy: "very_tired", muscles: "recovered" }, { energy: "good", muscles: "quite_sore" }],
    }));
    expect(r.action).toBe("hold");
    expect(r.explanation.join(" ")).toMatch(/tiredness or soreness/);
  });

  it("offers a lighter weight, framed kindly, when a weight is too heavy — history preserved", () => {
    const r = evaluateProgression(base([perf("2026-11-06", 3, [8, 6], { tooHeavy: true })]));
    expect(r.action).toBe("decrease_weight");
    expect(r.proposed?.weight).toBe(2);
    expect(r.message).not.toMatch(/fail/i);
    expect(r.message).toMatch(/not a step backwards/);
  });

  it("offers an easier exercise when no lighter weight exists", () => {
    const r = evaluateProgression(base([perf("2026-11-06", 1, [5, 5], { tooHeavy: true })], { availableWeights: [1, 2], exercise: { ...curl(), regressions: ["band-curl"] } }));
    expect(r.action).toBe("hold");
    expect(r.alternatives.some((a) => a.proposed.exerciseId === "band-curl")).toBe(true);
  });

  it("with no heavier weight available, progresses by adding a set instead", () => {
    const r = evaluateProgression(base([perf("2026-11-06", 5, [12, 12]), perf("2026-11-02", 5, [12, 12])], { availableWeights: [1, 2, 3, 4, 5] }));
    expect(r.action).toBe("add_set");
    expect(r.proposed).toEqual({ weight: 5, sets: 3 });
  });

  it("with no weights listed at all (missing increments) it uses sets, never invents a weight", () => {
    const r = evaluateProgression(base([perf("2026-11-06", 2, [12, 12]), perf("2026-11-02", 2, [12, 12])], { availableWeights: [] }));
    expect(r.action).toBe("add_set");
    expect(r.proposed?.weight).toBe(2);
    expect(r.explanation.join(" ")).toMatch(/no heavier weight/i);
  });

  it("offers a set (not a big jump) when the next dumbbell is a large step", () => {
    const r = evaluateProgression(base([perf("2026-11-06", 2, [12, 12]), perf("2026-11-02", 2, [12, 12])], { availableWeights: [2, 6], maxSets: 3 }));
    expect(r.action).toBe("add_set");
    expect(r.alternatives.some((a) => a.proposed.weight === 6)).toBe(true);
  });

  it("never raises load and volume at once: holds right after a set was added", () => {
    const r = evaluateProgression(base([perf("2026-11-06", 2, [12, 12, 12]), perf("2026-11-02", 2, [12, 12])]));
    expect(r.action).toBe("hold");
    expect(r.explanation.join(" ")).toMatch(/load and volume/);
  });

  it("eases back in after 3+ weeks off without blame", () => {
    const r = evaluateProgression(base([perf("2026-09-20", 3, [12, 12])]));
    expect(r.action).toBe("return_gently");
    expect(r.proposed).toEqual({ weight: 2, sets: 1 });
    expect(r.needsDecision).toBe(true);
    expect(r.message).toMatch(/Welcome back/);
  });

  it("a shorter break (2 weeks) keeps the weight but trims volume", () => {
    const r = evaluateProgression(base([perf("2026-10-20", 3, [12, 12])]));
    expect(r.action).toBe("return_gently");
    expect(r.proposed).toEqual({ weight: 3, sets: 1 });
  });

  it("first time on an exercise triggers calibration, not a guessed weight", () => {
    const r = evaluateProgression(base([]));
    expect(r.action).toBe("calibrate");
    expect(r.proposed).toBeNull();
  });

  it("is deterministic", () => {
    const input = base([perf("2026-11-06", 2, [12, 12]), perf("2026-11-02", 2, [11, 11])], { maxSets: 2 });
    expect(evaluateProgression(input)).toEqual(evaluateProgression(structuredClone(input)));
  });

  it("suggests an optional variation only after repeated confident sessions with no other route", () => {
    const mk = (d: string) => perf(d, 5, [12, 12, 12], { technique: "confident" });
    const r = evaluateProgression(base([mk("2026-11-06"), mk("2026-11-02")], { nextVariationId: "hammer-curl", availableWeights: [5] }));
    expect(r.action).toBe("suggest_variation");
    expect(r.proposed?.exerciseId).toBe("hammer-curl");
  });
});

describe("calibration", () => {
  it("suggests heavier when easy, lighter when hard, never beyond owned weights", () => {
    expect(calibrationAdvice("easy", 2, [1, 2, 3]).suggestedWeight).toBe(3);
    expect(calibrationAdvice("easy", 3, [1, 2, 3]).suggestedWeight).toBe(3);
    expect(calibrationAdvice("very_hard", 2, [1, 2, 3]).suggestedWeight).toBe(1);
    expect(calibrationAdvice("comfortable", 2, [1, 2, 3]).suggestedWeight).toBe(2);
  });
});

describe("week review", () => {
  it("advances only after the planned sessions are done comfortably", () => {
    expect(reviewWeek({ plannedSessions: 2, completedSessions: 2, concerningDiscomfort: false, veryHardSets: 0, daysSinceLastSession: 2, weekNumber: 1 }).action).toBe("advance");
    expect(reviewWeek({ plannedSessions: 2, completedSessions: 1, concerningDiscomfort: false, veryHardSets: 0, daysSinceLastSession: 2, weekNumber: 1 }).action).toBe("repeat");
  });
  it("repeats on discomfort and eases after a break", () => {
    expect(reviewWeek({ plannedSessions: 2, completedSessions: 2, concerningDiscomfort: true, veryHardSets: 0, daysSinceLastSession: 1, weekNumber: 4 }).action).toBe("repeat");
    expect(reviewWeek({ plannedSessions: 2, completedSessions: 0, concerningDiscomfort: false, veryHardSets: 0, daysSinceLastSession: 20, weekNumber: 4 }).action).toBe("ease");
  });
});
