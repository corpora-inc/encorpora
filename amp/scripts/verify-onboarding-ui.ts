import { secureChromium } from "../browser-security.mjs";
import {
  FIXTURE_FAMILY_ID,
  fixtureFamilies,
  fixtureFamilyProjection,
} from "./family-space-fixture";
import { settleArrival } from "./ui-settle";
import { META_PURCHASE_MEASUREMENT_NOTICE } from "../src/advertising/permission-contracts";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium as rawChromium, type Locator, type Page } from "playwright";
const chromium = secureChromium(rawChromium);
import { createServer } from "vite";
import { retentionNotice } from "../src/family/contracts";
import { noticeDigest } from "../src/parent-consent/crypto";
import { consentFixture } from "../tests/parent-consent.fixture";
import type { EnrollmentView } from "../src/billing/stripe/enrollment-contracts";
import { assertPhoneLandscapeSmoke, isPhoneLandscape } from "./ui-viewports";

/**
 * The parent's entry and the first run's own steps against a synthetic API:
 * the sign-up card's placement; an older "Continue with AMP" link's one hop
 * to the pay overlay (paying itself is the pay overlay's: verify-purchase-
 * app-ui, verify-payment-method-ui); Stripe's return to a plan bought before
 * any learner, every phase in one card geometry, a canceled checkout showing
 * the plan in place; and a paid plan no learner holds yet (learner → birth
 * year → claim, retried without duplicates). Measures overflow, card
 * geometry and layout shift.
 */
