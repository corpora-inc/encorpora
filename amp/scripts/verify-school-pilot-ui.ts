/** Teacher class setup with no confirmation email or Start step, scoped
 * import, the pilot that starts with the first class, its days left, grace,
 * the buyer handoff, and a school leader's own school, against the real API.
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
async function captureOn(target: typeof page, name: string) {
  await target.waitForFunction(
    () =>
      !document.querySelector(".app-loading") &&
      !document.documentElement.hasAttribute("data-arriving"),
  );
  for (const width of [320, 390, 768, 1280]) {
    await target.setViewportSize({ width, height: 900 });
    await target.evaluate(() => window.scrollTo(0, 0));
    for (const theme of ["light", "dark"]) {
      await target.evaluate((value) => {
        document.documentElement.dataset.theme = value;
      }, theme);
      assert.ok(
        await target.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        `${name} no overflow at ${width}`,
      );
      await target.screenshot({
        path: `${artifacts}/${name}-${width}-${theme}.png`,
        fullPage: true,
      });
    }
  }
  await target.setViewportSize({ width: 390, height: 900 });
  await target.evaluate(() => {
    document.documentElement.dataset.theme = "light";
  });
}
const capture = (name: string) => captureOn(page, name);
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
  // Straight to the class: no confirmation email in the way.
  await page.getByRole("heading", { name: "Set up your class" }).waitFor();
  assert.equal(await page.getByLabel("Your role").count(), 0);
  await page.getByLabel("School name").fill("Alder pilot school");
  await page.getByLabel("Class name").fill("Grade 3 Math");
  // Two steps on the shared stepper, each its own address; no in-page Back.
  await page.getByText("Step 1 of 2").waitFor();
  assert.equal(
    await page.getByRole("link", { name: /^(Back|Cancel)$/ }).count(),
    0,
  );
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.waitForURL(/\/school\/start\/students$/);
  await page.getByRole("heading", { name: "Your students" }).waitFor();
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
  // The failure is said under the action, which stays pressable.
  await page.getByText(/Check your connection and try again/).waitFor();
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
  // The pilot started with the class: nothing to press.
  assert.equal(
    (
      await learning.pool.query(
        "SELECT count(*)::int AS n FROM amp_class_pilots",
      )
    ).rows[0].n,
    1,
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
  await page.waitForURL(/\/import\/review$/);
  await page.getByRole("heading", { name: "2 new students" }).waitFor();
  await page.getByRole("button", { name: "Add 2 students" }).click();
  await page.waitForURL(/\/roster$/);
  await page.getByText("2 students added", { exact: true }).waitFor();
  // Students in: the class is open, no Start practice anywhere.
  await page.getByRole("link", { name: "Start class", exact: true }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Start practice" }).count(),
    0,
  );
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
  await page.goto(page.url().replace(/\/roster$/, "/today"));
  assert.equal(
    await page.locator("[data-pilot-left]").textContent(),
    "Free pilot · 30 days left",
  );
  await capture("today-pilot");
  const first = (
    await learning.pool.query("SELECT id,ends_at FROM amp_teacher_pilots")
  ).rows[0];
  // A second class goes to the same school, never a new one.
  await page.goto(`${origin}/school/start`);
  await page.getByLabel("Class name").fill("Math support");
  assert.equal(await page.getByLabel("School name").count(), 0);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  // The school's agreement already covers a second class: one line, no tick.
  await page.getByText(/^Covered by your agreement of/).waitFor();
  assert.equal(await page.getByRole("checkbox").count(), 0);
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
  await page.getByRole("link", { name: "Start class", exact: true }).waitFor();
  assert.deepEqual(
    (await learning.pool.query("SELECT id,ends_at FROM amp_teacher_pilots"))
      .rows,
    [first],
  );
  // Grace: practice goes on, the days left say so, seats are one press.
  await learning.pool.query(
    "UPDATE amp_teacher_pilots SET started_at=now()-interval '35 days',ends_at=now()-interval '5 days',grace_ends_at=now()+interval '9 days'",
  );
  await page.goto(page.url().replace(/\/roster$/, "/today"));
  assert.equal(
    await page.locator("[data-pilot-left]").textContent(),
    "Grace period · 9 days left",
  );
  await page.getByRole("button", { name: "Request seats" }).first().waitFor();
  await capture("grace");
  await learning.pool.query(
    "UPDATE amp_teacher_pilots SET started_at=now()-interval '45 days',ends_at=now()-interval '15 days',grace_ends_at=now()-interval '1 day'",
  );
  await page.reload();
  await page.getByRole("heading", { name: "Practice has ended" }).waitFor();
  // Nothing that leads nowhere: no class code, no cards, no Start.
  // (The code's slot keeps a hidden height-holder: only what can be used
  // counts.)
  assert.equal(
    await page.getByRole("button", { name: "Copy link" }).count(),
    0,
  );
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
  await page.goto(`${origin}/school/start`);
  await page.getByLabel("Class name").fill("Empty after pilot");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  assert.equal(await page.getByLabel("Your name", { exact: true }).count(), 0);
  // Covered by the agreement this school already accepted.
  await page.getByText(/^Covered by your agreement of/).waitFor();
  assert.equal(await page.getByRole("checkbox").count(), 0);
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
  await page.waitForURL(/\/import\/columns$/);
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
  // The class's own state agrees: its students can practice (the server
  // gates the code on it, SPEC R14).
  const yearUrl = `**/api/v1/school/classes/${created.class_id}/year`;
  await page.route(yearUrl, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      json: { ...(await response.json()), practice: "open" },
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
  await page.unroute(yearUrl);
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
  // "I run a school": the school leader's own school, then its classes.
  const leader = await browser.newContext({
    viewport: { width: 390, height: 900 },
  });
  const lead = await leader.newPage();
  lead.on("pageerror", (error) => failures.push(error.message));
  await lead.goto(`${origin}/schools`);
  await lead
    .getByRole("link", { name: "Set up your school", exact: true })
    .first()
    .click();
  await lead.waitForURL(/sign-up/);
  const leaderPassword = lead.getByRole("button", {
    name: "Use a password instead",
    exact: true,
  });
  if (await leaderPassword.count()) await leaderPassword.click();
  await lead.getByLabel("Email", { exact: true }).fill("head@example.test");
  await lead
    .getByLabel("Password", { exact: true })
    .fill("fixture-school-password-456");
  await lead
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await lead.getByRole("heading", { name: "Set up your school" }).waitFor();
  await lead.getByLabel("School name").fill("Cedar Academy");
  if (!(await lead.getByLabel("Your name", { exact: true }).inputValue()))
    await lead.getByLabel("Your name", { exact: true }).fill("Head Example");
  assert.equal(await lead.getByLabel("Your role").count(), 0);
  await lead.getByRole("checkbox").check();
  await captureOn(lead, "school-create");
  await lead
    .getByRole("button", { name: "Create school", exact: true })
    .click();
  await lead.waitForURL(/\/school\/[\w-]+\/classes$/);
  const school = (
    await learning.pool.query(
      "SELECT o.id,o.solo,(SELECT count(*)::int FROM amp_data_agreements a WHERE a.org_id=o.id) AS agreements FROM amp_orgs o WHERE o.name='Cedar Academy'",
    )
  ).rows[0];
  assert.equal(school.solo, false);
  assert.equal(school.agreements, 1);
  await captureOn(lead, "school-classes");
  await leader.close();
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
