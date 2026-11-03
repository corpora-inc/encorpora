import { secureChromium } from "../browser-security.mjs";
import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import {
  chromium as rawChromium,
  type BrowserContext,
  type Locator,
  type Page,
} from "playwright";
const chromium = secureChromium(rawChromium);
import { createServer } from "vite";
import { buildApp } from "../src/server/app";
import { developmentAuth } from "../src/server/auth";
import { PostgresRepository } from "../src/server/repository";
import { figureCapabilities } from "../src/math/contracts";
import { generateProblem } from "../src/math/engine";
import { answerOne, trackPracticeProblems } from "./ui-practice-answer";
import { migrate } from "./migrate";

/**
 * Free workbooks in the free assessment, against the real learning API (no
 * PDF renderer, so downloads are the printable document):
 * - the answer that reaches 20 problems shows "Workbook unlocked" in its
 *   feedback; downloading it never moves the offer or Next;
 * - the progress map shows the stamps beside the free meter, downloads
 *   again, makes an earned workbook with the chosen paper size, and shows a
 *   failure in the fixed toast without moving anything.
 * Runs at 320x568, 390x844, 768x1024 and 1280x800, light and dark: no
 * horizontal overflow and 44 px targets.
 */
const url = process.env.AMP_TEST_DATABASE_URL;
if (!url)
  throw new Error("AMP_TEST_DATABASE_URL is required for browser verification");
await migrate(url);
const repository = new PostgresRepository(url, {
  development: true,
  freeProblems: 100,
});
const app = buildApp({
  repository,
  authenticate: developmentAuth(),
  development: true,
});
const port = Number(process.env.ASSESSMENT_WORKBOOKS_PORT ?? 4410),
  apiPort = port + 1;
