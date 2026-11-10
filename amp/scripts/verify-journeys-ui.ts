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
import { schoolPictures } from "../src/schools/contracts";
import {
  config as stripeBase,
  payment as basePayment,
} from "../tests/stripe-fixtures";
import { syntheticDocumentProfile } from "../tests/payment-evidence-fixtures";
import { consentFixture } from "../tests/parent-consent.fixture";
import { probe, settle, shellRecord, shiftRecorder } from "./app-shell-probe";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";

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
    mail: async (to, _subject, _text, link) => {
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
  cacheDir: "node_modules/.vite-journeys",
  server: {
    host: "127.0.0.1",
    port: webPort,
    strictPort: true,
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
const CLASS_TODAY = /\/school\/[0-9a-f-]{36}\/classes\/[0-9a-f-]{36}\/today$/;
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
  page.on("pageerror", (error) =>
    failures.push(`${label} page error: ${error.message}`),
  );
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
  const { cls } = await shellRecord(page);
  check(`${label} CLS`, cls <= 0.01, cls);
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
  await page.waitForURL(/\/start\/parent$/);
  await heading(page, "How many children?", 2);
  await page.getByRole("button", { name: "Increase children" }).click();
  for (const [ordinal, year] of [
    ["first", "2016"],
    ["second", "2018"],
  ] as const) {
    await page
      .getByRole("button", { name: `Birth year, ${ordinal} child` })
      .click();
    await page.getByRole("option", { name: year, exact: true }).click();
  }
  await measured(page, `${label} children`);
  await shot(page, 1, "children", width, theme);
  // Back and forward keep the same screen; refresh keeps the answer's URL.
  await page.goBack();
  await page.waitForURL(/\/start$/);
  await page.goForward();
  await page.waitForURL(/\/start\/parent$/);
  await heading(page, "How many children?", 2);
  check(
    `${label} the drafted birth years survive Back and Forward`,
    (await page.getByRole("button", { name: "Continue" }).isEnabled()) === true,
  );
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(CLASS_TODAY);
  await heading(
    page,
    /^(Good (morning|afternoon|evening)|(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day, )/,
  );
  const [fox, moon] = await learnersOf(account);
  assert.ok(fox && moon, "two unnamed children");
  check(
    `${label} picture names`,
    /^[A-Z][a-z]+$/.test(fox.name) && fox.name !== moon.name,
    [fox.name, moon.name],
  );
  await page
    .getByRole("button", { name: `Let ${fox.name} practice here` })
    .waitFor();
  check(
    `${label} the quiet count on each child`,
    (await page
      .getByText("100 free problems left", { exact: true })
      .count()) === 2,
  );
  const home = await classOf(account);
  check(
    `${label} the class code for a child's own device`,
    (await page
      .locator(`[data-class-code="${home.join_code}"]`)
      .filter({ visible: true })
      .count()) === 1,
  );
  await measured(page, `${label} today`);
  await shot(page, 1, "today", width, theme);

  // Fox practices here, handed this device.
  await page
    .getByRole("button", { name: `Let ${fox.name} practice here` })
    .click();
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
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(CLASS_TODAY);
  await page.getByText("99 free problems left", { exact: true }).waitFor();

  // Moon joins on a device of their own: class code, then pictures.
  const own = await newContext(browser, width, theme);
  const device = await opened(own, `${label} Moon's device`);
  await device.goto(`${origin}/join`);
  await heading(device, "Type your class code");
  await device.getByLabel("Class code").fill(home.join_code);
  await device.waitForURL(`**/join/${home.join_code}`);
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
    new URL(page.url()).pathname === "/practice",
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

  await page.getByRole("button", { name: "Continue with AMP" }).click();
  await page.waitForURL(new RegExp(`/continue/${fox.id}$`));
  await heading(page, "Continue with AMP");
  await page.getByText(`For ${fox.name}`, { exact: true }).waitFor();
  const attest = page.getByRole("checkbox", {
    name: /I am this learner’s parent/,
  });
  await attest.waitFor();
  await measured(page, `${label} continue`);
  await shot(page, 1, "continue", width, theme);
  await attest.check();
  await page
    .getByRole("button", { name: "Continue to secure checkout" })
    .click();
  await payInCheckout(page, 1, width, theme);
  // Back on the same screen, practicing, with the name offered once.
  await practicing(page);
  const naming = page.getByRole("dialog", { name: `Add ${fox.name}’s name` });
  await naming.waitFor();
  await measured(page, `${label} naming`);
  await shot(page, 1, "name", width, theme);
  await naming.getByLabel("First name or nickname").fill("Rowan");
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
  await page.goto(`${origin}/`);
  await page.waitForURL(CLASS_TODAY);
  await page.getByRole("button", { name: "Let Rowan practice here" }).waitFor();
  await shot(page, 1, "today-paid", width, theme);
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
  // The birth year sets where their own practice starts.
  await page.getByRole("radio", { name: "Adult", exact: true }).click();
  await page.getByRole("button", { name: "Start practicing" }).click();
  await page.waitForURL(/\/me$/);
  check(
    `${label} an adult's birth year starts at the top of the scale`,
    (
      await db.query(
        "SELECT starting_band FROM amp_learners WHERE account_id=$1 AND adult",
        [account],
      )
    ).rows[0]?.starting_band === "precalculus",
  );
  await heading(page, "Avery Fixture");
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
  await page.getByRole("button", { name: "Continue with AMP" }).click();
  await page.waitForURL(new RegExp(`/continue/${learnerId}$`));
  await page.getByText("For your own practice", { exact: true }).waitFor();
  const go = page.getByRole("button", { name: "Continue to secure checkout" });
  await go.waitFor();
  await page.getByText("$120.00", { exact: false }).first().waitFor();
  await measured(page, `${label} continue`);
  await shot(page, 2, "continue", width, theme);
  await go.click();
  await payInCheckout(page, 2, width, theme);
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
 * to the real onboarding, which begins at "Talk to us" (white-glove). */
async function teacherJourney(
  browser: Browser,
  width: number,
  theme: "light" | "dark",
) {
  const label = `${engine} ${width} ${theme} teacher`;
  const context = await newContext(browser, width, theme);
  const page = await opened(context, label);
  const { account } = await signUp(page, "Dana Fixture");
  await page.getByRole("button", { name: /^I’m a teacher/ }).click();
  await page.waitForURL(CLASS_TODAY);
  await heading(
    page,
    /^(Good (morning|afternoon|evening)|(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day, )/,
  );
  check(
    `${label} the demo is theirs`,
    (
      await db.query(
        "SELECT count(*)::int AS n FROM amp_orgs WHERE demo AND created_by=$1",
        [account],
      )
    ).rows[0].n === 1,
  );
  const classPath = new URL(page.url()).pathname.replace(/\/today$/, "");
  // Alive: made-up students’ work, marked Demo, with the class code and
  // Start class on Today, and the bar’s one action to the real class.
  await page
    .getByText(/Noor|Diego|Lena/)
    .first()
    .waitFor();
  check(
    `${label} says Demo`,
    (await page
      .locator("[data-demo-mark]")
      .filter({ visible: true })
      .count()) >= 1,
  );
  await page.locator("[data-class-code]").waitFor();
  await page.getByRole("link", { name: "Start class" }).waitFor();
  await measured(page, `${label} demo today`);
  await shot(page, 3, "demo-today", width, theme);

  // Practice as a demo student, then back to the roster.
  await page.goto(`${origin}${classPath}/roster`);
  await heading(page, "Roster");
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
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL((at) => at.href === roster);
  await heading(page, "Roster");

  // The real class: "Set up your real class" opens the real onboarding.
  await page.goto(`${origin}${classPath}/today`);
  await heading(
    page,
    /^(Good (morning|afternoon|evening)|(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day, )/,
  );
  const real = page.locator("[data-demo-action]").filter({ visible: true });
  check(
    `${label} the action names the real class`,
    (await real.getAttribute("aria-label")) === "Set up your real class",
  );
  await real.click();
  await page.waitForURL(/\/schools#talk$/);
  await page.getByRole("heading", { name: "Talk to us." }).waitFor();
  await shot(page, 3, "real-class", width, theme);
  await context.close();
}

/** 4. A tutor: three unnamed students; one parent's link names one child,
 * the others stay pictures. */
async function tutorJourney(
  browser: Browser,
  width: number,
  theme: "light" | "dark",
) {
  const label = `${engine} ${width} ${theme} tutor`;
  const context = await newContext(browser, width, theme);
  const page = await opened(context, label);
  const { account } = await signUp(page, "Marisol Fixture");
  await page.getByRole("link", { name: /^I tutor or run a co-op/ }).click();
  await page.waitForURL(/\/start\/tutor$/);
  await heading(page, "How many students?", 2);
  await page.getByRole("button", { name: "Increase students" }).click();
  await page.getByRole("button", { name: "Increase students" }).click();
  for (const [index, year] of [
    [1, "2015"],
    [2, "2016"],
    [3, "2017"],
  ] as const) {
    await page
      .getByRole("button", { name: `Birth year, student ${index}` })
      .click();
    await page.getByRole("option", { name: year, exact: true }).click();
  }
  await measured(page, `${label} students`);
  await shot(page, 4, "students", width, theme);
  await page.getByRole("button", { name: "Create my class" }).click();
  await page.waitForURL(CLASS_TODAY);
  await heading(
    page,
    /^(Good (morning|afternoon|evening)|(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day, )/,
  );
  const names = (
    await db.query<{ name: string }>(
      `SELECT p.given_name AS name FROM amp_families f JOIN amp_enrollments e ON e.class_id=f.class_id AND e.role='student'
       JOIN amp_people p ON p.id=e.person_id JOIN amp_learners l ON l.id=p.learner_id
       WHERE f.account_id=$1 ORDER BY l.created_at,l.picture_number,array_position($2::text[],l.picture_identity),p.id`,
      [account, [...schoolPictures]],
    )
  ).rows.map((row) => row.name);
  check(`${label} three picture students`, names.length === 3, names);
  await measured(page, `${label} today`);
  await shot(page, 4, "today", width, theme);
  // A tutor’s students, each from another family, are on Students.
  await page.goto(page.url().replace(/\/today$/, "/roster"));
  await heading(page, "Students");
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
  const childName = parent.getByLabel("Your child’s first name");
  await childName.waitFor();
  await childName.fill("Ana");
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
  await heading(page, "AMP for your school", 2);
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
  const talk = page.locator("[data-demo-action]").filter({ visible: true });
  check(
    `${label} the action is Talk to us`,
    (await talk.getAttribute("aria-label")) === "Talk to us",
  );
  await talk.click();
  await page.waitForURL(/\/schools#talk$/);
  await page.getByRole("heading", { name: "Talk to us." }).waitFor();
  await shot(page, 5, "talk", width, theme);
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
  await back.waitForURL(CLASS_TODAY);
  await heading(
    back,
    /^(Good (morning|afternoon|evening)|(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day, )/,
  );
  await back.getByRole("button", { name: "Let Lena practice here" }).waitFor();
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
  // Adding an adult in Family asks once whether it is them: their own
  // practice is their own learner.
  await back.goto(`${origin}/family/learners`);
  await back
    .getByRole("button", { name: "Add learner", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await back.getByLabel("Name", { exact: true }).fill("Sam");
  await back.getByRole("button", { name: "Birth year" }).click();
  await back.getByRole("option", { name: "Adult", exact: true }).click();
  await back
    .locator("form.family-add-learner")
    .getByRole("button", { name: "Add learner", exact: true })
    .click();
  const askSelf = back.getByRole("dialog", { name: "Is this you?" });
  await askSelf.waitFor();
  await shot(back, 6, "is-this-you", width, theme);
  await askSelf.getByRole("button", { name: "Yes, it’s me" }).click();
  await back.waitForURL(/\/me$/);
  await heading(back, "Sam Fixture");
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
  await page.getByRole("button", { name: "Birth year, your child" }).click();
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.waitForURL(CLASS_TODAY);
  await visit(page, `${origin}/try/map`);
  await page.waitForURL(CLASS_TODAY);
  check(
    `${label} signed in goes home`,
    CLASS_TODAY.test(new URL(page.url()).pathname),
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
