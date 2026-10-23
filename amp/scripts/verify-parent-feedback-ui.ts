import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import Fastify from "fastify";
import { Pool } from "pg";
import { chromium } from "playwright";
import { createServer } from "vite";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";
import { registerParentFeedbackRoutes } from "../src/feedback/parent-routes";
import { presentOffer } from "../src/funding-purchase/contracts";
import { testFundingOffer } from "../tests/funding-purchase.fixture";
const url = process.env.AMP_TEST_DATABASE_URL!;
assertTestDatabaseTarget(url);
if (!url) throw new Error("Test database required");
const schema = `parent_ui_${randomUUID().replaceAll("-", "")}`;
const admin = new Pool({ connectionString: url, max: 1 });
const scoped = new URL(url);
scoped.searchParams.set("options", `-c search_path=${schema}`);
await admin.query(`CREATE SCHEMA ${schema}`);
await migrate(scoped.href);
const pool = new Pool({ connectionString: scoped.href, max: 2 });
const api = Fastify();
await registerParentFeedbackRoutes(api, { pool });
const apiOrigin = await api.listen({ host: "127.0.0.1", port: 0 });
const vite = await createServer({
  server: { host: "127.0.0.1", port: 0, proxy: { "/api": apiOrigin } },
  cacheDir: "node_modules/.vite-parent-feedback",
});
await vite.listen();
const address = vite.httpServer!.address();
assert(address && typeof address === "object");
const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ args: ["--no-proxy-server"] });
await mkdir("artifacts/parent-feedback", { recursive: true });
try {
  for (const colorScheme of ["light", "dark"] as const)
    for (const width of [320, 390, 768, 1280]) {
      const context = await browser.newContext({
        viewport: { width, height: 850 },
        colorScheme,
      });
      const page = await context.newPage();
      let failure = true;
      let calls = 0;
      let requestId = "";
      await page.route("**/api/**", async (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path === "/api/v1/parent-feedback") {
          const body = route.request().postDataJSON();
          calls++;
          if (requestId) assert.equal(body.requestId, requestId);
          requestId = body.requestId;
          assert.equal(body.context, "invoice");
          assert.equal(body.program, "ar-efa");
          assert.equal(
            body.message,
            `Clearer invoice steps ${width} ${colorScheme}`,
          );
          assert.deepEqual(Object.keys(body).sort(), [
            "adult",
            "context",
            "message",
            "program",
            "requestId",
          ]);
          if (failure) {
            failure = false;
            // Simulate a committed message whose successful response was lost.
            const committed = await route.fetch();
            assert.equal(committed.status(), 202);
            return route.fulfill({
              status: 503,
              json: { error: "feedback_unavailable" },
            });
          }
          return route.continue();
        }
        if (path === "/api/v1/funding/invoice-offers")
          return route.fulfill({
            json: {
              offers: [
                presentOffer({
                  ...testFundingOffer,
                  programId: "ar-efa",
                  programName: "Arkansas EFA",
                  documentPolicy: "named-student-invoice",
                }),
              ],
            },
          });
        return route.fulfill({ json: {} });
      });
      await page.goto(`${origin}/invoice/arkansas-efa`);
      await page
        .getByRole("link", { name: "support@corpora.inc", exact: true })
        .waitFor();
      const trigger = page.getByRole("button", {
        name: "Share parent feedback",
      });
      await trigger.click();
      const dialog = page.getByRole("dialog");
      await dialog.waitFor();
      await dialog
        .getByRole("button", { name: "Send feedback", exact: true })
        .click();
      await dialog
        .getByRole("alert")
        .filter({ hasText: "Confirm you’re an adult" })
        .waitFor();
      assert.equal(calls, 0);
      await page
        .getByLabel("Your feedback")
        .fill(`Clearer invoice steps ${width} ${colorScheme}`);
      await page
        .getByRole("checkbox", { name: "I’m a parent or adult learner." })
        .click();
      await page
        .getByRole("button", { name: "Send feedback", exact: true })
        .click();
      await dialog
        .getByRole("alert")
        .filter({ hasText: "wasn’t confirmed" })
        .waitFor();
      assert.equal(
        await page.getByLabel("Your feedback").inputValue(),
        `Clearer invoice steps ${width} ${colorScheme}`,
      );
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      for (const button of await dialog.getByRole("button").all()) {
        const box = await button.boundingBox();
        if (box) assert(box.height >= 44, `target ${box.height}`);
      }
      await page.screenshot({
        path: `artifacts/parent-feedback/${width}-${colorScheme}-retry.png`,
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "Send feedback", exact: true })
        .click();
      await page.getByRole("status").filter({ hasText: "Thank you" }).waitFor();
      await page.getByRole("button", { name: "Done", exact: true }).click();
      assert.equal(calls, 2);
      await trigger.click();
      await page.getByLabel("Your feedback").fill("Do not send");
      await dialog
        .locator("form")
        .getByRole("button", { name: "Close", exact: true })
        .click();
      assert.equal(calls, 2);
      await trigger.click();
      await page.keyboard.press("Escape");
      assert.equal(calls, 2);
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM amp_parent_feedback WHERE request_id=$1",
            [requestId],
          )
        ).rows[0].n,
        1,
      );
      await context.close();
    }
  assert.equal(
    (await pool.query("SELECT count(*)::int AS n FROM amp_parent_feedback"))
      .rows[0].n,
    8,
  );
  console.log(
    "Parent feedback: eight layouts; real API/database; validation, failure, idempotent retry, dismissal, Escape and support link passed.",
  );
} finally {
  await browser.close();
  await vite.close();
  await api.close();
  await pool.end();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
