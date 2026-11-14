/** Synthetic end-to-end funded purchase: real API/database and browser; no
 * external mail, payments or production state. */
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { Pool } from "pg";
import { chromium as rawChromium, type Page } from "playwright";
import { createServer } from "vite";
import { secureChromium } from "../browser-security.mjs";
import { buildApp } from "../src/server/app";
import { PostgresRepository } from "../src/server/repository";
import {
  accountsAuth,
  accountsConfiguration,
  createAccounts,
  registerAccountRoutes,
} from "../src/server/accounts";
import { refuseStudentTokens } from "../src/server/auth";
import { registerFamilyRoutes } from "../src/family/routes";
import { registerParentFollowupRoutes } from "../src/parent-followup/routes";
import { registerFundingPurchaseRoutes } from "../src/funding-purchase/routes";
import { registerConsentRoutes } from "../src/parent-consent/routes";
import { ConsentRepository } from "../src/parent-consent/repository";
import { ConsentSecrets } from "../src/parent-consent/crypto";
import { installConsentPolicy } from "../src/parent-consent/policy";
import { consentFixture } from "../tests/parent-consent.fixture";
import { testFundingOffer } from "../tests/funding-purchase.fixture";
import { deliverFundingInvoiceMail } from "../src/funding-purchase/invoice-mail";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";
import { settleArrival } from "./ui-settle";

const port = Number(process.env.AMP_INVOICE_JOURNEY_PORT ?? 4860);
const origin = `http://127.0.0.1:${port}`;
const shots =
  process.env.AMP_UI_ARTIFACTS ?? "artifacts/funded-invoice-journey";
