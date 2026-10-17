import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";
import { chromium, webkit, type Page } from "playwright";
import { createServer } from "vite";
import {
  retentionNotice,
  type FamilySummary,
} from "../src/family/contracts.js";
const authPath = fileURLToPath(new URL("../src/web/auth.ts", import.meta.url));
const source = `const listeners=new Set();window.familyFocus={emit(s){for(const f of listeners)f(s);}};export async function accessSession(){return {token:'fixture',accountId:'parent'};}export function onSessionChanged(f){listeners.add(f);return()=>listeners.delete(f);}export async function signIn(){}export async function signOut(){window.familyFocus.emit(null);}`;
const vite = await createServer({
  cacheDir: "node_modules/.vite-family-focus",
  root: fileURLToPath(new URL("../", import.meta.url)),
  configFile: fileURLToPath(new URL("../vite.config.ts", import.meta.url)),
  plugins: [
    {
      name: "family-focus-auth",
      enforce: "pre",
      load(id) {
        return id.split("?")[0] === authPath ? source : undefined;
      },
    },
  ],
  server: { host: "127.0.0.1", port: 4384, strictPort: true },
});
await vite.listen();
const browser = await (
  process.env.AMP_BROWSER === "webkit" ? webkit : chromium
).launch();
async function fits(page: Page, selector: string) {
  const box = await page.locator(selector).boundingBox();
  assert.ok(
    box &&
      box.y >= 0 &&
      box.x >= 0 &&
      box.y + box.height <= page.viewportSize()!.height + 1 &&
      box.x + box.width <= page.viewportSize()!.width + 1,
    `${selector} visible at ${JSON.stringify(page.viewportSize())}`,
  );
}
try {
  await mkdir("artifacts/family-focus", { recursive: true });
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [844, 390],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    page.setDefaultTimeout(12000);
    const faults: string[] = [];
    page.on("pageerror", (e) => {
      faults.push(e.message);
      console.error("Family fixture page error:", e.message);
    });
    const now = Date.now(),
      date = (days: number) => new Date(now + days * 86400000).toISOString();
    const family: FamilySummary = {
      consent: {
        status: "active",
        policyVersion: "fixture",
        recordedAt: date(-1),
        withdrawnAt: null,
      },
      learners: [
        {
          id: "avery",
          name: "Avery",
          deletedAt: null,
          stripeLinked: true,
          access: [
            {
              channel: "stripe",
              status: "active",
              startsAt: date(-10),
              endsAt: date(355),
            },
            {
              channel: "esa",
              status: "revoked",
              startsAt: date(-500),
              endsAt: date(-135),
            },
          ],
        },
        {
          id: "jordan",
          name: "Jordan",
          deletedAt: null,
          stripeLinked: false,
          access: [
            {
              channel: "esa",
              status: "active",
              startsAt: date(10),
              endsAt: date(375),
            },
          ],
        },
        {
          id: "reference",
          name: "",
          deletedAt: date(-1),
          stripeLinked: true,
          access: [],
        },
      ],
      retained: retentionNotice,
    };
    const renamed: string[] = [];
    await page.route("**/api/v1/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/catalog"))
        return route.fulfill({
          json: { templates: [], lessons: [], skills: [], mode: "fixture" },
        });
      if (path.endsWith("/family")) return route.fulfill({ json: family });
      if (path.endsWith("/books"))
        return route.fulfill({ json: { books: [] } });
      if (path.endsWith("/progress"))
        return route.fulfill({ json: { skills: [] } });
      if (path.endsWith("/rename")) {
        const id = path.split("/").at(-2)!;
        renamed.push(id);
        family.learners.find((l) => l.id === id)!.name = route
          .request()
          .postDataJSON().name;
        return route.fulfill({ json: { ok: true } });
      }
      if (path.endsWith("/delete-learning-data")) {
        const id = path.split("/").at(-2)!;
        const learner = family.learners.find((l) => l.id === id)!;
        learner.name = "";
        learner.deletedAt = date(0);
        return route.fulfill({
          json: {
            requestId: "fixture",
            deletedLearners: 1,
            retainedBillingReferences: 0,
            billingManagementRequired: false,
            consentWithdrawn: false,
          },
        });
      }
      faults.push(path);
      return route.fulfill({
        status: 404,
        json: { error: "unexpected_fixture" },
      });
    });
    await page.goto("http://127.0.0.1:4384");
    await page.locator(".account-menu summary").click();
    await page
      .getByRole("button", { name: "Manage family", exact: true })
      .click();
    await page.getByLabel("Family learner", { exact: true }).waitFor();
    assert.equal(await page.locator(".family-learner").count(), 1);
    await fits(page, ".family-profile-select");
    assert.ok(
      (await page.getByLabel("Family learner", { exact: true }).boundingBox())!
        .height >= 44,
      "learner selector has a full touch target",
    );
    await fits(page, ".family-learner");
    await page.getByRole("button", { name: "Access", exact: true }).click();
    await page.getByText("License active", { exact: true }).waitFor();
    await fits(page, ".family-purchase-open");
    await fits(page, ".family-billing button");
    await page.screenshot({
      path: `artifacts/family-focus/access-${width}.png`,
    });
    assert.ok(
      await page
        .locator(".family-learners")
        .evaluate((e) => e.scrollHeight <= e.clientHeight + 1),
      "ordinary active license fits without inner scrolling",
    );
    await page
      .getByRole("button", { name: "License history and dates" })
      .click();
    await page.getByRole("dialog").waitFor();
    await page.getByText("Education funds · revoked").waitFor();
    await page.keyboard.press("Escape");
    assert.equal(
      await page.evaluate(() => document.activeElement?.textContent),
      "License history and dates",
    );
    await page
      .getByLabel("Family learner", { exact: true })
      .selectOption("jordan");
    await page.getByText("License scheduled", { exact: true }).waitFor();
    assert.equal(await page.locator(".family-billing").count(), 0);
    await page.getByRole("button", { name: "Learners", exact: true }).click();
    await page.getByRole("button", { name: "Edit name", exact: true }).click();
    // A long display name and a revoked future term must not displace the dock.
    const longName = "Jordan Alexandra Montgomery Rivera Chen Williamson";
    family.learners.find((l) => l.id === "jordan")!.access[0].status =
      "revoked";
    await page.getByLabel("Learner display name").fill(longName);
    await page.getByRole("button", { name: "Save name", exact: true }).click();
    await page.getByRole("heading", { name: longName, exact: true }).waitFor();
    assert.deepEqual(renamed, ["jordan"]);
    await page.getByRole("button", { name: "Access", exact: true }).click();
    await page.getByText("No current license", { exact: true }).waitFor();
    await fits(page, ".family-profile-select");
    await fits(page, ".family-purchase-open");
    await page.screenshot({
      path: `artifacts/family-focus/no-license-${width}.png`,
    });
    assert.equal(
      await page.getByLabel("Family learner", { exact: true }).inputValue(),
      "jordan",
    );
    await page.evaluate(() => {
      (
        window as unknown as { familyFocus: { emit(session: unknown): void } }
      ).familyFocus.emit({ accountId: "parent", token: "renewed-fixture" });
    });
    assert.equal(
      await page.getByLabel("Family learner", { exact: true }).inputValue(),
      "jordan",
      "same-parent token renewal preserves family selection",
    );
    await page
      .getByLabel("Family learner", { exact: true })
      .selectOption("reference");
    await page.getByRole("button", { name: "Access", exact: true }).click();
    await fits(page, ".family-billing button");
    await page.screenshot({
      path: `artifacts/family-focus/reference-${width}.png`,
    });
    await page
      .getByLabel("Family learner", { exact: true })
      .selectOption("jordan");
    await page.getByRole("button", { name: "Learners", exact: true }).click();
    await page
      .getByRole("button", { name: "Delete learning data", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Delete/ })
      .click();
    await page.getByRole("heading", { name: "Avery", exact: true }).waitFor();
    assert.equal(
      await page.getByLabel("Family learner", { exact: true }).inputValue(),
      "avery",
    );
    assert.deepEqual(faults, []);
    await page.close();
  }
  console.log(
    "Focused family selection, current/future/revoked terms, rename ownership, retained billing and deletion fallback passed.",
  );
} finally {
  await browser.close();
  await vite.close();
}
