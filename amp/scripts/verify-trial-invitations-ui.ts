import { secureChromium } from "../browser-security.mjs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  chromium as rawChromium,
  webkit,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";
import { createServer } from "vite";
import { retentionNotice } from "../src/family/contracts";
import { noticeDigest } from "../src/parent-consent/crypto";
import { signupNotice } from "../src/parent-followup/contracts";
import { buildApp } from "../src/server/app";
import { PostgresRepository } from "../src/server/repository";
import { trialLimits } from "../src/server/trials";
import { consentFixture } from "../tests/parent-consent.fixture";
import { migrate } from "./migrate";
import { answerOne, trackPracticeProblems } from "./ui-practice-answer";
import { guaranteeProblems, RISK_FREE } from "./ui-copy-checks";

/**
 * From the pitch into the free trial and back to Buy, against the real
 * learning API and a synthetic account and billing API:
 * pitch → Try it free → sign-up ("Try AMP free", the parent follow-up
 * intent) → birth year → the first free workbook offer → practice with the
 * toolbar Buy → placement → the map's invitation card → the invitation that
 * comes with an earned workbook → card and funded Buy from the trial.
 * Chromium and WebKit; 320/390/768/1280, light and dark for the toolbar Buy
 * and the invitation card. Phones: the answer feedback never covers the
 * question.
 *
 *     AMP_TEST_DATABASE_URL=… npx tsx scripts/verify-trial-invitations-ui.ts
 *       [--engine chromium|webkit|all] [--widths 320,390,768,1280] [--shots DIR]
 */
const url = process.env.AMP_TEST_DATABASE_URL;
if (!url)
  throw new Error("AMP_TEST_DATABASE_URL is required for browser verification");
const argument = (name: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : undefined;
};
const engines =
  (argument("engine") ?? "all") === "all"
    ? (["chromium", "webkit"] as const)
    : ([argument("engine")] as ["chromium" | "webkit"]);
const widths = (argument("widths") ?? "320,390,768,1280")
  .split(",")
  .map(Number);
const shots = argument("shots") ?? "artifacts/trial-invitations";
await mkdir(shots, { recursive: true });

// 40 free problems: placement, the workbook earned at 20, and a wrong
// answer on each phone viewport.
const FREE = 40;
const { placement: PLACEMENT } = trialLimits(FREE);
await migrate(url);
const repository = new PostgresRepository(url, {
  development: true,
  freeProblems: FREE,
});
let account = `trial-invitations-${randomUUID()}`;
// The signed-in parent's session, as the hosted accounts cookie would carry
// it alongside a trial token. Signed out: 401, as hosted mode reports.
let signedIn = () => false;
// Hosted mode, as production: trials are owned by the signed-in parent.
const app = buildApp({
  repository,
  development: false,
  authenticate: async () => {
    if (!signedIn())
      throw Object.assign(new Error("Sign in to continue"), {
        statusCode: 401,
      });
    return account;
  },
});
const apiPort = 4429,
  port = 4428;
