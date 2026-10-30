import { registerParentFollowupRoutes } from "../src/parent-followup/routes.js";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, webkit, type Browser, type Page } from "playwright";
import { createServer } from "vite";
import { exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import { generateKeyPairSync } from "node:crypto";
import { randomUUID } from "node:crypto";
import { buildApp } from "../src/server/app";
import { PostgresRepository } from "../src/server/repository";
import {
  accountsAuth,
  createAccounts,
  registerAccountRoutes,
} from "../src/server/accounts";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { migrate } from "./migrate";
import { fill, socialCopyFor } from "../src/web/features/auth/social-copy";

/** Provider sign-in in the browser: the brand button stack on sign-in and
 * "Create your account" at phone, small-phone and desktop sizes in
 * both themes, a cancelled provider screen, and a new parent who signs up
 * with a provider and lands in the guided first run. Provider screens and
 * endpoints are answered by this script; nothing leaves the machine. */
const url = process.env.AMP_TEST_DATABASE_URL;
if (!url)
  throw new Error("AMP_TEST_DATABASE_URL is required for browser verification");
await migrate(url);
const origin = "http://localhost:4366";
const repository = new PostgresRepository(url, { development: true });
const accounts = await createAccounts(repository.pool, {
  baseURL: origin,
  secret: "v".repeat(40),
  production: false,
  passwords: true,
  parentFollowup: true,
  trustedOrigins: [],
  google: { clientId: "google-client", clientSecret: "google-secret" },
  github: { clientId: "github-client", clientSecret: "github-secret" },
  microsoft: {
    clientId: "microsoft-client",
    clientSecret: "microsoft-secret",
    tenantId: "common",
  },
  apple: {
    clientId: "inc.example.amp.web",
    teamId: "TEAMID1234",
    keyId: "KEYID12345",
    privateKey: generateKeyPairSync("ec", { namedCurve: "P-256" })
      .privateKey.export({ type: "pkcs8", format: "pem" })
      .toString(),
  },
});
const authenticate = accountsAuth(accounts);
const app = buildApp({ repository, authenticate, development: true });
await registerAccountRoutes(app, accounts);
await registerParentFollowupRoutes(app, {
  pool: repository.pool,
  origin,
  authenticate,
  enabled: true,
});
await registerFamilyRoutes(app, {
  pool: repository.pool,
  authenticate,
  development: true,
});
await app.listen({ host: "127.0.0.1", port: 4367 });
const vite = await createServer({
  root: new URL("../", import.meta.url).pathname,
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  logLevel: "error",
  server: {
    host: "127.0.0.1",
    port: 4366,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:4367" } },
  },
});
await vite.listen();

// Google's token and key endpoints, answered in this process.
const pair = await generateKeyPair("RS256");
const jwk: JWK = {
  ...(await exportJWK(pair.publicKey)),
  kid: "ui-key",
  alg: "RS256",
  use: "sig",
};
let parentEmail = `provider-parent-${Date.now()}@example.com`;
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const address = String(input instanceof Request ? input.url : input);
  if (address === "https://oauth2.googleapis.com/token")
    return Response.json({
      access_token: "ui-access",
      token_type: "Bearer",
      expires_in: 3600,
      id_token: await new SignJWT({
        email: parentEmail,
        email_verified: true,
        name: "Provider Parent",
      })
        .setProtectedHeader({ alg: "RS256", kid: "ui-key" })
        .setIssuer("https://accounts.google.com")
        .setAudience("google-client")
        .setSubject(`ui-${parentEmail}`)
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(pair.privateKey),
    });
  if (address === "https://www.googleapis.com/oauth2/v3/certs")
    return Response.json({ keys: [jwk] });
  return realFetch(input, init);
};

const shots = new URL("../artifacts/screenshots/", import.meta.url);
await mkdir(shots, { recursive: true });
const order = ["google", "apple", "microsoft", "github"];
const sizes = [
  { width: 320, height: 640 },
  { width: 384, height: 700 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 },
];

/** Accumulates layout shifts from the first paint (Chromium Layout Instability API). */
const recordShifts = () => {
  (window as unknown as { __shift: number }).__shift = 0;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as (PerformanceEntry & {
      value: number;
      hadRecentInput: boolean;
    })[])
      if (!entry.hadRecentInput)
        (window as unknown as { __shift: number }).__shift += entry.value;
  }).observe({ type: "layout-shift", buffered: true });
};
const shift = (page: Page) =>
  page.evaluate(() => (window as unknown as { __shift: number }).__shift);

