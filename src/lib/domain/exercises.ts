import type { BodyArea, Difficulty, Exercise, ExerciseCategory, LoadType, Requirement } from "./types";

const NO_MEDIA = {
  kind: "none" as const,
  note: "No demonstration video has been approved for this exercise yet. Follow the written steps below.",
};

interface Def {
  id: string; name: string; category: ExerciseCategory; description: string; muscles: string[];
  requires?: Requirement[]; difficulty: Difficulty; loadType?: LoadType; perSide?: boolean;
  start: string; steps: string[]; breathing?: string; mistakes: string[]; safety: string[];
  reps: [number, number]; sets?: number; rest?: number; up?: string[]; down?: string[]; cautions?: BodyArea[];
}

const BREATH = "Breathe out as you make the effort and in as you return. Never hold your breath.";

function ex(d: Def): Exercise {
  return {
    id: d.id, name: d.name, category: d.category, description: d.description, muscles: d.muscles,
    requires: d.requires ?? [], difficulty: d.difficulty, loadType: d.loadType ?? "bodyweight",
    perSide: d.perSide ?? false, startingPosition: d.start, steps: d.steps,
    breathing: d.breathing ?? BREATH, commonMistakes: d.mistakes, safetyNotes: d.safety,
    repRange: d.reps, sets: d.sets ?? 2, restSeconds: d.rest ?? 60,
    progressions: d.up ?? [], regressions: d.down ?? [], cautions: d.cautions ?? [], media: NO_MEDIA,
  };
}

const STOP = "Stop and rest if you feel sharp, pinching or unusual pain.";

