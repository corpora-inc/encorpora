import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium as rawChromium, type Page } from "playwright";
import { secureChromium } from "../browser-security.mjs";
import { purchasePreview } from "./purchase-preview-fixture";
const fixture = process.env.AMP_PURCHASE_PREVIEW_ORIGIN
  ? null
  : await purchasePreview(4984);
const origin = process.env.AMP_PURCHASE_PREVIEW_ORIGIN ?? fixture!.origin;
const output =
  process.env.AMP_UI_ARTIFACTS ?? "/tmp/rebuild-funded-purchase/screens";
await mkdir(output, { recursive: true });
const browser = await secureChromium(rawChromium).launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
});
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
async function login(key: string) {
  await context.request.post(`${origin}/api/auth/sign-out`, {
    headers: { origin },
    data: {},
  });
  const r = await context.request.post(`${origin}/api/auth/sign-in/email`, {
    headers: { origin },
    data: {
      email: `${key}@purchase-preview.example`,
      password: "synthetic purchase preview passphrase",
    },
  });
  assert.equal(r.status(), 200);
  await page.goto(`${origin}/account/billing`);
  await page.getByRole("heading", { name: "Billing", exact: true }).waitFor();
}
async function shots(name: string) {
  for (const theme of ["light", "dark"] as const)
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme });
      await page.evaluate((theme) => {
        localStorage.setItem("amp-theme", theme);
        document.documentElement.setAttribute("data-theme", theme);
      }, theme);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(120);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `${name} ${width} overflow`,
      );
      if (
        [
          "invoice-form",
          "invoice-ready",
          "card-monthly",
          "billing-free",
          "billing-paid",
        ].includes(name)
      ) {
        assert.deepEqual(
          await page.evaluate(() =>
            [...document.querySelectorAll("main,section,article")]
              .filter(
                (e) =>
                  /auto|scroll/.test(getComputedStyle(e).overflowY) &&
                  e.scrollHeight > e.clientHeight + 2,
              )
              .map((e) => e.className),
          ),
          [],
          `${name} should scroll with the page`,
        );
      }
      await page.screenshot({
        path: `${output}/${name}-${width}-${theme}.png`,
        fullPage: true,
      });
    }
}
try {
  await login("returning");
  await shots("billing-free");
  await page.getByRole("link", { name: "Choose a plan", exact: true }).click();
  await page.getByRole("button", { name: "Continue to Stripe" }).waitFor();
  assert.equal(await page.getByRole("checkbox").count(), 0);
  await page.getByRole("radio", { name: /Monthly/ }).click();
  assert.equal(
    await page
      .getByRole("radio", { name: /Monthly/ })
      .getAttribute("aria-checked"),
    "true",
  );
  await shots("card-monthly");
  await page.getByRole("button", { name: "Continue to Stripe" }).click();
  await page.getByRole("heading", { name: "Test checkout" }).waitFor();
  let failedClaim = false;
  await page.route("**/api/v1/billing/enrollment/claim", async (route) => {
    if (!failedClaim) {
      failedClaim = true;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "billing_unavailable" }),
      });
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Complete test payment" }).click();
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page.waitForURL(`${origin}/account/billing`, { timeout: 30000 });
  await page.getByRole("button", { name: "Manage subscriptions" }).waitFor();
  await shots("billing-paid");
  await page
    .locator('section[aria-labelledby="receipts-title"] li button')
    .first()
    .click();
  await page
    .getByRole("button", { name: "Download receipt", exact: true })
    .waitFor();
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download receipt", exact: true })
    .click();
  const receipt = await downloaded;
  await receipt.saveAs(`${output}/receipt.pdf`);
  assert.equal(await receipt.failure(), null);
  await shots("receipt");
  await page.goto(`${origin}/account/privacy`);
  await page.getByRole("heading", { name: "Policies & documents" }).waitFor();
  const policyDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download terms of use" }).click();
  const policy = await policyDownload;
  await policy.saveAs(`${output}/terms.html`);
  assert.equal(await policy.failure(), null);
  await shots("privacy");
  await page.goto(`${origin}/account/security`);
  await page.getByText("Sample Parent", { exact: true }).waitFor();
  await shots("profile");
  await login("invoice");
  await page.goto(`${origin}/purchase/funded`);
  await page
    .getByLabel("Funding program")
    .selectOption({ label: "Arizona Empowerment Scholarship Account" });
  await page.getByRole("radio", { name: /Monthly/ }).click();
  await page.getByLabel("Student name on invoice").fill("Casey Example");
  await shots("invoice-form");
  let failedInvoiceClaim = false;
  await page.route("**/api/v1/funding/invoices/*/claim", async (route) => {
    if (!failedInvoiceClaim) {
      failedInvoiceClaim = true;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "funding_service_unavailable" }),
      });
    } else await route.continue();
  });
  await page
    .getByRole("button", { name: "Get invoice & start learning" })
    .click();
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page.getByRole("heading", { name: "You’re ready to start" }).waitFor();
  const invoiceDownload = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download invoice PDF" }).click();
  const invoice = await invoiceDownload;
  await invoice.saveAs(`${output}/invoice.pdf`);
  assert.equal(await invoice.failure(), null);
  await shots("invoice-ready");
  await page.goto(`${origin}/account/billing`);
  await page.getByRole("button", { name: "I’ve submitted it" }).first().click();
  await page
    .getByText(/Submitted · waiting for your program/)
    .first()
    .waitFor();
  await shots("invoice-submitted");
  assert.deepEqual(errors, []);
  console.log(
    "PASS: monthly payment to same learner, receipt PDF, policy download, invoice PDF with instant access, submission, 8 viewport/theme combinations.",
  );
} finally {
  await browser.close();
  await fixture?.close();
}
