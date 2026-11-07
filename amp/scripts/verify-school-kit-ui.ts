/**
 * The AMP for Schools UI kit, in a real browser with no API: Today, Gradebook
 * and the long grid at 320, 390, 768 and 1280 px, light and dark. Saves every
 * screenshot under docs/reviews/school-ui-kit/ for a person to look at.
 */
import { secureChromium } from "../browser-security.mjs";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium as rawChromium, type Page } from "playwright";
import {
  clippedCells,
  focusWalk,
  probe,
  resetRecord,
  settle,
  shellRecord,
  shiftRecorder,
} from "./app-shell-probe";

const chromium = secureChromium(rawChromium);
const port = Number(process.env.AMP_SCHOOL_KIT_PORT ?? 4395);
const vite = await createServer({
  server: { host: "127.0.0.1", port, strictPort: true },
});
await vite.listen();
const origin = `http://127.0.0.1:${port}`;
const output = "docs/reviews/school-ui-kit";
const browser = await chromium.launch();
const widths = (process.env.AMP_SCHOOL_KIT_WIDTHS ?? "320,390,768,1280")
  .split(",")
  .map(Number);
const themes = ["light", "dark"] as const;
const failures: string[] = [];
const check = (label: string, ok: boolean, detail: unknown = "") => {
  if (!ok) failures.push(`${label}: ${JSON.stringify(detail)}`);
};
const heightFor = (width: number) => (width < 720 ? 844 : 900);
const today = "/school/preview/today";
const gradebook = "/school/preview/gradebook";
const students = "/school/preview/students";

async function open(page: Page, path: string, heading: string) {
  await page.goto(origin + path, { waitUntil: "domcontentloaded" });
  await page
    .getByRole("heading", { name: heading, level: 1, includeHidden: true })
    .waitFor();
  await page.evaluate(() => document.fonts.ready);
  await settle(page, 350);
}
const rect = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((element) => {
      const { left, top, width, height } = element.getBoundingClientRect();
      return { left, top, width, height };
    });

async function geometry(page: Page, label: string) {
  const result = await probe(page);
  check(`${label} overflow`, result.overflow === 0, result.overflow);
  check(
    `${label} targets`,
    result.smallTargets.length === 0,
    result.smallTargets,
  );
  check(
    `${label} mid-word wraps`,
    result.midWordWraps.length === 0,
    result.midWordWraps,
  );
  check(`${label} truncated`, result.truncated.length === 0, result.truncated);
  check(`${label} overlaps`, result.overlaps.length === 0, result.overlaps);
  const clipped = await clippedCells(page);
  check(`${label} clipped cells`, clipped.length === 0, clipped);
}
async function stable(page: Page, label: string) {
  const record = await shellRecord(page);
  check(`${label} layout shift`, record.cls <= 0.01, record.cls);
}

async function sheetBehavior(page: Page, label: string, width: number) {
  const opener = page.locator('[data-student="amara-osei"]').first();
  await opener.focus();
  await page.keyboard.press("Enter");
  const sheet = page.getByRole("dialog");
  await sheet.waitFor();
  await page.waitForFunction(() => location.search.includes("student="));
  await settle(page, 300);
  const box = await sheet.evaluate((element) => {
    const r = element.getBoundingClientRect();
    return {
      left: r.left,
      right: r.right,
      top: r.top,
      bottom: r.bottom,
      width: r.width,
    };
  });
  const viewport = page.viewportSize()!;
  if (width > 640) {
    check(`${label} sheet is at the side`, box.right === viewport.width, box);
    check(`${label} sheet is full height`, box.top === 0, box);
    check(`${label} sheet leaves the page beside it`, box.left > 0, box);
  } else {
    check(
      `${label} sheet is at the bottom`,
      box.bottom === viewport.height,
      box,
    );
    check(`${label} sheet is full width`, box.width === viewport.width, box);
  }
  const inside = () =>
    page.evaluate(
      () =>
        !!document.activeElement?.closest("[role=dialog]") ||
        document.activeElement?.getAttribute("role") === "dialog",
    );
  check(`${label} sheet takes focus`, await inside());
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    check(`${label} sheet traps Tab ${i}`, await inside());
  }
  await page.keyboard.press("Escape");
  await sheet.waitFor({ state: "detached" });
  await page.waitForFunction(() => !location.search.includes("student="));
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("data-student") === "amara-osei",
  );
  // A shared link opens the same sheet, and Back closes it.
  await page.goto(`${origin}${gradebook}?student=marcus-bell`);
  await sheet.waitFor();
  await page.getByRole("heading", { name: "Why this range" }).waitFor();
  await page.keyboard.press("Escape");
  await sheet.waitFor({ state: "detached" });
  await page.waitForFunction(
    () =>
      document.activeElement?.getAttribute("data-student") === "marcus-bell",
  );
  await page.locator('[data-student="sam-whitlock"]').first().click();
  await sheet.waitFor();
  await page.goBack();
  await sheet.waitFor({ state: "detached" });
}

