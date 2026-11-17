/** The AMP journey contract (#2073), end to end in a real browser: each kind of
 * person starts free from "What brings you to AMP?", practices, and a parent
 * or an adult continues with AMP in place when the free problems end.
 *
 *   AMP_TEST_DATABASE_URL=postgres://…/amp_journeys \
 *     npx tsx scripts/verify-journeys-ui.ts [--engine webkit] [--widths 390,1280]
 *       [--themes light,dark] [--journeys 1,2,3,4,5,6,7] [--port 4500]
 *
 * Real accounts, learning, school, family and billing routes against a fresh
 * schema. Stripe is test mode: the gateway is a local fake, Checkout is a
 * stand-in page, and paying settles the invoice through the real webhook
 * queue, as tests/purchase-consent.integration.ts does. Screenshots hold
 * synthetic accounts only. */
import assert from "node:assert/strict";
import { CANCELLED_BY_NAVIGATION } from "./lib/cancelled-by-navigation";
import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import pg from "pg";
import {
  chromium as rawChromium,
  webkit,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";
import { createServer } from "vite";
import { secureChromium } from "../browser-security.mjs";
import { registerFamilyRoutes } from "../src/family/routes";
import { registerParentFollowupRoutes } from "../src/parent-followup/routes";
import { registerSchoolRoutes } from "../src/schools/routes";
import { registerStripeRoutes } from "../src/billing/stripe/routes";
import { StripeGateway } from "../src/billing/stripe/gateway";
import { stripeNamespace } from "../src/billing/stripe/config";
import type { AnnualPayment } from "../src/billing/stripe/model";
import { installConsentPolicy } from "../src/parent-consent/policy";
import {
  accountsAuth,
  accountsConfiguration,
  createAccounts,
  registerAccountRoutes,
} from "../src/server/accounts";
import { buildApp } from "../src/server/app";
import { refuseStudentTokens } from "../src/server/auth";
import { PostgresRepository } from "../src/server/repository";
import { localRenderer } from "../src/workbook/pdf";
import {
  config as stripeBase,
  payment as basePayment,
} from "../tests/stripe-fixtures";
import { syntheticDocumentProfile } from "../tests/payment-evidence-fixtures";
import { consentFixture } from "../tests/parent-consent.fixture";
import { probe, settle, shellRecord, shiftRecorder } from "./app-shell-probe";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";
import { todayTitle } from "./today-title";
import { GRADE_5_CLASS } from "../src/schools/demo/personas";
import { openHome } from "./launcher";

const chromium = secureChromium(rawChromium);
const argument = (name: string) => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : undefined;
};
const webPort = Number(argument("--port") ?? 4500);
const engine = argument("--engine") ?? "chromium";
const widths = (argument("--widths") ?? "390,1280").split(",").map(Number);
const themes = (argument("--themes") ?? "light,dark").split(",") as (
  "light" | "dark"
)[];
const journeys = new Set(
  (argument("--journeys") ?? "1,2,3,4,5,6,7").split(",").map(Number),
);
const apiPort = webPort + 1;
const origin = `http://127.0.0.1:${webPort}`;
const committed = `docs/reviews/journeys/${engine}`;
const scratch = `artifacts/journeys-ui/${engine}`;
await mkdir(committed, { recursive: true });
await mkdir(scratch, { recursive: true });

const url = process.env.AMP_TEST_DATABASE_URL;
if (!url) throw new Error("AMP_TEST_DATABASE_URL is required");
assertTestDatabaseTarget(url);
const schema = `amp_journeys_${randomUUID().replaceAll("-", "")}`;
const admin = new pg.Pool({ connectionString: url, max: 1 });
await admin.query(`CREATE SCHEMA ${schema}`);
const scoped = new URL(url);
scoped.searchParams.set("options", `-c search_path=${schema}`);
await migrate(scoped.href);

const repository = new PostgresRepository(scoped.href, { development: false });
const db = repository.pool;
const accounts = await createAccounts(
  db,
  accountsConfiguration({
    AMP_ACCOUNTS_URL: origin,
    // A fresh secret each run: nothing here outlives the process.
    AMP_ACCOUNTS_SECRET: randomBytes(32).toString("hex"),
    NODE_ENV: "development",
    // Sign-up records its follow-up intent, which carries a funded program.
    AMP_PARENT_FOLLOWUP: "enabled",
  } as unknown as NodeJS.ProcessEnv),
);
const authenticate = refuseStudentTokens(accountsAuth(accounts));
const info = console.info.bind(console);
console.info = (...args: unknown[]) => {
  if (!String(args[0] ?? "").startsWith("[accounts]")) info(...args);
};

// Billing in Stripe's test mode: the configured plans, the parent notice and
// a gateway that never leaves this machine.
const billingConfig = {
  ...stripeBase,
  appOrigin: origin,
  documentProfile: syntheticDocumentProfile,
  monthlyDocumentProfile: {
    ...syntheticDocumentProfile,
    priceId: "price_monthly",
    unitAmountMinor: 1200,
  },
  monthlyPriceId: "price_monthly",
  monthlyAmountMinor: 1200,
};
const policy = {
  ...consentFixture,
  review: { ...consentFixture.review, paymentNotificationsReviewed: true },
  notice: {
    ...consentFixture.notice,
    version: stripeBase.consentPolicyVersion,
  },
};
await installConsentPolicy(db, policy);
const gateway = new StripeGateway(billingConfig);
const sessions = new Map<
  string,
  { status: "open" | "complete" | "expired"; subscriptionId?: string }
>();
const payments = new Map<string, AnnualPayment>();
gateway.verifyMerchant =
  gateway.verifyCatalog =
  gateway.verifyPortal =
    async () => {};
gateway.createCustomer = async (id) => `cus_${id}`;
gateway.createCheckout = async (id) => {
  sessions.set(`cs_${id}`, { status: "open" });
  return { id: `cs_${id}`, url: `https://checkout.stripe.com/c/pay/cs_${id}` };
};
gateway.checkoutStatus = async (id) => {
  const session = sessions.get(id) ?? { status: "expired" as const };
  return {
    status: session.status,
    url:
      session.status === "open"
        ? `https://checkout.stripe.com/c/pay/${id}`
        : null,
    subscriptionId: session.subscriptionId,
  };
};
gateway.annualPayment = async (id) => {
  const p = payments.get(id);
  if (!p) throw new Error("unsettled");
  return {
    ...p,
    financial: {
      kind: "verified",
      observation: {
        invoiceReason: "subscription_create",
        preTaxMinor: p.subtotal,
        paidMinor: p.paid,
        currency: "usd",
        tax: [],
        refunds: [],
        paymentMethod: p.paymentMethod,
      },
    },
    refunded: false,
    partialRefund: false,
  };
};
gateway.client.subscriptions.retrieve = async (id) => {
  const payment = [...payments.values()].find((p) => p.subscriptionId === id)!;
  return {
    id,
    livemode: false,
    customer: payment.customerId,
    metadata: { amp_checkout_id: payment.checkoutId },
    status: "active",
  } as never;
};

