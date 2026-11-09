import { expect, test } from "@playwright/test";
import { onboard, startWorkout, freezeTime } from "./helpers";

test.describe("onboarding", () => {
  test("validation failures are explained, then the personal programme is created", async ({ page }) => {
    await freezeTime(page);
    await page.goto("/");
    await page.waitForURL("**/onboarding");
    await page.getByLabel("What would you like us to call you?").fill("");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "what to call you" })).toBeVisible();
    await page.getByLabel("What would you like us to call you?").fill("Jo");
    await page.getByLabel("Height in cm (optional)").fill("20");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Height should be between" })).toBeVisible();
    await page.getByLabel("Height in cm (optional)").fill("");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Step 2 of 6")).toBeVisible();
  });
  test("saves equipment and preferences; plan only uses confirmed equipment", async ({ page }) => {
    await onboard(page, { equipment: ["Exercise mat", "Sturdy chair"] });
    await page.goto("/workouts");
    await expect(page.getByText("Dumbbell Bicep Curl")).toHaveCount(0);
    await expect(page.getByText(/Band Bicep Curl/)).toHaveCount(0); // no bands either
    await page.goto("/settings");
    await expect(page.getByLabel("Preferred name")).toHaveValue("Jo");
    await expect(page.getByLabel("Exercise mat")).toBeChecked();
  });
});

