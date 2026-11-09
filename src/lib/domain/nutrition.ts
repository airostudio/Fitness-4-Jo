// Gentle, evidence-informed nutrition support. Deterministic – no AI.
// Based on the food-group approach of the Australian Dietary Guidelines / Australian Guide to Healthy Eating.
// Deliberately NO calorie targets, NO weight-loss framing and NO "good/bad food" language.

export type FoodGroup = "veg" | "fruit" | "grains" | "protein" | "dairy";
export type EatingStyle = "everything" | "pescatarian" | "vegetarian" | "vegan";
export type Allergen = "dairy" | "gluten" | "nuts" | "eggs" | "soy" | "fish" | "shellfish" | "sesame";
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
type Animal = "meat" | "fish" | "dairy" | "egg" | "honey";

export interface NutritionPrefs {
  enabled: boolean;
  style: EatingStyle;
  avoid: Allergen[]; // foods to keep out of suggestions (allergy, intolerance or preference)
  avoidOther: string; // free text, shown back to Jo (not interpreted)
  showProteinGuide: boolean;
  updatedAt: string;
}
export interface NutritionLog {
  id: string;
  date: string; // YYYY-MM-DD
  serves: Record<FoodGroup, number>;
  waterCups: number;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  dairy: "Dairy (milk, cheese, yoghurt)", gluten: "Gluten (wheat, oats, barley, rye)", nuts: "Tree nuts and peanuts", eggs: "Eggs",
  soy: "Soy", fish: "Fish", shellfish: "Shellfish", sesame: "Sesame",
};
export const STYLE_LABELS: Record<EatingStyle, string> = { everything: "I eat most foods", pescatarian: "Pescatarian (fish, no meat)", vegetarian: "Vegetarian", vegan: "Vegan" };

export const GROUPS: { key: FoodGroup; label: string; goal: number; unit: string; example: string; color: string }[] = [
  { key: "veg", label: "Vegetables & legumes", goal: 5, unit: "serves", example: "A serve is about ½ cup cooked veg or 1 cup of salad", color: "var(--tile-sage-fg)" },
  { key: "fruit", label: "Fruit", goal: 2, unit: "serves", example: "A serve is 1 medium piece, or 1 cup chopped", color: "var(--tile-peach-fg)" },
  { key: "grains", label: "Wholegrains & cereals", goal: 5, unit: "serves", example: "A serve is 1 slice of bread or ½ cup cooked rice/pasta/oats", color: "var(--tile-sand-fg)" },
  { key: "protein", label: "Protein foods", goal: 3, unit: "serves", example: "A serve is about a palm-sized portion of meat, fish, tofu or 2 eggs, or ¾ cup legumes", color: "var(--tile-lav-fg)" },
  { key: "dairy", label: "Dairy & alternatives", goal: 3, unit: "serves", example: "A serve is 1 cup milk, 200 g yoghurt or 2 slices (40 g) cheese – calcium-fortified alternatives count", color: "var(--tile-sage-fg)" },
];
export const WATER_GOAL_CUPS = 8;
export const SERVES_MAX = 12;

export const emptyServes = (): Record<FoodGroup, number> => ({ veg: 0, fruit: 0, grains: 0, protein: 0, dairy: 0 });
export const defaultNutrition = (): NutritionPrefs => ({ enabled: false, style: "everything", avoid: [], avoidOther: "", showProteinGuide: true, updatedAt: "1970-01-01T00:00:00.000Z" });

/** A handy daily guide. Needs differ between people, so it is framed as a guide, never a pass/fail target. */
export function dailyGoals(isTrainingDay: boolean): Record<FoodGroup, number> {
  const g = Object.fromEntries(GROUPS.map((x) => [x.key, x.goal])) as Record<FoodGroup, number>;
  if (isTrainingDay) g.grains = g.grains + 1; // a little extra carbohydrate to fuel training
  return g;
}