await app.listen({ host: "127.0.0.1", port: apiPort });
const origin = `http://127.0.0.1:${port}`;
const authPath = fileURLToPath(new URL("../src/web/auth.ts", import.meta.url));
// The session comes from this script, so the sign-up answered below really
// signs the tab in; the learning API accepts the development bearer token.
const auth = `const listeners=new Set();
export async function accessSession(){const r=await fetch('/api/__trial/session');return (await r.json()).session;}
export function onSessionChanged(update){listeners.add(update);return()=>listeners.delete(update);}
export function notifyAccountSessionChanged(s){if(s!==undefined)for(const l of listeners)l(s);}
export async function signIn(){}export async function signOut(){}
export async function authConfig(){return {mode:'accounts',passwords:true,parentFollowup:true,providers:[]};}`;
const vite = await createServer({
  root: new URL("../", import.meta.url).pathname,
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  cacheDir: "node_modules/.vite-trial-invitations",
  logLevel: "error",
  plugins: [
    {
      name: "trial-invitations-auth",
      enforce: "pre",
      load(id) {
        return id.split("?")[0] === authPath ? auth : undefined;
      },
    },
  ],
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

const policy = {
  ...consentFixture,
  review: { ...consentFixture.review, paymentNotificationsReviewed: true },
};
const offers = [
  {
    id: "a".repeat(64),
    mode: "test",
    currency: "USD",
    amountMinor: 49900,
    formattedAmount: "$499.00",
    interval: "year",
    learnerCount: 1,
  },
  {
    id: "b".repeat(64),
    mode: "test",
    currency: "USD",
    amountMinor: 4900,
    formattedAmount: "$49.00",
    interval: "month",
    learnerCount: 1,
  },
];
const fundedOffer = {
  id: "ar-efa-annual",
  revision: "fixture-1",
  programName: "Arkansas EFA",
  productTitle: "AMP Mathematics, 12 months",
  totalMinor: 49900,
  currency: "USD",
  instructions: "Attach the invoice to your request.",
  termMonths: 12,
};
type Api = {
  signedIn: boolean;
  intents: Record<string, unknown>[];
  events: { event: string; props?: Record<string, unknown> }[];
  faults: string[];
};
const api: Api = { signedIn: false, intents: [], events: [], faults: [] };
signedIn = () => api.signedIn;
const campaign = "utm_campaign=ar-efa-launch&utm_source=google&utm_medium=cpc";

async function serve(context: BrowserContext) {
  await context.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, json: body });
    if (path === "/api/__trial/session")
      return json({
        session: api.signedIn
          ? { token: "amp-local-development", accountId: account }
          : null,
      });
    if (path === "/api/v1/billing/prices")
      return json({ available: true, offers });
    if (path === "/api/v1/funding/invoice-offers")
      return json({
        offers:
          new URL(request.url()).searchParams.get("program") === "ar-efa"
            ? [fundedOffer]
            : [],
      });
    if (path === "/api/v1/parent-followup/intent") {
      api.intents.push(request.postDataJSON());
      return json({ ready: true });
    }
    if (path === "/api/v1/parent-followup/complete") return json({});
    if (path === "/api/auth/sign-up/email") {
      api.signedIn = true;
      return json({
        token: "amp-local-development",
        user: { id: account, email: "parent@example.test" },
      });
    }
    if (path === "/api/v1/events") {
      for (const event of request.postDataJSON().events) api.events.push(event);
      return json({ accepted: 1 }, 202);
    }
    if (path === "/api/v1/events/context")
      return json({ generation: "initial" });
    if (path === "/api/v1/me")
      return json({
        signedIn: true,
        account: {
          id: account,
          email: "parent@example.test",
          emailVerified: true,
          confirmationRequired: false,
        },
        consent: { status: "none", method: null },
        family: {
          consent: {
            status: "not-recorded",
            policyVersion: null,
            recordedAt: null,
            withdrawnAt: null,
          },
          learners: [],
          retained: retentionNotice,
        },
        learners: [],
        next: "try",
      });
    if (path === "/api/v1/billing/enrollment")
      return json({
        available: true,
        notice: policy.notice,
        noticeDigest: noticeDigest(policy),
        purchase: null,
      });
    if (path === "/api/v1/billing/offer")
      return json({ available: true, offer: offers[0], offers });
    if (
      path.startsWith("/api/v1/billing") ||
      path.startsWith("/api/v1/funding")
    ) {
      api.faults.push(`unexpected ${request.method()} ${path}`);
      return json({ error: "unexpected" }, 404);
    }
    return route.fallback();
  });
}

async function noOverflow(page: Page, tag: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - innerWidth,
  );
  assert.ok(overflow <= 1, `${tag}: no horizontal overflow (${overflow}px)`);
}
async function targets(page: Page, selector: string, tag: string) {
  const small = await page.evaluate(
    (selector) =>
      [...document.querySelectorAll(`${selector} a, ${selector} button`)]
        .map((node) => [node.textContent, node.getBoundingClientRect()])
        .filter(
          ([, box]) =>
            (box as DOMRect).width > 0 &&
            ((box as DOMRect).height < 44 || (box as DOMRect).width < 44),
        )
        .map(([text]) => text),
    selector,
  );
  assert.deepEqual(small, [], `${tag}: 44px targets`);
}
/** Next; a level check that opens with the next problem is continued past
 * (verify-level-check-ui covers it). */