const port = Number(process.env.AMP_ONBOARDING_UI_PORT ?? 4398);
const origin = `http://127.0.0.1:${port}`;
const authPath = fileURLToPath(new URL("../src/web/auth.ts", import.meta.url));
// Signed in everywhere but the sign-up screen, whose layout is measured
// signed out (a signed-in account at /sign-up goes to its place).
const auth = `export async function accessSession(){return location.pathname==='/sign-up'?null:{token:'synthetic',accountId:'synthetic-parent'};}export function onSessionChanged(){return()=>{};}export async function signIn(){}export async function signOut(){}export function notifyDeviceSessionChanged(){}export function notifyAccountSessionChanged(){}export async function authConfig(){return {mode:'accounts',passwords:true,providers:[]};}`;
const vite = await createServer({
  cacheDir: "node_modules/.vite-onboarding",
  plugins: [
    {
      name: "onboarding-auth",
      enforce: "pre",
      load(id) {
        return id.split("?")[0] === authPath ? auth : undefined;
      },
    },
  ],
  server: { host: "127.0.0.1", port, strictPort: true },
});
await vite.listen();
const browser = await chromium.launch();
const shots = "artifacts/onboarding";
await mkdir(shots, { recursive: true });
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
    amountMinor: 59900,
    formattedAmount: "$599.00",
    interval: "year",
    learnerCount: 1,
  },
  {
    id: "b".repeat(64),
    mode: "test",
    currency: "USD",
    amountMinor: 5900,
    formattedAmount: "$59.00",
    interval: "month",
    learnerCount: 1,
  },
];
type Learner = { id: string; name: string; birthYear: number; paid: boolean };
type State = {
  next: "start" | "add-learner" | "practice";
  /** The parent has not confirmed the account email yet. */
  confirm: boolean;
  consent: boolean;
  learners: Learner[];
  unassigned: boolean;
  enrollment: EnrollmentView;
  emailPlus: boolean;
  checkouts: unknown[];
  claims: unknown[];
  /** Polls before a processing purchase is verified as paid. */
  settleAfter: number;
  polls: number;
  metaSharing: boolean;
  metaContexts: unknown[];
  metaContextHold?: Promise<void>;
};
function me(state: State) {
  const learners = state.learners.map((l) => ({
    id: l.id,
    name: l.name,
    birthYear: l.birthYear,
    // Every child practices on the free allowance; the plan licenses them.
    entitlement: {
      active: true,
      licensed: l.paid,
      plan: l.paid ? "stripe" : null,
      endsAt: null,
    },
  }));
  return {
    signedIn: true,
    account: {
      id: "synthetic-parent",
      email: "parent@example.test",
      emailVerified: !state.confirm,
      confirmationRequired: state.confirm,
    },
    consent: {
      status: state.consent ? "active" : "none",
      method: state.consent ? "monetary-transaction" : null,
    },
    learners,
    family: {
      ...(state.metaSharing
        ? {
            metaPurchaseMeasurement: {
              available: true,
              eligible: true,
              status: "active",
              revision: "ef7c2ca3-05fc-4dd1-9d54-13296c49b95c",
              noticeVersion: META_PURCHASE_MEASUREMENT_NOTICE.version,
              grantedAt: "2026-01-01T00:00:00.000Z",
              expiresAt: "2099-01-01T00:00:00.000Z",
            },
          }
        : {}),
      consent: {
        status: state.consent ? "active" : "not-recorded",
        policyVersion: null,
        recordedAt: null,
        withdrawnAt: null,
      },
      learners: state.learners.map((l) => ({
        id: l.id,
        name: l.name,
        birthYear: l.birthYear,
        deletedAt: null,
        access: [],
        stripeLinked: l.paid,
        canPractice: true,
        hasAccess: l.paid,
      })),
      retained: retentionNotice,
    },
    ...(state.unassigned
      ? {
          unassignedPurchase: {
            id: purchaseId,
            interval: "year",
            endsAt: "2099-01-01T00:00:00.000Z",
          },
        }
      : {}),
    next: state.next,
  };
}
/** The starter made the family and its child, who practices free. */
const child = () => ({
  id: "learner-1",
  name: "Fox",
  birthYear: 2016,
  paid: false,
});
function fresh(): State {
  return {
    next: "practice",
    confirm: true,
    consent: false,
    learners: [child()],
    unassigned: false,
    enrollment: {
      available: true,
      notice: policy.notice,
      noticeDigest: digest,
      purchase: null,
    },
    emailPlus: false,
    checkouts: [],
    claims: [],
    settleAfter: 2,
    polls: 0,
    metaSharing: false,
    metaContexts: [],
  };
}
function purchase(phase: string, url: string | null = null) {
  return {
    id: purchaseId,
    interval: "year" as const,
    phase,
    learnerId: null,
    url,
  } as NonNullable<EnrollmentView["purchase"]>;
}
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
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname.replace("/api/v1", "");
    if (path === "/advertising/meta/purchase-context") {
      assert.equal(req.method(), "POST");
      assert.equal(state.enrollment.purchase?.phase, "paid");
      assert.equal(state.metaSharing, true);
      assert.deepEqual(req.postDataJSON(), { checkoutId: purchaseId });
      assert.equal(
        req.headers().referer,
        `${origin}/start/purchase?billing=processing&purchase=${purchaseId}`,
      );
      state.metaContexts.push(req.postDataJSON());
      await state.metaContextHold;
      return route.fulfill({ json: { recorded: true } });
    }
    if (path === "/me") return route.fulfill({ json: me(state) });
    // The starter's family, holding its children: where a parent's screens
    // go back to.
    if (path === "/families")
      return route.fulfill({
        json: state.learners.length
          ? fixtureFamilies()
          : { families: [], next: null },
      });
    if (path === `/families/${FIXTURE_FAMILY_ID}`)
      return route.fulfill({
        json: fixtureFamilyProjection(
          state.learners.map(({ id, name, birthYear }) => ({
            id,
            name,
            birthYear,
          })),
        ),
      });
    if (path === "/billing/offer")
      return route.fulfill({
        json: { available: true, offer: offers[0], offers },
      });
    if (path === "/consent")
      return route.fulfill({
        json: {
          available: state.emailPlus,
          consentActive: false,
          notice: state.emailPlus ? policy.notice : null,
          noticeDigest: state.emailPlus ? digest : null,
          confirmationDelayHours: state.emailPlus ? 24 : null,
          request: null,
        },
      });
    if (path === "/billing/enrollment") {
      if (state.enrollment.purchase?.phase === "processing") {
        state.polls++;
        if (state.polls > state.settleAfter) {
          state.enrollment = {
            ...state.enrollment,
            purchase: purchase("paid"),
          };
          Object.assign(state, {
            consent: true,
            next: "add-learner",
            unassigned: true,
          });
        }
      }
      return route.fulfill({ json: state.enrollment });
    }
    if (path === "/billing/enrollment/checkout") {
      const body = req.postDataJSON();
      state.checkouts.push(body);
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
    if (path === "/learners" && req.method() === "POST") {
      const body = req.postDataJSON();
      const learner = {
        id: `learner-${state.learners.length + 1}`,
        name: body.name,
        birthYear: body.birthYear,
        paid: false,
      };
      state.learners.push(learner);
      return route.fulfill({
        json: {
          id: learner.id,
          name: learner.name,
          birthYear: learner.birthYear,
        },
      });
    }
    const year = /^\/learners\/([^/]+)\/birth-year$/.exec(path);
    if (year && req.method() === "POST") {
      const learner = state.learners.find((l) => l.id === year[1])!;
      learner.birthYear = req.postDataJSON().birthYear;
      return route.fulfill({ json: { birthYear: learner.birthYear } });
    }
    if (path === "/billing/enrollment/claim") {
      const body = req.postDataJSON();
      state.claims.push(body);
      const learner = state.learners.find((l) => l.id === body.learnerId)!;
      learner.paid = true;
      Object.assign(state, { unassigned: false, next: "practice" });
      state.enrollment = {
        ...state.enrollment,
        purchase: { ...purchase("assigned"), learnerId: learner.id },
      };
      return route.fulfill({ json: { assigned: true } });
    }
    // First-party funnel beacons (verified in verify-funnel-ui).
    if (path === "/events")
      return route.fulfill({ status: 202, json: { accepted: 1 } });
    if (path === "/events/context")
      return route.fulfill({ json: { generation: "initial" } });
    // The practice screen loads after the flow ends; it is not under test here.
    if (["/catalog", "/books"].includes(path) || path.startsWith("/learners/"))
      return route.fulfill({ status: 503, json: { error: "fixture_end" } });
    faults.push(`unexpected ${req.method()} ${path}`);
    return route.fulfill({
      status: 404,
      json: { error: "unexpected_fixture" },
    });
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
/** Document coordinates, so a scroll is not mistaken for a layout change. */
async function box(locator: Locator) {
  const value = await locator.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return {
      x: rect.x + scrollX,
      y: rect.y + scrollY,
      width: rect.width,
      height: rect.height,
    };
  });
  assert.ok(value.width > 0 && value.height > 0, "card is rendered");
  return value;
}
async function axe(page: Page, label: string) {
  await settleArrival(page);
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  assert.deepEqual(
    result.violations
      .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
      .map((v) => v.id),
    [],
    `${label}: no serious accessibility violations`,
  );
}
/** Unexpected layout shift (not caused by recent input), summed since load. */
const watchShift = () => {
  (window as unknown as { __shift: number }).__shift = 0;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as unknown as {
      value: number;
      hadRecentInput: boolean;
    }[])
      if (!entry.hadRecentInput)
        (window as unknown as { __shift: number }).__shift += entry.value;
  }).observe({ type: "layout-shift", buffered: true });
};
const shift = (page: Page) =>
  page.evaluate(() => (window as unknown as { __shift: number }).__shift);

