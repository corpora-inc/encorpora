import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, type Locator, type Page, type Route } from "playwright";
import { createServer } from "vite";
import { retentionNotice } from "../src/family/contracts";
import { noticeDigest } from "../src/parent-consent/crypto";
import { consentFixture } from "../tests/parent-consent.fixture";
import type { EnrollmentView } from "../src/billing/stripe/enrollment-contracts";
import { buildApp } from "../src/server/app";
import { developmentAuth } from "../src/server/auth";
import { PostgresRepository } from "../src/server/repository";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { trialLimits } from "../src/server/trials";
import { migrate } from "./migrate";
import { assertPhoneLandscapeSmoke, isPhoneLandscape } from "./ui-viewports";

/**
 * The free trial end to end, against the real learning API and a synthetic
 * account and billing API: visitor → placement → map → adaptive practice →
 * paywall at the limit → "not now" → plan → Stripe Checkout redirect →
 * verified return → the free practice becomes the paid learner, who keeps
 * practicing. Also: a signed-in parent without a purchase lands in the trial,
 * the first paint never flashes loading text, nothing shifts, axe is clean.
 * Runs at 320x568, 384x688, 390x844, 768x1024 and 1280x800, plus an 844x390 phone-landscape
 * smoke, in light and dark.
 */
const url = process.env.AMP_TEST_DATABASE_URL;
if (!url)
  throw new Error("AMP_TEST_DATABASE_URL is required for browser verification");
const FREE = 10;
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
await registerFamilyRoutes(app, {
  pool: repository.pool,
  authenticate: developmentAuth(),
  development: true,
});
const apiPort = 4363,
  port = 4362;