async function measureStack(page: Page, label: string) {
  const buttons = page.locator("button[data-provider]");
  await buttons.first().waitFor();
  assert.deepEqual(
    await buttons.evaluateAll((all) =>
      all.map((b) => (b as HTMLElement).dataset.provider),
    ),
    order,
    `${label}: every configured provider, in order`,
  );
  const boxes = await buttons.evaluateAll((all) =>
    all.map((b) => {
      const r = b.getBoundingClientRect();
      const text = b.querySelector("span:last-child") as HTMLElement;
      const lineHeight = parseFloat(getComputedStyle(text).lineHeight);
      return {
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        lines: Math.round(text.getBoundingClientRect().height / lineHeight),
        clipped: text.scrollWidth > text.clientWidth + 1,
      };
    }),
  );
  for (const [i, box] of boxes.entries()) {
    assert.ok(
      box.height >= 44,
      `${label}: ${order[i]} is ${box.height}px tall`,
    );
    assert.equal(box.width, boxes[0].width, `${label}: equal widths`);
    assert.equal(box.x, boxes[i % 2].x, `${label}: aligned columns`);
    assert.equal(box.height, boxes[0].height, `${label}: equal heights`);
    assert.equal(box.clipped, false, `${label}: ${order[i]} label clipped`);
    if (i % 2) assert.equal(box.y, boxes[i - 1].y, `${label}: aligned rows`);
    if (i >= 2)
      assert.ok(
        box.y >= boxes[i - 2].y + boxes[i - 2].height + 7,
        `${label}: separated touch targets`,
      );
  }
  return boxes;
}

async function checkScreen(
  browser: Browser,
  path: "/sign-in" | "/sign-up",
  theme: "light" | "dark",
  size: { width: number; height: number },
  lang = "en",
) {
  const context = await browser.newContext({
    viewport: size,
    colorScheme: theme,
  });
  const page = await context.newPage();
  await page.addInitScript(recordShifts);
  // The page's language selects the copy; serve the document in `lang`.
  if (lang !== "en")
    await page.route(`${origin}${path}`, async (route) => {
      const response = await route.fetch();
      const html = (await response.text()).replace(
        '<html lang="en">',
        `<html lang="${lang}">`,
      );
      assert.ok(html.includes(`lang="${lang}"`));
      await route.fulfill({ response, body: html });
    });
  await page.goto(`${origin}${path}`);
  const label = `${path} ${theme} ${size.width}x${size.height} ${lang}`;
  await page
    .getByRole("heading", {
      name: path === "/sign-up" ? "Create your account" : "Sign in",
    })
    .waitFor();
  const boxes = await measureStack(page, label);
  assert.equal(
    await page
      .locator("button[data-provider]")
      .first()
      .getAttribute("aria-label"),
    fill(socialCopyFor(lang).continueWith, "Google"),
    `${label}: copy in the page's language`,
  );
  if (lang === "en")
    for (const [i, box] of boxes.entries())
      assert.equal(box.lines, 1, `${label}: ${order[i]} label on one line`);
  // Stack, then the divider, then the email form, in one column.
  const order2 = await page.evaluate(() => {
    const stack = document
      .querySelector("button[data-provider]")!
      .parentElement!.getBoundingClientRect();
    const divider = document
      .querySelector("form.account-form")!
      .previousElementSibling!.getBoundingClientRect();
    const form = document
      .querySelector("form.account-form")!
      .getBoundingClientRect();
    return {
      stackBottom: stack.bottom,
      dividerTop: divider.top,
      dividerBottom: divider.bottom,
      formTop: form.top,
    };
  });
  assert.ok(
    order2.stackBottom <= order2.dividerTop &&
      order2.dividerBottom <= order2.formTop,
    `${label}: stack, divider, form`,
  );
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - innerWidth,
  );
  assert.ok(overflow <= 0, `${label}: horizontal overflow ${overflow}px`);
  assert.equal(await shift(page), 0, `${label}: layout shift while loading`);
  await page.screenshot({
    path: new URL(
      `social-${path.slice(1)}-${theme}-${size.width}x${size.height}${lang === "en" ? "" : `-${lang}`}.png`,
      shots,
    ).pathname,
    fullPage: true,
  });
  await context.close();
}

