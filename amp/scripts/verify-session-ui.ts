import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium, webkit, type Page } from "playwright";
import { createServer } from "vite";
import {
  retentionNotice,
  type FamilySummary,
} from "../src/family/contracts.js";

// Only the external identity adapter is replaced. The real App, FamilyCenter,
// effects, request guards and rendered UI execute unchanged.
const authPath = fileURLToPath(new URL("../src/web/auth.ts", import.meta.url));
const fixtureSource = `
let resolve, reject;
const pending = new Promise((yes,no)=>{resolve=yes;reject=no;});
const subscribers = new Set();
window.sessionReview = {
  get ready(){return subscribers.size > 0;},
  emit(session){for(const subscriber of subscribers) subscriber(session);},
  resolve(session){resolve(session);},
  reject(){reject(new Error('obsolete bootstrap error'));}
};
export function accessSession(){return pending;}
export function onSessionChanged(callback){subscribers.add(callback);return ()=>subscribers.delete(callback);}
export async function signIn(){}
export async function signOut(){window.sessionReview.emit(null);}
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
  server: { host: "127.0.0.1", port: 4370, strictPort: true },
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
    if (path === "/api/v1/catalog")
      return route.fulfill({
        json: { templates: [], lessons: [], skills: [], mode: "fixture" },
      });
    if (path === "/api/v1/family") {
      const token = route.request().headers().authorization ?? "";
      familyTokens.push(token);
      return route.fulfill({ json: family(token) });
    }
    if (path.endsWith("/books")) return route.fulfill({ json: { books: [] } });
    if (path.endsWith("/progress"))
      return route.fulfill({ json: { skills: [] } });
    errors.push(`Unexpected API request ${route.request().method()} ${path}`);
    return route.fulfill({
      status: 404,
      json: { error: "unexpected_fixture_request" },
    });
  });
  return { page, errors, familyTokens };
}
async function open(page: Page) {
  await page.goto("http://127.0.0.1:4370");
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
      await page.evaluate(() =>
        (window as any).sessionReview.emit({
          token: "current-token",
          accountId: "current-parent",
        }),
      );
      await page
        .getByRole("option", { name: "Current learner", exact: true })
        .waitFor({ state: "attached" });
      assert.equal(
        await page.getByLabel("Learner", { exact: true }).inputValue(),
        "current-child",
      );
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
      assert.equal(
        await page.getByLabel("Learner", { exact: true }).inputValue(),
        "current-child",
      );
      assert.equal(
        await page
          .getByRole("option", { name: "Current learner", exact: true })
          .count(),
        1,
      );
      assert.deepEqual(familyTokens, ["Bearer current-token"]);
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
        .filter({ hasText: "obsolete bootstrap error" })
        .waitFor();
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
    await page.route("**/api/v1/family", async (route) => {
      const snapshot = structuredClone(family);
      requests++;
      if (requests === 1) {
        sawHeld();
        await released;
        if (outcome === "error")
          return route.fulfill({
            status: 503,
            json: { error: "obsolete_family_error" },
          });
      }
      await route.fulfill({ json: snapshot });
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
      await held;
      await page
        .getByRole("button", { name: "Manage family", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "Before rename", exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Edit name", exact: true })
        .click();
      await page.getByLabel("Learner display name").fill("After rename");
      await page
        .getByRole("button", { name: "Save name", exact: true })
        .click();
      await page
        .getByRole("status")
        .filter({ hasText: "Learner name updated." })
        .waitFor();
      await page.getByRole("button", { name: "Back", exact: true }).click();
      await page
        .getByRole("option", { name: "After rename", exact: true })
        .waitFor({ state: "attached" });
      const oldResponse = page.waitForResponse(
        (response) => new URL(response.url()).pathname === "/api/v1/family",
      );
      release();
      await (await oldResponse).finished();
      await settledRender(page);
      assert.equal(requests, 3);
      assert.equal(
        await page
          .getByRole("alert")
          .filter({ hasText: "obsolete_family_error" })
          .count(),
        0,
      );
      assert.equal(
        await page
          .getByRole("option", { name: "After rename", exact: true })
          .count(),
        1,
      );
      assert.equal(
        await page
          .getByRole("option", { name: "Before rename", exact: true })
          .count(),
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
      await page.route("**/birth-year", async (route) => {
        arrived();
        await proceed;
        await route.fulfill({ json: { birthYear: 2016 } });
      });
      await open(page);
      await page.evaluate(() =>
        (window as any).sessionReview.emit({
          token: "old-token",
          accountId: "old-parent",
        }),
      );
      await page.getByRole("button", { name: "2016", exact: true }).click();
      await received;
      await page.evaluate(() =>
        (window as any).sessionReview.emit({
          token: "new-token",
          accountId: "current-parent",
        }),
      );
      await page
        .getByRole("option", { name: "Current learner", exact: true })
        .waitFor({ state: "attached" });
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
        await page.getByRole("button", { name: /^Start practice/ }).count(),
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
