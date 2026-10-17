import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { createServer } from "vite";
import {
  presentOffer,
  presentRequest,
  type FundingRequest,
} from "../src/funding-purchase/contracts.js";
import { testFundingOffer as offer } from "../tests/funding-purchase.fixture.js";
import { renderFundingQuotePdf } from "../src/funding-purchase/quote-pdf.js";
const directory = new URL("../artifacts/funding-review/", import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(
  new URL("index.html", directory),
  '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="./entry.tsx"></script></html>',
);
await writeFile(
  new URL("entry.tsx", directory),
  `import React from 'react';import{createRoot}from'react-dom/client';import{FundingPurchaseCenter}from'../../src/web/FundingPurchaseCenter';import'../../src/web/style.css';const root=createRoot(document.getElementById('root')!);const learners=[{id:'10720fef-40bf-4e75-8982-208b5e05f84a',name:'Sample learner'}];(window as any).fundingRender=(identity='parent-a',token='token-a',consentActive=true)=>root.render(<FundingPurchaseCenter identity={identity} token={token} consentActive={consentActive} learners={learners} onClose={()=>{}}/>);(window as any).fundingRender();`,
);
const vite = await createServer({
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  server: { host: "127.0.0.1", port: 4326, strictPort: true },
});
await vite.listen();
const browser = await chromium.launch();
try {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    const page = await browser.newPage({ viewport });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let record: FundingRequest | undefined;
    let creates = 0;
    let offerWithdrawn = false,
      failRead = false;
    let holdCreate = false;
    let heldResolve!: () => void, releaseResolve!: () => void;
    let held = Promise.resolve(),
      release = Promise.resolve();
    await page.route("**/api/v1/funding/**", async (route) => {
      const request = route.request(),
        path = new URL(request.url()).pathname;
      if (path.endsWith("/offers"))
        return route.fulfill({
          json: { offers: offerWithdrawn ? [] : [presentOffer(offer)] },
        });
      if (path.endsWith("/quote"))
        return route.fulfill({
          contentType: "application/pdf",
          body: Buffer.from(await renderFundingQuotePdf(record!)),
        });
      if (path.endsWith("/status")) {
        record = { ...record!, status: request.postDataJSON().status };
        return route.fulfill({ json: presentRequest(record) });
      }
      if (path.endsWith("/requests") && request.method() === "POST") {
        creates++;
        const body = request.postDataJSON();
        assert.equal(body.learnerId, "10720fef-40bf-4e75-8982-208b5e05f84a");
        assert.equal(body.subtotalMinor, undefined);
        record = {
          id: "68444bca-7568-4a3f-ae47-78743116b563",
          accountId: "parent-a",
          learnerId: body.learnerId,
          idempotencyKey: body.idempotencyKey,
          createdAt: new Date().toISOString(),
          expiresAt: "2099-01-01T00:00:00.000Z",
          status: "prepared",
          offer,
          orderId: null,
        };
        const snapshot = presentRequest(record);
        if (holdCreate) {
          holdCreate = false;
          heldResolve();
          await release;
        }
        return route.fulfill({ json: snapshot }).catch(() => {});
      }
      if (failRead) {
        failRead = false;
        return route.fulfill({
          status: 503,
          json: { error: "funding_service_unavailable" },
        });
      }
      return route.fulfill({
        json: {
          requests: record
            ? [{ ...presentRequest(record), offerAvailable: !offerWithdrawn }]
            : [],
        },
      });
    });
    await page.goto(
      "http://127.0.0.1:4326/artifacts/funding-review/index.html",
    );
    await page.getByRole("button", { name: "Prepare unpaid quote" }).waitFor();
    await page.screenshot({
      path: new URL(`offer-${viewport.width}.png`, directory).pathname,
    });
    await page.getByRole("button", { name: "Prepare unpaid quote" }).click();
    await page
      .getByRole("button", { name: "Download unpaid PDF quote" })
      .waitFor();
    assert.equal(creates, 1);
    await page.screenshot({
      path: new URL(`prepared-${viewport.width}.png`, directory).pathname,
    });
    await page.evaluate(() =>
      (window as any).fundingRender("parent-a", "renewed-token"),
    );
    await page
      .getByRole("button", { name: "Download unpaid PDF quote" })
      .waitFor();
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download unpaid PDF quote" })
      .click();
    assert.match((await download).suggestedFilename(), /\.pdf$/);
    await page
      .getByRole("button", { name: "I submitted the program request" })
      .click();
    await page.locator(".funding-footer-status").waitFor();
    await page.locator(".funding-body").evaluate((el) => {
      el.scrollTop = 0;
    });
    assert.equal(record?.orderId, null);
    const geometry = await page.evaluate(() => ({
      viewport: innerWidth,
      width: document.documentElement.scrollWidth,
      height: innerHeight,
      footer: document.querySelector(".funding-footer")!.getBoundingClientRect()
        .bottom,
      body: document.querySelector(".funding-body")!.getBoundingClientRect()
        .height,
    }));
    assert.ok(
      geometry.width <= geometry.viewport + 1,
      JSON.stringify(geometry),
    );
    assert.ok(geometry.footer <= geometry.height + 1, JSON.stringify(geometry));
    assert.ok(geometry.body >= 100, JSON.stringify(geometry));
    await page.screenshot({
      path: new URL(`request-${viewport.width}.png`, directory).pathname,
    });
    offerWithdrawn = true;
    await page.getByRole("button", { name: "Refresh status" }).click();
    await page
      .getByText("Offer no longer available", { exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Download unpaid PDF quote" })
        .count(),
      0,
    );
    await page.screenshot({
      path: new URL(`withdrawn-${viewport.width}.png`, directory).pathname,
    });
    offerWithdrawn = false;
    record!.expiresAt = "2020-01-01T00:00:00.000Z";
    await page.getByRole("button", { name: "Refresh status" }).click();
    await page.getByText("Quote expired", { exact: true }).waitFor();
    await page.screenshot({
      path: new URL(`expired-${viewport.width}.png`, directory).pathname,
    });
    failRead = true;
    await page.getByRole("button", { name: "Refresh status" }).click();
    await page.getByRole("alert").waitFor();
    await page.screenshot({
      path: new URL(`error-${viewport.width}.png`, directory).pathname,
    });
    record = undefined;
    await page.evaluate(() =>
      (window as any).fundingRender("parent-b", "token-b", false),
    );
    await page.getByRole("button", { name: "Prepare unpaid quote" }).waitFor();
    assert.ok(
      await page
        .getByRole("button", { name: "Prepare unpaid quote" })
        .isDisabled(),
    );
    // A prior account's delayed mutation must not select its request in the new account.
    await page.evaluate(() =>
      (window as any).fundingRender("parent-a", "token-a", true),
    );
    await page.getByRole("button", { name: "Prepare unpaid quote" }).waitFor();
    held = new Promise<void>((resolve) => {
      heldResolve = resolve;
    });
    release = new Promise<void>((resolve) => {
      releaseResolve = resolve;
    });
    holdCreate = true;
    await page.getByRole("button", { name: "Prepare unpaid quote" }).click();
    await held;
    record = undefined;
    await page.evaluate(() =>
      (window as any).fundingRender("parent-c", "token-c", true),
    );
    await page.getByRole("button", { name: "Prepare unpaid quote" }).waitFor();
    releaseResolve();
    await page.waitForTimeout(100);
    assert.equal(
      await page
        .getByRole("button", { name: "Download unpaid PDF quote" })
        .count(),
      0,
    );
    assert.equal(
      await page.locator("#funding-learner").inputValue(),
      "10720fef-40bf-4e75-8982-208b5e05f84a",
    );
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log(
    "Funding parent workflow passed at 320, 390 and 844px, including PDF download, renewable token, consent gate and no false activation.",
  );
} finally {
  await browser.close();
  await vite.close();
}
