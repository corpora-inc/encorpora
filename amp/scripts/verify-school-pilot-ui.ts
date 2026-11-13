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
import { refuseStudentTokens } from "../src/server/auth";
import {
  accountsAuth,
  createAccounts,
  registerAccountRoutes,
} from "../src/server/accounts";
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
const mail: string[] = [];
const originalInfo = console.info;
console.info = (...args: unknown[]) => {
  const message = String(args[0] ?? "");
  if (message.startsWith("[accounts] email to "))
    mail.push(message.split("\n").at(-1)!);
  else originalInfo(...args);
};
const accounts = await createAccounts(learning.pool, {
  baseURL: origin,
  secret: "fixture-school-browser-accounts-secret-123456",
  production: false,
  passwords: true,
  trustedOrigins: [],
});
const authenticate = refuseStudentTokens(accountsAuth(accounts));
const api = buildApp({ repository: learning, authenticate });
await registerAccountRoutes(api, accounts);
await registerFamilyRoutes(api, { pool: learning.pool, authenticate });
await registerSchoolRoutes(api, {
  pool: learning.pool,
  authenticate,
  services: { origin, secret: "fixture-school-pilot-browser-secret" },
});
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
  await page.waitForFunction(
    () =>
      !document.querySelector(".app-loading") &&
      !document.documentElement.hasAttribute("data-arriving"),
  );
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
  // A school teacher can arrive without Clever and create a real verified account.
  await page.goto(`${origin}/schools`);
  assert.equal(await page.getByRole("link", { name: /Clever/ }).count(), 0);
  await page
    .getByRole("link", { name: "Start with your class", exact: true })
    .first()
    .click();
  await page.waitForURL(/sign-up/);
  assert.ok(
    new URL(page.url()).searchParams.get("next")?.includes("school/start"),
  );
  const passwordChoice = page.getByRole("button", {
    name: "Use a password instead",
    exact: true,
  });
  if (await passwordChoice.count()) await passwordChoice.click();
  await page.getByLabel("Email", { exact: true }).fill("teacher@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("fixture-school-password-123");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page
    .getByRole("heading", { name: /^(Confirm|Check) your email$/ })
    .waitFor();
  await capture("verify-teacher-email");
  assert.ok(mail.length, "The local mail sink received the confirmation");
  await page.goto(mail.at(-1)!);
  await page.getByRole("heading", { name: "Set up your class" }).waitFor();
  await page.getByLabel("School name").fill("Alder pilot school");
  await page.getByLabel("Class name").fill("Grade 3 Math");
  if (await page.getByLabel("Your name", { exact: true }).count())
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
        "SELECT count(*)::int AS n FROM amp_school_starts",
      )
    ).rows[0].n,
    1,
  );
  const created = (
    await learning.pool.query("SELECT org_id,class_id FROM amp_school_starts")
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
  await page
    .getByRole("button", { name: /^(Add these names|Use these rows)$/ })
    .click();
  // Plain columns skip the column check and go straight to the students.
  await page.waitForURL(/step=review/);
  await page.getByRole("heading", { name: "2 new students" }).waitFor();
  await page.getByRole("button", { name: "Add 2 students" }).click();
  await page.waitForURL(/\/roster$/);
  await page.getByText("2 students added", { exact: true }).waitFor();
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
  if (await page.getByLabel("Your name", { exact: true }).count())
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
  await page
    .getByRole("button", { name: /^(Add these names|Use these rows)$/ })
    .click();
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
  const relativeRequest = "**/api/v1/school/classes/*/purchase-request";
  await page.route(relativeRequest, async (route) => {
    const response = await route.fetch();
    const result = await response.json();
    if (result.request) {
      const url = new URL(result.request.url);
      result.request.url = url.pathname + url.hash;
    }
    await route.fulfill({ response, json: result });
  });
  await page.getByRole("button", { name: "Get link" }).click();
  const copy = page.getByRole("button", { name: "Copy link" });
  await copy.waitFor();
  let buyer = (await copy.getAttribute("data-share-url"))!;
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
  await page.getByRole("button", { name: "Edit request" }).click();
  await page.getByRole("spinbutton", { name: "Seats" }).press("ArrowUp");
  await page
    .getByLabel("Note for the buyer (optional)")
    .fill("Please include the whole class.");
  await page.getByRole("button", { name: "Save request" }).click();
  await page.getByRole("button", { name: "Copy link" }).waitFor();
  const updatedBuyer = await page
    .getByRole("button", { name: "Copy link" })
    .getAttribute("data-share-url");
  assert.notEqual(updatedBuyer, buyer, "An edit replaces the superseded link");
  buyer = updatedBuyer!;
  await page.reload();
  await page.getByText("Please include the whole class.").waitFor();
  await page.unroute(relativeRequest);
  assert.equal(
    await page
      .getByRole("link", { name: "Preview", exact: true })
      .getAttribute("href"),
    buyer,
  );
  await capture("buyer-link");
  const requestPattern = "**/api/v1/school/classes/*/purchase-request";
  await page.route(requestPattern, (route) =>
    route.fulfill({
      status: 503,
      json: { error: "school_service_unavailable" },
    }),
  );
  await page.reload();
  await page.getByText("The buyer request couldn’t load. Try again.").waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Get link", exact: true }).count(),
    0,
  );
  await page.unroute(requestPattern);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page.getByRole("button", { name: "Copy link", exact: true }).waitFor();
  await page.route(requestPattern, async (route) => {
    const response = await route.fetch();
    const result = await response.json();
    await route.fulfill({
      response,
      json: { request: { ...result.request, canEdit: false, note: "" } },
    });
  });
  await page.reload();
  await page.getByRole("button", { name: "Copy link", exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Edit request", exact: true })
      .count(),
    0,
  );
  assert.equal(
    await page.getByText("Please include the whole class.").count(),
    0,
  );
  await page.unroute(requestPattern);
  // Another teacher's open link already covers a class: the sheet says who
  // and offers no button that would only be refused again.
  await page.route("**/api/v1/school/purchase-requests", (route) =>
    route.fulfill({
      status: 409,
      json: {
        error: "purchase_scope_conflict",
        conflicts: [
          {
            requestId: randomUUID(),
            holderName: "Rowan Ellis",
            classIds: [created.class_id],
          },
        ],
      },
    }),
  );
  await page.goto(
    `${origin}/school/${created.org_id}/classes/${created.class_id}/today?seats=1`,
  );
  await page.getByRole("button", { name: "Get link" }).click();
  await page
    .getByText(/Rowan Ellis already has a buyer link for this class/)
    .waitFor();
  assert.equal(await page.getByRole("button", { name: "Get link" }).count(), 0);
  await capture("buyer-link-held");
  await page.unroute("**/api/v1/school/purchase-requests");
  // Import remains the first action for an empty class after this teacher's pilot.
  await page.goto(`${origin}/school/start?org=${created.org_id}`);
  await page.getByLabel("Class name").fill("Empty after pilot");
  assert.equal(await page.getByLabel("Your name", { exact: true }).count(), 0);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create class", exact: true }).click();
  await page.getByRole("heading", { name: "Add your students" }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Request seats" }).count(),
    0,
  );
  await page.getByRole("link", { name: "Add students", exact: true }).click();
  await page
    .getByLabel("Or paste names")
    .fill("Name,School key\nMira Shah,007");
  await page
    .getByRole("button", { name: /^(Add these names|Use these rows)$/ })
    .click();
  await page.waitForURL(/step=map/);
  await page.getByRole("heading", { name: "Check the columns" }).waitFor();
  await capture("unknown-column-review");
  // Coverage from another grant or pilot keeps the working sign-in controls.
  const pilotUrl = `**/api/v1/school/classes/${created.class_id}/pilot`;
  await page.route(pilotUrl, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      json: {
        ...(await response.json()),
        coverage: { students: 2, paid: 1, covered: 1 },
      },
    });
  });
  await page.goto(
    `${origin}/school/${created.org_id}/classes/${created.class_id}/today`,
  );
  await page
    .getByRole("heading", { name: "1 of 2 students have practice access" })
    .waitFor();
  await page
    .locator('a[data-shell-action][aria-label="Start class"]')
    .waitFor();
  assert.equal(
    await page
      .locator('a[data-shell-action][aria-label="Start class"]')
      .getAttribute("href"),
    `/school/${created.org_id}/classes/${created.class_id}/start`,
  );
  await capture("partial-coverage");
  await page.unroute(pilotUrl);
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
  // The teacher's note reaches the buyer, in their words.
  await buyerPage
    .getByText("Please include the whole class.", { exact: true })
    .waitFor();
  // The quote request carries the school, the seats and the reference: it
  // asks for none of them again, and shows no internal reference.
  assert.equal(
    await buyerPage
      .getByRole("textbox", { name: "School or organization" })
      .count(),
    0,
  );
  assert.equal(await buyerPage.getByText(/Reference [0-9A-F]{8}/).count(), 0);
  await buyerPage.getByRole("heading", { name: "Get a quote" }).waitFor();
  await page.goto(buyer);
  await capture("buyer-page");
  await guest.close();
  const returning = await browser.newContext();
  const returningPage = await returning.newPage();
  await returningPage.goto(
    `${origin}/sign-in?return=school&next=${encodeURIComponent("/school/start")}`,
  );
  await returningPage
    .getByLabel("Email", { exact: true })
    .fill("teacher@example.test");
  await returningPage
    .getByLabel("Password", { exact: true })
    .fill("fixture-school-password-123");
  await returningPage
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await returningPage
    .getByRole("heading", { name: "Set up your class" })
    .waitFor();
  assert.equal(await returningPage.getByLabel("School name").count(), 0);
  assert.equal(
    await returningPage.getByLabel("Your name", { exact: true }).count(),
    0,
  );
  await returning.close();
  assert.deepEqual(failures, []);
  console.info(
    "Self-service retry, class import, one teacher pilot, expiry and private buyer handoff passed.",
  );
} catch (error) {
  await page.screenshot({ path: `${artifacts}/failure.png`, fullPage: true });
  throw error;
} finally {
  console.info = originalInfo;
  await context.close();
  await browser.close();
  await vite.close();
  await api.close();
  await learning.close();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
