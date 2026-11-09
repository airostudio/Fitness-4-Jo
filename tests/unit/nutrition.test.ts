import { describe, expect, it } from "vitest";
import * as N from "@/lib/domain/nutrition";

const prefs = (o: Partial<N.NutritionPrefs> = {}) => ({ ...N.defaultNutrition(), enabled: true, ...o });
const KEYWORDS: Record<N.Allergen, RegExp> = {
  dairy: /milk|yoghurt|yogurt|cheese|butter|cream/i, gluten: /bread|oats|pasta|wrap|flour|couscous|barley|toast|noodles?\b(?<!rice noodles)|soy sauce/i,
  nuts: /almond|walnut|cashew|peanut|pistachio|hazelnut|nut butter/i, eggs: /\begg/i, soy: /soy|tofu|tempeh|edamame/i,
  fish: /tuna|salmon|sardine|fish|anchov/i, shellfish: /prawn|shrimp|crab|lobster|oyster|mussel/i, sesame: /sesame|tahini|hummus/i,
};
/** Plant milks are not dairy. */
const plantMilks = (t: string) => t.replace(/(light |fortified )*(soy|coconut)( milk)?( drink)?/gi, (m) => (/milk/i.test(m) ? m.replace(/milk/i, "drink") : m));
const ANIMAL_WORDS: Record<string, RegExp> = { meat: /chicken|beef|turkey|ham\b|lamb|pork|mince/i, fish: /tuna|salmon|prawn|fish/i, dairy: /milk|yoghurt|cheese/i, egg: /\begg/i };

describe("allergen safety of the meal library", () => {
  it("every meal's allergen tags cover what its ingredients imply (no hidden allergens)", () => {
    for (const meal of N.MEALS) {
      const text = meal.ingredients.join(" | ");
      for (const [a, re] of Object.entries(KEYWORDS) as [N.Allergen, RegExp][]) {
        // fortified soy/coconut "milk" alternatives are not dairy
        const cleaned = plantMilks(text).replace(/rice noodles/gi, "").replace(/(peanut|nut|almond|cashew) butter/gi, "$1 spread");
        if (re.test(cleaned)) expect(meal.contains, `${meal.name} (${meal.id}) mentions ${a} in: ${text}`).toContain(a);
      }
    }
  });
  it("animal tags cover meat, fish, dairy and egg ingredients", () => {
    for (const meal of N.MEALS) {
      const text = plantMilks(meal.ingredients.join(" | "));
      for (const [k, re] of Object.entries(ANIMAL_WORDS)) if (re.test(text)) expect(meal.animal, `${meal.id} ${k}`).toContain(k as never);
    }
  });
  it("a meal containing any avoided allergen is NEVER suggested – for every allergen, style and meal type", () => {
    const allergens = Object.keys(N.ALLERGEN_LABELS) as N.Allergen[];
    for (const style of ["everything", "pescatarian", "vegetarian", "vegan"] as const) {
      for (const a of allergens) for (const type of ["breakfast", "lunch", "dinner", "snack"] as const) {
        for (const meal of N.suggestMeals({ style, avoid: [a] }, type, "any-day", 10)) expect(meal.contains, `${meal.id} for ${style}/${a}`).not.toContain(a);
      }
      for (const meal of N.eligibleMeals({ style, avoid: allergens })) expect(meal.contains).toEqual([]);
    }
  });
  it("styles are respected: vegan has no animal products; vegetarian no meat or fish; pescatarian no meat", () => {
    expect(N.eligibleMeals(prefs({ style: "vegan" })).every((m) => m.animal.length === 0)).toBe(true);
    expect(N.eligibleMeals(prefs({ style: "vegetarian" })).every((m) => !m.animal.includes("meat") && !m.animal.includes("fish"))).toBe(true);
    expect(N.eligibleMeals(prefs({ style: "pescatarian" })).every((m) => !m.animal.includes("meat"))).toBe(true);
  });
  it("every style still has options in every meal type, even with common allergens avoided", () => {
    for (const style of ["everything", "vegetarian", "vegan"] as const)
      for (const type of ["breakfast", "lunch", "dinner", "snack"] as const)
        expect(N.eligibleMeals({ style, avoid: ["dairy", "gluten", "nuts"] }, type).length, `${style} ${type}`).toBeGreaterThan(0);
  });
  it("suggestions are deterministic per day and vary across days", () => {
    const a = N.suggestMeals(prefs(), "dinner", "2026-11-09").map((m) => m.id), b = N.suggestMeals(prefs(), "dinner", "2026-11-09").map((m) => m.id);
    expect(a).toEqual(b);
    const days = new Set(Array.from({ length: 10 }, (_, i) => N.suggestMeals(prefs(), "dinner", `2026-11-${10 + i}`)[0]!.id));
    expect(days.size).toBeGreaterThan(1);
  });
  it("library has unique ids, at least 30 ideas and at least 6 vegan ideas", () => {
    expect(new Set(N.MEALS.map((m) => m.id)).size).toBe(N.MEALS.length);
    expect(N.MEALS.length).toBeGreaterThanOrEqual(30);
    expect(N.eligibleMeals(prefs({ style: "vegan" })).length).toBeGreaterThanOrEqual(8);
  });
});

