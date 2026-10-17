import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, webkit } from "playwright";
import { createServer } from "vite";
import { consentFixture as policy } from "../tests/parent-consent.fixture.js";
import { noticeDigest } from "../src/parent-consent/crypto.js";
import type { ConsentView } from "../src/parent-consent/contracts.js";
const directory = new URL("../artifacts/consent-review/", import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(
  new URL("index.html", directory),
  '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Consent fixture review</title><div id="root" style="height:100dvh"></div><script type="module" src="./entry.tsx"></script></html>',
);
await writeFile(
  new URL("entry.tsx", directory),
  `import React from 'react';import{createRoot}from'react-dom/client';import{ParentConsentCenter}from'../../src/web/ParentConsentCenter';import'../../src/web/style.css';const root=createRoot(document.getElementById('root'));const harness={events:[] as string[],render(identity='parent',token='fixture',challenge=null,key='same'){root.render(<React.StrictMode><ParentConsentCenter key={key} identity={identity} token={token} challenge={challenge} onClose={()=>root.render(<p>Parent account</p>)} onChanged={()=>harness.events.push(identity)}/></React.StrictMode>);}};(window as any).consentHarness=harness;harness.render();`,
);
const vite = await createServer({
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  server: {
    host: "127.0.0.1",
    port: Number(process.env.AMP_CONSENT_UI_PORT ?? 4386),
    strictPort: true,
  },
});
await vite.listen();
const browser = await (
  process.env.AMP_BROWSER === "webkit" ? webkit : chromium
).launch();
try {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    const page = await browser.newPage({ viewport });
    page.setDefaultTimeout(10000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const initial: ConsentView = {
      consentActive: false,
      available: true,
      notice: policy.notice,
      noticeDigest: noticeDigest(policy),
      confirmationDelayHours: 24,
      request: null,
    };
    let view = structuredClone(initial),
      fail = false,
      hold = false;
    let entered!: () => void, release!: () => void;
    let held = Promise.resolve(),
      released = Promise.resolve();
    let writes = 0;
    await page.route("**/api/v1/**", async (route) => {
      const r = route.request(),
        path = new URL(r.url()).pathname;
      if (r.method() === "GET") {
        if (fail) {
          fail = false;
          return route.fulfill({ status: 503, json: { error: "unavailable" } });
        }
        return route.fulfill({
          json: r.headers().authorization === "Bearer other" ? initial : view,
        });
      }
      writes++;
      if (path.endsWith("/requests")) {
        const body = r.postDataJSON();
        assert.equal(body.parentAttestation, true);
        assert.equal(body.childName, undefined);
        view = {
          ...initial,
          request: {
            id: "11111111-1111-4111-8111-111111111111",
            phase: "awaiting-initial",
            createdAt: new Date().toISOString(),
            expiresAt: "2099-01-01T00:00:00.000Z",
            confirmationAfter: null,
            delivery: "accepted",
          },
        };
      }
      if (path.endsWith("/acknowledge"))
        view = {
          ...view,
          consentActive: r.postDataJSON().stage === "confirmation",
          request: {
            ...view.request!,
            phase:
              r.postDataJSON().stage === "initial"
                ? "awaiting-confirmation"
                : "active",
            confirmationAfter: "2099-01-01T00:00:00.000Z",
            delivery: "queued",
          },
        };
      if (path.endsWith("/withdraw"))
        view = {
          ...view,
          consentActive: false,
          request: { ...view.request!, phase: "withdrawn" },
        };
      const snapshot = structuredClone(view);
      if (hold) {
        hold = false;
        entered();
        await released;
      }
      return route.fulfill({ json: snapshot }).catch(() => {});
    });
    await page.goto(
      `http://127.0.0.1:${process.env.AMP_CONSENT_UI_PORT ?? 4386}/artifacts/consent-review/index.html`,
    );
    await page
      .getByRole("heading", { name: "Your permission comes first" })
      .waitFor();
    async function capture(name: string) {
      await page
        .locator(".parent-consent-body")
        .evaluate((e) => (e.scrollTop = 0));
      await page.screenshot({
        path: new URL(`${name}-${viewport.width}.png`, directory).pathname,
      });
      const result = await page.evaluate(() => {
        const b = document
          .querySelector(".parent-consent-center footer button")!
          .getBoundingClientRect();
        return {
          body: document.documentElement.scrollHeight,
          width: document.documentElement.scrollWidth,
          top: b.top,
          bottom: b.bottom,
          height: b.height,
        };
      });
      assert(result.body <= viewport.height + 1, `${name}: body scroll`);
      assert(result.width <= viewport.width + 1, `${name}: horizontal scroll`);
      assert(result.bottom <= viewport.height + 1 && result.top >= 0);
      assert(result.height >= 48);
    }
    await capture("start");
    await page.getByLabel("Parent email address").fill("parent@");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Email my privacy notice" }).click();
    assert.equal(writes, 0, "invalid email must not be posted");
    await page.getByLabel("Parent email address").fill("parent@example.com");
    await page.getByRole("checkbox").check();
    await page.evaluate(() => {
      (window as any).consentHarness.render("parent", "renewed");
    });
    assert.equal(
      await page.getByLabel("Parent email address").inputValue(),
      "parent@example.com",
    );
    await page.getByRole("button", { name: "Email my privacy notice" }).click();
    await page.getByRole("heading", { name: "Your privacy notice" }).waitFor();
    assert.equal(writes, 1);
    await capture("first-email");
    view.request!.delivery = "stopped-unknown";
    await page.getByRole("button", { name: "Refresh status" }).click();
    await page
      .getByRole("button", { name: "Withdraw this request", exact: true })
      .waitFor();
    await capture("delivery-stopped");
    await page
      .getByRole("button", { name: "Withdraw this request", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Email my privacy notice" })
      .waitFor();
    assert.equal(view.request!.phase, "withdrawn");
    view.request!.phase = "awaiting-initial";
    view.request!.delivery = "accepted";

    const challenge = {
      requestId: view.request!.id,
      stage: "initial",
      token: "a".repeat(43),
      noticeDigest: noticeDigest(policy),
    };
    await page.evaluate(
      (c) =>
        (window as any).consentHarness.render("parent", "renewed", c, "link1"),
      challenge,
    );
    await page.getByRole("heading", { name: "Review and respond" }).waitFor();
    await capture("first-response");
    await page
      .getByText("Read the complete privacy notice", { exact: true })
      .click();
    await page.evaluate(
      () => (document.documentElement.style.fontSize = "24px"),
    );
    await page
      .getByRole("link", { name: "Full privacy policy" })
      .scrollIntoViewIfNeeded();
    assert(
      await page.getByRole("link", { name: "Full privacy policy" }).isVisible(),
    );
    await page.evaluate(() => (document.documentElement.style.fontSize = ""));
    await page
      .getByText("Read the complete privacy notice", { exact: true })
      .click();
    const target = await page.locator(".consent-attestation").boundingBox();
    assert(target && target.height >= 44);

    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "Record my first response" })
      .click();
    await page
      .getByRole("heading", { name: "One more confirmation" })
      .waitFor();
    await capture("delay");
    await page.evaluate(
      (c) =>
        (window as any).consentHarness.render(
          "parent",
          "renewed",
          c,
          "consumed-initial",
        ),
      challenge,
    );
    await page
      .getByText(
        "Your first response is already recorded. Use the second confirmation email when it arrives.",
        { exact: true },
      )
      .waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Record my first response" })
        .count(),
      0,
    );

    await page.evaluate(
      (c) =>
        (window as any).consentHarness.render("parent", "renewed", c, "link2"),
      { ...challenge, stage: "confirmation" },
    );
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "Confirm learning consent" })
      .click();
    await page.getByRole("heading", { name: "Consent is active" }).waitFor();
    await capture("active");
    await page
      .getByText("Withdraw this consent or request", { exact: true })
      .click();
    await page
      .getByRole("button", { name: "Withdraw consent", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Your permission comes first" })
      .waitFor();
    await capture("withdrawn");
    view = { ...initial, available: false, notice: null, noticeDigest: null };
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.evaluate(() =>
      (window as any).consentHarness.render(
        "parent",
        "fixture",
        null,
        "disabled",
      ),
    );
    await page
      .getByRole("heading", { name: "Enrollment is unavailable" })
      .waitFor();
    await capture("disabled");
    view = structuredClone(initial);
    fail = true;
    await page.getByRole("button", { name: "Refresh status" }).click();
    await page.getByRole("alert").waitFor();
    await capture("error");
    await page.getByRole("button", { name: "Refresh status" }).click();
    await page.getByLabel("Parent email address").waitFor();
    hold = true;
    held = new Promise<void>((resolve) => (entered = resolve));
    released = new Promise<void>((resolve) => (release = resolve));
    await page.getByLabel("Parent email address").fill("parent@example.com");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Email my privacy notice" }).click();
    await held;
    await page.evaluate(() =>
      (window as any).consentHarness.render("other", "other", null, "disabled"),
    );
    await page
      .getByRole("heading", { name: "Your permission comes first" })
      .waitFor();
    release();
    await page.waitForTimeout(60);
    assert.equal(
      await page.getByLabel("Parent email address").inputValue(),
      "",
    );
    assert.equal(
      await page.getByRole("heading", { name: "Your privacy notice" }).count(),
      0,
    );
    assert.deepEqual(errors, []);
    await page.close();
    console.log(
      `Consent UI ${viewport.width}×${viewport.height}: stages, identity isolation and geometry passed`,
    );
  }
} finally {
  await browser.close();
  await vite.close();
}