const browser = await chromium.launch({ headless: true });
try {
  for (const path of ["/sign-up", "/sign-in"] as const)
    for (const theme of ["light", "dark"] as const)
      for (const size of sizes) await checkScreen(browser, path, theme, size);
  // Paid acquisition is a parent signup offer, with reachable social actions.
  for (const theme of ["light", "dark"] as const)
    for (const size of sizes.filter((s) => s.width !== 384)) {
      const context = await browser.newContext({
        viewport: size,
        colorScheme: theme,
      });
      const page = await context.newPage();
      await page.goto(`${origin}/sign-up?return=free-practice&program=az-esa`);
      await page.getByRole("heading", { name: "Try AMP free." }).waitFor();
      // Opt-in is a single quiet line, never a checkbox to decide on.
      assert.equal(await page.getByRole("checkbox").count(), 0);
      assert.match(
        await page.locator("[data-signup-email-notice]").innerText(),
        /^We’ll email you about AMP\. Unsubscribe anytime\. Privacy$/,
      );
      assert.ok(
        (await page.locator("[data-free-parent-signup]").innerText()).includes(
          "Arizona ESA",
        ),
      );
      const box = await page
        .locator("button[data-provider=google]")
        .boundingBox();
      assert.ok(
        box && box.y + box.height <= size.height,
        `Google visible at ${size.width}`,
      );
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.screenshot({
        path: new URL(`parent-signup-${theme}-${size.width}.png`, shots)
          .pathname,
        fullPage: true,
      });
      await context.close();
    }
  // The longest translations still fit the narrowest phone.
  for (const lang of ["de", "fi", "ta", "ml", "ar", "ja"])
    await checkScreen(browser, "/sign-up", "light", sizes[0], lang);

  const context = await browser.newContext({ viewport: sizes[2] });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(recordShifts);
  await page.addInitScript(() => {
    Object.defineProperty(window, "BroadcastChannel", {
      configurable: true,
      value: class {
        constructor() {
          throw new DOMException("Storage blocked", "SecurityError");
        }
      },
    });
  });
  // The provider screens: GitHub is cancelled, Google approves.
  await context.route("https://github.com/login/oauth/authorize**", (route) => {
    const state = new URL(route.request().url()).searchParams.get("state")!;
    return route.fulfill({
      status: 302,
      headers: {
        location: `${origin}/api/auth/callback/github?error=access_denied&state=${encodeURIComponent(state)}`,
      },
    });
  });
  await context.route("https://accounts.google.com/**", (route) => {
    const state = new URL(route.request().url()).searchParams.get("state")!;
    return route.fulfill({
      status: 302,
      headers: {
        location: `${origin}/api/auth/callback/google?code=ui-code&state=${encodeURIComponent(state)}`,
      },
    });
  });

  await page.goto(`${origin}/sign-up?return=free-practice&program=az-esa`);
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await page.waitForURL(
    /\/try\?return=free-practice&program=az-esa|\/try\?program=az-esa&return=free-practice/,
  );
  await page.getByRole("heading", { name: "See how AMP adapts" }).waitFor();
  const lead = (
    await repository.pool.query(
      "SELECT p.* FROM amp_parent_followups p JOIN amp_auth_users u ON u.id=p.user_id WHERE u.email=$1",
      [parentEmail],
    )
  ).rows[0];
  assert.ok(lead?.verified_at, "Google signup becomes a verified parent lead");
  assert.equal(lead.program, "az-esa");
  assert.equal(lead.newsletter, true, "signup opts in by default");
  assert.equal(lead.notice_version, "free-parent-account-v2");
  assert.equal(
    (
      await repository.pool.query(
        "SELECT count(*)::int AS n FROM amp_parent_followup_outbox WHERE user_id=$1",
        [lead.user_id],
      )
    ).rows[0].n,
    2,
  );
  await page.request.post(`${origin}/api/auth/sign-out`, {
    headers: { origin },
  });
  await context.clearCookies();
  parentEmail = `standard-parent-${Date.now()}@example.com`;

  // A cancelled provider screen returns to the same screen with a message
  // that overlays the page; the buttons do not move.
  await page.goto(`${origin}/sign-up`);
  const before = await measureStack(page, "before cancel");
  await page.getByRole("button", { name: "Continue with GitHub" }).click();
  await page.waitForURL(`${origin}/sign-up`);
  const alert = page.getByRole("alert");
  await alert.waitFor();
  assert.equal(
    (await alert.textContent())?.trim(),
    "Sign-in was cancelled. Choose a way to continue.",
  );
  assert.ok(
    await alert.evaluate((el) => {
      for (let node: Element | null = el; node; node = node.parentElement)
        if (getComputedStyle(node).position === "fixed") return true;
      return false;
    }),
    "the error overlays the page",
  );
  const after = await measureStack(page, "after cancel");
  assert.deepEqual(
    after.map((b) => b.y),
    before.map((b) => b.y),
    "buttons stay put when the error appears",
  );
  assert.equal(await shift(page), 0, "no layout shift with the error");
  assert.equal(new URL(page.url()).search, "", "the error is not replayed");
  await page.screenshot({
    path: new URL("social-sign-up-cancelled-390x844.png", shots).pathname,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Dismiss message" }).click();
  await alert.waitFor({ state: "detached" });
  assert.equal(await shift(page), 0, "no layout shift when dismissed");

  // A network failure before leaving AMP must not strand every sign-in button.
  await page.route("**/api/auth/sign-in/social", (route) =>
    route.abort("failed"),
  );
  await page.getByRole("button", { name: "Continue with Microsoft" }).click();
  await page.getByRole("alert").waitFor();
  assert.equal(
    await page.locator("button[data-provider]:disabled").count(),
    0,
    "provider buttons recover after a network failure",
  );
  await page.getByRole("button", { name: "Dismiss message" }).click();
  await page.unroute("**/api/auth/sign-in/social");

  // Registration points existing users to sign-in without discarding their email
  // or entitlement continuation, and a bad password explains provider recovery.
  await page.goto(`${origin}/sign-up?return=access&method=password`);
  await page.getByLabel("Email", { exact: true }).fill("returning@example.com");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(`${origin}/sign-in?return=access`);
  assert.equal(
    await page.getByLabel("Email", { exact: true }).inputValue(),
    "returning@example.com",
  );
  await page.route("**/api/auth/sign-in/email", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        code: "INVALID_EMAIL_OR_PASSWORD",
        message: "Invalid email or password",
      }),
    }),
  );
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    for (const size of sizes.filter((s) => s.width !== 384)) {
      await page.setViewportSize(size);
      await page
        .getByLabel("AMP password", { exact: true })
        .fill("not-an-AMP-password");
      const positions = await measureStack(page, "before failed password");
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      const feedback = page.getByRole("alert");
      await feedback.waitFor();
      assert.match(
        await feedback.innerText(),
        /sign-in method you used before/,
      );
      assert.equal(
        await feedback.evaluate((el) => el === document.activeElement),
        true,
        "error receives focus instead of hiding under the keyboard",
      );
      const box = await feedback.boundingBox();
      assert.ok(
        box && box.y >= 0 && box.y + box.height <= size.height,
        "feedback is visible in the viewport",
      );
      assert.deepEqual(
        (await measureStack(page, "after failed password")).map((b) => b.y + 0),
        positions.map((b) => b.y),
        "failed request does not reflow controls",
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.screenshot({
        path: new URL(`auth-error-${theme}-${size.width}.png`, shots).pathname,
        fullPage: true,
      });
      await page.getByRole("button", { name: "Dismiss message" }).click();
    }
  }
  await page.unroute("**/api/auth/sign-in/email");
  await page.setViewportSize(sizes[2]);
  await page.goto(`${origin}/sign-up`);

  // A new account sees explicit success before continuing learner setup.
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await page.getByRole("heading", { name: "Your account is ready" }).waitFor();
  await page.getByRole("link", { name: "Continue setup" }).click();
  await page.getByLabel("Learner name").waitFor();
  assert.match(new URL(page.url()).pathname, /^\/start/);
  const me = await page.evaluate(async () => {
    const session = await fetch("/api/auth/get-session").then((r) => r.json());
    return session?.user?.email;
  });
  assert.equal(me, parentEmail);
  await page.screenshot({
    path: new URL("social-sign-up-first-run-390x844.png", shots).pathname,
    fullPage: true,
  });
  // A returning learner must reach the real app, not only the signup screen.
  const user = (
    await repository.pool.query(
      "SELECT id FROM amp_auth_users WHERE email=$1",
      [parentEmail],
    )
  ).rows[0];
  const learnerId = randomUUID();
  await repository.pool.query(
    "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,'fixture','test-only','synthetic')",
    [`amp|${user.id}`],
  );
  await repository.pool.query(
    "INSERT INTO amp_learners(id,account_id,name,birth_year) VALUES($1,$2,'Test Learner',2008)",
    [learnerId, `amp|${user.id}`],
  );
  await repository.pool.query(
    "INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at) VALUES($1,$2,'pilot',$1,'active',now()-interval '1 hour',now()+interval '1 year')",
    [randomUUID(), learnerId],
  );
  await page.goto(`${origin}/`);
  await page
    .getByRole("heading", { name: "Test Learner", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Go", exact: true }).click();
  await page.locator("#problem-prompt").waitFor();
  // Simulate another person's saved learner selection on a shared device.
  await page.evaluate(() =>
    localStorage.setItem(
      "amp.learner",
      JSON.stringify({
        state: { learnerId: "another-account-learner" },
        version: 1,
      }),
    ),
  );
  await page.goto(`${origin}/`);
  await page
    .getByRole("heading", { name: "Test Learner", exact: true })
    .waitFor();
  await page.screenshot({
    path: new URL("returning-learner-home-390.png", shots).pathname,
    fullPage: true,
  });
  // Safari uses the same returning-account path on a new device (no local learner).
  const safari = await webkit.launch({ headless: true });
  try {
    const fresh = await safari.newContext({
      viewport: sizes[2],
      colorScheme: "dark",
    });
    await fresh.addCookies(await context.cookies(origin));
    const tab = await fresh.newPage();
    await tab.goto(`${origin}/`);
    await tab
      .getByRole("heading", { name: "Test Learner", exact: true })
      .waitFor();
    await tab.getByRole("button", { name: "Go", exact: true }).click();
    await tab.locator("#problem-prompt").waitFor();
    await tab.screenshot({
      path: new URL("returning-learner-webkit-390.png", shots).pathname,
      fullPage: true,
    });
    await fresh.close();
  } finally {
    await safari.close();
  }
  // First-run decisions use /me before rendering home. A returning assessment
  // goes straight to its problem, without painting home or learner setup.
  const snapshot = await (await page.request.get(`${origin}/api/v1/me`)).json();
  let entry = {
    ...snapshot,
    next: "try",
    learners: [],
    consent: { status: "none", method: null },
    family: {
      ...snapshot.family,
      learners: [],
      consent: { ...snapshot.family.consent, status: "not-recorded" },
    },
  };
  await page.route("**/api/v1/me", (route) => route.fulfill({ json: entry }));
  const trial = await (
    await page.request.post(`${origin}/api/v1/trials`, {
      data: { birthYear: 2012 },
    })
  ).json();
  await page.evaluate(
    (token) => localStorage.setItem("amp.trial", token),
    trial.token,
  );
  await page.addInitScript(() => {
    const destinations: string[] = [];
    (window as unknown as { __destinations: string[] }).__destinations =
      destinations;
    for (const method of ["pushState", "replaceState"] as const) {
      const original = history[method].bind(history);
      history[method] = (data, unused, url) => {
        if (url)
          destinations.push(new URL(String(url), location.href).pathname);
        return original(data, unused, url);
      };
    }
  });
  await page.goto(`${origin}/`);
  await page.waitForURL(`${origin}/try/practice`);
  await page
    .locator("#problem-prompt")
    .waitFor()
    .catch(async (error) => {
      console.error("Synthetic trial response", trial);
      console.error(
        "Synthetic failed screen",
        await page.locator("body").innerText(),
      );
      throw error;
    });
  const destinations = await page.evaluate(
    () => (window as unknown as { __destinations: string[] }).__destinations,
  );
  assert.ok(
    !destinations.some((path) => path === "/try" || path.startsWith("/start")),
    "assessment entry has no intermediate onboarding navigation",
  );

  // Explicit consent and purchase handoffs must win over that default route.
  await page.route("**/api/v1/consent", (route) =>
    route.fulfill({
      json: {
        available: false,
        consentActive: false,
        notice: null,
        noticeDigest: null,
        request: null,
        confirmationDelayHours: null,
      },
    }),
  );
  await page.goto(
    `${origin}/#consent=${randomUUID()}&stage=initial&token=${"A".repeat(43)}&notice=${"a".repeat(64)}`,
  );
  await page.waitForURL(`${origin}/consent`);
  await page
    .getByRole("heading", { name: "Learning consent", exact: true })
    .waitFor();
  entry = {
    ...snapshot,
    next: "choose-plan",
    learners: snapshot.learners.map((l: any) => ({
      ...l,
      entitlement: { ...l.entitlement, active: false },
    })),
  };
  const purchaseId = randomUUID();
  await page.route(`**/api/v1/billing/purchase/${purchaseId}`, (route) =>
    route.fulfill({ json: { learnerId } }),
  );
  await page.route("**/api/v1/billing/offer", (route) =>
    route.fulfill({ json: { available: false } }),
  );
  await page.goto(`${origin}/?billing=processing&purchase=${purchaseId}`);
  await page.waitForURL(`${origin}/purchase/annual`);
  await page
    .getByRole("heading", { name: "Annual access", exact: true })
    .waitFor();
  await page.waitForFunction(
    () => sessionStorage.getItem("amp.purchase-return.v1") === null,
  );
  assert.equal(new URL(page.url()).search, "");
  await page.evaluate(
    ({ purchaseId }) =>
      sessionStorage.setItem(
        "amp.purchase-return.v1",
        JSON.stringify({
          state: "processing",
          purchaseId,
          expiresAt: Date.now() + 60_000,
        }),
      ),
    { purchaseId },
  );
  await page.goto(`${origin}/`);
  await page.waitForURL(`${origin}/purchase/annual`);
  await page.unroute("**/api/v1/me");
  await page
    .getByRole("heading", { name: "Annual access", exact: true })
    .waitFor();
  await page.waitForFunction(
    () => sessionStorage.getItem("amp.purchase-return.v1") === null,
  );
  // Keep this document alive while another tab changes the shared account.
  // A consumed checkout must not be inherited by the newly mounted account.
  await page.evaluate(async () => {
    const modulePath = "/src/web/app/router.tsx";
    const { router } = await import(modulePath);
    await router.navigate({ to: "/" });
  });
  await page
    .getByRole("heading", { name: "Test Learner", exact: true })
    .waitFor();
  await page.unroute(`**/api/v1/billing/purchase/${purchaseId}`);
  let replayedPurchases = 0;
  page.on("request", (request) => {
    if (
      new URL(request.url()).pathname ===
      `/api/v1/billing/purchase/${purchaseId}`
    )
      replayedPurchases++;
  });
  const second = await page.request.post(`${origin}/api/auth/sign-up/email`, {
    headers: { origin },
    data: {
      email: `second-${Date.now()}@example.com`,
      password: "synthetic second account password",
      name: "Second account",
    },
  });
  assert.equal(second.status(), 200);
  const secondUser = (await second.json()).user;
  await repository.pool.query(
    "INSERT INTO amp_learners(id,account_id,name,birth_year) VALUES($1,$2,'Second Learner',2009)",
    [randomUUID(), `amp|${secondUser.id}`],
  );
  const otherTab = await context.newPage();
  await otherTab.goto(`${origin}/sign-in`);
  await otherTab.evaluate(() => {
    const channel = new BroadcastChannel("amp-account-session");
    channel.postMessage("changed");
    channel.close();
  });
  await page
    .getByRole("heading", { name: "Second Learner", exact: true })
    .waitFor();
  await page.waitForLoadState("networkidle");
  assert.equal(
    replayedPurchases,
    0,
    "a new account cannot inherit a consumed checkout return",
  );
  assert.equal(new URL(page.url()).pathname, "/");
  await otherTab.close();
  assert.deepEqual(errors, []);
  await context.close();
  console.log("Social sign-in UI verified.");
} finally {
  globalThis.fetch = realFetch;
  await browser.close();
  await vite.close();
  await app.close();
  await repository.pool.end();
}