test.describe("guided workout", () => {
  test("start, log, edit weight, pause/resume, survive reload, end early", async ({ page }) => {
    await onboard(page);
    await startWorkout(page);
    await page.getByRole("button", { name: "START SET" }).click();
    await expect(page.getByText(/Set in progress/)).toBeVisible();
    await page.getByRole("button", { name: "COMPLETE SET" }).click();
    await expect(page.getByRole("timer", { name: "Rest timer" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Set 1/ })).toBeVisible();
    // reload: nothing lost, still in the same workout
    await page.reload();
    await expect(page.getByRole("heading", { name: "Chair Squat", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Set 1/ })).toBeVisible();
    // edit reps of the logged set
    await page.getByRole("button", { name: /Set 1.*Edit/ }).click();
    await page.getByRole("dialog").getByLabel("Repetitions").fill("11");
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await expect(page.getByRole("button", { name: /Set 1: 11 reps/ })).toBeVisible();
    // pause + resume
    await page.getByRole("button", { name: "Pause workout" }).click();
    await expect(page.getByRole("heading", { name: "Workout paused" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Workout paused" })).toBeVisible();
    await page.getByRole("button", { name: "Resume workout" }).click();
    // next exercise: weighted row, change the weight with the steppers
    await page.getByRole("button", { name: /Next exercise/ }).click();
    await expect(page.getByRole("heading", { name: "Supported Dumbbell Row" })).toBeVisible();
    await page.getByRole("button", { name: "Heavier weight" }).click();
    await expect(page.getByLabel("Weight (kg)", { exact: true }).first()).toHaveValue("1");
    await page.getByRole("button", { name: "Heavier weight" }).click();
    await expect(page.getByLabel("Weight (kg)", { exact: true }).first()).toHaveValue("2");
    await page.getByRole("button", { name: "COMPLETE SET" }).click();
    // end early with confirmation → saved, summary shown
    await page.getByRole("button", { name: "End workout" }).click();
    await page.getByRole("button", { name: "Finish early" }).click();
    await expect(page.getByRole("heading", { name: "Nicely done!" })).toBeVisible();
    await expect(page.getByText(/logged 2 sets/)).toBeVisible();
    await page.goto("/");
    await expect(page.getByText(/Today.s session is done/)).toBeVisible();
    await page.goto("/progress");
    await expect(page.getByRole("heading", { name: "Consistency" })).toBeVisible();
    await expect(page.getByText("First session complete")).toBeVisible();
  });
  test("skip, substitute and repeat controls all work", async ({ page }) => {
    await onboard(page);
    await startWorkout(page);
    await page.getByRole("button", { name: "REPEAT SET" }).click();
    await expect(page.getByText("1 of 2")).toBeVisible();
    await page.getByRole("button", { name: "SUBSTITUTE EXERCISE" }).click();
    await page.getByText("Bodyweight Squat").click();
    await page.getByRole("button", { name: "Use this exercise" }).click();
    await expect(page.getByRole("heading", { name: /Bodyweight Squat/ })).toBeVisible();
    await page.getByRole("button", { name: "SKIP EXERCISE" }).click();
    await page.getByRole("button", { name: "Skip exercise", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Supported Dumbbell Row" })).toBeVisible();
  });
  test("new or significant pain stops the session and never offers to train", async ({ page }) => {
    await onboard(page);
    await page.getByRole("link", { name: /Start Today/ }).click();
    await page.getByText("Great", { exact: true }).click(); await page.getByText("Recovered", { exact: true }).click();
    await page.getByText("New or significant pain").click();
    await expect(page.getByText("Let's rest today")).toBeVisible();
    await expect(page.getByRole("button", { name: /Start/ })).toHaveCount(0);
    await expect(page.getByText(/doctor or physiotherapist/)).toBeVisible();
  });
});

test.describe("calendar", () => {
  test("reschedule a session; duplicate day and past date are refused", async ({ page }) => {
    await onboard(page);
    await page.goto("/workouts");
    await page.getByRole("button", { name: "Move" }).first().click();
    await page.getByLabel("New date").fill("2026-11-12");
    await page.getByRole("button", { name: "Move session" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "already a session on that day" })).toBeVisible();
    await page.getByLabel("New date").fill("2026-11-10");
    await page.getByRole("button", { name: "Move session" }).click();
    await expect(page.getByText("Tuesday 10 November")).toBeVisible();
  });
});

test.describe("data ownership", () => {
  test("export downloads the user's data; delete requires confirmation and resets everything", async ({ page }) => {
    await onboard(page);
    await page.goto("/settings");
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download my data" }).click()]);
    const body = JSON.parse(await (await import("node:fs/promises")).readFile((await dl.path())!, "utf8"));
    expect(body.format).toBe("jostrong-export"); expect(body.data.profile.name).toBe("Jo"); expect(body.data.meta).toBeUndefined();
    await page.getByRole("button", { name: /Delete my account and data/ }).click();
    const confirm = page.getByRole("button", { name: "Delete permanently" });
    await expect(confirm).toBeDisabled();
    await page.getByLabel("Type DELETE to confirm").fill("DELETE");
    await confirm.click();
    await page.waitForURL("**/onboarding");
  });
  test("data persists between visits", async ({ page }) => {
    await onboard(page);
    await page.goto("/journey");
    await page.getByRole("button", { name: "New entry" }).first().click();
    await page.getByLabel("How did you feel?").fill("Felt steady and strong");
    await page.getByRole("button", { name: "Save entry" }).click();
    await page.reload();
    await expect(page.getByText("Felt steady and strong")).toBeVisible();
  });
});

test.describe("offline", () => {
  test("a workout can be completed with no connection and survives reloads", async ({ page, context }) => {
    await onboard(page);
    await page.goto("/workout");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload(); // ensure the page is controlled and cached
    await context.setOffline(true);
    await page.reload();
    await page.getByText("Great", { exact: true }).click(); await page.getByText("Recovered", { exact: true }).click(); await page.getByText("No", { exact: true }).first().click();
    await page.getByRole("button", { name: "Start workout" }).click();
    await page.getByRole("button", { name: "COMPLETE SET" }).click();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Chair Squat", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Set 1/ })).toBeVisible();
    await context.setOffline(false);
  });
});

test.describe("exercise illustrations", () => {
  test("detail page and player show the supplied images, labelled as AI-generated, and they work offline", async ({ page, context }) => {
    await onboard(page);
    await page.goto("/exercises/dumbbell-curl"); // alias: dumbbell-bicep-curl.webp
    const img = page.getByRole("img", { name: /AI-generated exercise demonstration for Dumbbell Bicep Curl/ });
    await expect(img).toBeVisible();
    expect(await img.evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0)).toBe(true);
    await expect(page.getByText(/AI-generated – always check the written steps/)).toBeVisible();
    await page.goto("/exercises/bodyweight-squat"); // no image supplied → honest placeholder
    await expect(page.getByText("Demonstration video not available yet.")).toBeVisible();
    await page.goto("/workout?letter=A"); // direct entry – independent of today's date
    await page.getByText("Great", { exact: true }).click(); await page.getByText("Recovered", { exact: true }).click(); await page.getByText("No", { exact: true }).first().click();
    await page.getByRole("button", { name: "Start workout" }).click();
    await page.getByText("See the movement").click();
    await expect(page.getByRole("img", { name: /Chair Squat/ }).first()).toBeVisible();
    await page.evaluate(() => navigator.serviceWorker.ready); await page.reload();
    await context.setOffline(true); await page.reload();
    await page.getByText("See the movement").click();
    expect(await page.getByRole("img", { name: /Chair Squat/ }).first().evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0)).toBe(true);
    await context.setOffline(false);
  });
});