async function gradeState(page: Page, label: string, width: number) {
  await resetRecord(page);
  const before = await rect(page, "h1");
  const exportBefore = await rect(page, 'button:has-text("Export")');
  // Weekly target: the value changes, the control and everything else hold.
  const stepperBefore = await rect(page, '[role="spinbutton"]');
  const practice = page.getByRole("meter", {
    name: "Practice for Amara Osei",
  });
  const value = () => practice.first().getAttribute("aria-valuenow");
  const was = await value();
  await page.getByRole("button", { name: "Increase weekly target" }).click();
  await page.getByRole("button", { name: "Increase weekly target" }).click();
  check(`${label} target changes practice`, (await value()) !== was);
  check(
    `${label} stepper holds its size`,
    JSON.stringify(await rect(page, '[role="spinbutton"]')) ===
      JSON.stringify(stepperBefore),
  );
  await page.getByRole("button", { name: "Decrease weekly target" }).click();
  await page.getByRole("button", { name: "Decrease weekly target" }).click();
  // The term switcher: a real URL, nothing moves.
  await page.getByRole("radio", { name: "Q1" }).click();
  await page.waitForFunction(() => location.search.includes("term=q1"));
  await page.getByRole("heading", { name: "Quarter 1 grades" }).waitFor();
  check(
    `${label} Export holds through the term change`,
    JSON.stringify(await rect(page, 'button:has-text("Export")')) ===
      JSON.stringify(exportBefore),
  );
  await page.goBack();
  await page.getByRole("heading", { name: "Quarter 2 grades" }).waitFor();
  check(
    `${label} heading holds`,
    JSON.stringify(await rect(page, "h1")) === JSON.stringify(before),
  );
  // Final grades: type, count, keep across screens.
  const final = page.getByRole("textbox", {
    name: "Final grade for Isaac Moreno",
  });
  const count = page.getByText(/of 24 final grades entered/);
  const counted = await count.textContent();
  await final.fill("B+");
  check(`${label} the count follows`, (await count.textContent()) !== counted);
  await page
    .getByRole("link", { name: "Today", exact: true })
    .first()
    .click({
      force: width < 1024,
      timeout: 3000,
    });
  await page.getByRole("heading", { name: /Good morning/ }).waitFor();
  await page.goBack();
  await page.getByRole("heading", { name: "Quarter 2 grades" }).waitFor();
  check(
    `${label} a typed grade survives navigation`,
    (await final.inputValue()) === "B+",
  );
  await final.fill("");
  await stable(page, `${label} after changes`);
}

