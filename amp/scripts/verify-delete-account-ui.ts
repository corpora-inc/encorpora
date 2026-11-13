import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium as rawChromium } from "playwright";
import { createServer } from "vite";
import { secureChromium } from "../browser-security.mjs";
import { fixtureMe } from "./me-fixture";
import { retentionNotice } from "../src/family/contracts";

// Real router and sign-in client; synthetic account responses only.
const output =
  process.env.AMP_DELETE_UI_OUTPUT ?? "/tmp/amp-delete-fresh-signin-ui";
const vite = await createServer({
  plugins: [
    {
      name: "synthetic-delete-events",
      configureServer(server) {
        // Unload beacons can outlive Playwright's request interception.
        server.middlewares.use("/api/v1/events", (_request, response) => {
          response.statusCode = 204;
          response.end();
        });
      },
    },
  ],
  cacheDir: `${output}/vite-cache`,
  server: { host: "127.0.0.1", port: 4970, strictPort: true },
});
await vite.listen();
const origin = "http://127.0.0.1:4970";
const browser = await secureChromium(rawChromium).launch();
await mkdir(output, { recursive: true });
const preview = {
  learners: { children: 2, own: true, profiles: 0 },
  answers: 128,
  removed: [{ id: "family-fixture", name: "Sample family", kind: "family" }],
  left: [],
  secondParent: false,
  billingRecords: false,
  blockers: [],
};
const me = fixtureMe(
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
  "amp|delete-fixture",
);
const user = {
  id: "delete-fixture",
  name: "Sample parent",
  email: "parent@example.test",
  emailVerified: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
try {
  for (const theme of ["light", "dark"] as const) {
    for (const width of [320, 390, 768, 1280]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        colorScheme: theme,
      });
      let stale = true;
      let freshForMs = 600_000;
      let refuseDelete = false;
      let deletions = 0;
      await context.route("**/api/**", async (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path === "/api/v1/auth-config")
          return route.fulfill({
            json: {
              mode: "accounts",
              passwords: true,
              providers: [],
              passkeySignup: false,
            },
          });
        if (path === "/api/auth/get-session")
          return route.fulfill({
            json: {
              user,
              session: {
                id: "session-fixture",
                token: "synthetic-token",
                userId: user.id,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                expiresAt: "2099-01-01T00:00:00.000Z",
              },
            },
          });
        if (path === "/api/v1/me") return route.fulfill({ json: me });
        if (path === "/api/v1/account/deletion")
          return stale
            ? route.fulfill({ status: 403, json: { error: "reauth_required" } })
            : route.fulfill({ json: { ...preview, freshForMs } });
        if (path === "/api/v1/account/delete") {
          assert.equal(
            route.request().postDataJSON().confirmation,
            "delete-my-account",
          );
          if (refuseDelete) {
            stale = true;
            return route.fulfill({
              status: 403,
              json: { error: "reauth_required" },
            });
          }
          deletions++;
          return route.fulfill({ json: { deleted: true } });
        }
        if (path === "/api/auth/sign-in/email") {
          assert.equal(
            route.request().postDataJSON().callbackURL,
            "/family/security/delete",
          );
          stale = false;
          return route.fulfill({
            json: { token: "synthetic-token", user, redirect: false },
          });
        }
        return route.fulfill({ json: {} });
      });
      const page = await context.newPage();
      const recovery = page.getByRole("link", {
        name: "Sign in again to delete",
      });
      const remove = page.getByRole("button", {
        name: "Delete my account",
        exact: true,
      });
      await page.goto(`${origin}/family/security/delete`);
      await recovery.waitFor();
      assert.equal(await remove.count(), 0);
      const href = await recovery.getAttribute("href");
      assert.equal(
        new URL(href!, origin).searchParams.get("next"),
        "/family/security/delete",
      );
      const box = await recovery.boundingBox();
      assert.ok(
        box && box.height >= 44 && box.x >= 0 && box.x + box.width <= width,
      );
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.evaluate(async () => {
        await Promise.all(
          document
            .getAnimations()
            .filter(
              (animation) =>
                animation.effect?.getComputedTiming().iterations !== Infinity,
            )
            .map((animation) => animation.finished.catch(() => {})),
        );
      });
      await page.screenshot({
        path: `${output}/stale-${theme}-${width}.png`,
        fullPage: true,
      });
      await recovery.click();
      await page.getByLabel("Email", { exact: true }).fill(user.email);
      await page
        .getByLabel("Password", { exact: true })
        .fill("synthetic password");
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await page.waitForURL(`${origin}/family/security/delete`);
      await remove.waitFor();
      await page.getByLabel("Type “delete” to confirm").fill("delete");
      await page.evaluate(async () => {
        await Promise.all(
          document
            .getAnimations()
            .filter(
              (animation) =>
                animation.effect?.getComputedTiming().iterations !== Infinity,
            )
            .map((animation) => animation.finished.catch(() => {})),
        );
      });
      await page.screenshot({
        path: `${output}/fresh-${theme}-${width}.png`,
        fullPage: true,
      });
      // A session that ages between preview and submit gets actionable recovery.
      refuseDelete = true;
      await remove.click();
      await recovery.waitFor();
      assert.equal(await remove.count(), 0);
      assert.equal(deletions, 0);
      // The timer also replaces the button without a failed submission.
      stale = false;
      freshForMs = 1500;
      await page.reload();
      await remove.waitFor();
      await recovery.waitFor();
      assert.equal(await remove.count(), 0);
      // A fresh sign-in permits the complete confirmation/deletion flow.
      freshForMs = 600_000;
      refuseDelete = false;
      await recovery.click();
      await page.getByLabel("Email", { exact: true }).fill(user.email);
      await page
        .getByLabel("Password", { exact: true })
        .fill("synthetic password");
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await page.waitForURL(`${origin}/family/security/delete`);
      await page.getByLabel("Type “delete” to confirm").fill("delete");
      await remove.click();
      await page.waitForURL(`${origin}/account/deleted`);
      assert.equal(deletions, 1);
      await context.close();
    }
  }
  console.log(
    `Deletion UI: stale load, validated sign-in return, submit rejection, expiry and successful deletion passed; screenshots in ${output}`,
  );
} finally {
  await browser.close();
  await vite.close();
}
