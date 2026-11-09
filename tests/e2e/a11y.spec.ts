import { expect, test } from "@playwright/test";
import { axe, onboard, startWorkout } from "./helpers";

const pages = ["/", "/workouts", "/progress", "/journey", "/settings", "/exercises", "/exercises/chair-squat", "/privacy"];

test.describe("accessibility", () => {
  for (const scheme of ["light", "dark"] as const) {
    test(`axe finds no WCAG A/AA violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await onboard(page);
      for (const p of pages) {
        await page.goto(p); await page.waitForTimeout(400);
        const r = await axe(page).analyze();
        expect(r.violations.map((v) => `${p}: ${v.id} – ${v.nodes[0]?.html.slice(0, 120)}`), p).toEqual([]);
      }
    });
  }
  test("active workout, check-in and onboarding screens pass axe", async ({ page }) => {
    await onboard(page);
    await page.getByRole("link", { name: /Start Today/ }).click();
    expect((await axe(page, ["wcag2a", "wcag2aa"]).analyze()).violations.map((v) => v.id)).toEqual([]);
    await page.getByText("Great", { exact: true }).click(); await page.getByText("Recovered", { exact: true }).click(); await page.getByText("No", { exact: true }).first().click();
    await page.getByRole("button", { name: "Start workout" }).click();
    await page.getByRole("button", { name: "COMPLETE SET" }).click();
    expect((await axe(page, ["wcag2a", "wcag2aa"]).analyze()).violations.map((v) => v.id)).toEqual([]);
  });
  test("keyboard: skip link, labelled nav, and a full set can be logged without a pointer", async ({ page }) => {
    await onboard(page);
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    await expect(page.getByRole("navigation", { name: "Main" }).locator("a[aria-current=page]")).toHaveText(/Home/);
    await page.goto("/workout");
    await page.getByText("Great", { exact: true }).focus(); // visually hidden radio inputs are keyboard reachable
    await page.getByLabel("Great").press("Space"); await page.getByLabel("Recovered").press("Space"); await page.getByLabel("No", { exact: true }).first().press("Space");
    await page.getByRole("button", { name: "Start workout" }).focus(); await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "COMPLETE SET" }).focus(); await page.keyboard.press("Enter");
    await expect(page.getByRole("timer")).toBeVisible();
  });
  test("every form control in settings has an accessible name", async ({ page }) => {
    await onboard(page); await page.goto("/settings");
    const unnamed = await page.$$eval("input:not([type=hidden]), select, textarea", (els) => els.filter((e) => !(e.getAttribute("aria-label") || e.getAttribute("aria-labelledby") || (e as HTMLInputElement).labels?.length)).map((e) => e.outerHTML.slice(0, 80)));
    expect(unnamed).toEqual([]);
  });
  test("large touch targets for the primary workout controls", async ({ page }) => {
    await onboard(page); await startWorkout(page);
    const box = await page.getByRole("button", { name: "COMPLETE SET" }).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(64); expect(box!.width).toBeGreaterThan(250);
  });
  test("reduced motion: animations are disabled when the device asks", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await onboard(page);
    const dur = await page.locator(".rise").first().evaluate((e) => getComputedStyle(e).animationDuration);
    expect(parseFloat(dur)).toBeLessThan(0.01);
  });
  test("text size and high contrast settings apply", async ({ page }) => {
    await onboard(page); await page.goto("/settings");
    await page.getByText("Extra large", { exact: true }).click();
    await page.getByRole("switch", { name: "High contrast" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-contrast", "high");
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe("20.8px");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-contrast", "high");
  });
  test("PWA manifest is valid and installable metadata is present", async ({ page, request }) => {
    const m = await (await request.get("/manifest.webmanifest")).json();
    expect(m.display).toBe("standalone"); expect(m.icons.some((i: { purpose: string }) => i.purpose === "maskable")).toBe(true);
    for (const i of m.icons) expect((await request.get(i.src)).ok()).toBe(true);
    await page.goto("/auth/sign-in");
    await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
  });
});