async function next(page: Page) {
  const leaving = page.url();
  await page.locator(".next-action").click();
  await Promise.race([
    page.locator(".next-action").waitFor({ state: "detached" }),
    page.waitForURL((url) => url.href !== leaving),
  ]);
  await page.waitForTimeout(150);
  const check = page.getByRole("dialog", {
    name: "Here’s where we think you are",
  });
  if (await check.isVisible()) {
    await check.getByRole("button", { name: "Continue" }).click();
    await check.waitFor({ state: "detached" });
  }
  // Placement ends on the map; practice continues from it.
  if (new URL(page.url()).pathname === "/try/map")
    await page.getByRole("link", { name: "Keep practicing" }).click();
}
/** On phones the answer feedback rises over the dock; the question above it
 * stays whole. */
async function questionVisible(page: Page, tag: string) {
  const geometry = await page.evaluate(() => {
    const question = document.querySelector(
      ".problem-stage .question, .problem-content .question",
    );
    const sheet = document.querySelector(".feedback");
    if (!question || !sheet) return null;
    return {
      question: question.getBoundingClientRect().bottom,
      sheet: sheet.getBoundingClientRect().top,
    };
  });
  assert.ok(geometry, `${tag}: question and feedback present`);
  if (geometry.question > geometry.sheet + 1)
    await page.screenshot({
      path: `${shots}/${tag.replaceAll(" ", "-")}-covered.png`,
    });
  assert.ok(
    geometry.question <= geometry.sheet + 1,
    `${tag}: the feedback covers the question (${JSON.stringify(geometry)})`,
  );
}

async function journey(browser: Browser, engine: string) {
  api.signedIn = false;
  api.intents = [];
  api.events = [];
  account = `trial-invitations-${randomUUID()}`;
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await serve(context);
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  trackPracticeProblems(page);
  if (process.env.TRIAL_DEBUG)
    page.on("response", async (response) => {
      if (response.url().includes("/api/v1/") && response.status() >= 400)
        console.log(
          "DEBUG",
          response.request().method(),
          new URL(response.url()).pathname,
          response.status(),
          (await response.text().catch(() => "")).slice(0, 160),
        );
    });
  // Pitch → Try it free → sign-up.
  await page.goto(`${origin}/`);
  await page.getByRole("button", { name: "Try it free" }).first().click();
  await page.getByRole("heading", { name: "Try AMP free" }).waitFor();
  await page
    .getByText(
      "Your child moves forward in the free assessment, with adaptive practice and printable workbooks. No credit card, no obligation.",
    )
    .waitFor();
  await noOverflow(page, `${engine} sign-up`);
  await page.screenshot({ path: `${shots}/${engine}-sign-up-390.png` });
  await page.getByLabel("Email").fill("parent@example.test");
  await page.getByLabel("AMP password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create account" }).click();
  // Birth year → the first free workbook, offered before the first answer.
  await page.getByRole("group", { name: "Birth year" }).waitFor();
  assert.equal(api.intents.length, 1, `${engine}: one signup intent`);
  assert.equal(api.intents[0]!.entry, "pitch-try");
  assert.equal(api.intents[0]!.notice, signupNotice);
  await page
    .getByRole("group", { name: "Birth year" })
    .getByRole("button", { name: "2016", exact: true })
    .click();
  const welcome = page.getByRole("dialog", { name: "Watch AMP adapt" });
  await welcome.waitFor();
  await welcome
    .getByRole("button", { name: "Download free workbook" })
    .waitFor();
  await page.screenshot({ path: `${shots}/${engine}-first-workbook-390.png` });
  await welcome.getByRole("button", { name: "Start practicing" }).click();
  // The toolbar Buy is there with the first problem.
  await page.locator(".problem-stage").waitFor();
  assert.equal(
    await page.locator("[data-trial-buy]").count(),
    1,
    `${engine}: toolbar Buy with the first paint`,
  );
  // Placement, then the workbook earned at 20 answers.
  for (let answered = 1; answered <= 20; answered++) {
    try {
      await answerOne(page, answered % 3 !== 0);
    } catch (failure) {
      await page.screenshot({
        path: `${shots}/${engine}-failed-answer-${answered}.png`,
      });
      throw failure;
    }
    // Right and wrong answers alike leave the question whole on a phone.
    await questionVisible(page, `${engine} 390 feedback ${answered}`);
    if (answered === 1)
      await page.screenshot({ path: `${shots}/${engine}-feedback-390.png` });
    if (answered === 3)
      await page.screenshot({
        path: `${shots}/${engine}-feedback-wrong-390.png`,
      });
    if (answered === 20) break;
    try {
      await next(page);
    } catch (failure) {
      await page.screenshot({ path: `${shots}/${engine}-failed-next.png` });
      throw failure;
    }
  }
  assert.ok(PLACEMENT < 20, "placement finishes before the earned workbook");
  const earned = page.locator('[data-trial-invitation="workbook"]');
  await earned.waitFor();
  await earned.getByRole("button", { name: "Buy AMP" }).waitFor();
  // The short promise keeps its asterisk and its footnote, in the feedback too.
  await earned.getByText("Risk\u2011free for 30 days*").waitFor();
  assert.deepEqual(
    await guaranteeProblems(page, '[data-trial-invitation="workbook"]'),
    [],
    `${engine}: earned-workbook guarantee copy`,
  );
  await page.locator("[data-workbook-offer]").waitFor();
  await targets(page, '[data-trial-invitation="workbook"]', `${engine} earned`);
  await noOverflow(page, `${engine} earned`);
  await page.screenshot({ path: `${shots}/${engine}-earned-workbook-390.png` });
  const state = await context.storageState();
  await context.close();
  assert.deepEqual(errors, [], `${engine}: no page errors`);
  return state;
}

