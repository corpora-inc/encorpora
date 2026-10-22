import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { createServer } from "vite";
import { presentOffer } from "../src/funding-purchase/contracts.js";
import { testFundingOffer } from "../tests/funding-purchase.fixture.js";
const port = 4407,
  origin = `http://127.0.0.1:${port}`;
const vite = await createServer({
  server: { host: "127.0.0.1", port, strictPort: true },
  cacheDir: "node_modules/.vite-invoice-form",
});
await vite.listen();
const browser = await chromium.launch({ args: ["--no-proxy-server"] });
await mkdir("artifacts/invoice-form", { recursive: true });
try {
  for (const colorScheme of ["light", "dark"] as const)
    for (const width of [320, 390, 768, 1280]) {
      const context = await browser.newContext({
        viewport: { width, height: 850 },
        colorScheme,
      });
      const page = await context.newPage();
      let posts = 0;
      let failure = true;
      let key = "";
      const offer = {
        ...testFundingOffer,
        programId: "ar-efa",
        programName: "Arkansas EFA",
        productTitle: "AMP Mathematics",
        documentPolicy: "named-student-invoice" as const,
        subtotalMinor: 49900,
      };
      await page.route("**/api/**", async (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path === "/api/v1/funding/invoice-offers")
          return route.fulfill({ json: { offers: [presentOffer(offer)] } });
        if (
          path === "/api/v1/funding/invoices" &&
          route.request().method() === "POST"
        ) {
          posts++;
          const body = route.request().postDataJSON();
          assert.equal(body.parentEmail, "parent@example.com");
          assert.equal(body.studentBillingName, "Sample Student");
          assert.equal(body.learnerId, undefined);
          if (key) assert.equal(body.idempotencyKey, key);
          key = body.idempotencyKey;
          if (failure) {
            failure = false;
            return route.fulfill({
              status: 503,
              json: { error: "funding_service_unavailable" },
            });
          }
          return route.fulfill({
            json: {
              invoiceId: "55ba16d8-a5b3-4316-977e-c47b591924cf",
              totalMinor: 49900,
              merchantName: "Corpora Inc",
              pdfBase64: Buffer.from("%PDF-test").toString("base64"),
              filename: "education-invoice.pdf",
              destinationUrl: "https://app.classwallet.com/",
              instructions:
                "Choose DirectPay, select Corpora Inc and attach the invoice.",
              expiresAt: "2026-11-22T00:00:00.000Z",
            },
          });
        }
        return route.fulfill({ json: {} });
      });
      await page.goto(`${origin}/invoice/arkansas-efa`);
      await page
        .getByLabel("Parent or guardian email")
        .fill("parent@example.com");
      await page
        .getByLabel("Student name for the invoice")
        .fill("Sample Student");
      await page.getByRole("button", { name: "Create invoice PDF" }).click();
      await page
        .getByRole("alert")
        .filter({ hasText: /try again/i })
        .waitFor();
      assert.equal(
        await page.getByLabel("Student name for the invoice").inputValue(),
        "Sample Student",
      );
      await page.getByRole("button", { name: "Create invoice PDF" }).click();
      await page
        .getByRole("heading", { name: "Your invoice is ready" })
        .waitFor();
      assert.equal(posts, 2);
      await page.getByRole("link", { name: "Download invoice PDF" }).waitFor();
      const download = page.waitForEvent("download");
      await page.getByRole("link", { name: "Download invoice PDF" }).click();
      assert.equal(
        (await download).suggestedFilename(),
        "education-invoice.pdf",
      );
      assert.equal(
        await page
          .getByRole("link", { name: "Continue to ClassWallet" })
          .getAttribute("rel"),
        "noopener noreferrer",
      );
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      assert.equal(new URL(page.url()).pathname, "/invoice/arkansas-efa");
      await page.screenshot({
        path: `artifacts/invoice-form/${width}-${colorScheme}.png`,
        fullPage: true,
      });
      await context.close();
    }
  console.log(
    "PASS: 8 invoice form viewports; guest PDF, failed retry retains fields/key, download, safe ClassWallet link, no overflow",
  );
} finally {
  await browser.close();
  await vite.close();
}
