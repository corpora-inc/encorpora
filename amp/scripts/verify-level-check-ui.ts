import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { chromium, type BrowserContext, type Page } from "playwright";
import { createServer } from "vite";
import { buildApp } from "../src/server/app";
import { developmentAuth } from "../src/server/auth";
import { PostgresRepository } from "../src/server/repository";
import { figureCapabilities } from "../src/math/contracts";
import { generateProblem } from "../src/math/engine";
import { trialLimits } from "../src/server/trials";
import { migrate } from "./migrate";

/**
 * The free assessment's level check, against the real learning API: the
 * practice toolbar's "Your level" control opens /try/map with a real route
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
const browser = await chromium.launch();
const shots =
  process.env.LEVEL_SCREENS ??
  new URL("../artifacts/level-check/", import.meta.url).pathname;
await mkdir(shots, { recursive: true });

let trials = 0;
/** A trial with `answers` problems answered through the API. */
async function trialWith(answers: number, birthYear = 2016) {
  // Each fixture trial comes from its own address, under the start limit.
  const created = await app.inject({
    method: "POST",
    url: "/api/v1/trials",
    remoteAddress: `10.0.0.${++trials}`,
    payload: { birthYear },
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

async function open(
  theme: "light" | "dark",
  width: number,
  height: number,
  token: string,
  reducedMotion: "reduce" | "no-preference" = "no-preference",
) {
  const context = await browser.newContext({
    viewport: { width, height },
    colorScheme: theme,
    reducedMotion,
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
    events.push(...body.events);
    await route.fulfill({ status: 204 });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const faults: string[] = [];
  page.on("pageerror", (error) => faults.push(error.message));
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
  await page.locator(".problem-stage .question").waitFor();
  const compact = page.locator(".compact-answer-action");
  if (await compact.isVisible()) await compact.click();
  const attempt = page.waitForResponse((r) => r.url().endsWith("/attempts"));
  const choice = page.locator(".choice-option:visible");
  if (await choice.count()) {
    await choice.nth(correct ? 0 : 1).click();
    await page.locator(".choice-submit:visible").click();
  } else {
    const input = page.locator("#answer:visible");
    await input.fill(correct ? "1" : "999999");
    await input.press("Enter");
  }
  assert.equal((await attempt).status(), 200);
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

const viewports = [
  [320, 568],
  [384, 700],
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1180, 820],
  [1280, 800],
] as const;
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
      const level = page.getByRole("link", { name: "Your level" });
      await level.waitFor();
      const target = await level.boundingBox();
      assert.ok(
        target && target.width >= 44 && target.height >= 44,
        `${tag}: the level control is a 44px target`,
      );
      // The label shows wherever the toolbar has room for it.
      const label = page.locator(".workspace-level-label");
      if (width >= 384)
        assert.ok(await label.isVisible(), `${tag}: "Your level" is labelled`);
      await fits(page, `${tag} practice`);
      await toolbarClean(page, tag);
      await shoot(page, "nav-practice", tag);
      const question = await page
        .locator(".problem-stage .question")
        .textContent();

      // A real route: the map opens, back returns to the same problem.
      await level.click();
      await page.waitForURL("**/try/map");
      await page.locator(".frontier-map").waitFor();
      await fits(page, `${tag} map`);
      await page.goBack();
      await page.waitForURL("**/try/practice");
      await page.locator(".problem-stage .question").waitFor();
      assert.equal(
        await page.locator(".problem-stage .question").textContent(),
        question,
        `${tag}: back returns to the same problem`,
      );
      await page.goForward();
      await page.waitForURL("**/try/map");
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
        `${tag}: the level check fits the screen`,
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
      assert.equal(
        (await page.locator(".workspace-toolbar").getByText("25").count()) > 0,
        true,
        `${tag}: the meter still reads 25`,
      );

      // "See your full map" opens /try/map; back returns to the problem.
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
        await dialog.getByRole("link", { name: "See your full map" }).click();
        await page.waitForURL("**/try/map");
        await page.locator(".frontier-map").waitFor();
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

  // The map: every level stated inline with what it means, no rows to open,
  // and the bars move from the last visit's levels on this device.
  const mapped = await trialWith(PLACEMENT + 8);
  for (const theme of ["light", "dark"] as const)
    for (const [width, height] of viewports) {
      const tag = `${width}x${height}-${theme}`;
      const { context, page, faults } = await open(
        theme,
        width,
        height,
        mapped.token,
      );
      contexts.push(context);
      await page.goto(`${origin}/try/map`);
      const map = page.locator(".frontier-map");
      await map.waitFor();
      assert.equal(
        await map.locator("[aria-expanded]").count(),
        0,
        `${tag}: no show/hide rows`,
      );
      const rows = map.locator(".frontier-row");
      assert.ok((await rows.count()) >= 6, `${tag}: every area has a row`);
      for (const row of await rows.all()) {
        assert.match(
          (await row.locator(".frontier-level").textContent()) ?? "",
          /^(K|Grade \d+|Algebra 1|Geometry|Algebra 2|Precalculus|College) likely /,
        );
        assert.ok(
          ((await row.locator(".frontier-meaning").textContent()) ?? "")
            .length > 10,
          `${tag}: each row says what its level means`,
        );
        const [name, level] = await Promise.all([
          row.locator(".frontier-name").boundingBox(),
          row.locator(".frontier-level").boundingBox(),
        ]);
        assert.ok(
          name &&
            level &&
            (name.x + name.width <= level.x + 0.5 ||
              name.y + name.height <= level.y + 0.5),
          `${tag}: an area's name and level never overlap`,
        );
      }
      assert.ok(
        (await map
          .getByText(/^At (kindergarten|K|Grade|Algebra|Geometry)/)
          .count()) > 0,
        `${tag}: problem types name what the level means`,
      );
      const meter = page.locator("main").getByText(/^Level check · /);
      assert.equal(
        (await meter.textContent())?.replace(/\s+/g, " "),
        `Level check · ${PLACEMENT + 8} answered`,
      );
      await page.getByText(`of ${FREE}`, { exact: true }).waitFor();
      await fits(page, `${tag} map`);
      await shoot(page, "map", tag, true);
      assert.deepEqual(faults, [], `${tag}: no page errors`);
      await context.close();
    }
  // Between visits: the dot starts where it was last seen and moves; with
  // reduced motion it moves without a transition.
  for (const motion of ["no-preference", "reduce"] as const) {
    const { context, page } = await open(
      "light",
      390,
      844,
      mapped.token,
      motion,
    );
    contexts.push(context);
    // tsx names inner functions with a helper the page lacks.
    await context.addInitScript({ content: "globalThis.__name ??= (f) => f" });
    await context.addInitScript((key) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          strands: Object.fromEntries(
            [
              "number",
              "operations",
              "fractions",
              "decimals",
              "ratio",
              "algebra",
              "reasoning",
              "functions",
              "geometry",
              "trigonometry",
              "measurement",
              "data",
              "probability",
              "modeling",
            ].map((strand) => [strand, { level: 0, sd: 3 }]),
          ),
        }),
      );
      const seen: string[] = [];
      (window as unknown as { __lefts: string[] }).__lefts = seen;
      let frame = 0;
      const record = () => {
        const dot = document.querySelector<HTMLElement>(
          ".frontier-row[data-measured] > span > span:last-child",
        );
        const left = dot?.style.left;
        if (left && seen.at(-1) !== left) seen.push(left);
        if (++frame < 600) requestAnimationFrame(record);
      };
      requestAnimationFrame(record);
    }, `amp.level.seen.${mapped.learnerId}`);
    await page.goto(`${origin}/try/map`);
    await page.locator(".frontier-map").waitFor();
    await page.waitForTimeout(1200);
    const lefts = await page.evaluate(
      () => (window as unknown as { __lefts: string[] }).__lefts,
    );
    assert.ok(
      lefts.length >= 2,
      `map moves from the last visit (${motion}): ${JSON.stringify(lefts)}`,
    );
    const duration = await page
      .locator(".frontier-row[data-measured] > span > span:last-child")
      .first()
      .evaluate((node) => getComputedStyle(node).transitionDuration);
    assert.equal(
      duration === "0s",
      motion === "reduce",
      `transition ${duration} under ${motion}`,
    );
    const stored = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? "null"),
      `amp.level.seen.${mapped.learnerId}`,
    );
    assert.ok(
      Object.values(stored.strands as Record<string, { level: number }>).some(
        (e) => e.level !== 0,
      ),
      "this visit's levels are remembered",
    );
    await context.close();
  }
  console.log(
    "Map: every level and what it means inline (no show/hide), meter leads with the count, bars move from the last visit (instant with reduced motion).",
  );

  // Share: a card with levels only and a link that starts a fresh check.
  // The learner (born 2016) may be under 13: only "Download image" until a
  // parent or guardian steps in.
  const pngSize = (bytes: Buffer) => [
    bytes.readUInt32BE(16),
    bytes.readUInt32BE(20),
  ];
  for (const theme of ["light", "dark"] as const)
    for (const [width, height] of viewports) {
      const tag = `${width}x${height}-${theme}`;
      const { context, page, events, faults } = await open(
        theme,
        width,
        height,
        mapped.token,
      );
      contexts.push(context);
      await context.grantPermissions(["clipboard-read", "clipboard-write"], {
        origin,
      });
      await page.goto(`${origin}/try/map`);
      await page.locator(".frontier-map").waitFor();
      await page
        .getByRole("button", { name: "Share your child’s level" })
        .click();
      const sheet = page.getByRole("dialog", {
        name: "Share your child’s level",
      });
      await sheet.waitFor();
      const preview = sheet.locator("img");
      await preview.waitFor();
      await preview.evaluate((img: HTMLImageElement) => img.decode());
      assert.deepEqual(
        await preview.evaluate((img: HTMLImageElement) => [
          img.naturalWidth,
          img.naturalHeight,
        ]),
        [1080, 1350],
      );
      for (const name of ["Facebook", "X", "Copy link", "Share…"])
        assert.equal(
          await sheet
            .getByRole(
              name === "Copy link" || name === "Share…" ? "button" : "link",
              { name, exact: true },
            )
            .count(),
          0,
          `${tag}: no ${name} before a grown-up steps in`,
        );
      await sheet.getByRole("link", { name: "Download image" }).waitFor();
      await fits(page, `${tag} share (child)`);
      await shoot(page, "share-child", tag);
      // The image the family saves.
      const download = page.waitForEvent("download");
      await sheet.getByRole("link", { name: "Download image" }).click();
      const saved = await download;
      assert.equal(saved.suggestedFilename(), "amp-level.png");
      const card = `${shots}/card-${theme}.png`;
      await saved.saveAs(card);
      const { readFileSync } = await import("node:fs");
      assert.deepEqual(pngSize(readFileSync(card)), [1080, 1350]);
      // A parent or guardian opens the rest.
      await sheet
        .getByRole("button", { name: "I’m a parent or guardian" })
        .click();
      const facebook = sheet.getByRole("link", { name: "Facebook" }),
        x = sheet.getByRole("link", { name: "X", exact: true });
      await facebook.waitFor();
      const link = `${origin}/level?utm_source=share&utm_medium=level-card`;
      for (const href of [
        await facebook.getAttribute("href"),
        await x.getAttribute("href"),
      ]) {
        assert.ok(href, `${tag}: a plain share link`);
        assert.ok(!href.includes(mapped.learnerId), "no learner id");
        assert.ok(!href.includes(mapped.token), "no trial token");
        assert.ok(href.includes(encodeURIComponent(link)), "the fresh link");
      }
      assert.equal(await facebook.getAttribute("target"), "_blank");
      assert.match((await facebook.getAttribute("rel")) ?? "", /noopener/);
      await sheet.getByRole("button", { name: "Copy link" }).click();
      await sheet.getByRole("button", { name: "Link copied" }).waitFor();
      assert.equal(
        await page.evaluate(() => navigator.clipboard.readText()),
        link,
      );
      await fits(page, `${tag} share (grown-up)`);
      for (const action of await sheet.locator("button, a").all())
        if (await action.isVisible()) {
          const box = await action.boundingBox();
          assert.ok(box && box.height >= 44, `${tag}: 44px share actions`);
        }
      await shoot(page, "share", tag);
      await eventually(
        () =>
          ["download", "copy"].every((channel) =>
            events.some(
              (e) =>
                e.event === "share_complete" &&
                (e.props as { channel: string }).channel === channel,
            ),
          ) &&
          events.some(
            (e) =>
              e.event === "share_open" &&
              (e.props as { surface: string }).surface === "map",
          ),
        `${tag}: share_open and share_complete are recorded`,
      );
      await page.keyboard.press("Escape");
      await sheet.waitFor({ state: "detached" });
      assert.deepEqual(faults, [], `${tag}: no page errors`);
      await context.close();
    }
  {
    // An adult learner: every option at once, and Share from the level check.
    const adult = await trialWith(PLACEMENT + 4, 1988);
    const { context, page, events } = await open(
      "light",
      390,
      844,
      adult.token,
    );
    contexts.push(context);
    await page.goto(`${origin}/try/practice`);
    await answerOne(page, true);
    await page.locator(".next-action").click();
    const check = page.getByRole("dialog", { name: checkTitle });
    await check.waitFor();
    await check.getByRole("button", { name: "Share your level" }).click();
    const sheet = page.getByRole("dialog", { name: "Share your level" });
    await sheet.getByRole("link", { name: "Facebook" }).waitFor();
    await sheet.getByRole("link", { name: "X", exact: true }).waitFor();
    await sheet.getByRole("button", { name: "Copy link" }).waitFor();
    assert.equal(
      await sheet
        .getByRole("button", { name: "I’m a parent or guardian" })
        .count(),
      0,
    );
    await shoot(page, "share-adult-over-check", "390x844-light");
    await page.keyboard.press("Escape");
    await sheet.waitFor({ state: "detached" });
    // Escape closes the share sheet first; the level check stays.
    await check.waitFor();
    await eventually(
      () =>
        events.some(
          (e) =>
            e.event === "share_open" &&
            (e.props as { surface: string }).surface === "check",
        ),
      "share_open from the level check",
    );
    await context.close();
  }
  {
    // The shared link: a new visitor lands, counted with the card's tags,
    // and starts their own level check.
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    contexts.push(context);
    const events: { event: string; props?: unknown }[] = [];
    await context.route("**/api/v1/events", async (route) => {
      events.push(
        ...(route.request().postDataJSON() as { events: typeof events }).events,
      );
      await route.fulfill({ status: 204 });
    });
    const page = await context.newPage();
    await page.goto(`${origin}/level?utm_source=share&utm_medium=level-card`);
    await page.waitForURL("**/try");
    await page.getByRole("group", { name: "Birth year" }).waitFor();
    await eventually(
      () =>
        events.some(
          (e) =>
            e.event === "landing_view" &&
            (e.props as { utmSource?: string }).utmSource === "share" &&
            (e.props as { utmMedium?: string }).utmMedium === "level-card",
        ),
      "the card's link counts as a landing from a share",
    );
    await context.close();
  }
  console.log(
    "Share: card 1080x1350 with levels only; under 13 only Download image until a parent or guardian steps in; Facebook/X are plain links with the fresh /level link and no learner data; Copy link copies it; share_open/share_complete recorded; adult sees every option, from the level check too; /level lands with share tags and starts a new check.",
  );
  console.log(
    `Level check: every ${5} problems between problems (never over feedback), Escape / tap outside / Continue close it, no answer sent, count unchanged, the problem never moves, focus returns; "See your full map" → /try/map and back.`,
  );
  console.log(
    `Level check: "Your level" in the practice toolbar → /try/map (back, forward and refresh restore it) at ${viewports.map(([w, h]) => `${w}x${h}`).join(", ")} × light/dark; 44px target, labelled at 384px and up, no overflow, no toolbar overlap.`,
  );
} finally {
  for (const context of contexts) await context.close().catch(() => {});
  await browser.close();
  await vite.close();
  await app.close();
  await repository.close();
}
