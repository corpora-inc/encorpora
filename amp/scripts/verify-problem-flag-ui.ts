import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { chromium, type Page } from "playwright";
import { createServer } from "vite";
import { buildApp } from "../src/server/app";
import { developmentAuth } from "../src/server/auth";
import { PostgresRepository } from "../src/server/repository";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { trialKey } from "../src/web/lib/pending-trial";
import { migrate } from "./migrate";
import { choose } from "./ui-controls";
import { assertTestDatabaseTarget } from "./test-database-preflight";

/**
 * "Report a problem", in a real browser against the real learning API.
 * The flag appears only on the feedback sheet, after Check. It opens a
 * compact sheet of reasons; Send is offered once a reason is chosen; a failed
 * send explains itself in reserved space; a sent report closes the sheet and
 * confirms with a fixed toast. Nothing on the feedback sheet moves (bounding
 * boxes and the browser's layout-shift entries), nothing overflows, and axe
 * is clean. A trial chooses reasons only; an adult learner in a parent's
 * account also gets the note. Runs at 384x700, 390x844 and 1280x800, light
 * and dark, and writes screenshots.
 */
const url = process.env.AMP_TEST_DATABASE_URL;
if (!url)
  throw new Error("AMP_TEST_DATABASE_URL is required for browser verification");
assertTestDatabaseTarget(url);
await migrate(url);
const repository = new PostgresRepository(url, { development: true });
// Another learner, as the shared CI database has from earlier suites.
await repository.create("development-household", "Younger learner", 2016);
const adult = await repository.create(
  "development-household",
  "Flag verification",
  1990,
);
const app = buildApp({
  repository,
  authenticate: developmentAuth(),
  development: true,
});
await registerFamilyRoutes(app, {
  pool: repository.pool,
  authenticate: developmentAuth(),
  development: true,
});
const apiPort = 4453,
  port = 4452,
  origin = `http://127.0.0.1:${port}`;
await app.listen({ host: "127.0.0.1", port: apiPort });
const vite = await createServer({
  root: new URL("../", import.meta.url).pathname,
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  cacheDir: "node_modules/.vite-problem-flag",
  server: {
    host: "127.0.0.1",
    port,
    strictPort: true,
    fs: {
      allow: [
        realpathSync(new URL("../", import.meta.url).pathname),
        realpathSync(new URL("../node_modules", import.meta.url).pathname),
      ],
    },
    proxy: { "/api": { target: `http://127.0.0.1:${apiPort}` } },
  },
});
await vite.listen();
const browser = await chromium.launch();
const shots =
  process.env.FLAG_SCREENS ??
  new URL("../artifacts/problem-flag/", import.meta.url).pathname;
await mkdir(shots, { recursive: true });

type Box = { x: number; y: number; width: number; height: number };
const box = async (page: Page, selector: string): Promise<Box> => {
  const found = await page.locator(selector).first().boundingBox();
  assert.ok(found, `${selector} is laid out`);
  return found;
};
const same = (a: Box, b: Box, label: string) =>
  assert.ok(
    Math.abs(a.x - b.x) < 0.5 &&
      Math.abs(a.y - b.y) < 0.5 &&
      Math.abs(a.width - b.width) < 0.5 &&
      Math.abs(a.height - b.height) < 0.5,
    `${label} moved: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`,
  );
async function settle(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}
async function noOverflow(page: Page, label: string) {
  const width = await page.evaluate(() =>
    Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
  );
  const viewport = page.viewportSize()!.width;
  assert.ok(width <= viewport + 1, `${label}: ${width}px > ${viewport}px`);
}
/** Axe over what this feature draws (the rest of practice has its own
 * suites). */