describe("tone: no calories, no weight-loss, no good/bad food language", () => {
  it("no banned wording anywhere in the nutrition content", () => {
    const all = JSON.stringify([N.MEALS, N.LEARN, N.GROUPS, N.GENERAL_DISCLAIMER, N.SUPPORT_LINE, N.varietyMessage(0, "Jo"), N.varietyMessage(30, "Jo"), N.varietyMessage(60, "Jo"), N.varietyMessage(95, "Jo")]);
    expect(all).not.toMatch(N.BANNED_TONE);
    expect(all).not.toMatch(/\bkcal\b|\bcalorie/i);
  });
  it("goals are food-group serves with a little extra grain on training days, never calories", () => {
    expect(Object.keys(N.dailyGoals(false)).sort()).toEqual(["dairy", "fruit", "grains", "protein", "veg"]);
    expect(N.dailyGoals(true).grains).toBe(N.dailyGoals(false).grains + 1);
  });
});

describe("variety score is encouraging and capped", () => {
  const log = (s: Partial<Record<N.FoodGroup, number>>) => ({ serves: { ...N.emptyServes(), ...s } });
  it("0 for nothing, 100 when every group is met, and extra serves never exceed 100", () => {
    expect(N.varietyScore(undefined)).toBe(0);
    expect(N.varietyScore(log({ veg: 5, fruit: 2, grains: 5, protein: 3, dairy: 3 }))).toBe(100);
    expect(N.varietyScore(log({ veg: 12, fruit: 12, grains: 12, protein: 12, dairy: 12 }))).toBe(100);
    expect(N.varietyScore(log({ veg: 5 }))).toBe(20);
  });
  it("messages are kind at every level", () => { for (const s of [0, 10, 50, 90]) expect(N.varietyMessage(s, "Jo")).not.toMatch(/fail|bad|should have|missed/i); });
});

describe("protein guide", () => {
  const base = { today: "2026-11-09", conditionsText: "", hasRestrictions: false, showGuide: true };
  it("gives a general 1.2–1.6 g/kg range only with a weight and opt-in", () => {
    const g = N.proteinGuide({ ...base, weightKg: 70 });
    expect(g).toMatchObject({ kind: "range", minG: 85, maxG: 110 });
    expect(N.proteinGuide({ ...base })).toEqual({ kind: "none" });
    expect(N.proteinGuide({ ...base, weightKg: 70, showGuide: false })).toEqual({ kind: "none" });
  });
  it("sends people with health notes, restrictions or under 18 to a professional – no numbers", () => {
    for (const x of [{ conditionsText: "chronic kidney disease" }, { conditionsText: "Type 2 diabetes" }, { hasRestrictions: true }, { dateOfBirth: "2012-01-01" }]) {
      expect(N.proteinGuide({ ...base, weightKg: 70, ...x }).kind, JSON.stringify(x)).toBe("ask_professional");
    }
  });
  it("safety level escalates for health notes and restrictions", () => {
    expect(N.nutritionSafety({ conditionsText: "", hasRestrictions: false, clearanceRecommended: false }).level).toBe("standard");
    expect(N.nutritionSafety({ conditionsText: "coeliac disease", hasRestrictions: false, clearanceRecommended: false }).level).toBe("consult");
    expect(N.nutritionSafety({ conditionsText: "", hasRestrictions: true, clearanceRecommended: false }).message).toMatch(/Accredited Practising Dietitian/);
    expect(N.nutritionSafety({ conditionsText: "", hasRestrictions: false, clearanceRecommended: true }).level).toBe("consult");
  });
});
