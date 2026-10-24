import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import {
  chromium,
  firefox,
  webkit,
  type BrowserContext,
  type Page,
} from "playwright";
import { createServer } from "vite";
import { buildApp } from "../src/server/app";
import { developmentAuth } from "../src/server/auth";
import { PostgresRepository } from "../src/server/repository";
import { figureCapabilities } from "../src/math/contracts";
import { generateProblem, gradeAnswer } from "../src/math/engine";
import {
  parseSelection,
  serializeSelection,
} from "../src/math/selection-response";
import { trialLimits } from "../src/server/trials";
import { migrate } from "./migrate";

/**
 * The free assessment's level check, against the real learning API: the
 * practice drawer's "Your level" link opens /try/map with a real route
 * (back returns to the same problem). Runs at 320x568, 384x700, 390x844,
 * 768x1024, 1024x768, 1180x820 and 1280x800, light and dark, and asserts no
 * horizontal overflow and nothing overlapping in the toolbar.
 */
const url = process.env.AMP_TEST_DATABASE_URL;
if (!url)
  throw new Error("AMP_TEST_DATABASE_URL is required for browser verification");
const FREE = 100;
const { placement: PLACEMENT } = trialLimits(FREE);
await migrate(url);
const repository = new PostgresRepository(url, {
  development: true,
  freeProblems: FREE,
});
const app = buildApp({
  repository,
  authenticate: developmentAuth(),
  development: true,
});
const apiPort = 4373,
  port = 4372;
