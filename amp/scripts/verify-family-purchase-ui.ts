/**
 * "Continue with AMP" from a child's page, end to end against a seeded design
 * preview (scripts/design-preview.sh), in test mode with no real purchase: the
 * child's page offers it while the free problems last; it opens that child's
 * plan with the child's page remembered as the way back; Stripe's checkout is
 * a fixture; the fulfilment the webhook would write is written to the scratch
 * database; and the return (`/?billing=processing&purchase=…`) is settled
 * before any remembered place and lands on the same child's page with access
 * active. Then the /continue memory's edge cases: another account's memory
 * and an expired one never return anywhere but the learner's own view.
 *
 *   AMP_PREVIEW_ORIGIN=http://127.0.0.1:4940 \
 *   AMP_PREVIEW_DATABASE_URL=postgres://amp:amp@127.0.0.1:55490/<scratch> \
 *   AMP_SHOTS=<dir> npx tsx scripts/verify-family-purchase-ui.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { chromium } from "playwright";
import { analyticsSelfTest, stubAnalytics } from "./analytics-stub";

const origin = process.env.AMP_PREVIEW_ORIGIN ?? "http://127.0.0.1:4940";
const database = process.env.AMP_PREVIEW_DATABASE_URL ?? "";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))
  throw new Error(`Loopback previews only: ${origin}`);
if (!/^postgres:\/\/[^@]+@127\.0\.0\.1:\d+\/amp_scratch_/.test(database))
  throw new Error("A loopback amp_scratch_ database only");
const shots = process.env.AMP_SHOTS ?? "artifacts/family-purchase";
mkdirSync(shots, { recursive: true });

const browser = await chromium.launch();
const pool = new pg.Pool({ connectionString: database, max: 1 });
try {
  for (const width of [390, 1280]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
    });
    const signIn = await context.request.post(
      `${origin}/api/auth/sign-in/email`,
      {
        headers: { Origin: origin },
        data: {
          email: `${process.env.AMP_PURCHASE_PERSONA ?? "parent-new"}@personas.amp.test`,
          password: "design pass persona passphrase",
        },
      },
    );
    assert.ok(signIn.ok(), `sign-in ${signIn.status()}`);
    // Product measurement is not under test and never leaves the page, even
    // as a page closes (scripts/analytics-stub.ts).
    await stubAnalytics(context);
    const places = (await (
      await context.request.get(`${origin}/api/v1/families`)
    ).json()) as {
      families: { familyId: string; role: string }[];
    };
    const family = places.families.find(
      (entry) => entry.role === "holder",
    )!.familyId;
    const projection = (await (
      await context.request.get(`${origin}/api/v1/families/${family}`)
    ).json()) as { children: { id: string; access: { hasAccess: boolean } }[] };
    if (width === 390) {
      const sent = await analyticsSelfTest(
        context,
        origin,
        [`/family/${family}`, `/family/${family}/settings`],
        pool,
      );
      console.log(
        `analytics: ${sent} sends stubbed in the page; none reached the server`,
      );
    }
    const child = projection.children.find((entry) => !entry.access.hasAccess);
    if (!child) {
      console.log(`${width}: every child already has access; reseed to rerun`);
      await context.close();
      continue;
    }
    const page = await context.newPage();
    const childPage = `/family/${family}/kids/${child.id}`;
    await page.goto(`${origin}${childPage}`);
    await page.waitForSelector(`[data-continue="${child.id}"]`);
    await page.screenshot({
      path: join(shots, `purchase-1-child-${width}.png`),
      fullPage: true,
    });
    await page.click(`[data-continue="${child.id}"]`);
    await page.waitForURL(`**/continue/${child.id}`);
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await page.screenshot({
      path: join(shots, `purchase-2-plan-${width}.png`),
      fullPage: true,
    });
    const remembered = await page.evaluate(() =>
      sessionStorage.getItem("amp.continue.v1"),
    );
    assert.ok(remembered, "the continuation is remembered");
    assert.equal(JSON.parse(remembered!).returnTo, childPage);
    assert.equal(JSON.parse(remembered!).learnerId, child.id);
    // Stripe's checkout is a fixture; its fulfilment is the webhook's grant.
    const purchase = randomUUID();
    await pool.query(
      `INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at)
       VALUES($1,$2,'stripe',$3,'active',now(),now()+interval '1 year')`,
      [`fixture-${purchase}`, child.id, purchase],
    );
    await page.route("**/api/v1/billing/purchase/**", (route) =>
      route.fulfill({ json: { learnerId: child.id } }),
    );
    await page.route(`**/api/v1/billing/status/${child.id}`, (route) =>
      route.fulfill({
        json: { phase: "licensed", learnerId: child.id, interval: "month" },
      }),
    );
    await page.goto(`${origin}/?billing=processing&purchase=${purchase}`);
    await page.waitForURL(`**${childPage}`, { timeout: 30_000 });
    await page.waitForSelector("[data-child-page]");
    await page.waitForFunction(
      (id) =>
        !document.querySelector(`[data-continue="${id}"]`) &&
        /Active/.test(document.querySelector("main")?.textContent ?? ""),
      child.id,
      { timeout: 30_000 },
    );
    await page.waitForTimeout(800);
    await page.screenshot({
      path: join(shots, `purchase-3-returned-${width}.png`),
      fullPage: true,
    });
    console.log(`${width}: returned to ${childPage} with access active`);
    // No usable memory on this device (none, another account's, an expired
    // one): the paid child's own page, read from the server, never the
    // root and never the purchase screen.
    for (const memory of [
      null,
      { accountId: "amp|someone-else", savedAt: Date.now() },
      { accountId: "", savedAt: Date.now() - 4 * 60 * 60 * 1000 },
    ]) {
      await page.evaluate(
        ({ memory, childPage, learnerId }) => {
          const session = JSON.parse(
            sessionStorage.getItem("amp.continue.v1") ?? "{}",
          ) as { accountId?: string };
          if (!memory) sessionStorage.removeItem("amp.continue.v1");
          else
            sessionStorage.setItem(
              "amp.continue.v1",
              JSON.stringify({
                accountId: memory.accountId || session.accountId,
                learnerId,
                returnTo: `${childPage}?stale=1`,
                stage: "paying",
                savedAt: memory.savedAt,
              }),
            );
        },
        { memory, childPage, learnerId: child.id },
      );
      await page.goto(`${origin}/?billing=processing&purchase=${purchase}`);
      await page.waitForURL(
        (url) => url.pathname === childPage && !url.search.includes("stale"),
        { timeout: 30_000 },
      );
    }
    console.log(`${width}: with no usable memory, the paid child's page too`);
    await context.close();
  }
} finally {
  await pool.end();
  await browser.close();
}
console.log(
  "Continue with AMP returns to the child's page with access active.",
);