await mkdir(shots, { recursive: true });
const url = process.env.AMP_TEST_DATABASE_URL;
assert.ok(url, "AMP_TEST_DATABASE_URL required");
assertTestDatabaseTarget(url);
const schema = `amp_invoice_ui_${randomUUID().replaceAll("-", "")}`;
const admin = new Pool({ connectionString: url, max: 1 });
await admin.query(`CREATE SCHEMA ${schema}`);
const scoped = new URL(url);
scoped.searchParams.set("options", `-c search_path=${schema}`);
await migrate(scoped.href);
const repository = new PostgresRepository(scoped.href);
const db = repository.pool;
const accounts = await createAccounts(
  db,
  accountsConfiguration({
    AMP_ACCOUNTS_URL: origin,
    AMP_ACCOUNTS_SECRET: randomBytes(32).toString("hex"),
    NODE_ENV: "development",
    AMP_PARENT_FOLLOWUP: "enabled",
  } as NodeJS.ProcessEnv),
);
const authenticate = refuseStudentTokens(accountsAuth(accounts));
const policy = {
  ...consentFixture,
  review: { ...consentFixture.review, paymentNotificationsReviewed: true },
  notice: {
    ...consentFixture.notice,
    processors: [
      ...consentFixture.notice.processors,
      {
        name: "Resend",
        service: "Email",
        data: "Invoice",
        purpose: "Requested delivery",
        retention: "Limited",
      },
    ],
  },
};
await installConsentPolicy(db, policy);
const offer = {
  ...testFundingOffer,
  programName: "Arizona ESA",
  productTitle: "AMP Mathematics",
  documentPolicy: "named-student-invoice" as const,
  route: "direct-pay" as const,
  activationPolicy: "after-settlement" as const,
  creditAgreementReference: undefined,
  instructions:
    "In ClassWallet choose Pay Vendor, select Corpora Inc and upload your invoice.",
  merchant: { ...testFundingOffer.merchant, legalName: "Corpora Inc" },
};
const app = buildApp({ repository, authenticate, publicUrl: origin });
await registerAccountRoutes(app, accounts, authenticate);
await registerFamilyRoutes(app, { pool: db, authenticate });
await registerParentFollowupRoutes(app, {
  pool: db,
  authenticate,
  origin,
  enabled: true,
});
await registerFundingPurchaseRoutes(app, {
  pool: db,
  authenticate,
  offers: [offer],
});
await registerConsentRoutes(app, {
  authenticate,
  repository: new ConsentRepository(
    db,
    policy,
    new ConsentSecrets(randomBytes(32)),
    true,
  ),
});
await app.listen({ host: "127.0.0.1", port: port + 1 });
const vite = await createServer({
  cacheDir: "node_modules/.vite-invoice-journey",
  server: {
    host: "127.0.0.1",
    port,
    strictPort: true,
    proxy: { "/api": `http://127.0.0.1:${port + 1}` },
  },
});
await vite.listen();
const browser = await secureChromium(rawChromium).launch({
  args: ["--no-proxy-server"],
});
let last: Page | undefined;
async function shot(page: Page, label: string) {
  await settleArrival(page);
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    `${label}: no overflow`,
  );
  await page.screenshot({ path: `${shots}/${label}.png`, fullPage: true });
}
const results: string[] = [];
try {
  for (const theme of ["light", "dark"] as const)
    for (const width of [320, 390, 768, 1280]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        colorScheme: theme,
      });
      const page = await context.newPage();
      last = page;
      page.setDefaultTimeout(30000);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      // Public pitch media/catalog are incidental to this journey. All invoice,
      // auth, learner and practice endpoints use the real local services.
      await page.goto(`${origin}/?program=az-esa`);
      const buy = page.locator('a[href*="/invoice/arizona-esa"]').first();
      await buy.waitFor();
      await buy.click();
      await page.getByRole("button", { name: "Create invoice PDF" }).waitFor();
      const steps = page.getByRole("list", { name: "How it works" });
      assert.ok(
        (await steps.boundingBox())!.y <
          (await page.getByLabel(/Email for/).boundingBox())!.y,
      );
      const email = `invoice-${randomUUID()}@example.test`;
      await page.getByLabel(/Email for/).fill(email);
      await page
        .getByLabel("Student name for the invoice")
        .fill("Sample Learner");
      await shot(page, `invoice-${width}-${theme}`);
      // Force one transient failure: the error stays in the reserved feedback
      // slot and the retry reuses its invoice key.
      let failed = false;
      await page.route("**/api/v1/funding/invoices", async (route) => {
        if (route.request().method() === "POST" && !failed) {
          failed = true;
          await route.fulfill({
            status: 503,
            json: { error: "funding_service_unavailable" },
          });
        } else await route.continue();
      });
      const submit = page.getByRole("button", { name: "Create invoice PDF" });
      const before = await submit.evaluate(
        (el) => el.getBoundingClientRect().top + scrollY,
      );
      await submit.click();
      await page.getByRole("alert").filter({ hasText: /.+/ }).first().waitFor();
      assert.ok(
        Math.abs(
          (await submit.evaluate(
            (el) => el.getBoundingClientRect().top + scrollY,
          )) - before,
        ) <= 1,
        "error does not move submit",
      );
      await shot(page, `error-${width}-${theme}`);
      await submit.click();
      await page
        .getByRole("heading", { name: "Your invoice is ready" })
        .waitFor();
      await shot(page, `ready-${width}-${theme}`);
      const invoice = (
        await db.query(
          "SELECT id FROM amp_funding_invoice_intents WHERE parent_email=$1",
          [email],
        )
      ).rows[0];
      assert.ok(invoice);
      let mailed = 0;
      await deliverFundingInvoiceMail(
        db,
        {
          binding: {
            provider: "fixture",
            sender: "sender@example.test",
            credentialFingerprint: "fixture",
          },
          async send(mail) {
            assert.equal(mail.recipient, email);
            assert.ok(mail.attachments?.[0]?.content);
            mailed++;
            return { kind: "accepted", receipt: randomUUID() };
          },
        },
        policy,
      );
      assert.equal(mailed, 1);
      if (width === 390 || width === 1280) {
        await page
          .getByRole("link", { name: "Set up learner and start" })
          .click();
        const fallback = page.getByRole("button", {
          name: "Use a password instead",
        });
        const password = page.getByLabel("Password", { exact: true });
        await Promise.race([fallback.waitFor(), password.waitFor()]);
        if (await fallback.isVisible()) await fallback.click();
        await page.getByLabel("Email", { exact: true }).fill(email);
        await password.fill("synthetic invoice journey passphrase");
        await page.getByRole("button", { name: "Create account" }).click();
        await page.waitForURL(/\/start\/verify-email|\/purchase\//);
        const session = await (
          await context.request.get(`${origin}/api/auth/get-session`)
        ).json();
        assert.ok(session.user?.id);
        // Simulate only the external email confirmation. No consent or learner
        // record is seeded: the parent completes the real restricted first run.
        await db.query(
          'UPDATE amp_auth_users SET "emailVerified"=true WHERE id=$1',
          [session.user.id],
        );
        await page.goto(`${origin}/purchase/arizona-esa`);
        await page.getByRole("link", { name: "For my child" }).click();
        await page.getByLabel("Learner name").fill("Sample Learner");
        await page
          .getByRole("button", { name: "Continue", exact: true })
          .click();
        await shot(page, `birth-year-${width}-${theme}`);
        await page
          .getByRole("button", {
            name: String(new Date().getFullYear() - 9),
            exact: true,
          })
          .click();
        await page.getByRole("button", { name: "Use this invoice" }).click();
        await page.waitForURL(/\/practice/);
        await page.locator("[data-problem-id]").first().waitFor();
        await shot(page, `practice-${width}-${theme}`);
        const grant = (
          await db.query(
            "SELECT g.* FROM amp_access_gifts a JOIN amp_grants g ON g.id=a.grant_id WHERE a.funding_invoice_id=$1",
            [invoice.id],
          )
        ).rows[0];
        assert.equal(grant.status, "active");
        assert.ok(grant.id.startsWith("funded-pending:"));
        assert.equal(
          (
            await db.query(
              "SELECT count(*)::int n FROM amp_parent_consents WHERE account_id=$1",
              [`amp|${session.user.id}`],
            )
          ).rows[0].n,
          0,
        );
        await page.reload();
        await page.locator("[data-problem-id]").first().waitFor();
      }
      assert.deepEqual(errors, []);
      results.push(`${width} ${theme}: passed`);
      await context.close();
    }
  await writeFile(`${shots}/results.json`, JSON.stringify(results, null, 2));
  console.log(results.join("\n"));
} catch (error) {
  console.error(`Journey stopped at ${last?.url()}`);
  await last
    ?.screenshot({ path: `${shots}/failure.png`, fullPage: true })
    .catch(() => {});
  throw error;
} finally {
  await browser.close();
  await vite.close();
  await app.close();
  await db.end();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
