import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, type Locator, type Page } from "playwright";
import { createServer } from "vite";
import { retentionNotice } from "../src/family/contracts";
import { noticeDigest } from "../src/parent-consent/crypto";
import { consentFixture } from "../tests/parent-consent.fixture";
import type { EnrollmentView } from "../src/billing/stripe/enrollment-contracts";
import { assertPhoneLandscapeSmoke, isPhoneLandscape } from "./ui-viewports";

/**
 * First-run purchase flow against a synthetic API: confirm email → plan →
 * acknowledgement → Stripe Checkout redirect → verified return → learner →
 * birth year → claim → practice; plus unavailable enrollment and every return
 * phase. Measures overflow, card geometry and layout shift.
 */
const port = 4398;
const origin = `http://127.0.0.1:${port}`;
const authPath = fileURLToPath(new URL("../src/web/auth.ts", import.meta.url));
const auth = `export async function accessSession(){return {token:'synthetic',accountId:'synthetic-parent'};}export function onSessionChanged(){return()=>{};}export async function signIn(){}export async function signOut(){}export function notifyAccountSessionChanged(){}export async function authConfig(){return {mode:'accounts',passwords:true,providers:[]};}`;
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
type Learner = { id: string; name: string; birthYear: number; paid: boolean };
type State = {
  next: "try" | "choose-plan" | "add-learner" | "practice";
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
};
function me(state: State) {
  const learners = state.learners.map((l) => ({
    id: l.id,
    name: l.name,
    birthYear: l.birthYear,
    entitlement: {
      active: l.paid,
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
        canPractice: l.paid,
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
function fresh(): State {
  return {
    next: "choose-plan",
    confirm: true,
    consent: false,
    learners: [],
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
    if (path === "/me") return route.fulfill({ json: me(state) });
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

      // Sign-up has no bar: its card carries the brand and is centered in
      // the viewport (or top-aligned with padding when taller than it).
      await page.goto(`${origin}/sign-up`);
      await page
        .getByRole("heading", { name: "Create your parent account" })
        .waitFor();
      await page.getByRole("link", { name: "AMP home" }).waitFor();
      const signUp = await box(page.locator("main section").first());
      const viewport = page.viewportSize()!;
      if (signUp.height + 48 <= viewport.height)
        assert.ok(
          Math.abs(signUp.y + signUp.height / 2 - viewport.height / 2) <= 1,
          `${tag}: sign-up card is centered`,
        );
      else assert.ok(signUp.y >= 24, `${tag}: tall sign-up card keeps padding`);
      await fits(page, `${tag} sign-up`);
      await page.goto(`${origin}/start`);
      await page.waitForURL("**/start/verify-email");
      await page.getByRole("heading", { name: "Confirm your email" }).waitFor();
      await page.getByText("parent@example.test", { exact: true }).waitFor();
      const verify = await box(page.locator("main section").first());
      const look = (name: string, role: "button" | "link" = "button") =>
        page.getByRole(role, { name, exact: true }).evaluate((node) => {
          const style = getComputedStyle(node);
          return {
            background: style.backgroundColor,
            border: style.borderTopColor,
            color: style.color,
            decoration: style.textDecorationLine,
            height: node.getBoundingClientRect().height,
          };
        });
      const primary = await look("I confirmed my email"),
        secondary = await look("Send another email"),
        back = await look("Keep practicing free", "link");
      assert.notEqual(
        primary.background,
        secondary.background,
        `${tag}: one primary, one secondary`,
      );
      assert.equal(
        secondary.background,
        "rgba(0, 0, 0, 0)",
        `${tag}: secondary is not filled`,
      );
      assert.equal(
        back.decoration,
        "none",
        `${tag}: sign-in link is a designed control`,
      );
      assert.equal(
        back.color,
        secondary.color,
        `${tag}: sign-in link uses the accent token`,
      );
      for (const control of [primary, secondary, back])
        assert.ok(control.height >= 44, `${tag}: 44px targets`);
      await fits(page, `${tag} verify`);
      if (width === 320 && theme === "light") await axe(page, "verify");
      await page.screenshot({ path: `${shots}/verify-${tag}.png` });

      // Confirmation follows `/me` to the plan step: never consent, never a dead end.
      state.confirm = false;
      await page.getByRole("button", { name: "I confirmed my email" }).click();
      await page.waitForURL("**/start/plan");
      const plan = page.getByRole("radiogroup", { name: "Plan" });
      await plan.waitFor();
      const planCard = await box(page.locator("main section").first());
      assert.equal(planCard.y, verify.y, `${tag}: plan card stays put`);
      assert.equal(planCard.x, verify.x, `${tag}: plan card keeps its column`);
      assert.equal(
        await page.getByText("Enrollment is unavailable").count(),
        0,
      );
      const annual = page.getByRole("radio", { name: /Annual/ }),
        monthly = page.getByRole("radio", { name: /Monthly/ });
      assert.match((await annual.textContent()) ?? "", /\$499\.00 per year/);
      assert.match((await monthly.textContent()) ?? "", /\$49\.00 per month/);
      assert.match((await annual.textContent()) ?? "", /Save \$89/);
      assert.equal(await annual.getAttribute("aria-checked"), "true");
      const chooseMonthly = width === 390;
      if (chooseMonthly) {
        await annual.focus();
        await page.keyboard.press("ArrowRight");
        assert.equal(await monthly.getAttribute("aria-checked"), "true");
        assert.equal(
          await page.evaluate(() =>
            document.activeElement?.textContent?.includes("Monthly"),
          ),
          true,
        );
      }
      await page
        .getByText("Fixture Operator collects", { exact: false })
        .waitFor();
      const go = page.getByRole("button", {
        name: "Continue to secure checkout",
      });
      assert.equal(
        await go.isDisabled(),
        true,
        `${tag}: checkout waits for acknowledgement`,
      );
      await fits(page, `${tag} plan`);
      if (width === 390) {
        await page
          .getByRole("button", { name: "Read the full notice" })
          .click();
        const dialog = page.getByRole("dialog", { name: "Parent notice" });
        await dialog.getByText("Fixture hosting", { exact: false }).waitFor();
        await fits(page, `${tag} notice`);
        await page.screenshot({ path: `${shots}/notice-${tag}.png` });
        await dialog.getByRole("button", { name: "Close" }).click();
        await dialog.waitFor({ state: "detached" });
      }
      const card = page.locator("main section").first(),
        before = await box(card);
      await page.getByRole("checkbox").click();
      assert.equal(
        await page.getByRole("checkbox").getAttribute("aria-checked"),
        "true",
      );
      assert.deepEqual(
        await box(card),
        before,
        `${tag}: acknowledgement does not move the card`,
      );
      if (width === 320 && theme === "light") await axe(page, "plan");
      await page.mouse.move(0, 0);
      await page.screenshot({
        path: `${shots}/plan-${tag}.png`,
        fullPage: true,
      });
      await go.click();
      await page.waitForURL("https://checkout.stripe.com/**");
      await page
        .getByRole("heading", { name: "Stripe Checkout fixture" })
        .waitFor();
      assert.equal(state.checkouts.length, 1);
      const sent = state.checkouts[0] as Record<string, unknown>;
      assert.deepEqual(Object.keys(sent).sort(), [
        "acknowledgement",
        "interval",
        "offerId",
        "requestId",
      ]);
      assert.match(String(sent.requestId), /^[0-9a-f-]{36}$/);
      assert.equal(sent.interval, chooseMonthly ? "month" : "year");
      assert.equal(sent.offerId, chooseMonthly ? offers[1]!.id : offers[0]!.id);
      assert.deepEqual(sent.acknowledgement, {
        noticeDigest: digest,
        parentAttestation: true,
      });

      // Stripe's success URL: calm, fixed-size progress until payment is verified.
      state.enrollment = {
        ...state.enrollment,
        purchase: purchase("processing"),
      };
      state.settleAfter = 2;
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
      await page.getByRole("link", { name: "Continue", exact: true }).click();
      await page.waitForURL("**/start/name");
      await page.getByLabel("Learner name").fill("Avery");
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page.waitForURL("**/start/birth-year");
      await page.getByRole("group", { name: "Birth year" }).waitFor();
      await fits(page, `${tag} birth year`);
      await page.mouse.move(0, 0);
      await frames(page);
      await page.screenshot({ path: `${shots}/birth-year-${tag}.png` });
      await page.getByRole("button", { name: "2016", exact: true }).click();
      await page.waitForURL("**/practice").catch(async (error) => {
        console.log(
          page.url(),
          JSON.stringify(state.claims),
          state.learners,
          faults,
          logs,
        );
        console.log(await page.locator("body").innerText());
        throw error;
      });
      assert.deepEqual(state.claims, [{ purchaseId, learnerId: "learner-1" }]);
      assert.equal(
        state.learners.length,
        1,
        `${tag}: one learner, created after payment`,
      );
      assert.equal(state.learners[0]!.birthYear, 2016);
      assert.deepEqual(
        faults,
        [],
        `${tag}: no unexpected requests or page errors`,
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
    for (const [phase, heading, url] of [
      [
        "checkout-open",
        "You left checkout",
        "https://checkout.stripe.com/c/pay/cs_fixture",
      ],
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
    await page.getByRole("link", { name: "Start again" }).click();
    await page.waitForURL("**/start/plan");
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
    await page.getByRole("checkbox").click();
    const retry = page.getByRole("button", {
      name: "Continue to secure checkout",
    });
    await retry.click();
    await page
      .getByRole("alert")
      .filter({ hasText: "Billing is temporarily unavailable" })
      .waitFor();
    assert.equal(attempts.length, 2);
    assert.notEqual(attempts[0], attempts[1], "expired session gets a new id");
    await page
      .getByRole("radio", { name: /Monthly/ })
      .and(page.locator(":disabled"))
      .waitFor();
    assert.equal(await retry.isDisabled(), false, "retry stays available");
    await page.getByRole("button", { name: "Dismiss message" }).click();
    await retry.click();
    await page.waitForURL("https://checkout.stripe.com/**");
    assert.equal(attempts[2], attempts[1], "ambiguous failure retries same id");
    await page.unroute("**/api/v1/billing/enrollment/checkout");
    // Payment verified, learner saved, claim fails once: retry claims, never re-creates.
    Object.assign(state, {
      consent: true,
      next: "add-learner",
      unassigned: true,
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
    await page.getByRole("button", { name: "2015", exact: true }).click();
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
    await page.getByRole("button", { name: "2014", exact: true }).click();
    await page.waitForURL("**/practice");
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
    await page.getByRole("button", { name: "2013", exact: true }).click();
    await page
      .getByRole("alert")
      .filter({ hasText: "Check your connection" })
      .waitFor();
    await page.getByRole("button", { name: "Dismiss message" }).click();
    await page.getByRole("button", { name: "2013", exact: true }).click();
    await page.waitForURL("**/practice");
    assert.equal(state.learners.length, 1, "lost response never duplicates");
    assert.deepEqual(state.claims, [{ purchaseId, learnerId: "learner-lost" }]);
    assert.deepEqual(faults, []);
    await context.close();
  }

  // Unavailable enrollment: a designed state, never a refresh-only dead end.
  for (const [width, height] of viewports)
    for (const theme of ["light", "dark"] as const) {
      const tag = `${width}x${height}-${theme}`;
      const context = await browser.newContext({
        viewport: { width, height },
        colorScheme: theme,
      });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      const faults: string[] = [];
      page.on("pageerror", (error) => faults.push(error.message));
      const state = fresh();
      state.confirm = false;
      state.enrollment = {
        available: false,
        notice: null,
        noticeDigest: null,
        purchase: null,
      };
      await serve(page, state, faults);
      await page.goto(`${origin}/start`);
      await page.waitForURL("**/start/plan");
      await page
        .getByRole("heading", { name: "Enrollment isn’t open yet" })
        .waitFor();
      assert.equal(
        await page.getByRole("button", { name: "Refresh status" }).count(),
        0,
      );
      await page
        .getByText("contact the support team", { exact: false })
        .waitFor();
      await page.getByRole("button", { name: "Sign out" }).waitFor();
      await fits(page, `${tag} unavailable`);
      if (width === 320 && theme === "light") await axe(page, "unavailable");
      await page.screenshot({ path: `${shots}/unavailable-${tag}.png` });
      if (width === 390 && theme === "light") {
        state.emailPlus = true;
        await page.reload();
        await page
          .getByRole("heading", { name: "Confirm by email first" })
          .waitFor();
        await page.screenshot({ path: `${shots}/email-plus-${tag}.png` });
        await page.getByRole("link", { name: "Continue with email" }).click();
        await page.waitForURL("**/start/consent");
      }
      assert.deepEqual(faults, []);
      await context.close();
    }
  console.log(
    "Onboarding: confirm email → plan → acknowledgement → Stripe redirect; return processing → paid → learner → birth year → claim → practice; every return phase, claim retry and unavailable enrollment at 320x568/390x844/1280x800 (strict) and 844x390 (phone-landscape smoke) × light/dark; no overflow, stable card geometry, zero layout shift between phases.",
  );
} finally {
  await browser.close();
  await vite.close();
}