/** 0–100 “variety” for the day: how much of the guide across the five food groups, each capped at 100%. */
export function varietyScore(log: Pick<NutritionLog, "serves"> | undefined, goals = dailyGoals(false)): number {
  if (!log) return 0;
  const parts = (Object.keys(goals) as FoodGroup[]).map((k) => Math.min(1, (log.serves[k] ?? 0) / goals[k]));
  return Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100);
}
export function varietyMessage(score: number, name: string): string {
  if (score === 0) return "Nothing logged yet – log whatever's easy, or skip it. No pressure.";
  if (score < 40) return `A good start, ${name}. Adding a vegetable or a protein food to your next meal is an easy win.`;
  if (score < 75) return `Nice variety building up, ${name}.`;
  return `Lovely variety today, ${name}. Your muscles will thank you.`;
}

// ------------------------------------------------------------------ protein guide
export type ProteinGuide =
  | { kind: "range"; minG: number; maxG: number; perMealG: [number, number]; basis: string }
  | { kind: "ask_professional"; reason: string }
  | { kind: "none" };

const MEDICAL_WORDS = /kidney|renal|dialysis|liver|diabet|gout|pregnan|breastfeed|eating disorder|anorex|bulim|coeliac|celiac|allerg/i;

/**
 * General protein information for people doing regular strength training (research range ≈ 1.2–1.6 g per kg per day).
 * Shown only when Jo supplied a weight, opted in, is an adult and has no flagged health notes – otherwise we point to a professional.
 */
export function proteinGuide(i: { weightKg?: number; dateOfBirth?: string; today: string; conditionsText: string; injuriesText?: string; hasRestrictions: boolean; showGuide: boolean }): ProteinGuide {
  if (!i.showGuide) return { kind: "none" };
  if (i.hasRestrictions || MEDICAL_WORDS.test(`${i.conditionsText} ${i.injuriesText ?? ""}`)) {
    return { kind: "ask_professional", reason: "Because you've mentioned a health condition or professional advice, please ask your doctor or an Accredited Practising Dietitian how much protein is right for you." };
  }
  if (i.dateOfBirth) {
    const age = (Date.parse(i.today) - Date.parse(i.dateOfBirth)) / (365.25 * 86400000);
    if (age < 18) return { kind: "ask_professional", reason: "Protein needs are different for young people. Please ask a doctor or dietitian." };
  }
  if (!i.weightKg) return { kind: "none" };
  const minG = Math.round((i.weightKg * 1.2) / 5) * 5, maxG = Math.round((i.weightKg * 1.6) / 5) * 5;
  return { kind: "range", minG, maxG, perMealG: [Math.round(minG / 4 / 5) * 5, Math.round(maxG / 3 / 5) * 5], basis: "A commonly used range for adults who strength train regularly is about 1.2–1.6 g per kg of body weight per day. It's a guide, not a target to hit exactly." };
}

// ------------------------------------------------------------------ safety
export type NutritionSafety = { level: "standard" | "consult"; message: string | null };
/** Nutrition advice is general. If Jo has told us about health notes or restrictions, we ask her to involve a professional. */
export function nutritionSafety(i: { conditionsText: string; hasRestrictions: boolean; clearanceRecommended: boolean }): NutritionSafety {
  if (i.hasRestrictions || i.clearanceRecommended || MEDICAL_WORDS.test(i.conditionsText)) {
    return { level: "consult", message: "You've told us about health notes or professional advice. Before changing how you eat, please check with your doctor or an Accredited Practising Dietitian (dietitiansaustralia.org.au). The ideas here are general only." };
  }
  return { level: "standard", message: null };
}
export const GENERAL_DISCLAIMER = "General information only – not medical or dietitian advice. For allergies, medical conditions, pregnancy or special diets, see your GP or an Accredited Practising Dietitian.";
export const SUPPORT_LINE = "If thinking about food or your body ever feels stressful or out of control, please talk to your GP. The Butterfly National Helpline is free on 1800 33 4673 (1800 ED HOPE).";

