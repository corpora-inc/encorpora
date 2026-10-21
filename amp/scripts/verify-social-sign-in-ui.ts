import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, type Browser, type Page } from "playwright";
import { createServer } from "vite";
import { exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import { generateKeyPairSync } from "node:crypto";
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
 * "Create your parent account" at phone, small-phone and desktop sizes in
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
const parentEmail = `provider-parent-${Date.now()}@example.com`;
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
      name: path === "/sign-up" ? "Create your parent account" : "Sign in",
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
  // The longest translations still fit the narrowest phone.
  for (const lang of ["de", "fi", "ta", "ml", "ar", "ja"])
    await checkScreen(browser, "/sign-up", "light", sizes[0], lang);

  const context = await browser.newContext({ viewport: sizes[2] });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(recordShifts);
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

  // A new parent signs up with Google and goes straight into the first run.
  await page.getByRole("button", { name: "Continue with Google" }).click();
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
