import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "@/data/exercise-manifest.json";
import { exerciseImages } from "@/lib/exercise-images";
import { getExerciseImage, IMAGE_SLUG_ALIASES, SOURCE_SIZE, VISIBLE_WIDTH_PX } from "@/lib/exercise-art";
import { EXERCISES, getExercise } from "@/lib/domain/exercises";

describe("supplied exercise images", () => {
  it("manifest and typed map agree, and every file exists on disk", () => {
    expect(manifest.map((m) => m.slug).sort()).toEqual(Object.keys(exerciseImages).sort());
    for (const m of manifest) {
      expect(existsSync(`public${m.image}`), m.image).toBe(true);
      expect((exerciseImages as Record<string, { src: string }>)[m.slug]!.src).toBe(m.image);
    }
  });
  it("every image resolves to a real exercise id (directly or via alias)", () => {
    const ids = new Set(EXERCISES.map((e) => e.id));
    for (const slug of Object.keys(exerciseImages)) {
      const id = Object.entries(IMAGE_SLUG_ALIASES).find(([, s]) => s === slug)?.[0] ?? slug;
      expect(ids.has(id), `${slug} → ${id}`).toBe(true);
      expect(getExerciseImage(id)?.src).toContain(slug);
    }
  });
  it("all of Workout A and B's main exercises have an illustration", () => {
    for (const id of ["chair-squat", "supported-db-row", "wall-push-up", "glute-bridge", "dead-bug", "dumbbell-rdl", "seated-shoulder-press", "supported-low-step-up", "dumbbell-curl", "bird-dog"]) {
      expect(getExerciseImage(id), id).not.toBeNull(); expect(getExercise(id)).toBeDefined();
    }
  });
  it("alt text always discloses that the images are AI-generated illustrations", () => {
    for (const v of Object.values(exerciseImages)) expect(v.alt).toMatch(/AI-generated/);
  });
  it("display crops only reference supplied images and never exceed the source size", () => {
    for (const [slug, w] of Object.entries(VISIBLE_WIDTH_PX)) {
      expect(Object.keys(exerciseImages)).toContain(slug);
      expect(w).toBeGreaterThan(150); expect(w).toBeLessThanOrEqual(SOURCE_SIZE.width);
    }
    expect(getExerciseImage("glute-bridge")!.width).toBe(246);
    expect(getExerciseImage("chair-squat")!.width).toBe(SOURCE_SIZE.width);
  });
});
