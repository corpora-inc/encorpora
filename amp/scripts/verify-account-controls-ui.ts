import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, firefox, webkit, type Page } from "playwright";
import { createServer } from "vite";
import { fixtureMe } from "./me-fixture";
import {
  assertProblemReachable,
  assertPhoneLandscapeSmoke,
} from "./ui-viewports";
import { retentionNotice } from "../src/family/contracts";
import { skills } from "../src/curriculum/catalog";
import { templates, generateProblem } from "../src/math/engine";
import { problemLesson } from "../src/content/problem-lessons";

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
const denseCausal = Array.from({ length: 64 }, (_, index) =>
  generateProblem("causal-claim-choice", `answer-dock-1536-${index}`),
).sort(
  (a, b) =>
    JSON.stringify(b.public.response).length -
    JSON.stringify(a.public.response).length,
)[0]!;
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
let practiceTemplate = "two-step-equation";
let signedIn = true,
  hasTrial = true,
  access = false,
  failMe = false,
  failSignOut = false;
let holdSignOut: Promise<void> | null = null;
let releaseSignOut = () => {};
let notifications = 0,
  purchases = 0;
const errors: string[] = [];
async function fits(page: Page, label: string) {
  const drawer = page.getByRole("dialog", { name: "Adaptive Math Pathways" });
  if (await drawer.count())
    await drawer.evaluate(async (el) => {
      await Promise.all(el.getAnimations().map((a) => a.finished));
    });
  const geometry = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - innerWidth,
    controls: [
      ...document.querySelectorAll<HTMLElement>(
        "[data-navigation-trigger], [role=dialog] a, [role=dialog] button, [data-account-ready] a",
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
        json: {
          mode: "accounts",
          passwords: true,
          providers: ["google", "apple", "microsoft", "github"],
          passkeySignup: true,
        },
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
          trial: { free: 100, placement: 10 },
        },
      });
    if (path === "/api/v1/trials/current")
      return route.fulfill({
        json: {
          trial:
            signedIn && hasTrial
              ? {
                  token: "synthetic-practice-layout",
                  learnerId: "account-practice-learner",
                  birthYear: 2008,
                  expiresAt: "2099-01-01T00:00:00.000Z",
                }
              : null,
        },
      });
    if (path === "/api/v1/learners")
      return route.fulfill({
        json: {
          learners: [{ id: "account-practice-learner", birthYear: 2008 }],
        },
      });
    if (path.endsWith("/trial-progress"))
      return route.fulfill({
        json: {
          phase: "practice",
          free: 100,
          placement: 10,
          remaining: 85,
          totals: { answered: 15, correct: 12, assisted: 0 },
          mastered: [],
          frontier: {
            placement: null,
            current: {
              expected: 10,
              overall: { level: 8, sd: 0.8, answered: 15, independent: 12 },
              strands: {},
            },
          },
        },
      });
    if (path.endsWith("/progress"))
      return route.fulfill({
        json: { asOf: "2026-01-01T00:00:00.000Z", skills: [] },
      });
    if (path.endsWith("/batches"))
      return route.fulfill({
        json: {
          problems: [
            practiceTemplate === "causal-claim-choice"
              ? denseCausal.public
              : generateProblem(practiceTemplate, "practice-account-1529")
                  .public,
          ],
          trialRemaining: 85,
        },
      });
    if (path.includes("/problem-lessons/"))
      return route.fulfill({
        json: {
          lesson: problemLesson(
            path.split("/").pop()!,
            "practice-account-1529",
          ),
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
  // Account controls must be reviewed inside the complete practice view.
  for (const authenticated of [true, false]) {
    signedIn = authenticated;
    for (const theme of ["light", "dark"] as const) {
      for (const width of [1280, 390, 320, 375, 768, 560, 844]) {
        practiceTemplate =
          width === 375
            ? "causal-claim-choice"
            : width === 844
              ? "constraint-feasible"
              : width === 390 || width === 320
                ? "absolute-value-affine-equation"
                : "two-step-equation";
        const practice = await context.newPage();
        await practice.emulateMedia({ colorScheme: theme });
        await practice.setViewportSize({
          width,
          height:
            width === 1280
              ? 900
              : width === 375
                ? 667
                : width === 320
                  ? 568
                  : width === 844
                    ? 390
                    : 844,
        });
        await practice.goto(`${origin}/sign-in`);
        await practice
          .getByRole("heading", { name: "Sign in", exact: true })
          .waitFor();
        await practice.evaluate(() =>
          localStorage.setItem("amp.trial", "synthetic-practice-layout"),
        );
        await practice.goto(`${origin}/try/practice`);
        if (!authenticated) {
          await practice
            .getByRole("heading", {
              name: "Math that adapts as you answer.",
              exact: true,
            })
            .waitFor();
          assert.equal(new URL(practice.url()).pathname, "/sign-up");
          await fits(practice, `practice signup ${theme} ${width}`);
          await practice.close();
          continue;
        }
        await practice.locator(".problem-stage .question").waitFor();
        await practice
          .getByRole("button", { name: "Open AMP menu", exact: true })
          .waitFor();
        await fits(practice, `practice ${authenticated} ${theme} ${width}`);
        if (width === 844)
          await assertPhoneLandscapeSmoke(
            practice,
            `constraint-feasible-${authenticated}-${theme}-844x390`,
          );
        if (width === 375)
          await assertProblemReachable(
            practice,
            `causal-claim-account-${authenticated}-${theme}-375x667`,
          );
        const treatment = await practice
          .locator(".workspace-toolbar")
          .evaluate((toolbar) => {
            const trigger = toolbar.querySelector<HTMLElement>(
              "[data-navigation-trigger]",
            )!;
            const title = toolbar.querySelector<HTMLElement>(
              ".workspace-topic-text",
            )!;
            const rect = trigger.getBoundingClientRect();
            const titleBox = title.getBoundingClientRect();
            const range = document.createRange();
            range.selectNodeContents(title);
            return {
              width: rect.width,
              height: rect.height,
              first: toolbar.firstElementChild === trigger,
              titleWrap: getComputedStyle(title).whiteSpace,
              titleVisible: [...range.getClientRects()].every(
                (r) =>
                  r.left >= titleBox.left - 1 &&
                  r.right <= titleBox.right + 1 &&
                  r.top >= titleBox.top - 1 &&
                  r.bottom <= titleBox.bottom + 1,
              ),
            };
          });
        assert(treatment.width >= 44 && treatment.height >= 44);
        assert.equal(
          treatment.first,
          true,
          "one navigation control at the left",
        );
        assert.notEqual(treatment.titleWrap, "nowrap");
        assert(treatment.titleVisible, "full skill title is readable");
        await practice.screenshot({
          path: `${output}/practice-${authenticated ? "signed-in" : "guest"}-${theme}-${width}.png`,
          animations: "disabled",
          fullPage: true,
        });
        await practice
          .getByRole("button", { name: "Open AMP menu", exact: true })
          .click();
        await practice
          .getByRole(authenticated ? "button" : "link", {
            name: authenticated ? "Sign out" : "Sign in",
            exact: true,
          })
          .waitFor();
        await fits(
          practice,
          `practice menu ${authenticated} ${theme} ${width}`,
        );
        if (width === 390)
          await practice.screenshot({
            path: `${output}/practice-menu-${authenticated ? "signed-in" : "guest"}-${theme}-${width}.png`,
            animations: "disabled",
            fullPage: true,
          });
        await practice.close();
      }
    }
  }
  signedIn = true;
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
      await page.getByRole("button", { name: "Open AMP menu" }).click();
      await page
        .getByRole("button", { name: "Sign out", exact: true })
        .waitFor();
      const identity = page
        .getByRole("dialog")
        .getByRole("region", { name: "Current account" });
      await identity.getByRole("button", { name: "Show email" }).click();
      await identity.getByText(email, { exact: true }).waitFor();
      await fits(page, `menu ${theme} ${width}`);
      await page.screenshot({
        path: `${output}/ready-menu-${theme}-${width}.png`,
        fullPage: true,
        animations: "disabled",
      });
      await page.keyboard.press("Escape");
      await page.waitForFunction(
        () =>
          document.activeElement?.getAttribute("aria-label") ===
          "Open AMP menu",
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
  await page.getByRole("button", { name: "Open AMP menu" }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page
    .getByRole("button", { name: "Signing out…", exact: true })
    .waitFor();
  assert.equal(notifications, 0);
  releaseSignOut();
  holdSignOut = null;
  await page
    .getByRole("alert")
    .filter({ hasText: "Sign out did not finish" })
    .waitFor();
  assert.equal(signedIn, true);
  await page.keyboard.press("Escape");
  // Real successful logout publishes the session change before navigating away.
  failSignOut = false;
  await page.getByRole("button", { name: "Open AMP menu" }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.waitForURL(`${origin}/`, { waitUntil: "load" });
  await page
    .getByRole("button", {
      name: /Try free|Continue free practice/,
      exact: true,
    })
    .waitFor();
  assert(notifications >= 1, "successful sign-out broadcasts account change");
  assert.equal(signedIn, false);
  await sibling
    .getByRole("heading", { name: "Sign in", exact: true })
    .waitFor();
  await sibling.close();
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto(`${origin}/pathways?topic=linear`);
  await page.getByRole("searchbox", { name: "Find a skill" }).waitFor();
  const search = page.getByRole("searchbox", { name: "Find a skill" });
  await page
    .getByText(
      "Explore the curriculum. Start a free assessment to illuminate your skills.",
      {
        exact: true,
      },
    )
    .waitFor({ state: "attached" });
  const accountBox = (await page
    .getByRole("button", { name: "Open AMP menu" })
    .boundingBox())!;
  assert(
    accountBox.width >= 44 && accountBox.height >= 44,
    "map navigation has a full touch target",
  );
  await search.focus();
  await page.getByRole("button", { name: "Open AMP menu" }).click();
  await page.getByRole("link", { name: "Sign in", exact: true }).waitFor();
  await fits(page, "guest map menu");
  await page.keyboard.press("Escape");
  assert.equal(await search.inputValue(), "linear");
  assert.equal(
    await page.getByRole("button", { name: /Close/ }).count(),
    1,
    "menu Escape preserves open skill results",
  );
  await page.getByRole("button", { name: "Open AMP menu" }).click();
  await page.getByRole("link", { name: "Create account" }).click();
  await page.getByRole("heading", { name: "Create your account" }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/sign-up");
  await page.addInitScript(
    "Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async function(text) { window.copiedShareText = text; } } });",
  );
  signedIn = true;
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
      await page.goto(`${origin}/try/map`);
      await page
        .getByRole("button", { name: "Share your assessment", exact: true })
        .click();
      const dialog = page.getByRole("dialog", {
        name: "Share your assessment",
      });
      await dialog.waitFor();
      const facebook = dialog.getByRole("link", { name: "Share on Facebook" });
      assert.equal(
        new URL((await facebook.getAttribute("href"))!).searchParams.get("u"),
        "https://amp.corpora.inc/try",
      );
      await dialog.getByRole("link", { name: "Save map image" }).waitFor();
      await dialog
        .getByRole("button", { name: "Copy link", exact: true })
        .click();
      await page.waitForFunction(
        () => (window as any).copiedShareText === "https://amp.corpora.inc/try",
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      for (const control of await dialog.locator("a,button").all()) {
        const box = await control.boundingBox();
        assert(
          box && box.width >= 44 && box.height >= 44,
          "share controls retain touch targets",
        );
      }
      await page.screenshot({
        path: `${output}/share-panel-${theme}-${width}.png`,
        animations: "disabled",
        fullPage: false,
      });
      if (width === 390 && theme === "light") {
        const [download] = await Promise.all([
          page.waitForEvent("download"),
          dialog.getByRole("link", { name: "Save map image" }).click(),
        ]);
        assert.equal(download.suggestedFilename(), "amp-pathways.png");
      }
      await dialog.getByRole("button", { name: "Close", exact: true }).click();
      await page
        .getByRole("button", { name: "Share your assessment", exact: true })
        .waitFor();
    }
  }
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await page.setViewportSize({ width: 390, height: 844 });
    // This screen set represents a parent who has not started a trial.
    hasTrial = false;
    for (const [path, heading] of [
      ["/sign-in", "Sign in"],
      ["/sign-up", "Create your account"],
      ["/sign-in/forgot", "Reset your password"],
      ["/try", "See how AMP adapts"],
    ]) {
      if (path === "/try")
        await page.evaluate(() => localStorage.removeItem("amp.trial"));
      await page.goto(`${origin}${path}`);
      await page.getByRole("heading", { name: heading, exact: true }).waitFor();
      await fits(page, `${path} ${theme}`);
      await page.screenshot({
        path: `${output}/screen-${path.replaceAll("/", "-")}-${theme}-390.png`,
        animations: "disabled",
        fullPage: true,
      });
    }
  }
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