// ------------------------------------------------------------------ meal ideas
export interface Meal {
  id: string; name: string; type: MealType; blurb: string; ingredients: string[]; animal: Animal[]; contains: Allergen[];
  groups: FoodGroup[]; proteinServes: number; prepMinutes: number; why: string; fuel?: "before" | "after";
}
const m = (x: Meal): Meal => x;
export const MEALS: Meal[] = [
  // Breakfast
  m({ id: "overnight-oats", name: "Berry overnight oats", type: "breakfast", blurb: "Rolled oats soaked in milk with yoghurt and berries.", ingredients: ["rolled oats", "milk", "Greek yoghurt", "berries", "chia seeds"], animal: ["dairy"], contains: ["dairy", "gluten"], groups: ["grains", "dairy", "fruit"], proteinServes: 1, prepMinutes: 5, why: "Make it the night before. Wholegrain carbs plus protein from yoghurt." }),
  m({ id: "veg-omelette", name: "Veggie omelette with toast", type: "breakfast", blurb: "Eggs with spinach, tomato and capsicum, with wholegrain toast.", ingredients: ["eggs", "spinach", "tomato", "capsicum", "wholegrain bread"], animal: ["egg"], contains: ["eggs", "gluten"], groups: ["protein", "veg", "grains"], proteinServes: 1, prepMinutes: 10, why: "Eggs are a complete protein; the veg adds fibre and colour." }),
  m({ id: "tofu-scramble", name: "Tofu scramble on toast", type: "breakfast", blurb: "Crumbled tofu with turmeric, mushrooms and spinach.", ingredients: ["firm tofu", "mushrooms", "spinach", "turmeric", "wholegrain bread"], animal: [], contains: ["soy", "gluten"], groups: ["protein", "veg", "grains"], proteinServes: 1, prepMinutes: 12, why: "A plant-based, protein-rich start to the day." }),
  m({ id: "yoghurt-bowl", name: "Yoghurt, fruit and nut bowl", type: "breakfast", blurb: "Greek yoghurt with banana, berries and a handful of nuts.", ingredients: ["Greek yoghurt", "banana", "berries", "almonds"], animal: ["dairy"], contains: ["dairy", "nuts"], groups: ["dairy", "fruit", "protein"], proteinServes: 1, prepMinutes: 3, why: "Quick, no cooking, good protein and calcium." }),
  m({ id: "soy-porridge", name: "Soy milk porridge with banana", type: "breakfast", blurb: "Creamy oat porridge made with calcium-fortified soy milk.", ingredients: ["rolled oats", "fortified soy milk", "banana", "cinnamon"], animal: [], contains: ["soy", "gluten"], groups: ["grains", "dairy", "fruit"], proteinServes: 0.5, prepMinutes: 8, why: "Warm and filling; fortified soy milk counts as a dairy alternative." }),
  m({ id: "bean-toast", name: "Baked beans on wholegrain toast", type: "breakfast", blurb: "Reduced-salt baked beans with a side of tomato.", ingredients: ["baked beans", "wholegrain bread", "tomato"], animal: [], contains: ["gluten"], groups: ["veg", "grains", "protein"], proteinServes: 1, prepMinutes: 5, why: "Cheap, quick and high in fibre and plant protein." }),
  m({ id: "smoked-salmon-toast", name: "Smoked salmon and avocado toast", type: "breakfast", blurb: "Wholegrain toast, avocado, smoked salmon and cucumber.", ingredients: ["wholegrain bread", "avocado", "smoked salmon", "cucumber"], animal: ["fish"], contains: ["fish", "gluten"], groups: ["grains", "protein", "veg"], proteinServes: 1, prepMinutes: 5, why: "Omega-3 fats from fish with wholegrain carbs." }),
  m({ id: "coconut-chia-pudding", name: "Coconut chia pudding", type: "breakfast", blurb: "Chia seeds set in fortified coconut or oat-free milk, topped with mango.", ingredients: ["chia seeds", "fortified coconut milk drink", "mango"], animal: [], contains: [], groups: ["fruit", "dairy"], proteinServes: 0.5, prepMinutes: 5, why: "Make-ahead and no cooking needed." }),
  // Lunch
  m({ id: "chicken-wrap", name: "Chicken and salad wrap", type: "lunch", blurb: "Wholemeal wrap with sliced chicken, lettuce, tomato and hummus.", ingredients: ["wholemeal wrap", "cooked chicken", "lettuce", "tomato", "hummus"], animal: ["meat"], contains: ["gluten", "sesame"], groups: ["protein", "veg", "grains"], proteinServes: 1, prepMinutes: 8, why: "Lean protein plus wholegrains in one hand-held meal." }),
  m({ id: "tuna-salad", name: "Tuna and three-bean salad", type: "lunch", blurb: "Canned tuna, mixed beans, cherry tomatoes and rocket with olive oil.", ingredients: ["tuna in springwater", "mixed beans", "cherry tomatoes", "rocket", "olive oil"], animal: ["fish"], contains: ["fish"], groups: ["protein", "veg"], proteinServes: 1.5, prepMinutes: 7, why: "A big protein hit from pantry staples." }),
  m({ id: "lentil-soup", name: "Hearty lentil and veg soup", type: "lunch", blurb: "Red lentils, carrot, celery and tomato, served with a slice of wholegrain bread.", ingredients: ["red lentils", "carrot", "celery", "tomato", "wholegrain bread"], animal: [], contains: ["gluten"], groups: ["protein", "veg", "grains"], proteinServes: 1, prepMinutes: 30, why: "Batch-cook and freeze. High in fibre and plant protein." }),
  m({ id: "egg-sandwich", name: "Egg and salad sandwich", type: "lunch", blurb: "Boiled egg, lettuce, cucumber and mustard on wholegrain bread.", ingredients: ["eggs", "wholegrain bread", "lettuce", "cucumber"], animal: ["egg"], contains: ["eggs", "gluten"], groups: ["protein", "grains", "veg"], proteinServes: 1, prepMinutes: 10, why: "Simple and satisfying." }),
  m({ id: "chickpea-bowl", name: "Roast chickpea and veg bowl", type: "lunch", blurb: "Roasted chickpeas, pumpkin and kale over brown rice with lemon dressing.", ingredients: ["chickpeas", "pumpkin", "kale", "brown rice", "lemon"], animal: [], contains: [], groups: ["protein", "veg", "grains"], proteinServes: 1, prepMinutes: 30, why: "Easy to meal-prep and keeps well." }),
  m({ id: "ham-cheese-toastie", name: "Ham, cheese and tomato toastie", type: "lunch", blurb: "Wholegrain toastie with lean ham, cheese and tomato, plus a side salad.", ingredients: ["wholegrain bread", "lean ham", "cheese", "tomato", "salad leaves"], animal: ["meat", "dairy"], contains: ["gluten", "dairy"], groups: ["grains", "protein", "dairy", "veg"], proteinServes: 1, prepMinutes: 8, why: "A comfortable classic with calcium and protein." }),
  m({ id: "tofu-noodle", name: "Tofu and veg noodle salad", type: "lunch", blurb: "Rice noodles, baked tofu, shredded cabbage, carrot and lime.", ingredients: ["rice noodles", "baked tofu", "cabbage", "carrot", "lime"], animal: [], contains: ["soy"], groups: ["protein", "veg", "grains"], proteinServes: 1, prepMinutes: 15, why: "Plant-based, fresh and quick." }),
  // Dinner
  m({ id: "salmon-tray", name: "Salmon and veg tray bake", type: "dinner", blurb: "Baked salmon with sweet potato, broccoli and green beans.", ingredients: ["salmon fillet", "sweet potato", "broccoli", "green beans", "olive oil"], animal: ["fish"], contains: ["fish"], groups: ["protein", "veg", "grains"], proteinServes: 1.5, prepMinutes: 30, why: "One tray, little washing up; omega-3 fats and plenty of veg.", fuel: "after" }),
  m({ id: "beef-stirfry", name: "Lean beef and veg stir-fry", type: "dinner", blurb: "Beef strips, capsicum, bok choy and broccoli with brown rice.", ingredients: ["lean beef strips", "capsicum", "bok choy", "broccoli", "brown rice", "soy sauce"], animal: ["meat"], contains: ["soy", "gluten"], groups: ["protein", "veg", "grains"], proteinServes: 1.5, prepMinutes: 20, why: "Red meat is a good source of iron and zinc.", fuel: "after" }),
  m({ id: "chicken-traybake", name: "Lemon chicken with roast veg", type: "dinner", blurb: "Chicken thighs with potato, zucchini and red onion.", ingredients: ["chicken thighs", "potato", "zucchini", "red onion", "lemon"], animal: ["meat"], contains: [], groups: ["protein", "veg", "grains"], proteinServes: 1.5, prepMinutes: 35, why: "Leftovers make tomorrow's lunch.", fuel: "after" }),
  m({ id: "dahl", name: "Red lentil dahl with rice", type: "dinner", blurb: "Spiced red lentils with spinach, served over brown rice.", ingredients: ["red lentils", "spinach", "tomato", "brown rice", "spices"], animal: [], contains: [], groups: ["protein", "veg", "grains"], proteinServes: 1, prepMinutes: 30, why: "Budget-friendly and rich in fibre, iron and plant protein.", fuel: "after" }),
  m({ id: "turkey-bolognese", name: "Turkey mince bolognese", type: "dinner", blurb: "Turkey mince, grated veg and tomato over wholemeal pasta.", ingredients: ["turkey mince", "carrot", "zucchini", "tinned tomatoes", "wholemeal pasta"], animal: ["meat"], contains: ["gluten"], groups: ["protein", "veg", "grains"], proteinServes: 1.5, prepMinutes: 30, why: "Hidden veg in a family favourite.", fuel: "after" }),
  m({ id: "tofu-curry", name: "Tofu and chickpea coconut curry", type: "dinner", blurb: "Tofu, chickpeas and cauliflower in a mild coconut sauce with basmati rice.", ingredients: ["firm tofu", "chickpeas", "cauliflower", "light coconut milk", "basmati rice"], animal: [], contains: ["soy"], groups: ["protein", "veg", "grains"], proteinServes: 1.5, prepMinutes: 30, why: "A satisfying plant-based dinner.", fuel: "after" }),
  m({ id: "prawn-zoodles", name: "Garlic prawn and veg rice bowl", type: "dinner", blurb: "Prawns, snow peas and capsicum over steamed rice.", ingredients: ["prawns", "snow peas", "capsicum", "rice", "garlic"], animal: ["fish"], contains: ["shellfish"], groups: ["protein", "veg", "grains"], proteinServes: 1.5, prepMinutes: 15, why: "Quick, light and high in protein.", fuel: "after" }),
  m({ id: "bean-chilli", name: "Three-bean chilli with avocado", type: "dinner", blurb: "Mixed beans, tomato and corn, topped with avocado, served with rice.", ingredients: ["mixed beans", "tinned tomatoes", "corn", "avocado", "rice"], animal: [], contains: [], groups: ["protein", "veg", "grains"], proteinServes: 1, prepMinutes: 25, why: "Freezer-friendly and filling.", fuel: "after" }),
  // Snacks
  m({ id: "banana-pb", name: "Banana with peanut butter", type: "snack", blurb: "A banana with a spoonful of 100% peanut butter.", ingredients: ["banana", "peanut butter"], animal: [], contains: ["nuts"], groups: ["fruit", "protein"], proteinServes: 0.5, prepMinutes: 2, why: "Carbs plus a little protein – a good pre-workout snack if you're hungry.", fuel: "before" }),
  m({ id: "yoghurt-fruit", name: "Yoghurt and fruit pot", type: "snack", blurb: "Plain yoghurt with sliced apple or pear.", ingredients: ["plain yoghurt", "apple"], animal: ["dairy"], contains: ["dairy"], groups: ["dairy", "fruit"], proteinServes: 0.5, prepMinutes: 2, why: "Protein and calcium; works well after training.", fuel: "after" }),
  m({ id: "boiled-eggs", name: "Boiled eggs and cherry tomatoes", type: "snack", blurb: "Two boiled eggs with cherry tomatoes and a pinch of pepper.", ingredients: ["eggs", "cherry tomatoes"], animal: ["egg"], contains: ["eggs"], groups: ["protein", "veg"], proteinServes: 1, prepMinutes: 10, why: "Portable protein.", fuel: "after" }),
  m({ id: "hummus-veg", name: "Hummus with veggie sticks", type: "snack", blurb: "Carrot, cucumber and capsicum sticks with hummus.", ingredients: ["hummus", "carrot", "cucumber", "capsicum"], animal: [], contains: ["sesame"], groups: ["veg", "protein"], proteinServes: 0.5, prepMinutes: 5, why: "Crunchy, fibre-rich and plant-based." }),
  m({ id: "edamame", name: "Edamame with sea salt", type: "snack", blurb: "Steamed edamame pods.", ingredients: ["edamame"], animal: [], contains: ["soy"], groups: ["protein", "veg"], proteinServes: 1, prepMinutes: 5, why: "A surprisingly high-protein plant snack.", fuel: "after" }),
  m({ id: "fruit-nuts", name: "Fruit and a handful of nuts", type: "snack", blurb: "A piece of fruit with a small handful of unsalted nuts.", ingredients: ["apple", "unsalted almonds", "walnuts"], animal: [], contains: ["nuts"], groups: ["fruit", "protein"], proteinServes: 0.5, prepMinutes: 1, why: "Easy to carry. Nuts add healthy fats." }),
  m({ id: "rice-cakes-tuna", name: "Rice cakes with tuna and cucumber", type: "snack", blurb: "Wholegrain rice cakes topped with tuna and cucumber.", ingredients: ["wholegrain rice cakes", "tuna in springwater", "cucumber"], animal: ["fish"], contains: ["fish"], groups: ["grains", "protein"], proteinServes: 1, prepMinutes: 4, why: "Light, protein-rich and quick.", fuel: "after" }),
  m({ id: "milk-banana-smoothie", name: "Milk and banana smoothie", type: "snack", blurb: "Milk, banana and a spoon of oats blended.", ingredients: ["milk", "banana", "rolled oats"], animal: ["dairy"], contains: ["dairy", "gluten"], groups: ["dairy", "fruit", "grains"], proteinServes: 0.5, prepMinutes: 4, why: "Drinkable fuel for after a session when you're not very hungry.", fuel: "after" }),
  m({ id: "soy-latte-fruit", name: "Fortified soy smoothie with berries", type: "snack", blurb: "Calcium-fortified soy milk blended with frozen berries.", ingredients: ["fortified soy milk", "frozen berries"], animal: [], contains: ["soy"], groups: ["dairy", "fruit"], proteinServes: 0.5, prepMinutes: 3, why: "Plant-based and refreshing.", fuel: "after" }),
  m({ id: "popcorn-seeds", name: "Air-popped popcorn and pepitas", type: "snack", blurb: "Plain popcorn with a sprinkle of pumpkin seeds.", ingredients: ["popping corn", "pepitas"], animal: [], contains: [], groups: ["grains"], proteinServes: 0.5, prepMinutes: 5, why: "A simple wholegrain snack." }),
];

