/** Teacher class setup, scoped import, explicit pilot and buyer handoff against the real API.
 * AMP_TEST_DATABASE_URL=... npx tsx scripts/verify-school-pilot-ui.ts [--port 4482]
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { mkdir } from "node:fs/promises";
import { chromium as rawChromium } from "playwright";
import { createServer } from "vite";
import { secureChromium } from "../browser-security.mjs";
import { registerSchoolRoutes } from "../src/schools/routes";
import { registerFamilyRoutes } from "../src/family/routes";
import { buildApp } from "../src/server/app";
import { developmentAuth, refuseStudentTokens } from "../src/server/auth";
import { PostgresRepository } from "../src/server/repository";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";

const url = process.env.AMP_TEST_DATABASE_URL!;
assertTestDatabaseTarget(url);
const at = process.argv.indexOf("--port");
const port = at >= 0 ? Number(process.argv[at + 1]) : 4482;
const origin = `http://127.0.0.1:${port}`;
const schema = `amp_pilot_ui_${randomUUID().replaceAll("-", "")}`;
const admin = new Pool({ connectionString: url, max: 1 });
await admin.query(`CREATE SCHEMA ${schema}`);
const scoped = new URL(url);
scoped.searchParams.set("options", `-c search_path=${schema}`);
await migrate(scoped.href);
const learning = new PostgresRepository(scoped.href);
const authenticate = refuseStudentTokens(developmentAuth());
const api = buildApp({ repository: learning, authenticate });
await registerFamilyRoutes(api, { pool: learning.pool, authenticate });
await registerSchoolRoutes(api, {
  pool: learning.pool,
  authenticate,
  services: { origin, secret: "fixture-school-pilot-browser-secret" },
});
api.get("/api/v1/auth-config", async () => ({ mode: "development" }));
await api.listen({ host: "127.0.0.1", port: port + 1 });
const vite = await createServer({
  server: {
    host: "127.0.0.1",
    port,
    strictPort: true,
    watch: null,
    proxy: { "/api": `http://127.0.0.1:${port + 1}` },
  },
});
await vite.listen();
const browser = await secureChromium(rawChromium).launch();
const failures: string[] = [];

const context = await browser.newContext({
  viewport: { width: 390, height: 900 },
});
const page = await context.newPage();
page.setDefaultTimeout(30_000);
page.on("pageerror", (error) => failures.push(error.message));
const artifacts = "artifacts/school-pilot";
await mkdir(artifacts, { recursive: true });
async function capture(name: string) {
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
      }, theme);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        `${name} no overflow at ${width}`,
      );
      await page.screenshot({
        path: `${artifacts}/${name}-${width}-${theme}.png`,
        fullPage: true,
      });
    }
  }
  await page.setViewportSize({ width: 390, height: 900 });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "light";
  });
}
try {
  await page.goto(`${origin}/school/start`);
  await page.getByRole("heading", { name: "Set up your class" }).waitFor();
  await page.getByLabel("School name").fill("Alder pilot school");
  await page.getByLabel("Class name").fill("Grade 3 Math");
  await page.getByLabel("Your name", { exact: true }).fill("Teacher Example");
  await page.getByRole("checkbox").check();
  await capture("setup");
  let requests = 0;
  await page.route("**/api/v1/school/start", async (route) => {
    if (++requests === 1) {
      await route.fetch();
      await route.abort();
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Create class", exact: true }).click();
  await page.locator("[role=alert]").filter({ hasText: /./ }).first().waitFor();
  await page.getByRole("button", { name: "Create class", exact: true }).click();
  await page.waitForURL(/\/classes\/[\w-]+\/roster/);
  assert.equal(
    (
      await learning.pool.query(
        "SELECT count(*)::int AS n FROM amp_school_starts WHERE account_id='development-household'",
      )
    ).rows[0].n,
    1,
  );
  const created = (
    await learning.pool.query(
      "SELECT org_id,class_id FROM amp_school_starts WHERE account_id='development-household'",
    )
  ).rows[0];
  assert.equal(
    (
      await learning.pool.query(
        "SELECT count(*)::int AS n FROM amp_class_pilots",
      )
    ).rows[0].n,
    0,
  );
  await page
    .getByRole("link", { name: "Import students", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Or paste from a spreadsheet")
    .fill(
      "Student ID,Name,Class\n0001,Ana Ruiz,Untrusted class name\n0002,Noor Haddad,Another class\n",
    );
  await page.getByRole("button", { name: "Use these rows" }).click();
  await page.getByRole("button", { name: "Check for changes" }).click();
  await page.waitForURL(/step=review/);
  await page.getByRole("button", { name: "Apply changes" }).click();
  await page.waitForURL(/step=done/);
  await page.getByRole("link", { name: "See students", exact: true }).click();
  await page
    .getByRole("button", { name: "Start 30-day pilot", exact: true })
    .waitFor();
  assert.equal(
    (
      await learning.pool.query(
        "SELECT count(*)::int AS n FROM amp_classes WHERE org_id=$1",
        [created.org_id],
      )
    ).rows[0].n,
    1,
  );
  await capture("ready");
  await page
    .getByRole("button", { name: "Start 30-day pilot", exact: true })
    .click();
  await page.getByRole("heading", { name: "Your pilot is active" }).waitFor();
  const first = (
    await learning.pool.query("SELECT id,ends_at FROM amp_teacher_pilots")
  ).rows[0];
  await page.goto(`${origin}/school/start?org=${created.org_id}`);
  await page.getByLabel("Class name").fill("Math support");
  await page.getByLabel("Your name", { exact: true }).fill("Teacher Example");
  await page.getByRole("checkbox").check();
  await page
    .getByText("Add student names now (optional)", { exact: true })
    .click();
  await page
    .getByRole("textbox", { name: /Student names/ })
    .fill("Lena Fischer");
  await page.getByRole("button", { name: "Create class", exact: true }).click();
  await page.waitForURL(/\/classes\/[\w-]+\/roster/);
  await page
    .getByRole("button", { name: "Add class to pilot", exact: true })
    .click();
  await page.getByRole("heading", { name: "Your pilot is active" }).waitFor();
  assert.deepEqual(
    (await learning.pool.query("SELECT id,ends_at FROM amp_teacher_pilots"))
      .rows,
    [first],
  );
  await learning.pool.query(
    "UPDATE amp_teacher_pilots SET started_at=now()-interval '40 days',ends_at=now()-interval '10 days',grace_ends_at=now()-interval '3 days'",
  );
  await page.reload();
  await page.getByRole("heading", { name: "Your pilot has ended" }).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: /Start 30-day pilot|Add class to pilot/ })
      .count(),
    0,
  );
  await page
    .getByRole("button", { name: "Request seats", exact: true })
    .click();
  await page.getByLabel("Seats to discuss").fill("30");
  await page.getByRole("button", { name: "Create buyer link" }).click();
  await page.getByLabel("Buyer link").waitFor();
  const buyer = await page.getByLabel("Buyer link").inputValue();
  await capture("buyer-link");
  const guest = await browser.newContext();
  const buyerPage = await guest.newPage();
  await buyerPage.goto(buyer);
  await buyerPage
    .getByRole("heading", { name: "AMP for Alder pilot school", exact: true })
    .waitFor();
  assert.equal(
    await buyerPage.getByText("Lena Fischer", { exact: true }).count(),
    0,
  );
  assert.equal(
    await buyerPage
      .getByRole("link", { name: "Discuss seats with Corpora" })
      .count(),
    1,
  );
  await page.goto(buyer);
  await capture("buyer-page");
  await guest.close();
  assert.deepEqual(failures, []);
  console.info(
    "Self-service retry, class import, one teacher pilot, expiry and private buyer handoff passed.",
  );
} catch (error) {
  await page.screenshot({ path: `${artifacts}/failure.png`, fullPage: true });
  throw error;
} finally {
  await context.close();
  await browser.close();
  await vite.close();
  await api.close();
  await learning.close();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