await app.listen({ host: "127.0.0.1", port: apiPort });
const origin = `http://127.0.0.1:${port}`;
const vite = await createServer({
  root: new URL("../", import.meta.url).pathname,
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  cacheDir: "node_modules/.vite-assessment-workbooks",
  server: {
    watch: { ignored: ["**/artifacts/**"] },
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
  process.env.ASSESSMENT_WORKBOOKS_SCREENS ??
  new URL("../artifacts/assessment-workbooks/", import.meta.url).pathname;
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
    const attempt = await app.inject({
      method: "POST",
      url: `/api/v1/learners/${learnerId}/attempts`,
      headers,
      payload: {
        problemId: problem.id,
        requestId: crypto.randomUUID(),
        response: generateProblem(problem.templateId, problem.seed).answer,
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
) {
  const context = await browser.newContext({
    viewport: { width, height },
    colorScheme: theme,
    acceptDownloads: true,
  });
  await context.addInitScript(
    ([value, paper]) => {
      localStorage.setItem("amp.trial", value);
      // Each run starts from the region's default paper, Letter here.
      if (!sessionStorage.getItem("paper-reset")) {
        localStorage.removeItem(paper);
        sessionStorage.setItem("paper-reset", "1");
      }
    },
    [token, "amp.trial-workbook-paper"] as const,
  );
  await context.route("**/api/v1/events", (route) =>
    route.fulfill({ status: 204 }),
  );
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  trackPracticeProblems(page);
  const faults: string[] = [];
  page.on("pageerror", (error) => faults.push(error.message));
  if (process.env.ASSESSMENT_WORKBOOKS_DEBUG) {
    page.on("console", (m) => console.error("CONSOLE", m.type(), m.text()));
    page.on("request", (r) => {
      if (r.url().includes("/api/"))
        console.error("REQUEST", r.method(), r.url());
    });
    page.on("response", (r) => {
      if (r.url().includes("/workbooks"))
        console.error("RESPONSE", r.status(), r.url());
    });
  }
  return { context, page, faults };
}
async function frames(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}
/** Waits for entrance animations (the feedback sheet rises into place), so
 * measurements compare settled positions. */
async function settle(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
  await frames(page);
}
async function fits(page: Page, label: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - innerWidth,
  );
  if (overflow > 0)
    console.error(
      label,
      await page.evaluate(() =>
        [...document.querySelectorAll("body *")]
          .filter((e) => e.getBoundingClientRect().right > innerWidth + 0.5)
          .slice(0, 8)
          .map(
            (e) =>
              `${e.tagName}.${e.className} ${e.getBoundingClientRect().right}`,
          ),
      ),
    );
  assert.ok(overflow <= 0, `${label}: no horizontal overflow (${overflow}px)`);
}
async function target(locator: Locator, label: string) {
  const box = await locator.boundingBox();
  assert.ok(
    box && box.width >= 44 && box.height >= 44,
    `${label}: a 44px target (${box?.width}x${box?.height})`,
  );
}
type Box = { x: number; y: number; width: number; height: number };
async function boxes(locators: Locator[]): Promise<Box[]> {
  return Promise.all(
    locators.map(async (locator) => {
      const box = await locator.boundingBox();
      assert.ok(box, "measured element is visible");
      return {
        x: Math.round(box.x),
        y: Math.round(box.y),
        width: Math.round(box.width),
        height: Math.round(box.height),
      };
    }),
  );
}
/** Text that never wraps a word across lines: every line break falls
 * between words. */
async function noBrokenWords(locator: Locator, label: string) {
  const broken = await locator.evaluate((root) => {
    const found: string[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent ?? "";
      const range = document.createRange();
      for (const match of text.matchAll(/\S+/g)) {
        range.setStart(node, match.index!);
        range.setEnd(node, match.index! + match[0].length);
        if (range.getClientRects().length > 1) found.push(match[0]);
      }
    }
    return found;
  });
  assert.deepEqual(broken, [], `${label}: no word breaks across lines`);
}
async function shoot(page: Page, name: string, fullPage = false) {
  await page.mouse.move(0, 0);
  await frames(page);
  await page.screenshot({ path: `${shots}/${name}.png`, fullPage });
}
async function downloaded(page: Page, click: () => Promise<void>) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    click(),
  ]);
  const file = await download.path();
  assert.ok(file, "the download completed");
  return {
    name: download.suggestedFilename(),
    html: await readFile(file, "utf8"),
  };
}

const viewports = [
  [320, 568],
  [390, 844],
  [768, 1024],
  [1280, 800],
] as const;
const contexts: BrowserContext[] = [];
try {
  for (const theme of ["light", "dark"] as const)
    for (const [width, height] of viewports) {
      const tag = `${width}x${height}-${theme}`;

      // The answer that reaches 20 problems offers the first workbook.
      const trial = await trialWith(19);
      const { context, page, faults } = await open(
        theme,
        width,
        height,
        trial.token,
      );
      contexts.push(context);
      await page.goto(`${origin}/try/practice`);
      await answerOne(page, true);
      const offer = page.locator(".feedback [data-workbook-offer]");
      await offer.waitFor();
      await settle(page);
      const action = offer.getByRole("button", {
        name: "Download",
        exact: true,
      });
      const next = page.locator(".next-action");
      await target(action, `${tag} offer`);
      await fits(page, `${tag} offer`);
      await noBrokenWords(offer, `${tag} offer`);
      const nextBox = await next.boundingBox();
      assert.ok(
        nextBox && nextBox.y + nextBox.height <= height + 1,
        `${tag}: Next stays on screen with the offer`,
      );
      const measured = [
        offer,
        offer.locator("button"),
        next,
        offer.locator("strong"),
      ];
      const before = await boxes(measured);
      await shoot(page, `offer-${tag}`);
      // Preparing… keeps every box where it was.
      let release = () => {};
      const held = new Promise<void>((resolve) => (release = resolve));
      await page.route("**/workbooks/*/document*", async (route) => {
        await held;
        await route.continue();
      });
      const file = downloaded(page, () => action.click());
      file.catch(() => undefined);
      try {
        // A busy button leaves the accessibility tree's name lookup; match
        // its text.
        await offer.locator("button", { hasText: "Preparing…" }).waitFor();
        assert.deepEqual(await boxes(measured), before, `${tag}: preparing`);
      } finally {
        release();
      }
      const { name, html } = await file;
      assert.match(name, /^amp-workbook-\d{4}-\d{2}-\d{2}-1\.html$/);
      assert.match(html, /data-compose/);
      assert.doesNotMatch(html, /Workbook for Trial/);
      await offer.locator("[data-done]").waitFor({ state: "attached" });
      assert.deepEqual(await boxes(measured), before, `${tag}: done`);
      await page.unroute("**/workbooks/*/document*");
      assert.equal(
        (
          await app.inject({
            method: "GET",
            url: `/api/v1/learners/${trial.learnerId}/trial-progress`,
            headers: { authorization: `Trial ${trial.token}` },
          })
        ).json().workbooks.made,
        1,
      );

      // Placement ends at 20: Next opens the map, where the workbook waits
      // beside the free meter, with the next unlock named.
      await next.click();
      await page.waitForURL("**/try/map");
      const strip = page.locator("[data-trial-workbooks]");
      await strip.waitFor();
      const again = strip.getByRole("button", {
        name: "Download workbook 1 again",
      });
      await target(again, `${tag} stamp`);
      await strip.getByText("Next one at 40 problems.").waitFor();
      assert.equal(
        await strip
          .getByRole("img", { name: /unlocks at \d+ problems/ })
          .count(),
        4,
      );
      for (const radio of await strip.getByRole("radio").all())
        await target(radio, `${tag} paper`);
      await strip.scrollIntoViewIfNeeded();
      await shoot(page, `map-${tag}`);
      await fits(page, `${tag} map`);
      await noBrokenWords(strip, `${tag} map`);

      // A failed download is a fixed toast: nothing on the page moves.
      const stamp = strip.locator("ol button").first();
      const stripBefore = await boxes([strip, stamp]);
      const tall = await page.evaluate(
        () => document.documentElement.scrollHeight,
      );
      await page.route("**/workbooks/*/document*", (route) =>
        route.fulfill({ status: 500, json: { error: "Unavailable" } }),
      );
      await again.click();
      const toast = page.getByRole("alert").filter({
        hasText: "The workbook didn't download. Try again in a moment.",
      });
      await toast.waitFor();
      assert.deepEqual(
        await boxes([strip, again]),
        stripBefore,
        `${tag} error`,
      );
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollHeight),
        tall,
        `${tag}: the toast adds no height`,
      );
      await shoot(page, `map-error-${tag}`);
      await page.unroute("**/workbooks/*/document*");
      await page.getByRole("button", { name: "Dismiss message" }).click();
      assert.deepEqual(faults, [], `${tag}: no page errors`);
      await context.close();
    }

  // An earned workbook made from the map, on A4: the stamp fills in and the
  // next one is offered in the same place.
  for (const theme of ["light", "dark"] as const) {
    const [width, height] = [390, 844];
    const tag = `${width}x${height}-${theme}`;
    const trial = await trialWith(40);
    const { context, page, faults } = await open(
      theme,
      width,
      height,
      trial.token,
    );
    contexts.push(context);
    await page.goto(`${origin}/try/map`);
    const strip = page.locator("[data-trial-workbooks]");
    await strip.waitFor();
    await strip.getByRole("radio", { name: "A4" }).click();
    const make = strip.getByRole("button", { name: "Download workbook 1" });
    await target(make, `${tag} make`);
    await shoot(page, `map-ready-${tag}`);
    const action = strip.locator("[class*=nextAction]");
    const before = await boxes([strip, action]);
    const asked = page.waitForRequest((request) =>
      request.url().includes("/document?paper=a4"),
    );
    const { name } = await downloaded(page, () => make.click());
    await asked;
    assert.match(name, /-1\.html$/);
    const second = strip.getByRole("button", { name: "Download workbook 2" });
    await second.waitFor();
    assert.deepEqual(await boxes([strip, action]), before, `${tag}: made`);
    await strip
      .getByRole("button", { name: "Download workbook 1 again" })
      .waitFor();
    // Reload restores the same state from the server.
    await page.reload();
    await strip.getByRole("button", { name: "Download workbook 2" }).waitFor();
    assert.equal(
      await strip
        .getByRole("radio", { name: "A4" })
        .getAttribute("aria-checked"),
      "true",
      `${tag}: the paper choice is kept on this device`,
    );
    assert.deepEqual(faults, [], `${tag}: no page errors`);
    await context.close();
  }
  console.log(`Assessment workbooks verified; screenshots in ${shots}`);
} finally {
  for (const context of contexts) await context.close().catch(() => {});
  await browser.close();
  await vite.close();
  await app.close();
  await repository.close();
}
