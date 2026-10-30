import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { createServer } from "vite";
import { registerAnalyticsRoutes } from "../src/analytics/routes";
import { buildApp } from "../src/server/app";
import { PostgresRepository } from "../src/server/repository";
import { retentionNotice } from "../src/family/contracts";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";
const database = process.env.AMP_TEST_DATABASE_URL!;
assertTestDatabaseTarget(database);
await migrate(database);
const repo = new PostgresRepository(database, { development: true });
const app = buildApp({
  repository: repo,
  authenticate: async () => "welcome-fixture",
});
await registerAnalyticsRoutes(app, {
  pool: repo.pool,
  authenticate: async () => "welcome-fixture",
});
await app.listen({ host: "127.0.0.1", port: 4387 });
const authPath = fileURLToPath(new URL("../src/web/auth.ts", import.meta.url));
const auth = `export async function accessSession(){return {token:'fixture',accountId:'welcome-fixture'};}export function onSessionChanged(){return()=>{};}export function notifyAccountSessionChanged(){}export async function signIn(){}export async function signOut(){}export async function authConfig(){return {mode:'accounts',passwords:true,providers:[]};}`;
const vite = await createServer({
  configFile: fileURLToPath(new URL("../vite.config.ts", import.meta.url)),
  plugins: [
    {
      name: "fixture-auth",
      enforce: "pre",
      load(id) {
        if (id.split("?")[0] === authPath) return auth;
      },
    },
  ],
  server: {
    host: "127.0.0.1",
    port: 4386,
    strictPort: true,
    proxy: { "/api": "http://127.0.0.1:4387" },
  },
});
await vite.listen();
const dir = fileURLToPath(
  new URL("../artifacts/trial-welcome/", import.meta.url),
);
await mkdir(dir, { recursive: true });
try {
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch();
    try {
      for (const width of process.env.AMP_JOURNEY_SMOKE
        ? [390]
        : [320, 390, 768, 1280])
        for (const colorScheme of process.env.AMP_JOURNEY_SMOKE
          ? (["light"] as const)
          : (["light", "dark"] as const)) {
          await repo.pool.query(
            "DELETE FROM amp_visitor_journeys WHERE account_id='welcome-fixture'",
          );
          await repo.pool.query(
            "DELETE FROM amp_learners l USING amp_trials t WHERE l.id=t.learner_id AND t.owner_account_id='welcome-fixture'",
          );
          const context = await browser.newContext({
            viewport: { width, height: width === 320 ? 640 : 900 },
            colorScheme,
          });
          let setup = false;
          await context.route("**/api/v1/me", (route) =>
            route.fulfill({
              json: {
                signedIn: true,
                account: {
                  id: "welcome-fixture",
                  email: "parent@example.test",
                  emailVerified: setup,
                  confirmationRequired: !setup,
                },
                consent: { status: setup ? "active" : "none", method: null },
                learners: [],
                next: setup ? "add-learner" : "try",
                family: {
                  consent: {
                    status: setup ? "active" : "not-recorded",
                    policyVersion: null,
                    recordedAt: null,
                    withdrawnAt: null,
                  },
                  learners: [],
                  retained: retentionNotice,
                },
              },
            }),
          );
          await context.route("**/api/auth/send-verification-email", (route) =>
            route.fulfill({ json: { status: true } }),
          );
          let release!: () => void;
          const held = new Promise<void>((resolve) => {
            release = resolve;
          });
          await context.route("**/api/v1/events", async (route) => {
            await held;
            await route.continue();
          });
          const page = await context.newPage();
          const failedRequests: string[] = [];
          page.on("response", (response) => {
            if (response.status() >= 400)
              failedRequests.push(
                `${response.status()} ${new URL(response.url()).pathname}`,
              );
          });
          await page.goto("http://127.0.0.1:4386/try");
          await page
            .getByRole("heading", { name: "See how AMP adapts" })
            .waitFor();
          await page.getByRole("button", { name: "2013", exact: true }).click();
          const intro = page.getByRole("dialog", { name: "Watch AMP adapt" });
          await intro.waitFor();
          assert.equal(
            await page.locator("#problem-prompt").count(),
            0,
            "practice starts after the interlude",
          );
          assert.equal(
            await page.locator("details").count(),
            0,
            "no reveal link",
          );
          const box = await intro.boundingBox();
          assert(
            box &&
              box.x >= 0 &&
              box.y >= 0 &&
              box.x + box.width <= width &&
              box.y + box.height <= (width === 320 ? 640 : 900),
          );
          await page.screenshot({
            animations: "disabled",
            path: `${dir}/${engine.name()}-${width}-${colorScheme}-intro.png`,
          });
          await intro.getByRole("button", { name: "Start practicing" }).click();
          await page.locator("#problem-prompt").waitFor();
          // The real product renders while the telemetry collector is blocked.
          await page.bringToFront();
          await page.evaluate(
            () =>
              new Promise<void>((resolve) =>
                requestAnimationFrame(() =>
                  requestAnimationFrame(() => resolve()),
                ),
              ),
          );
          release();
          await page.evaluate(() =>
            window.dispatchEvent(new Event("pagehide")),
          );
          const until = Date.now() + 10000;
          let rendered = false;
          while (Date.now() < until) {
            rendered = !!(
              await repo.pool.query(
                "SELECT 1 FROM amp_visitor_journeys WHERE account_id='welcome-fixture' AND event='problem_rendered' LIMIT 1",
              )
            ).rowCount;
            if (rendered) break;
            await page.waitForTimeout(100);
          }
          assert.ok(
            rendered,
            `visible problem rendering reaches the first-party ledger: ${failedRequests.join(", ")}`,
          );
          await page.reload();
          await page.locator("#problem-prompt").waitFor();
          assert.equal(
            await page.getByRole("dialog", { name: "Watch AMP adapt" }).count(),
            0,
            "dismissed intro stays dismissed on reload",
          );
          assert.equal(
            await page.locator('[aria-label="Free practice guidance"]').count(),
            0,
          );
          assert.equal(
            await page
              .getByRole("button", { name: "Resend", exact: true })
              .count(),
            0,
          );

          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            true,
          );
          await page.screenshot({
            animations: "disabled",
            path: `${dir}/${engine.name()}-${width}-${colorScheme}-practice.png`,
          });
          await page
            .getByRole("button", {
              name: "Skip this problem and see its answer",
              exact: true,
            })
            .click();
          await page.locator(".next-action").click();
          assert.equal(
            await page.getByRole("dialog", { name: "Watch AMP adapt" }).count(),
            0,
          );
          const trial = await repo.currentTrial("welcome-fixture");
          assert.ok(trial);
          const freshDevice = await browser.newContext();
          const second = await freshDevice.newPage();
          await second.goto("http://127.0.0.1:4386/try");
          await second.locator("#problem-prompt").waitFor();
          assert.equal(
            (await repo.currentTrial("welcome-fixture"))?.learnerId,
            trial.learnerId,
          );
          await freshDevice.close();
          if (width === 320 && colorScheme === "light") {
            setup = true;
            await page.goto("http://127.0.0.1:4386/start/name");
            const continueButton = page.getByRole("button", {
              name: "Continue",
              exact: true,
            });
            await page.getByLabel("Learner name").fill("Synthetic learner");
            assert.equal(await continueButton.isDisabled(), true);
            await page
              .getByRole("button", { name: "Start fresh", exact: true })
              .click();
            await page.screenshot({
              animations: "disabled",
              path: `${dir}/${engine.name()}-fresh-setup.png`,
            });
            await continueButton.click();
            await page.waitForURL("**/start/birth-year");
            assert.equal(
              (await repo.currentTrial("welcome-fixture"))?.learnerId,
              trial.learnerId,
            );
          }
          await context.close();
        }
    } finally {
      await browser.close();
    }
  }
  console.log(
    "Trial entry, skip, persistent dismissal, cross-device resume and blocked-collector checks passed in Chromium and WebKit for the selected viewport/theme matrix.",
  );
} finally {
  await repo.pool.query(
    "DELETE FROM amp_learners l USING amp_trials t WHERE l.id=t.learner_id AND t.owner_account_id='welcome-fixture'",
  );
  await vite.close();
  await app.close();
}
