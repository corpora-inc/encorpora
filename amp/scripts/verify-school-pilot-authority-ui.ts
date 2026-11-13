/** Real API/browser check: administrators prepare classes; enrolled teachers activate pilots. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { Pool } from "pg";
import { chromium as rawChromium } from "playwright";
import { createServer } from "vite";
import { secureChromium } from "../browser-security.mjs";
import { registerFamilyRoutes } from "../src/family/routes";
import { AGREEMENT_VERSION } from "../src/schools/agreement";
import { SchoolRepository } from "../src/schools/repository";
import { registerSchoolRoutes } from "../src/schools/routes";
import { buildApp } from "../src/server/app";
import { developmentAuth, refuseStudentTokens } from "../src/server/auth";
import { PostgresRepository } from "../src/server/repository";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";

const url = process.env.AMP_TEST_DATABASE_URL!;
assertTestDatabaseTarget(url);
const port = Number(process.env.AMP_PILOT_AUTHORITY_UI_PORT ?? 4496),
  origin = `http://127.0.0.1:${port}`;
const schema = `pilot_authority_ui_${randomUUID().replaceAll("-", "")}`;
const admin = new Pool({ connectionString: url, max: 1 });
const scoped = new URL(url);
scoped.searchParams.set("options", `-c search_path=${schema}`);
await admin.query(`CREATE SCHEMA ${schema}`);
await migrate(scoped.href);
const learning = new PostgresRepository(scoped.href);
const schools = new SchoolRepository(learning.pool);
const school = await schools.createOrg(
  { kind: "school", name: "Fixture school", timezone: "UTC" },
  {
    version: AGREEMENT_VERSION,
    signerName: "Administrator Example",
    signerTitle: "Administrator",
  },
);
const klass = await schools.createClass(school.id, { name: "Math class" });
const administrator = await schools.addStaff({
  orgId: school.id,
  role: "admin",
  givenName: "Administrator",
  accountId: "development-household",
});
await schools.provisionStudent(school.id, {
  givenName: "Student",
  classId: klass.id,
  gradeLevel: 4,
});
const authenticate = refuseStudentTokens(developmentAuth());
const api = buildApp({ repository: learning, authenticate });
await registerFamilyRoutes(api, { pool: learning.pool, authenticate });
await registerSchoolRoutes(api, {
  pool: learning.pool,
  authenticate,
  services: { origin, secret: "fixture-pilot-authority-browser-secret" },
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
const context = await browser.newContext({
  viewport: { width: 390, height: 900 },
});
const page = await context.newPage();
const failures: string[] = [];
page.on("pageerror", (error) => failures.push(error.message));
page.setDefaultTimeout(30000);
const artifacts = "artifacts/school-pilot-authority";
await mkdir(artifacts, { recursive: true });
async function capture(name: string) {
  for (const width of [320, 390, 768, 1280])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
        window.scrollTo(0, 0);
      }, theme);
      await page.waitForFunction(
        () =>
          !document.querySelector(".app-loading") &&
          !document.documentElement.hasAttribute("data-arriving"),
      );
      await page.evaluate(async () => {
        await document.fonts.ready;
        // A viewport resize delivers ResizeObserver updates before the next
        // paint. Let those updates and their React layout commit finish.
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
      });
      // Name what overflows, so a failure says where to look.
      const wide = await page.evaluate(() =>
        document.documentElement.scrollWidth <= innerWidth
          ? null
          : [...document.querySelectorAll("body *")]
              .filter((node) => node.getBoundingClientRect().right > innerWidth)
              .slice(-3)
              .map((node) => `${node.tagName}.${node.className}`),
      );
      assert.equal(wide, null, `${name} fits ${width}`);
      await page.screenshot({
        path: `${artifacts}/${name}-${width}-${theme}.png`,
        fullPage: true,
      });
    }
}
try {
  const waiting = "Waiting for the class’s teacher to start practice";
  for (const tab of ["roster", "today"]) {
    await page.goto(`${origin}/school/${school.id}/classes/${klass.id}/${tab}`);
    // Today says who starts; Students simply has nothing to start.
    if (tab === "today")
      await page.getByRole("heading", { name: waiting, exact: true }).waitFor();
    else await page.getByLabel("Class code").waitFor();
    assert.equal(await page.getByRole("button", { name: /^Start/ }).count(), 0);
    assert.equal(
      await page
        .getByRole("button", { name: "Request seats", exact: true })
        .count(),
      0,
    );
    await capture(`administrator-${tab}`);
  }
  assert.equal(
    (await learning.pool.query("SELECT 1 FROM amp_teacher_pilots")).rowCount,
    0,
  );
  // An administrator's own earlier pilot does not describe an unstarted class
  // taught by someone else. The live class membership still decides the action.
  const pilotUrl = `**/api/v1/school/classes/${klass.id}/pilot`;
  await page.route(pilotUrl, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      json: { ...(await response.json()), eligible: false },
    });
  });
  await page.reload();
  await page.getByRole("heading", { name: waiting, exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole("heading", { name: "Practice has ended", exact: true })
      .count(),
    0,
  );
  await page.unroute(pilotUrl);
  await schools.transaction(async (db) =>
    schools.enroll(
      db,
      klass.id,
      administrator.personId,
      "teacher",
      "2020-01-01",
    ),
  );
  for (const tab of ["today", "roster"]) {
    await page.goto(`${origin}/school/${school.id}/classes/${klass.id}/${tab}`);
    await page.reload();
    await page
      .getByRole("button", {
        name: tab === "today" ? "Start" : "Start practice",
        exact: true,
      })
      .waitFor();
    assert.equal(
      await page.getByRole("heading", { name: waiting, exact: true }).count(),
      0,
    );
  }
  await capture("enrolled-teacher");
  await page
    .getByRole("button", { name: "Start practice", exact: true })
    .click();
  await page.getByRole("link", { name: "Start class", exact: true }).waitFor();
  assert.equal(
    (
      await learning.pool.query(
        "SELECT 1 FROM amp_teacher_pilots WHERE account_id='development-household'",
      )
    ).rowCount,
    1,
  );
  assert.deepEqual(failures, []);
  console.info(
    "Only an enrolled teacher can activate the pilot in Today and Students; administrators can prepare classes without being offered teacher-only actions.",
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
