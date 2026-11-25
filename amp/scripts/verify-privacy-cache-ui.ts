import { secureChromium } from "../browser-security.mjs";
import { chooseLearner, openMenu } from "./ui-controls";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { chromium as rawChromium } from "playwright";
const chromium = secureChromium(rawChromium);
import { createServer } from "vite";
import assert from "node:assert/strict";
import { buildApp } from "../src/server/app";
import { PostgresRepository } from "../src/server/repository";
import { developmentAuth } from "../src/server/auth";
import { migrate } from "./migrate";
const url = process.env.AMP_TEST_DATABASE_URL;
if (!url)
  throw new Error("AMP_TEST_DATABASE_URL is required for browser verification");
await migrate(url);
const repository = new PostgresRepository(url, { development: true });
const account = "development-household";
const learner = await repository.create(account, "Browser verification", 2016);
const learnerIds = [learner.id];
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
  cacheDir: process.env.AMP_VITE_CACHE_DIR,
  server: {
    host: "127.0.0.1",
    port: WEB_PORT,
    strictPort: true,
    proxy: { "/api": { target: `http://127.0.0.1:${WEB_PORT + 1}` } },
  },
});
await vite.listen();
const browser = await chromium.launch({ headless: true });
try {
  for (const mutation of ["withdraw", "delete"] as const) {
    const page = await browser.newPage({ hasTouch: true });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${ORIGIN}/overview`);
    await chooseLearner(page, learner.id);
    await page.goto(`${ORIGIN}/profile/birth-year`);
    await page.getByRole("heading", { name: /^What year was/ }).waitFor();
    let releaseFamilyBatch!: () => void, familyBatchHeld!: () => void;
    const familyBatchRelease = new Promise<void>((resolve) => {
      releaseFamilyBatch = resolve;
    });
    const familyBatchWaiting = new Promise<void>((resolve) => {
      familyBatchHeld = resolve;
    });
    // Settles once the held answer has been handed to the page, or dropped
    // because the page had already let the request go.
    let batchSettled!: () => void;
    const familyBatchSettled = new Promise<void>((resolve) => {
      batchSettled = resolve;
    });
    await page.route("**/batches", async (route) => {
      const result = await route.fetch();
      familyBatchHeld();
      await familyBatchRelease;
      await route.fulfill({ response: result }).catch(() => undefined);
      batchSettled();
    });
    await page.getByRole("option", { name: "2016", exact: true }).click();
    // The birth year saved, the child's own page shows (their Overview).
    await page.waitForURL((url) =>
      url.pathname.endsWith(`/kids/${learner.id}`),
    );
    // A child's practice is the child's own sign-in: "Practice" on their
    // page hands this device to the child, in this document, and the
    // problems are asked for as them. That request is held here.
    const childsPage = new URL(page.url()).pathname;
    await page.locator(`[data-practice-here="${learner.id}"]`).click();
    await page.waitForURL((url) => url.pathname.startsWith("/practice"));
    await familyBatchWaiting;
    // The parent takes the device back from the child's menu: Back to the
    // screen it was handed from, still this document, the request still out.
    const childs = await openMenu(page);
    await childs.getByRole("button", { name: "Back to family" }).click();
    await page.waitForURL((url) => url.pathname === childsPage);
    // A family parent's account settings are the family's Settings; its
    // Privacy row opens Privacy over it, from the drawer, in this document.
    const drawer = await openMenu(page);
    await drawer.getByRole("link", { name: "Settings", exact: true }).click();
    await page.waitForURL((url) =>
      /^\/family\/[^/]+\/settings$/.test(url.pathname),
    );
    const settings = new URL(page.url()).pathname;
    await page.locator("[data-settings-privacy-row]").click();
    await page.waitForURL((url) => url.pathname === `${settings}/privacy`);
    // Each privacy panel is a disclosure (ui/Disclosure.tsx).
    await page
      .locator("summary")
      .filter({
        hasText:
          mutation === "withdraw"
            ? "Learning permission"
            : "Delete learning data",
      })
      .click();
    // Synthetic mutation isolates this browser race from the shared test account.
    await page.route(
      mutation === "withdraw"
        ? "**/family/consent/withdraw"
        : "**/family/delete-learning-data",
      (route) =>
        route.fulfill({
          json:
            mutation === "withdraw"
              ? { withdrawn: true }
              : {
                  requestId: "synthetic",
                  deletedLearners: 1,
                  retainedBillingReferences: 0,
                  billingManagementRequired: false,
                  consentWithdrawn: true,
                },
        }),
    );
    await page.route("**/api/v1/me", (route) =>
      route.fulfill({
        status: 503,
        json: { error: "family_service_unavailable" },
      }),
    );
    // The change is saved while the account's refresh fails (503).
    const saved = page.waitForResponse((response) =>
      /\/family\/(consent\/withdraw|delete-learning-data)$/.test(
        new URL(response.url()).pathname,
      ),
    );
    // Withdrawing asks once more in place; deleting is its one button.
    if (mutation === "withdraw") {
      await page.locator("[data-consent-withdraw]").click();
      await page.locator("[data-consent-withdraw-confirm]").click();
    } else await page.locator("[data-delete-learning]").click();
    await (await saved).finished();
    // The held problems arrive now, late, or were let go with the child's
    // sign-in when the device was taken back: either way they are over.
    releaseFamilyBatch();
    await familyBatchSettled;
    // Time for the page to take it in, if it still wanted it.
    await page.waitForTimeout(500);
    // The same document from here on: what the late answer could have put
    // back would be on it.
    await page.evaluate(() => {
      (
        window as Window & { __privacyRaceDocument?: boolean }
      ).__privacyRaceDocument = true;
    });
    // Back the way they came: Settings, then the child's page.
    for (const back of [
      (path: string) => path === settings,
      (path: string) => path === childsPage,
    ]) {
      await page.goBack();
      await page.waitForURL((url) => back(url.pathname));
    }
    assert.equal(
      await page.evaluate(
        () =>
          (window as Window & { __privacyRaceDocument?: boolean })
            .__privacyRaceDocument,
      ),
      true,
    );
    await page.locator("[data-app-bar]").waitFor();
    assert.equal(
      await page.locator("#answer").count(),
      0,
      "Late batch cannot restore practice after privacy invalidation",
    );
    assert.equal(
      await page.getByRole("button", { name: "Go", exact: true }).count(),
      0,
    );
    assert.equal(
      await page.getByRole("navigation", { name: "Learning sections" }).count(),
      0,
    );
    // The family's Settings stay reachable from the drawer.
    const after = await openMenu(page);
    await after.getByRole("link", { name: "Settings", exact: true }).click();
    await page.waitForURL((url) => url.pathname === settings);
    assert.deepEqual(errors, []);
    await page.close();
    console.log(
      `${mutation}: failed refresh and late batch cannot restore practice`,
    );
  }
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
