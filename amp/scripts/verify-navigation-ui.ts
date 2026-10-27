import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createServer } from "vite";
import { chromium, firefox, webkit } from "playwright";
import { fixtureMe } from "./me-fixture";
import { retentionNotice } from "../src/family/contracts";
import { skills } from "../src/curriculum/catalog";
import { templates, generateProblem } from "../src/math/engine";
import {
  assertProblemReachable,
  assertPhoneLandscapeSmoke,
} from "./ui-viewports";
const engine = process.env.AMP_ACCOUNT_BROWSER ?? "chromium";
// A deployed build can use the same synthetic API fixtures; no learner records
// or account mutations reach its server.
const remoteOrigin = process.env.AMP_NAVIGATION_ORIGIN;
const vite = remoteOrigin
  ? undefined
  : await createServer({ server: { host: "127.0.0.1", port: 0 } });
await vite?.listen();
const address = vite?.httpServer!.address();
assert(remoteOrigin || (address && typeof address !== "string"));
const origin =
  remoteOrigin ?? `http://127.0.0.1:${(address as { port: number }).port}`;
const browser = await (
  { chromium, firefox, webkit }[engine] ?? chromium
).launch();
const output = `artifacts/navigation-${remoteOrigin ? "deployed-" : ""}${engine}`;
await mkdir(output, { recursive: true });
const account = fixtureMe(
  {
    consent: {
      status: "active",
      policyVersion: "fixture",
      recordedAt: "2026-01-01",
      withdrawnAt: null,
    },
    retained: retentionNotice,
    learners: ["Jordan", "Avery"].map((name) => ({
      id: name.toLowerCase(),
      name,
      birthYear: 2016,
      deletedAt: null,
      access: [],
      stripeLinked: false,
      canPractice: true,
    })),
  },
  "amp|drawer-fixture",
);
const frontier = {
  expected: 4,
  overall: { level: 5.3, sd: 0.65, answered: 42, independent: 31 },
  strands: {},
};
const evidence = skills
  .filter((s) => ["3", "4", "5", "6", "algebra-1"].includes(s.gradeBand))
  .filter((_, i) => i % 5 === 0)
  .slice(0, 20)
  .map((s, i) => ({
    skillId: s.id,
    attempts: i + 5,
    independentCorrect: i % 5 === 0 ? 0 : i + 2,
    independentOccasions: 2,
    status: i % 3 === 0 && i % 5 ? "review-ready" : "practicing",
    reviewDueAt: null,
  }));
let signedIn = true,
  failMe = false,
  failProgress = false,
  failSignOut = false;
let template = "absolute-value-affine-equation";
const errors: string[] = [],
  requests: string[] = [];