async function gridKeyboard(page: Page, label: string) {
  const focused = () =>
    page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      const cell = el?.closest<HTMLElement>("[data-c]");
      return cell ? `${cell.dataset.r},${cell.dataset.c}` : "";
    });
  await page.getByRole("button", { name: "Student", exact: true }).focus();
  await page.keyboard.press("ArrowDown");
  check(`${label} down into the rows`, (await focused()) === "1,0");
  await page.keyboard.press("ArrowRight");
  check(`${label} right along a row`, (await focused()) === "1,1");
  await page.keyboard.press("End");
  check(`${label} End reaches the last column`, (await focused()) === "1,6");
  await page.keyboard.press("ArrowDown");
  check(`${label} down the final column`, (await focused()) === "2,6");
  // In a final-grade field: Enter goes to the next student, Escape to the cell.
  await page.keyboard.press("Enter");
  check(`${label} Enter moves down a field`, (await focused()) === "3,6");
  await page.keyboard.press("Escape");
  const onCell = await page.evaluate(
    () => document.activeElement?.getAttribute("role") === "gridcell",
  );
  check(`${label} Escape returns to the cell`, onCell);
  await page.keyboard.press("Home");
  check(`${label} Home reaches the first column`, (await focused()) === "3,0");
  const stops = await page.evaluate(
    () =>
      document.querySelectorAll(
        '[role=grid] [tabindex="0"], [role=grid] button:not([tabindex="-1"]), [role=grid] input:not([tabindex="-1"]), [role=grid] a:not([tabindex="-1"])',
      ).length,
  );
  check(`${label} the grid is one tab stop`, stops === 1, stops);
  // Sorting from a real button; the header does not move.
  const before = await rect(page, "thead");
  await page.getByRole("button", { name: "Suggested", exact: true }).click();
  await page.waitForFunction(() => location.search.includes("sort=suggested"));
  check(
    `${label} sort is announced`,
    (await page
      .getByRole("columnheader", { name: "Suggested" })
      .getAttribute("aria-sort")) === "descending",
  );
  check(
    `${label} sort leaves the header in place`,
    JSON.stringify(await rect(page, "thead")) === JSON.stringify(before),
  );
  await page.goBack();
}

async function longGrid(page: Page, label: string, width: number) {
  await open(page, students, "Students");
  const mode = await page
    .locator("[data-grid-mode]")
    .getAttribute("data-grid-mode");
  if (mode === "table") {
    const grid = page.getByRole("grid");
    check(
      `${label} the grid counts every row`,
      (await grid.getAttribute("aria-rowcount")) === "421",
    );
    const inDom = await page.locator("tbody tr[aria-rowindex]").count();
    check(`${label} only near rows exist`, inDom < 60, inDom);
    const scroller = page.locator("[data-virtual]");
    const top = await rect(page, "[data-virtual]");
    await scroller.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      element.scrollLeft = element.scrollWidth;
    });
    await page.locator('tr[aria-rowindex="421"]').waitFor();
    const header = await rect(page, "thead th");
    check(`${label} the header sticks`, Math.abs(header.top - top.top) < 2, {
      header,
      top,
    });
    check(
      `${label} the first column sticks`,
      Math.abs(header.left - top.left) < 2,
      { header, top },
    );
    if (width === 768) {
      const scrollLeft = await scroller.evaluate((e) => e.scrollLeft);
      check(`${label} the grid scrolls sideways`, scrollLeft > 0, scrollLeft);
    }
    await page.screenshot({ path: `${output}/students-${label}.png` });
  } else {
    const before = await page.locator("[data-grid-mode] li").count();
    check(`${label} only near cards exist`, before < 40, before);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.locator("[data-grid-mode] li").last().waitFor();
    await settle(page, 200);
    const after = await page.locator("[data-grid-mode] li").count();
    check(`${label} cards stay few at the end`, after < 40, after);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  // Search: a long paste stays in bounds; Escape clears; no match says so.
  const box = page.getByRole("textbox", { name: "Search students" });
  await box.fill("zzzz".repeat(40));
  await page.getByRole("heading", { name: /No student matches/ }).waitFor();
  check(
    `${label} a long paste stops at the limit`,
    (await box.inputValue()).length <= 80,
  );
  await geometry(page, `${label} no matches`);
  await box.press("Escape");
  await page.getByRole("heading", { name: /No student matches/ }).waitFor({
    state: "detached",
  });
}