export const EXERCISES: Exercise[] = [
  // ---------------- Lower body ----------------
  ex({ id: "chair-squat", name: "Chair Squat", category: "lower_body", requires: ["chair"], difficulty: 1,
    description: "Sit down to a sturdy chair and stand back up with control. It trains the movement you use every day.",
    muscles: ["Quadriceps", "Glutes"],
    start: "Stand in front of a sturdy chair, feet about hip-width apart, toes slightly out. Arms forward or crossed.",
    steps: ["Push your hips back as if about to sit.", "Lower slowly until you lightly touch the seat.", "Press through your whole foot to stand tall.", "Squeeze your glutes at the top."],
    mistakes: ["Dropping onto the chair", "Knees falling inwards", "Leaning far forward"],
    safety: ["Place the chair against a wall so it cannot slide.", STOP], reps: [8, 12], up: ["bodyweight-squat"], down: ["sit-to-stand-hands"], cautions: ["knee"] }),
  ex({ id: "sit-to-stand-hands", name: "Supported Sit-to-Stand", category: "lower_body", requires: ["chair"], difficulty: 1,
    description: "A gentler squat using your hands on the chair arms or thighs for help.",
    muscles: ["Quadriceps", "Glutes"], start: "Sit tall near the front of a sturdy chair, feet flat and hip-width apart.",
    steps: ["Lean slightly forward.", "Use your hands on thighs or armrests to help as needed.", "Stand up fully.", "Sit back slowly."],
    mistakes: ["Using momentum", "Rushing the way down"], safety: ["Make sure the chair is stable.", STOP], reps: [6, 10], up: ["chair-squat"] }),
  ex({ id: "bodyweight-squat", name: "Bodyweight Squat", category: "lower_body", difficulty: 2,
    description: "A full squat without a chair, building control and strength.", muscles: ["Quadriceps", "Glutes", "Core"],
    start: "Stand with feet shoulder-width apart, toes slightly out, chest proud.",
    steps: ["Push hips back and bend your knees.", "Lower until thighs are near parallel, or as far as is comfortable.", "Press through your feet to stand."],
    mistakes: ["Heels lifting", "Knees collapsing inwards", "Rounding the back"], safety: ["Keep a chair behind you as a safety net.", STOP],
    reps: [8, 12], up: ["goblet-squat"], down: ["chair-squat"], cautions: ["knee"] }),
  ex({ id: "goblet-squat", name: "Goblet Squat", category: "lower_body", requires: ["dumbbells"], difficulty: 3, loadType: "dumbbell",
    description: "A squat holding one dumbbell at your chest, which helps keep your torso upright.", muscles: ["Quadriceps", "Glutes", "Core"],
    start: "Hold one dumbbell vertically against your chest with both hands. Feet shoulder-width apart.",
    steps: ["Brace your tummy gently.", "Squat down between your knees.", "Keep the weight close to your chest.", "Stand tall."],
    mistakes: ["Letting the dumbbell drift forward", "Rounding the back"], safety: ["Start very light.", STOP],
    reps: [8, 12], down: ["bodyweight-squat"], cautions: ["knee", "back"] }),
  ex({ id: "supported-low-step-up", name: "Supported Low Step-Up", category: "lower_body", requires: ["step"], difficulty: 2,
    description: "Step onto a low step while holding a wall or chair for balance.", muscles: ["Quadriceps", "Glutes", "Balance"], perSide: true,
    start: "Stand facing a low, stable step. Rest one hand lightly on a wall or chair back.",
    steps: ["Place your whole foot on the step.", "Press through that heel to stand up.", "Lower the other foot back slowly.", "Complete all reps, then switch legs."],
    mistakes: ["Pushing off the back foot", "Leaning heavily on the support"], safety: ["Use a low, non-slip step.", STOP],
    reps: [6, 10], up: ["step-up"], down: ["split-squat-supported"], cautions: ["knee", "balance"] }),
  ex({ id: "step-up", name: "Step-Up", category: "lower_body", requires: ["step"], difficulty: 3, loadType: "dumbbell", perSide: true,
    description: "A step-up with little or no hand support; add light dumbbells when ready.", muscles: ["Quadriceps", "Glutes", "Balance"],
    start: "Stand facing a stable step, dumbbells (if used) by your sides.", steps: ["Step up with control.", "Stand tall on top.", "Lower slowly."],
    mistakes: ["Rushing", "Using momentum"], safety: [STOP], reps: [6, 10], down: ["supported-low-step-up"], cautions: ["knee", "balance"] }),
  ex({ id: "split-squat-supported", name: "Supported Split Squat", category: "lower_body", requires: ["chair"], difficulty: 2, perSide: true,
    description: "A small lunge position holding a chair for balance.", muscles: ["Quadriceps", "Glutes"],
    start: "Hold a chair back. Step one foot back into a staggered stance.", steps: ["Bend both knees to lower a short way.", "Keep your torso upright.", "Press up through the front foot."],
    mistakes: ["Stance too short", "Front knee drifting in"], safety: ["Only lower as far as is comfortable.", STOP],
    reps: [6, 10], up: ["supported-low-step-up"], cautions: ["knee"] }),
  ex({ id: "calf-raise-supported", name: "Supported Calf Raise", category: "lower_body", difficulty: 1,
    description: "Rise onto your toes holding a counter or chair. Great for walking and balance.", muscles: ["Calves"],
    start: "Stand tall holding a counter or chair back, feet hip-width apart.", steps: ["Rise slowly onto the balls of your feet.", "Pause briefly at the top.", "Lower slowly."],
    mistakes: ["Bouncing", "Rolling the ankles outwards"], safety: [STOP], reps: [10, 15], up: ["single-leg-calf-raise"] }),
  ex({ id: "single-leg-calf-raise", name: "Single-Leg Calf Raise", category: "lower_body", difficulty: 3, perSide: true,
    description: "A calf raise on one leg with light fingertip support.", muscles: ["Calves", "Balance"],
    start: "Hold a counter lightly. Lift one foot slightly off the floor.", steps: ["Rise onto the toes of the standing leg.", "Lower slowly."],
    mistakes: ["Leaning on the support"], safety: [STOP], reps: [8, 12], down: ["calf-raise-supported"], cautions: ["balance"] }),
  ex({ id: "wall-sit", name: "Wall Sit", category: "lower_body", difficulty: 2, loadType: "timed",
    description: "Hold a gentle seated position against a wall to build leg endurance.", muscles: ["Quadriceps", "Glutes"],
    start: "Lean your back against a wall, feet a step forward and hip-width apart.", steps: ["Slide down a short way – only as low as feels comfortable.", "Hold, breathing steadily.", "Slide back up."],
    breathing: "Breathe slowly and steadily throughout the hold.", mistakes: ["Going too deep", "Holding your breath"], safety: [STOP], reps: [15, 30], down: ["chair-squat"], cautions: ["knee"] }),

  // ---------------- Upper push ----------------
  ex({ id: "wall-push-up", name: "Wall Push-Up", category: "upper_push", difficulty: 1,
    description: "A push-up against a wall – a comfortable way to learn the movement.", muscles: ["Chest", "Triceps", "Shoulders"],
    start: "Stand an arm's length from a wall. Hands on the wall at chest height, slightly wider than shoulders.",
    steps: ["Keep your body in one straight line.", "Bend your elbows and bring your chest towards the wall.", "Press away until your arms are straight."],
    mistakes: ["Sagging hips", "Elbows flaring wide", "Head poking forward"], safety: [STOP], reps: [8, 12], up: ["incline-push-up"], cautions: ["shoulder", "wrist"] }),
  ex({ id: "incline-push-up", name: "Incline Push-Up", category: "upper_push", difficulty: 2, requires: ["chair"],
    description: "Hands on a sturdy surface (a chair seat or sofa edge) to make a push-up more manageable.", muscles: ["Chest", "Triceps", "Shoulders", "Core"],
    start: "Hands on the edge of a stable chair, body in a straight line, feet back.", steps: ["Lower your chest towards the chair.", "Keep elbows about 45° from your body.", "Press back up."],
    mistakes: ["Hips sagging", "Chair sliding"], safety: ["Brace the chair against a wall.", STOP], reps: [6, 12], up: ["floor-push-up"], down: ["wall-push-up"], cautions: ["shoulder", "wrist"] }),
  ex({ id: "floor-push-up", name: "Floor Push-Up", category: "upper_push", difficulty: 3, requires: ["mat"],
    description: "The classic push-up on the floor (knees down is a perfectly good option).", muscles: ["Chest", "Triceps", "Shoulders", "Core"],
    start: "Hands under shoulders on a mat, body straight from head to knees or heels.", steps: ["Lower with control.", "Press back up."],
    mistakes: ["Sagging hips", "Shrugged shoulders"], safety: [STOP], reps: [5, 10], down: ["incline-push-up"], cautions: ["shoulder", "wrist"] }),
  ex({ id: "seated-shoulder-press", name: "Seated Dumbbell Shoulder Press", category: "upper_push", requires: ["chair", "dumbbells"], difficulty: 2, loadType: "dumbbell",
    description: "Press light dumbbells overhead while seated with back support.", muscles: ["Shoulders", "Triceps"],
    start: "Sit tall on a sturdy chair with a back. Dumbbells at shoulder height, palms forward.",
    steps: ["Press the dumbbells up until arms are nearly straight.", "Lower slowly to shoulder height."],
    mistakes: ["Arching the lower back", "Shrugging", "Using too heavy a weight"], safety: ["Skip if overhead movement is uncomfortable – choose the band press or lateral raise instead.", STOP],
    reps: [8, 12], up: ["standing-shoulder-press"], down: ["band-shoulder-press"], cautions: ["shoulder", "back"] }),
  ex({ id: "band-shoulder-press", name: "Band Shoulder Press", category: "upper_push", requires: ["chair", "bands"], difficulty: 1, loadType: "band",
    description: "An overhead press using a resistance band under your feet or seat.", muscles: ["Shoulders", "Triceps"],
    start: "Sit tall; anchor the band under your feet. Hold the ends at shoulder height.", steps: ["Press up smoothly.", "Lower slowly."],
    mistakes: ["Band slipping", "Arching the back"], safety: ["Check the band for tears before each use.", STOP], reps: [8, 12], up: ["seated-shoulder-press"], cautions: ["shoulder"] }),
  ex({ id: "standing-shoulder-press", name: "Standing Dumbbell Shoulder Press", category: "upper_push", requires: ["dumbbells"], difficulty: 3, loadType: "dumbbell",
    description: "A standing overhead press that also challenges your core.", muscles: ["Shoulders", "Triceps", "Core"],
    start: "Stand tall, feet hip-width, dumbbells at shoulder height.", steps: ["Tighten your tummy gently.", "Press overhead.", "Lower with control."],
    mistakes: ["Leaning back", "Locking knees"], safety: [STOP], reps: [8, 12], down: ["seated-shoulder-press"], cautions: ["shoulder", "back"] }),
  ex({ id: "dumbbell-floor-press", name: "Dumbbell Floor Press", category: "upper_push", requires: ["mat", "dumbbells"], difficulty: 2, loadType: "dumbbell",
    description: "Press dumbbells upwards while lying on the floor; the floor limits the range to protect your shoulders.", muscles: ["Chest", "Triceps"],
    start: "Lie on a mat, knees bent, dumbbells held above your chest.", steps: ["Lower until your upper arms lightly touch the floor.", "Press back up."],
    mistakes: ["Dropping the weights", "Elbows flaring wide"], safety: [STOP], reps: [8, 12], down: ["incline-push-up"], cautions: ["shoulder"] }),
  ex({ id: "lateral-raise", name: "Lateral Raise", category: "upper_push", requires: ["dumbbells"], difficulty: 2, loadType: "dumbbell",
    description: "Lift light dumbbells out to the sides to the height of your shoulders.", muscles: ["Shoulders"],
    start: "Stand or sit tall, a light dumbbell in each hand by your sides, elbows slightly bent.", steps: ["Raise your arms out to the sides until about shoulder height.", "Lower slowly."],
    mistakes: ["Swinging", "Going too heavy", "Shrugging"], safety: ["Use very light weights.", STOP], reps: [8, 12], cautions: ["shoulder"] }),
  ex({ id: "triceps-extension", name: "Overhead Triceps Extension", category: "upper_push", requires: ["chair", "dumbbells"], difficulty: 2, loadType: "dumbbell",
    description: "Straighten your elbows with one dumbbell held behind your head.", muscles: ["Triceps"],
    start: "Sit tall, holding one dumbbell with both hands overhead (or lower it behind your head if overhead is uncomfortable).", steps: ["Bend elbows to lower the weight behind your head.", "Straighten your arms."],
    mistakes: ["Elbows flaring", "Arching the back"], safety: ["Skip if overhead positions are uncomfortable.", STOP], reps: [8, 12], cautions: ["shoulder"] }),

  // ---------------- Upper pull ----------------
  ex({ id: "supported-db-row", name: "Supported Dumbbell Row", category: "upper_pull", requires: ["chair", "dumbbells"], difficulty: 1, loadType: "dumbbell", perSide: true,
    description: "Rest one hand on a chair or bench and pull a dumbbell towards your hip.", muscles: ["Upper back", "Biceps"],
    start: "Stand beside a chair, one hand on the seat, a soft hinge at the hips, flat back. Dumbbell in the other hand, arm hanging.",
    steps: ["Pull the dumbbell towards your hip, leading with the elbow.", "Squeeze your shoulder blade gently.", "Lower slowly.", "Complete all reps, then switch sides."],
    mistakes: ["Twisting the torso", "Rushing", "Shrugging the shoulder"], safety: ["Keep your back long and neutral.", STOP], reps: [8, 12], up: ["bench-row"], down: ["band-row"], cautions: ["back"] }),
  ex({ id: "bench-row", name: "Bench-Supported Row", category: "upper_pull", requires: ["bench", "dumbbells"], difficulty: 2, loadType: "dumbbell", perSide: true,
    description: "A row with one knee and hand on a bench for stable back support.", muscles: ["Upper back", "Biceps"],
    start: "Place one knee and hand on a bench. Back flat, dumbbell hanging.", steps: ["Row to your hip.", "Lower slowly."],
    mistakes: ["Twisting", "Jerking the weight"], safety: [STOP], reps: [8, 12], down: ["supported-db-row"], cautions: ["back"] }),
  ex({ id: "band-row", name: "Seated Band Row", category: "upper_pull", requires: ["mat", "bands"], difficulty: 1, loadType: "band",
    description: "Pull a resistance band towards your tummy while seated.", muscles: ["Upper back", "Biceps"],
    start: "Sit on a mat with legs extended or knees slightly bent. Loop the band around your feet; hold the ends.",
    steps: ["Sit tall.", "Pull elbows back, squeezing your shoulder blades.", "Return slowly."], mistakes: ["Rounding the back", "Shrugging"], safety: ["Check the band for tears.", STOP], reps: [8, 12], up: ["supported-db-row"] }),
  ex({ id: "dumbbell-curl", name: "Dumbbell Bicep Curl", category: "upper_pull", requires: ["dumbbells"], difficulty: 1, loadType: "dumbbell",
    description: "Bend your elbows to lift dumbbells towards your shoulders.", muscles: ["Biceps"],
    start: "Sit or stand tall, dumbbells by your sides, palms forward.", steps: ["Keep elbows close to your sides.", "Curl the weights up.", "Lower slowly over about three seconds."],
    mistakes: ["Swinging the body", "Elbows drifting forward"], safety: [STOP], reps: [8, 12], up: ["hammer-curl"], down: ["band-curl"] }),
  ex({ id: "hammer-curl", name: "Hammer Curl", category: "upper_pull", requires: ["dumbbells"], difficulty: 2, loadType: "dumbbell",
    description: "A curl with palms facing each other, which also works your forearms.", muscles: ["Biceps", "Forearms"],
    start: "Stand or sit tall, dumbbells by your sides, palms facing in.", steps: ["Curl up keeping palms facing in.", "Lower slowly."], mistakes: ["Swinging", "Wrist bending"], safety: [STOP], reps: [8, 12], down: ["dumbbell-curl"] }),
  ex({ id: "band-curl", name: "Band Bicep Curl", category: "upper_pull", requires: ["bands"], difficulty: 1, loadType: "band",
    description: "A curl using a band under your feet.", muscles: ["Biceps"], start: "Stand on the band, ends in hands, palms forward.",
    steps: ["Curl up.", "Lower slowly."], mistakes: ["Swinging", "Band slipping"], safety: ["Check the band for tears.", STOP], reps: [8, 12], up: ["dumbbell-curl"] }),
  ex({ id: "band-pull-apart", name: "Band Pull-Apart", category: "upper_pull", requires: ["bands"], difficulty: 1, loadType: "band",
    description: "Open a band across your chest to strengthen the muscles that support good posture.", muscles: ["Rear shoulders", "Upper back"],
    start: "Hold a band in front of you at chest height, hands shoulder-width apart.", steps: ["Pull the band apart, squeezing your shoulder blades.", "Return slowly."],
    mistakes: ["Shrugging", "Arching the back"], safety: [STOP], reps: [10, 15], cautions: ["shoulder"] }),
  ex({ id: "reverse-fly", name: "Seated Reverse Fly", category: "upper_pull", requires: ["chair", "dumbbells"], difficulty: 2, loadType: "dumbbell",
    description: "Lean forward slightly and lift light dumbbells out to the sides for the muscles between your shoulder blades.", muscles: ["Rear shoulders", "Upper back"],
    start: "Sit near the front of a chair, hinge forward slightly with a flat back, dumbbells hanging.", steps: ["Raise the weights out to the sides with soft elbows.", "Lower slowly."],
    mistakes: ["Using heavy weights", "Rounding the back"], safety: ["Use very light weights.", STOP], reps: [8, 12], cautions: ["back"] }),

  // ---------------- Glutes & posterior chain ----------------
  ex({ id: "glute-bridge", name: "Glute Bridge", category: "glutes_posterior", requires: ["mat"], difficulty: 1,
    description: "Lift your hips from the floor to strengthen glutes and hamstrings.", muscles: ["Glutes", "Hamstrings"],
    start: "Lie on your back on a mat, knees bent, feet flat and hip-width apart, arms by your sides.", steps: ["Press through your heels.", "Lift your hips until shoulders, hips and knees form a line.", "Squeeze your glutes, then lower slowly."],
    mistakes: ["Over-arching the lower back", "Pushing through toes"], safety: [STOP], reps: [8, 12], up: ["loaded-glute-bridge"], down: [], cautions: ["back"] }),
  ex({ id: "loaded-glute-bridge", name: "Loaded Glute Bridge", category: "glutes_posterior", requires: ["mat", "dumbbells"], difficulty: 2, loadType: "dumbbell",
    description: "A bridge with a dumbbell resting on your hips.", muscles: ["Glutes", "Hamstrings"],
    start: "As for the glute bridge, with a dumbbell held across your hips.", steps: ["Lift hips, keeping the weight steady.", "Lower slowly."], mistakes: ["Arching the back", "Dumbbell rolling"], safety: ["Use a folded towel under the weight for comfort.", STOP], reps: [8, 12], up: ["single-leg-bridge"], down: ["glute-bridge"], cautions: ["back"] }),
  ex({ id: "single-leg-bridge", name: "Single-Leg Glute Bridge", category: "glutes_posterior", requires: ["mat"], difficulty: 3, perSide: true,
    description: "A bridge on one leg for extra challenge.", muscles: ["Glutes", "Hamstrings", "Core"],
    start: "As for the glute bridge, with one leg extended.", steps: ["Lift with the standing foot.", "Keep your hips level.", "Lower slowly."], mistakes: ["Hips twisting", "Arching"], safety: [STOP], reps: [6, 10], down: ["glute-bridge"], cautions: ["back"] }),
  ex({ id: "dumbbell-rdl", name: "Light Dumbbell Romanian Deadlift", category: "glutes_posterior", requires: ["dumbbells"], difficulty: 2, loadType: "dumbbell",
    description: "Hinge forward at the hips with dumbbells sliding down your thighs.", muscles: ["Hamstrings", "Glutes", "Lower back"],
    start: "Stand tall, feet hip-width apart, dumbbells in front of your thighs.", steps: ["Push your hips back, keeping knees softly bent.", "Slide the weights down your thighs with a long, flat back.", "Stop when you feel a stretch in the back of your legs.", "Squeeze your glutes to stand."],
    mistakes: ["Rounding the back", "Squatting instead of hinging", "Going too low"], safety: ["Go only as low as you can keep a flat back.", "Use light weights first.", STOP], reps: [8, 12], down: ["hip-hinge"], cautions: ["back"] }),
  ex({ id: "hip-hinge", name: "Hip Hinge (Bodyweight)", category: "glutes_posterior", difficulty: 1,
    description: "Practise the hinge pattern with no weight, hands on your hips.", muscles: ["Hamstrings", "Glutes"],
    start: "Stand tall, feet hip-width apart, hands on hips.", steps: ["Push hips back, knees softly bent.", "Tip forward with a flat back.", "Squeeze your glutes to stand."], mistakes: ["Rounding", "Knees bending too much"], safety: [STOP], reps: [8, 12], up: ["dumbbell-rdl"], cautions: ["back"] }),
  ex({ id: "clamshell", name: "Clamshell", category: "glutes_posterior", requires: ["mat"], difficulty: 1, perSide: true,
    description: "Lying on your side, open your top knee to strengthen the outer hip.", muscles: ["Outer glutes", "Hip stabilisers"],
    start: "Lie on your side on a mat, knees bent, feet together, head supported.", steps: ["Keep feet together.", "Lift your top knee without rolling back.", "Lower slowly."], mistakes: ["Rolling backwards", "Rushing"], safety: [STOP], reps: [10, 15], up: ["band-side-step"] }),
  ex({ id: "band-side-step", name: "Banded Side Step", category: "glutes_posterior", requires: ["bands"], difficulty: 2, loadType: "band",
    description: "Step sideways with a band around your thighs.", muscles: ["Outer glutes", "Hip stabilisers"],
    start: "Band just above your knees, knees slightly bent, hold a counter if needed.", steps: ["Step sideways with control.", "Keep tension on the band.", "Return the same way."], mistakes: ["Leaning", "Letting the band snap"], safety: [STOP], reps: [8, 12], cautions: ["balance", "knee"] }),

  // ---------------- Core ----------------
  ex({ id: "dead-bug", name: "Dead Bug", category: "core", requires: ["mat"], difficulty: 1, perSide: false,
    description: "Lying on your back, move opposite arm and leg while keeping your tummy steady.", muscles: ["Deep core"],
    start: "Lie on your back, arms up towards the ceiling, hips and knees bent at 90°.", steps: ["Gently press your lower back towards the floor.", "Lower opposite arm and leg slowly.", "Return and switch sides."],
    mistakes: ["Lower back arching", "Moving too fast"], safety: ["Make the range smaller if your back lifts.", STOP], reps: [6, 10], up: ["bird-dog"], down: ["marching-bridge-hold"], cautions: ["back"] }),
  ex({ id: "marching-bridge-hold", name: "Gentle Core Brace", category: "core", requires: ["mat"], difficulty: 1,
    description: "Lie with knees bent and practise gently tightening your deep tummy muscles while breathing.", muscles: ["Deep core"],
    start: "Lie on your back, knees bent, feet flat.", steps: ["Breathe in.", "As you breathe out, gently draw your belly button towards your spine.", "Hold for 3 breaths."], mistakes: ["Holding your breath", "Squeezing too hard"], safety: [STOP], reps: [6, 10], up: ["dead-bug"] }),
  ex({ id: "bird-dog", name: "Bird Dog", category: "core", requires: ["mat"], difficulty: 2,
    description: "On hands and knees, extend opposite arm and leg to train core and back stability.", muscles: ["Core", "Back stabilisers", "Glutes"],
    start: "On hands and knees, hands under shoulders, knees under hips, back flat.", steps: ["Extend one leg back and the opposite arm forward.", "Keep your hips level.", "Pause, then return and switch sides."],
    mistakes: ["Arching the back", "Hips tilting", "Rushing"], safety: ["Pad your knees with a folded mat if needed.", STOP], reps: [6, 10], down: ["dead-bug"], cautions: ["wrist", "back", "shoulder"] }),
  ex({ id: "wall-plank", name: "Wall Plank", category: "core", difficulty: 1, loadType: "timed",
    description: "A standing plank leaning into a wall.", muscles: ["Core", "Shoulders"],
    start: "Place forearms on a wall, body leaning in a straight line.", steps: ["Tighten your tummy and glutes gently.", "Hold, breathing steadily."], breathing: "Breathe steadily; don't hold your breath.", mistakes: ["Sagging hips"], safety: [STOP], reps: [15, 30], up: ["incline-plank"], cautions: ["shoulder"] }),
  ex({ id: "incline-plank", name: "Incline Plank", category: "core", requires: ["chair"], difficulty: 2, loadType: "timed",
    description: "A plank with forearms on a sturdy chair.", muscles: ["Core", "Shoulders"],
    start: "Forearms on a braced chair seat, body in a straight line.", steps: ["Tighten tummy and glutes.", "Hold."], breathing: "Breathe steadily.", mistakes: ["Hips sagging or piking"], safety: ["Brace the chair against a wall.", STOP], reps: [15, 30], down: ["wall-plank"], cautions: ["shoulder"] }),
  ex({ id: "pallof-press", name: "Band Pallof Press", category: "core", requires: ["bands"], difficulty: 2, loadType: "band", perSide: true,
    description: "Press a band away from your chest while resisting rotation.", muscles: ["Core", "Obliques"],
    start: "Anchor a band at chest height to a sturdy door anchor or post; stand side-on, hands at your chest.", steps: ["Press hands straight out.", "Resist the band twisting you.", "Return slowly."], mistakes: ["Twisting", "Leaning away"], safety: ["Use a secure anchor.", STOP], reps: [8, 12] }),
  ex({ id: "side-plank-knee", name: "Side Plank (Knees Bent)", category: "core", requires: ["mat"], difficulty: 2, loadType: "timed", perSide: true,
    description: "Hold your body in a line on your forearm, knees bent.", muscles: ["Obliques", "Hip stabilisers"],
    start: "Lie on your side on a mat, forearm under shoulder, knees bent.", steps: ["Lift your hips.", "Hold.", "Switch sides."], breathing: "Breathe steadily.", mistakes: ["Hips dropping", "Shoulder shrugging"], safety: [STOP], reps: [10, 25], cautions: ["shoulder"] }),

  // ---------------- Balance ----------------
  ex({ id: "single-leg-stand", name: "Single-Leg Stand", category: "balance", difficulty: 1, loadType: "timed", perSide: true,
    description: "Balance on one leg next to a counter for safety.", muscles: ["Hip stabilisers", "Ankles"],
    start: "Stand beside a counter with fingertips resting on it.", steps: ["Lift one foot a few centimetres.", "Hold steady.", "Lower and switch."], breathing: "Breathe normally.", mistakes: ["Gripping the support"], safety: ["Always keep a stable support within reach.", STOP], reps: [10, 30], sets: 2, rest: 30, cautions: ["balance"] }),
  ex({ id: "tandem-stand", name: "Tandem Stand", category: "balance", difficulty: 1, loadType: "timed",
    description: "Stand with one foot directly in front of the other.", muscles: ["Ankles", "Core"],
    start: "Stand beside a counter, one foot directly in front of the other, heel to toe.", steps: ["Hold the position.", "Switch feet."], breathing: "Breathe normally.", mistakes: ["Holding the support tightly"], safety: ["Keep support within reach.", STOP], reps: [15, 30], sets: 2, rest: 30, cautions: ["balance"] }),
  ex({ id: "heel-to-toe-walk", name: "Heel-to-Toe Walk", category: "balance", difficulty: 2,
    description: "Walk in a straight line placing each heel directly in front of the opposite toes.", muscles: ["Ankles", "Core"],
    start: "Stand beside a wall or counter at the start of a clear path.", steps: ["Step heel-to-toe.", "Look ahead.", "Walk about 10 steps and return."], mistakes: ["Looking down", "Rushing"], safety: ["Keep a wall within reach.", STOP], reps: [8, 12], sets: 2, rest: 30, cautions: ["balance"] }),

  // ---------------- Mobility ----------------
  ex({ id: "cat-cow", name: "Cat–Cow", category: "mobility", requires: ["mat"], difficulty: 1,
    description: "Gently move your spine between rounded and arched positions.", muscles: ["Spine", "Core"],
    start: "On hands and knees on a mat.", steps: ["Breathe in and gently lift your chest and tailbone.", "Breathe out and round your back.", "Move slowly and comfortably."], mistakes: ["Moving too far or fast"], safety: ["Stay within a comfortable range.", STOP], reps: [6, 10], sets: 1, rest: 20, cautions: ["wrist"] }),
  ex({ id: "thoracic-rotation", name: "Seated Upper-Back Rotation", category: "mobility", requires: ["chair"], difficulty: 1,
    description: "Gently twist your upper back while seated.", muscles: ["Upper back"],
    start: "Sit tall on a chair, arms crossed over your chest.", steps: ["Turn your upper body to one side.", "Return to centre and turn the other way."], mistakes: ["Twisting from the lower back"], safety: [STOP], reps: [6, 10], sets: 1, rest: 20 }),
  ex({ id: "hip-flexor-stretch", name: "Kneeling Hip Flexor Stretch", category: "mobility", requires: ["mat"], difficulty: 1, loadType: "timed", perSide: true,
    description: "A gentle stretch for the front of the hip.", muscles: ["Hip flexors"],
    start: "Half-kneel on a mat with a chair or wall nearby for support.", steps: ["Tuck your tailbone under.", "Gently shift forward until you feel a stretch.", "Hold, then switch."], breathing: "Breathe slowly.", mistakes: ["Arching the back"], safety: ["Pad your knee if needed.", STOP], reps: [20, 30], sets: 1, rest: 15, cautions: ["knee"] }),
  ex({ id: "shoulder-rolls", name: "Shoulder Rolls and Arm Circles", category: "mobility", difficulty: 1,
    description: "A gentle warm-up for shoulders and neck.", muscles: ["Shoulders", "Upper back"],
    start: "Stand or sit tall.", steps: ["Roll your shoulders backwards slowly.", "Reach arms out and make small circles."], mistakes: ["Rushing"], safety: ["Skip anything that pinches.", STOP], reps: [6, 10], sets: 1, rest: 15 }),
];