const viewports = [
  [320, 568],
  [390, 844],
  [768, 1024],
  [844, 390],
  [1280, 800],
] as const;
try {
  for (const theme of ["light", "dark"] as const)
    for (const [width, height] of viewports) {
      const tag = `${width}x${height}-${theme}`;
      const context = await browser.newContext({
        viewport: { width, height },
        colorScheme: theme,
      });
      await context.addInitScript(watchShift);
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      const faults: string[] = [],
        logs: string[] = [];
      page.on("pageerror", (error) => faults.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") logs.push(message.text());
        if (process.env.DEBUG_UI)
          console.log("console", message.type(), message.text().slice(0, 400));
      });
      const state = fresh();
      await serve(page, state, faults);
      if (process.env.DEBUG_UI)
        await page.exposeFunction("__nav", (url: string) =>
          console.log("nav", url),
        );
      if (process.env.DEBUG_UI)
        await page.addInitScript(() => {
          let count = 0;
          for (const method of ["pushState", "replaceState"] as const) {
            const original = history[method].bind(history);
            history[method] = (...args: Parameters<History["pushState"]>) => {
              if (count++ < 40)
                (window as any).__nav(`${method} ${String(args[2])}`);
              return original(...args);
            };
          }
        });

      // Phone auth starts at the top so the keyboard leaves the form in view
      // (#2157). Wider screens center the card above the support footer.
      await page.goto(`${origin}/sign-up`);
      await page
        .getByRole("heading", { name: "Create your account" })
        .waitFor();
      await page.getByRole("link", { name: "AMP home" }).waitFor();
      await settleArrival(page);
      await page.screenshot({ path: `${shots}/sign-up-${tag}.png` });
      const signUp = await box(page.locator("main section").first());
      const viewport = page.viewportSize()!;
      const content = await box(page.locator("main"));
      const padding = await page.locator("main").evaluate((node) => ({
        top: parseFloat(getComputedStyle(node).paddingTop),
        bottom: parseFloat(getComputedStyle(node).paddingBottom),
      }));
      // The support footer has its own row; center inside the usable main area.
      if (width <= 520)
        assert.ok(
          Math.abs(signUp.y - content.y - padding.top) <= 1,
          `${tag}: phone sign-up card starts at the main area's top padding`,
        );
      else if (signUp.height + padding.top + padding.bottom <= content.height)
        assert.ok(
          Math.abs(
            signUp.y +
              signUp.height / 2 -
              (content.y +
                padding.top +
                (content.height - padding.top - padding.bottom) / 2),
          ) <= 1,
          `${tag}: sign-up card is centered above the support footer`,
        );
      else
        assert.ok(
          signUp.y >= content.y + padding.top,
          `${tag}: tall sign-up card keeps padding`,
        );
      await fits(page, `${tag} sign-up`);
      // An older "Continue with AMP" link for the child: one hop to the
      // child's pay overlay, the plan at once. Card-backed consent rests on
      // the card transaction notifying the account holder (16 CFR
      // 312.5(b)(2)(ii)), so an unconfirmed email never stands before it
      // (#2336).
      await page.goto(`${origin}/continue/learner-1`);
      await page.waitForURL((url) => /\/pay(\/|$)/.test(url.pathname));
      await page.getByRole("heading", { name: "Choose your plan" }).waitFor();
      assert.equal(
        await page.getByRole("heading", { name: "Confirm your email" }).count(),
        0,
        `${tag}: no email confirmation before the plan`,
      );
      // Stripe's success URL for a plan bought before any learner: calm,
      // fixed-size progress until payment is verified.
      state.enrollment = {
        ...state.enrollment,
        purchase: purchase("processing"),
      };
      state.settleAfter = 2;
      state.metaSharing = true;
      await page.goto(
        `${origin}/start/purchase?billing=processing&purchase=${purchaseId}`,
      );
      await page
        .getByRole("heading", { name: "Confirming your payment" })
        .waitFor();
      const returnCard = page.locator("main section").first(),
        processing = await box(returnCard);
      await fits(page, `${tag} processing`);
      await page.screenshot({ path: `${shots}/processing-${tag}.png` });
      const shiftBefore = await shift(page);
      await page
        .getByRole("heading", { name: "Payment confirmed" })
        .waitFor({ timeout: 15000 });
      await frames(page);
      assert.deepEqual(
        await box(returnCard),
        processing,
        `${tag}: processing → paid keeps the card`,
      );
      assert.equal(
        await shift(page),
        shiftBefore,
        `${tag}: no layout shift between phases`,
      );
      await fits(page, `${tag} paid`);
      await page.screenshot({ path: `${shots}/paid-${tag}.png` });
      assert.deepEqual(
        faults.filter((fault) => !fault.startsWith("unexpected ")),
        [],
        `${tag}: no page errors`,
      );
      await context.close();
    }

  // Every return phase occupies the same card geometry; claim retry never duplicates.
  {
    const context = await browser.newContext({
      viewport: { width: 320, height: 568 },
    });
    await context.addInitScript(watchShift);
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const faults: string[] = [];
    page.on("pageerror", (error) => faults.push(error.message));
    const state = fresh();
    state.confirm = false;
    await serve(page, state, faults);
    const card = page.locator("main section").first();
    let reference: Awaited<ReturnType<typeof box>> | null = null;
    // Leaving Stripe without paying shows the plan in place, plan kept.
    state.enrollment = {
      ...state.enrollment,
      purchase: purchase(
        "checkout-open",
        "https://checkout.stripe.com/c/pay/cs_fixture",
      ),
    };
    await page.goto(
      `${origin}/start/purchase?billing=canceled&purchase=${purchaseId}`,
    );
    await page.getByRole("radiogroup", { name: "Plan" }).waitFor();
    assert.equal(new URL(page.url()).pathname, "/start/purchase");
    assert.equal(await page.getByText("You left checkout").count(), 0);
    assert.equal(await page.getByText(/Step \d of/).count(), 0);
    for (const [phase, heading, url] of [
      ["expired", "This checkout expired", null],
      ["payment-inactive", "Payment isn’t active", null],
      ["requires-review", "Your purchase needs a review", null],
    ] as const) {
      state.enrollment = {
        ...state.enrollment,
        purchase: purchase(phase, url),
      };
      await page.goto(
        `${origin}/start/purchase?billing=canceled&purchase=${purchaseId}`,
      );
      await page.getByRole("heading", { name: heading }).waitFor();
      await frames(page);
      // Every phase's action (shown or reserved) is one line, so phase data
      // such as a resume link never changes the shared card size.
      assert.deepEqual(
        await card.evaluate((node) =>
          [...node.querySelectorAll("a, button")]
            .filter((control) => control.getBoundingClientRect().height > 56)
            .map((control) => control.textContent),
        ),
        [],
        `${phase}: one-line actions`,
      );
      const current = await box(card);
      if (reference)
        assert.deepEqual(
          current,
          reference,
          `${phase} keeps the card geometry`,
        );
      reference = current;
      await fits(page, phase);
      await page.screenshot({ path: `${shots}/phase-${phase}-320.png` });
    }
    await page.getByRole("link", { name: "Email support" }).waitFor();
    assert.equal(
      await page
        .getByRole("link", { name: "Email support" })
        .getAttribute("href"),
      "mailto:privacy@example.com",
    );
    state.enrollment = { ...state.enrollment, purchase: purchase("expired") };
    await page.goto(`${origin}/start/purchase`);
    // "Start again" is the plan's own address; the first-run guard sends an
    // account with no approval to pay for to its place, so the checkout
    // retries below run from the plan shown in place.
    await page.getByRole("link", { name: "Start again" }).waitFor();
    state.enrollment = {
      ...state.enrollment,
      purchase: purchase("checkout-open", null),
    };
    await page.goto(
      `${origin}/start/purchase?billing=canceled&purchase=${purchaseId}`,
    );
    await page.getByRole("radiogroup", { name: "Plan" }).waitFor();
    // Stripe expired the old session: the server asks for a new request id and
    // the client retries once. Then Stripe fails after the reservation: the
    // plan stays retryable with that same id, never a disabled dead end.
    const attempts: string[] = [];
    const script = ["expired", "unavailable"];
    await page.route("**/api/v1/billing/enrollment/checkout", (route) => {
      attempts.push(route.request().postDataJSON().requestId);
      const step = script.shift();
      if (step === "expired")
        return route.fulfill({
          status: 409,
          json: { error: "checkout_expired_retry_with_new_request" },
        });
      if (step === "unavailable") {
        state.enrollment = {
          ...state.enrollment,
          purchase: purchase("checkout-open", null),
        };
        return route.fulfill({
          status: 503,
          json: { error: "billing_unavailable" },
        });
      }
      return route.fallback();
    });
    // Continuing is the parent's confirmation (the line above the button).
    const retry = page.getByRole("button", { name: "Continue to Stripe" });
    await retry.click();
    await page
      .getByRole("alert")
      .filter({ hasText: "Billing is temporarily unavailable" })
      .waitFor();
    assert.equal(attempts.length, 2);
    assert.notEqual(attempts[0], attempts[1], "expired session gets a new id");
    // The plan stays changeable: a new plan closes the open session.
    assert.equal(
      await page.getByRole("radio", { name: /Monthly/ }).isDisabled(),
      false,
    );
    assert.equal(await retry.isDisabled(), false, "retry stays available");
    await page.getByRole("button", { name: "Dismiss message" }).click();
    await retry.click();
    await page.waitForURL("https://checkout.stripe.com/**");
    assert.equal(attempts[2], attempts[1], "ambiguous failure retries same id");
    await page.unroute("**/api/v1/billing/enrollment/checkout");
    // A paid plan no learner holds yet (paid before any learner): learner
    // saved, claim fails once: retry claims, never re-creates.
    Object.assign(state, {
      consent: true,
      next: "add-learner",
      unassigned: true,
      learners: [],
    });
    state.enrollment = { ...state.enrollment, purchase: purchase("paid") };
    await page.goto(`${origin}/start/plan`);
    await page.waitForURL("**/start/name");
    await page.getByLabel("Learner name").fill("Jordan");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    let failClaim = true;
    await page.route("**/api/v1/billing/enrollment/claim", (route) =>
      failClaim
        ? ((failClaim = false),
          route.fulfill({
            status: 503,
            json: { error: "billing_unavailable" },
          }))
        : route.fallback(),
    );
    const year = page.locator("main section").first(),
      yearBox = await box(year);
    await page.getByRole("option", { name: "2015", exact: true }).click();
    await page
      .getByRole("alert")
      .filter({ hasText: "Billing is temporarily unavailable" })
      .waitFor();
    await frames(page);
    assert.deepEqual(
      await box(year),
      yearBox,
      "failed claim does not move the step",
    );
    await page.getByRole("button", { name: "Dismiss message" }).click();
    await page.getByRole("option", { name: "2014", exact: true }).click();
    await page.waitForURL(/\/practice(\/[^/?#]+)?$/);
    assert.equal(
      state.learners.length,
      1,
      "claim retry reuses the saved learner",
    );
    assert.equal(
      state.learners[0]!.birthYear,
      2014,
      "a different year on retry corrects the saved learner",
    );
    assert.deepEqual(state.claims, [{ purchaseId, learnerId: "learner-1" }]);
    // The learner is saved but the response is lost: the next tap claims that
    // learner instead of creating a duplicate.
    Object.assign(state, {
      consent: true,
      next: "add-learner",
      unassigned: true,
      learners: [],
      claims: [],
    });
    await page.goto(`${origin}/start/name`);
    await page.getByLabel("Learner name").fill("Riley");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    let lose = true;
    await page.route("**/api/v1/learners", (route) => {
      if (!lose || route.request().method() !== "POST") return route.fallback();
      lose = false;
      const body = route.request().postDataJSON();
      state.learners.push({
        id: "learner-lost",
        name: body.name,
        birthYear: body.birthYear,
        paid: false,
      });
      return route.abort("connectionreset");
    });
    await page.getByRole("option", { name: "2013", exact: true }).click();
    await page
      .getByRole("alert")
      .filter({ hasText: "Check your connection" })
      .waitFor();
    await page.getByRole("button", { name: "Dismiss message" }).click();
    await page.getByRole("option", { name: "2013", exact: true }).click();
    await page.waitForURL(/\/practice(\/[^/?#]+)?$/);
    assert.equal(state.learners.length, 1, "lost response never duplicates");
    assert.deepEqual(state.claims, [{ purchaseId, learnerId: "learner-lost" }]);
    assert.deepEqual(faults, []);
    await context.close();
  }

  console.log(
    "Onboarding: sign-up placement; an older Continue with AMP link → the pay overlay; Stripe's return for a plan bought before any learner, processing → paid, every phase in one card, canceled → the plan in place with checkout retries; a paid plan's learner → birth year → claim retry, at 320x568/390x844/768x1024/1280x800 (strict) and 844x390 (phone-landscape smoke) × light/dark; no overflow, stable card geometry, zero layout shift between phases.",
  );
} catch (error) {
  for (const context of browser.contexts())
    for (const page of context.pages())
      await page.screenshot({ path: `${shots}/failure.png`, fullPage: true });
  throw error;
} finally {
  await browser.close();
  await vite.close();
}