async function viewports(
  browser: Browser,
  engine: string,
  state: Awaited<ReturnType<BrowserContext["storageState"]>>,
) {
  for (const colorScheme of ["light", "dark"] as const)
    for (const width of widths) {
      const tag = `${engine}-${width}-${colorScheme}`;
      const context = await browser.newContext({
        viewport: { width, height: width >= 768 ? 900 : 800 },
        colorScheme,
        storageState: state,
      });
      await serve(context);
      const page = await context.newPage();
      page.setDefaultTimeout(20_000);
      trackPracticeProblems(page);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      if (process.env.TRIAL_DEBUG)
        page.on("response", async (response) => {
          if (response.url().includes("/api/"))
            console.log(
              "DEBUG",
              response.request().method(),
              new URL(response.url()).pathname,
              response.status(),
              (await response.text().catch(() => "")).slice(0, 160),
            );
        });
      await page.goto(`${origin}/try/practice`);
      await page
        .locator(".problem-stage")
        .waitFor()
        .catch(async (failure) => {
          await page.screenshot({ path: `${shots}/${tag}-failed.png` });
          throw failure;
        });
      // The loading frame and the problem share one toolbar row: the Buy
      // control arrives with the problem without moving it.
      // The frame's stage, read once it is attached (it is replaced in place).
      let frame: { x: number; y: number } | null = null;
      while (!frame) {
        await page.locator(".problem-stage").waitFor();
        frame = await page.locator(".problem-stage").boundingBox();
      }
      await page.locator(".problem-content[data-problem-id]").waitFor();
      // Below 360 px the toolbar keeps the skill title; Buy is in the
      // invitations instead.
      assert.equal(
        await page.locator("[data-trial-buy]").isVisible(),
        width >= 360,
        `${tag}: toolbar Buy`,
      );
      const stage = await page.locator(".problem-stage").boundingBox();
      assert.equal(
        Math.round(stage!.y),
        Math.round(frame!.y),
        `${tag}: the problem starts where its loading frame did`,
      );
      await page.waitForTimeout(800);
      assert.deepEqual(
        await page.locator(".problem-stage").boundingBox(),
        stage,
        `${tag}: nothing moves once the problem shows`,
      );
      if (width >= 360)
        await targets(page, "[data-trial-buy]", `${tag} toolbar`);
      await noOverflow(page, `${tag} practice`);
      await page.screenshot({ path: `${shots}/${tag}-practice.png` });
      if (width <= 650) {
        await answerOne(page, false);
        await questionVisible(page, `${tag} wrong-answer feedback`);
        await page.screenshot({ path: `${shots}/${tag}-feedback.png` });
      }
      await page.goto(`${origin}/try/map`);
      const card = page.locator('[data-trial-invitation="map"]');
      await card.waitFor();
      await card
        .getByRole("heading", { name: "Ready for the full year?" })
        .waitFor();
      await card.getByText(RISK_FREE).waitFor();
      assert.deepEqual(
        await guaranteeProblems(page, '[data-trial-invitation="map"]'),
        [],
        `${tag}: map guarantee copy`,
      );
      // The invitation is the map's one Buy: no "See plans" beside it.
      assert.equal(
        await page.getByRole("link", { name: "See plans" }).count(),
        0,
        `${tag}: one purchase action on the map`,
      );
      await card.getByText(/^\*Refunds go back the way you paid/).waitFor();
      await card.locator("[data-trial-workbooks]").waitFor();
      await targets(page, '[data-trial-invitation="map"]', `${tag} card`);
      await noOverflow(page, `${tag} map`);
      await card.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${shots}/${tag}-invitation.png` });
      assert.deepEqual(errors, [], `${tag}: no page errors`);
      await context.close();
    }
}

/** Buy from the trial: the card plan's checkout step, and a funded
 * program's invoice with its campaign and refund terms. */
async function buyJourneys(
  browser: Browser,
  engine: string,
  state: Awaited<ReturnType<BrowserContext["storageState"]>>,
) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    storageState: state,
  });
  await serve(context);
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  await page.goto(`${origin}/try/practice`);
  await page.locator("[data-trial-buy]").getByRole("button").click();
  await page.waitForURL("**/start/plan**");
  await page.getByRole("radiogroup", { name: "Plan" }).waitFor();
  await page.goto(`${origin}/try/map?program=ar-efa&${campaign}`);
  const card = page.locator('[data-trial-invitation="map"]');
  await card.getByRole("link", { name: "Buy with Arkansas EFA funds" }).click();
  await page.waitForURL("**/invoice/arkansas-efa?**");
  assert.equal(
    new URL(page.url()).searchParams.get("utm_campaign"),
    "ar-efa-launch",
    `${engine}: campaign kept`,
  );
  await page
    .getByText("Paid through Arkansas EFA, so its refund rules apply.")
    .waitFor();
  await page.screenshot({
    path: `${shots}/${engine}-trial-funded-invoice.png`,
  });
  // On a funded page the invitation never promises a refund.
  await page.goto(`${origin}/try/map?program=ar-efa&${campaign}`);
  await card.waitFor();
  // An offer that has not stated its refund policy: no promise beside Buy.
  assert.equal(await card.getByText(/Risk\u2011free/).count(), 0);
  // The first-party queue sends within two seconds.
  await page.waitForTimeout(2500);
  await context.close();
  const names = api.events.map((event) => event.event);
  for (const name of ["invite_view", "buy_click"])
    assert.ok(names.includes(name), `${engine}: ${name} recorded`);
  assert.ok(
    api.events.some(
      (event) =>
        event.event === "buy_click" &&
        event.props?.from === "chrome" &&
        event.props.path === "card",
    ),
    `${engine}: toolbar Buy recorded`,
  );
  assert.ok(
    api.events.some(
      (event) =>
        event.event === "buy_click" &&
        event.props?.from === "invite" &&
        event.props.path === "funded",
    ),
    `${engine}: invitation Buy recorded`,
  );
}

try {
  for (const engine of engines) {
    const browser = await (
      engine === "webkit" ? webkit : secureChromium(rawChromium)
    ).launch();
    try {
      const state = await journey(browser, engine);
      await viewports(browser, engine, state);
      await buyJourneys(browser, engine, state);
    } finally {
      await browser.close();
    }
    assert.deepEqual(api.faults, [], "every billing request was expected");
    console.log(
      `PASS ${engine}: pitch → Try it free → sign-up → trial with the first workbook; toolbar Buy and invitation at ${widths.join("/")} px light/dark; earned-workbook invitation; card and funded Buy`,
    );
  }
} finally {
  await vite.close();
  await app.close();
  await repository.close();
}
