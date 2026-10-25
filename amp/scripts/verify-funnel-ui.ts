import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { Pool } from "pg";
import { chromium, type Page } from "playwright";
import { createServer } from "vite";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";
import { registerAnalyticsRoutes } from "../src/analytics/routes";
import {
  linkCheckoutVisitor,
  recordVerifiedPurchase,
} from "../src/analytics/repository";
import {
  FUNNEL_STEPS,
  formatFunnelReport,
  funnelReport,
} from "../src/analytics/report";
import { noticeDigest } from "../src/parent-consent/crypto";
import { consentFixture } from "../tests/parent-consent.fixture";
import { retentionNotice } from "../src/family/contracts";

/**
 * A scripted browser walk through the funnel. The real web helper sends
 * beacons through Vite to the real `POST /api/v1/events` on a throwaway
 * schema; other API calls are synthetic. Screens that exist (landing, Try
 * free, plan, checkout, return) are driven by clicks; trial and practice
 * milestones go through the same `track()` module. The verified purchase is
 * written by the billing writer with the visitor the checkout request carried.
 * The resulting report must show every funnel step.
 */
const url = process.env.AMP_TEST_DATABASE_URL;
if (!url) throw new Error("AMP_TEST_DATABASE_URL is required");
assertTestDatabaseTarget(url);
const schema = `amp_funnel_walk_${randomUUID().replaceAll("-", "")}`;
const admin = new Pool({ connectionString: url, max: 1 });
const scoped = new URL(url);
scoped.searchParams.set("options", `-c search_path=${schema}`);
await admin.query(`CREATE SCHEMA ${schema}`);
await migrate(scoped.href);
const pool = new Pool({ connectionString: scoped.href, max: 4 });
const api = Fastify();
await api.register(rateLimit, { max: 600, timeWindow: "1 minute" });
await registerAnalyticsRoutes(api, { pool });
const apiPort = 4394,
  port = 4395,
  origin = `http://127.0.0.1:${port}`;
await api.listen({ host: "127.0.0.1", port: apiPort });

const authPath = fileURLToPath(new URL("../src/web/auth.ts", import.meta.url));
const auth = `export async function accessSession(){return localStorage.getItem('verify.signedIn')?{token:'synthetic',accountId:'synthetic-parent'}:null;}export function onSessionChanged(){return()=>{};}export async function signIn(){}export async function signOut(){}export function notifyAccountSessionChanged(){}export async function authConfig(){return {mode:'accounts',passwords:true,providers:[]};}`;
const vite = await createServer({
  cacheDir: "node_modules/.vite-funnel",
  plugins: [
    {
      name: "funnel-auth",
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
  },
});
await vite.listen();
const browser = await chromium.launch();
const policy = {
  ...consentFixture,
  review: { ...consentFixture.review, paymentNotificationsReviewed: true },
};
const purchaseId = randomUUID();
const offers = ["year", "month"].map((interval, i) => ({
  id: (i ? "b" : "a").repeat(64),
  mode: "test",
  currency: "USD",
  amountMinor: i ? 4900 : 49900,
  formattedAmount: i ? "$49.00" : "$499.00",
  interval,
  learnerCount: 1,
}));
const checkoutVisitors: string[] = [];
let phase: "ready" | "checkout-open" | "processing" | "paid" = "ready";

async function serve(page: Page, faults: string[]) {
  // This fixture exercises customer reports. Automated exclusion has its own browser test.
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "webdriver", { value: false }),
  );
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
    if (path === "/events") {
      // Forward to the real collection endpoint, as a deployment proxy would.
      const forwarded = await fetch(
        `http://127.0.0.1:${apiPort}/api/v1/events`,
        {
          method: "POST",
          headers: { "content-type": req.headers()["content-type"] ?? "" },
          body: req.postData() ?? undefined,
        },
      );
      return route.fulfill({
        status: forwarded.status,
        body: await forwarded.text(),
      });
    }
    if (path === "/me")
      return route.fulfill({
        json: {
          signedIn: true,
          account: {
            id: "synthetic-parent",
            email: "parent@example.test",
            emailVerified: true,
          },
          consent: { status: "none", method: null },
          learners: [],
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
          next: "choose-plan",
        },
      });
    if (path === "/billing/offer")
      return route.fulfill({
        json: { available: true, offer: offers[0], offers },
      });
    if (path === "/billing/enrollment") {
      if (phase === "processing") phase = "paid";
      return route.fulfill({
        json: {
          available: true,
          notice: policy.notice,
          noticeDigest: noticeDigest(policy),
          purchase:
            phase === "ready"
              ? null
              : {
                  id: purchaseId,
                  interval: "year",
                  phase,
                  learnerId: null,
                  url:
                    phase === "checkout-open"
                      ? "https://checkout.stripe.com/c/pay/cs_fixture"
                      : null,
                },
        },
      });
    }
    if (path === "/billing/enrollment/checkout") {
      checkoutVisitors.push(req.headers()["x-amp-visitor"] ?? "");
      phase = "checkout-open";
      return route.fulfill({
        json: { url: "https://checkout.stripe.com/c/pay/cs_fixture" },
      });
    }
    // Screens past the walk (practice, catalog, trial API) are not under test.
    if (
      ["/catalog", "/books", "/trials", "/session"].includes(path) ||
      path.startsWith("/learners")
    )
      return route.fulfill({ status: 503, json: { error: "fixture_end" } });
    faults.push(`unexpected ${req.method()} ${path}`);
    return route.fulfill({ status: 404, json: { error: "unexpected" } });
  });
}

