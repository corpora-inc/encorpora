import { secureChromium } from "../browser-security.mjs";
import { addChildInSheet } from "./lib/add-child";
import {
  chooseLearner,
  currentLearner,
  navigateApp,
  practiceHere,
  returnToParent,
} from "./ui-controls";
import { typeSizes } from "../src/math/scene/type";
import {
  answerSurfaceSettled,
  assertFigureTextScale,
  assertPhoneLandscapeSmoke,
  assertProblemReachable,
  figureTextScale,
  isPhoneLandscape,
  isTabletLandscape,
  PHONE_LANDSCAPE,
  PHONE_REAL_BROWSERS,
  problemInView,
  TABLET_LANDSCAPE,
  TABLET_LANDSCAPE_LARGE,
  TABLETS,
} from "./ui-viewports";
import {
  exitPractice,
  openTopicLesson,
  resume,
  startTopic,
} from "./ui-practice";
import { algebraDefinitions } from "../src/content/algebra-definitions.js";
import { equalGroupsDefinitions } from "../src/content/equal-groups-definitions.js";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { chromium as rawChromium, type Page } from "playwright";
const chromium = secureChromium(rawChromium);
import { createServer } from "vite";
import { mkdir, rm, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { waitForLayers } from "./layer-probe";
import { buildApp, GLOBAL_RATE_LIMIT } from "../src/server/app";
import { PostgresRepository } from "../src/server/repository";
import { developmentAuth } from "../src/server/auth";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";
import { templates } from "../src/math/engine";
import { uiSweepManifest, uiSweepPartition } from "./ui-sweep-partition";
import { captureUiFailure } from "./ui-failure-receipt";
const inventoryIds = templates.map((template) => template.id);
const sweep = uiSweepPartition(inventoryIds);
const selectedIds = new Set(sweep.selectedIds);
const completedIds: string[] = [];
const manifestPath = new URL(
  `../artifacts/ui-sweep/shard-${sweep.shardIndex}.json`,
  import.meta.url,
);
const failureDirectory = new URL("../artifacts/ui-failure/", import.meta.url)
  .pathname;
await rm(failureDirectory, { recursive: true, force: true });
// A failed rerun must never leave stale completion evidence behind.
if (!sweep.skip) await rm(manifestPath, { force: true });
console.log("UI review: script started");
const startedAt = Date.now();
let phase = "setup";
function progress(next: string) {
  phase = next;
  console.log(
    `UI review (${Math.round((Date.now() - startedAt) / 1000)}s): ${phase}`,
  );
}
async function within<T>(
  work: Promise<T>,
  label: string,
  timeout = 15_000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${phase}: timed out waiting for ${label}`)),
          timeout,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
const url = process.env.AMP_TEST_DATABASE_URL;
if (!url)
  throw new Error("AMP_TEST_DATABASE_URL is required for browser verification");
assertTestDatabaseTarget(url);
await migrate(url);
const repository = new PostgresRepository(url, { development: true });
const account = "development-household";
const learner = await repository.create(account, "Browser verification", 2016);
const learnerIds = [learner.id];

async function preserveFailure(page: Page, directory: string, detail: string) {
  try {
    await within(
      captureUiFailure(page, directory, detail, async (id) => {
        // pg supports query_timeout at runtime; the installed QueryConfig
        // declarations omit that option. Keep it on the submitted config.
        const query = {
          text: "SELECT content->'public' AS problem FROM amp_instances WHERE id=$1 AND learner_id=ANY($2::text[])",
          values: [id, learnerIds],
          query_timeout: 1_000,
        };
        const result = await repository.pool.query(query);
        return result.rows[0]?.problem;
      }),
      "failure diagnostics",
      5_000,
    );
  } catch {
    console.error(
      "UI failure diagnostics could not finish; preserving the original failure.",
    );
  }
}
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
// Its ports and Vite cache may be moved (a worktree's own range).
const WEB_PORT = Number(process.env.AMP_UI_WEB_PORT ?? 4350);
const ORIGIN = `http://127.0.0.1:${WEB_PORT}`;
await app.listen({ host: "127.0.0.1", port: WEB_PORT + 1 });
const vite = await createServer({
  root: new URL("../", import.meta.url).pathname,
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  cacheDir: process.env.AMP_VITE_CACHE_DIR ?? "node_modules/.vite-ui-review",
  server: {
    host: "127.0.0.1",
    port: WEB_PORT,
    strictPort: true,
    proxy: { "/api": { target: `http://127.0.0.1:${WEB_PORT + 1}` } },
  },
});
await vite.listen();
const browser = await chromium.launch({ headless: true });
let diagnosticPage: Page | undefined;
await mkdir(new URL("../artifacts/screenshots/", import.meta.url), {
  recursive: true,
});
try {
  const page = await browser.newPage({ hasTouch: true });
  // tsx names the helpers inside page functions (`__name`); every document
  // the journey opens has the page-side shim.
  await page.addInitScript("globalThis.__name ??= (f) => f");
  diagnosticPage = page;
  page.setDefaultTimeout(15_000);
  page.setDefaultNavigationTimeout(30_000);
  progress("initial lesson and practice navigation");
  const errors: string[] = [];
  let windowStart = Date.now(),
    requestsInWindow = 0;
  page.on("request", (request) => {
    if (!request.url().includes("/api/")) return;
    if (Date.now() - windowStart >= 60_000) {
      windowStart = Date.now();
      requestsInWindow = 0;
    }
    requestsInWindow++;
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${ORIGIN}/overview`);
  // The parent hands the device to the child, whose practice is their own.
  await practiceHere(page, learner.id);
  await page.goto(`${ORIGIN}/lessons?strand=data&topic=mean-data`);
  await page.getByRole("link", { name: /^Practice/ }).waitFor();
  await page.reload();
  await page.getByRole("link", { name: /^Practice/ }).waitFor();
  // The lesson is a layer over Pathways, in its layers (never its
  // address), which a reload keeps.
  assert.equal(new URL(page.url()).searchParams.get("open"), null);
  await waitForLayers(page, ["lesson:mean-data"]);
  await page.getByRole("link", { name: /^Practice/ }).click();
  // Navigation intentionally cancels pending batches; establish practice first.
  await page.locator(".problem-stage").waitFor();
  // CI measures with a device font (scripts/ci-fonts.conf); prove the prompt
  // renders in it, so a silent fallback cannot make every fit check wrong.
  if (process.env.AMP_EXPECT_UI_FONT) {
    await page.locator(".question > span").first().waitFor();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");
    const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
    const { nodeId } = await cdp.send("DOM.querySelector", {
      nodeId: root.nodeId,
      selector: ".question > span",
    });
    const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", {
      nodeId,
    });
    assert.equal(
      fonts[0]?.familyName,
      process.env.AMP_EXPECT_UI_FONT,
      `Practice prompt renders in ${JSON.stringify(fonts)}`,
    );
    await cdp.detach();
  }
  progress("practice viewports and answer controls");
  for (const viewport of [
    { width: 1280, height: 1000 },
    { width: 390, height: 844 },
    ...PHONE_REAL_BROWSERS,
    { width: 320, height: 720 },
    { width: 320, height: 568 },
    ...TABLETS,
    PHONE_LANDSCAPE,
  ]) {
    await page.setViewportSize(viewport);
    await resume(page);
    // Let the resize event apply the practice viewport height.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await page.locator(".problem-stage").waitFor();
    if (isPhoneLandscape(viewport)) {
      // Phone landscape is a smoke target: usable and scrollable, not fitted.
      await assertPhoneLandscapeSmoke(page, "Practice");
      await page.screenshot({
        path: new URL(
          `../artifacts/screenshots/practice-${viewport.width}.png`,
          import.meta.url,
        ).pathname,
      });
      continue;
    }
    const fit = await page.evaluate(() => {
      const stage = document.querySelector(".problem-stage")!;
      const action = document.querySelector(
        ".compact-answer-action, .answer-action",
      )!;
      return {
        stage: stage.clientHeight,
        content: stage.scrollHeight,
        actionBottom: Math.round(action.getBoundingClientRect().bottom),
        height: innerHeight,
      };
    });
    // The question keeps its minimum and the answer action stays on screen;
    // the problem fits or scrolls cleanly from its first line.
    assert.ok(
      fit.stage >= 180 && fit.actionBottom <= fit.height,
      `Question and answer action must fit ${viewport.width}×${viewport.height}: ${JSON.stringify(fit)}`,
    );
    await assertProblemReachable(
      page,
      `Practice ${viewport.width}×${viewport.height}`,
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Viewport must not overflow at ${viewport.width}px`,
    );
    await page.screenshot({
      path: new URL(
        `../artifacts/screenshots/practice-${viewport.width}x${viewport.height}.png`,
        import.meta.url,
      ).pathname,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 320, height: 568 });
  await page
    .getByRole("button", { name: "Enter your answer", exact: true })
    .click();
  await page.getByRole("button", { name: "1", exact: true }).click();
  assert.equal(await page.locator("#answer").inputValue(), "1");
  await page.getByRole("button", { name: "Close panel", exact: true }).click();
  await page.getByRole("button", { name: "Lesson", exact: true }).click();
  await page.locator(".problem-lesson").waitFor();
  await page.keyboard.press("Escape");
  assert.equal(
    await page.evaluate(() => document.activeElement?.textContent),
    "Lesson",
  );
  await page.getByRole("button", { name: /Your answer: 1/ }).click();
  await page.locator("#answer").fill("999");
  // The same skill includes multipart problems. Exercise that next-problem
  // transition deterministically instead of depending on a random family draw.
  await page.route(
    "**/api/v1/learners/*/batches",
    (route) =>
      route.continue({
        postData: JSON.stringify({
          ...route.request().postDataJSON(),
          templateId: "mean-median-blanks",
        }),
      }),
    { times: 1 },
  );
  await page.getByRole("button", { name: "Check" }).click();
  await page.locator(".solution-panel").waitFor();
  assert.match(
    await page.locator(".solution-panel").innerText(),
    /with (a hint|the lesson)/i,
  );
  await page.keyboard.press("Escape");
  // Feedback can render before the answer dialog's close/focus effects commit.
  // Observe the actual restored focus, rather than sampling the interim body.
  await page.waitForFunction(
    () => document.activeElement === document.querySelector(".next-action"),
    undefined,
    { timeout: 2_000 },
  );
  assert.equal(
    await page.evaluate(() => document.activeElement?.textContent),
    "Next →",
  );
  const practiceHistoryLength = await page.evaluate(() => history.length);
  // Leave the answered problem scrolled down (a temporary spacer makes any
  // problem scroll): the next problem must open at its prompt's first line.
  const answeredPrompt = await page.locator(".question").innerText();
  assert.ok(
    await page.locator(".problem-stage").evaluate((stage) => {
      stage.style.paddingBottom = "2000px";
      stage.scrollTop = 600;
      return stage.scrollTop > 0;
    }),
  );
  await page.getByRole("button", { name: "Next", exact: false }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  // The answered problem stays mounted until the next one arrives. The shared
  // controls cover typed answers, choices, multipart and graphical responses.
  await page.locator(".solution-panel").waitFor({ state: "detached" });
  await page.locator(".answer-controls").waitFor();
  assert.equal(
    await page.locator(".problem-content").getAttribute("data-template"),
    "mean-median-blanks",
  );
  const opened = await page.locator(".problem-stage").evaluate((stage) => {
    const top = stage.scrollTop;
    stage.style.paddingBottom = "";
    return top;
  });
  if ((await page.locator(".question").innerText()) !== answeredPrompt)
    assert.equal(opened, 0, "The next problem opens scrolled to its prompt");
  assert.equal(
    await page.evaluate(() => history.length),
    practiceHistoryLength,
    "next problem does not add a screen history entry",
  );
  // Mixed scheduling may choose a book-backed family; select the legacy lesson
  // explicitly before testing the lifecycle of its lesson-support request.
  await startTopic(page, "mean-data");
  await page.locator("#answer").waitFor();
  // A malformed answer is caught at the input: no request, nothing moves.
  {
    let attempts = 0;
    const count = (request: { url(): string }) => {
      if (request.url().endsWith("/attempts")) attempts++;
    };
    page.on("request", count);
    const before = (await page.locator(".question").boundingBox())!.y;
    await page.locator("#answer").fill("not a number");
    await page.getByRole("button", { name: "Check", exact: true }).click();
    await page.locator(".answer-error").waitFor();
    assert.equal(attempts, 0);
    assert.equal((await page.locator(".question").boundingBox())!.y, before);
    assert.equal(await page.locator(".shell > .error").count(), 0);
    await page.locator("#answer").fill("");
    await page.locator(".answer-error").waitFor({ state: "detached" });
    page.off("request", count);
  }
  progress("held lesson and next-problem requests");
  // The request names the film capability it can play (`?film=`).
  const LESSON_SUPPORT = /\/lesson-support(?:\?|$)/;
  let releaseLesson!: () => void;
  let heldLesson!: () => void;
  const held = new Promise<void>((resolve) => {
    heldLesson = resolve;
  });
  const release = new Promise<void>((resolve) => {
    releaseLesson = resolve;
  });
  await page.route(LESSON_SUPPORT, async (route) => {
    const result = await route.fetch();
    heldLesson();
    await release;
    await route.fulfill({ response: result });
  });
  await page.getByRole("button", { name: "Lesson", exact: true }).click();
  await within(held, "lesson-support request");
  let releaseNext!: () => void;
  const nextHeld = new Promise<void>((resolve) => {
    releaseNext = resolve;
  });
  await page.route("**/batches", async (route) => {
    const result = await route.fetch();
    await nextHeld;
    await route.fulfill({ response: result });
  });
  await page.locator("#answer").fill("999999");
  await page.getByRole("button", { name: "Check" }).click();
  await page.locator(".solution-panel").waitFor();
  // Next waits on the held, already-requested problem; the lesson that was
  // requested for the answered problem must not open meanwhile.
  await page.getByRole("button", { name: "Next", exact: true }).click();
  const delivered = page.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith("/lesson-support"),
  );
  releaseLesson();
  await delivered;
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  assert.equal(
    await page.locator("dialog[open]").count(),
    0,
    "A stale lesson response cannot open another problem's lesson",
  );
  const nextDelivered = page.waitForResponse((response) =>
    response.url().endsWith("/batches"),
  );
  releaseNext();
  await nextDelivered;
  await page.locator(".problem-stage .problem-content").waitFor();
  await page.unroute("**/batches");
  await page.unroute(LESSON_SUPPORT);
  /** Landscape tablets put the answer beside the problem. Every state there
   * (hint, a malformed answer, feedback, the next problem) keeps the problem
   * still, stays in its own column and keeps 44 px targets. */
  async function verifyTabletStates() {
    for (const size of [TABLET_LANDSCAPE, TABLET_LANDSCAPE_LARGE]) {
      await page.setViewportSize(size);
      await startTopic(page, "mean-data");
      await page.locator("#answer").waitFor();
      const label = `Tablet ${size.width}×${size.height}`;
      const boxes = () =>
        page.evaluate(() => {
          const rect = (selector: string) => {
            const r = document.querySelector(selector)?.getBoundingClientRect();
            return r && [r.left, r.top, r.right, r.bottom].map(Math.round);
          };
          return {
            question: rect(".problem-content .question"),
            figure: rect(".problem-content > :not(.question)"),
            stage: rect(".problem-stage"),
            dock: rect(".practice-surface > .answer-dock"),
          };
        });
      const still = await boxes();
      const [, , stageRight] = still.stage!;
      const [dockLeft, dockTop, dockRight, dockBottom] = still.dock!;
      assert.ok(
        dockLeft >= stageRight,
        `${label}: the answer sits beside the problem ${JSON.stringify(still)}`,
      );
      assert.deepEqual(
        await problemInView(page),
        [],
        `${label}: whole problem`,
      );
      for (const target of await page
        .locator(
          ".answer-dock button:visible, .answer-dock input:visible, .workspace-toolbar button:visible",
        )
        .all()) {
        const b = (await target.boundingBox())!;
        assert.ok(
          b.height >= 44 && b.width >= 44,
          `${label}: ${(await target.getAttribute("aria-label")) ?? (await target.innerText())} is ${b.width}×${b.height}`,
        );
      }
      // Capture settled styles without awaiting animation promises that reject
      // when a loading element is removed or its transition is replaced.
      const shot = async (name: string) => {
        await page.screenshot({
          animations: "disabled",
          path: new URL(
            `../artifacts/screenshots/tablet-${size.width}-${name}.png`,
            import.meta.url,
          ).pathname,
        });
      };
      await shot("answer");
      // The hint opens over the page and closes back to the same problem.
      await page.getByRole("button", { name: "Hint", exact: true }).click();
      await page.locator("dialog[open] .hint").waitFor();
      await page
        .locator("dialog[open] .hint:not(:has-text('Finding'))")
        .waitFor();
      assert.deepEqual(await boxes(), still, `${label}: hint moved the page`);
      await shot("hint");
      await page.keyboard.press("Escape");
      await page.locator("dialog[open]").waitFor({ state: "detached" });
      // A malformed answer is explained beside the field, in the answer column.
      await page.locator("#answer").fill("not a number");
      await page.getByRole("button", { name: "Check", exact: true }).click();
      const error = (await page.locator(".answer-error").boundingBox())!;
      const field = (await page.locator("#answer").boundingBox())!;
      assert.ok(
        error.x >= dockLeft - 1 &&
          error.x + error.width <= dockRight + 1 &&
          error.y >= dockTop - 1 &&
          error.y + error.height <= field.y,
        `${label}: answer error ${JSON.stringify(error)} beside the field`,
      );
      assert.deepEqual(
        await boxes(),
        still,
        `${label}: the error moved the page`,
      );
      await shot("error");
      await page.locator("#answer").fill("999999");
      await page.getByRole("button", { name: "Check", exact: true }).click();
      await page.locator(".solution-panel").waitFor();
      await within(
        page
          .locator(".solution-panel")
          .evaluate((sheet) =>
            Promise.all(sheet.getAnimations().map((a) => a.finished)),
          ),
        "feedback animation",
      );
      // Feedback replaces the answer column, not the problem.
      const sheet = (await page.locator(".solution-panel").boundingBox())!;
      assert.ok(
        sheet.x >= dockLeft - 1 &&
          sheet.x + sheet.width <= dockRight + 1 &&
          sheet.y >= dockTop - 1 &&
          sheet.y + sheet.height <= dockBottom + 1,
        `${label}: feedback ${JSON.stringify(sheet)} fills the answer column ${still.dock}`,
      );
      assert.deepEqual(
        await boxes(),
        still,
        `${label}: feedback moved the page`,
      );
      const steps = page.locator(".feedback-steps");
      if (await steps.count()) {
        assert.equal(await steps.getAttribute("tabindex"), "0");
        assert.equal(await steps.getAttribute("aria-label"), "Explanation");
      }
      for (const target of await page
        .locator(".solution-panel button:visible")
        .all()) {
        // A glossary word in the explanation keeps the line box of plain
        // text; its 44 px target is its ::after hit area (glossary.css,
        // hit-tested by verify-glossary-ui).
        const b = await target.evaluate((el) => {
          const box = el.getBoundingClientRect();
          if (!el.classList.contains("glossary-term"))
            return { width: box.width, height: box.height };
          const hit = getComputedStyle(el, "::after");
          return {
            width: Math.max(box.width, parseFloat(hit.width) || 0),
            height: Math.max(box.height, parseFloat(hit.height) || 0),
          };
        });
        assert.ok(
          b.height >= 44 && b.width >= 44,
          `${label}: feedback target ${await target.innerText()} is ${b.width}×${b.height}`,
        );
      }
      await shot("feedback");
      await page.emulateMedia({ colorScheme: "dark" });
      await shot("feedback-dark");
      await page.emulateMedia({ colorScheme: "light" });
      await page.getByRole("button", { name: "Next", exact: false }).click();
      await page.locator(".solution-panel").waitFor({ state: "detached" });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${label}: no horizontal overflow`,
      );
    }
  }
  progress("tablet answer and feedback states");
  await verifyTabletStates();
  // Tablets in both orientations show a figure problem whole, without
  // scrolling. Measured per template; the rare very tall problem may scroll
  // cleanly instead, and is listed rather than failing the sweep.
  const tabletScrolls = new Map<string, string[]>();
  progress(
    `${sweep.selectedIds.length}/${templates.length} templates: viewport fit sweep (partition ${sweep.shardIndex}/${sweep.shardCount}${sweep.skip ? "; explicitly skipped in broad lane" : ""})`,
  );
  for (const [index, template] of templates.entries()) {
    if (!selectedIds.has(template.id)) continue;
    progress(
      `template ${index + 1}/${templates.length} (${completedIds.length + 1}/${sweep.selectedIds.length} in partition): ${template.id}`,
    );
    // Respect the real server rate limit during this accelerated catalog sweep.
    if (requestsInWindow > GLOBAL_RATE_LIMIT * 0.75) {
      const wait = Math.max(0, 60_100 - (Date.now() - windowStart));
      console.log(`${phase}: respecting rate limit for ${wait}ms`);
      await page.waitForTimeout(wait);
    }
    await within(
      (async () => {
        // Read the current answer form where every surface is inline, before
        // testing compact viewports that can hide it behind the answer dialog.
        await page.setViewportSize({ width: 1280, height: 900 });
        await startTopic(page, template.id, { entry: "lesson-url" }).catch(
          async (failure) => {
            console.error(
              "Lesson navigation failed",
              template.id,
              new URL(page.url()).pathname,
              await page.locator("body").innerText(),
            );
            throw failure;
          },
        );
        // startTopic waited for this template's problem. Structured work may
        // scroll its answer rows on a tablet; they have their own check.
        const structured = (await page.locator(".work-form").count()) > 0;
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `Overflow in ${template.id}`,
        );
        // Real phone browsers (their bars showing) and tablets are strict: the
        // problem fits or scrolls cleanly, never clipped or hidden under the dock.
        for (const size of [
          { width: 390, height: 844 },
          ...PHONE_REAL_BROWSERS,
          { width: 320, height: 568 },
          ...TABLETS,
          PHONE_LANDSCAPE,
        ]) {
          await page.setViewportSize(size);
          await answerSurfaceSettled(page).catch((failure) => {
            // Name the problem type and viewport; the timeout alone does not.
            throw new Error(
              `${template.id} ${size.width}×${size.height}: the answer surface did not follow the viewport`,
              { cause: failure },
            );
          });
          if (isPhoneLandscape(size)) {
            await assertPhoneLandscapeSmoke(page, template.id);
            continue;
          }
          await assertProblemReachable(
            page,
            `${template.id} ${size.width}×${size.height}`,
          );
          // Figure labels never outgrow the prompt or the figure type sizes,
          // however much room the layout gives the figure.
          assertFigureTextScale(
            await figureTextScale(page),
            `${template.id} ${size.width}×${size.height}`,
            typeSizes.lg,
            size.width >= 768,
          );
          if (TABLETS.some((t) => t.width === size.width)) {
            const why = await problemInView(page, {
              allowStructuredWorkScroll: structured,
            });
            if (why.length) {
              const key = `${size.width}×${size.height}`;
              tabletScrolls.set(key, [
                ...(tabletScrolls.get(key) ?? []),
                `${template.id}: ${why[0]}`,
              ]);
              if (isTabletLandscape(size))
                await page.screenshot({
                  path: new URL(
                    `../artifacts/screenshots/tablet-scroll-${template.id}-${size.width}.png`,
                    import.meta.url,
                  ).pathname,
                });
            }
          }
          if (
            size.width === 320 &&
            [...equalGroupsDefinitions, ...algebraDefinitions].some(
              (d) => d.id === template.id,
            )
          )
            await page.screenshot({
              path: new URL(
                `../artifacts/screenshots/${template.id}-compact.png`,
                import.meta.url,
              ).pathname,
            });
          if (template.id === "fraction-group-count" && size.width === 320)
            await page.screenshot({
              path: new URL(
                "../artifacts/screenshots/fraction-group-count-compact.png",
                import.meta.url,
              ).pathname,
              fullPage: true,
            });
        }
        await page.setViewportSize({ width: 390, height: 844 });
        if (
          template.id.startsWith("graphed-") ||
          template.id.startsWith("clock-") ||
          template.id.startsWith("bar-chart-")
        )
          await page.screenshot({
            path: new URL(
              `../artifacts/screenshots/${template.id}.png`,
              import.meta.url,
            ).pathname,
            fullPage: true,
          });
      })(),
      "template viewport checks",
      60_000,
    );
    completedIds.push(template.id);
  }
  progress(
    `all ${completedIds.length} selected templates completed; checking tablet totals`,
  );
  for (const size of TABLETS) {
    const key = `${size.width}×${size.height}`;
    const scrolled = tabletScrolls.get(key) ?? [];
    // A report, not a gate: a problem that scrolls on a tablet must still be
    // reachable, which assertProblemReachable enforces above.
    console.log(
      `Tablet ${key}: ${completedIds.length - scrolled.length} of ${completedIds.length} selected questions and figures fit without scrolling.${scrolled.length ? `\n  ${scrolled.join("\n  ")}` : ""}`,
    );
  }
  // Lessons: every problem type has its own short lesson, a layer over the
  // learner's Pathways (no library destination of its own).
  progress("lesson sheet and section navigation");
  await exitPractice(page);
  await openTopicLesson(page, "mean-data");
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "detached" });
  // The shared logo keeps its geometry across the child's destinations.
  const sections: string[] = [];
  for (const section of ["Progress", "Practice"] as const) {
    await navigateApp(page, section);
    await page.locator("[data-app-bar]").waitFor();
    sections.push(
      await page.locator("[data-navigation-trigger]").evaluate((element) => {
        const r = element.getBoundingClientRect();
        return [r.x, r.y, r.width, r.height].map(Math.round).join(",");
      }),
    );
  }
  assert.equal(
    new Set(sections).size,
    1,
    `Logo moved: ${sections.join(" / ")}`,
  );
  // The detailed progress reader retains its own address.
  await page.goto(`${ORIGIN}/progress`);
  await page.locator(".progress-skill-card").first().waitFor();
  // The navigation drawer leaves the page in place and returns keyboard focus.
  progress("navigation drawer geometry and focus");
  const familyMenu = page.getByRole("button", {
    name: "Open AMP menu",
    includeHidden: true,
  });
  const familyList = page.getByRole("dialog", {
    name: "Adaptive Math Pathways",
  });
  for (const size of [
    { width: 384, height: 800 },
    { width: 320, height: 568 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(size);
    await familyMenu.click();
    await familyList.waitFor();
    await within(
      familyList.evaluate(async (el) => {
        await Promise.all(el.getAnimations().map((a) => a.finished));
      }),
      "navigation drawer animation",
    );
    const box = (await familyList.boundingBox())!;
    assert(
      box.x >= 0 &&
        box.y >= 0 &&
        box.x + box.width <= size.width &&
        box.y + box.height <= size.height,
      "drawer fits the viewport",
    );
    for (const item of await familyList.getByRole("link").all())
      assert((await item.boundingBox())!.height >= 44);
    await page.touchscreen.tap(size.width - 2, size.height / 2);
    await familyList.waitFor({ state: "hidden" });
    await familyMenu.focus();
    await page.keyboard.press("Enter");
    await familyList.waitFor();
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () =>
        document.activeElement?.getAttribute("aria-label") === "Open AMP menu",
    );
  }
  // The device goes back to the parent, whose family's own controls follow.
  progress("family controls, back with the parent");
  await page.setViewportSize({ width: 390, height: 844 });
  await returnToParent(page);
  const familyPath = new URL(page.url()).pathname;
  // A child added from the family's Settings › People, "Add a child", with
  // a maximum-length nickname: the year saves them, Done closes the sheet.
  const family = /^\/family\/[^/]+/.exec(familyPath)?.[0];
  assert.ok(family, `back with the parent at ${familyPath}`);
  await page.goto(`${ORIGIN}${family}/settings`);
  await page.getByRole("button", { name: "Add a child", exact: true }).click();
  const { id: addedId, name: nickname } = await addChildInSheet(page, {
    name: "LongNickname".repeat(5),
  });
  learnerIds.push(addedId);
  // The drawer lists both children; choosing one opens their own page,
  // which a reload keeps.
  progress("learner choice and persistence");
  await chooseLearner(page, learnerIds.at(-1)!);
  await page.reload();
  await page.locator("[data-app-logo]").waitFor();
  assert.equal(await currentLearner(page), learnerIds.at(-1));
  await chooseLearner(page, learnerIds[0]!);
  assert.equal(await currentLearner(page), learnerIds[0]);
  await chooseLearner(page, learnerIds.at(-1)!);
  // The child's page changes their birth year; a maximum-length nickname
  // fits a phone there.
  for (const size of [
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(size);
    await page
      .getByRole("heading", { name: nickname, exact: true })
      .first()
      .waitFor();
    assert.deepEqual(
      await page.evaluate(() =>
        document.documentElement.scrollWidth <= innerWidth
          ? []
          : [...document.querySelectorAll("body *")]
              .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
              .slice(0, 12)
              .map(
                (e) =>
                  `${e.tagName}.${e.className}: ${e.textContent?.slice(0, 40)}`,
              ),
      ),
      [],
      `A maximum-length learner nickname must fit ${size.width}px`,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  // The child's settings fold under one Settings on their page
  // (features/family/Child.tsx); the birth year is one of them.
  await page
    .getByRole("region", { name: `${nickname}’s settings` })
    .getByText("Settings", { exact: true })
    .click();
  await page
    .getByRole("button", { name: `Birth year, ${nickname}: 2016` })
    .click();
  await page
    .getByRole("dialog", { name: `Birth year, ${nickname}` })
    .getByRole("option", { name: "2015", exact: true })
    .click();
  await page
    .getByRole("button", { name: `Birth year, ${nickname}: 2015` })
    .waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "The birth-year change keeps the child's page within a phone",
  );
  // Privacy & data (its panels at every width, consent and its withdrawal)
  // is verify-family-ui's.
  assert.deepEqual(errors, []);
  console.log(
    "Browser learning, hint, attempt, lesson and progress flows passed at desktop and phone widths.",
  );
} catch (error) {
  console.error(`UI review failed during ${phase}`);
  if (diagnosticPage) {
    await preserveFailure(diagnosticPage, failureDirectory, phase);
  }
  throw error;
} finally {
  await browser.close();
  await vite.close();
  await app.close();
  await repository.pool.query(
    "DELETE FROM amp_learners WHERE id=ANY($1::text[])",
    [learnerIds],
  );
  await repository.close();
}
if (!sweep.skip) {
  const manifest = uiSweepManifest(inventoryIds, sweep, completedIds);
  await mkdir(new URL("../artifacts/ui-sweep/", import.meta.url), {
    recursive: true,
  });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  progress(`completion manifest written for ${completedIds.length} templates`);
}
