import { describe, expect, it } from "vitest";
import { assessReadiness, lighterSets } from "@/lib/domain/readiness";
import { chooseDays, dayState, moveWorkout, nextPlanned, planWeek, reconcilePast, rebuildSchedule, relabel, validateMove } from "@/lib/domain/calendar";
import { addDays, formatDateAU, isoDateInTz, isoWeekday, mondayOf } from "@/lib/domain/dates";
import type { ScheduledWorkout } from "@/lib/domain/types";

let n = 0;
const idGen = () => `id-${++n}`;
const NOW = "2026-11-09T00:00:00.000Z";
const sw = (date: string, letter: "A" | "B", status: ScheduledWorkout["status"] = "planned"): ScheduledWorkout => ({ id: idGen(), date, letter, week: 1, status, updatedAt: NOW });

describe("readiness check-in", () => {
  it("good answers → normal session", () => {
    const a = assessReadiness({ energy: "great", muscles: "recovered", pain: "none" });
    expect(a.recommended).toBe("normal");
    expect(a.options.map((o) => o.mode)).toContain("recovery");
  });
  it("a little tired / mildly sore → lighter recommended, normal still allowed", () => {
    const a = assessReadiness({ energy: "tired", muscles: "recovered", pain: "none" });
    expect(a.recommended).toBe("lighter");
    expect(a.options.map((o) => o.mode)).toContain("normal");
  });
  it("very tired or quite sore → recovery day offered first", () => {
    expect(assessReadiness({ energy: "very_tired", muscles: "recovered", pain: "none" }).recommended).toBe("recovery");
    expect(assessReadiness({ energy: "good", muscles: "quite_sore", pain: "none" }).recommended).toBe("recovery");
  });
  it("new or significant pain → never offers a normal or lighter session; seeks guidance", () => {
    const a = assessReadiness({ energy: "great", muscles: "recovered", pain: "new" });
    expect(a.recommended).toBe("seek_guidance");
    expect(a.seekGuidance).toBe(true);
    expect(a.options.map((o) => o.mode)).toEqual(["recovery"]);
    expect(a.detail).toMatch(/doctor or physiotherapist/);
  });
  it("familiar discomfort offers movement substitutions", () => {
    expect(assessReadiness({ energy: "good", muscles: "recovered", pain: "familiar" }).swapSuggestion).toBe(true);
  });
  it("lighter sessions drop a set but never go below one", () => { expect(lighterSets(3)).toBe(2); expect(lighterSets(1)).toBe(1); });
});

describe("dates (Australia/Melbourne)", () => {
  it("uses the chosen timezone for 'today'", () => {
    expect(isoDateInTz(new Date("2026-11-08T14:30:00Z"), "Australia/Melbourne")).toBe("2026-11-09"); // AEDT +11
    expect(isoDateInTz(new Date("2026-11-08T14:30:00Z"), "UTC")).toBe("2026-11-08");
  });
  it("weekday and Monday helpers", () => { expect(isoWeekday("2026-11-09")).toBe(1); expect(mondayOf("2026-11-15")).toBe("2026-11-09"); });
  it("Australian formatting", () => { expect(formatDateAU("2026-11-09")).toBe("9 Nov 2026"); expect(formatDateAU("2026-11-09", "weekday")).toBe("Monday 9 November"); });
});