async function axe(page: Page, label: string, include: string[]) {
  let builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]);
  for (const selector of include) builder = builder.include(selector);
  const result = await builder.analyze();
  assert.deepEqual(
    result.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`),
    [],
    label,
  );
}
/** Answers the open problem with Check (a choice, or a typed number). */
async function answer(page: Page) {
  const report = page.getByRole("button", { name: "Report a problem" });
  assert.equal(await report.count(), 0, "no flag while the problem is open");
  const choice = page.locator(".choice-option").first();
  if (await choice.count()) await choice.click();
  else await page.locator("#answer").fill("7");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await page.locator(".feedback").waitFor();
  // The sheet's entrance animation.
  await page.waitForTimeout(400);
  await settle(page);
}
/** Layout shifts the browser recorded since the last call, with sources. */
async function shifts(page: Page) {
  return page.evaluate(() => {
    const record = globalThis as unknown as {
      __shifts: { value: number; sources: string[] }[];
    };
    const found = record.__shifts ?? [];
    record.__shifts = [];
    return found;
  });
}
const observeShifts = () => {
  const record = globalThis as unknown as {
    __shifts: { value: number; sources: string[] }[];
  };
  record.__shifts = [];
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const shift = entry as unknown as {
        value: number;
        sources?: {
          node?: Node;
          previousRect: DOMRectReadOnly;
          currentRect: DOMRectReadOnly;
        }[];
      };
      record.__shifts.push({
        value: shift.value,
        sources: (shift.sources ?? []).map(
          (source) =>
            `${source.node instanceof Element ? `${source.node.tagName}.${source.node.className}` : source.node?.nodeName} ${JSON.stringify(source.previousRect)} -> ${JSON.stringify(source.currentRect)}`,
        ),
      });
    }
  }).observe({ type: "layout-shift", buffered: true });
};

async function flagFlow(
  page: Page,
  label: string,
  options: { note: boolean; failFirst: boolean },
) {
  await answer(page);
  await shifts(page);
  const flag = page.getByRole("button", { name: "Report a problem" });
  await flag.waitFor();
  const sheet = await box(page, ".feedback");
  const next = await box(page, ".next-action");
  const flagBox = await box(page, ".report-problem");
  assert.ok(flagBox.width >= 44 && flagBox.height >= 44, `${label}: 44 px`);
  assert.ok(
    flagBox.x >= sheet.x &&
      flagBox.x + flagBox.width <= sheet.x + sheet.width + 0.5 &&
      flagBox.y >= sheet.y &&
      flagBox.y + flagBox.height <= sheet.y + sheet.height + 0.5,
    `${label}: the flag sits inside the feedback sheet`,
  );
  // It does not overlap the sheet's other actions.
  for (const other of await page
    .locator(".feedback .practice-tools button:not(.report-problem)")
    .all()) {
    const b = (await other.boundingBox())!;
    assert.ok(
      b.x + b.width <= flagBox.x + 0.5 ||
        flagBox.x + flagBox.width <= b.x + 0.5,
      `${label}: flag overlaps a tool`,
    );
  }
  await noOverflow(page, `${label} feedback`);
  await page.screenshot({ path: `${shots}${label}-1-feedback.png` });

  await flag.click();
  const dialog = page.getByRole("dialog", { name: "Report a problem" });
  await dialog.waitFor();
  await settle(page);
  const send = dialog.getByRole("button", { name: "Send", exact: true });
  assert.equal(await send.isDisabled(), true, "Send waits for a reason");
  for (const reason of [
    "The answer is wrong",
    "Confusing wording",
    "Figure looks wrong",
    "Too tedious",
    "Other",
  ]) {
    const chip = dialog.getByRole("button", { name: reason, exact: true });
    const b = (await chip.boundingBox())!;
    assert.ok(b.height >= 44, `${label}: ${reason} is a 44 px target`);
    // One line: a label never wraps.
    assert.ok(b.height < 60, `${label}: ${reason} wraps`);
  }
  const note = dialog.getByRole("textbox", { name: "Note (optional)" });
  assert.equal(await note.count(), options.note ? 1 : 0, `${label}: note`);
  await noOverflow(page, `${label} sheet`);
  await axe(page, `${label} sheet`, [".report-dialog"]);
  await page.screenshot({ path: `${shots}${label}-2-sheet.png` });

  const sendBefore = await box(page, ".report-send");
  const reason = options.note ? "Confusing wording" : "The answer is wrong";
  await dialog.getByRole("button", { name: reason, exact: true }).click();
  assert.equal(
    await dialog
      .getByRole("button", { name: reason, exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  if (options.note) await note.fill("The second sentence repeats the first.");
  await settle(page);
  same(sendBefore, await box(page, ".report-send"), `${label}: Send`);
  assert.equal(await send.isEnabled(), true);
  await page.screenshot({ path: `${shots}${label}-3-chosen.png` });

  if (options.failFirst) {
    await page.route("**/problem-flags", (route) => route.abort(), {
      times: 1,
    });
    await send.click();
    const error = dialog.getByRole("alert");
    await error.getByText("Your report wasn’t sent").waitFor();
    await settle(page);
    same(sendBefore, await box(page, ".report-send"), `${label}: error Send`);
    assert.equal(
      await dialog
        .getByRole("button", { name: reason, exact: true })
        .getAttribute("aria-pressed"),
      "true",
      "a failed send keeps the choice",
    );
    await page.screenshot({ path: `${shots}${label}-4-error.png` });
  }
  await send.click();
  await dialog.waitFor({ state: "detached" });
  const toast = page.getByText("Thank you. Your report was sent.", {
    exact: true,
  });
  await toast.waitFor();
  await settle(page);
  const position = await toast.evaluate((element) => {
    for (let node: Element | null = element; node; node = node.parentElement)
      if (getComputedStyle(node).position === "fixed") return "fixed";
    return "static";
  });
  assert.equal(position, "fixed", `${label}: the toast overlays`);
  // Nothing on the sheet moved while reporting.
  same(sheet, await box(page, ".feedback"), `${label}: sheet`);
  same(next, await box(page, ".next-action"), `${label}: Next`);
  same(flagBox, await box(page, ".report-problem"), `${label}: flag`);
  const toastBox = await toast.boundingBox();
  assert.ok(
    toastBox && toastBox.y + toastBox.height <= next.y,
    `${label}: the toast leaves Next clear`,
  );
  assert.deepEqual(
    await shifts(page),
    [],
    `${label}: the browser recorded a layout shift`,
  );
  await page
    .getByRole("button", { name: "Problem reported", exact: true })
    .waitFor();
  await noOverflow(page, `${label} sent`);
  await axe(page, `${label} sent`, [
    ".feedback .practice-tools",
    ".feedback-head",
  ]);
  await page.screenshot({ path: `${shots}${label}-5-sent.png` });
}

const errors: string[] = [];
try {
  for (const viewport of [
    { width: 384, height: 700 },
    { width: 390, height: 844 },
    { width: 1280, height: 800 },
  ])
    for (const colorScheme of ["light", "dark"] as const) {
      const label = `${viewport.width}x${viewport.height}-${colorScheme}`;
      const context = await browser.newContext({
        viewport,
        colorScheme,
        hasTouch: viewport.width < 650,
      });
      // A trial: anonymous, so reasons only.
      const created = await (
        await fetch(`http://127.0.0.1:${apiPort}/api/v1/trials`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ birthYear: 2016 }),
        })
      ).json();
      await context.addInitScript(
        ([key, token]) => localStorage.setItem(key!, token!),
        [trialKey, created.token],
      );
      await context.addInitScript(observeShifts);
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${origin}/try/practice`);
      await page.locator(".question").waitFor();
      await flagFlow(page, `trial-${label}`, {
        note: false,
        failFirst: colorScheme === "light",
      });
      const stored = await repository.pool.query(
        "SELECT reasons,outcome,viewport_width,client_kind,note FROM amp_problem_flags WHERE learner_id=$1",
        [created.learnerId],
      );
      assert.equal(stored.rowCount, 1, `${label}: one report, not two`);
      assert.deepEqual(stored.rows[0].reasons, ["wrong-answer"]);
      assert.equal(stored.rows[0].viewport_width, viewport.width);
      assert.equal(stored.rows[0].client_kind, "web");
      assert.equal(stored.rows[0].note, null);
      await context.close();
    }

  // An adult learner in a parent's account also gets the note.
  for (const colorScheme of ["light", "dark"] as const) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      colorScheme,
      hasTouch: true,
    });
    await context.addInitScript(observeShifts);
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    // The shared CI database holds other suites' learners: pick this one.
    await page.goto(origin);
    await choose(
      page.getByRole("button", { name: "Learner", exact: true }),
      adult.id,
    );
    await page.goto(`${origin}/lessons?strand=data&topic=mean-data`);
    await page
      .getByRole("button", { name: "Practice this", exact: true })
      .click();
    await page.locator(".question").waitFor();
    await flagFlow(page, `adult-390x844-${colorScheme}`, {
      note: true,
      failFirst: false,
    });
    await context.close();
  }
  const notes = await repository.pool.query(
    "SELECT note FROM amp_problem_flags WHERE learner_id=$1",
    [adult.id],
  );
  assert.deepEqual(
    notes.rows.map((row) => row.note),
    [
      "The second sentence repeats the first.",
      "The second sentence repeats the first.",
    ],
  );
  assert.deepEqual(errors, []);
  console.log(`Problem flag UI verified; screenshots in ${shots}`);
} finally {
  await browser.close();
  await vite.close();
  await app.close();
  await repository.close();
}