async function frame(page: Page, label: string, width: number) {
  await open(page, `${today}?lone=1`, "Good morning, Ms. Okafor.");
  check(
    `${label} a lone teacher has no breadcrumb`,
    (await page.getByRole("navigation", { name: "Breadcrumb" }).count()) === 0,
  );
  check(
    `${label} a lone teacher has no tabs row`,
    (await page.getByRole("navigation", { name: "Class" }).count()) === 0,
  );
  if (width >= 1024) {
    const links = page.getByRole("complementary").getByRole("link");
    check(
      `${label} a lone teacher's nav is the class's tabs`,
      (await links.allTextContents()).join() ===
        "Today,Class map,Gradebook,Time,Workbooks,Roster",
    );
    await page.screenshot({
      path: `${output}/lone-teacher-${label}.png`,
    });
  } else {
    await page.getByRole("button", { name: "Open AMP menu" }).click();
    const drawer = page.getByRole("dialog");
    await drawer.waitFor();
    await drawer.getByRole("link", { name: "Gradebook" }).click();
    await page.getByRole("heading", { name: /grades$/ }).waitFor();
    await drawer.waitFor({ state: "detached" });
    check(
      `${label} the drawer carries the lone view`,
      page.url().includes("lone=1"),
    );
  }
  // Real routes: tabs are links with Back, Forward and refresh.
  await open(page, today, "Good morning, Ms. Okafor.");
  const tabs = page.getByRole("navigation", { name: "Class" });
  const active = tabs.locator('[aria-current="page"]');
  check(
    `${label} Today is the current tab`,
    (await active.textContent()) === "Today",
  );
  const tabBox = await tabs.getByRole("link", { name: "Today" }).boundingBox();
  await tabs.getByRole("link", { name: "Gradebook" }).click();
  await page.getByRole("heading", { name: "Quarter 2 grades" }).waitFor();
  await page.reload();
  await page.getByRole("heading", { name: "Quarter 2 grades" }).waitFor();
  check(
    `${label} the tab survives refresh`,
    (await tabs.locator('[aria-current="page"]').textContent()) === "Gradebook",
  );
  await page.goBack();
  await page.getByRole("heading", { name: /Good morning/ }).waitFor();
  const tabAfter = await tabs
    .getByRole("link", { name: "Today" })
    .boundingBox();
  check(
    `${label} an active tab changes no geometry`,
    tabBox?.width === tabAfter?.width && tabBox?.height === tabAfter?.height,
    { tabBox, tabAfter },
  );
}

