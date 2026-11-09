import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/app/globals.css", "utf8");
function block(selector: string): Record<string, string> {
  const i = css.indexOf(selector + " {");
  const body = css.slice(i, css.indexOf("}", i));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1]!, m[2]!]));
}
const lum = (hex: string) => {
  const c = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05); };

const themes: Record<string, Record<string, string>> = {
  light: block(":root"),
  dark: { ...block(":root"), ...block(':root[data-theme="dark"]') },
  "high-contrast": { ...block(":root"), ...block(':root[data-contrast="high"]') },
};
// [foreground, background] pairs used for text (AA = 4.5:1), plus non-text UI boundaries (3:1)
const TEXT: [string, string][] = [["fg", "bg"], ["fg", "surface"], ["muted", "bg"], ["muted", "surface"], ["muted", "surface-2"], ["primary-fg", "primary"],
  ["accent-fg", "accent-soft"], ["peach-fg", "peach"], ["lavender-fg", "lavender"], ["danger", "surface"], ["danger", "danger-soft"], ["warn-fg", "warn-soft"], ["primary", "bg"]];
describe("WCAG AA colour contrast of the design tokens", () => {
  for (const [name, t] of Object.entries(themes)) {
    for (const [f, b] of TEXT) it(`${name}: ${f} on ${b} ≥ 4.5:1`, () => { expect(ratio(t[f]!, t[b]!)).toBeGreaterThanOrEqual(4.5); });
    it(`${name}: input borders and focus ring ≥ 3:1`, () => { expect(ratio(t["input-border"]!, t["surface"]!)).toBeGreaterThanOrEqual(3); expect(ratio(t["focus"]!, t["bg"]!)).toBeGreaterThanOrEqual(3); });
  }
});
