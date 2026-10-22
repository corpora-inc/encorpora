import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { createServer } from "vite";
import {
  presentOffer,
  presentRequest,
  type FundingRequest,
} from "../src/funding-purchase/contracts.js";
import { testFundingOffer } from "../tests/funding-purchase.fixture.js";
import { renderFundingQuotePdf } from "../src/funding-purchase/quote-pdf.js";
const directory = new URL("../artifacts/invoice-review/", import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(
  new URL("index.html", directory),
  '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invoice verification</title><div id="root"></div><script type="module" src="./entry.tsx"></script></html>',
);
await writeFile(
  new URL("entry.tsx", directory),
  `import React from 'react';import{createRoot}from'react-dom/client';import{FundingPurchaseCenter}from'../../src/web/FundingPurchaseCenter';import'../../src/web/app/styles';const root=createRoot(document.getElementById('root')!);(window as any).renderInvoice=(identity='synthetic-parent')=>root.render(<FundingPurchaseCenter identity={identity} token='synthetic-token' consentActive learners={[{id:'synthetic-learner',name:'Sample learner'}]} onClose={()=>{}}/>);(window as any).renderInvoice();`,
);
const offer = {
  ...testFundingOffer,
  documentPolicy: "named-student-invoice" as const,
};
const vite = await createServer({
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  server: { host: "127.0.0.1", port: 0 },
});
await vite.listen();
const address = vite.httpServer!.address();
assert.ok(address && typeof address !== "string");
const browser = await chromium.launch();
try {
  for (const width of [320, 390, 768, 1280])
    for (const theme of ["light", "dark"] as const) {
      const page = await browser.newPage({
        viewport: { width, height: 844 },
        colorScheme: theme,
      });
      const messages: string[] = [];
      page.on("console", (m) => messages.push(m.text()));
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      let record: FundingRequest | undefined;
      const payloads: Record<string, any>[] = [];
      let fail = true;
      await page.route("**/api/v1/funding/**", async (route) => {
        const request = route.request(),
          path = new URL(request.url()).pathname;
        if (path.endsWith("/offers"))
          return route.fulfill({ json: { offers: [presentOffer(offer)] } });
        if (path.endsWith("/invoice"))
          return route.fulfill({
            contentType: "application/pdf",
            body: Buffer.from(await renderFundingQuotePdf(record!)),
          });
        if (request.method() === "POST") {
          const body = request.postDataJSON();
          payloads.push(body);
          await new Promise((resolve) => setTimeout(resolve, 180));
          if (fail) {
            fail = false;
            return route.fulfill({
              status: 503,
              json: { error: "funding_service_unavailable" },
            });
          }
          record = {
            id: "68444bca-7568-4a3f-ae47-78743116b563",
            accountId: "synthetic-parent",
            learnerId: body.learnerId,
            idempotencyKey: body.idempotencyKey,
            createdAt: new Date().toISOString(),
            expiresAt: "2099-01-01T00:00:00.000Z",
            status: "prepared",
            offer,
            orderId: null,
            studentBillingName: body.studentBillingName,
          };
          return route.fulfill({ json: presentRequest(record) });
        }
        return route.fulfill({
          json: { requests: record ? [presentRequest(record)] : [] },
        });
      });
      await page.goto(
        `http://127.0.0.1:${address.port}/artifacts/invoice-review/index.html`,
      );
      await page.evaluate((theme) => {
        document.documentElement.dataset.theme = theme;
      }, theme);
      const name = page.getByRole("textbox", {
        name: "Student name on invoice",
      });
      const prepare = page.getByRole("button", {
        name: "Prepare unpaid invoice",
        exact: true,
      });
      await name.waitFor();
      await page.evaluate(() => document.fonts.ready);
      assert.ok(await prepare.isDisabled());
      await name.fill("Zoë García");
      const before = await page.locator(".funding-footer").boundingBox();
      const fieldBefore = await name.boundingBox();
      await page.screenshot({
        path: new URL(`form-${width}-${theme}.png`, directory).pathname,
      });
      await prepare.click();
      await page.getByRole("button", { name: "Preparing…" }).waitFor();
      assert.deepEqual(
        await page.locator(".funding-footer").boundingBox(),
        before,
      );
      await page.getByRole("alert").waitFor();
      assert.deepEqual(
        await page.locator(".funding-footer").boundingBox(),
        before,
      );
      assert.deepEqual(await name.boundingBox(), fieldBefore);
      await page.screenshot({
        path: new URL(`error-${width}-${theme}.png`, directory).pathname,
      });
      await page.getByRole("button", { name: "Dismiss message" }).click();
      await prepare.click();
      const download = page.getByRole("button", {
        name: "Download unpaid PDF invoice",
      });
      await download.waitFor();
      assert.equal(payloads.length, 2);
      assert.equal(payloads[0]!.idempotencyKey, payloads[1]!.idempotencyKey);
      assert.equal(payloads[1]!.studentBillingName, "Zoë García");
      assert.equal(payloads[1]!.subtotalMinor, undefined);
      assert.equal(record!.orderId, null);
      await page
        .getByText("Student on invoice: Zoë García", { exact: true })
        .waitFor();
      const event = page.waitForEvent("download");
      await download.click();
      assert.match(
        (await event).suggestedFilename(),
        /^education-invoice-.*\.pdf$/,
      );
      await page.screenshot({
        path: new URL(`prepared-${width}-${theme}.png`, directory).pathname,
      });
      const geometry = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        viewport: innerWidth,
        footer: document
          .querySelector(".funding-footer")!
          .getBoundingClientRect().bottom,
        height: innerHeight,
      }));
      assert.ok(
        geometry.width <= geometry.viewport + 1,
        JSON.stringify(geometry),
      );
      assert.ok(
        geometry.footer <= geometry.height + 1,
        JSON.stringify(geometry),
      );
      const storage = await page.evaluate(() =>
        JSON.stringify([localStorage, sessionStorage]),
      );
      assert.ok(!storage.includes("García"));
      assert.ok(!messages.join("\n").includes("García"));
      record = undefined;
      await page.evaluate(() =>
        (window as any).renderInvoice("different-parent"),
      );
      await name.waitFor();
      assert.equal(await name.inputValue(), "");
      assert.deepEqual(errors, []);
      await page.close();
    }
  console.log(
    "PASS: invoice entry/download at 320/390/768/1280 light/dark; no footer/field movement on loading or errors; retry identity, name privacy and account reset.",
  );
} finally {
  await browser.close();
  await vite.close();
}
