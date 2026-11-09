// Warm, varied, outcome-neutral messages. Deterministic by seed so tests are stable and the UI doesn't flicker.

function hash(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
export function pick<T>(items: T[], seed: string): T { return items[hash(seed) % items.length]!; }

export function greeting(name: string, hour: number): string {
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return `${part}, ${name}!`;
}

export function weekSummary(name: string, completed: number, planned: number, seed: string): string {
  if (completed === 0) {
    return pick([
      `A fresh week is ahead of you, ${name}. Start whenever you're ready.`,
      `Nothing needs to be perfect, ${name}. One session at a time.`,
      `Your plan is ready when you are, ${name}.`,
    ], seed);
  }
  const words = ["no", "one", "two", "three", "four", "five", "six", "seven"];
  const w = (completed <= 7 ? words[completed] : undefined) ?? String(completed);
  const noun = completed === 1 ? "workout" : "workouts";
  if (planned > 0 && completed >= planned) {
    return pick([
      `You've completed ${w} ${noun} this week – all planned sessions done. Lovely work.`,
      `That's ${w} ${noun} this week, ${name}, and your plan is complete. Enjoy the rest.`,
    ], seed);
  }
  return pick([
    `You've completed ${w} ${noun} this week. Lovely work.`,
    `${w[0]!.toUpperCase()}${w.slice(1)} ${noun} done this week – steady progress, ${name}.`,
    `Nice one, ${name}: ${w} ${noun} so far this week.`,
  ], seed);
}

export function restDayMessage(seed: string): string {
  return pick([
    "Today is a recovery day. Your muscles are getting stronger while you rest.",
    "Rest day. Recovery is part of the process – enjoy it.",
    "A recovery day today. Gentle movement like a walk is lovely if you feel like it.",
  ], seed);
}

export function encouragement(seed: string): string {
  return pick([
    "You're making steady progress.",
    "Consistency matters more than intensity.",
    "Every session counts, whatever the weight.",
    "Strength is built one comfortable session at a time.",
  ], seed);
}

export function reminderCopy(name: string, kind: "dayBefore" | "today", seed: string): string {
  if (kind === "dayBefore") return pick([`${name}, your strength session is scheduled for tomorrow.`, `A gentle heads-up, ${name}: tomorrow is a strength day.`], seed);
  return pick([`Ready for a little strength training today, ${name}?`, `${name}, today's session is waiting whenever you are.`], seed);
}
