import { secureChromium } from "../browser-security.mjs";
import { fixtureMe } from "./me-fixture";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";
import { chromium as rawChromium, webkit } from "playwright";
const chromium = secureChromium(rawChromium);
import { createServer } from "vite";
import { consentFixture as policy } from "../tests/parent-consent.fixture.js";
import { noticeDigest } from "../src/parent-consent/crypto.js";
import type { ConsentView } from "../src/parent-consent/contracts.js";
import { retentionNotice } from "../src/family/contracts.js";
import { assertPhoneLandscapeSmoke, isPhoneLandscape } from "./ui-viewports";
const authPath = fileURLToPath(new URL("../src/web/auth.ts", import.meta.url));
const auth = `const listeners=new Set();let session={token:'fixture',accountId:'parent'};window.authFragment=location.hash;window.consentApp={emit(s){session=s;for(const f of listeners)f(s)}};export async function accessSession(){return session};export function onSessionChanged(f){listeners.add(f);return()=>listeners.delete(f)};export async function signIn(){};export function notifyAccountSessionChanged(){void accessSession().then(session=>window.consentApp.emit(session));}export async function authConfig(){return {mode:"oidc"};}export async function signOut(){window.consentApp.emit(null)}`;
const vite = await createServer({
  cacheDir: "node_modules/.vite-consent-app",
  root: fileURLToPath(new URL("../", import.meta.url)),
  configFile: fileURLToPath(new URL("../vite.config.ts", import.meta.url)),
  plugins: [
    {
      name: "consent-app-auth",
      enforce: "pre",
      load(id) {
        return id.split("?")[0] === authPath ? auth : undefined;
      },
    },
  ],
  server: { host: "127.0.0.1", port: 4387, strictPort: true },
});
await vite.listen();
const browser = await (
  process.env.AMP_BROWSER === "webkit" ? webkit : chromium
).launch();
const requestId = "11111111-1111-4111-8111-111111111111";
const fragment = `#consent=${requestId}&stage=initial&token=${"a".repeat(43)}&notice=${noticeDigest(policy)}`;
try {
  await mkdir("artifacts/consent-app", { recursive: true });
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [1024, 768],
    [844, 390],
  ]) {
    // Phone landscape only has to stay usable; the others must fit.
    const strict = !isPhoneLandscape([width, height]);
    const page = await browser.newPage({ viewport: { width, height } });
    page.setDefaultTimeout(10000);
    const faults: string[] = [];
    page.on("pageerror", (error) => faults.push(error.message));
    const emptyView: ConsentView = {
      available: false,
      consentActive: false,
      notice: null,
      noticeDigest: null,
      confirmationDelayHours: null,
      request: null,
    };
    let view = structuredClone(emptyView);
    let otherConsentReads = 0;
    let familyReads = 0;
    let held = false;
    let entered!: () => void, release!: () => void;
    let enteredPromise = Promise.resolve(),
      released = Promise.resolve();
    await page.route("**/api/v1/**", async (route) => {
      const req = route.request(),
        path = new URL(req.url()).pathname;
      if (path.endsWith("/catalog"))
        return route.fulfill({
          json: { templates: [], lessons: [], skills: [], mode: "fixture" },
        });
      if (path.endsWith("/me")) {
        assert.ok(
          ["Bearer fixture", "Bearer refreshed", "Bearer other"].includes(
            req.headers().authorization,
          ),
        );
        familyReads++;
        return route.fulfill({
          json: fixtureMe(
            {
              consent: {
                status: (req.headers().authorization === "Bearer other"
                  ? emptyView
                  : view
                ).consentActive
                  ? "active"
                  : "not-recorded",
                policyVersion: null,
                recordedAt: null,
                withdrawnAt: null,
              },
              learners: [],
              retained: retentionNotice,
            },
            req.headers().authorization === "Bearer other" ? "other" : "parent",
          ),
        });
      }
      if (path.endsWith("/books"))
        return route.fulfill({ json: { books: [] } });
      if (path.endsWith("/consent")) {
        const bearer = req.headers().authorization;
        assert.ok(
          ["Bearer fixture", "Bearer refreshed", "Bearer other"].includes(
            bearer,
          ),
        );
        if (bearer === "Bearer other") otherConsentReads++;
        return route.fulfill({
          json: bearer === "Bearer other" ? emptyView : view,
        });
      }
      if (path.endsWith("/billing/enrollment"))
        return route.fulfill({
          json: {
            available: false,
            notice: null,
            noticeDigest: null,
            purchase: null,
          },
        });
      if (path.endsWith("/acknowledge")) {
        const body = req.postDataJSON();
        assert.equal(body.requestId, requestId);
        assert.ok(["initial", "confirmation"].includes(body.stage));
        assert.equal(body.parentAttestation, true);
        const snapshot: ConsentView = {
          ...view,
          consentActive: body.stage === "confirmation",
          request: {
            ...view.request!,
            phase:
              body.stage === "confirmation"
                ? "active"
                : "awaiting-confirmation",
            confirmationAfter: "2099-01-01T00:00:00.000Z",
          },
        };
        if (held) {
          entered();
          await released;
        }
        if (!held) view = snapshot;
        return route.fulfill({ json: snapshot }).catch(() => {});
      }
      if (
        path === "/api/v1/events/context" &&
        route.request().method() === "GET"
      )
        return route.fulfill({ json: { generation: "initial" } });
      // First-party funnel beacons (verified in verify-funnel-ui).
      if (path.endsWith("/events"))
        return route.fulfill({ status: 202, json: { accepted: 1 } });
      faults.push(path);
      return route.fulfill({
        status: 404,
        json: { error: "unexpected_fixture" },
      });
    });
    await page.goto("http://127.0.0.1:4387/family/learners");
    await page.getByRole("link", { name: "Privacy", exact: true }).click();
    await page.screenshot({
      path: `artifacts/consent-app/privacy-${width}.png`,
    });
    await page.locator('[data-privacy-choice="consent"]').click();
    await page
      .getByRole("button", { name: "Review consent options", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Enrollment is unavailable" })
      .waitFor();
    if (!strict) await assertPhoneLandscapeSmoke(page, "Consent unavailable");
    else
      for (const selector of [
        ".parent-consent-center header button",
        ".parent-consent-center footer button",
      ]) {
        const box = await page.locator(selector).first().boundingBox();
        assert.ok(
          box && box.y >= 0 && box.y + box.height <= height + 1,
          `${selector} fits ${width}`,
        );
      }
    await page.screenshot({
      path: `artifacts/consent-app/unavailable-${width}.png`,
    });
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page
      .getByRole("button", { name: "Review consent options", exact: true })
      .waitFor();
    assert.equal(
      await page.evaluate(() => document.activeElement?.textContent?.trim()),
      "Review consent options",
    );
    view = {
      available: true,
      consentActive: false,
      notice: policy.notice,
      noticeDigest: noticeDigest(policy),
      confirmationDelayHours: 24,
      request: {
        id: requestId,
        phase: "awaiting-initial",
        createdAt: new Date().toISOString(),
        expiresAt: "2099-01-01T00:00:00.000Z",
        confirmationAfter: null,
        delivery: "accepted",
      },
    };
    await page.goto(`http://127.0.0.1:4387/${fragment}`);
    await page.getByRole("heading", { name: "Review and respond" }).waitFor();
    assert.equal(
      await page.evaluate(
        () => (window as unknown as { authFragment: string }).authFragment,
      ),
      "",
      "challenge consumed before auth module evaluation",
    );
    assert.equal(new URL(page.url()).hash, "");
    const storage = await page.evaluate(() =>
      JSON.stringify([
        Object.entries(sessionStorage),
        Object.entries(localStorage),
      ]),
    );
    assert.ok(
      !storage.includes(requestId) && !storage.includes("a".repeat(43)),
      "no challenge persisted to browser storage",
    );
    await page.evaluate(() =>
      (
        window as unknown as { consentApp: { emit(s: unknown): void } }
      ).consentApp.emit({ token: "refreshed", accountId: "parent" }),
    );
    await page.getByRole("heading", { name: "Review and respond" }).waitFor();
    const checkbox = page.getByRole("checkbox");
    await checkbox.check();
    await page.screenshot({
      path: `artifacts/consent-app/respond-${width}.png`,
    });
    held = true;
    enteredPromise = new Promise((resolve) => (entered = resolve));
    released = new Promise((resolve) => (release = resolve));
    await page.locator(".parent-consent-center footer button").first().click();
    await enteredPromise;
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page
      .getByRole("button", { name: "Review consent options", exact: true })
      .waitFor();
    const afterClose = familyReads;
    release();
    await page.waitForTimeout(150);
    assert.equal(
      familyReads,
      afterClose,
      "unmounted consent response cannot invalidate or refresh parent state",
    );
    await page.evaluate((hash) => {
      location.hash = hash;
    }, fragment);
    await page.getByRole("heading", { name: "Review and respond" }).waitFor();
    const otherAccount = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/v1/me" &&
        response.request().headers().authorization === "Bearer other",
    );
    await page.evaluate(() =>
      (
        window as unknown as { consentApp: { emit(s: unknown): void } }
      ).consentApp.emit({ token: "other", accountId: "other" }),
    );
    assert.equal((await (await otherAccount).json()).account.id, "other");
    // The consent route belongs to the new account; its empty response must not
    // display the previous parent's notice, request, or email challenge controls.
    await page
      .getByRole("heading", { name: "Enrollment is unavailable" })
      .waitFor();
    assert.equal(new URL(page.url()).pathname, "/consent");
    assert.ok(
      otherConsentReads > 0,
      "the new account loads its own consent state",
    );
    assert.equal(await page.getByRole("checkbox").count(), 0);
    assert.equal(
      await page
        .getByRole("link", { name: "Read the complete privacy notice" })
        .count(),
      0,
    );
    assert.equal(
      await page.getByRole("heading", { name: "Review and respond" }).count(),
      0,
      "account switch closes old challenge",
    );
    await page.evaluate(() =>
      (
        window as unknown as { consentApp: { emit(s: unknown): void } }
      ).consentApp.emit(null),
    );
    await page.getByRole("button", { name: "Parent sign in" }).waitFor();
    await page.evaluate((hash) => {
      location.hash = hash;
    }, fragment);
    await page
      .getByText(/After signing in, reopen your consent email link/)
      .waitFor();
    assert.equal(new URL(page.url()).hash, "");
    await page.evaluate(() =>
      (
        window as unknown as { consentApp: { emit(s: unknown): void } }
      ).consentApp.emit({ accountId: "parent", token: "fixture" }),
    );
    await page.getByRole("heading", { name: "Review and respond" }).waitFor();
    held = false;
    view.request!.phase = "awaiting-confirmation";
    view.request!.confirmationAfter = "2026-01-01T00:00:00.000Z";
    await page.evaluate(
      (hash) => {
        location.hash = hash;
      },
      fragment.replace("stage=initial", "stage=confirmation"),
    );
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "Confirm learning consent", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Consent is active", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Continue to family", exact: true })
      .click();
    await page.getByText("Consent is active.", { exact: true }).waitFor();
    assert.deepEqual(faults, []);
    await page.close();
  }
  console.log(
    "Actual-app consent entry, disabled enrollment, memory-only challenge, token renewal, identity clearing and held-unmount guards passed.",
  );
} finally {
  await browser.close();
  await vite.close();
}