try {
  // A first pass lets Vite finish optimizing the screens' dependencies.
  const warm = await browser.newPage();
  await warm.addInitScript(
    "navigator.sendBeacon = function () { return true; };",
  );
  await warm.route("**/api/**", (route) => route.fulfill({ json: {} }));
  for (const path of [today, gradebook, students]) {
    await warm.goto(origin + path);
    await warm.waitForTimeout(1500);
  }
  await warm.close();

  for (const width of widths)
    for (const theme of themes) {
      const label = `${width}-${theme}`;
      const context = await browser.newContext({
        viewport: { width, height: heightFor(width) },
        colorScheme: theme,
      });
      await context.addInitScript("globalThis.__name ??= (f) => f");
      await context.addInitScript(shiftRecorder);
      await context.addInitScript(
        "navigator.sendBeacon = function () { return true; };",
      );
      await context.route("**/api/**", (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path === "/api/auth/get-session")
          return route.fulfill({ json: null });
        if (path === "/api/v1/auth-config")
          return route.fulfill({
            json: {
              mode: "accounts",
              passwords: true,
              providers: [],
              passkeySignup: true,
            },
          });
        return route.fulfill({ json: {} });
      });
      const page = await context.newPage();
      page.on("pageerror", (error) =>
        failures.push(`${label} page error: ${error.message}`),
      );

      await open(page, today, "Good morning, Ms. Okafor.");
      await stable(page, `today ${label}`);
      await geometry(page, `today ${label}`);
      await page.screenshot({
        path: `${output}/today-${label}.png`,
        fullPage: true,
      });
      if (width >= 1024) {
        // The class map: its header stays in view as the page scrolls, and a
        // band reads out on hover without moving anything.
        const headerAt = await page
          .locator("thead th")
          .first()
          .evaluate((head) => {
            head.scrollIntoView();
            window.scrollBy(0, 400);
            return head.getBoundingClientRect().top;
          });
        check(
          `today ${label} the map's header sticks`,
          headerAt === 0,
          headerAt,
        );
        await page.locator("[data-tip]").nth(7).hover();
        await page.getByText("likely grade").first().waitFor();
        await page.mouse.move(0, 0);
        await page.evaluate(() => window.scrollTo(0, 0));
      }
      const walk = await focusWalk(page, 24);
      check(`today ${label} focus`, walk.problems.length === 0, walk.problems);
      await page.mouse.move(0, 0);

      // Today's actions: a sheet and a toast over the page, which holds still.
      await open(page, today, "Good morning, Ms. Okafor.");
      await resetRecord(page);
      const heading = await rect(page, "h1");
      await page
        .getByRole("button", { name: "Print a group sheet" })
        .first()
        .click();
      await page.getByText("Group sheet ready to print").waitFor();
      await page.getByRole("checkbox").first().check();
      check(
        `today ${label} heading holds through actions`,
        JSON.stringify(await rect(page, "h1")) === JSON.stringify(heading),
      );
      await page.getByRole("checkbox").first().uncheck();
      await page.getByRole("button", { name: "Dismiss message" }).click();
      await page.getByRole("button", { name: "Teach this lesson" }).click();
      const lesson = page.getByRole("dialog");
      await lesson.waitFor();
      await settle(page, 300);
      await geometry(page, `today lesson ${label}`);
      await page.screenshot({
        path: `${output}/today-lesson-${label}.png`,
      });
      await page.keyboard.press("Escape");
      await lesson.waitFor({ state: "detached" });
      await stable(page, `today actions ${label}`);

      await open(page, gradebook, "Quarter 2 grades");
      await stable(page, `gradebook ${label}`);
      await geometry(page, `gradebook ${label}`);
      check(
        `gradebook ${label} shows a range`,
        (await page.getByText("B to A−").count()) > 0 &&
          (await page.getByText("84–91").count()) > 0,
      );
      check(
        `gradebook ${label} shows too little work`,
        (await page.getByText("Not enough work yet").count()) === 1,
      );
      await page.screenshot({
        path: `${output}/gradebook-${label}.png`,
        fullPage: true,
      });
      await gradeState(page, `gradebook ${label}`, width);
      await open(page, gradebook, "Quarter 2 grades");
      const mode = await page
        .locator("[data-grid-mode]")
        .getAttribute("data-grid-mode");
      check(
        `gradebook ${label} draws the right form`,
        mode === (width < 640 ? "cards" : "table"),
        mode,
      );
      if (mode === "table") await gridKeyboard(page, `gradebook ${label}`);
      await open(page, gradebook, "Quarter 2 grades");
      await sheetBehavior(page, `gradebook ${label}`, width);
      await open(page, `${gradebook}?student=amara-osei`, "Quarter 2 grades");
      await page.getByRole("heading", { name: "Why this range" }).waitFor();
      await settle(page, 300);
      await geometry(page, `gradebook sheet ${label}`);
      await page.screenshot({
        path: `${output}/gradebook-sheet-${label}.png`,
      });
      await open(page, `${gradebook}?term=q3`, "Quarter 3 grades");
      await page.getByText("Quarter 3 starts January 5").waitFor();
      await geometry(page, `gradebook upcoming ${label}`);
      // A malformed shared link recovers.
      await open(
        page,
        `${gradebook}?term=bogus&student=nobody&sort=x`,
        "Quarter 2 grades",
      );
      check(
        `gradebook ${label} ignores a bad student`,
        (await page.getByRole("dialog").count()) === 0,
      );

      await longGrid(page, `${label}`, width);
      await frame(page, `${label}`, width);
      await context.close();
    }
  assert.deepEqual(failures, []);
  console.log(
    `School UI kit: ${widths.join(", ")} px, light and dark: geometry, shift, routes, grid keyboard, virtualization and sheet focus passed. Screenshots in ${output}.`,
  );
} finally {
  await browser.close();
  await vite.close();
}
