import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import { chromium, firefox, type Page } from "playwright";
import { createServer } from "vite";
import { buildApp } from "../src/server/app";
import { developmentAuth } from "../src/server/auth";
import { PostgresRepository } from "../src/server/repository";
import { trialKey } from "../src/web/lib/pending-trial";
import { fixtureMe } from "./me-fixture";
import { retentionNotice } from "../src/family/contracts";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";
const url = process.env.AMP_TEST_DATABASE_URL;
if (!url) throw new Error("AMP_TEST_DATABASE_URL is required");
assertTestDatabaseTarget(url);
await migrate(url);
const repository = new PostgresRepository(url, { development: true });
const app = buildApp({
  repository,
  authenticate: developmentAuth(),
  development: true,
});
await app.listen({ host: "127.0.0.1", port: 4463 });
const root = new URL("../", import.meta.url).pathname;
const vite = await createServer({
  root,
  configFile: root + "vite.config.ts",
  plugins: [
    {
      name: "hint-test-auth",
      enforce: "pre",
      load(id) {
        if (id.split("?")[0] === root + "src/web/auth.ts")
          return `export async function accessSession(){return localStorage.getItem("fixture.parent")?{token:"amp-local-development",accountId:"development-household"}:null;}export function onSessionChanged(){return()=>{}}export async function signIn(){}export async function signOut(){}export function notifyAccountSessionChanged(){}export async function authConfig(){return {mode:"accounts",passwords:true,providers:[]}}`;
      },
    },
  ],
  server: {
    host: "127.0.0.1",
    port: 4462,
    strictPort: true,
    fs: { allow: [root, realpathSync(root + "node_modules")] },
    proxy: { "/api": { target: "http://127.0.0.1:4463" } },
  },
});
await vite.listen();
async function submit(page: Page) {
  const compact = page.locator(".compact-answer-action");
  if (await compact.isVisible()) await compact.click();
  const choice = page.locator(".choice-option:visible");
  if (await choice.count()) {
    await choice.first().click();
    await page.locator(".choice-submit:visible").click();
  } else {
    await page.locator("#answer:visible").fill("1");
    await page.locator("#answer:visible").press("Enter");
  }
}
try {
  for (const [name, engine] of Object.entries({ chromium, firefox })) {
    const browser = await engine.launch();
    try {
      for (const mode of ["trial", "fallback", "account"]) {
        const fallback = mode === "fallback";
        const created = await app.inject({
          method: "POST",
          url: "/api/v1/trials",
          payload: { birthYear: 2016 },
        });
        assert.equal(created.statusCode, 201);
        const { token } = created.json();
        const context = await browser.newContext({
          viewport: { width: 390, height: 844 },
        });
        await context.addInitScript(
          ([key, token]) => localStorage.setItem(key!, token!),
          [trialKey, token],
        );
        const page = await context.newPage();
        if (mode === "account") {
          const learner = await repository.create(
            "development-household",
            "Hint learner",
            2016,
          );
          await context.addInitScript(() =>
            localStorage.setItem("fixture.parent", "1"),
          );
          await page.route("**/api/v1/me", (route) =>
            route.fulfill({
              json: fixtureMe(
                {
                  consent: {
                    status: "development",
                    policyVersion: "fixture",
                    recordedAt: null,
                    withdrawnAt: null,
                  },
                  learners: [
                    {
                      ...learner,
                      deletedAt: null,
                      stripeLinked: false,
                      canPractice: true,
                      access: [],
                    },
                  ],
                  retained: retentionNotice,
                },
                "development-household",
              ),
            }),
          );
        }
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        let hintRequests = 0;
        await page.route("**/hints", async (route) => {
          hintRequests++;
          if (fallback) await route.continue();
          else await route.abort();
        });
        if (fallback)
          await page.route("**/batches", async (route) => {
            const response = await route.fetch();
            const body = await response.json();
            delete body.hints;
            await route.fulfill({ response, json: body });
          });
        await page.goto(
          `http://127.0.0.1:4462/${mode === "account" ? "practice" : "try/practice"}`,
        );
        await page.locator(".question").waitFor();
        const hint = page.getByRole("button", { name: "Hint", exact: true });
        await hint.click();
        const dialog = page.getByRole("dialog", { name: "Hint", exact: true });
        await page.waitForFunction(() => {
          const text = document.querySelector(".hint")?.textContent;
          return (
            text && !text.includes("Finding") && !text.includes("could not")
          );
        });
        const hintText = await dialog.locator(".hint").textContent();
        await page.keyboard.press("Escape");
        if (mode !== "account") {
          await page.getByRole("link", { name: "Your level" }).click();
          await page.waitForURL("**/try/map");
          await page.goBack();
          await page.locator(".question").waitFor();
        }
        await hint.click();
        assert.equal(
          await dialog.locator(".hint").textContent(),
          hintText,
          "navigation keeps revealed help",
        );
        await page.keyboard.press("Escape");
        assert.equal(
          hintRequests,
          fallback ? 1 : 0,
          "preloaded hints need no content request",
        );
        if (mode === "trial") {
          const submitted: unknown[] = [];
          await page.route("**/attempts", async (route) => {
            submitted.push(route.request().postDataJSON());
            if (submitted.length === 1) {
              await route.fetch();
              await route.abort();
            } else await route.continue();
          });
          await submit(page);
          await page.getByRole("alert").first().waitFor();
          assert.ok(
            await hint.isDisabled(),
            "cannot reveal extra help while retrying an immutable answer",
          );
          const retried = page.waitForResponse((r) =>
            r.url().endsWith("/attempts"),
          );
          await page
            .locator(".answer-action:visible, .choice-submit:visible")
            .click();
          assert.equal((await (await retried).json()).assisted, true);
          assert.equal(submitted.length, 2);
          assert.deepEqual(
            submitted[0],
            submitted[1],
            "lost-response retry preserves the answer and assistance",
          );
          await page.unroute("**/attempts");
        } else {
          const attempt = page.waitForResponse((r) =>
            r.url().endsWith("/attempts"),
          );
          await submit(page);
          const response = await attempt;
          assert.equal(response.status(), 200);
          assert.equal((await response.json()).assisted, true);
          assert.equal(
            response.request().postDataJSON().hintViewed,
            fallback ? undefined : true,
          );
        }
        await page.locator(".next-action").click();
        await page.locator(".feedback").waitFor({ state: "detached" });
        const next = page.waitForResponse((r) => r.url().endsWith("/attempts"));
        await submit(page);
        assert.equal(
          (await (await next).json()).assisted,
          false,
          "preloading alone is independent; help resets between problems",
        );
        assert.deepEqual(errors, []);
        await page.unrouteAll({ behavior: "wait" });
        await context.close();
        console.log(
          `${name}/${mode}: ${fallback ? "legacy fallback" : "preloaded hints without a hint request"}, map/back, assisted answer, independent next answer`,
        );
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  await vite.close();
  await app.close();
  await repository.close();
}
