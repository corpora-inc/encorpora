import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import Fastify from "fastify";
import { chromium } from "playwright";
import { migrate } from "./migrate";
import { registerCampaignRoutes } from "../src/analytics/campaign-routes";
const url = process.env.AMP_TEST_DATABASE_URL;
if (!url) throw new Error("AMP_TEST_DATABASE_URL is required");
const schema = "campaign_browser_" + randomUUID().replaceAll("-", "");
const admin = new Pool({ connectionString: url });
const scoped = new URL(url);
scoped.searchParams.set("options", `-c search_path=${schema}`);
const pool = new Pool({ connectionString: scoped.href });
const api = Fastify();
const script = await readFile("../corpora-site/src/campaign-client.js", "utf8");
let endpoint = "";
const site = createServer((req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.end(
    `<main data-campaign-program="arkansas-efa"><a data-campaign-action="try" href="${endpoint}/try/">Try</a><a data-campaign-action="invoice" href="mailto:support@example.test">Invoice</a></main><script data-campaign-endpoint="${endpoint}/api/v1/campaign-events">${script}</script>`,
  );
});
await new Promise<void>((resolve) => site.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${(site.address() as { port: number }).port}`;
const browser = await chromium.launch({ headless: true });
try {
  await admin.query(`CREATE SCHEMA ${schema}`);
  await migrate(scoped.href);
  await registerCampaignRoutes(api, { pool, origin });
  endpoint = await api.listen({ port: 0, host: "127.0.0.1" });
  const page = await browser.newPage();
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/campaign-events") && r.request().method() === "POST",
  );
  await page.goto(
    origin +
      "/?utm_source=facebook&utm_medium=paid-social&utm_campaign=ar-efa-launch&email=do-not-record",
  );
  assert.equal((await response).status(), 202);
  await page.evaluate(() =>
    document
      .querySelector("main")!
      .addEventListener("click", (e) => e.preventDefault()),
  );
  for (const action of ["invoice", "try"]) {
    const reply = page.waitForResponse(
      (r) =>
        r.url().endsWith("/campaign-events") && r.request().method() === "POST",
    );
    await page.locator(`[data-campaign-action="${action}"]`).click();
    assert.equal((await reply).status(), 202);
  }
  const rows = (
    await pool.query(
      "SELECT action,count,source,medium,campaign FROM amp_campaign_daily ORDER BY action",
    )
  ).rows;
  assert.equal(rows.length, 3);
  assert.ok(rows.every((r) => r.count === "1"));
  assert.equal(
    (await pool.query("SELECT count(*) FROM amp_funnel_visitors")).rows[0]
      .count,
    "0",
  );
  const privacy = await browser.newPage();
  await privacy.addInitScript(() =>
    Object.defineProperty(navigator, "globalPrivacyControl", { value: true }),
  );
  await privacy.goto(origin + "/?utm_campaign=ar-efa-launch");
  await privacy.waitForTimeout(200);
  assert.equal(
    (await pool.query("SELECT sum(count)::text AS n FROM amp_campaign_daily"))
      .rows[0].n,
    "3",
  );
  console.log(
    JSON.stringify({
      browserPostStatus: 202,
      database: rows,
      gpcNoRequest: true,
      noVisitorRecords: true,
    }),
  );
} finally {
  await browser.close();
  await api.close();
  await new Promise<void>((resolve) => site.close(() => resolve()));
  await pool.end();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