const renderer = localRenderer();
const app = buildApp({
  repository,
  authenticate,
  publicUrl: origin,
  workbookRenderer: renderer,
});
/** The account mail path, captured: a parent's approval link comes from here. */
const mail: { to: string; url: string }[] = [];
await registerAccountRoutes(app, accounts, authenticate);
await registerParentFollowupRoutes(app, {
  pool: db,
  authenticate,
  origin,
  enabled: true,
});
await registerFamilyRoutes(app, {
  pool: db,
  authenticate,
  billingNamespace: stripeNamespace(billingConfig),
  approvals: {
    secret: accounts.config.secret,
    origin,
    mail: async (to, { url: link }) => {
      mail.push({ to, url: link });
    },
  },
});
await registerSchoolRoutes(app, {
  pool: db,
  authenticate,
  services: {
    secret: accounts.config.secret,
    origin,
    learning: repository,
    renderer,
  },
});
const billing = await registerStripeRoutes(app, {
  pool: db,
  authenticate,
  config: billingConfig,
  gateway,
  consentPolicy: policy,
});
await app.listen({ host: "127.0.0.1", port: apiPort });
const vite = await createServer({
  cacheDir: process.env.AMP_VITE_CACHE_DIR ?? "node_modules/.vite-journeys",
  server: {
    host: "127.0.0.1",
    port: webPort,
    strictPort: true,
    // Edits elsewhere in the tree never reload a page mid-check.
    hmr: false,
    proxy: { "/api": `http://127.0.0.1:${apiPort}` },
  },
});
await vite.listen();

const failures: string[] = [];
const check = (label: string, ok: boolean, detail: unknown = "") => {
  if (!ok) failures.push(`${label}: ${JSON.stringify(detail).slice(0, 400)}`);
};
const PASSWORD = "synthetic long fixture passphrase";
const last: { page: Page | null } = { page: null };
/** The demo class's made-up students (src/schools/demo/personas.ts). */
const DEMO_CLASS_NAMES = new RegExp(
  `\\b(?:${GRADE_5_CLASS.map((p) => p.name[0]).join("|")})\\b`,
);
const CLASS_TODAY = /\/school\/[0-9a-f-]{36}\/classes\/[0-9a-f-]{36}\/today$/;
/** A family's Today, at its own address (spaces P2). */
const FAMILY_TODAY = /\/family\/[0-9a-f-]{36}$/;
/** A year from a year field (ui/YearField): its button opens a sheet of
 * year tiles named like the field. */
async function pickYear(page: Page, field: string, year?: string) {
  await page.getByRole("button", { name: field, exact: true }).click();
  const years = page.getByRole("dialog", { name: field });
  const tile = year
    ? years.getByRole("option", { name: year, exact: true })
    : years.getByRole("option").first();
  await tile.click();
  await years.waitFor({ state: "hidden" });
}
const APPROVAL_PAGE = /\/family\/approvals\/[0-9a-f-]{36}$/;

