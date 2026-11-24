import { seedLearner } from "./lib/learner-seed";
import { secureChromium } from "../browser-security.mjs";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium as rawChromium, webkit, type Page } from "playwright";
const chromium = secureChromium(rawChromium);
import { createServer } from "vite";
import { buildApp } from "../src/server/app";
import { developmentAuth } from "../src/server/auth";
import { PostgresRepository } from "../src/server/repository";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";

/** Practice's adjustments and recovery, in Chromium and WebKit.
 *
 * A child's practice opened on the parent's sign-in is handed to the child
 * (a child's practice is always the child's own sign-in): its menu has
 * Working together, which saves on the child's record, and no Reset
 * practice level; Try easier follows a skip.
 *
 * The level is reset by the parent in the child's settings
 * (verify-parent-level-reset-ui.ts, with the failed save that retries in
 * place) and by an adult in their own practice's menu
 * (verify-adult-practice-ui.ts).
 *
 * Optional `--port` (the API takes the next port). */
const argument = (name: string) => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : undefined;
};
const url = process.env.AMP_TEST_DATABASE_URL!;
assertTestDatabaseTarget(url);
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
await registerFamilyRoutes(app, {
  pool: repository.pool,
  authenticate: developmentAuth(),
  development: true,
});
const port = Number(argument("--port") ?? 4486),
  apiPort = port + 1,
  origin = `http://127.0.0.1:${port}`;
await app.listen({ host: "127.0.0.1", port: apiPort });
const vite = await createServer({
  root: new URL("../", import.meta.url).pathname,
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  cacheDir: process.env.AMP_VITE_CACHE_DIR ?? "node_modules/.vite-recovery",
  server: {
    host: "127.0.0.1",
    port,
    strictPort: true,
    proxy: { "/api": { target: `http://127.0.0.1:${apiPort}` } },
  },
});
await vite.listen();
const shots =
  process.env.RECOVERY_SCREENS ??
  new URL("../artifacts/practice-recovery/", import.meta.url).pathname;
await mkdir(shots, { recursive: true });
const errors: string[] = [];
async function geometry(page: Page) {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "no horizontal overflow",
  );
}
const stateOf = async (learnerId: string) =>
  (
    await app.inject({
      method: "GET",
      url: `/api/v1/learners/${learnerId}/practice-state`,
      headers: { authorization: "Bearer amp-local-development" },
    })
  ).json();
try {
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch();
    try {
      for (const width of [320, 390, 768, 1280])
        for (const colorScheme of ["light", "dark"] as const) {
          const label = `${engine.name()}-${width}-${colorScheme}`;
          const context = await browser.newContext({
            viewport: { width, height: width === 320 ? 568 : 844 },
            colorScheme,
          });
          // A learner of its own for each case, chosen on this device.
          const learner = await repository.create(
            "development-household",
            "Recovery learner",
            2016,
          );
          await seedLearner(context, "development-household", learner.id);
          const page = await context.newPage();
          page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
          // Practice names its learner in its address (identity.ts); a
          // child's, on the parent's sign-in, is handed to the child.
          await page.goto(`${origin}/practice/${learner.id}`);
          await page.locator(".question").waitFor();
          assert.equal(
            await page.evaluate(() =>
              sessionStorage.getItem("amp.student.handed"),
            ),
            "1",
            "the child's practice is the child's own sign-in",
          );
          assert.equal(
            await page.getByText("Working together", { exact: true }).count(),
            0,
            "main workspace has no settings copy",
          );
          assert.equal(
            await page.getByText("Try easier", { exact: true }).count(),
            0,
            "easier appears only after skip",
          );
          await geometry(page);
          await page.screenshot({
            path: `${shots}/${label}-practice.png`,
            fullPage: true,
          });
          await page.getByRole("button", { name: "Open AMP menu" }).click();
          const together = page.getByRole("checkbox", {
            name: "Working together",
          });
          await together.waitFor();
          await together.click();
          await page.waitForFunction(
            () => !!document.querySelector('input[type="checkbox"]:checked'),
          );
          // A child's own sign-in never resets the level: their grown-up
          // does, in the child's settings.
          assert.equal(
            await page
              .getByRole("button", {
                name: "Reset practice level",
                exact: true,
              })
              .count(),
            0,
            "no reset in a child's own menu",
          );
          await geometry(page);
          await page.screenshot({
            path: `${shots}/${label}-menu.png`,
            fullPage: true,
          });
          await page.getByRole("button", { name: "Close AMP menu" }).click();
          await page
            .getByRole("button", {
              name: "Skip this problem and see its answer",
            })
            .click();
          const easier = page.getByRole("button", {
            name: "Try easier",
            exact: true,
          });
          await easier.waitFor();
          const box = await easier.boundingBox();
          assert.ok(box && box.height >= 44 && box.width >= 44);
          await geometry(page);
          await page.screenshot({
            path: `${shots}/${label}-skip.png`,
            fullPage: true,
          });
          await easier.click();
          await easier.waitFor({ state: "hidden" });
          // Working together was saved on the child's own record.
          const childState = await stateOf(learner.id);
          assert.equal(childState.workingTogether, true);
          assert.equal(childState.epoch, 0, "nothing reset the child's level");
          await context.close();

          console.log(label + " passed");
        }
    } finally {
      await browser.close();
    }
  }
  assert.deepEqual(errors, []);
} finally {
  await vite.close();
  await app.close();
  await repository.pool.end();
}