/** Sends milestones through the app's own analytics module. */
async function milestones(page: Page, events: [string, object?][]) {
  await page.evaluate(async (list) => {
    const analytics = await import("/src/web/lib/analytics.ts" as string);
    for (const [event, props] of list) analytics.track(event, props);
    analytics.flush();
  }, events);
}
const stored = async () =>
  (await pool.query("SELECT count(*)::int n FROM amp_funnel_events")).rows[0]
    .n as number;
/** Waits until at least `minimum` events are stored and no more arrive. */
async function settled(minimum: number) {
  let last = -1;
  for (let i = 0; i < 60; i++) {
    const now = await stored();
    if (now >= minimum && now === last) return;
    last = now;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const seen = await pool.query(
    "SELECT event,count(*)::int n FROM amp_funnel_events GROUP BY 1 ORDER BY 1",
  );
  assert.fail(
    `expected at least ${minimum} stored events, saw ${last}: ${JSON.stringify(seen.rows)}`,
  );
}

const faults: string[] = [];
try {
  // Visitor 1 converts: landing from a campaign through paid practice.
  const buyer = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await buyer.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", (error) => faults.push(error.message));
  if (process.env.DEBUG_UI) {
    page.on("console", (m) => console.log("console", m.type(), m.text()));
    page.on(
      "response",
      (r) => r.url().includes("/events") && console.log("events", r.status()),
    );
    page.on("requestfailed", (r) =>
      console.log("failed", r.url(), r.failure()?.errorText),
    );
  }
  await serve(page, faults);
  await page.goto(
    `${origin}/?utm_source=facebook&utm_medium=paid-social&utm_campaign=ar-efa-launch`,
    {
      referer: "https://mail.google.com/",
    },
  );
  await page.getByRole("button", { name: "Try free" }).click();
  await milestones(page, [
    ["placement_answer", { index: 0 }],
    ["placement_answer", { index: 1 }],
    ["placement_done", { gradeBand: "3" }],
    ["map_view"],
    ["practice_answer", { index: 0 }],
    ["hint_use"],
    ["lesson_open"],
    ["mastery"],
    ["email_saved"],
    ["paywall_view", { reason: "limit" }],
  ]);
  await settled(13);
  // The parent signs up and opens the plan step.
  await page.evaluate(() => localStorage.setItem("verify.signedIn", "1"));
  await page.goto(`${origin}/start/plan`);
  await page.getByRole("radio", { name: /Monthly/ }).click();
  await page.getByRole("radio", { name: /Annual/ }).click();
  await page.getByRole("checkbox").click();
  await page
    .getByRole("button", { name: "Continue to secure checkout" })
    .click();
  await page
    .getByRole("heading", { name: "Stripe Checkout fixture" })
    .waitFor();
  const visitor = (
    await pool.query("SELECT visitor_id FROM amp_funnel_visitors")
  ).rows[0].visitor_id as string;
  assert.deepEqual(checkoutVisitors, [visitor], "checkout carries the visitor");
  // The verified webhook settles the purchase (see purchase-consent tests).
  const checkout = randomUUID();
  await pool.query(
    "INSERT INTO amp_stripe_checkouts(id,namespace,account_id,request_id) VALUES($1,'walk','synthetic-parent',$2)",
    [checkout, randomUUID()],
  );
  await linkCheckoutVisitor(pool, checkout, checkoutVisitors[0]);
  phase = "processing";
  await page.goto(
    `${origin}/start/purchase?billing=processing&purchase=${purchaseId}`,
  );
  await page
    .getByRole("heading", { name: "Payment confirmed" })
    .waitFor({ timeout: 15000 });
  await recordVerifiedPurchase(pool, checkout, "year");
  await milestones(page, [
    ["learner_added", { ageBand: "6-8" }],
    ["paid_practice_first"],
  ]);
  await settled(13 + 4 + 1 + 1 + 2);

  // Visitor 2 tries, dismisses the paywall and leaves.
  const leaver = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const other = await leaver.newPage();
  other.on("pageerror", (error) => faults.push(error.message));
  await serve(other, faults);
  // Safe first-touch UTM labels are captured before routing rewrites the URL.
  await other.goto(
    `${origin}/?utm_source=launch&utm_medium=email&utm_campaign=fall`,
    { referer: "https://www.google.com/" },
  );
  await other.getByRole("button", { name: "Try free" }).click();
  await milestones(other, [
    ["placement_answer", { index: 0 }],
    ["paywall_view", { reason: "choice" }],
    ["paywall_dismiss", { reason: "price" }],
  ]);
  await settled(21 + 5);

  assert.deepEqual(
    (
      await pool.query(
        "SELECT utm_source,utm_medium,utm_campaign FROM amp_funnel_visitors WHERE visitor_id=$1",
        [visitor],
      )
    ).rows,
    [
      {
        utm_source: "facebook",
        utm_medium: "paid-social",
        utm_campaign: "ar-efa-launch",
      },
    ],
    "the allowed campaign survives the real browser journey and first-party collection",
  );
  assert.deepEqual(
    (
      await pool.query(
        "SELECT utm_source,utm_campaign,referrer FROM amp_funnel_visitors WHERE visitor_id<>$1",
        [visitor],
      )
    ).rows,
    [{ utm_source: "launch", utm_campaign: "fall", referrer: "search" }],
    "first-touch source survives routing even outside fixed state campaigns",
  );
  const report = await funnelReport(pool, {
    from: new Date(Date.now() - 86_400_000),
    to: new Date(Date.now() + 86_400_000),
  });
  if (process.env.DEBUG_UI)
    console.log(
      "report",
      JSON.stringify(report),
      "traffic",
      (
        await pool.query(
          "SELECT traffic_kind,count(*) FROM amp_funnel_visitors GROUP BY 1",
        )
      ).rows,
    );
  for (const step of FUNNEL_STEPS)
    assert.ok(
      report.steps.find((s) => s.event === step)!.visitors >= 1,
      `${step} reached in the walk`,
    );
  assert.equal(report.visitors, 2);
  assert.equal(
    report.steps.find((s) => s.event === "purchase")!.fromFirst,
    0.5,
  );
  assert.deepEqual(
    report.breakdowns.source.map((r) => [r.key, r.purchased]),
    [
      ["facebook", 1],
      ["launch", 0],
    ],
  );
  assert.deepEqual(report.paywallDismissReasons, [
    { reason: "price", count: 1 },
  ]);
  assert.deepEqual(faults, []);
  const text = formatFunnelReport(report);
  await mkdir("artifacts/funnel", { recursive: true });
  await writeFile("artifacts/funnel/report.txt", `${text}\n`);
  console.log(text);
  console.log(
    "\nverify-funnel-ui: full synthetic funnel recorded and reported",
  );
} finally {
  await browser.close();
  await vite.close();
  await api.close();
  await pool.end();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