function allowedByStyle(meal: Meal, style: EatingStyle): boolean {
  const a = new Set(meal.animal);
  if (style === "vegan") return a.size === 0;
  if (style === "vegetarian") return !a.has("meat") && !a.has("fish");
  if (style === "pescatarian") return !a.has("meat");
  return true;
}
/** Meals compatible with Jo's eating style and keep-out list. A meal containing ANY avoided allergen is never returned. */
export function eligibleMeals(prefs: Pick<NutritionPrefs, "style" | "avoid">, type?: MealType): Meal[] {
  return MEALS.filter((x) => (!type || x.type === type) && allowedByStyle(x, prefs.style) && !x.contains.some((c) => prefs.avoid.includes(c)));
}
function hash(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
/** Deterministic daily pick (stable through the day, varies across days). */
export function suggestMeals(prefs: Pick<NutritionPrefs, "style" | "avoid">, type: MealType, seed: string, count = 3): Meal[] {
  const pool = eligibleMeals(prefs, type).sort((a, b) => a.id.localeCompare(b.id));
  if (!pool.length) return [];
  const start = hash(seed + type) % pool.length;
  return Array.from({ length: Math.min(count, pool.length) }, (_, i) => pool[(start + i) % pool.length]!);
}
export function postWorkoutIdeas(prefs: Pick<NutritionPrefs, "style" | "avoid">, seed: string): Meal[] {
  const pool = eligibleMeals(prefs).filter((x) => x.fuel === "after").sort((a, b) => a.id.localeCompare(b.id));
  const start = hash(seed) % Math.max(1, pool.length);
  return Array.from({ length: Math.min(2, pool.length) }, (_, i) => pool[(start + i) % pool.length]!);
}

// ------------------------------------------------------------------ learn cards (calm, factual, no promises)
export const LEARN: { id: string; title: string; body: string }[] = [
  { id: "protein-spread", title: "Protein with each meal", body: "Muscles are built from the training you do plus enough protein overall. Spreading protein across your meals and snacks – rather than one big serve – is a simple habit that works well. Think eggs, dairy, fish, chicken, lean meat, tofu, tempeh, legumes or nuts at most meals." },
  { id: "plate", title: "A balanced plate", body: "Roughly half your plate vegetables and salad, about a quarter protein food, and about a quarter wholegrain carbohydrate such as brown rice, wholemeal pasta, potato or wholegrain bread. A little healthy fat – olive oil, avocado, nuts – rounds it out." },
  { id: "carbs", title: "Carbohydrates are fuel", body: "Wholegrain carbohydrates give you energy for training and help recovery. You don't need to avoid them. Having something with carbohydrate and a little protein a couple of hours before a session can help if you tend to feel flat." },
  { id: "water", title: "Drinking enough", body: "Water is the best everyday drink. Needs vary with the weather, how much you sweat and your health, so use thirst and pale-yellow wee as a guide. Sip during your session if you like." },
  { id: "calcium", title: "Calcium and vitamin D for strong bones", body: "Strength training and calcium-rich foods (dairy or fortified alternatives, canned fish with bones, tofu set with calcium, leafy greens) support bone health. Sensible sun exposure helps vitamin D; ask your GP if you're unsure about your levels." },
  { id: "plant", title: "If you eat mostly plants", body: "Combine legumes, tofu, tempeh, wholegrains, nuts and seeds through the day. Vegans need a reliable source of vitamin B12 (fortified foods or a supplement) – a GP or Accredited Practising Dietitian can advise. Iron from plants is absorbed better with vitamin C foods such as citrus or capsicum." },
  { id: "fibre", title: "Fibre and gut comfort", body: "Vegetables, fruit, legumes and wholegrains provide fibre. Increase it gradually and drink water as you go." },
  { id: "flexible", title: "Flexibility is part of healthy eating", body: "No single food or meal makes or breaks your progress. Enjoying food with other people, treats included, is part of a healthy relationship with eating." },
];

/** Words we never use: keeps the tone encouraging and weight-neutral. Verified in tests across every string in this module. */
export const BANNED_TONE = /\b(lose weight|weight loss|fat burn|burn fat|diet plan|cheat|guilt|bad food|good food|clean eating|junk|detox|slim|skinny|calorie deficit|starve|punish)\b/i;
