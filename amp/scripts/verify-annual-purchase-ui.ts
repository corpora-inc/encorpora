import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { createServer } from "vite";
import { retentionNotice } from "../src/family/contracts.js";
import { annualOffer } from "../src/billing/stripe/purchase.js";
import { config } from "../tests/stripe-fixtures.js";
const directory = new URL("../artifacts/annual-review/", import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(
  new URL("index.html", directory),
  '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Annual purchase verification</title><div id="root" style="height:100dvh"></div><script type="module" src="./entry.tsx"></script></html>',
);
await writeFile(
  new URL("entry.tsx", directory),
  `import React from 'react';import {createRoot} from 'react-dom/client';import {AnnualPurchase} from '../../src/web/AnnualPurchase';import '../../src/web/style.css';const root=createRoot(document.getElementById('root'));const harness={events:[] as string[],render(identity:string){root.render(<React.StrictMode><AnnualPurchase token={identity} identity={identity} returnState="processing" onClose={()=>root.render(<p>Family screen</p>)} onAccessChanged={()=>harness.events.push(identity)}/></React.StrictMode>);},unmount(){root.render(<p>Other screen</p>)}};(window as any).annualHarness=harness;harness.render('parent');`,
);
const vite = await createServer({
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  server: { host: "127.0.0.1", port: 4380, strictPort: true },
});
await vite.listen();
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(10_000);
  const failures: string[] = [];
  page.on("pageerror", (error) => {
    failures.push(error.message);
    console.error(error.message);
  });
  let offerFailure = false;
  let available = true,
    phase = "ready",
    failCheckout = false,
    expireCheckout = false,
    holdCheckout = false;
  let release!: () => void, entered!: () => void;
  let held = Promise.resolve();
  let checkoutBodies: {
    learnerId: string;
    requestId: string;
    offerId: string;
  }[] = [];
  const family = {
    consent: {
      status: "active",
      policyVersion: "fixture",
      recordedAt: "2026-01-01",
      withdrawnAt: null,
    },
    learners: [
      {
        id: "child",
        name: "Sample learner",
        deletedAt: null,
        access: [],
        stripeLinked: true,
      },
      {
        id: "second",
        name: "Second learner",
        deletedAt: null,
        access: [],
        stripeLinked: false,
      },
    ],
    retained: retentionNotice,
  };
  await page.route("**/api/v1/family", (route) =>
    route.fulfill({ json: family }),
  );
  await page.route("**/api/v1/billing/offer", (route) =>
    route.fulfill(
      offerFailure
        ? { status: 503, json: { error: "billing_unavailable" } }
        : {
            json: available
              ? { available: true, offer: annualOffer(config) }
              : { available: false },
          },
    ),
  );
  await page.route("**/api/v1/billing/portal", (route) =>
    route.fulfill({
      json: { url: "https://checkout.stripe.com/wrong-portal-destination" },
    }),
  );
  await page.route("**/api/v1/billing/status/*", (route) =>
    route.fulfill({
      json: {
        learnerId: route.request().url().split("/").at(-1),
        phase,
        ...(phase === "licensed"
          ? { startsAt: "2026-01-01T00:00:00Z", endsAt: "2027-01-01T00:00:00Z" }
          : {}),
      },
    }),
  );
  await page.route("**/api/v1/billing/checkout", async (route) => {
    checkoutBodies.push(route.request().postDataJSON());
    if (holdCheckout) {
      entered();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    }
    if (expireCheckout) {
      expireCheckout = false;
      return route.fulfill({
        status: 409,
        json: { error: "checkout_expired_retry_with_new_request" },
      });
    }
    if (failCheckout)
      return route.fulfill({
        status: 503,
        json: { error: "billing_unavailable" },
      });
    return route.fulfill({
      json: { url: "https://checkout.stripe.com/fixture" },
    });
  });
  await page.route("https://checkout.stripe.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<p>Sandbox hosted checkout fixture</p>",
    }),
  );
  const home = "http://127.0.0.1:4380/artifacts/annual-review/index.html";
  await page.goto(home);
  await page.getByRole("button", { name: "Open sandbox checkout" }).waitFor();
  assert.equal(await page.getByText("$120.00", { exact: false }).count(), 1);
  assert.equal(await page.getByText("Sandbox · no real payment").count(), 1);
  await page.screenshot({
    path: new URL("annual-390.png", directory).pathname,
    fullPage: true,
  });
  for (const size of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(size);
    for (const control of [
      page.getByLabel("Learner", { exact: true }),
      page.getByRole("button", { name: "Open sandbox checkout" }),
    ]) {
      const rect = await control.boundingBox();
      assert.ok(
        rect &&
          rect.y >= 0 &&
          rect.y + rect.height <= size.height &&
          rect.x >= 0 &&
          rect.x + rect.width <= size.width,
        "learner and primary action visible without scrolling",
      );
    }
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: new URL(`annual-debug-${size.width}.png`, directory).pathname,
    });
    if (size.width !== 844)
      assert.ok(
        await page
          .locator(".annual-body")
          .evaluate(
            (element) => element.scrollHeight <= element.clientHeight + 1,
          ),
        "ordinary phone purchase fits without scrolling",
      );
    await page.screenshot({
      path: new URL(`annual-ready-${size.width}.png`, directory).pathname,
    });
  }
  await page.getByRole("button", { name: "Terms & details" }).click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  assert.equal(
    await page.evaluate(() => document.activeElement?.textContent),
    "Terms & details",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  failCheckout = true;
  await page.getByRole("button", { name: "Open sandbox checkout" }).click();
  await page.getByRole("alert").waitFor();
  await page.getByRole("button", { name: "Open sandbox checkout" }).click();
  await page.getByRole("alert").waitFor();
  assert.equal(
    checkoutBodies[0]!.requestId,
    checkoutBodies[1]!.requestId,
    "network failure preserves idempotency request",
  );
  failCheckout = false;
  expireCheckout = true;
  await page.getByRole("button", { name: "Open sandbox checkout" }).click();
  await page.waitForURL("https://checkout.stripe.com/fixture");
  assert.equal(checkoutBodies.length, 4);
  assert.notEqual(checkoutBodies[2]!.requestId, checkoutBodies[3]!.requestId);
  assert.ok(
    checkoutBodies.every(
      (body) =>
        body.learnerId === "child" && body.offerId === annualOffer(config).id,
    ),
  );
  phase = "payment-processing";
  await page.goto(home);
  await page
    .getByText("Access is waiting for verified payment.", { exact: false })
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Open sandbox checkout" }).count(),
    0,
  );
  for (const size of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    const rect = await page
      .getByRole("button", { name: "Check access" })
      .boundingBox();
    assert.ok(rect && rect.y >= 0 && rect.y + rect.height <= size.height);
    assert.ok(
      await page
        .locator(".annual-body")
        .evaluate(
          (element) => element.scrollHeight <= element.clientHeight + 1,
        ),
    );
    await page.screenshot({
      path: new URL(`annual-processing-${size.width}.png`, directory).pathname,
    });
  }

  assert.deepEqual(
    await page.evaluate(() => (window as any).annualHarness.events),
    [],
  );
  phase = "licensed";
  await page.getByRole("button", { name: "Check access" }).click();
  await page.getByText("Access is active.", { exact: true }).waitFor();
  assert.deepEqual(
    await page.evaluate(() => (window as any).annualHarness.events),
    ["parent"],
  );
  phase = "ready";
  await page.goto(home);
  await page.getByRole("button", { name: "Open sandbox checkout" }).waitFor();
  holdCheckout = true;
  held = new Promise<void>((resolve) => {
    entered = resolve;
  });
  await page.getByRole("button", { name: "Open sandbox checkout" }).click();
  await held;
  await page.evaluate(() =>
    (window as any).annualHarness.render("different-parent"),
  );
  await page.getByRole("button", { name: "Open sandbox checkout" }).waitFor();
  release();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  assert.equal(
    page.url(),
    home,
    "obsolete checkout response cannot redirect a new parent",
  );
  held = new Promise<void>((resolve) => {
    entered = resolve;
  });
  await page.getByRole("button", { name: "Open sandbox checkout" }).click();
  await held;
  await page.evaluate(() => (window as any).annualHarness.unmount());
  await page.getByText("Other screen").waitFor();
  release();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  assert.equal(page.url(), home, "unmounted purchase cannot redirect");
  holdCheckout = false;
  available = false;
  await page.goto(home);
  await page.getByText("Purchases are not available here").waitFor();
  assert.equal(
    await page.getByRole("button", { name: /checkout/i }).count(),
    0,
  );
  offerFailure = true;
  await page.goto(home);
  await page.getByRole("button", { name: "Manage billing" }).click();
  await page
    .getByText("The payment destination could not be verified. Try again.")
    .waitFor();
  assert.equal(
    page.url(),
    home,
    "checkout host cannot substitute for billing portal",
  );
  assert.deepEqual(failures, []);
  console.log(
    "Annual purchase browser: exact sandbox disclosure, phone bounds, retry identity, expired recovery, pending grant, account-switch redirect suppression and disabled mode passed.",
  );
} finally {
  await browser.close();
  await vite.close();
}
