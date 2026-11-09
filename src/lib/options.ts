import type { GoalKey } from "@/lib/domain/types";
export const TIMEZONES = ["Australia/Melbourne", "Australia/Sydney", "Australia/Brisbane", "Australia/Adelaide", "Australia/Perth", "Australia/Hobart", "Australia/Darwin", "Pacific/Auckland", "UTC"];
export const GOALS: { value: GoalKey; label: string }[] = [
  { value: "build_muscle", label: "Building muscle" },
  { value: "everyday_strength", label: "Improving everyday strength" },
  { value: "balance", label: "Improving balance" },
  { value: "posture_mobility", label: "Improving posture and mobility" },
  { value: "confidence", label: "Developing confidence" },
  { value: "general_fitness", label: "Improving general fitness" },
  { value: "independence", label: "Maintaining independence and physical capability" },
];
export const DAY_OPTIONS = [
  { value: 1, label: "Monday" }, { value: 2, label: "Tuesday" }, { value: 3, label: "Wednesday" }, { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" }, { value: 6, label: "Saturday" }, { value: 7, label: "Sunday" },
];
/** Parse "1, 2.5 3" into positive numbers. */
export function parseWeights(text: string): number[] {
  return text.split(/[,\s]+/).map(Number).filter((n) => Number.isFinite(n) && n > 0 && n <= 60);
}
