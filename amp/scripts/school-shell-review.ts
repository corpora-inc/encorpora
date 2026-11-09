import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import type { Page } from "playwright";

/** Check the actual shared frame, including its drawer and phone strip. */
export async function schoolShellReview(page: Page, shot?: string) {
  const path = new URL(page.url()).pathname;
  const kind = path.includes("/classes/")
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
      tabs: tab
        ? [...tab.children].map((item) => ({
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

/** Navigate every class tab, retaining the bar, logo and strip dimensions. */
export async function classShellJourney(page: Page) {
  const today = page.url();
  await page.getByRole("button", { name: "Open AMP menu" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /switch place$/ })
    .click();
  await page
    .getByRole("menu")
    .locator('[data-place^="learner:"]')
    .filter({ hasText: "Maya" })
    .click();
  await page.waitForURL(/\/overview$/);
  await page.locator('[data-app-frame="progress"]').waitFor();
  await page.getByRole("button", { name: "Open AMP menu" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Maya: switch place" })
    .waitFor();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: /^Class,/ })
    .click();
  await page.waitForURL(today);
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
  for (const id of [
    "map",
    "gradebook",
    "time",
    "workbooks",
    "roster",
    "settings",
    "today",
  ]) {
    await page.locator(`[data-app-bar] [data-tab="${id}"]`).click();
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
  assert.equal(await drawer.getByRole("link", { name: /^Class,/ }).count(), 1);
  await drawer.getByRole("button", { name: "Sign out", exact: true }).waitFor();
  await drawer.getByRole("button", { name: /switch place$/ }).click();
  await page.getByRole("menuitem", { name: /Maya/ }).first().waitFor();
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
