import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, webkit, type Page } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { createServer } from "vite";
import { retentionNotice } from "../src/family/contracts";

const port = 4386,
  origin = `http://127.0.0.1:${port}`;
const authPath = fileURLToPath(new URL("../src/web/auth.ts", import.meta.url));
const auth = `export async function accessSession(){const id=sessionStorage.getItem('fixture-account')||'amp|fixture';return id==='guest'?null:{token:id,accountId:id};}export function onSessionChanged(){return()=>{};}export async function signIn(){}export async function signOut(){sessionStorage.setItem('fixture-account','guest');location.assign('/access');}export function notifyAccountSessionChanged(){}export async function authConfig(){return {mode:'accounts',passwords:true,providers:[]};}`;
const vite = await createServer({
  cacheDir: "node_modules/.vite-access-gifts",
  plugins: [
    {
      name: "gift-fixture-auth",
      enforce: "pre",
      load(id) {
        return id.split("?")[0] === authPath ? auth : undefined;
      },
    },
  ],
  server: { host: "127.0.0.1", port, strictPort: true },
});
const shots = process.env.AMP_UI_ARTIFACTS ?? "artifacts/access-grants";
await mkdir(shots, { recursive: true });
const giftId = "b24d441b-38d5-42ec-ae99-dbe186b1ffba";
type State = {
  owner: string;
  verified: boolean;
  consent: boolean;
  reserved: boolean;
  months: 1 | 12;
  failMe: boolean;
  failClaim: boolean;
  paidSetup: boolean;
  learners: { id: string; name: string; birthYear: number; active: boolean }[];
  creates: number;
  claims: number;
  sends: unknown[];
};
function fresh(): State {
  return {
    owner: "amp|fixture",
    verified: true,
    consent: true,
    reserved: true,
    months: 12,
    failMe: false,
    failClaim: false,
    paidSetup: false,
    learners: [],
    creates: 0,
    claims: 0,
    sends: [],
  };
}
function me(s: State) {
  const learners = s.learners.map((l) => ({
    ...l,
    entitlement: {
      active: l.active,
      plan: l.active ? "pilot" : null,
      endsAt: l.active ? "2099-01-01T00:00:00Z" : null,
    },
  }));
  return {
    signedIn: true,
    account: {
      id: s.owner,
      email:
        s.owner === "amp|fixture"
          ? "alex@example.test"
          : "another@example.test",
      emailVerified: s.verified,
      confirmationRequired: !s.verified,
    },
    consent: { status: s.consent ? "active" : "none", method: null },
    learners,
    family: {
      consent: {
        status: s.consent ? "active" : "not-recorded",
        policyVersion: null,
        recordedAt: null,
        withdrawnAt: null,
      },
      learners: s.learners.map((l) => ({
        ...l,
        deletedAt: null,
        access: [],
        stripeLinked: false,
        canPractice: l.active,
      })),
      retained: retentionNotice,
    },
    ...(s.reserved && s.verified
      ? {
          availableAccessGrant: { id: giftId, months: s.months, claimBy: null },
        }
      : {}),
    ...(s.paidSetup
      ? {
          unassignedPurchase: {
            id: giftId,
            interval: "year",
            endsAt: "2099-01-01T00:00:00Z",
          },
        }
      : {}),
    next: s.paidSetup
      ? "add-learner"
      : s.reserved && s.verified
        ? "accept-gift"
        : learners.some((l) => l.active)
          ? "practice"
          : "try",
  };
}
async function serve(page: Page, s: State) {
  await page.route("**/api/auth/**", async (route) => {
    if (route.request().url().includes("send-verification-email"))
      s.sends.push(route.request().postDataJSON());
    return route.fulfill({ json: { status: true } });
  });
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname.replace("/api/v1", "");
    if (path === "/me")
      return route.fulfill({
        status: s.failMe ? 503 : 200,
        json: s.failMe ? { error: "family_service_unavailable" } : me(s),
      });
    if (path === "/learners" && req.method() === "POST") {
      assert.ok(s.consent && s.verified);
      s.creates++;
      const l = { ...req.postDataJSON(), id: "learner-fixture", active: true };
      s.learners.push(l);
      s.reserved = false;
      return route.fulfill({ json: l });
    }
    if (path.endsWith("/activate")) {
      s.claims++;
      if (s.failClaim)
        return route.fulfill({
          status: 503,
          json: { error: "gift_service_unavailable" },
        });
      const { learnerId } = req.postDataJSON();
      const l = s.learners.find((l) => l.id === learnerId)!;
      assert.ok(l);
      l.active = true;
      s.reserved = false;
      return route.fulfill({
        json: {
          id: giftId,
          learnerId,
          startsAt: "2026-01-01T00:00:00Z",
          endsAt: "2027-01-01T00:00:00Z",
        },
      });
    }
    if (path === "/consent")
      return route.fulfill({
        json: { available: false, consentActive: false, request: null },
      });
    if (path === "/learners")
      return route.fulfill({ json: { learners: s.learners } });
    if (path === "/family") return route.fulfill({ json: me(s).family });
    return route.fulfill({
      status: 503,
      json: { error: "fixture_unused_route" },
    });
  });
}
async function fits(page: Page) {
  const problems = await page.evaluate(() => {
    const errors: string[] = [];
    if (document.documentElement.scrollWidth > innerWidth + 1)
      errors.push("horizontal overflow");
    for (const e of document.querySelectorAll<HTMLElement>(
      "main button,main a,main input",
    )) {
      const r = e.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.left < -1 || r.right > innerWidth + 1)
        errors.push(`outside viewport: ${e.textContent}`);
      if (r.height < 43.5) errors.push(`short target: ${e.textContent}`);
    }
    return errors;
  });
  assert.deepEqual(problems, []);
}
await vite.listen();
const browser = await chromium.launch();
try {
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [768, 1024],
    [1280, 800],
  ]) {
    for (const theme of ["light", "dark"] as const) {
      const context = await browser.newContext({
        viewport: { width, height },
        colorScheme: theme,
      });
      const page = await context.newPage();
      const s = fresh();
      await serve(page, s);
      await page.goto(`${origin}/access`);
      await page
        .getByRole("heading", { name: "Your year of AMP is ready." })
        .waitFor();
      await fits(page);
      await page.screenshot({
        path: `${shots}/invitation-${width}-${theme}.png`,
        fullPage: true,
      });
      if (width === 390 && theme === "light") {
        const axe = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        assert.deepEqual(axe.violations, []);
      }
      await page.getByRole("link", { name: "Continue setup" }).click();
      await page.getByLabel("Learner name").fill("Alex");
      await fits(page);
      await page.screenshot({
        path: `${shots}/learner-${width}-${theme}.png`,
        fullPage: true,
      });
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page.getByRole("button", { name: "2012", exact: true }).waitFor();
      await fits(page);
      await page.getByRole("button", { name: "2012", exact: true }).click();
      await page.waitForURL("**/practice");
      assert.equal(s.creates, 1);
      assert.equal(s.learners[0].active, true);
      await context.close();
    }
  }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const s = fresh();
  await serve(page, s);
  // A normal login landing discovers the reservation even with an existing learner.
  s.learners = [
    { id: "existing", name: "Alex", birthYear: 2012, active: false },
  ];
  await page.goto(origin);
  await page.waitForURL("**/access");
  await page.getByRole("link", { name: "Continue setup" }).click();
  s.failClaim = true;
  await page.getByRole("button", { name: "Continue with Alex" }).click();
  await page
    .getByText("Your access could not be activated.", { exact: false })
    .waitFor();
  await fits(page);
  await page.screenshot({
    path: `${shots}/activation-retry-390.png`,
    fullPage: true,
  });
  s.failClaim = false;
  await page.getByRole("button", { name: "Continue with Alex" }).click();
  await page.waitForURL("**/practice");
  assert.equal(s.creates, 0);
  assert.equal(s.claims, 2);
  // Reload does not create or reactivate anything.
  await page.goto(`${origin}/access`);
  await page.getByRole("heading", { name: "You’re ready to learn." }).waitFor();
  await page.reload();
  assert.equal(s.claims, 2);
  Object.assign(s, fresh(), { verified: false });
  await page.goto(`${origin}/access`);
  await page.getByRole("heading", { name: "Confirm your email" }).waitFor();
  assert.equal(await page.getByText("A gift of learning").count(), 0);
  await page.getByRole("button", { name: "Send another email" }).click();
  await page.getByText("Verification email sent.", { exact: false }).waitFor();
  assert.equal((s.sends[0] as { callbackURL: string }).callbackURL, "/access");
  s.verified = true;
  await page.getByRole("button", { name: "I confirmed my email" }).click();
  await page
    .getByRole("heading", { name: "Your year of AMP is ready." })
    .waitFor();
  // Errors have a working retry. Another account never sees the old invitation.
  s.failMe = true;
  await page.reload();
  await page.getByRole("button", { name: "Try again", exact: true }).waitFor();
  await fits(page);
  s.failMe = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page
    .getByRole("heading", { name: "Your year of AMP is ready." })
    .waitFor();
  s.owner = "amp|another";
  s.reserved = false;
  await page.evaluate(() =>
    sessionStorage.setItem("fixture-account", "amp|another"),
  );
  await page.reload();
  await page
    .getByRole("heading", { name: "Let’s find your invitation." })
    .waitFor();
  assert.equal(
    await page.getByText("alex@example.test", { exact: true }).count(),
    0,
  );
  await page.screenshot({
    path: `${shots}/no-invitation-390.png`,
    fullPage: true,
  });
  // Paid enrollment takes precedence with explicit paid wording, not a free promise.
  Object.assign(s, fresh(), { paidSetup: true });
  await page.evaluate(() => sessionStorage.removeItem("fixture-account"));
  await page.reload();
  await page.getByRole("link", { name: "Finish paid setup" }).waitFor();
  assert.equal(
    await page
      .getByText("No payment details or automatic renewal.", { exact: false })
      .count(),
    0,
  );
  await fits(page);
  await page.screenshot({
    path: `${shots}/paid-plan-reserved-gift-390.png`,
    fullPage: true,
  });
  // Consent remains a separate prerequisite. Opening name directly cannot bypass it.
  Object.assign(s, fresh(), { consent: false });
  await page.goto(`${origin}/start/name`);
  await page.waitForURL("**/access");
  await page.getByRole("link", { name: "Continue setup" }).click();
  await page.waitForURL("**/start/consent?return=access");
  assert.equal(s.creates, 0);
  s.consent = true;
  await page.reload();
  await page.getByLabel("Learner name").waitFor();
  // Back/forward restores the invitation and draft step.
  await page.goto(`${origin}/access`);
  await page.getByRole("link", { name: "Continue setup" }).click();
  await page.goBack();
  await page
    .getByRole("heading", { name: "Your year of AMP is ready." })
    .waitFor();
  await page.goForward();
  await page.getByLabel("Learner name").waitFor();
  await page.evaluate(() => sessionStorage.setItem("fixture-account", "guest"));
  await page.goto(`${origin}/access`);
  await page.waitForURL("**/sign-in?return=access");
  await page.getByRole("heading", { name: "Sign in", exact: true }).waitFor();
  await page.close();
  // WebKit phone smoke exercises the same route and real controls.
  const safari = await webkit.launch();
  try {
    const phone = await safari.newPage({
      viewport: { width: 390, height: 844 },
      colorScheme: "dark",
      isMobile: true,
    });
    await serve(phone, fresh());
    await phone.goto(`${origin}/access`);
    await phone.getByRole("link", { name: "Continue setup" }).waitFor();
    await fits(phone);
    await phone.screenshot({
      path: `${shots}/invitation-webkit-390-dark.png`,
      fullPage: true,
    });
    await phone.getByRole("link", { name: "Continue setup" }).click();
    await phone.getByLabel("Learner name").fill("Alex");
    await phone.getByRole("button", { name: "Continue", exact: true }).click();
    await phone.getByRole("button", { name: "2012", exact: true }).waitFor();
    await fits(phone);
  } finally {
    await safari.close();
  }
  console.log(
    "Gift onboarding: 320/390/768/1280, light/dark, Chromium + WebKit; setup, existing learner, retries, reload, account switch, consent, verification and paid coexistence passed.",
  );
} finally {
  await browser.close();
  await vite.close();
}
