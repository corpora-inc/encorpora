import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, firefox, webkit, type Page } from "playwright";
import { createServer } from "vite";
import { fixtureMe } from "./me-fixture";
import { retentionNotice } from "../src/family/contracts";
import { skills } from "../src/curriculum/catalog";
import { templates } from "../src/math/engine";

// Real auth client, session broadcasts, router and menus; synthetic HTTP only.
const vite = await createServer({ server: { host: "127.0.0.1", port: 0 } });
await vite.listen();
const address = vite.httpServer!.address();
assert(address && typeof address !== "string");
const origin = `http://127.0.0.1:${address.port}`;
const engine = process.env.AMP_ACCOUNT_BROWSER ?? "chromium";
const browser = await (
  { chromium, firefox, webkit }[engine] ?? chromium
).launch();
const output = `artifacts/account-controls-${engine}`;
await mkdir(output, { recursive: true });
const identity = "amp|account-controls-fixture";
const email = "a.learner.with.a.long.email.address.for.layout@example.test";
const summary = fixtureMe(
  {
    consent: {
      status: "not-recorded",
      policyVersion: null,
      recordedAt: null,
      withdrawnAt: null,
    },
    learners: [],
    retained: retentionNotice,
  },
  identity,
);
summary.account.email = email;
let signedIn = true,
  access = false,
  failMe = false,
  failSignOut = false;
let holdSignOut: Promise<void> | null = null;
let releaseSignOut = () => {};
let notifications = 0,
  purchases = 0;
