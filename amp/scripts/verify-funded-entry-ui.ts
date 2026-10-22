import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright";
import { createServer } from "vite";
import {
  presentOffer,
  presentRequest,
  type FundingRequest,
} from "../src/funding-purchase/contracts";
import { testFundingOffer } from "../tests/funding-purchase.fixture";
import { retentionNotice } from "../src/family/contracts";
import { consentFixture } from "../tests/parent-consent.fixture";
import { noticeDigest } from "../src/parent-consent/crypto";

const stateProgram =
  process.argv[2] ?? process.env.AMP_TEST_FUNDING_PROGRAM ?? "ar-efa";
assert.ok(stateProgram === "ar-efa" || stateProgram === "az-esa");
const stateSlug = stateProgram === "az-esa" ? "arizona-esa" : "arkansas-efa";
const stateName = stateProgram === "az-esa" ? "Arizona ESA" : "Arkansas EFA";
const stateCampaign =
  stateProgram === "az-esa" ? "az-esa-launch" : "ar-efa-launch";
const port = Number(process.env.AMP_TEST_PORT ?? 4399),
  origin = `http://127.0.0.1:${port}`;
const authPath = fileURLToPath(new URL("../src/web/auth.ts", import.meta.url));
const clientPath = fileURLToPath(
  new URL("../src/web/account-client.ts", import.meta.url),
);
const auth = `export async function accessSession(){return localStorage.getItem('synthetic-signed-in') ? {token:'synthetic',accountId:localStorage.getItem('synthetic-account')||'synthetic-parent'} : null;}export function onSessionChanged(){return()=>{};}export async function signIn(){}export async function signOut(){}export function notifyAccountSessionChanged(){}export async function authConfig(){return {mode:'accounts',passwords:true,providers:[]};}`;
const client = `async function success(input){window.syntheticCallback=input?.callbackURL;localStorage.setItem('synthetic-signed-in','yes');return {data:{token:'synthetic'},error:null};}export const accountClient={signUp:{email:success},signIn:{email:success},sendVerificationEmail:success};`;
const vite = await createServer({
  cacheDir: "node_modules/.vite-funded-entry",
  plugins: [
    {
      name: "funded-fixture-auth",
      enforce: "pre",
      load(id) {
        const path = id.split("?")[0];
        return path === authPath
          ? auth
          : path === clientPath
            ? client
            : undefined;
      },
    },
  ],
  server: { host: "127.0.0.1", port, strictPort: true },
});
await vite.listen();
const browser = await chromium.launch();
const shots = `artifacts/funded-entry-${stateProgram}`;
await mkdir(shots, { recursive: true });
await writeFile(
  `${shots}/consent.html`,
  '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="./consent.tsx"></script></html>',
);
await writeFile(
  `${shots}/consent.tsx`,
  `import React from 'react';import{createRoot}from'react-dom/client';import{ParentConsentCenter}from'../../src/web/ParentConsentCenter';import'../../src/web/style.css';const identity=new URLSearchParams(location.search).get('identity')||'synthetic-parent';createRoot(document.getElementById('root')!).render(<ParentConsentCenter token="synthetic" identity={identity} onClose={()=>{}}/>);`,
);
const campaign = `utm_source=facebook&utm_medium=paid-social&utm_campaign=${stateCampaign}&utm_content=efa-facebook-feed-v1`;
const ar = {
  ...testFundingOffer,
  id: "ar-fixture",
  jurisdiction: stateProgram === "az-esa" ? "AZ" : "AR",
  programId: stateProgram,
  programName: stateName,
  productTitle: "AMP Math · one learner",
  subtotalMinor: 49900,
};
const learner = {
  id: "10720fef-40bf-4e75-8982-208b5e05f84a",
  name: "Sample learner",
  birthYear: 2016,
};
function fresh() {
  return {
    confirm: true,
    consent: false,
    learners: [] as (typeof learner)[],
    requests: [] as FundingRequest[],
    offer: true,
    failCreate: false,
    adopted: false,
    payloads: [] as Record<string, unknown>[],
  };
}
type State = ReturnType<typeof fresh>;
function me(state: State) {
  return {
    signedIn: true,
    account: {
      id: "synthetic-parent",
      email: "parent@example.test",
      emailVerified: !state.confirm,
      confirmationRequired: state.confirm,
    },
    consent: {
      status: state.consent ? "active" : "none",
      method: state.consent ? "verified" : null,
    },
    learners: state.learners.map((l) => ({
      ...l,
      entitlement: { active: false, plan: null, endsAt: null },
    })),
    family: {
      consent: {
        status: state.consent ? "active" : "not-recorded",
        policyVersion: null,
        recordedAt: null,
        withdrawnAt: null,
      },
      learners: state.learners.map((l) => ({
        ...l,
        deletedAt: null,
        access: [],
        stripeLinked: false,
        canPractice: false,
      })),
      retained: retentionNotice,
    },
    next: state.consent
      ? state.learners.length
        ? "choose-plan"
        : "add-learner"
      : "try",
  };
}
async function serve(page: Page, state: State, faults: string[]) {
  page.on("pageerror", (e) => faults.push(e.message));
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname.replace("/api/v1", "");
    if (path === "/me") return route.fulfill({ json: me(state) });
    if (path === "/events")
      return route.fulfill({ status: 202, json: { accepted: 1 } });
    if (path === "/funding/offers")
      return route.fulfill({
        json: {
          offers: [
            presentOffer({
              ...testFundingOffer,
              programId: stateProgram === "az-esa" ? "ar-efa" : "az-esa",
              jurisdiction: stateProgram === "az-esa" ? "AR" : "AZ",
            }),
            ...(state.offer ? [presentOffer(ar)] : []),
          ],
        },
      });
    if (path === "/funding/requests" && req.method() === "GET")
      return route.fulfill({
        json: { requests: state.requests.map((r) => presentRequest(r)) },
      });
    if (path === "/funding/requests" && req.method() === "POST") {
      assert.ok(state.consent);
      const body = req.postDataJSON();
      state.payloads.push(body);
      assert.equal(body.offerId, ar.id);
      assert.equal(body.learnerId, learner.id);
      if (state.failCreate) {
        state.failCreate = false;
        return route.fulfill({ status: 503, json: { error: "unavailable" } });
      }
      const record: FundingRequest = {
        id: "68444bca-7568-4a3f-ae47-78743116b563",
        accountId: "synthetic-parent",
        learnerId: learner.id,
        idempotencyKey: body.idempotencyKey,
        createdAt: new Date().toISOString(),
        expiresAt: "2099-01-01T00:00:00.000Z",
        status: "prepared",
        offer: ar,
        orderId: null,
      };
      state.requests = [record];
      return route.fulfill({ json: presentRequest(record) });
    }
    if (path === "/consent")
      return route.fulfill({
        json: {
          available: true,
          consentActive: state.consent,
          notice: consentFixture.notice,
          noticeDigest: noticeDigest(consentFixture),
          confirmationDelayHours: 24,
          request: null,
        },
      });
    if (path === "/trials/adopt") {
      assert.ok(state.consent);
      assert.deepEqual(Object.keys(req.postDataJSON()).sort(), [
        "name",
        "token",
      ]);
      state.adopted = true;
      state.learners = [learner];
      return route.fulfill({ json: learner });
    }
    if (path === "/learners" && req.method() === "POST") {
      assert.ok(state.consent);
      state.learners = [{ ...learner, ...req.postDataJSON() }];
      return route.fulfill({ json: state.learners[0] });
    }
    // Free-plan route demonstrates that the functional EFA path survives without Stripe.
    if (path === "/billing/prices")
      return route.fulfill({ json: { available: false, offers: [] } });
    if (path === "/catalog")
      return route.fulfill({ json: { templates: [], skills: [] } });
    faults.push(`Unexpected ${req.method()} ${path}`);
    return route.fulfill({
      status: 404,
      json: { error: "fixture_unexpected" },
    });
  });
}
async function fits(page: Page, label: string) {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    `${label}: horizontal overflow`,
  );
  const footer = page.locator(".funding-footer");
  if (await footer.isVisible()) {
    const box = await footer.boundingBox();
    assert.ok(
      box && box.y + box.height <= page.viewportSize()!.height + 1,
      `${label}: footer visible`,
    );
  }
}
async function capture(page: Page, label: string) {
  await fits(page, label);
  await page.screenshot({ path: `${shots}/${label}.png` });
}
try {
  for (const width of [320, 390, 768, 1280])
    for (const theme of ["light", "dark"] as const) {
      const context = await browser.newContext({
        viewport: {
          width,
          height: width === 320 ? 568 : width === 390 ? 844 : 900,
        },
        colorScheme: theme,
      });
      let page = await context.newPage();
      page.setDefaultTimeout(10000);
      const state = fresh(),
        faults: string[] = [];
      await serve(page, state, faults);
      await page.goto(
        `${origin}/purchase/${stateSlug}?${campaign}&email=must-not-forward`,
      );
      await page
        .getByRole("heading", { name: "Create your parent account" })
        .waitFor()
        .catch(async (e) => {
          console.log(
            page.url(),
            await page.locator("body").innerText(),
            faults,
          );
          throw e;
        });
      await page
        .getByLabel("Email", { exact: true })
        .fill("parent@example.test");
      await page
        .locator('input[autocomplete="new-password"]')
        .fill("synthetic-password-only");
      await capture(page, `signup-${width}-${theme}`);
      await page
        .getByRole("button", { name: "Create account", exact: true })
        .click();
      await page.getByRole("heading", { name: "Confirm your email" }).waitFor();
      const callback = await page.evaluate(
        () => (window as any).syntheticCallback,
      );
      assert.ok(callback.startsWith(`/purchase/${stateSlug}?`));
      assert.ok(!callback.includes("must-not-forward"));
      state.confirm = false;
      await page.getByRole("button", { name: "I confirmed my email" }).click();
      await page
        .getByRole("heading", { name: "Learning consent", exact: true })
        .waitFor();
      assert.equal(state.learners.length, 0);
      assert.ok(
        await page.evaluate(
          () =>
            !!localStorage.getItem(
              "amp.pending-funded-purchase.synthetic-parent",
            ),
        ),
      );
      await capture(page, `consent-${width}-${theme}`);
      // Simulate consent completed in the email's tab: this shared component reads
      // the same account-scoped continuation after the server confirms consent.
      state.consent = true;
      const adopting = width === 390 && theme === "light";
      if (adopting)
        await page.evaluate(() =>
          localStorage.setItem("amp.trial", "synthetic-free-trial"),
        );
      const original = page;
      page = await context.newPage();
      await serve(page, state, faults);
      await page.goto(`${origin}/${shots}/consent.html?identity=other-parent`);
      await page.getByRole("button", { name: "Continue to family" }).waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "Continue to funded purchase" })
          .count(),
        0,
      );
      await page.goto(`${origin}/${shots}/consent.html`);
      await page
        .getByRole("button", { name: "Continue to funded purchase" })
        .click();
      await original.close();
      await page.getByLabel("Learner name").fill("Sample learner");
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      if (!adopting)
        await page.getByRole("button", { name: "2016", exact: true }).click();
      await page
        .getByRole("heading", { name: stateName, exact: true })
        .waitFor();
      assert.ok(page.url().includes("utm_source=facebook"));
      assert.equal(state.adopted, adopting);
      await page
        .getByRole("button", { name: /^Program and product:/ })
        .waitFor();
      assert.ok(
        !(await page.locator("body").innerText()).includes("Fixture program"),
      );
      await capture(page, `quote-options-${width}-${theme}`);
      if (width === 390 && theme === "light") {
        const axe = await new AxeBuilder({ page }).analyze();
        assert.deepEqual(
          axe.violations
            .filter((v) => v.impact === "serious" || v.impact === "critical")
            .map((v) => v.id),
          [],
        );
      }
      state.failCreate = true;
      await page.getByRole("button", { name: "Prepare unpaid quote" }).click();
      await page.getByRole("alert").waitFor();
      await capture(page, `failed-request-${width}-${theme}`);
      await page
        .getByRole("button", { name: "Dismiss message", exact: true })
        .click();
      await page.getByRole("button", { name: "Prepare unpaid quote" }).click();
      await page
        .getByRole("heading", { name: "Purchase request", exact: true })
        .waitFor();
      assert.equal(state.payloads.length, 2);
      assert.equal(
        state.payloads[0]!.idempotencyKey,
        state.payloads[1]!.idempotencyKey,
      );
      assert.deepEqual(state.payloads[1]!.campaignAttribution, {
        campaign: stateCampaign,
        source: "facebook",
        medium: "paid-social",
        creative: "efa-facebook-feed-v1",
      });
      assert.equal(
        await page.evaluate(() =>
          localStorage.getItem("amp.pending-funded-purchase.synthetic-parent"),
        ),
        null,
      );
      await capture(page, `prepared-${width}-${theme}`);
      assert.deepEqual(faults, []);
      await context.close();
    }
  // Privacy signals never prevent the same funded purchase, and invalid labels
  // cannot survive actual router links, redirects, or request serialization.
  for (const privacy of [
    "gpc",
    "dnt",
    "invalid",
    "invalid-creative",
    "allowed",
    "other-state",
  ] as const) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await context.addInitScript((kind) => {
      localStorage.setItem("synthetic-signed-in", "yes");
      if (kind === "gpc")
        Object.defineProperty(navigator, "globalPrivacyControl", {
          value: true,
        });
      if (kind === "dnt")
        Object.defineProperty(navigator, "doNotTrack", { value: "1" });
    }, privacy);
    const page = await context.newPage(),
      state = fresh(),
      faults: string[] = [];
    state.confirm = false;
    state.consent = true;
    state.learners = [learner];
    await serve(page, state, faults);
    const tags =
      privacy === "invalid"
        ? campaign.replace("facebook", "private%40example.test")
        : privacy === "invalid-creative"
          ? campaign.replace("efa-facebook-feed-v1", "private%40example.test")
          : privacy === "other-state"
            ? campaign.replace(
                stateCampaign,
                stateProgram === "az-esa" ? "ar-efa-launch" : "az-esa-launch",
              )
            : campaign;
    await page.goto(`${origin}/try/plans?program=${stateProgram}&${tags}`);
    await page.getByRole("link", { name: `Use ${stateName} funds` }).click();
    await page.getByRole("heading", { name: stateName, exact: true }).waitFor();
    assert.equal(
      page.url().includes("utm_"),
      privacy === "allowed" ||
        privacy === "invalid-creative" ||
        privacy === "other-state",
      `${privacy}: router filters labels`,
    );
    assert.equal(
      page.url().includes("utm_content"),
      privacy === "allowed" || privacy === "other-state",
    );
    assert.equal(page.url().includes("private"), false);
    await page.getByRole("button", { name: "Prepare unpaid quote" }).click();
    await page
      .getByRole("heading", { name: "Purchase request", exact: true })
      .waitFor();
    assert.deepEqual(
      state.payloads[0]!.campaignAttribution,
      privacy === "allowed" || privacy === "invalid-creative"
        ? {
            campaign: stateCampaign,
            source: "facebook",
            medium: "paid-social",
            ...(privacy === "allowed"
              ? { creative: "efa-facebook-feed-v1" }
              : {}),
          }
        : undefined,
    );
    assert.deepEqual(faults, []);
    await context.close();
  }
  {
    const context = await browser.newContext();
    await context.addInitScript(() =>
      localStorage.setItem("synthetic-signed-in", "yes"),
    );
    const page = await context.newPage(),
      state = fresh(),
      faults: string[] = [];
    state.confirm = false;
    await serve(page, state, faults);
    await page.goto(`${origin}/purchase/${stateSlug}?${campaign}`);
    await page
      .getByRole("heading", { name: "Learning consent", exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByRole("link", { name: `Use ${stateName} funds` }).waitFor();
    assert.equal(new URL(page.url()).pathname, "/try/plans");
    assert.equal(
      await page.evaluate(() =>
        localStorage.getItem("amp.pending-funded-purchase.synthetic-parent"),
      ),
      null,
    );
    assert.deepEqual(faults, []);
    await context.close();
  }
  // An absent Arkansas offer must never expose the unrelated fixture offer.
  {
    const context = await browser.newContext();
    await context.addInitScript(() =>
      localStorage.setItem("synthetic-signed-in", "yes"),
    );
    const page = await context.newPage(),
      state = fresh(),
      faults: string[] = [];
    state.offer = false;
    await serve(page, state, faults);
    await page.goto(`${origin}/purchase/${stateSlug}`);
    await page
      .getByRole("heading", { name: `${stateName} purchase options` })
      .waitFor();
    assert.ok(
      !(await page.locator("body").innerText()).includes("Fixture program"),
    );
    assert.equal(state.learners.length, 0);
    assert.deepEqual(faults, []);
    await context.close();
  }
  console.log(
    "PASS: 8 viewport/theme journeys, retry idempotency, funding-program filtering, GPC/DNT/invalid-label navigation, unavailable offer.",
  );
} finally {
  await browser.close();
  await vite.close();
}
