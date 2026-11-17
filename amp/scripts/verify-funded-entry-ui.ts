import { secureChromium } from "../browser-security.mjs";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium as rawChromium, type Page } from "playwright";
const chromium = secureChromium(rawChromium);
import { createServer } from "vite";
import { settleArrival } from "./ui-settle";
import {
  presentOffer,
  presentRequest,
  type FundingRequest,
} from "../src/funding-purchase/contracts";
import { testFundingOffer } from "../tests/funding-purchase.fixture";
import { retentionNotice } from "../src/family/contracts";
import { consentFixture } from "../tests/parent-consent.fixture";
import { noticeDigest } from "../src/parent-consent/crypto";

const port = 4399,
  origin = `http://127.0.0.1:${port}`;
const authPath = fileURLToPath(new URL("../src/web/auth.ts", import.meta.url));
const clientPath = fileURLToPath(
  new URL("../src/web/account-client.ts", import.meta.url),
);
const auth = `
const listeners = new Set();
let revision = 0;
export async function accessSession(){return localStorage.getItem('synthetic-signed-in') ? {token:'synthetic',accountId:localStorage.getItem('synthetic-account')||'synthetic-parent'} : null;}
export function onSessionChanged(update){listeners.add(update);return()=>listeners.delete(update);}
export async function signIn(){}
export async function signOut(){}
export function notifyDeviceSessionChanged(){}export function notifyAccountSessionChanged(checked){
  const current = ++revision;
  if(checked !== undefined){for(const listener of listeners) listener(checked);return;}
  void accessSession().then(session=>{if(current === revision) for(const listener of listeners) listener(session);});
}
export async function authConfig(){return {mode:'accounts',passwords:true,providers:[]};}
`;
const client = `async function success(input){window.syntheticCallback=input?.callbackURL;localStorage.setItem('synthetic-signed-in','yes');return {data:{token:'synthetic'},error:null};}export const accountClient={signUp:{email:success},signIn:{email:success},sendVerificationEmail:success};export function passkeyAccountClient(){return Promise.reject(new Error("no passkeys in this fixture"));}export function preloadPasskeys(){}`;
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
const browser = await chromium.launch({ args: ["--no-proxy-server"] });
const shots = "artifacts/funded-entry";
await mkdir(shots, { recursive: true });
await writeFile(
  `${shots}/consent.html`,
  '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="./consent.tsx"></script></html>',
);
// The consent screen inside a router, as in the app: its continuation is a
// router navigation, which here loads that address in the real app.
await writeFile(
  `${shots}/consent.tsx`,
  `import React from 'react';import{createRoot}from'react-dom/client';import{createBrowserHistory,createRootRoute,createRoute,createRouter,RouterProvider}from'@tanstack/react-router';import{ParentConsentCenter}from'../../src/web/ParentConsentCenter';import'../../src/web/style.css';const identity=new URLSearchParams(location.search).get('identity')||'synthetic-parent';const root=createRootRoute();const screen=createRoute({getParentRoute:()=>root,path:'/$',component:()=><ParentConsentCenter token="synthetic" identity={identity} onClose={()=>{}}/>});const router=createRouter({routeTree:root.addChildren([screen]),history:createBrowserHistory()});router.subscribe('onBeforeNavigate',({toLocation})=>{if(toLocation.pathname!==location.pathname)location.assign(toLocation.href);});createRoot(document.getElementById('root')!).render(<RouterProvider router={router}/>);`,
);
const campaign =
  "utm_source=facebook&utm_medium=paid-social&utm_campaign=ar-efa-launch&utm_content=efa-facebook-feed-v1";