const byId = new Map(EXERCISES.map((e) => [e.id, e]));
export function getExercise(id: string): Exercise | undefined { return byId.get(id); }
export function mustExercise(id: string): Exercise {
  const e = byId.get(id);
  if (!e) throw new Error(`Unknown exercise: ${id}`);
  return e;
}
export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  lower_body: "Lower body", upper_push: "Upper body – pushing", upper_pull: "Upper body – pulling",
  glutes_posterior: "Glutes & posterior chain", core: "Core stability", balance: "Balance", mobility: "Mobility",
};

// ---------------------------------------------------------------- Admin-managed reference overrides
// Administrators maintain wording, activation and approved media in the database. The app applies them on top of
// the bundled library (which is always the offline fallback). Safety structure (equipment, cautions, ladders) is code-owned.
export interface ExerciseRow {
  id: string; name?: string; description?: string; starting_position?: string; steps?: string[]; breathing?: string;
  common_mistakes?: string[]; safety_notes?: string[]; active?: boolean;
}
export interface MediaRow { exercise_id: string; kind: "video" | "animation" | "image"; url: string; licence: string; approved: boolean; }
const INACTIVE = new Set<string>();
export const isInactive = (id: string) => INACTIVE.has(id);
export function applyExerciseOverrides(rows: ExerciseRow[], media: MediaRow[]): void {
  for (const r of rows) {
    const e = byId.get(r.id);
    if (!e) continue;
    if (r.name) e.name = r.name;
    if (r.description) e.description = r.description;
    if (r.starting_position) e.startingPosition = r.starting_position;
    if (r.steps?.length) e.steps = r.steps;
    if (r.breathing) e.breathing = r.breathing;
    if (r.common_mistakes?.length) e.commonMistakes = r.common_mistakes;
    if (r.safety_notes?.length) e.safetyNotes = r.safety_notes;
    if (r.active === false) INACTIVE.add(r.id); else INACTIVE.delete(r.id);
  }
  for (const m of media) {
    const e = byId.get(m.exercise_id);
    // Only approved, https, licensed media is ever displayed.
    if (e && m.approved && m.url.startsWith("https://") && m.licence) e.media = { kind: m.kind, url: m.url, licence: m.licence, approved: true };
  }
}