await app.listen({ host: "127.0.0.1", port: apiPort });
const origin = `http://127.0.0.1:${port}`;
const authPath = fileURLToPath(new URL("../src/web/auth.ts", import.meta.url));
// A signed-in parent exists only while this tab's fixture flag is set; the
// learning API's development authenticator accepts the same bearer token.
const auth = `export async function accessSession(){return localStorage.getItem('fixture.parent')?{token:'amp-local-development',accountId:'development-household'}:null;}export function onSessionChanged(){return()=>{};}export async function signIn(){}export async function signOut(){}export function notifyAccountSessionChanged(){}export async function authConfig(){return {mode:'accounts',passwords:true,providers:[]};}`;
const vite = await createServer({
  root: new URL("../", import.meta.url).pathname,
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  cacheDir: "node_modules/.vite-free-trial",
  plugins: [
    {
      name: "free-trial-auth",
      enforce: "pre",
      load(id) {
        return id.split("?")[0] === authPath ? auth : undefined;
      },
    },
  ],
  server: {
    host: "127.0.0.1",
    port,
    strictPort: true,
    // A linked node_modules (worktrees) still serves KaTeX fonts.
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
const browser = await chromium.launch({ args: ["--no-proxy-server"] });
const shots =
  process.env.TRIAL_SCREENS ??
  new URL("../artifacts/free-trial/", import.meta.url).pathname;
await mkdir(shots, { recursive: true });
const shots_dir = shots;

const policy = {
  ...consentFixture,
  review: { ...consentFixture.review, paymentNotificationsReviewed: true },
};
const digest = noticeDigest(policy);
const purchaseId = "6f1c2f4e-6c1d-4a4b-9a0e-2b6f8d1c0a11";
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
type State = {
  next: "try" | "choose-plan" | "add-learner" | "practice";
  learners: { id: string; name: string; birthYear: number; paid: boolean }[];
  enrollment: EnrollmentView;
  checkouts: Record<string, unknown>[];
  claims: { purchaseId: string; learnerId: string }[];
  adopted: string | null;
};
const fresh = (): State => ({
  next: "try",
  learners: [],
  enrollment: {
    available: true,
    notice: policy.notice,
    noticeDigest: digest,
    purchase: null,
  },
  checkouts: [],
  claims: [],
  adopted: null,
});
function me(state: State) {
  const consent = state.next !== "try";
  return {
    signedIn: true,
    account: {
      id: "development-household",
      email: "parent@example.test",
      emailVerified: true,
    },
    consent: {
      status: consent ? "active" : "none",
      method: consent ? "monetary-transaction" : null,
    },
    learners: state.learners.map((l) => ({
      id: l.id,
      name: l.name,
      birthYear: l.birthYear,
      entitlement: {
        active: l.paid,
        plan: l.paid ? "stripe" : null,
        endsAt: null,
      },
    })),
    family: {
      consent: {
        status: consent ? "active" : "not-recorded",
        policyVersion: null,
        recordedAt: null,
        withdrawnAt: null,
      },
      learners: state.learners.map((l) => ({
        id: l.id,
        name: l.name,
        birthYear: l.birthYear,
        deletedAt: null,
        access: l.paid
          ? [
              {
                channel: "stripe",
                status: "active",
                startsAt: "2026-01-01T00:00:00.000Z",
                endsAt: "2099-01-01T00:00:00.000Z",
              },
            ]
          : [],
        stripeLinked: l.paid,
        canPractice: l.paid,
      })),
      retained: retentionNotice,
    },
    ...(state.next === "add-learner"
      ? {
          unassignedPurchase: {
            id: purchaseId,
            interval: "month",
            endsAt: "2099-01-01T00:00:00.000Z",
          },
        }
      : {}),
    next: state.next,
  };
}
const purchase = (phase: string, url: string | null = null) =>
  ({
    id: purchaseId,
    interval: "month" as const,
    phase,
    learnerId: null,
    url,
  }) as NonNullable<EnrollmentView["purchase"]>;

/** Synthetic account and billing; everything else is the real API. */
async function serve(page: Page, state: State, faults: string[]) {
  await page.route("https://checkout.stripe.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Stripe Checkout fixture</title><h1>Stripe Checkout fixture</h1>",
    }),
  );
  await page.route("**/api/auth/**", (route) =>
    route.fulfill({ json: { status: true } }),
  );
  await page.route("**/api/v1/**", async (route: Route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname.replace("/api/v1", "");
    if (path === "/me") return route.fulfill({ json: me(state) });
    if (path === "/billing/prices")
      return route.fulfill({ json: { available: true, offers } });
    if (path === "/billing/offer")
      return route.fulfill({
        json: { available: true, offer: offers[0], offers },
      });
    if (path === "/consent")
      return route.fulfill({
        json: {
          available: false,
          consentActive: false,
          notice: null,
          noticeDigest: null,
          confirmationDelayHours: null,
          request: null,
        },
      });
    if (path === "/billing/enrollment")
      return route.fulfill({ json: state.enrollment });
    if (path === "/billing/enrollment/checkout") {
      state.checkouts.push(req.postDataJSON());
      state.enrollment = {
        ...state.enrollment,
        purchase: purchase(
          "checkout-open",
          "https://checkout.stripe.com/c/pay/cs_fixture",
        ),
      };
      return route.fulfill({
        json: { url: "https://checkout.stripe.com/c/pay/cs_fixture" },
      });
    }
    if (path === "/billing/enrollment/claim") {
      const body = req.postDataJSON();
      state.claims.push(body);
      state.learners = state.learners.map((l) =>
        l.id === body.learnerId ? { ...l, paid: true } : l,
      );
      state.next = "practice";
      state.enrollment = {
        ...state.enrollment,
        purchase: { ...purchase("assigned"), learnerId: body.learnerId },
      };
      return route.fulfill({ json: { assigned: true } });
    }
    if (path === "/trials/adopt") {
      // The real adoption: every free answer moves into the family.
      const response = await route.fetch();
      const learner = await response.json();
      if (response.ok()) {
        state.adopted = learner.id;
        state.learners.push({ ...learner, paid: false });
      }
      return route.fulfill({ response, json: learner });
    }
    if (path.startsWith("/billing") || path.startsWith("/funding")) {
      faults.push(`unexpected ${req.method()} ${path}`);
      return route.fulfill({ status: 404, json: { error: "unexpected" } });
    }
    return route.fallback();
  });
}

async function fits(page: Page, label: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - innerWidth,
  );
  assert.ok(overflow <= 0, `${label}: no horizontal overflow (${overflow}px)`);
  if (isPhoneLandscape(page.viewportSize()!))
    await assertPhoneLandscapeSmoke(page, label);
}
async function frames(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}
async function box(locator: Locator) {
  return locator.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return {
      x: rect.x + scrollX,
      y: rect.y + scrollY,
      width: rect.width,
      height: rect.height,
    };
  });
}
async function axe(page: Page, label: string) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  assert.deepEqual(
    result.violations
      .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
      .map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(" ")}`),
    [],
    `${label}: no serious accessibility violations`,
  );
}
/** Unexpected layout shift (not caused by recent input), summed since load,
 * and any loading text painted at any moment. */
// A string, so the bundler's helpers never leak into the page.
const watch = `(() => {
  window.__shift = 0;
  window.__flash = [];
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries())
      if (!entry.hadRecentInput) window.__shift += entry.value;
  }).observe({ type: "layout-shift", buffered: true });
  const phrases = ["Opening your workspace", "Let’s set up your family", "Getting your family ready"];
  new MutationObserver(() => {
    const text = document.body ? document.body.innerText : "";
    for (const phrase of phrases)
      if (text.includes(phrase) && !window.__flash.includes(phrase))
        window.__flash.push(phrase);
  }).observe(document, { subtree: true, childList: true, characterData: true });
  // Every painted frame's visible text, from the first frame on.
  window.__frames = [];
  const record = () => {
    const text = document.body ? document.body.innerText.trim().replace(/\\s+/g, " ") : "";
    const last = window.__frames[window.__frames.length - 1];
    if (!last || last.text !== text) window.__frames.push({ path: location.pathname, text });
    if (window.__frames.length < 400) requestAnimationFrame(record);
  };
  requestAnimationFrame(record);
})();`;
const shift = (page: Page) =>
  page.evaluate(() => (window as unknown as { __shift: number }).__shift);
type Frame = { path: string; text: string };
const painted = (page: Page) =>
  page.evaluate(() => (window as unknown as { __frames: Frame[] }).__frames);
/** A cold load (new context, empty cache): every painted frame is either the
 * brand skeleton or the destination screen, never anything in between. The
 * first frame is saved from the compositor's screencast. */
async function coldLoad(
  context: import("playwright").BrowserContext,
  path: string,
  destination: string,
  label: string,
  state: State,
) {
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const faults: string[] = [];
  page.on("pageerror", (error) => faults.push(error.message));
  await serve(page, state, faults);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.clearBrowserCache");
  const shots: Buffer[] = [];
  cdp.on("Page.screencastFrame", (frame) => {
    shots.push(Buffer.from(frame.data, "base64"));
    void cdp
      .send("Page.screencastFrameAck", { sessionId: frame.sessionId })
      .catch(() => undefined);
  });
  await cdp.send("Page.startScreencast", { format: "png", everyNthFrame: 1 });
  await page.goto(`${origin}${path}`);
  await page.getByText(destination, { exact: false }).first().waitFor();
  await frames(page);
  await cdp.send("Page.stopScreencast");
  const seen = await painted(page);
  const strays = seen.filter(
    // "" is the page background before the HTML skeleton is parsed.
    (frame) =>
      !["", "AMP"].includes(frame.text) && !frame.text.includes(destination),
  );
  assert.deepEqual(
    strays,
    [],
    `${label}: only the skeleton or the destination is ever painted`,
  );
  assert.ok(shots.length > 0, `${label}: frames were captured`);
  if (destination === "See how AMP adapts") {
    assert.equal(
      await page.locator("header").count(),
      0,
      `${label}: no separate brand bar`,
    );
    await page
      .locator(".start-card")
      .getByText("Adaptive Math Pathways", { exact: true })
      .waitFor();
  }

  await writeFile(`${shots_dir}/first-frame-${label}.png`, shots[0]!);
  assert.deepEqual(await flashes(page), []);
  assert.equal(await shift(page), 0, `${label}: nothing shifts`);
  assert.deepEqual(faults, []);
  await page.close();
  return seen;
}
const flashes = (page: Page) =>
  page.evaluate(() => (window as unknown as { __flash: string[] }).__flash);

/** Answers the current problem through the visible controls. */
async function answerOne(page: Page, correct: boolean) {
  await page.locator(".problem-stage .question").waitFor();
  const compact = page.locator(".compact-answer-action");
  if (await compact.isVisible()) await compact.click();
  const scope = (await compact.isVisible().catch(() => false))
    ? page.locator("dialog[open]")
    : page.locator("main.practice-workspace");
  const attempt = page.waitForResponse((r) => r.url().endsWith("/attempts"));
  const choice = page.locator(".choice-option");
  if (await choice.count()) {
    await choice.nth(correct ? 0 : 1).click();
    await page.locator(".choice-submit:visible").click();
  } else {
    const input = page.locator("#answer:visible");
    await input.fill(correct ? "1" : "999999");
    await input.press("Enter");
  }
  const response = await attempt;
  assert.equal(response.status(), 200, await response.text());
  void scope;
  await page.locator(".next-action").waitFor();
  return response.json();
}
/** Next; a level check that opens with the next problem is continued
 * past (verify-level-check-ui.ts covers it). */
async function next(page: Page) {
  const leaving = page.url();
  await page.locator(".next-action").click();
  // The feedback leaves when the next problem shows; the map and the
  // paywall are new routes.
  await Promise.race([
    page.locator(".next-action").waitFor({ state: "detached" }),
    page.waitForURL((url) => url.href !== leaving),
  ]);
  await frames(page);
  const check = page.getByRole("dialog", {
    name: "Here’s where we think you are",
  });
  if (await check.isVisible()) {
    await check.getByRole("button", { name: "Continue" }).click();
    await check.waitFor({ state: "detached" });
  }
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
  [384, 688],
  [390, 844],
  [768, 1024],
  [844, 390],
  [1280, 800],
] as const;
try {
  for (const theme of ["light", "dark"] as const)
    for (const [width, height] of viewports) {
      const tag = `${width}x${height}-${theme}`;
      const audit = width === 320 && theme === "light";
      const context = await browser.newContext({
        viewport: { width, height },
        colorScheme: theme,
      });
      await context.addInitScript({ content: watch });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      const faults: string[] = [];
      page.on("pageerror", (error) => faults.push(error.message));
      const state = fresh();
      await serve(page, state, faults);

      // Visitor: invite one problem and disclose the free allowance.
      await page.goto(`${origin}/`);
      const tryFree = page.getByRole("button", { name: "Try free" });
      await tryFree.waitFor();
      await page
        .getByRole("heading", { name: "Try one math problem." })
        .waitFor();
      await page
        .getByText(`Your free trial includes up to ${FREE} problems`, {
          exact: false,
        })
        .waitFor();
      await fits(page, `${tag} welcome`);
      if (audit) await axe(page, "welcome");
      await shoot(page, "welcome", tag);
      await tryFree.click();
      await page.waitForURL("**/sign-up?return=free-practice");
      await page
        .getByRole("heading", { name: "Try AMP’s free math assessment." })
        .waitFor();
      // Identity-provider behavior is verified in verify-social-sign-in-ui.
      await page.evaluate(() => localStorage.setItem("fixture.parent", "1"));
      await page.goto(`${origin}/try`);
      await page.waitForURL("**/try");
      const years = page.getByRole("group", { name: "Birth year" });
      await years.waitFor();
      await fits(page, `${tag} start`);
      const startGeometry = await page
        .locator(".start-card")
        .evaluate((card) => {
          const rect = card.getBoundingClientRect();
          const wordmark = card.querySelector(
            'a[aria-label="AMP home"] > span',
          )!;
          const wordmarkRange = document.createRange();
          wordmarkRange.selectNodeContents(wordmark);
          const controls = [...card.querySelectorAll("button")].map((button) =>
            button.getBoundingClientRect(),
          );
          return {
            viewport: innerHeight,
            height: document.documentElement.scrollHeight,
            center: rect.top + rect.height / 2,
            availableCenter: (() => {
              const main = card.closest("main")!.getBoundingClientRect();
              return main.top + main.height / 2;
            })(),
            buttonsFit: controls.every(
              (r) => r.width >= 44 && r.height >= 44 && r.bottom <= innerHeight,
            ),
            hasBrand: card.textContent?.includes("Adaptive Math Pathways"),
            wordmarkLines: wordmarkRange.getClientRects().length,
          };
        });
      await shoot(page, "start", tag, true);
      assert.ok(startGeometry.hasBrand, `${tag}: brand inside card`);
      assert.equal(
        startGeometry.wordmarkLines,
        1,
        `${tag}: AMP never breaks across lines`,
      );
      assert.ok(
        startGeometry.height <= startGeometry.viewport + 1,
        `${tag}: entire entry fits without vertical scroll: ${JSON.stringify(startGeometry)}`,
      );
      assert.ok(
        Math.abs(startGeometry.center - startGeometry.availableCenter) < 2,
        `${tag}: card centered`,
      );
      assert.ok(
        startGeometry.buttonsFit,
        `${tag}: all accessible year targets visible`,
      );

      if (width === 320) {
        await page.setViewportSize({ width: 568, height: 320 });
        await frames(page);
        await shoot(page, "start-landscape", tag, true);
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollHeight <= innerHeight + 1,
          ),
          `${tag}: small-phone landscape entry fits`,
        );
        await shoot(page, "start-landscape", tag);
        await page.setViewportSize({ width, height });
        await frames(page);
      }
      if (audit) await axe(page, "start");
      await shoot(page, "start", tag);

      // Placement keeps the budget in the shared navigation drawer.
      await years.getByRole("button", { name: "2016", exact: true }).click();
      await page.waitForURL("**/try/practice");
      await page.getByRole("button", { name: "Open AMP menu" }).click();
      const meter = page.getByRole("progressbar", {
        name: "Free assessment problems used",
      });
      await meter.waitFor();
      assert.equal(await meter.getAttribute("value"), "0");
      assert.equal(await meter.getAttribute("max"), String(FREE));
      await page.keyboard.press("Escape");
      await page.waitForFunction(
        () =>
          document.activeElement?.getAttribute("aria-label") ===
          "Open AMP menu",
      );
      await fits(page, `${tag} practice`);
      if (audit) await axe(page, "practice");
      await shoot(page, "practice", tag);
      for (let i = 0; i < PLACEMENT; i++) {
        await answerOne(page, i % 2 === 0);
        if (i === 0) await shoot(page, "feedback", tag);
        await next(page);
      }

      // Placement done: the map, the meter and two next steps that succeed.
      await page.waitForURL("**/try/map");
      await page
        .getByRole("heading", { name: "Your estimated level" })
        .waitFor();
      await page.locator(".frontier-map").waitFor();
      await page
        .getByText(`${PLACEMENT} of ${FREE} free problems used`)
        .waitFor();
      const mapShift = await shift(page);
      await page.waitForTimeout(600);
      assert.equal(
        await shift(page),
        mapShift,
        `${tag}: the map does not shift`,
      );
      await fits(page, `${tag} map`);
      if (audit) await axe(page, "map");
      await shoot(page, "map", tag, true);

      // Choosing to see plans early, then "not now", returns to practice.
      await page.getByRole("link", { name: "See plans" }).click();
      await page.waitForURL("**/try/plans?reason=choice");
      await page.getByRole("heading", { name: "Choose a plan" }).waitFor();
      await page.getByRole("radio", { name: /Annual/ }).waitFor();
      await fits(page, `${tag} plans by choice`);
      await shoot(page, "plans-choice", tag, true);
      await page.getByRole("button", { name: "Give feedback" }).click();
      const ask = page.getByRole("dialog", { name: "Give feedback" });
      await ask.waitFor();
      await fits(page, `${tag} optional feedback`);
      if (audit) await axe(page, "optional feedback");
      await shoot(page, "optional-feedback", tag);
      await page.keyboard.press("Escape");
      await ask.waitFor({ state: "hidden" });
      assert.match(page.url(), /\/try\/plans\?reason=choice$/);
      await page.getByRole("button", { name: "Not now" }).click();
      await page.waitForURL("**/try/practice");
      assert.equal(await page.getByRole("dialog").count(), 0);

      // A recorded answer whose response is lost retries with the same
      // request: the learner sees why, and Check resends the same answer.
      if (width === 1280 && theme === "light") {
        await page.locator(".problem-stage .question").waitFor();
        const ids: string[] = [];
        let lose = true;
        await page.route("**/attempts", async (route) => {
          ids.push(route.request().postDataJSON().requestId);
          if (!lose) return route.fallback();
          lose = false;
          await route.fetch();
          return route.abort("connectionreset");
        });
        const choice = page.locator(".choice-option");
        if (await choice.count()) {
          await choice.first().click();
          await page.locator(".choice-submit").click();
        } else {
          await page.locator("#answer").fill("1");
          await page.locator("#answer").press("Enter");
        }
        await page.getByText("Check your connection").waitFor();
        const retry = page.getByRole("button", { name: "Check", exact: true });
        await retry.click();
        await page.locator(".next-action").waitFor();
        assert.equal(ids.length, 2);
        assert.equal(ids[0], ids[1], "the retry reuses the request id");
        await page.unroute("**/attempts");
        await next(page);
      }
      // Adaptive practice to the limit; one answer is a mastery moment.
      let masteryShown = false;
      const start =
        width === 1280 && theme === "light" ? PLACEMENT + 1 : PLACEMENT;
      for (let i = start; i < FREE; i++) {
        if (i === PLACEMENT + 1) {
          await page.route(
            "**/attempts",
            async (route) => {
              const response = await route.fetch();
              const outcome = await response.json();
              await route.fulfill({
                response,
                json: {
                  ...outcome,
                  correct: true,
                  mastered: {
                    skillId: outcome.skillId,
                    title: "Adding fractions",
                  },
                },
              });
            },
            { times: 1 },
          );
        }
        await answerOne(page, true);
        if (i === PLACEMENT + 1) {
          await page.getByText("Skill mastered").waitFor();
          masteryShown = true;
          await fits(page, `${tag} mastery`);
          await shoot(page, "mastery", tag);
        }
        await next(page);
      }
      assert.ok(masteryShown);

      // The limit: the paywall that sells, with the run's summary.
      await page.waitForURL("**/try/plans?reason=limit");
      await page
        .getByRole("heading", { name: "Keep going from here" })
        .waitFor();
      await page.getByText(`All ${FREE} free problems used`).waitFor();
      await page.getByText("30-day full refund.").waitFor();
      const esa = page.getByRole("link", {
        name: "Other programs",
      });
      assert.equal(await esa.getAttribute("href"), "https://corpora.inc/esa/");
      assert.ok(
        (
          await page
            .getByRole("link", { name: "Use Arkansas EFA funds" })
            .getAttribute("href")
        )?.startsWith("/invoice/arkansas-efa"),
      );
      assert.ok(
        (
          await page
            .getByRole("link", { name: "Use Arizona ESA funds" })
            .getAttribute("href")
        )?.startsWith("/invoice/arizona-esa"),
      );
      const annual = page.getByRole("radio", { name: /Annual/ }),
        monthly = page.getByRole("radio", { name: /Monthly/ });
      assert.match((await annual.textContent()) ?? "", /\$499\.00 per year/);
      assert.match((await monthly.textContent()) ?? "", /\$49\.00 per month/);
      const trialToken = await page.evaluate(() =>
        localStorage.getItem("amp.trial"),
      );
      assert(trialToken);
      const learnersResponse = await app.inject({
        method: "GET",
        url: "/api/v1/learners",
        headers: { authorization: `Trial ${trialToken}` },
      });
      const trialLearner = learnersResponse.json().learners[0].id;
      const evidenceResponse = await app.inject({
        method: "GET",
        url: `/api/v1/learners/${trialLearner}/progress`,
        headers: { authorization: `Trial ${trialToken}` },
      });
      assert.equal(evidenceResponse.statusCode, 200);
      const illuminated = evidenceResponse
        .json()
        .skills.filter(
          (entry: { independentCorrect: number }) =>
            entry.independentCorrect > 0,
        ).length;
      await page
        .getByText(
          illuminated
            ? `${illuminated} ${illuminated === 1 ? "skill" : "skills"} illuminated`
            : "Room to explore",
          { exact: true },
        )
        .waitFor();
      assert.equal(
        await page.locator('[data-illuminated="true"]').count(),
        illuminated,
      );
      assert.match(
        (await page
          .getByRole("link", { name: "Explore full map →" })
          .getAttribute("href")) ?? "",
        /context=trial/,
      );
      const card = page.locator("main section").first(),
        before = await box(card),
        paywallShift = await shift(page);
      await page.waitForTimeout(600);
      assert.deepEqual(
        await box(card),
        before,
        `${tag}: the paywall holds still`,
      );
      assert.equal(await shift(page), paywallShift, `${tag}: no layout shift`);
      await fits(page, `${tag} paywall`);
      if (audit) await axe(page, "paywall");
      await shoot(page, "paywall", tag, true);
      // "Not now" at the limit leads to the map, which offers only plans.
      await page.getByRole("button", { name: "Not now" }).click();
      await page.waitForURL("**/try/map");
      assert.equal(await page.getByRole("dialog").count(), 0);
      await page
        .getByText(`All ${FREE} free problems are used.`, { exact: false })
        .waitFor();
      assert.equal(
        await page.getByRole("link", { name: "Keep practicing" }).count(),
        0,
      );
      await shoot(page, "map-done", tag, true);
      await page.getByRole("link", { name: "See plans" }).click();
      await page.waitForURL("**/try/plans?reason=limit");

      // The parent signed up before practice; continue straight to the plan.
      await monthly.click();
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page.waitForURL(/\/start\/plan(?:\?|$)/);
      await page.getByRole("radiogroup", { name: "Plan" }).waitFor();
      assert.equal(
        await page
          .getByRole("radio", { name: /Monthly/ })
          .getAttribute("aria-checked"),
        "true",
        `${tag}: the plan chosen on the paywall stays chosen`,
      );
      await page.getByRole("link", { name: "Back to free practice" }).waitFor();
      await fits(page, `${tag} plan`);
      await page.getByRole("checkbox").click();
      await page
        .getByRole("button", { name: "Continue to secure checkout" })
        .click();
      await page.waitForURL("https://checkout.stripe.com/**");
      assert.equal(state.checkouts.length, 1);
      assert.equal(state.checkouts[0]!.interval, "month");

      // Verified payment: the free practice becomes the paid learner.
      state.next = "add-learner";
      state.enrollment = { ...state.enrollment, purchase: purchase("paid") };
      await page.goto(
        `${origin}/start/purchase?billing=success&purchase=${purchaseId}`,
      );
      await page.getByRole("heading", { name: "Payment confirmed" }).waitFor();
      await page.getByRole("link", { name: "Continue", exact: true }).click();
      await page.waitForURL("**/start/name");
      await page
        .getByRole("heading", { name: "Who’s been practicing?" })
        .waitFor();
      await fits(page, `${tag} name`);
      if (audit) await axe(page, "name");
      await shoot(page, "adopt", tag);
      await page.getByLabel("Learner name").fill(`Avery ${tag}`);
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page.waitForURL("**/practice");
      assert.ok(state.adopted, "the trial was adopted");
      assert.deepEqual(state.claims, [
        { purchaseId, learnerId: state.adopted },
      ]);
      assert.equal(
        await page.evaluate(() => localStorage.getItem("amp.trial")),
        null,
        "the trial token leaves the device",
      );
      // The learner continues where they left off: every free answer is theirs.
      const frontier = await app.inject({
        method: "GET",
        url: `/api/v1/learners/${state.adopted}/frontier`,
        headers: { authorization: "Bearer amp-local-development" },
      });
      assert.equal(frontier.json().overall.answered, FREE);
      await page.locator(".problem-stage .question").waitFor();
      await shoot(page, "paid-practice", tag);
      assert.deepEqual(await flashes(page), [], `${tag}: no loading flash`);
      assert.deepEqual(
        faults,
        [],
        `${tag}: no page errors or unexpected calls`,
      );
      await context.close();

      // Cold loads of `/` (new context, empty cache). A signed-in, verified
      // parent with no purchase sees the free assessment as the first
      // screen; a visitor sees the welcome. Nothing else is ever painted.
      const parent = await browser.newContext({
        viewport: { width, height },
        colorScheme: theme,
      });
      await parent.addInitScript({ content: watch });
      await parent.addInitScript(() =>
        localStorage.setItem("fixture.parent", "1"),
      );
      const seen = await coldLoad(
        parent,
        "/",
        "See how AMP adapts",
        `parent-${tag}`,
        fresh(),
      );
      assert.equal(seen.at(-1)!.path, "/try");
      assert.ok(
        seen.every((frame) => !frame.path.startsWith("/start/plan")),
        `${tag}: the plan never opens on its own`,
      );
      await coldLoad(
        parent,
        "/start",
        "See how AMP adapts",
        `parent-start-${tag}`,
        fresh(),
      );
      await parent.close();
      const visitor = await browser.newContext({
        viewport: { width, height },
        colorScheme: theme,
      });
      await visitor.addInitScript({ content: watch });
      await coldLoad(visitor, "/", "Try free", `visitor-${tag}`, fresh());
      await coldLoad(
        visitor,
        "/try",
        "Try AMP’s free math assessment.",
        `direct-try-${tag}`,
        fresh(),
      );
      await visitor.close();
    }
  console.log(
    `Free trial: welcome → birth year → ${PLACEMENT} placement → map → plans by choice → not now → practice → mastery moment → paywall at ${FREE} → not now → map → plans → sign-up → plan (monthly kept) → Stripe redirect → paid → adopt → claim → practice with every free answer; cold / for a signed-in unpaid parent paints only the skeleton then /try, and for a visitor only the skeleton then the welcome; at 320x568/384x688/390x844/768x1024/1280x800 (strict) and 844x390 (phone-landscape smoke) × light/dark; no overflow, no layout shift, no loading flash, axe clean.`,
  );
} finally {
  await browser.close();
  await vite.close();
  await app.close();
  await repository.close();
}