async function newContext(
  browser: Browser,
  width: number,
  theme: "light" | "dark",
): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: { width, height: width < 720 ? 844 : 900 },
    colorScheme: theme,
    timezoneId: "America/Chicago",
  });
  await context.addInitScript(shiftRecorder);
  // Stripe Checkout, test mode: a stand-in page. The harness settles the
  // payment and returns the browser where Stripe would.
  await context.route("https://checkout.stripe.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><meta charset="utf-8"><meta name=viewport content="width=device-width">
        <title>Checkout (test mode)</title>
        <body style="font:17px system-ui;margin:40px auto;max-width:420px;padding:0 20px">
        <p style="color:#555">Stripe · Test mode</p><h1>AMP</h1>
        <button style="min-height:48px;width:100%;font:inherit">Pay</button></body>`,
    }),
  );
  return context;
}
async function opened(context: BrowserContext, label: string) {
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  last.page = page;
  page.on("pageerror", (error) => {
    if (!CANCELLED_BY_NAVIGATION.test(error.message))
      failures.push(`${label} page error: ${error.message}`);
  });
  return page;
}
async function heading(page: Page, name: RegExp | string, level = 1) {
  try {
    await page
      .getByRole("heading", { name, level })
      .filter({ visible: true })
      .first()
      .waitFor({ timeout: 30_000 });
  } catch (error) {
    await page.screenshot({ path: `${scratch}/stuck.png` }).catch(() => {});
    console.error(`Stuck waiting for ${name} at ${page.url()}`);
    throw error;
  }
}
async function shot(
  page: Page,
  journey: number,
  step: string,
  width: number,
  theme: string,
) {
  // The pointer rests off the content, so no hover is captured.
  await page.mouse.move(0, 0).catch(() => {});
  await settle(page, 300);
  await page.screenshot({
    path: `${committed}/${journey}-${step}-${width}-${theme}.png`,
  });
}
/** Nothing spills, every target is big enough, nothing overlaps or breaks
 * mid-word, nothing moved. */
async function measured(page: Page, label: string) {
  await settle(page, 300);
  // The app frame's bar is fixed and opaque: content scrolled beneath it is
  // hidden, not overlapping. Measure from the top, then put the page back.
  const scrolled = await page.evaluate(() => {
    const y = scrollY;
    scrollTo({ top: 0, behavior: "instant" });
    return y;
  });
  const geometry = await probe(page);
  await page.evaluate(
    (y) => scrollTo({ top: y, behavior: "instant" }),
    scrolled,
  );
  check(`${label} overflow`, geometry.overflow === 0, geometry.overflow);
  check(
    `${label} targets`,
    geometry.smallTargets.length === 0,
    geometry.smallTargets,
  );
  check(`${label} overlaps`, geometry.overlaps.length === 0, geometry.overlaps);
  check(
    `${label} word breaks`,
    geometry.midWordWraps.length === 0,
    geometry.midWordWraps,
  );
  const { cls, shifts } = await shellRecord(page);
  check(`${label} CLS`, cls <= 0.01, { cls, shifts });
}
/** A reload the app may itself interrupt with a replace (WebKit reports
 * "Frame load interrupted"): the page that results is the one under test. */
async function reloaded(page: Page) {
  await page
    .reload({ waitUntil: "domcontentloaded" })
    .catch(async (error: unknown) => {
      if (!/interrupted/i.test(String(error))) throw error;
      await page.waitForLoadState("domcontentloaded");
    });
}
/** Creates an account on the sign-up form; `here` signs up on the page
 * already open (its search, such as a funded program, carries on). */
async function signUp(page: Page, name: string, here = false) {
  const email = `${name.split(" ")[0]!.toLowerCase()}-${randomUUID().slice(0, 8)}@journeys.example`;
  if (!here) await page.goto(`${origin}/sign-up`);
  const fallback = page.getByRole("button", { name: "Use a password instead" });
  const password = page.getByLabel("Password", { exact: true });
  await Promise.race([
    fallback.waitFor({ timeout: 20_000 }),
    password.waitFor({ timeout: 20_000 }),
  ]);
  if (await fallback.isVisible()) await fallback.click();
  await page.getByLabel("Email").fill(email);
  await password.fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/start(\?|$)|\/family\/approve/);
  const session = await (
    await page.context().request.get(`${origin}/api/auth/get-session`)
  ).json();
  const account = `amp|${session.user.id as string}`;
  await db.query(
    'UPDATE amp_auth_users SET name=$2,"emailVerified"=true WHERE id=$1',
    [account.slice(4), name],
  );
  return { account, email, token: session.session.token as string };
}
async function signIn(page: Page, email: string) {
  await page.goto(`${origin}/sign-in`);
  const fallback = page.getByRole("button", { name: "Use a password instead" });
  const password = page.getByLabel("Password", { exact: true });
  await Promise.race([
    fallback.waitFor({ timeout: 20_000 }),
    password.waitFor({ timeout: 20_000 }),
  ]);
  if (await fallback.isVisible()) await fallback.click();
  await page.getByLabel("Email").fill(email);
  await password.fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
/** A practice problem on screen: the normal loop. */
async function practicing(page: Page) {
  await page.waitForURL(/\/practice/);
  await page.locator("[data-problem-id]").first().waitFor({ timeout: 30_000 });
}
/** Back from Stripe: the pay overlay's confirmation, over the screen it was
 * opened from (features/pay/stripe-return.ts), whose Done returns to where
 * paying started (features/pay/CardDone.tsx). */
async function paidAndDone(page: Page) {
  await page.waitForURL(/\/pay(\/[^/]+)?\/done$/, { timeout: 30_000 });
  const done = page.getByRole("dialog");
  await done
    .getByText("Payment received. A receipt is in your email and in Billing.", {
      exact: true,
    })
    .waitFor({ timeout: 30_000 });
  await done.getByRole("button", { name: "Done", exact: true }).click();
  await page.waitForURL((url) => !/\/pay(\/|$)/.test(url.pathname));
}
/** Skip the problem on screen and go on to the next one. */
async function skipOne(page: Page) {
  await page
    .getByRole("button", { name: "Skip this problem and see its answer" })
    .click();
  await page
    .getByText("Skipped. Your progress is unchanged.", { exact: true })
    .waitFor();
  await page.locator(".next-action").click();
}
async function freeUsed(learnerId: string, used: number) {
  await db.query("UPDATE amp_learners SET free_online_used=$2 WHERE id=$1", [
    learnerId,
    used,
  ]);
}
async function learnersOf(account: string) {
  return (
    await db.query<{ id: string; name: string }>(
      "SELECT id,name FROM amp_learners WHERE account_id=$1 AND deleted_at IS NULL AND NOT adult ORDER BY created_at,id",
      [account],
    )
  ).rows;
}
async function classOf(account: string) {
  return (
    await db.query<{ org_id: string; class_id: string; join_code: string }>(
      `SELECT f.org_id,f.class_id,c.join_code FROM amp_families f
       JOIN amp_classes c ON c.id=f.class_id WHERE f.account_id=$1`,
      [account],
    )
  ).rows[0]!;
}
/** The pause says exactly the contract's words and offers one action. */
async function pauseSays(
  page: Page,
  label: string,
  fact: string,
  action: "Continue with AMP" | "Talk to us" | null,
  detail?: string,
) {
  const pause = page
    .locator("[data-allowance-pause]")
    .filter({ visible: true });
  await pause.first().waitFor();
  check(
    `${label} pause fact`,
    (await pause.getByRole("heading", { name: fact, exact: true }).count()) ===
      1,
    await pause.first().innerText(),
  );
  if (detail)
    check(
      `${label} pause detail`,
      (await pause.getByText(detail, { exact: true }).count()) === 1,
      await pause.first().innerText(),
    );
  const buttons = await pause.getByRole("button").allInnerTexts();
  check(
    `${label} pause action`,
    JSON.stringify(buttons) === JSON.stringify(action ? [action] : []),
    buttons,
  );
  check(
    `${label} pause is not an error`,
    (await pause.getByRole("alert").count()) === 0,
  );
}
/** Pays in Stripe's test mode and comes back where Stripe would send them. */
async function payInCheckout(
  page: Page,
  journey: number,
  width: number,
  theme: string,
) {
  await page.waitForURL(/^https:\/\/checkout\.stripe\.com\/c\/pay\/cs_/);
  await page.getByRole("button", { name: "Pay" }).waitFor();
  await shot(page, journey, "stripe", width, theme);
  const checkoutId = new URL(page.url()).pathname.split("cs_")[1]!;
  const checkout = (
    await db.query(
      "SELECT id,customer_id,billing_interval,learner_id FROM amp_stripe_checkouts WHERE id=$1",
      [checkoutId],
    )
  ).rows[0];
  assert.ok(checkout, "the checkout was reserved");
  const now = Math.floor(Date.now() / 1000);
  const monthly = checkout.billing_interval === "month";
  const payment: AnnualPayment = {
    ...basePayment,
    invoiceId: `in_${checkout.id}`,
    chargeId: `ch_${checkout.id}`,
    subscriptionId: `sub_${checkout.id}`,
    checkoutId: checkout.id,
    customerId: checkout.customer_id,
    periodStart: now,
    paidAt: now,
    periodEnd: now + (monthly ? 30 : 365) * 86400,
    paymentMethod: "card",
    invoiceReason: "subscription_create",
    ...(monthly
      ? { priceId: billingConfig.monthlyPriceId, paid: 1200, subtotal: 1200 }
      : {}),
  };
  payments.set(payment.invoiceId, payment);
  sessions.set(`cs_${checkout.id}`, {
    status: "complete",
    subscriptionId: payment.subscriptionId,
  });
  await billing.repository.enqueue({
    eventId: randomUUID(),
    type: "invoice.paid",
    objectId: payment.invoiceId,
    created: payment.paidAt,
    hash: "fixture",
  });
  const settled = await billing.runBatch();
  assert.deepEqual(settled, { processed: 1, failed: 0 }, "the invoice settled");
  // Stripe's success URL: the enrollment return, or the learner's.
  await page.goto(
    `${origin}/${checkout.learner_id ? "" : "start/purchase"}?billing=processing&purchase=${checkout.id}`,
  );
}

/** 1. A parent: two children, one practices here and one on their own
 * device; the first reaches 100, continues with AMP in place, then is named. */
async function parentJourney(
  browser: Browser,
  width: number,
  theme: "light" | "dark",
) {
  const label = `${engine} ${width} ${theme} parent`;
  const context = await newContext(browser, width, theme);
  const page = await opened(context, label);
  const { account } = await signUp(page, "Casey Fixture");
  await heading(page, "What brings you to AMP?");
  await measured(page, `${label} starter`);
  await shot(page, 1, "starter", width, theme);
  await page.getByRole("link", { name: /^I’m a parent/ }).click();
  // Setup, step by step (R11): their kids, then who practices first,
  // straight into that child's first problem. A name is never a step.
  await page.waitForURL(/\/start\/parent$/);
  await heading(page, "Add your kids");
  await page.getByRole("button", { name: "Add a child" }).click();
  for (const [child, year] of [
    ["Child 1", "2016"],
    ["Child 2", "2018"],
  ] as const) {
    await pickYear(page, `Birth year, ${child}`, year);
  }
  // One child named by the parent, one left blank ("Child 1").
  await page.getByLabel("Name, Child 2").fill("Sam");
  await measured(page, `${label} children`);
  await shot(page, 1, "children", width, theme);
  // Back and forward keep the same step and what was typed.
  await page.goBack();
  await page.waitForURL(/\/start$/);
  await heading(page, "What brings you to AMP?");
  await page.goForward();
  await page.waitForURL(/\/start\/parent$/);
  await heading(page, "Add your kids");
  check(
    `${label} the drafted children survive Back and Forward`,
    (await page.getByRole("button", { name: "Next" }).isEnabled()) === true,
  );
  await page.getByRole("button", { name: "Next" }).click();
  await page.waitForURL(/\/start\/parent\/ready$/);
  const home = await classOf(account);
  const [fox, moon] = await learnersOf(account);
  assert.ok(fox && moon, "two children");
  check(
    `${label} the parent's name, and a blank one by its number`,
    fox.name === "Child 1" && moon.name === "Sam",
    [fox.name, moon.name],
  );
  await heading(page, "Who’s practicing first?");
  // A refresh keeps the step.
  await reloaded(page);
  await heading(page, "Who’s practicing first?");
  await measured(page, `${label} ready`);
  await shot(page, 1, "setup-ready", width, theme);

  // The first child's first problem, right here on this device.
  await page.locator(`[data-practice-here="${fox.id}"]`).click();
  await practicing(page);
  await measured(page, `${label} practice here`);
  await shot(page, 1, "practice-here", width, theme);
  await skipOne(page);
  await page.locator("[data-problem-id]").first().waitFor();
  await page
    .getByRole("button", { name: "Open AMP menu" })
    .filter({ visible: true })
    .first()
    .click();
  // A handed device's menu gives it back: "Back to family".
  await page.getByRole("button", { name: "Back to family" }).click();
  // The device comes back to the parent, on Today, with both children.
  await page.waitForURL(FAMILY_TODAY);
  await todayTitle(page);
  // Each row says its free problems left: the figure over its label.
  await page
    .locator("[data-family-kids]")
    .getByText("free problems left")
    .first()
    .waitFor();
  await page
    .getByRole("button", { name: `Practice with ${moon.name}` })
    .waitFor();
  // A child's own device is an option behind "Their own devices", never
  // Today's headline.
  check(
    `${label} the class code waits behind their own devices`,
    (await page
      .locator(`[data-class-code="${home.join_code}"]`)
      .filter({ visible: true })
      .count()) === 0 &&
      (await page.locator("[data-own-devices]").count()) === 1,
  );
  await measured(page, `${label} today`);
  await shot(page, 1, "today", width, theme);

  // Moon joins on a device of their own: class code, then pictures.
  const own = await newContext(browser, width, theme);
  const device = await opened(own, `${label} Moon's device`);
  await device.goto(`${origin}/join`);
  await heading(device, "Type your code");
  await device.getByLabel("Code", { exact: true }).fill(home.join_code);
  await device.waitForURL(
    `**/join/${home.join_code.slice(0, 3)}-${home.join_code.slice(3)}`,
  );
  await heading(device, "Tap your name");
  await device.getByRole("link", { name: new RegExp(`^${moon.name}`) }).click();
  await heading(device, /Pick 3 pictures/);
  for (const picture of ["Fox", "Boat", "Kite"])
    await device.getByRole("button", { name: picture, exact: true }).click();
  await heading(device, "Remember these 3");
  await device.getByRole("button", { name: "These are mine" }).click();
  await practicing(device);
  // A family's child on their own device stays signed in (personal mode).
  const moonSession = (
    await db.query(
      `SELECT s.mode FROM amp_student_sessions s JOIN amp_people p ON p.id=s.person_id
       WHERE p.learner_id=$1 ORDER BY s.created_at DESC LIMIT 1`,
      [moon.id],
    )
  ).rows[0];
  check(
    `${label} Moon's own device is personal`,
    moonSession?.mode === "personal",
    moonSession,
  );
  await measured(device, `${label} Moon joined`);
  await shot(device, 1, "moon-joined", width, theme);
  last.page = page;

  // Fox's 100th problem, practiced with the parent: the pause, in place.
  await page.goto(`${origin}/practice`);
  await practicing(page);
  await freeUsed(fox.id, 99);
  await skipOne(page);
  await pauseSays(
    page,
    `${label} parent`,
    `${fox.name} has used the 100 free problems.`,
    "Continue with AMP",
  );
  check(
    `${label} pause stays on practice`,
    /^\/practice\/[^/]+$/.test(new URL(page.url()).pathname),
    page.url(),
  );
  await measured(page, `${label} pause`);
  await shot(page, 1, "pause", width, theme);

  // The child on their own device sees it too, with nothing to buy.
  await freeUsed(moon.id, 100);
  await reloaded(device);
  await device.locator("[data-allowance-pause]").first().waitFor();
  await pauseSays(
    device,
    `${label} student`,
    "You’ve finished the free problems.",
    null,
    "Your grown-up can continue AMP.",
  );
  await measured(device, `${label} student pause`);
  await shot(device, 1, "student-pause", width, theme);
  await own.close();
  await freeUsed(moon.id, 1);

  // Paying opens over the child's own place (features/pay; its walk is
  // scripts/walk-pay-flow.ts): "Choose your plan", for this child, by card.
  await page.getByRole("button", { name: "Continue with AMP" }).click();
  await page.waitForURL(new RegExp(`/kids/${fox.id}/pay$`));
  const pay = page.getByRole("dialog");
  await pay.getByRole("heading", { name: "Choose your plan" }).waitFor();
  await pay.getByText(fox.name).first().waitFor();
  await measured(page, `${label} continue`);
  await shot(page, 1, "continue", width, theme);
  await pay
    .locator('[data-method="card"]')
    .getByRole("button", { name: /Continue to Stripe|Resume checkout/ })
    .click();
  await payInCheckout(page, 1, width, theme);
  // Done puts them back where paying started: practicing, with the name
  // offered once.
  await paidAndDone(page);
  await practicing(page);
  const naming = page.getByRole("dialog", { name: `Add ${fox.name}’s name` });
  await naming.waitFor();
  await measured(page, `${label} naming`);
  await shot(page, 1, "name", width, theme);
  await naming.getByLabel("Name", { exact: true }).fill("Rowan");
  await naming.getByRole("button", { name: "Save name" }).click();
  await naming.waitFor({ state: "detached" });

  const named = (
    await db.query("SELECT name,name_pending FROM amp_learners WHERE id=$1", [
      fox.id,
    ])
  ).rows[0];
  check(
    `${label} named after paying`,
    named.name === "Rowan" && !named.name_pending,
    named,
  );
  check(
    `${label} the grant is active`,
    !!(
      await db.query(
        "SELECT 1 FROM amp_grants WHERE learner_id=$1 AND status='active' AND ends_at>now()",
        [fox.id],
      )
    ).rowCount,
  );
  await skipOne(page);
  await page.locator("[data-problem-id]").first().waitFor();
  check(
    `${label} practice continues past 100`,
    (await page.locator("[data-allowance-pause]").count()) === 0,
  );
  await openHome(page, origin);
  await page.waitForURL(FAMILY_TODAY);
  await page.getByRole("button", { name: "Practice with Rowan" }).waitFor();
  await shot(page, 1, "today-paid", width, theme);

  // Family: the parent renames a child in that child's settings, a sheet
  // over the family's Settings (features/family/settings/Children.tsx), and
  // adds another, with no consent step for either name. Their older address
  // (/family/learners) opens the family's Settings.
  await page.goto(`${origin}/family/learners`);
  await page.waitForURL(/\/family\/[0-9a-f-]{36}\/settings$/);
  await page.getByRole("button", { name: "Rowan’s settings" }).click();
  const settings = page.getByRole("dialog", { name: "Rowan", exact: true });
  await settings.waitFor();
  // The name is the first of the child's settings.
  await settings
    .getByRole("button", { name: "Change", exact: true })
    .first()
    .click();
  // The field's reason sits inside its label, so match the name's start.
  const rename = settings.getByRole("textbox", { name: /^Name/ });
  await rename.fill("rowan@example.com");
  await settings.getByRole("button", { name: "Save name" }).click();
  await page.getByText("Use a name, not an email address.").waitFor();
  await measured(page, `${label} rename`);
  await shot(page, 1, "family-rename", width, theme);
  await rename.fill("Ro");
  await settings.getByRole("button", { name: "Save name" }).click();
  // The sheet and the family's list both say the new name at once.
  const renamed = page.getByRole("dialog", { name: "Ro", exact: true });
  await renamed.waitFor();
  await renamed.getByRole("button", { name: "Close" }).first().click();
  await renamed.waitFor({ state: "detached" });
  await page.getByRole("button", { name: "Ro’s settings" }).waitFor();
  await page.goto(`${origin}/family/learners/new`);
  await page.getByRole("dialog", { name: "Add a child" }).waitFor();
  await measured(page, `${label} add learner`);
  await shot(page, 1, "family-add", width, theme);
  await page.keyboard.press("Escape");

  // The class's old Settings address opens the family's: it adds a child
  // the family way, never the school form, and the child is on Today and
  // the map at once.
  const place = await classOf(account);
  await page.goto(
    `${origin}/school/${place.org_id}/classes/${place.class_id}/settings`,
  );
  await page.getByRole("button", { name: "Add a child", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Add a child" });
  await sheet.waitFor();
  check(
    `${label} no school roster fields in a family`,
    (await sheet.getByText(/Last name|Grade/).count()) === 0,
  );
  await sheet.getByRole("textbox", { name: /^Name/ }).fill("Ivy");
  // The family's Add a child sheet keeps its list of years (ui/Select).
  await sheet.getByRole("button", { name: "Birth year" }).click();
  await page.getByRole("option", { name: "2019", exact: true }).click();
  await measured(page, `${label} add a child`);
  await shot(page, 1, "settings-add-child", width, theme);
  // The row is saved as its year is chosen (features/family/AddChildren);
  // Done closes the sheet.
  await sheet.getByRole("button", { name: "Done", exact: true }).click();
  await sheet.waitFor({ state: "detached" });
  await page.goto(
    `${origin}/school/${place.org_id}/classes/${place.class_id}/today`,
  );
  await page.getByRole("button", { name: "Practice with Ivy" }).waitFor();
  await page.goto(
    `${origin}/school/${place.org_id}/classes/${place.class_id}/map`,
  );
  check(
    `${label} the new child is on the map`,
    await page
      .getByText("Ivy", { exact: true })
      .first()
      .waitFor({ timeout: 15_000 })
      .then(() => true)
      .catch(() => false),
  );
  await shot(page, 1, "map-with-new-child", width, theme);
  await context.close();
}

/** 2. An adult learning for themselves: their record, practice, the pause,
 * the individual plan, and back to practice. */
async function adultJourney(
  browser: Browser,
  width: number,
  theme: "light" | "dark",
) {
  const label = `${engine} ${width} ${theme} adult`;
  const context = await newContext(browser, width, theme);
  const page = await opened(context, label);
  const { account } = await signUp(page, "Avery Fixture");
  await heading(page, "What brings you to AMP?");
  await page.getByRole("link", { name: /^I’m learning for myself/ }).click();
  await page.waitForURL(/\/start\/myself$/);
  // The year is enough: an adult starts mid-scale and practice finds the
  // level within a few problems.
  await page.getByRole("radio", { name: "Adult", exact: true }).click();
  await page.getByRole("button", { name: "Start practicing" }).click();
  await practicing(page);
  check(
    `${label} an adult begins mid-scale without choosing`,
    (
      await db.query(
        "SELECT starting_band FROM amp_learners WHERE account_id=$1 AND adult",
        [account],
      )
    ).rows[0]?.starting_band === "middle-school",
  );
  await page.goto(`${origin}/me`);
  // Their record is titled by what it shows; the place carries their name.
  await heading(page, "Where you are");
  await page.getByText("100 free problems left", { exact: true }).waitFor();
  await measured(page, `${label} record`);
  await shot(page, 2, "me", width, theme);
  const learnerId = (
    await db.query(
      "SELECT id FROM amp_learners WHERE account_id=$1 AND adult",
      [account],
    )
  ).rows[0].id as string;
  await page
    .getByRole("link", { name: "Practice", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await practicing(page);
  await freeUsed(learnerId, 99);
  await skipOne(page);
  await pauseSays(
    page,
    label,
    "You’ve used the 100 free problems.",
    "Continue with AMP",
  );
  await measured(page, `${label} pause`);
  await shot(page, 2, "pause", width, theme);
  // The pay overlay (features/pay): an adult's opens over their account,
  // at /account/pay/<their learner>.
  await page.getByRole("button", { name: "Continue with AMP" }).click();
  await page.waitForURL(/\/pay(\/[^/]+)?$/);
  const pay = page.getByRole("dialog");
  await pay.getByRole("heading", { name: "Choose your plan" }).waitFor();
  const go = pay
    .locator('[data-method="card"]')
    .getByRole("button", { name: /Continue to Stripe|Resume checkout/ });
  await go.waitFor();
  await pay.getByText("$120", { exact: false }).first().waitFor();
  await measured(page, `${label} continue`);
  await shot(page, 2, "continue", width, theme);
  await go.click();
  await payInCheckout(page, 2, width, theme);
  await paidAndDone(page);
  await practicing(page);
  check(
    `${label} no naming for an adult`,
    (await page.getByRole("dialog").count()) === 0,
  );
  await skipOne(page);
  await page.locator("[data-problem-id]").first().waitFor();
  await shot(page, 2, "practice-paid", width, theme);
  await context.close();
}

/** 3. A teacher: "I’m a teacher" opens a demo class, alive with made-up
 * students’ work, before any agreement or payment. They practice as a demo
 * student, are handed back to the roster, and "Set up your real class" leads
 * to class setup. */
async function teacherJourney(
  browser: Browser,
  width: number,
  theme: "light" | "dark",
) {
  const label = `${engine} ${width} ${theme} teacher`;
  const context = await newContext(browser, width, theme);
  const page = await opened(context, label);
  const { account } = await signUp(page, "Dana Fixture");
  // "I'm a teacher" opens class setup, whose demo is one tap away.
  await page.getByRole("link", { name: /^I’m a teacher/ }).click();
  await page.waitForURL(/\/school\/start$/);
  await heading(page, "Set up your class");
  await page.getByRole("button", { name: "Explore a demo first" }).click();
  // Joining the zone's demo school is timed by tests/school-demo.integration.ts;
  // here the API shares a busy machine with Vite and the browsers.
  await page.waitForURL(CLASS_TODAY, { timeout: 90_000 });
  await todayTitle(page);
  check(
    // The shared demo school of their time zone (docs/schools.md#demo-places),
    // with them in it as its teacher.
    `${label} the demo has them in it`,
    (
      await db.query(
        `SELECT count(*)::int AS n FROM amp_people p JOIN amp_orgs o ON o.id=p.tenant_id
         WHERE o.demo AND p.account_id=$1`,
        [account],
      )
    ).rows[0].n >= 1,
  );
  const classPath = new URL(page.url()).pathname.replace(/\/today$/, "");
  // Alive: made-up students’ work, marked Demo, with the class code and
  // Start class on Today, and the bar’s one action to the real class.
  // Which of its made-up students Today names depends on the day of the
  // week; one of the class's own always is.
  await page.getByText(DEMO_CLASS_NAMES).first().waitFor();
  check(
    `${label} says Demo`,
    (await page
      .locator("[data-demo-mark]")
      .filter({ visible: true })
      .count()) >= 1,
  );
  // Today's practice slot: Start practice before it runs, the class code
  // while it does (PracticeSlot).
  await page
    .locator('[data-code-slot="start"], [data-code-slot="open"]')
    .waitFor();
  // A demo's bar offers its one action, the real class (below), never
  // Start class (features/spaces/resolve.ts).
  await page.locator("[data-demo-action]").filter({ visible: true }).waitFor();
  await measured(page, `${label} demo today`);
  await shot(page, 3, "demo-today", width, theme);

  // Practice as a demo student, then back to the roster.
  await page.goto(`${origin}${classPath}/roster`);
  await heading(page, "Students");
  const practice = page.getByRole("button", { name: /^Practice as / }).first();
  await practice.waitFor();
  const roster = page.url();
  await practice.click();
  await practicing(page);
  await measured(page, `${label} practice as`);
  await shot(page, 3, "practice-as", width, theme);
  await page
    .getByRole("button", { name: "Open AMP menu" })
    .filter({ visible: true })
    .first()
    .click();
  // A handed device goes back to the place it came from, by name
  // (features/navigation/DrawerContents.tsx): here, the class.
  await page.getByRole("button", { name: /^Back to / }).click();
  await page.waitForURL((at) => at.href === roster);
  await heading(page, "Students");

  // The real class: "Set up your real class" opens the real onboarding.
  await page.goto(`${origin}${classPath}/today`);
  await todayTitle(page);
  const real = page.locator("[data-demo-action]").filter({ visible: true });
  check(
    `${label} the action names the real class`,
    (await real.getAttribute("aria-label")) === "Set up your real class",
  );
  // A teacher sets up their real class themselves (#2282): class setup.
  await real.click();
  await page.waitForURL(/\/school\/start$/);
  await heading(page, "Set up your class");
  await shot(page, 3, "real-class", width, theme);
  await context.close();
}

/** 4. A tutor: three students (one nickname, two numbers); one parent's
 * link names one child, the others keep theirs. */
async function tutorJourney(
  browser: Browser,
  width: number,
  theme: "light" | "dark",
) {
  const label = `${engine} ${width} ${theme} tutor`;
  const context = await newContext(browser, width, theme);
  const page = await opened(context, label);
  const { account } = await signUp(page, "Marisol Fixture");
  // Tutoring is no longer a starter answer (practice at a level covers it,
  // R8); its setup keeps working at its own address for links in flight.
  await page.goto(`${origin}/start/tutor`);
  await page.waitForURL(/\/start\/tutor$/);
  await heading(page, "Your students");
  await page.getByRole("button", { name: "Add a student" }).click();
  await page.getByRole("button", { name: "Add a student" }).click();
  for (const [index, year] of [
    [1, "2015"],
    [2, "2016"],
    [3, "2017"],
  ] as const) {
    await pickYear(page, `Birth year, Student ${index}`, year);
  }
  await page.getByLabel("Nickname or initials, Student 1").fill("KJ");
  await measured(page, `${label} students`);
  await shot(page, 4, "students", width, theme);
  await page.getByRole("button", { name: "Next" }).click();
  await page.waitForURL(/\/start\/tutor\/join$/);
  await heading(page, "How they join");
  await measured(page, `${label} how they join`);
  await shot(page, 4, "setup-join", width, theme);
  await page.getByRole("link", { name: "Next", exact: true }).click();
  await page.waitForURL(/\/start\/tutor\/ready$/);
  await heading(page, "Your class is ready");
  await shot(page, 4, "setup-ready", width, theme);
  await page.getByRole("button", { name: "Go to Today" }).click();
  // Other families' children only: the tutoring group is its class's
  // classroom, never a family; its people are the class's Students.
  await page.waitForURL(CLASS_TODAY);
  await todayTitle(page);
  await page.goto(page.url().replace(/\/today$/, "/roster"));
  await heading(page, "Students");
  const names = (
    await db.query<{ name: string }>(
      `SELECT p.given_name AS name FROM amp_families f JOIN amp_enrollments e ON e.class_id=f.class_id AND e.role='student'
       JOIN amp_people p ON p.id=e.person_id JOIN amp_learners l ON l.id=p.learner_id
       WHERE f.account_id=$1 ORDER BY l.created_at,l.label_number,p.id`,
      [account],
    )
  ).rows.map((row) => row.name);
  check(`${label} three numbered students`, names.length === 3, names);
  const others = page.getByRole("region", { name: "From other families" });
  for (const name of names)
    await others.getByText(name, { exact: true }).waitFor();
  check(
    `${label} the quiet count on each student`,
    (await others
      .getByText("100 free problems left", { exact: true })
      .count()) === 3,
  );
  await measured(page, `${label} people`);
  await shot(page, 4, "people", width, theme);
  const first = others.locator("li", { hasText: names[0]! });
  await first.getByRole("button", { name: "Send to their parent" }).click();
  const sheet = page.getByRole("dialog", {
    name: `Send ${names[0]}’s parent a link`,
  });
  await sheet.waitFor();
  const parentEmail = `parent-${randomUUID().slice(0, 8)}@journeys.example`;
  await sheet.getByLabel("Their parent’s email").fill(parentEmail);
  await shot(page, 4, "send", width, theme);
  await sheet.getByRole("button", { name: "Send approval link" }).click();
  await sheet
    .getByText(`We sent ${parentEmail} a link.`, { exact: false })
    .waitFor();
  await sheet.getByRole("button", { name: "Done" }).click();
  const link = mail.find((sent) => sent.to === parentEmail)?.url;
  assert.ok(link, "the approval link was mailed");

  const parentContext = await newContext(browser, width, theme);
  const parent = await opened(parentContext, `${label} parent`);
  await parent.goto(link);
  await parent.getByRole("link", { name: "Create an account" }).click();
  await parent.waitForURL(/\/sign-up/);
  const fallback = parent.getByRole("button", {
    name: "Use a password instead",
  });
  const password = parent.getByLabel("Password", { exact: true });
  await Promise.race([fallback.waitFor(), password.waitFor()]);
  if (await fallback.isVisible()) await fallback.click();
  await parent.getByLabel("Email").fill(parentEmail);
  await password.fill(PASSWORD);
  await parent.getByRole("button", { name: "Create account" }).click();
  await parent.waitForURL(/\/family\/approve/);
  await parent.getByRole("button", { name: "Continue" }).click();
  await parent.waitForURL(APPROVAL_PAGE);
  const parentAccount = `amp|${(await (await parentContext.request.get(`${origin}/api/auth/get-session`)).json()).user.id}`;
  // As a verified purchase records it.
  await db.query(
    "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,'fixture','verified','synthetic')",
    [parentAccount],
  );
  await reloaded(parent);
  const childName = parent.getByLabel("Your child’s name");
  await childName.waitFor();
  await childName.fill("Ana");
  // The birth year sets where Ana's practice starts, and whether she is
  // under 13 (features/family-approval/ApprovalScreen.tsx).
  await pickYear(parent, "Your child’s birth year");
  await shot(parent, 4, "approve", width, theme);
  await parent.getByRole("button", { name: /^Approve .+ joining/ }).click();
  await heading(parent, /^Ana is in /);
  await parentContext.close();

  last.page = page;
  await reloaded(page);
  await heading(page, "Students");
  const ana = others.locator("li", { hasText: "Ana" });
  await ana.waitFor();
  check(
    `${label} named, still counting free problems`,
    (await ana.getByText(/free problems left$/).count()) === 1,
    await ana.innerText(),
  );
  check(
    `${label} the others stay pictures`,
    (await others.getByText(names[1]!, { exact: true }).count()) === 1 &&
      (await others.getByText(names[2]!, { exact: true }).count()) === 1 &&
      (await others.getByText(names[0]!, { exact: true }).count()) === 0,
  );
  await measured(page, `${label} named`);
  await shot(page, 4, "named", width, theme);
  await context.close();
}

/** 5. A school: the pitch inline, "Explore a demo school" (six classes and
 * demo teachers), then "Talk to us". */
async function schoolJourney(
  browser: Browser,
  width: number,
  theme: "light" | "dark",
) {
  const label = `${engine} ${width} ${theme} school`;
  const context = await newContext(browser, width, theme);
  const page = await opened(context, label);
  await signUp(page, "Ruth Fixture");
  await page.getByRole("link", { name: /^I run a school/ }).click();
  await page.waitForURL(/\/start\/school$/);
  // Each answer is a step page of its own, titled by its question.
  await heading(page, "AMP for your school");
  await page.getByText("objectives mapped to Common Core standards").waitFor();
  await measured(page, `${label} pitch`);
  await shot(page, 5, "pitch", width, theme);
  await page.getByRole("button", { name: "Explore a demo school" }).click();
  await page.waitForURL(/\/school\/[0-9a-f-]{36}$/);
  await page.getByText("Grade 3 Math").first().waitFor();
  check(
    `${label} says Demo`,
    (await page
      .locator("[data-demo-mark]")
      .filter({ visible: true })
      .count()) >= 1,
  );
  await measured(page, `${label} demo school`);
  await shot(page, 5, "demo-school", width, theme);
  // The demo's one action is the real thing, set up on their own: a leader
  // sets up their real school (school/demo/DemoSetupAction.tsx).
  const real = page.locator("[data-demo-action]").filter({ visible: true });
  check(
    `${label} the action is Set up your real school`,
    (await real.getAttribute("aria-label")) === "Set up your real school",
  );
  await real.click();
  await page.waitForURL(/\/school\/start\/school$/);
  await heading(page, "Set up your school");
  await measured(page, `${label} real school`);
  await shot(page, 5, "real-school", width, theme);
  await context.close();
}

/** 6. A returning paid family signs in to the same home, with nothing to
 * answer. */
async function returningJourney(
  browser: Browser,
  width: number,
  theme: "light" | "dark",
) {
  const label = `${engine} ${width} ${theme} returning`;
  const context = await newContext(browser, width, theme);
  const page = await opened(context, label);
  const { account, email, token } = await signUp(page, "Sam Fixture");
  const started = await context.request.post(`${origin}/api/v1/start`, {
    headers: { authorization: `Bearer ${token}` },
    data: { as: "parent", children: [{ birthYear: 2015 }] },
  });
  assert.equal(started.status(), 200, await started.text());
  const [child] = await learnersOf(account);
  await db.query(
    "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,'fixture','verified','synthetic')",
    [account],
  );
  await db.query(
    "UPDATE amp_learners SET name='Lena',name_pending=false WHERE id=$1",
    [child!.id],
  );
  await db.query(
    `INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at)
     VALUES($1,$2,'stripe',$1,'active',now()-interval '1 day',now()+interval '300 days')`,
    [`fixture:${child!.id}`, child!.id],
  );
  await context.close();
  const again = await newContext(browser, width, theme);
  const back = await opened(again, label);
  const seen: string[] = [];
  back.on("framenavigated", (frame) => {
    if (frame === back.mainFrame()) seen.push(new URL(frame.url()).pathname);
  });
  await signIn(back, email);
  await back.waitForURL(FAMILY_TODAY);
  await todayTitle(back);
  await back.getByRole("button", { name: "Practice with Lena" }).waitFor();
  check(
    `${label} nothing to answer on the way`,
    !seen.some((path) => path.startsWith("/start") || path.startsWith("/try")),
    seen,
  );
  check(
    `${label} a paid child shows access, not a count`,
    (await back.getByText(/free problems left/).count()) === 0,
  );
  await measured(back, `${label} home`);
  await shot(back, 6, "home", width, theme);
  // An adult's own practice is their own learner, never a learner in the
  // family (the family adds only children). It starts in place in the
  // family's Settings › People (IA v2 §3.3, me/OwnPractice.tsx), then
  // Practice.
  await back.goto(`${origin}${new URL(back.url()).pathname}/settings`);
  const startOwn = back.locator("[data-start-own-practice]");
  await startOwn.waitFor();
  await shot(back, 6, "own-practice-start", width, theme);
  await startOwn.click();
  await back
    .locator("[data-own-practice]")
    .getByRole("button", { name: "Practice", exact: true })
    .click();
  await practicing(back);
  check(
    `${label} their own learner, not a family one`,
    (
      await db.query(
        "SELECT count(*)::int AS n FROM amp_learners WHERE account_id=$1 AND adult AND deleted_at IS NULL",
        [account],
      )
    ).rows[0].n === 1 && (await learnersOf(account)).length === 1,
  );
  await again.close();
}

/** Opening an address the app redirects at once: WebKit may report the
 * first navigation as interrupted by the second, which is the point. */
async function visit(page: Page, url: string) {
  await page.goto(url).catch((error: unknown) => {
    if (!/interrupted/i.test(String(error))) throw error;
  });
}
/** 7. Old `/try` links from ads and email: never a 404. Signed out, they
 * sign up (and the starter follows); signed in, `/` opens the place. */
async function journey7(
  browser: Browser,
  width: number,
  theme: "light" | "dark",
) {
  const label = `${engine} ${width} ${theme} old link`;
  const context = await newContext(browser, width, theme);
  const page = await opened(context, label);
  for (const path of [
    "/try",
    "/try/practice?utm_source=google",
    "/try/plans",
  ]) {
    await visit(page, `${origin}${path}`);
    await page.waitForURL(/\/sign-up(\?|$)/);
    check(
      `${label} ${path} signed out signs up`,
      new URL(page.url()).pathname === "/sign-up",
      page.url(),
    );
  }
  // A funded program's link keeps its program through sign-up: the vendor
  // line shows, and the follow-up records it.
  await visit(page, `${origin}/try?program=ar-efa`);
  await page.waitForURL(/\/sign-up\?/);
  const carried = new URL(page.url()).searchParams;
  check(
    `${label} a funded link keeps its program`,
    carried.get("program") === "ar-efa" &&
      carried.get("return") === "free-practice",
    page.url(),
  );
  await page.getByText("Approved Arkansas EFA vendor.").waitFor();
  await shot(page, 7, "signed-out", width, theme);
  // Signed up: the same link opens the starter (no place yet), then home.
  const { account } = await signUp(page, "Robin Fixture", true);
  check(
    `${label} the follow-up records the funded program`,
    (
      await db.query(
        "SELECT program FROM amp_parent_followups WHERE user_id=$1",
        [account.slice(4)],
      )
    ).rows[0]?.program === "ar-efa",
  );
  await visit(page, `${origin}/try`);
  await page.waitForURL(/\/start$/);
  await heading(page, "What brings you to AMP?");
  await page.getByRole("link", { name: /I’m a parent/ }).click();
  // The parent's setup (R11): one child, straight into their first
  // problem, then back to the parent on Today.
  await page.waitForURL(/\/start\/parent$/);
  await heading(page, "Add your kids");
  await pickYear(page, "Birth year, Child 1");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  // One child practices first: their first problem opens on this device,
  // and signing out gives it back to the parent, on Today.
  await page.locator("[data-problem-id]").first().waitFor();
  await page
    .getByRole("button", { name: "Open AMP menu" })
    .filter({ visible: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Back to family" }).click();
  await page.waitForURL(FAMILY_TODAY);
  await visit(page, `${origin}/try/map`);
  await page.waitForURL(FAMILY_TODAY);
  check(
    `${label} signed in goes home`,
    FAMILY_TODAY.test(new URL(page.url()).pathname),
    page.url(),
  );
  await measured(page, `${label} home`);
  await shot(page, 7, "signed-in", width, theme);
  await context.close();
}

const run: Record<number, typeof parentJourney> = {
  1: parentJourney,
  2: adultJourney,
  3: teacherJourney,
  4: tutorJourney,
  5: schoolJourney,
  6: returningJourney,
  7: journey7,
};
let browser: Browser | undefined;
try {
  browser = await (engine === "webkit" ? webkit : chromium).launch();
  for (const width of widths)
    for (const theme of themes)
      for (const journey of [...journeys].sort())
        await run[journey]!(browser, width, theme);
} catch (error) {
  await last.page?.screenshot({ path: `${scratch}/stuck.png` }).catch(() => {});
  console.error(`Stopped at ${last.page?.url()}`);
  throw error;
} finally {
  await browser?.close();
  await renderer.close();
  await writeFile(
    `${scratch}/failures.json`,
    JSON.stringify(failures, null, 1),
  );
  await vite.close();
  await app.close();
  await repository.close();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
  console.info = info;
}
if (failures.length) {
  for (const failure of failures.slice(0, 80)) console.error(failure);
  process.exit(1);
}
console.log(`${engine}: journeys ${[...journeys].sort().join(", ")} passed.`);
process.exit(0);
