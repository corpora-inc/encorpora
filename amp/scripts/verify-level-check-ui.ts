import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { chromium, type BrowserContext, type Page } from "playwright";
import { createServer } from "vite";
import { buildApp } from "../src/server/app";
import { developmentAuth } from "../src/server/auth";
import { PostgresRepository } from "../src/server/repository";
import { figureCapabilities } from "../src/math/contracts";
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

/** A trial with `answers` problems answered through the API, alternating
 * right and wrong so the estimate moves. */
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
    const response =
      problem.response?.kind === "choice"
        ? problem.response.options[i % 3 === 0 ? 1 : 0].id
        : i % 3 === 0
          ? "999999"
          : "1";
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
