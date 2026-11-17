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
/** A family's children are rows in the drawer, each a link to that child's
 * own pages (features/navigation/DrawerContents.tsx); the current one is
 * marked aria-current. */
function childRow(drawer: Locator, id?: string) {
  return drawer
    .getByRole("navigation", { name: "AMP navigation" })
    .locator(
      id === undefined
        ? 'a[href*="/kids/"]'
        : `a[href$=${JSON.stringify(`/kids/${id}`)}]`,
    );
}
/** Chooses the current learner where the app keeps the choice: the drawer. */
export async function chooseLearner(page: Page, id: string) {
  const drawer = await openMenu(page);
  const only = drawer.locator(
    '[aria-label="Who is practicing"] [data-learner]',
  );
  const folded = drawer.getByRole("button", { name: /^Current learner/ });
  const listbox = drawer.getByRole("listbox", { name: "Current learner" });
  const child = childRow(drawer, id);
  // The drawer can open while account data loads. Wait for its learner
  // control before deciding whether it shows one learner, a family's
  // children or a selector.
  await only.or(folded).or(listbox).or(child).first().waitFor({
    state: "visible",
  });
  if (await child.count()) {
    if ((await child.getAttribute("aria-current")) === "page") {
      await page.keyboard.press("Escape");
    } else {
      await child.click();
      await page.waitForURL((url) => url.pathname.endsWith(`/kids/${id}`));
    }
    await drawer.waitFor({ state: "detached" });
    return;
  }
  if (await only.count()) {
    assert.equal(await only.getAttribute("data-learner"), id);
    await page.keyboard.press("Escape");
    await drawer.waitFor({ state: "detached" });
    return;
  }
  if (await folded.count()) await folded.click();
  await listbox
    .locator(`[role="option"][data-value=${JSON.stringify(id)}]`)
    .click();
  // Choosing navigates and closes the drawer; a choice already current
  // leaves it open.
  if (await drawer.count()) await page.keyboard.press("Escape");
  await drawer.waitFor({ state: "detached" });
}
/**
 * Hands this device to one of the family's children, as a parent does: the
 * family's Today, then "Let <name> practice here" (features/family/Today.tsx).
 * The child's own session opens on their practice; their drawer offers only
 * their Practice and Progress. `returnToParent` gives the device back.
 */
export async function practiceHere(page: Page, id: string) {
  const drawer = await openMenu(page);
  const nav = drawer.getByRole("navigation", { name: "AMP navigation" });
  await nav
    .getByRole("link", { name: "Today", exact: true })
    .click()
    .catch(async (error: unknown) => {
      throw new Error(
        `practiceHere: no Today in the menu at ${page.url()}; it offers ${JSON.stringify(await nav.getByRole("link").allTextContents())}`,
        { cause: error },
      );
    });
  await drawer.waitFor({ state: "detached" });
  // The child's row offers it, and so may a task of theirs on Today.
  const handed = page
    .waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith(
        `/family/learners/${id}/practice-here`,
      ),
    )
    .then(async (response) =>
      response.ok() ? "" : ` (${response.status()} ${await response.text()})`,
    )
    .catch(() => "");
  await page
    .locator(`[data-practice-here=${JSON.stringify(id)}]`)
    .first()
    .click();
  // Practice opens at the learner's own address (`/practice/<learner>`).
  await page
    .waitForURL((url) => url.pathname === `/practice/${encodeURIComponent(id)}`)
    .catch(async (error: unknown) => {
      await page
        .screenshot({ path: "artifacts/practice-here-failure.png" })
        .catch(() => undefined);
      throw new Error(
        `practiceHere: still at ${page.url()}, want /practice/${id}${await handed}`,
        { cause: error },
      );
    });
  await page.locator(".problem-stage").waitFor();
}
/** Ends a child's session on this device: Back to family returns it to the parent,
 * on the family's Today. */
export async function returnToParent(page: Page) {
  const drawer = await openMenu(page);
  await drawer
    .getByRole("button", { name: "Back to family", exact: true })
    .click();
  await page.waitForURL((url) => /^\/family\/[^/]+$/.test(url.pathname));
  await page.locator("[data-today-title]").waitFor();
}
/** The current learner, as the drawer shows it. */
export async function currentLearner(page: Page) {
  const drawer = await openMenu(page);
  const folded = drawer.getByRole("button", { name: /^Current learner/ });
  // One learner is named, not offered: the drawer marks whose it is.
  const only = drawer.locator(
    '[aria-label="Who is practicing"] [data-learner]',
  );
  const children = childRow(drawer);
  const value = (await children.count())
    ? ((
        await childRow(drawer)
          .and(drawer.locator('[aria-current="page"]'))
          .getAttribute("href", { timeout: 1_000 })
          .catch(() => null)
      )?.split("/kids/")[1] ?? null)
    : (await only.count())
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