const errors: string[] = [];
async function fits(page: Page, label: string) {
  const geometry = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - innerWidth,
    controls: [
      ...document.querySelectorAll<HTMLElement>(
        "[data-account-control] button, [role=menuitem], [data-account-ready] a",
      ),
    ]
      .filter((el) => el.getClientRects().length)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          text: el.textContent,
          x: r.x,
          right: r.right,
          height: r.height,
        };
      }),
  }));
  assert(geometry.overflow <= 1, `${label}: horizontal overflow`);
  for (const c of geometry.controls) {
    assert(
      c.x >= -1 && c.right <= (page.viewportSize()?.width ?? 0) + 1,
      `${label}: clipped ${c.text}`,
    );
    assert(c.height >= 43, `${label}: small target ${c.text}`);
  }
}
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await context.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/auth-config")
      return route.fulfill({
        json: { mode: "accounts", passwords: true, providers: [] },
      });
    if (path === "/api/auth/get-session")
      return route.fulfill({
        json: signedIn
          ? {
              session: {
                id: "fixture-session",
                token: "synthetic-token",
                userId: "account-controls-fixture",
                expiresAt: "2099-01-01T00:00:00.000Z",
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-01T00:00:00.000Z",
              },
              user: {
                id: "account-controls-fixture",
                name: "Sample learner",
                email,
                emailVerified: true,
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-01T00:00:00.000Z",
              },
            }
          : null,
      });
    if (path === "/api/auth/sign-out") {
      if (holdSignOut) await holdSignOut;
      if (failSignOut)
        return route.fulfill({
          status: 503,
          json: { message: "Synthetic sign-out failure" },
        });
      signedIn = false;
      return route.fulfill({ json: { success: true } });
    }
    if (path === "/api/v1/me")
      return failMe
        ? route.fulfill({ status: 503, json: { error: "unavailable" } })
        : route.fulfill({
            json: {
              ...summary,
              next: access ? "practice" : "try",
              learners: access
                ? [
                    {
                      id: "sample-learner",
                      name: "Sample learner",
                      birthYear: 2008,
                      entitlement: {
                        active: true,
                        plan: null,
                        endsAt: "2027-01-01T00:00:00.000Z",
                      },
                    },
                  ]
                : [],
            },
          });
    if (path === "/api/v1/catalog")
      return route.fulfill({
        json: {
          skills,
          templates,
          lessons: [],
          mode: "hosted",
          trial: { free: 100, placement: 20 },
        },
      });
    if (path === "/api/v1/events")
      return route.fulfill({ status: 204, body: "" });
    if (/purchase|checkout/.test(path)) purchases++;
    return route.fulfill({
      status: 404,
      json: { error: "Synthetic route unavailable" },
    });
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.exposeFunction("recordAccountNotice", () => notifications++);
  await page.addInitScript(() => {
    window.addEventListener(
      "amp-account-session-changed",
      () => void (window as any).recordAccountNotice(),
    );
  });
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: width > 400 ? 900 : 844 });
      await page.goto(`${origin}/account/ready`);
      await page
        .getByRole("heading", { name: "Your account is ready" })
        .waitFor();
      const next = page.getByRole("link", { name: "Continue free assessment" });
      await next.waitFor();
      assert.equal(await next.getAttribute("href"), "/try");
      await fits(page, `ready ${theme} ${width}`);
      await page.getByRole("button", { name: "Account menu" }).click();
      await page
        .getByRole("menuitem", { name: "Sign out", exact: true })
        .waitFor();
      await page.getByText(email, { exact: true }).waitFor();
      await fits(page, `menu ${theme} ${width}`);
      await page.screenshot({
        path: `${output}/ready-menu-${theme}-${width}.png`,
        fullPage: true,
        animations: "disabled",
      });
      await page.keyboard.press("Escape");
      await page.waitForFunction(
        () =>
          document.activeElement?.getAttribute("aria-label") === "Account menu",
      );
    }
  }
  access = true;
  await page.reload();
  await page.getByRole("link", { name: "Continue learning" }).waitFor();
  assert.equal(
    await page
      .getByRole("link", { name: "Continue learning" })
      .getAttribute("href"),
    "/practice",
  );
  access = false;
  await page.evaluate(() =>
    localStorage.setItem(
      "amp.trial.plan",
      JSON.stringify({ interval: "year", at: Date.now() }),
    ),
  );
  await page.reload();
  await page.getByRole("link", { name: "Continue setup" }).waitFor();
  await page.evaluate(() => localStorage.removeItem("amp.trial.plan"));
  failMe = true;
  await page.reload();
  await page
    .getByRole("alert")
    .filter({ hasText: "Your account details could not be loaded" })
    .waitFor();
  failMe = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page.getByRole("link", { name: "Continue free assessment" }).waitFor();
  const sibling = await context.newPage();
  await sibling.goto(`${origin}/account/ready`);
  await sibling
    .getByRole("heading", { name: "Your account is ready" })
    .waitFor();
  // Failed logout leaves the account and current page usable; retry is visible.
  failSignOut = true;
  holdSignOut = new Promise((resolve) => {
    releaseSignOut = resolve;
  });
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out", exact: true }).click();
  await page
    .getByRole("button", { name: "Signing out", exact: true })
    .waitFor();
  assert.equal(notifications, 0);
  releaseSignOut();
  holdSignOut = null;
  await page
    .getByRole("alert")
    .filter({ hasText: "Sign out did not finish" })
    .waitFor();
  assert.equal(signedIn, true);
  await page.getByRole("button", { name: "Dismiss message" }).click();
  // Real successful logout publishes the session change before navigating away.
  failSignOut = false;
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out", exact: true }).click();
  await page.waitForURL(`${origin}/`, { waitUntil: "load" });
  await page.getByRole("button", { name: "Try free", exact: true }).waitFor();
  assert(notifications >= 1, "successful sign-out broadcasts account change");
  assert.equal(signedIn, false);
  await sibling
    .getByRole("heading", { name: "Sign in", exact: true })
    .waitFor();
  await sibling.close();
  await page.goto(`${origin}/pathways?topic=linear`);
  await page.getByRole("searchbox", { name: "Find a skill" }).waitFor();
  const search = page.getByRole("searchbox", { name: "Find a skill" });
  await search.focus();
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign in", exact: true }).waitFor();
  await fits(page, "guest map menu");
  await page.keyboard.press("Escape");
  assert.equal(await search.inputValue(), "linear");
  assert.equal(
    await page.getByRole("button", { name: /Close/ }).count(),
    1,
    "menu Escape preserves open skill results",
  );
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Create account" }).click();
  await page.getByRole("heading", { name: "Create your account" }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/sign-up");
  assert.equal(purchases, 0, "account actions never create a purchase");
  assert.deepEqual(errors, []);
  console.log(
    `Account controls (${engine}): responsive identity/menu, signup landing, access/setup routing, failed/successful logout, session notice and guest map actions passed.`,
  );
  await context.close();
} finally {
  await browser.close();
  await vite.close();
}
