import { secureChromium } from "../browser-security.mjs";
import { chooseLearner, openMenu } from "./ui-controls";
import {
  FIXTURE_FAMILY_ID,
  fixtureFamilies,
  fixtureChildProgress,
  fixtureFamilyProjection,
} from "./family-space-fixture";
import { fixtureMe } from "./me-fixture";
import { defaultPracticeSettings } from "../src/learning/practice-settings";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium as rawChromium, webkit, type Page } from "playwright";
const chromium = secureChromium(rawChromium);
import { createServer } from "vite";
import {
  retentionNotice,
  type FamilySummary,
} from "../src/family/contracts.js";

// Only the external identity adapter is replaced. The real App, FamilyCenter,
// effects, request guards and rendered UI execute unchanged.
/** `AMP_SESSION_UI_PORT` keeps parallel local runs apart. */
const sessionPort = Number(process.env.AMP_SESSION_UI_PORT ?? 4370);
const authPath = fileURLToPath(new URL("../src/web/auth.ts", import.meta.url));
const fixtureSource = `
let resolve, reject, current;
let checked = false;
const pending = new Promise((yes,no)=>{resolve=yes;reject=no;});
pending.catch(()=>{});
const subscribers = new Set();
window.sessionReview = {
  get ready(){return subscribers.size > 0;},
  emit(session){checked=true;current=session;for(const subscriber of subscribers) subscriber(session);},
  resolve(session){resolve(session);},
  reject(){reject(new Error('obsolete bootstrap error'));}
};
export function accessSession(){return checked ? Promise.resolve(current) : pending;}
export function onSessionChanged(callback){subscribers.add(callback);return ()=>subscribers.delete(callback);}
export async function signIn(){}export function notifyAccountSessionChanged(){void accessSession().then(session=>window.sessionReview.emit(session));}
export async function signOut(){window.sessionReview.emit(null);}export async function authConfig(){return {mode:"oidc"};}
`;
const vite = await createServer({
  root: fileURLToPath(new URL("../", import.meta.url)),
  configFile: fileURLToPath(new URL("../vite.config.ts", import.meta.url)),
  plugins: [
    {
      name: "controlled-session-review",
      enforce: "pre",
      load(id) {
        return id.split("?")[0] === authPath ? fixtureSource : undefined;
      },
    },
  ],
  server: { host: "127.0.0.1", port: sessionPort, strictPort: true },
});
await vite.listen();
const browser = await (
  process.env.AMP_BROWSER === "webkit" ? webkit : chromium
).launch({ headless: true });
function summary(name: string, id = "current-child"): FamilySummary {
  return {
    consent: {
      status: "active",
      policyVersion: "fixture",
      recordedAt: "2026-01-01T00:00:00Z",
      withdrawnAt: null,
    },
    learners: [{ id, name, deletedAt: null, access: [], stripeLinked: false }],
    retained: retentionNotice,
  };
}
/** Another account's family: the obsolete and old sessions'. */
const OTHER_FAMILY = "00000000-0000-4000-8000-00000000fa0f";
const familyOf = (token: string) =>
  ["Bearer current-token", "Bearer new-token"].includes(token)
    ? FIXTURE_FAMILY_ID
    : OTHER_FAMILY;
/** The family's projection of a summary's children; the parent may rename. */
function projectionOf(summary: FamilySummary, familyId: string) {
  const projection = fixtureFamilyProjection(
    summary.learners.map((learner) => ({
      id: learner.id,
      name: learner.name,
      birthYear: learner.birthYear ?? null,
    })),
    familyId,
  );
  return {
    ...projection,
    children: projection.children.map((child) => ({
      ...child,
      capabilities: { ...child.capabilities, rename: true },
    })),
  };
}
/** The children the drawer lists, by id (a family's rows). */
async function drawerChildren(page: Page) {
  const drawer = await openMenu(page);
  const ids = await drawer
    .locator('a[href*="/kids/"]')
    .evaluateAll((links) =>
      links.map((link) => link.getAttribute("href")!.split("/kids/")[1]),
    );
  await page.keyboard.press("Escape");
  await drawer.waitFor({ state: "detached" });
  return ids;
}
/** A name the screen shows (Today's rows, a child's page). */
const named = (page: Page, name: string) =>
  page.getByRole("main").getByText(name, { exact: true });
