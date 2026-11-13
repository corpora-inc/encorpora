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
  ...(process.env.AMP_VITE_CACHE_DIR
    ? { cacheDir: process.env.AMP_VITE_CACHE_DIR }
    : {}),
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
  // Day 0: one step, nothing else to do.
  await page.getByRole("heading", { name: "Add your students" }).waitFor();
  assert.equal(await page.getByLabel("Class code").count(), 0);
  await page.getByRole("link", { name: "Add students", exact: true }).click();
  await page
    .getByLabel("Or paste names")
    .fill(
      "Student ID,Name,Class\n0001,Ana Ruiz,Untrusted class name\n0002,Noor Haddad,Another class\n",
    );
  await page.getByRole("button", { name: "Use these rows" }).click();
  // Plain columns skip the column check and go straight to the students.
  await page.waitForURL(/step=review/);
  await page.getByRole("heading", { name: "2 new students" }).waitFor();
  await page.getByRole("button", { name: "Add 2 students" }).click();
  await page.waitForURL(/\/roster$/);
  await page.getByText("2 students added").waitFor();
  await page
    .getByRole("button", { name: "Start practice", exact: true })
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
    .getByRole("button", { name: "Start practice", exact: true })
    .click();
  // The same slot now starts the class: the header never reflows.
  await page.getByRole("link", { name: "Start class", exact: true }).waitFor();
  const first = (
    await learning.pool.query("SELECT id,ends_at FROM amp_teacher_pilots")
  ).rows[0];
  // A second class goes to the same school, never a new one.
  await page.goto(`${origin}/school/start`);
  await page.getByLabel("Class name").fill("Math support");
  assert.equal(await page.getByLabel("School name").count(), 0);
  await page.getByLabel("Your name", { exact: true }).fill("Teacher Example");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create class", exact: true }).click();
  await page.waitForURL(/\/classes\/[\w-]+\/roster/);
  assert.equal(
    (
      await learning.pool.query(
        "SELECT count(DISTINCT org_id)::int AS n FROM amp_school_starts",
      )
    ).rows[0].n,
    1,
  );
  await page.getByRole("link", { name: "Add students", exact: true }).click();
  await page.getByLabel("Or paste names").fill("Lena Fischer");
  await page.getByRole("button", { name: "Use these rows" }).click();
  await page.getByRole("button", { name: "Add 1 student" }).click();
  await page.waitForURL(/\/roster$/);
  await page
    .getByRole("button", { name: "Start practice", exact: true })
    .click();
  await page.getByRole("link", { name: "Start class", exact: true }).waitFor();
  assert.deepEqual(
    (await learning.pool.query("SELECT id,ends_at FROM amp_teacher_pilots"))
      .rows,
    [first],
  );
  await learning.pool.query(
    "UPDATE amp_teacher_pilots SET started_at=now()-interval '40 days',ends_at=now()-interval '10 days',grace_ends_at=now()-interval '3 days'",
  );
  await page.goto(page.url().replace(/\/roster$/, "/today"));
  await page.getByRole("heading", { name: "Practice has ended" }).waitFor();
  // Nothing that leads nowhere: no class code, no cards, no Start.
  assert.equal(await page.getByText("Copy link").count(), 0);
  assert.equal(await page.getByRole("button", { name: /Start/ }).count(), 0);
  await page
    .getByRole("button", { name: "Request seats", exact: true })
    .click();
  await page.waitForURL(/seats=1/);
  await page.getByRole("spinbutton", { name: "Seats" }).press("PageUp");
  await page.getByRole("button", { name: "Get link" }).click();
  const copy = page.getByRole("button", { name: "Copy link" });
  await copy.waitFor();
  const buyer = (await copy.getAttribute("data-share-url"))!;
  // The link is the class's: a refresh shows the same one, never a new one.
  await page.reload();
  await page.getByRole("button", { name: "Copy link" }).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Copy link" })
      .getAttribute("data-share-url"),
    buyer,
  );
  assert.equal(
    (
      await learning.pool.query(
        "SELECT count(*)::int AS n FROM amp_school_purchase_requests",
      )
    ).rows[0].n,
    1,
  );
  assert.equal(new URL(buyer).pathname, "/schools/continue");
  assert.match(new URL(buyer).hash, /^#token=[A-Za-z0-9_-]{43}$/);
  await capture("buyer-link");
  // Another teacher's open link already covers a class: the sheet says who
  // and offers no button that would only be refused again.
  await page.route("**/api/v1/school/purchase-requests", (route) =>
    route.fulfill({
      status: 409,
      json: {
        error: "purchase_scope_conflict",
        holder: { name: "Rowan Ellis" },
      },
    }),
  );
  await page.goto(
    `${origin}/school/${created.org_id}/classes/${created.class_id}/today?seats=1`,
  );
  await page.getByRole("button", { name: "Get link" }).click();
  await page
    .getByText("Rowan Ellis already has a buyer link for this class.")
    .waitFor();
  assert.equal(await page.getByRole("button", { name: "Get link" }).count(), 0);
  await capture("buyer-link-held");
  await page.unroute("**/api/v1/school/purchase-requests");
  const guest = await browser.newContext();
  const buyerPage = await guest.newPage();
  await buyerPage.goto(buyer);
  await buyerPage
    .getByRole("heading", { name: "AMP for Alder pilot school", exact: true })
    .waitFor();
  assert.equal(new URL(buyerPage.url()).hash, "");
  await buyerPage.reload();
  await buyerPage
    .getByRole("heading", { name: "AMP for Alder pilot school", exact: true })
    .waitFor();
  assert.equal(
    await buyerPage.getByText("Lena Fischer", { exact: true }).count(),
    0,
  );
  // The quote request already carries the school and the reference.
  assert.equal(
    await buyerPage
      .getByRole("textbox", { name: "School or organization" })
      .inputValue(),
    "Alder pilot school",
  );
  await buyerPage.getByRole("heading", { name: "Get a quote" }).waitFor();
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