try {
  const context = await browser.newContext();
  await context.addInitScript(
    `localStorage.setItem('amp.trial','synthetic-drawer-trial'); localStorage.setItem('amp.learner', JSON.stringify({state:{learnerId:'jordan'},version:1})); navigator.sendBeacon = function(){ return true; };`,
  );
  await context.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    requests.push(path);
    if (path === "/api/v1/auth-config")
      return route.fulfill({
        json: {
          mode: "accounts",
          passwords: true,
          providers: [],
          passkeySignup: true,
        },
      });
    if (path === "/api/auth/get-session")
      return route.fulfill({
        json: signedIn
          ? {
              session: {
                id: "fixture",
                token: "synthetic",
                userId: "drawer-fixture",
                expiresAt: "2099-01-01T00:00:00.000Z",
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-01T00:00:00.000Z",
              },
              user: {
                id: "drawer-fixture",
                name: "Sample parent",
                email: "parent@example.test",
                emailVerified: true,
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-01T00:00:00.000Z",
              },
            }
          : null,
      });
    if (path === "/api/v1/me")
      return failMe
        ? route.fulfill({ status: 503, json: { error: "unavailable" } })
        : route.fulfill({ json: account });
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
    if (path === "/api/v1/learners")
      return route.fulfill({
        json: { learners: [{ id: "trial-student", birthYear: 2016 }] },
      });
    if (path.endsWith("/trial-progress"))
      return route.fulfill({
        json: {
          phase: "practice",
          free: 100,
          placement: 10,
          remaining: 58,
          totals: { answered: 42, correct: 31, assisted: 2 },
          mastered: [],
          frontier: { placement: null, current: frontier },
        },
      });
    if (path.endsWith("/progress"))
      return failProgress
        ? route.fulfill({ status: 503, json: { error: "unavailable" } })
        : route.fulfill({
            json: {
              asOf: "2026-10-23T12:00:00Z",
              skills: path.includes("/avery/") ? [] : evidence,
            },
          });
    if (path.endsWith("/frontier")) return route.fulfill({ json: frontier });
    if (path.endsWith("/batches"))
      return route.fulfill({
        json: {
          problems: [generateProblem(template, "navigation-layout").public],
          trialRemaining: 58,
        },
      });
    if (path === "/api/auth/sign-out") {
      if (failSignOut)
        return route.fulfill({
          status: 503,
          json: { message: "Sign out failed" },
        });
      signedIn = false;
      return route.fulfill({ json: { success: true } });
    }
    if (path === "/api/v1/events")
      return route.fulfill({ status: 204, body: "" });
    return route.fulfill({
      status: 404,
      json: { error: "Synthetic route unavailable" },
    });
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  const drawer = page.getByRole("dialog", { name: "Adaptive Math Pathways" });
  const trigger = page.getByRole("button", { name: "Open AMP menu" });
  const identity = drawer.getByRole("region", { name: "Current account" });
  // Recorded sessions must never show the address: it is absent from the DOM
  // until the eye button reveals it, and every menu opening starts hidden.
  async function assertEmailHidden(label: string) {
    const show = identity.getByRole("button", { name: "Show email" });
    await show.waitFor();
    assert.equal(await show.getAttribute("aria-pressed"), "false", label);
    assert(
      !(await drawer.innerHTML()).includes("parent@example.test"),
      `${label}: email rendered while hidden`,
    );
  }
  async function fits(label: string) {
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `${label}: document overflow`,
    );
    if (await drawer.count()) {
      await drawer.evaluate(async (el) => {
        await Promise.all(el.getAnimations().map((a) => a.finished));
      });
      const box = (await drawer.boundingBox())!;
      assert(
        box.x >= -1 &&
          box.y >= -1 &&
          box.x + box.width <= page.viewportSize()!.width + 1 &&
          box.y + box.height <= page.viewportSize()!.height + 1,
        `${label}: drawer outside viewport ${JSON.stringify(box)}`,
      );
      assert(
        await drawer.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        `${label}: drawer horizontal overflow`,
      );
    }
  }
  for (const theme of ["light", "dark"] as const)
    for (const [width, height] of [
      [320, 568],
      [390, 844],
      [768, 1024],
      [1280, 900],
      [844, 390],
      [375, 667],
    ]) {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ colorScheme: theme });
      template =
        width === 375
          ? "causal-claim-choice"
          : width === 844
            ? "constraint-feasible"
            : "absolute-value-affine-equation";
      await page.goto(`${origin}/try/practice`);
      await page.locator(".problem-stage .question").waitFor();
      await trigger.waitFor();
      assert.equal(
        await page.getByRole("link", { name: "Your level" }).count(),
        0,
      );
      assert.equal(
        await page
          .locator(".workspace-toolbar > :first-child")
          .getAttribute("data-navigation-trigger"),
        "true",
      );
      assert(
        await page.locator(".workspace-topic-text").evaluate((el) => {
          const r = el.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(el);
          return [...range.getClientRects()].every(
            (t) =>
              t.left >= r.left - 1 &&
              t.right <= r.right + 1 &&
              t.top >= r.top - 1 &&
              t.bottom <= r.bottom + 1,
          );
        }),
        "full title readable",
      );
      if (width === 375)
        await assertProblemReachable(page, `drawer-${width}-${theme}`);
      if (width === 844)
        await assertPhoneLandscapeSmoke(page, `drawer-landscape-${theme}`);
      await page.screenshot({
        path: `${output}/practice-${theme}-${width}.png`,
      });
      await trigger.click();
      await assertEmailHidden(`drawer ${theme} ${width}`);
      await drawer.getByText("42", { exact: true }).waitFor();
      assert.equal(
        await drawer.getByLabel("Current learner").inputValue(),
        "trial",
        "assessment remains distinct from signed-in learner",
      );
      await fits(`drawer ${theme} ${width}`);
      await page.screenshot({
        path: `${output}/drawer-${theme}-${width}.png`,
        animations: "disabled",
      });
      const hiddenBox = await identity.boundingBox();
      await identity.getByRole("button", { name: "Show email" }).click();
      const hide = identity.getByRole("button", { name: "Hide email" });
      assert.equal(await hide.getAttribute("aria-pressed"), "true");
      const shown = identity.getByText("parent@example.test", { exact: true });
      await shown.waitFor();
      assert.equal(
        await shown.evaluate((el) => {
          const css = getComputedStyle(el);
          return `${css.whiteSpace} ${css.textOverflow}`;
        }),
        "nowrap ellipsis",
        "long addresses truncate on one line",
      );
      assert.deepEqual(
        await identity.boundingBox(),
        hiddenBox,
        `drawer ${theme} ${width}: revealing the email shifted layout`,
      );
      await fits(`drawer revealed ${theme} ${width}`);
      await page.mouse.move(0, 0);
      await page.screenshot({
        path: `${output}/drawer-revealed-${theme}-${width}.png`,
        animations: "disabled",
      });
      await page.keyboard.press("Escape");
      await page.waitForFunction(
        () =>
          document.activeElement?.getAttribute("aria-label") ===
          "Open AMP menu",
      );
      await trigger.click();
      await assertEmailHidden(`drawer reopened ${theme} ${width}`);
      await drawer
        .getByRole("link", { name: "Your inventory", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "Your inventory", exact: true })
        .waitFor();
      await page.locator('[data-strength="Strong"]').first().waitFor();
      assert.equal(new URL(page.url()).searchParams.get("context"), "trial");
      await fits(`inventory ${theme} ${width}`);
      const searchBox = await page
        .getByRole("searchbox", { name: "Search your skills" })
        .evaluate((el) => {
          const box = el.closest("label")!.getBoundingClientRect();
          return { y: box.y, height: box.height };
        });
      const areaBox = (await page
        .getByLabel("Math area", { exact: true })
        .boundingBox())!;
      if (width >= 380 && width !== 375) {
        assert(
          Math.abs(searchBox.y - areaBox.y) < 1,
          "inventory filters align",
        );
        assert(
          Math.abs(searchBox.height - areaBox.height) < 1,
          "inventory filters have equal height",
        );
      }
      if (width === 390) {
        const firstSkill = (await page
          .locator("[data-strength]")
          .first()
          .boundingBox())!;
        assert(
          firstSkill.y + firstSkill.height < height,
          "the first inventory skill is fully visible on a phone",
        );
      }
      await page.screenshot({
        path: `${output}/inventory-${theme}-${width}.png`,
        fullPage: width > 400,
        animations: "disabled",
      });
    }
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [1280, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto(`${origin}/inventory?context=trial`);
    await page
      .getByRole("navigation", { name: "Progress views" })
      .getByRole("link", { name: "Level", exact: true })
      .click();
    await page.locator(".frontier-map").waitFor();
    await fits(`level view ${width}`);
    await page.screenshot({
      path: `${output}/level-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("navigation", { name: "Progress views" })
      .getByRole("link", { name: "Pathways", exact: true })
      .click();
    await page.locator(".pathways-viewport").waitFor();
    await fits(`pathways ${width}`);
    assert(
      await page
        .locator(".pathways-header .pathways-go")
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      "map action text stays inside its button",
    );
    await page.screenshot({
      path: `${output}/pathways-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("navigation", { name: "Progress views" })
      .getByRole("link", { name: "Inventory", exact: true })
      .click();
    await page.locator('[data-strength="Strong"]').first().waitFor();
    assert.equal(
      new URL(page.url()).searchParams.get("context"),
      "trial",
      "all three progress views retain assessment context",
    );
  }
  failMe = true;
  await page.goto(`${origin}/inventory?context=trial`);
  await page.locator('[data-strength="Strong"]').first().waitFor();
  assert.equal(
    await page
      .getByRole("heading", { name: "Your inventory could not be loaded" })
      .count(),
    0,
    "an account outage cannot hide a working anonymous assessment",
  );
  await trigger.click();
  await page
    .getByRole("link", { name: "Account settings", exact: true })
    .waitFor();
  await page
    .getByRole("link", { name: "Manage learners", exact: true })
    .waitFor();
  await page.keyboard.press("Escape");
  failMe = false;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/inventory`);
  await page.locator('[data-strength="Strong"]').first().waitFor();
  await trigger.click();
  await page.getByLabel("Current learner").selectOption("avery");
  await page
    .getByRole("heading", { name: "Your collection starts with a problem" })
    .waitFor();
  assert.equal(
    await page.locator('[data-strength="Strong"]').count(),
    0,
    "learner switch removes previous learner's skills",
  );
  await trigger.click();
  await page.getByLabel("Current learner").selectOption("jordan");
  await page.locator('[data-strength="Strong"]').first().waitFor();
  await page.getByRole("searchbox", { name: "Search your skills" }).fill("L");
  await page.getByRole("searchbox", { name: "Search your skills" }).fill("");
  assert.equal(
    await page
      .getByRole("searchbox", { name: "Search your skills" })
      .inputValue(),
    "",
  );
  await page.getByRole("button", { name: /^Strong/ }).click();
  await page.reload();
  assert.equal(
    await page
      .getByRole("button", { name: /^Strong/ })
      .getAttribute("aria-pressed"),
    "true",
  );
  // Finish restoring the saved filter before deliberately reloading into an
  // error. WebKit reports a cancelled in-flight fetch as an access-control
  // error if the second reload interrupts the first page's account lookup.
  await page.locator('[data-strength="Strong"]').first().waitFor();
  failProgress = true;
  await page.reload();
  await page
    .getByRole("heading", { name: "Your inventory could not be loaded" })
    .waitFor();
  failProgress = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page.locator('[data-strength="Strong"]').first().waitFor();
  failSignOut = true;
  await trigger.click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Sign out did not finish" })
    .waitFor();
  await page.keyboard.press("Escape");
  signedIn = false;
  await page.goto(`${origin}/inventory?context=trial`);
  await trigger.click();
  await drawer.getByRole("link", { name: "Sign in", exact: true }).waitFor();
  await fits("guest drawer");
  await page.screenshot({ path: `${output}/drawer-guest.png` });
  const failedMenu = await context.newPage();
  await failedMenu.route(
    /\/DrawerContents(?:\.tsx|-[^/]+\.js)(?:\?.*)?$/,
    (route) => route.abort(),
  );
  await failedMenu.goto(`${origin}/try/practice`);
  await failedMenu.locator(".problem-stage .question").waitFor();
  const originalQuestion = await failedMenu
    .locator(".problem-stage .question")
    .textContent();
  await failedMenu.getByRole("button", { name: "Open AMP menu" }).click();
  await failedMenu
    .getByRole("alert")
    .filter({ hasText: "Your menu could not be loaded" })
    .waitFor();
  await failedMenu.getByRole("button", { name: "Close AMP menu" }).click();
  await failedMenu.waitForFunction(
    () =>
      document.activeElement?.getAttribute("aria-label") === "Open AMP menu",
  );
  assert.equal(
    await failedMenu.locator(".problem-stage .question").textContent(),
    originalQuestion,
    "failed menu load preserves the problem and escape",
  );
  await failedMenu.close();
  assert.equal(errors.length, 0, errors.join("\n"));
  assert(
    !requests.some((p) => /purchase|checkout/.test(p)),
    "navigation does not initiate purchases",
  );
  console.log(
    `Navigation and inventory (${engine}): responsive practice/drawer/inventory, identity, context, switching, search, refresh, recovery, keyboard focus and logout errors passed.`,
  );
} finally {
  await browser.close();
  await vite?.close();
}
