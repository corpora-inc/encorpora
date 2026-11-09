import assert from "node:assert/strict";
import type { Locator, Page } from "playwright";
/** Exercise the same dialog and option buttons used by pointer/keyboard users. */
export async function choose(locator: Locator, value: string) {
  await locator.click();
  await locator
    .page()
    .getByRole("dialog")
    .locator(`[role="option"][data-value=${JSON.stringify(value)}]`)
    .click();
}

/** The app frame's drawer, opened from the logo (app/AppShell.tsx). */
export async function openMenu(page: Page) {
  await page.getByRole("button", { name: "Open AMP menu" }).click();
  const drawer = page.getByRole("dialog", { name: "Adaptive Math Pathways" });
  await drawer.waitFor();
  return drawer;
}
/** Leaves account settings the way a parent does now that they have no Back:
 * the logo, then Progress (the learner's Overview). */
export async function leaveSettings(page: Page) {
  const drawer = await openMenu(page);
  await drawer.getByRole("link", { name: "Progress", exact: true }).click();
  await drawer.waitFor({ state: "detached" });
}
/** Chooses the current learner where the app keeps the choice: the drawer. */
export async function chooseLearner(page: Page, id: string) {
  const drawer = await openMenu(page);
  const only = drawer.locator('[aria-label="Where you are"] [data-learner]');
  if (await only.count()) {
    assert.equal(await only.getAttribute("data-learner"), id);
    await page.keyboard.press("Escape");
    await drawer.waitFor({ state: "detached" });
    return;
  }
  const folded = drawer.getByRole("button", { name: /^Current learner/ });
  if (await folded.count()) await folded.click();
  await drawer
    .getByRole("listbox", { name: "Current learner" })
    .locator(`[role="option"][data-value=${JSON.stringify(id)}]`)
    .click();
  // Choosing navigates and closes the drawer; a choice already current
  // leaves it open.
  if (await drawer.count()) await page.keyboard.press("Escape");
  await drawer.waitFor({ state: "detached" });
}
/** The current learner, as the drawer shows it. */
export async function currentLearner(page: Page) {
  const drawer = await openMenu(page);
  const folded = drawer.getByRole("button", { name: /^Current learner/ });
  // One learner is named, not offered: the drawer marks whose it is.
  const only = drawer.locator('[aria-label="Where you are"] [data-learner]');
  const value = (await only.count())
    ? await only.getAttribute("data-learner")
    : (await folded.count())
      ? await folded.getAttribute("data-value")
      : await drawer
          .getByRole("listbox", { name: "Current learner" })
          .locator('[role="option"][aria-selected="true"]')
          .getAttribute("data-value");
  await page.keyboard.press("Escape");
  await drawer.waitFor({ state: "detached" });
  return value;
}

/** Follow a destination through the shared app drawer. */
export async function navigateApp(
  page: Page,
  name: "Practice" | "Lessons" | "Progress" | "Account",
) {
  // The native app retains its local learning-section controls.
  const nativeSections = page.getByRole("navigation", {
    name: "Learning sections",
  });
  if (name !== "Account" && (await nativeSections.isVisible())) {
    await nativeSections.getByRole("button", { name, exact: true }).click();
    return;
  }
  const drawer = await openMenu(page);
  await drawer.getByRole("link", { name, exact: true }).click();
  await drawer.waitFor({ state: "detached" });
}