async function settledRender(page: Page) {
  // Resolve queued promise continuations and React commits without a fixed sleep.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}
async function fixturePage(family: (token: string) => FamilySummary) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors: string[] = [];
  const familyTokens: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (/^\/api\/v1\/catalog(?:\/map)?$/.test(path))
      return route.fulfill({
        json: { templates: [], lessons: [], skills: [], mode: "fixture" },
      });
    if (path === "/api/v1/families" || path.startsWith("/api/v1/families/")) {
      const token = route.request().headers().authorization ?? "";
      familyTokens.push(token);
      const id = familyOf(token);
      if (path === "/api/v1/families")
        return route.fulfill({ json: fixtureFamilies(id) });
      if (path === `/api/v1/families/${id}`)
        return route.fulfill({ json: projectionOf(family(token), id) });
      const record = path.match(
        new RegExp(`^/api/v1/families/${id}/children/([^/]+)/progress$`),
      );
      const child = family(token).learners.find(
        (learner) => learner.id === record?.[1],
      );
      if (child)
        return route.fulfill({
          json: fixtureChildProgress(child.id, child.name),
        });
      return route.fulfill({ status: 404, json: { error: "not_found" } });
    }
    if (path === "/api/v1/me") {
      const token = route.request().headers().authorization ?? "";
      familyTokens.push(token);
      return route.fulfill({
        json: fixtureMe(
          family(token),
          token === "Bearer current-token"
            ? "current-parent"
            : "obsolete-parent",
        ),
      });
    }
    if (path.endsWith("/books")) return route.fulfill({ json: { books: [] } });
    // Practice preloads its settings (for "Mixed practice" in feedback).
    if (path.endsWith("/practice-state") && route.request().method() === "GET")
      return route.fulfill({ json: defaultPracticeSettings() });
    if (path.endsWith("/progress"))
      return route.fulfill({
        json: { asOf: "2026-01-01T00:00:00Z", skills: [] },
      });
    if (path.endsWith("/frontier"))
      return route.fulfill({
        json: {
          expected: 4,
          overall: { level: 4, sd: 2.5, answered: 0, independent: 0 },
          strands: {},
        },
      });
    if (path === "/api/v1/events/context" && route.request().method() === "GET")
      return route.fulfill({ json: { generation: "initial" } });
    // First-party funnel beacons (verified in verify-funnel-ui).
    if (path === "/api/v1/events")
      return route.fulfill({ status: 202, json: { accepted: 1 } });
    errors.push(`Unexpected API request ${route.request().method()} ${path}`);
    return route.fulfill({
      status: 404,
      json: { error: "unexpected_fixture_request" },
    });
  });
  return { page, errors, familyTokens };
}
async function open(page: Page, path = "/") {
  await page.goto(`http://127.0.0.1:${sessionPort}${path}`);
  await page.waitForFunction(() => (window as any).sessionReview?.ready);
}
try {
  for (const outcome of ["resolve", "reject"] as const) {
    const { page, errors, familyTokens } = await fixturePage((token) =>
      token === "Bearer current-token"
        ? summary("Current learner")
        : summary("Obsolete learner", "old-child"),
    );
    try {
      await open(page);
      const beforeCurrent = familyTokens.length;
      await page.evaluate(() =>
        (window as any).sessionReview.emit({
          token: "current-token",
          accountId: "current-parent",
        }),
      );
      // The family's Today names the current account's child; the drawer
      // lists that family's children only.
      await named(page, "Current learner").first().waitFor();
      assert.deepEqual(await drawerChildren(page), ["current-child"]);
      await page.evaluate((result) => {
        const fixture = (window as any).sessionReview;
        if (result === "resolve")
          fixture.resolve({
            token: "obsolete-token",
            accountId: "obsolete-parent",
          });
        else fixture.reject();
      }, outcome);
      await settledRender(page);
      assert.deepEqual(await drawerChildren(page), ["current-child"]);
      await named(page, "Current learner").first().waitFor();
      assert.equal(await named(page, "Obsolete learner").count(), 0);
      assert.ok(
        familyTokens.length > beforeCurrent,
        "the current session performs authenticated account reads",
      );
      for (const token of familyTokens)
        assert.equal(
          token,
          "Bearer current-token",
          "every account read uses the current bearer",
        );
      assert.ok(
        !(await page.locator("body").innerText()).includes(
          "obsolete bootstrap error",
        ),
      );
      assert.deepEqual(errors, []);
    } finally {
      await page.close();
    }
  }
  // Control: a real bootstrap error must be displayed when no newer event exists.
  {
    const { page, errors } = await fixturePage(() => summary("Unused"));
    try {
      await open(page);
      await page.evaluate(() => (window as any).sessionReview.reject());
      await page
        .getByRole("alert")
        .filter({ hasText: "This screen could not be loaded." })
        .waitFor();
      await page
        .getByRole("button", { name: "Try again", exact: true })
        .waitFor();
      assert.ok(
        !(await page.locator("body").innerText()).includes(
          "obsolete bootstrap error",
        ),
      );
      assert.deepEqual(errors, []);
    } finally {
      await page.close();
    }
  }
  // Hold the root's first metadata fetch while the real FamilyCenter loads and
  // renames the child. Releasing its old snapshot must not undo that newer view.
  for (const outcome of ["snapshot", "error"] as const) {
    let family = summary("Before rename");
    const { page, errors } = await fixturePage(() => structuredClone(family));
    let release!: () => void, sawHeld!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const held = new Promise<void>((resolve) => {
      sawHeld = resolve;
    });
    let requests = 0;
    let networkDone!: Promise<"finished" | "failed">;
    let finishHandler!: () => void;
    const handlerDone = new Promise<void>((resolve) => {
      finishHandler = resolve;
    });
    await page.route("**/api/v1/me", async (route) => {
      const snapshot = structuredClone(family);
      requests++;
      const isHeld = requests === 2;
      try {
        if (isHeld) {
          const request = route.request();
          // Mutation refresh cancels this exact query. Chromium may report an
          // aborted request instead of a response; an unrelated /me is not proof.
          networkDone = Promise.race([
            page
              .waitForEvent("requestfinished", {
                predicate: (value) => value === request,
              })
              .then(() => "finished" as const),
            page
              .waitForEvent("requestfailed", {
                predicate: (value) => value === request,
              })
              .then(() => "failed" as const),
          ]);
          sawHeld();
          await released;
          if (outcome === "error") {
            await route.fulfill({
              status: 503,
              json: { error: "obsolete_family_error" },
            });
            return;
          }
        }
        await route.fulfill({ json: fixtureMe(snapshot, "current-parent") });
      } finally {
        if (isHeld) finishHandler();
      }
    });
    await page.route(
      "**/api/v1/family/learners/current-child/rename",
      async (route) => {
        assert.equal(route.request().method(), "POST");
        assert.equal(
          route.request().headers().authorization,
          "Bearer current-token",
        );
        assert.deepEqual(route.request().postDataJSON(), {
          name: "After rename",
        });
        family = summary("After rename");
        await route.fulfill({ json: { renamed: true } });
      },
    );
    try {
      await open(page);
      await page.evaluate(() =>
        (window as any).sessionReview.emit({
          token: "current-token",
          accountId: "current-parent",
        }),
      );
      await page.locator("[data-app-logo]").waitFor();
      // The child's own page holds their name (docs/architecture/spaces.md).
      await chooseLearner(page, "current-child");
      await held;
      await page
        .getByRole("heading", { name: "Before rename", exact: true })
        .waitFor();
      await page.getByRole("button", { name: "Change", exact: true }).click();
      await page.getByLabel("Name", { exact: true }).fill("After rename");
      await page
        .getByRole("button", { name: "Save name", exact: true })
        .click();
      // Its toast says so.
      await page.getByText("Name saved.", { exact: true }).waitFor();
      await page
        .getByRole("heading", { name: "After rename", exact: true })
        .waitFor();
      release();
      await handlerDone;
      console.log(`Held ${outcome} request: ${await networkDone}`);
      await settledRender(page);
      // The rename's refresh read /me again after the held read (the child's
      // name itself comes from the family's projection now).
      assert.ok(requests >= 3, `account reads: ${requests}`);
      assert.equal(
        await page
          .getByRole("alert")
          .filter({ hasText: "obsolete_family_error" })
          .count(),
        0,
      );
      assert.equal(
        await page
          .getByRole("heading", { name: "After rename", exact: true })
          .count(),
        1,
      );
      assert.equal(
        await page.getByRole("heading", { name: /Before rename/ }).count(),
        0,
      );
      assert.deepEqual(errors, []);
    } finally {
      release();
      await page.close();
    }
  }
  {
    const { page, errors } = await fixturePage((token) =>
      token === "Bearer old-token"
        ? summary("Old learner", "old-child")
        : summary("Current learner"),
    );
    let arrived!: () => void, release!: () => void;
    const received = new Promise<void>((resolve) => {
      arrived = resolve;
    });
    const proceed = new Promise<void>((resolve) => {
      release = resolve;
    });
    try {
      // A birth year saved for the old account cannot land on the new one.
      // The API's birth-year write, not the question's own address.
      await page.route("**/api/v1/learners/*/birth-year", async (route) => {
        arrived();
        await proceed;
        await route.fulfill({ json: { birthYear: 2016 } });
      });
      // The birth-year question has its own address (/profile/birth-year).
      await open(page, "/profile/birth-year");
      await page.evaluate(() =>
        (window as any).sessionReview.emit({
          token: "old-token",
          accountId: "old-parent",
        }),
      );
      await page
        .getByRole("heading", { name: "What year was Old learner born?" })
        .waitFor();
      await page.getByRole("button", { name: "2016", exact: true }).click();
      await received;
      await page.evaluate(() =>
        (window as any).sessionReview.emit({
          token: "new-token",
          accountId: "current-parent",
        }),
      );
      await page.getByRole("heading", { name: /Current learner/ }).waitFor();
      const oldResponse = page.waitForResponse((response) =>
        response.url().endsWith("/birth-year"),
      );
      release();
      await (await oldResponse).finished();
      await settledRender(page);
      await page
        .getByRole("heading", { name: "What year was Current learner born?" })
        .waitFor();
      assert.equal(
        await page.getByRole("button", { name: "Go", exact: true }).count(),
        0,
      );
      assert.deepEqual(errors, []);
    } finally {
      release();
      await page.close();
    }
  }
  console.log(
    "Session UI: obsolete bootstrap success/error and held family metadata cannot replace newer identity or family state.",
  );
} finally {
  await browser.close();
  await vite.close();
}
