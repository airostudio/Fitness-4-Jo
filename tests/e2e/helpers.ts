import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** axe-core/playwright is typed against a newer Playwright than the one pinned here to match the installed browser build; runtime API is identical. */
export const axe = (page: Page, tags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]) => new AxeBuilder({ page: page as never }).withTags(tags);

/** Monday 9 Nov 2026, 10:00 in Melbourne – the default Monday/Thursday plan makes "today" a Workout A day. */
export async function freezeTime(page: Page) { await page.clock.setFixedTime(new Date("2026-11-09T10:00:00+11:00")); }

export async function onboard(page: Page, opts: { equipment?: string[] } = {}) {
  await freezeTime(page);
  await page.goto("/");
  await page.waitForURL("**/onboarding");
  await page.getByRole("button", { name: "Continue" }).click(); // about you (defaults)
  await page.getByRole("button", { name: "Continue" }).click(); // experience
  await page.getByRole("button", { name: "Skip these questions" }).click();
  for (const e of opts.equipment ?? ["Sturdy chair", "Exercise mat", "Light dumbbells", "Exercise step"]) await page.getByText(e, { exact: true }).click();
  if ((opts.equipment ?? ["Light dumbbells"]).includes("Light dumbbells")) await page.getByLabel(/Which dumbbell weights/).fill("1, 2, 3, 4");
  await page.getByRole("button", { name: "Continue" }).click(); // equipment
  await page.getByRole("button", { name: "Continue" }).click(); // goals
  await expect(page.getByRole("heading", { name: /your strength journey starts here/ })).toBeVisible();
  await page.getByRole("button", { name: "Start my journey" }).click();
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening), Jo!/ })).toBeVisible();
}

export async function startWorkout(page: Page) {
  await page.getByRole("link", { name: /Start Today/ }).click();
  await page.getByText("Great", { exact: true }).click();
  await page.getByText("Recovered", { exact: true }).click();
  await page.getByText("No", { exact: true }).first().click();
  await page.getByRole("button", { name: "Start workout" }).click();
  await expect(page.getByRole("heading", { name: "Chair Squat", exact: true })).toBeVisible();
}
