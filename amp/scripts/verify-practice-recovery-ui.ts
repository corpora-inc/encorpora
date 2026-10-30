import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, webkit, type Page } from "playwright";
import { createServer } from "vite";
import { buildApp } from "../src/server/app";
import { developmentAuth } from "../src/server/auth";
import { PostgresRepository } from "../src/server/repository";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";

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
const apiPort = 4487,
  port = 4486,
  origin = `http://127.0.0.1:${port}`;
await app.listen({ host: "127.0.0.1", port: apiPort });
const vite = await createServer({
  root: new URL("../", import.meta.url).pathname,
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  cacheDir: "node_modules/.vite-recovery",
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
          const trial = (
            await app.inject({
              method: "POST",
              url: "/api/v1/trials",
              payload: { birthYear: 2016 },
            })
          ).json();
          await context.addInitScript(
            (token) => localStorage.setItem("amp.trial", token),
            trial.token,
          );
          const page = await context.newPage();
          page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
          let failSave = false;
          await page.route("**/practice-state", async (route) => {
            if (failSave && route.request().method() === "POST") {
              failSave = false;
              await route.fulfill({
                status: 503,
                json: { message: "Practice could not be saved. Try again." },
              });
            } else await route.continue();
          });
          await page.goto(`${origin}/try/practice`);
          await page.locator(".question").waitFor();
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
          await page
            .getByRole("button", { name: "Reset practice level", exact: true })
            .click();
          const dialog = page.getByRole("dialog", {
            name: "Reset practice level?",
          });
          await dialog.waitFor();
          await geometry(page);
          await page.screenshot({
            path: `${shots}/${label}-reset.png`,
            fullPage: true,
          });
          await dialog
            .getByRole("button", { name: "Cancel", exact: true })
            .click();
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
          await page.getByRole("button", { name: "Open AMP menu" }).click();
          await page
            .getByRole("button", { name: "Reset practice level", exact: true })
            .click();
          failSave = true;
          await page
            .getByRole("button", { name: "Reset level", exact: true })
            .click();
          await dialog.getByRole("alert").waitFor();
          await geometry(page);
          await dialog
            .getByRole("button", { name: "Reset level", exact: true })
            .click();
          await dialog.waitFor({ state: "hidden" });
          assert.equal(await page.getByRole("dialog").count(), 0);
          await page.reload();
          await page.locator(".question").waitFor();
          const state = (
            await app.inject({
              method: "GET",
              url: `/api/v1/learners/${trial.learnerId}/practice-state`,
              headers: { authorization: `Trial ${trial.token}` },
            })
          ).json();
          assert.equal(state.epoch, 1, "retry reset once");
          assert.equal(state.workingTogether, true);
          assert.deepEqual(state.strandStarts, {});
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
