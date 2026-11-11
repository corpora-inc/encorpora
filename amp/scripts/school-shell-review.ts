import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import type { Page } from "playwright";

/** Check the actual shared frame, including its drawer and phone strip. */
export async function schoolShellReview(page: Page, shot?: string) {
  const url = new URL(page.url());
  const path = url.pathname;
  // A student opened from a class (`?class=`) stays inside that class.
  const kind =
    path.includes("/classes/") ||
    (/^\/school\/[^/]+\/students\//.test(path) && url.searchParams.has("class"))
      ? "class"
      : path.startsWith("/school/")
        ? "school"
        : "plain";
  assert.equal(
    await page.locator(`[data-app-frame="${kind}"]`).count(),
    1,
    `${path}: shared frame`,
  );
  assert.equal(
    await page.locator("[data-app-bar]").count(),
    1,
    `${path}: one bar`,
  );
  assert.equal(
    await page.locator("[data-navigation-trigger]").count(),
    1,
    `${path}: one drawer trigger`,
  );
  const geometry = await page.evaluate(() => {
    const logo = document
      .querySelector("[data-app-bar] [data-app-logo]")!
      .getBoundingClientRect();
    const main = document.querySelector("main")!;
    const style = getComputedStyle(main);
    const tab = document.querySelector("[data-app-bar] nav");
    return {
      logo: { x: logo.x, y: logo.y, width: logo.width, height: logo.height },
      overflow: document.documentElement.scrollWidth - innerWidth,
      border: style.borderTopWidth,
      radius: style.borderTopLeftRadius,
      barBottom: document
        .querySelector("[data-app-bar]")!
        .getBoundingClientRect().bottom,
      stickyHeaders: [
        ...document.querySelectorAll<HTMLElement>('[role="columnheader"]'),
      ]
        .filter(
          (el) =>
            getComputedStyle(el).position === "sticky" &&
            !el.closest("[data-scrolls], [data-virtual]"),
        )
        .map((el) => parseFloat(getComputedStyle(el).top)),
      // The tabs shown: a phone row too wide for the bar holds the rest
      // in More (ui/Tabs), and those have no box.
      tabs: tab
        ? [...tab.children]
            .filter((item) => item.getClientRects().length > 0)
            .map((item) => ({
              label: item.textContent,
              y: item.getBoundingClientRect().y,
              height: item.getBoundingClientRect().height,
            }))
        : [],
    };
  });
  assert.ok(geometry.overflow <= 1, `${path}: no horizontal overflow`);
  assert.equal(
    geometry.logo.x,
    page.viewportSize()!.width >= 768 ? 16 : 4,
    `${path}: fixed logo x`,
  );
  assert.equal(geometry.logo.y, 6, `${path}: fixed logo y`);
  assert.equal(geometry.logo.height, 44);
  assert.equal(geometry.border, "0px", `${path}: no card border`);
  assert.equal(geometry.radius, "0px", `${path}: no card corners`);
  if (kind !== "plain")
    for (const top of geometry.stickyHeaders)
      assert.equal(
        top,
        geometry.barBottom,
        `${path}: table headings stick below the bar`,
      );
  for (const tab of geometry.tabs) {
    assert.equal(tab.y, geometry.tabs[0]!.y, `${path}: one tab row`);
    assert.ok(tab.height >= 44, `${path}: tab touch target`);
  }
  if (kind === "class") {
    const labels = geometry.tabs.map((tab) => tab.label);
    assert.ok(
      !labels.includes("Start class") && !labels.includes("Student experience"),
      "sub-screens are not tabs",
    );
  }
  if (
    shot &&
    [390, 1280].includes(page.viewportSize()!.width) &&
    page.context().browser()!.browserType().name() === "chromium"
  ) {
    await mkdir("docs/reviews/school-shell", { recursive: true });
    const theme = await page.evaluate(() =>
      matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
    );
    await page.screenshot({
      path: `docs/reviews/school-shell/${shot}-${page.viewportSize()!.width}-${theme}.png`,
      fullPage: false,
    });
  }
}

/** Navigate every class tab the bar offers (a family of six or fewer has no
 * Grades), retaining the bar, logo and strip dimensions. Children are reached
 * from the class (Map and its drill-in), never the place switcher, which
 * holds places only (docs/design/ia.md). */
export async function classShellJourney(page: Page) {
  const today = page.url();
  const snapshot = () =>
    page.evaluate(() => {
      const bar = document.querySelector("[data-app-bar]") as HTMLElement & {
        shellMark?: boolean;
      };
      const box = (selector: string) => {
        const { x, y, width, height } = bar
          .querySelector(selector)!
          .getBoundingClientRect();
        return { x, y, width, height };
      };
      return {
        kept: !!bar.shellMark,
        logo: box("[data-app-logo]"),
        strip: box("nav"),
      };
    });
  await page.evaluate(() => {
    (
      document.querySelector("[data-app-bar]") as HTMLElement & {
        shellMark?: boolean;
      }
    ).shellMark = true;
  });
  const before = await snapshot();
  const offered = await page
    .locator("[data-app-bar] [data-tab]")
    .evaluateAll((tabs) => tabs.map((tab) => tab.getAttribute("data-tab")!));
  const order = [
    "map",
    "gradebook",
    "time",
    "workbooks",
    "roster",
    "settings",
    "today",
  ].filter((id) => offered.includes(id));
  for (const id of order) {
    const tab = page.locator(`[data-app-bar] [data-tab="${id}"]`);
    // On a phone a row too wide for the bar holds some tabs in More.
    if (await tab.isVisible()) await tab.click();
    else {
      const label = (await tab.textContent())!.trim();
      await page
        .locator("[data-app-bar]")
        .getByRole("button", { name: /^More .* tabs$/ })
        .click();
      await page.getByRole("menuitem", { name: label, exact: true }).click();
    }
    await page
      .locator(`[data-app-bar] [data-tab="${id}"][aria-current="page"]`)
      .waitFor();
    assert.deepEqual(
      await snapshot(),
      before,
      `${id}: bar retained and geometry fixed`,
    );
    await schoolShellReview(page);
  }
  await page.getByRole("button", { name: "Open AMP menu" }).click();
  const drawer = page.getByRole("dialog");
  await drawer.waitFor();
  assert.equal(
    await drawer
      .locator('nav[aria-label="AMP navigation"] [aria-current="page"]')
      .count(),
    1,
    "the drawer marks exactly one current item",
  );
  await drawer.getByRole("button", { name: "Sign out", exact: true }).waitFor();
  await drawer.getByRole("button", { name: /switch place$/ }).click();
  assert.equal(
    await page.getByRole("menu").locator('[data-place^="learner:"]').count(),
    0,
    "the place switcher holds places only",
  );
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await drawer.waitFor({ state: "hidden" });
  const activeVisible = () =>
    page.locator('[data-app-bar] [aria-current="page"]').evaluate((tab) => {
      const box = tab.getBoundingClientRect();
      const strip = tab.parentElement!.getBoundingClientRect();
      return box.left >= strip.left - 1 && box.right <= strip.right + 1;
    });
  await page.goBack();
  await page.locator('[data-tab="settings"][aria-current="page"]').waitFor();
  assert.ok(await activeVisible(), "Back reveals the active tab");
  await page.goForward();
  await page.waitForURL(today);
  await page.locator('[data-tab="today"][aria-current="page"]').waitFor();
  assert.ok(await activeVisible(), "Forward reveals Today");
  await page.reload();
  await page.locator('[data-tab="today"][aria-current="page"]').waitFor();
  assert.ok(await activeVisible(), "Reload reveals Today");
}
