import type { EquipmentInventory, EquipmentKey, Exercise, Requirement } from "./types";

export const EQUIPMENT_LABELS: Record<EquipmentKey, string> = {
  none: "No equipment", mat: "Exercise mat", chair: "Sturdy chair", bands: "Resistance bands",
  light_dumbbells: "Light dumbbells", adjustable_dumbbells: "Adjustable dumbbells",
  bench: "Weight bench", step: "Exercise step", other: "Other equipment",
};

/** Which exercise requirements are satisfied by the confirmed inventory. */
export function availableRequirements(inv: Pick<EquipmentInventory, "items">): Set<Requirement> {
  const s = new Set<Requirement>();
  for (const k of inv.items) {
    if (k === "mat" || k === "chair" || k === "bands" || k === "bench" || k === "step") s.add(k);
    if (k === "light_dumbbells" || k === "adjustable_dumbbells") s.add("dumbbells");
  }
  // A bench can stand in for a sturdy chair
  if (s.has("bench")) s.add("chair");
  return s;
}

export function canDo(ex: Exercise, inv: Pick<EquipmentInventory, "items">): boolean {
  const have = availableRequirements(inv);
  return ex.requires.every((r) => have.has(r));
}

/** Sorted, de-duplicated, positive weights only. */
export function normaliseWeights(ws: number[]): number[] {
  return [...new Set(ws.filter((w) => Number.isFinite(w) && w > 0).map((w) => Math.round(w * 100) / 100))].sort((a, b) => a - b);
}

export function nextHeavier(weights: number[], current: number): number | null {
  return normaliseWeights(weights).find((w) => w > current + 1e-9) ?? null;
}
export function nextLighter(weights: number[], current: number): number | null {
  const lighter = normaliseWeights(weights).filter((w) => w < current - 1e-9);
  return lighter.length ? lighter[lighter.length - 1]! : null;
}
export function formatKg(w: number | null | undefined): string {
  if (w == null) return "–";
  return `${Number.isInteger(w) ? w : w.toFixed(1).replace(/\.0$/, "")} kg`;
}