await app.listen({ host: "127.0.0.1", port: apiPort });
const origin = `http://127.0.0.1:${port}`;
const vite = await createServer({
  root: new URL("../", import.meta.url).pathname,
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  cacheDir: "node_modules/.vite-level-check",
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
const engineName = process.env.LEVEL_BROWSER ?? "chromium";
const engine = { chromium, firefox, webkit }[engineName];
if (!engine) throw new Error(`Unknown LEVEL_BROWSER: ${engineName}`);
const browser = await engine.launch();
const shots =
  process.env.LEVEL_SCREENS ??
  new URL(`../artifacts/level-check/${engineName}/`, import.meta.url).pathname;
await mkdir(shots, { recursive: true });

/** A trial with `answers` problems answered through the API. */
async function trialWith(answers: number) {
  const created = await app.inject({
    method: "POST",
    url: "/api/v1/trials",
    payload: { birthYear: 2016 },
  });
  assert.equal(created.statusCode, 201, created.body);
  const { token, learnerId } = created.json() as {
    token: string;
    learnerId: string;
  };
  const headers = { authorization: `Trial ${token}` };
  for (let i = 0; i < answers; i++) {
    const batch = await app.inject({
      method: "POST",
      url: `/api/v1/learners/${learnerId}/batches`,
      headers,
      payload: {
        count: 1,
        responseCapabilities: ["single-choice-v1"],
        figureCapabilities: [...figureCapabilities],
      },
    });
    assert.equal(batch.statusCode, 200, batch.body);
    const problem = batch.json().problems[0];
    // Most answers right (from the generator), every fourth one wrong, so
    // the estimate settles at a believable level.
    const solution = generateProblem(problem.templateId, problem.seed);
    const response =
      i % 4 !== 3
        ? solution.answer
        : problem.response?.kind === "choice"
          ? problem.response.options.find(
              (o: { id: string }) => o.id !== solution.answer,
            ).id
          : "999999";
    const attempt = await app.inject({
      method: "POST",
      url: `/api/v1/learners/${learnerId}/attempts`,
      headers,
      payload: {
        problemId: problem.id,
        requestId: crypto.randomUUID(),
        response,
      },
    });
    assert.equal(attempt.statusCode, 200, attempt.body);
  }
  return { token, learnerId };
}

const servedProblems = new WeakMap<
  Page,
  Map<string, { id: string; templateId: string; seed: string }>
>();
async function open(
  theme: "light" | "dark",
  width: number,
  height: number,
  token: string,
) {
  const context = await browser.newContext({
    viewport: { width, height },
    colorScheme: theme,
  });
  await context.addInitScript(
    (value) => localStorage.setItem("amp.trial", value),
    token,
  );
  // Funnel beacons are recorded here, never sent on.
  const events: { event: string; props?: unknown }[] = [];
  await context.route("**/api/v1/events", async (route) => {
    const body = route.request().postDataJSON() as {
      events: { event: string; props?: unknown }[];
    };
    if (body) events.push(...body.events);
    await route.fulfill({ status: 204 });
  });
  const page = await context.newPage();
  if (engineName === "webkit") {
    // Playwright WebKit's inspector bridge can lose Blob-backed sendBeacon
    // requests during Back/Forward and omits Blob fetch bodies in postData.
    // Observe the emitted bytes and exercise AMP's real fetch fallback here;
    // Chromium/Firefox cover native beacons and network payload assertions.
    await page.exposeFunction("captureLevelEvents", (raw: string) => {
      events.push(...JSON.parse(raw).events);
    });
    await page.addInitScript(() => {
      navigator.sendBeacon = (_endpoint, body) => {
        if (body instanceof Blob)
          void body
            .text()
            .then((raw) =>
              (
                window as unknown as {
                  captureLevelEvents: (raw: string) => Promise<void>;
                }
              ).captureLevelEvents(raw),
            )
            .catch(() => {});
        return false;
      };
    });
  }
  page.setDefaultTimeout(15000);
  const served = new Map<
    string,
    { id: string; templateId: string; seed: string }
  >();
  servedProblems.set(page, served);
  page.on("response", async (response) => {
    if (!response.url().endsWith("/batches") || !response.ok()) return;
    const batch = await response.json();
    for (const problem of batch.problems ?? []) served.set(problem.id, problem);
  });
  const faults: string[] = [];
  page.on("pageerror", (error) => {
    faults.push(error.message);
    if (process.env.LEVEL_DEBUG) console.error("PAGE ERROR", error.stack);
  });
  if (process.env.LEVEL_DEBUG) {
    page.on("requestfailed", (r) =>
      console.error("FAILED REQUEST", r.url(), r.failure()),
    );
    page.on("console", (m) => {
      if (m.type() === "error") console.error("CONSOLE", m.text());
    });
  }
  return { context, page, events, faults };
}
async function frames(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}
async function fits(page: Page, label: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - innerWidth,
  );
  assert.ok(overflow <= 0, `${label}: no horizontal overflow (${overflow}px)`);
}
/** The toolbar's direct children never overlap and stay inside it. */
async function toolbarClean(page: Page, label: string) {
  const problems = await page.evaluate(() => {
    const bar = document.querySelector(".workspace-toolbar")!;
    const outer = bar.getBoundingClientRect();
    const kids = [...bar.children]
      .map((node) => ({
        name: node.className.toString(),
        rect: node.getBoundingClientRect(),
      }))
      .filter(({ rect }) => rect.width > 0 && rect.height > 0);
    const found: string[] = [];
    for (const { name, rect } of kids)
      if (rect.left < outer.left - 1 || rect.right > outer.right + 1)
        found.push(`${name} leaves the toolbar`);
    for (let i = 0; i < kids.length; i++)
      for (let j = i + 1; j < kids.length; j++) {
        const a = kids[i]!.rect,
          b = kids[j]!.rect;
        if (
          a.left < b.right - 1 &&
          b.left < a.right - 1 &&
          a.top < b.bottom - 1 &&
          b.top < a.bottom - 1
        )
          found.push(`${kids[i]!.name} overlaps ${kids[j]!.name}`);
      }
    return found;
  });
  assert.deepEqual(problems, [], `${label}: toolbar`);
}
async function shoot(page: Page, name: string, tag: string, full = false) {
  await page.mouse.move(0, 0);
  await frames(page);
  await page.screenshot({
    path: `${shots}/${name}-${tag}.png`,
    fullPage: full,
  });
}

/** Answers the current problem through the visible controls. */
async function answerOne(page: Page, correct: boolean) {
  // Next can still be awaiting its prefetched problem after the click returns.
  await page.locator(".next-action").waitFor({ state: "hidden" });
  await page.locator(".problem-stage .question").waitFor();
  const compact = page.locator(".compact-answer-action");
  if (await compact.isVisible()) await compact.click();
  const template = await page
    .locator(".problem-content")
    .getAttribute("data-template");
  const served = servedProblems.get(page)!;
  const problem = [...served.values()].find((p) => p.templateId === template);
  assert.ok(problem, `missing served problem for ${template}`);
  const solution = generateProblem(problem.templateId, problem.seed);
  const schema = solution.public.response;
  let response = solution.answer;
  if (!correct) {
    if (schema.kind === "choice")
      response = schema.options.find((o) => o.id !== solution.answer)!.id;
    else if (schema.kind === "multi-select") {
      const ids = parseSelection(solution.answer)!;
      const replacement = schema.options.find((o) => !ids.includes(o.id))!.id;
      response = serializeSelection([...ids.slice(1), replacement]);
    } else {
      // Preserve the family's response syntax (e.g. ordered pairs). A generic
      // "999999" can fail input validation and never submit an attempt.
      for (let i = 0; i < 20; i++) {
        const candidate = generateProblem(
          problem.templateId,
          `${problem.seed}:miss:${i}`,
        ).answer;
        if (!gradeAnswer(solution, candidate)) {
          response = candidate;
          break;
        }
      }
      assert.ok(
        !gradeAnswer(solution, response),
        `no valid wrong response for ${template}`,
      );
    }
  }
  const attempt = page.waitForResponse((r) => r.url().endsWith("/attempts"));
  if (schema.kind === "multi-select") {
    for (const id of parseSelection(response)!)
      await page
        .locator(`.multi-select-form:visible input[value="${id}"]`)
        .check();
    await page.locator(".choice-submit:visible").click();
  } else if (schema.kind === "choice") {
    await page
      .locator(".choice-option:visible")
      .nth(schema.options.findIndex((o) => o.id === response))
      .click();
    await page.locator(".choice-submit:visible").click();
  } else {
    const input = page.locator("#answer:visible");
    await input.fill(response);
    await input.press("Enter");
  }
  assert.equal((await attempt).status(), 200);
  served.delete(problem.id);
  await page.locator(".next-action").waitFor();
}
async function used(learnerId: string, token: string) {
  const response = await app.inject({
    method: "GET",
    url: `/api/v1/learners/${learnerId}/trial-progress`,
    headers: { authorization: `Trial ${token}` },
  });
  return response.json().totals.answered as number;
}
async function eventually(check: () => boolean, label: string) {
  for (let i = 0; i < 60 && !check(); i++)
    await new Promise((resolve) => setTimeout(resolve, 100));
  assert.ok(check(), label);
}
const checkTitle = "Here’s where we think you are";

const viewports = (
  [
    [320, 568],
    [384, 700],
    [390, 844],
    [768, 1024],
    [1024, 768],
    [1180, 820],
    [1280, 800],
  ] as const
).filter(
  ([width]) =>
    !process.env.LEVEL_WIDTHS ||
    process.env.LEVEL_WIDTHS.split(",").includes(String(width)),
);
assert.ok(
  viewports.length > 0,
  "LEVEL_WIDTHS must select at least one supported viewport",
);
if (process.env.LEVEL_WIDTHS !== undefined)
  for (const width of process.env.LEVEL_WIDTHS.split(","))
    assert.ok(
      viewports.some(([w]) => String(w) === width),
      `Unsupported LEVEL_WIDTHS value: ${width}`,
    );
const contexts: BrowserContext[] = [];
try {
  // Placement is over: practice opens on a problem, the map has a picture.
  const practicing = await trialWith(PLACEMENT + 3);
  for (const theme of ["light", "dark"] as const)
    for (const [width, height] of viewports) {
      const tag = `${width}x${height}-${theme}`;
      const { context, page, faults } = await open(
        theme,
        width,
        height,
        practicing.token,
      );
      contexts.push(context);
      await page.goto(`${origin}/try/practice`);
      await page.locator(".problem-stage .question").waitFor();
      const level = page.getByRole("button", { name: "Open AMP menu" });
      await level.waitFor();
      const target = await level.boundingBox();
      assert.ok(
        target && target.width >= 44 && target.height >= 44,
        `${tag}: the level control is a 44px target`,
      );
      await fits(page, `${tag} practice`);
      await toolbarClean(page, tag);
      await shoot(page, "nav-practice", tag);
      const question = await page
        .locator(".problem-stage .question")
        .textContent();

      // A real route: the map opens, back returns to the same problem.
      await level.click();
      await page.getByRole("link", { name: "Your level", exact: true }).click();
      await page.waitForURL("**/try/map*");
      await page.locator(".frontier-map").waitFor();
      await fits(page, `${tag} map`);
      assert.match(
        await page.getByTestId("level-readout").innerText(),
        /Working level[\s\S]*-?\d+\.\d{2}[\s\S]*Estimated range/,
      );
      await shoot(page, "level-map", tag);
      await page.goBack();
      await page.waitForURL("**/try/practice");
      await page.locator(".problem-stage .question").waitFor();
      assert.equal(
        await page.locator(".problem-stage .question").textContent(),
        question,
        `${tag}: back returns to the same problem`,
      );
      await page.goForward();
      await page.waitForURL("**/try/map*");
      await page.locator(".frontier-map").waitFor();
      // The map keeps its own way out of the trial.
      await page.getByRole("link", { name: "AMP home" }).waitFor();
      await page.reload();
      await page.locator(".frontier-map").waitFor();
      assert.deepEqual(faults, [], `${tag}: no page errors`);
      await context.close();
    }

  // The level check: after every fifth problem, between problems.
  let dismissal = 0;
  for (const theme of ["light", "dark"] as const)
    for (const [width, height] of viewports) {
      const tag = `${width}x${height}-${theme}`;
      const trial = await trialWith(PLACEMENT + 3);
      const { context, page, events, faults } = await open(
        theme,
        width,
        height,
        trial.token,
      );
      contexts.push(context);
      await page.goto(`${origin}/try/practice`);
      const dialog = page.getByRole("dialog", { name: checkTitle });
      await answerOne(page, true);
      await page.locator(".next-action").click();
      await answerOne(page, false);
      // The fifth problem's feedback is never covered.
      await page.waitForTimeout(400);
      assert.equal(await dialog.count(), 0, `${tag}: feedback stays readable`);
      await shoot(page, "check-before", tag);
      await page.locator(".next-action").click();
      await dialog.waitFor();
      await page.locator(".problem-stage .question").waitFor();
      assert.ok(page.url().endsWith("/try/practice"), `${tag}: same route`);
      const text = (await dialog.textContent()) ?? "";
      assert.match(text, /Level check · 25 answered/);
      assert.match(
        await dialog.getByTestId("level-readout").innerText(),
        /Working level[\s\S]*-?\d+\.\d{2}[\s\S]*Estimated range/,
      );
      assert.match(text, /You’re about 10 and have answered 25 problems/);
      assert.match(text, /Our current best guess is /);
      assert.match(text, /Keep answering and we’ll sharpen this\./);
      assert.ok(
        await dialog
          .getByRole("img", { name: /^Best guess over 25 problems/ })
          .count(),
        `${tag}: the trend is drawn and described`,
      );
      assert.ok(
        (await dialog.locator("li[data-strand]").count()) > 0,
        `${tag}: practiced areas are shown`,
      );
      await eventually(
        () =>
          events.some(
            (e) =>
              e.event === "level_check_view" &&
              (e.props as { index: number }).index === 25,
          ),
        `${tag}: level_check_view is recorded with its count`,
      );
      // Measure the resting sheet, not its entrance translation. Visibility
      // and the analytics beacon can both arrive before the animation ends.
      await dialog.evaluate(async (element) => {
        await Promise.all(
          element.getAnimations().map((animation) => animation.finished),
        );
      });
      // Over the next problem, which does not move beneath it.
      const prompt = page.locator("#problem-prompt");
      const before = await prompt.boundingBox();
      await fits(page, `${tag} level check`);
      const sheet = await dialog.boundingBox();
      assert.ok(
        sheet &&
          sheet.x >= 0 &&
          sheet.x + sheet.width <= width + 0.5 &&
          sheet.y >= 0 &&
          sheet.y + sheet.height <= height + 0.5,
        `${tag}: the level check fits the screen: ${JSON.stringify(sheet)}`,
      );
      for (const action of await dialog.locator("button, a").all())
        if (await action.isVisible()) {
          const box = await action.boundingBox();
          assert.ok(box && box.height >= 44, `${tag}: 44px actions`);
        }
      await shoot(page, "check-over-problem", tag);
      // Escape, a tap outside, or Continue: each closes it.
      let attempts = 0;
      page.on("request", (request) => {
        if (request.url().endsWith("/attempts")) attempts++;
      });
      const how = ["escape", "outside", "continue"][dismissal++ % 3];
      if (how === "escape") await page.keyboard.press("Escape");
      else if (how === "outside") await page.mouse.click(8, 8);
      else await dialog.getByRole("button", { name: "Continue" }).click();
      await dialog.waitFor({ state: "detached" });
      assert.deepEqual(
        await prompt.boundingBox(),
        before,
        `${tag}: the problem never moved (${how})`,
      );
      await page
        .waitForFunction(
          () =>
            document.activeElement ===
            document.querySelector("#problem-prompt"),
          undefined,
          { timeout: 1000 },
        )
        .catch(async () => {
          const active = await page.evaluate(
            () =>
              `${document.activeElement?.tagName}.${document.activeElement?.className}`,
          );
          assert.fail(
            `${tag}: focus returns to the problem (${how}: ${active})`,
          );
        });
      // It is not a problem: nothing was answered or used.
      assert.equal(attempts, 0, `${tag}: no answer was sent`);
      assert.equal(await used(trial.learnerId, trial.token), 25);
      await page.getByRole("button", { name: "Open AMP menu" }).click();
      await page
        .getByRole("progressbar", { name: "Free assessment problems used" })
        .waitFor();
      assert.equal(
        await page
          .getByRole("progressbar", { name: "Free assessment problems used" })
          .getAttribute("value"),
        "25",
        `${tag}: the budget remains 25`,
      );
      await page.keyboard.press("Escape");
      await page.waitForFunction(
        () =>
          document.activeElement?.getAttribute("aria-label") ===
          "Open AMP menu",
      );

      // The checkpoint opens earned pathways; back returns to the waiting problem.
      if (width === 390 || width === 1280) {
        for (let i = 0; i < 4; i++) {
          await answerOne(page, true);
          await page.locator(".next-action").click();
          await dialog.waitFor({ state: "detached" });
        }
        await answerOne(page, true);
        await page.locator(".next-action").click();
        await dialog.waitFor();
        assert.match((await dialog.textContent()) ?? "", /30 answered/);
        const shown = await prompt.textContent();
        const progress = await app.inject({
          method: "GET",
          url: `/api/v1/learners/${trial.learnerId}/progress`,
          headers: { authorization: `Trial ${trial.token}` },
        });
        assert.equal(progress.statusCode, 200, progress.body);
        const earned = progress
          .json()
          .skills.filter(
            (skill: { independentCorrect: number }) =>
              skill.independentCorrect > 0,
          ).length;
        assert.ok(earned > 0, `${tag}: the assessment earned visible skills`);
        await dialog.getByRole("link", { name: "See your full map" }).click();
        await page.waitForURL("**/pathways?context=trial");
        await page.locator(".pathways-canvas canvas").waitFor();
        // Compact maps omit explanatory status copy, but keep progress and resume visible.
        const resume = page.getByRole("link", {
          name: "Resume free assessment →",
          exact: true,
        });
        await resume.waitFor();
        assert.equal(await resume.getAttribute("href"), "/try/practice");
        await page
          .locator(".pathways-summary")
          .filter({ hasText: new RegExp(`^${earned} skills illuminated`) })
          .waitFor();
        assert.equal(
          await page.getByRole("combobox", { name: /^Learner/ }).count(),
          0,
        );
        await fits(page, `${tag}: earned pathways`);
        assert.equal(
          await used(trial.learnerId, trial.token),
          30,
          "exploring pathways does not consume an answer",
        );
        await page.goBack();
        await page.waitForURL("**/try/practice");
        await prompt.waitFor();
        assert.equal(
          await dialog.count(),
          0,
          `${tag}: no second check on return`,
        );
        assert.equal(
          await prompt.textContent(),
          shown,
          `${tag}: back returns to the waiting problem`,
        );
      }
      assert.deepEqual(faults, [], `${tag}: no page errors`);
      await context.close();
    }
  console.log(
    `Level check: every ${5} problems between problems (never over feedback), Escape / tap outside / Continue close it, no answer sent, count unchanged, the problem never moves, focus returns; "See your full map" → earned /pathways and back.`,
  );
  console.log(
    `Level check: AMP menu → Your level → /try/map (back, forward and refresh restore it) at ${viewports.map(([w, h]) => `${w}x${h}`).join(", ")} × light/dark; 44px navigation target, no overflow, no toolbar overlap.`,
  );
} finally {
  for (const context of contexts) await context.close().catch(() => {});
  await browser.close();
  await vite.close();
  await app.close();
  await repository.close();
}
