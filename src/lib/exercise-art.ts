import { exerciseImages } from "./exercise-images";

/**
 * Bridges the supplied image set (keyed by its own slugs) to JoStrong's exercise ids.
 * Only slugs that differ need listing. The supplied files are not modified.
 */
const ID_TO_SLUG: Record<string, string> = {
  "supported-db-row": "supported-dumbbell-row",
  "dumbbell-rdl": "dumbbell-romanian-deadlift",
  "supported-low-step-up": "supported-step-up",
  "dumbbell-curl": "dumbbell-bicep-curl",
};

/**
 * Four supplied files contain a white gap followed by a leftover strip of another scene on their right edge
 * (detected by scanning for near-white columns). The files are untouched; we simply don't show the strip.
 * Values are the visible width in px of the 301×503 source. Remove an entry once its file is regenerated.
 */
export const VISIBLE_WIDTH_PX: Record<string, number> = {
  "glute-bridge": 246, "wall-push-up": 237, "dumbbell-bicep-curl": 253, "supported-step-up": 275,
};
export const SOURCE_SIZE = { width: 301, height: 503 } as const;

export interface ExerciseImage { src: string; alt: string; /** visible width in source px */ width: number; height: number; }
export function getExerciseImage(exerciseId: string): ExerciseImage | null {
  const slug = ID_TO_SLUG[exerciseId] ?? exerciseId;
  const img = (exerciseImages as Record<string, { src: string; alt: string }>)[slug];
  return img ? { ...img, width: VISIBLE_WIDTH_PX[slug] ?? SOURCE_SIZE.width, height: SOURCE_SIZE.height } : null;
}
export const IMAGE_SLUG_ALIASES = ID_TO_SLUG;