describe("calendar", () => {
  it("default beginner schedule is Monday A, Thursday B", () => {
    const wk = planWeek({ weekMonday: "2026-11-09", week: 1, daysPerWeek: 3, preferredDays: [], startLetter: "A", idGen, now: NOW });
    expect(wk.map((w) => [w.date, w.letter])).toEqual([["2026-11-09", "A"], ["2026-11-12", "B"]]);
  });
  it("phase 2 is Mon/Wed/Fri A,B,A and the next week continues B,A,B", () => {
    const w5 = planWeek({ weekMonday: "2026-11-09", week: 5, daysPerWeek: 3, preferredDays: [1, 3, 5], startLetter: "A", idGen, now: NOW });
    expect(w5.map((w) => w.letter)).toEqual(["A", "B", "A"]);
    expect(w5.map((w) => isoWeekday(w.date))).toEqual([1, 3, 5]);
    const w6 = planWeek({ weekMonday: "2026-11-16", week: 6, daysPerWeek: 3, preferredDays: [1, 3, 5], startLetter: "B", idGen, now: NOW });
    expect(w6.map((w) => w.letter)).toEqual(["B", "A", "B"]);
  });
  it("respects the rest interval when choosing days", () => {
    const d = chooseDays([1, 2, 3], 2);
    expect(d[1]! - d[0]!).toBeGreaterThanOrEqual(2);
    expect(chooseDays([6, 7], 2).length).toBe(2);
  });
  it("limits sessions to the days Jo has available", () => {
    const wk = planWeek({ weekMonday: "2026-11-09", week: 9, daysPerWeek: 2, preferredDays: [2, 5], startLetter: "A", idGen, now: NOW });
    expect(wk).toHaveLength(2);
  });
  it("move validation: blocks duplicates and past dates, warns on close sessions", () => {
    const sched = [sw("2026-11-09", "A"), sw("2026-11-12", "B")];
    expect(validateMove(sched, sched[0]!.id, "2026-11-12", "2026-11-09").ok).toBe(false);
    expect(validateMove(sched, sched[0]!.id, "2026-11-08", "2026-11-09").ok).toBe(false);
    const close = validateMove(sched, sched[0]!.id, "2026-11-13", "2026-11-09");
    expect(close.ok).toBe(true); expect(close.warning).toMatch(/rest day/);
    expect(validateMove(sched, sched[0]!.id, "2026-11-10", "2026-11-09")).toEqual({ ok: true });
  });
  it("completed sessions cannot be moved", () => {
    const sched = [sw("2026-11-09", "A", "completed")];
    expect(validateMove(sched, sched[0]!.id, "2026-11-11", "2026-11-09").ok).toBe(false);
  });
  it("moving then relabelling never duplicates a workout letter back-to-back", () => {
    let sched = [sw("2026-11-09", "A"), sw("2026-11-12", "B"), sw("2026-11-16", "A")];
    sched = moveWorkout(sched, sched[0]!.id, "2026-11-14", NOW); // A moved after B
    sched = relabel(sched, null, NOW);
    expect(sched.map((s) => s.letter)).toEqual(["A", "B", "A"]);
    expect(sched.map((s) => s.date)).toEqual(["2026-11-12", "2026-11-14", "2026-11-16"]);
  });
  it("relabel continues from the last completed workout and leaves history alone", () => {
    const sched = relabel([sw("2026-11-02", "A", "completed"), sw("2026-11-12", "A"), sw("2026-11-16", "A")], "A", NOW);
    expect(sched.map((s) => s.letter)).toEqual(["A", "B", "A"]);
    expect(sched[0]!.status).toBe("completed");
  });
  it("changing preferred days rebuilds future weeks but preserves history", () => {
    const done = sw("2026-11-09", "A", "completed");
    const out = rebuildSchedule({
      existing: [done, sw("2026-11-12", "B")], today: "2026-11-10", currentWeek: 1, daysPerWeek: 3, preferredDays: [2, 5], idGen, now: NOW,
    });
    expect(out.find((s) => s.id === done.id)?.status).toBe("completed");
    const planned = out.filter((s) => s.status === "planned" && s.date >= "2026-11-10");
    expect(planned.length).toBeGreaterThan(0);
    expect(planned[0]!.letter).toBe("B");
    expect(planned.every((s) => [2, 5].includes(isoWeekday(s.date)))).toBe(true);
    expect(new Set(out.map((s) => s.date)).size).toBe(out.length); // no two sessions on one day
  });
  it("rest days are their own state and never 'missed'", () => {
    const sched = [sw("2026-11-09", "A")];
    expect(dayState(sched, "2026-11-10")).toEqual({ kind: "rest" });
    expect(dayState(sched, "2026-11-09").kind).toBe("workout");
  });
  it("unfinished past sessions become gently 'skipped', future ones are untouched; next planned found", () => {
    const sched = reconcilePast([sw("2026-11-02", "A"), sw("2026-11-12", "B")], "2026-11-09", NOW);
    expect(sched.map((s) => s.status)).toEqual(["skipped", "planned"]);
    expect(nextPlanned(sched, "2026-11-09")?.date).toBe("2026-11-12");
    expect(addDays("2026-11-09", 7)).toBe("2026-11-16");
  });
});