const ar = {
  ...testFundingOffer,
  id: "ar-fixture",
  jurisdiction: "AR",
  programId: "ar-efa",
  programName: "Arkansas EFA",
  productTitle: "AMP Math · one learner",
  subtotalMinor: 59900,
};
const learner = {
  id: "10720fef-40bf-4e75-8982-208b5e05f84a",
  name: "Sample learner",
  birthYear: 2016,
};
const entryPrograms = [
  { slug: "arkansas-efa", offer: ar },
  {
    slug: "new-hampshire-efa",
    offer: {
      ...ar,
      id: "nh-fixture",
      programId: "nh-efa",
      jurisdiction: "NH",
      programName: "New Hampshire EFA",
    },
  },
  {
    slug: "arizona-esa",
    offer: {
      ...ar,
      id: "az-fixture",
      programId: "az-esa",
      jurisdiction: "AZ",
      programName: "Arizona ESA",
    },
  },
];
function fresh(program = ar) {
  return {
    program,
    confirm: true,
    consent: false,
    learners: [] as (typeof learner)[],
    requests: [] as FundingRequest[],
    offer: true,
    failCreate: false,
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
    // As the server: a family with children opens practice, others the
    // starter ("choose-plan" left the contract).
    next: state.learners.length ? "practice" : "start",
  };
}
async function serve(page: Page, state: State, faults: string[]) {
  page.on("pageerror", (e) => faults.push(e.message));
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname.replace("/api/v1", "");
    if (path === "/funding/invoices")
      return route.fulfill({ json: { invoices: [] } });
    // The public invoice form's offer for its program.
    if (path === "/funding/invoice-offers")
      return route.fulfill({
        json: { offers: state.offer ? [presentOffer(state.program)] : [] },
      });
    if (path === "/me") return route.fulfill({ json: me(state) });
    if (path === "/events")
      return route.fulfill({ status: 202, json: { accepted: 1 } });
    if (path === "/events/context")
      return route.fulfill({ json: { generation: "initial" } });
    if (path === "/funding/classwallet/capabilities")
      return route.fulfill({ json: { offerIds: [] } });
    if (path === "/funding/offers")
      return route.fulfill({
        json: {
          offers: [
            presentOffer({
              ...testFundingOffer,
              programId: "fl-pep",
              jurisdiction: "FL",
            }),
            ...(state.offer ? [presentOffer(state.program)] : []),
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
      assert.equal(body.offerId, state.program.id);
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
        offer: state.program,
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
/** A pay overlay's address: over the learner's own place
 * (features/pay/address.ts). */
const payOverlay = (url: URL) => /\/pay(\/|$)/.test(url.pathname);
/** The campaign labels the tab's arrival kept (lib/program-choice.ts). */
const arrival = (page: Page) =>
  page.evaluate(
    () =>
      JSON.parse(
        sessionStorage.getItem("amp.arrival-labels") ?? "null",
      ) as Record<string, string> | null,
  );
/** What the pay store holds for a learner (features/pay/store.ts). */
const payChoice = (page: Page, learnerId: string) =>
  page.evaluate(
    (id) =>
      JSON.parse(sessionStorage.getItem("amp.pay.v1") ?? "{}")?.state
        ?.accounts?.["synthetic-parent"]?.learners?.[id] ?? null,
    learnerId,
  );
try {
  for (const entry of entryPrograms)
    for (const width of [320, 390, 768, 1280])
      for (const theme of ["light", "dark"] as const) {
        const context = await browser.newContext({
          viewport: {
            width,
            height: width === 320 ? 568 : width === 390 ? 844 : 900,
          },
          colorScheme: theme,
        });
        const page = await context.newPage();
        page.setDefaultTimeout(10000);
        const entryCampaign =
          entry.slug === "arizona-esa"
            ? campaign.replace("ar-efa-launch", "az-esa-launch")
            : entry.slug === "new-hampshire-efa"
              ? "utm_source=google&utm_medium=cpc&utm_campaign=nh-efa-launch&utm_content=nh-efa-adaptive-v1"
              : campaign;
        const state = fresh(entry.offer),
          faults: string[] = [];
        await serve(page, state, faults);
        if (entry.slug === "new-hampshire-efa") {
          // A funding page's free sign-up names its program (an older link's
          // `?program=`, which the tab then keeps).
          await page.goto(
            `${origin}/sign-up?return=free-practice&program=nh-efa&${entryCampaign}`,
          );
          await page
            .getByText("Approved New Hampshire EFA vendor.")
            .waitFor()
            .catch(async (e) => {
              console.log(
                page.url(),
                await page.locator("body").innerText(),
                await page.evaluate(() => ({ ...sessionStorage })),
                faults,
              );
              throw e;
            });
          await page.reload();
          await page.getByText("Approved New Hampshire EFA vendor.").waitFor();
          assert.equal(
            new URL(page.url()).searchParams.get("utm_campaign"),
            "nh-efa-launch",
          );
          await capture(page, `free-signup-nh-${width}-${theme}`);
        }
        // Signed out, a program's older purchase address is its public
        // invoice form, in one hop, with no query: the ad's labels are the
        // tab's arrival (lib/program-choice.ts).
        await page.goto(
          `${origin}/purchase/${entry.slug}?${entryCampaign}&email=must-not-forward`,
        );
        await page.waitForURL(
          (url) => url.pathname === `/invoice/${entry.slug}`,
        );
        await page
          .getByRole("heading", { name: "Get your AMP invoice" })
          .waitFor()
          .catch(async (e) => {
            console.log(
              page.url(),
              await page.locator("body").innerText(),
              faults,
            );
            throw e;
          });
        assert.equal(new URL(page.url()).search, "");
        assert.equal(
          (await arrival(page))?.utm_campaign,
          new URLSearchParams(entryCampaign).get("utm_campaign"),
        );
        assert.ok(
          !(await page.locator("body").innerText()).includes("Fixture program"),
        );
        await capture(page, `invoice-${entry.slug}-${width}-${theme}`);
        if (width === 390 && theme === "light") {
          // Measured settled: mid fade-in (ui/loading.css amp-appear) text
          // blends with the surface and reads as low contrast.
          await settleArrival(page);
          const axe = await new AxeBuilder({ page }).analyze();
          assert.deepEqual(
            axe.violations
              .filter((v) => v.impact === "serious" || v.impact === "critical")
              .map(
                (v) =>
                  `${v.id}: ${v.nodes.map((n) => `${n.target} ${n.failureSummary ?? ""}`).join(" | ")}`,
              ),
            [],
          );
        }
        assert.deepEqual(faults, []);
        await context.close();
      }
  // Signed in, the older address is the learner's pay overlay, on its
  // program's education-funds tab (features/pay/legacy.ts), in one hop.
  for (const entry of entryPrograms) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await context.addInitScript(() =>
      localStorage.setItem("synthetic-signed-in", "yes"),
    );
    const page = await context.newPage(),
      state = fresh(entry.offer),
      faults: string[] = [];
    state.confirm = false;
    state.consent = true;
    state.learners = [learner];
    await serve(page, state, faults);
    await page.goto(`${origin}/purchase/${entry.slug}?${campaign}`);
    await page.waitForURL(payOverlay);
    assert.ok(
      new URL(page.url()).pathname.includes(learner.id),
      "the learner's own overlay",
    );
    assert.deepEqual(await payChoice(page, learner.id), {
      method: "esa",
      program: entry.offer.programId,
    });
    assert.deepEqual(
      faults.filter((fault) => !fault.startsWith("Unexpected ")),
      [],
      "no page errors",
    );
    await context.close();
  }
  // Privacy signals never prevent the same funded purchase, and no label
  // rides into the next address. Global Privacy Control keeps no labels;
  // free text (an address) is never kept; Do Not Track has no legal force
  // and changes nothing (lib/program-choice.ts keepArrival).
  for (const privacy of [
    "gpc",
    "dnt",
    "invalid",
    "invalid-creative",
    "allowed",
  ] as const) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await context.addInitScript((kind) => {
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
    await serve(page, state, faults);
    const tags =
      privacy === "invalid"
        ? campaign.replace("facebook", "private%40example.test")
        : privacy === "invalid-creative"
          ? campaign.replace("efa-facebook-feed-v1", "private%40example.test")
          : campaign;
    const measured = privacy === "allowed" || privacy === "dnt";
    await page.goto(`${origin}/purchase/arkansas-efa?${tags}`);
    await page.waitForURL((url) => url.pathname === "/invoice/arkansas-efa");
    await page.getByRole("heading", { name: "Get your AMP invoice" }).waitFor();
    assert.equal(new URL(page.url()).search, "", `${privacy}: no query`);
    const kept = (await arrival(page)) ?? {};
    assert.equal(
      "utm_campaign" in kept,
      measured || privacy === "invalid" || privacy === "invalid-creative",
      `${privacy}: campaign kept unless opted out`,
    );
    // Each plain label is kept on its own; a reader needs the full set
    // (lib/funded-entry.ts campaignSearch).
    assert.equal(
      "utm_content" in kept,
      measured || privacy === "invalid",
      `${privacy}: creative`,
    );
    assert.equal(
      "utm_source" in kept,
      measured || privacy === "invalid-creative",
      `${privacy}: source`,
    );
    assert.ok(!JSON.stringify(kept).includes("private"), "no free text kept");
    assert.deepEqual(faults, []);
    await context.close();
  }
  console.log(
    "PASS: signed-out program addresses open their invoice form (24 program/viewport/theme cases), signed-in ones the learner's pay overlay on the program's tab, GPC/DNT/invalid-label navigation.",
  );
} finally {
  await browser.close();
  await vite.close();
}
