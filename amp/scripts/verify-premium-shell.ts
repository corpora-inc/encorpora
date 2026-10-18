import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, type Page, type Locator } from "playwright";
import { createServer } from "vite";
import { buildApp } from "../src/server/app";
import { PostgresRepository } from "../src/server/repository";
import {
  accountsAuth,
  createAccounts,
  registerAccountRoutes,
} from "../src/server/accounts";
import { registerFamilyRoutes } from "../src/family/routes";
import { migrate } from "./migrate";
const url = process.env.AMP_TEST_DATABASE_URL;
if (!url) throw Error("AMP_TEST_DATABASE_URL is required");
await migrate(url);
const repository = new PostgresRepository(url, { development: true });
const origin = "http://localhost:4384";
async function startServer() {
  const accounts = await createAccounts(repository.pool, {
    baseURL: origin,
    secret: "synthetic-browser-secret-".repeat(3),
    production: false,
    passwords: true,
    trustedOrigins: [],
  });
  const authenticate = accountsAuth(accounts);
  const app = buildApp({ repository, authenticate, development: true });
  await registerAccountRoutes(app, accounts);
  await registerFamilyRoutes(app, {
    pool: repository.pool,
    authenticate,
    development: true,
  });
  await app.listen({ host: "127.0.0.1", port: 4385 });
  return app;
}
let app = await startServer();
const vite = await createServer({
  server: {
    host: "127.0.0.1",
    port: 4384,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:4385" } },
  },
});
await vite.listen();
const browser = await chromium.launch();
const originalInfo = console.info;
console.info = (...args) => {
  if (!String(args[0]).startsWith("[accounts]")) originalInfo(...args);
};
const shots = "artifacts/premium-shell";
await mkdir(shots, { recursive: true });
const ready = async (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
async function stable(
  locator: Locator,
  before: Awaited<ReturnType<Locator["boundingBox"]>>,
  label: string,
) {
  assert.deepEqual(await locator.boundingBox(), before, label);
}
async function fits(page: Page) {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "no horizontal overflow",
  );
}
async function choose(page: Page, label: string, value: string) {
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.getByRole("option", { name: value, exact: true }).click();
}
async function contrast(page: Page, selector: string) {
  await page.evaluate("window.__name = (fn) => fn");
  const values = await page.locator(selector).evaluateAll((nodes) =>
    nodes.map((node) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext("2d")!;
      const rgb = (value: string) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = value || "white";
        ctx.fillRect(0, 0, 1, 1);
        return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
      };
      const luminance = (channels: number[]) =>
        channels
          .map((v) => {
            v /= 255;
            return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          })
          .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
      let parent: Element | null = node,
        bg = "";
      while (parent) {
        bg = getComputedStyle(parent).backgroundColor;
        if (bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") break;
        parent = parent.parentElement;
      }
      const a = luminance(rgb(getComputedStyle(node).color)),
        b = luminance(rgb(bg));
      return {
        text: node.textContent,
        ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
      };
    }),
  );
  for (const entry of values)
    assert.ok(entry.ratio >= 4.5, `readable ${entry.text}: ${entry.ratio}`);
}
try {
  let signupCount = 0;
  for (const theme of ["light", "dark"] as const)
    for (const width of [320, 390, 768, 1280]) {
      // Better Auth shares its configured sign-up burst limit across instances.
      if (signupCount++ && (signupCount - 1) % 3 === 0)
        await new Promise((resolve) => setTimeout(resolve, 11000));
      console.log("Checking", width, theme);
      const context = await browser.newContext({
        viewport: { width, height: 844 },
        colorScheme: theme,
      });
      const page = await context.newPage();
      page.setDefaultTimeout(12000);
      const faults: string[] = [],
        logs: string[] = [];
      page.on("pageerror", (e) => faults.push(e.message));
      page.on("console", (e) => {
        if (e.type() === "error") logs.push(e.text());
      });
      await page.goto(`${origin}/sign-up`);
      await page
        .getByRole("heading", { name: "Create your parent account" })
        .waitFor();
      await page.reload();
      await page
        .getByRole("heading", { name: "Create your parent account" })
        .waitFor();
      assert.ok(page.url().endsWith("/sign-up"));
      await fits(page);
      await page.getByLabel("Your name").fill("Sample Parent");
      await page
        .getByLabel("Email")
        .fill(`shell-${theme}-${width}-${Date.now()}@example.com`);
      await page
        .getByLabel("Password")
        .fill("synthetic long browser passphrase");
      await page
        .getByRole("button", { name: "Create account", exact: true })
        .click();
      await page.getByLabel("Learner name").waitFor();
      assert.ok(page.url().endsWith("/start/name"));
      await page.screenshot({
        path: `${shots}/guided-start-${width}-${theme}.png`,
      });
      await page.getByLabel("Learner name").fill("Avery");
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page.getByRole("group", { name: "Birth year" }).waitFor();
      assert.ok(page.url().endsWith("/start/birth-year"));
      await page.route("**/api/v1/learners", (r) =>
        r.fulfill({ status: 503, json: { error: "temporarily_unavailable" } }),
      );
      const card = page.locator(".start-card"),
        box = await card.boundingBox();
      await page.getByRole("button", { name: "2016", exact: true }).click();
      await page.getByRole("alert").waitFor();
      await ready(page);
      await stable(card, box, "failed learner save does not move setup");
      assert.ok(logs.some((s) => s.includes("AMP action failed")));
      await page.screenshot({
        path: `${shots}/setup-error-${width}-${theme}.png`,
      });
      await page.unroute("**/api/v1/learners");
      await page.getByRole("button", { name: "2016", exact: true }).click();
      await page
        .locator(".problem-stage")
        .waitFor()
        .catch(async (e) => {
          console.log(
            "Practice failure",
            page.url(),
            await page.locator("body").innerText(),
            logs,
          );
          throw e;
        });
      assert.ok(page.url().endsWith("/practice"));
      await fits(page);
      await page.screenshot({
        path: `${shots}/practice-${width}-${theme}.png`,
      });
      await page.reload();
      await page.locator(".problem-stage").waitFor();
      await fits(page);
      await page.goto(`${origin}/family/learners`);
      await page.getByRole("heading", { name: "Avery", exact: true }).waitFor();
      const tabs = page.locator(".family-tabs"),
        tabBox = await tabs.boundingBox();
      await page.getByRole("button", { name: "Access", exact: true }).click();
      assert.ok(page.url().endsWith("/family/access"));
      await page.goBack();
      await page.getByRole("heading", { name: "Avery", exact: true }).waitFor();
      await stable(tabs, tabBox, "family tab navigation keeps frame stable");
      await page.goForward();
      await page.waitForURL("**/family/access");
      await page.goBack();
      await page.getByRole("heading", { name: "Avery", exact: true }).waitFor();
      await page
        .getByRole("button", { name: "Add learner", exact: false })
        .click();
      await page.getByPlaceholder("First name or nickname").fill("Jordan");
      await page
        .getByRole("button", { name: "Birth year", exact: true })
        .click();
      await page.getByRole("dialog", { name: "Birth year" }).waitFor();
      await contrast(
        page,
        ".premium-options-heading button, .premium-options [role=option]",
      );
      await fits(page);
      await page.screenshot({
        path: `${shots}/year-picker-${width}-${theme}.png`,
      });
      await page.getByRole("option", { name: "2018", exact: true }).click();
      const form = page.locator(".family-add-learner"),
        formBox = await form.boundingBox();
      await page.route("**/api/v1/learners", (r) =>
        r.fulfill({ status: 503, json: { error: "temporarily_unavailable" } }),
      );
      await page
        .getByRole("button", { name: "Add learner", exact: true })
        .click();
      await page.getByRole("alert").waitFor();
      await ready(page);
      await stable(form, formBox, "failed family save does not move form");
      await fits(page);
      await page.screenshot({
        path: `${shots}/family-error-${width}-${theme}.png`,
      });
      await page.unroute("**/api/v1/learners");
      await page
        .getByRole("button", { name: "Add learner", exact: true })
        .click();
      await page.locator(".family-add-toggle").waitFor();
      await choose(page, "Family learner", "Jordan");
      await page
        .getByRole("heading", { name: "Jordan", exact: true })
        .waitFor();
      await page.goto(`${origin}/`);
      await page
        .getByRole("button", { name: "Learner", exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "Learner", exact: true })
          .textContent(),
        "Jordan⌄",
      );
      await page.goto(`${origin}/family/learners`);
      await page
        .getByRole("heading", { name: "Jordan", exact: true })
        .waitFor();
      // Hold a navigation refresh: existing family controls and data stay painted.
      let release!: () => void, entered!: () => void;
      const held = new Promise<void>((resolve) => (release = resolve)),
        requested = new Promise<void>((resolve) => (entered = resolve));
      await page.route("**/api/v1/family", async (r) => {
        entered();
        await held;
        await r.continue();
      });
      const before = await tabs.boundingBox();
      await page.getByRole("button", { name: "Access", exact: true }).click();
      await requested;
      await stable(tabs, before, "pending family refresh does not move tabs");
      await page.goBack();
      await page
        .getByRole("heading", { name: "Jordan", exact: true })
        .waitFor();
      release();
      await page.unrouteAll({ behavior: "wait" });
      await ready(page);
      await contrast(page, ".family-back,.family-tabs button");
      await page.screenshot({ path: `${shots}/family-${width}-${theme}.png` });
      await fits(page);
      await page.goto(`${origin}/lessons`);
      await page.locator(".library-main").waitFor();
      await fits(page);
      await page.screenshot({ path: `${shots}/lessons-${width}-${theme}.png` });
      await page.goto(`${origin}/progress`);
      await page.locator(".progress-workspace").waitFor();
      await fits(page);
      await page.screenshot({
        path: `${shots}/progress-${width}-${theme}.png`,
      });
      await page.goto(`${origin}/family/privacy`);
      await page
        .getByRole("heading", { name: "Your learning records" })
        .waitFor();
      await fits(page);
      await page.screenshot({ path: `${shots}/privacy-${width}-${theme}.png` });
      // Cold direct links keep a painted shell while session discovery is delayed.
      let releaseSession!: () => void;
      const sessionHold = new Promise<void>(
        (resolve) => (releaseSession = resolve),
      );
      await page.route("**/api/auth/get-session", async (route) => {
        await sessionHold;
        await route.continue();
      });
      await page.goto(`${origin}/family/learners`);
      await page.locator(".app-loading").waitFor();
      await fits(page);
      await page.screenshot({
        path: `${shots}/cold-load-${width}-${theme}.png`,
      });
      releaseSession();
      await page.unrouteAll({ behavior: "wait" });
      await page
        .getByRole("heading", { name: "Jordan", exact: true })
        .waitFor();
      if (width === 320 && theme === "light") {
        await page.route("**/api/v1/family", (route) =>
          route.fulfill({
            status: 503,
            json: { error: "family_service_unavailable" },
          }),
        );
        await page.goto(`${origin}/start/name`);
        await page.getByRole("alert").waitFor();
        await page
          .getByRole("button", { name: "Try again", exact: true })
          .waitFor();
        await fits(page);
        await page.screenshot({ path: `${shots}/cold-family-error.png` });
        await page.unroute("**/api/v1/family");
        await page
          .getByRole("button", { name: "Try again", exact: true })
          .click();
        await page.getByLabel("Learner name").waitFor();
        await page.goto(`${origin}/family/learners`);
        await page
          .getByRole("heading", { name: "Jordan", exact: true })
          .waitFor();
      }
      // Capability fixture: a parent without consent never sees a learner-write button.
      const response = await context.request.get(`${origin}/api/v1/family`),
        family = await response.json();
      await page.route("**/api/v1/family", (route) =>
        route.fulfill({
          json: {
            ...family,
            learners: [],
            consent: { ...family.consent, status: "not-recorded" },
          },
        }),
      );
      await page.route("**/api/v1/consent", (route) =>
        route.fulfill({
          json: {
            available: false,
            consentActive: false,
            notice: null,
            noticeDigest: null,
            confirmationDelayHours: null,
            request: null,
          },
        }),
      );
      await page.reload();
      await page.getByRole("button", { name: "Continue setup" }).waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "Add learner", exact: false })
          .count(),
        0,
      );
      await page.getByRole("button", { name: "Continue setup" }).click();
      await page
        .getByRole("heading", { name: "Enrollment is unavailable" })
        .waitFor();
      await fits(page);
      await page.screenshot({
        path: `${shots}/consent-unavailable-${width}-${theme}.png`,
      });
      assert.deepEqual(faults, []);
      await context.close();
      await app.close();
      app = await startServer();
    }
  console.log(
    "Premium shell: real parent sign-up → learner → first problem; routes, refresh/history, mutation consistency, failed-save and pending-refresh geometry; 4 widths × 2 themes passed. Development consent is a test fixture, not purchase-consent acceptance.",
  );
} finally {
  await browser.close();
  await vite.close();
  await app.close();
  await repository.pool.end();
}
