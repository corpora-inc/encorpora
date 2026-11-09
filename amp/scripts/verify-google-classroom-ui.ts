/**
 * Google Classroom roster import in a real browser, against the real API and a
 * real database, with Google mocked by a local server: from a class's roster,
 * connect (the consent redirect carries the three read-only scopes), pick a
 * course, preview the dry run, import. Geometry at 390 and 1280.
 *
 *     AMP_TEST_DATABASE_URL=... npx tsx scripts/verify-google-classroom-ui.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer as createHttp } from "node:http";
import { Pool } from "pg";
import { chromium, type Page } from "playwright";
import { createServer } from "vite";
import { secureChromium } from "../browser-security.mjs";
import { registerAnalyticsRoutes } from "../src/analytics/routes";
import { registerUnavailableBilling } from "../src/billing/stripe/routes";
import { registerFamilyRoutes } from "../src/family/routes";
import { CLASSROOM_SCOPES } from "../src/schools/google-classroom";
import { SchoolRepository } from "../src/schools/repository";
import { registerSchoolRoutes } from "../src/schools/routes";
import { buildApp } from "../src/server/app";
import { developmentAuth, refuseStudentTokens } from "../src/server/auth";
import { PostgresRepository } from "../src/server/repository";
import { probe, settle, shellRecord, shiftRecorder } from "./app-shell-probe";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";

const url = process.env.AMP_TEST_DATABASE_URL;
if (!url) throw new Error("AMP_TEST_DATABASE_URL is required");
assertTestDatabaseTarget(url);
const webPort = 4440,
  apiPort = 4441,
  googlePort = 4442;
const origin = `http://127.0.0.1:${webPort}`;
const failures: string[] = [];
const check = (label: string, ok: boolean, detail: unknown = "") => {
  if (!ok) failures.push(`${label}: ${JSON.stringify(detail)}`);
};

/** Google: a consent screen that redirects straight back, a token endpoint, and
 * Classroom's two lists. */
const asked: string[] = [];
const google = createHttp((request, response) => {
  const target = new URL(request.url!, `http://127.0.0.1:${googlePort}`);
  response.setHeader("content-type", "application/json");
  if (target.pathname === "/authorize") {
    asked.push(target.searchParams.get("scope") ?? "");
    const back = new URL(target.searchParams.get("redirect_uri")!);
    back.searchParams.set("code", "mock-code");
    back.searchParams.set("state", target.searchParams.get("state")!);
    response.statusCode = 302;
    response.setHeader("location", back.href);
    return void response.end();
  }
  if (target.pathname === "/token")
    return void response.end(
      JSON.stringify({
        access_token: "mock-token",
        scope: CLASSROOM_SCOPES.join(" "),
      }),
    );
  if (target.pathname === "/v1/courses")
    return void response.end(
      JSON.stringify({
        courses: [
          { id: "c-100", name: "Period 2 Math" },
          { id: "c-200", name: "Period 5 Pre-Algebra" },
        ],
      }),
    );
  if (target.pathname === "/v1/courses/c-100/students")
    return void response.end(
      JSON.stringify({
        students: ["Ana", "Noor", "Lena", "Diego"].map((name, index) => ({
          userId: `g-${index}`,
          profile: {
            name: { givenName: name, familyName: "Fixture" },
            emailAddress: `${name.toLowerCase()}@school.example`,
          },
        })),
      }),
    );
  response.statusCode = 404;
  response.end("{}");
});
await new Promise<void>((done) => google.listen(googlePort, "127.0.0.1", done));

const schema = `amp_gclass_ui_${randomUUID().replaceAll("-", "")}`;
const admin = new Pool({ connectionString: url, max: 1 });
const scoped = new URL(url);
scoped.searchParams.set("options", `-c search_path=${schema}`);
await admin.query(`CREATE SCHEMA ${schema}`);
await migrate(scoped.href);
const learning = new PostgresRepository(scoped.href);
const schools = new SchoolRepository(learning.pool);
const authenticate = refuseStudentTokens(developmentAuth());
const api = buildApp({ repository: learning, authenticate });
await registerFamilyRoutes(api, { pool: learning.pool, authenticate });
await registerSchoolRoutes(api, {
  pool: learning.pool,
  authenticate,
  services: {
    secret: "fixture-secret-fixture-secret-fixture-secret",
    origin,
    classroom: {
      clientId: "mock-client",
      clientSecret: "mock-secret",
      authorizationEndpoint: `http://127.0.0.1:${googlePort}/authorize`,
      tokenEndpoint: `http://127.0.0.1:${googlePort}/token`,
      apiBase: `http://127.0.0.1:${googlePort}/v1`,
    },
  },
});
await registerUnavailableBilling(api, authenticate);
await registerAnalyticsRoutes(api, { pool: learning.pool, authenticate });
api.get("/api/v1/auth-config", async () => ({ mode: "development" }));
await api.listen({ host: "127.0.0.1", port: apiPort });
const vite = await createServer({
  cacheDir: "node_modules/.vite-google-classroom",
  server: {
    host: "127.0.0.1",
    port: webPort,
    strictPort: true,
    proxy: { "/api": `http://127.0.0.1:${apiPort}` },
  },
});
await vite.listen();

const org = await schools.createOrg(
  { kind: "school", name: "Fixture Academy", timezone: "America/New_York" },
  { version: "fixture-1", signerName: "Fixture Signer", signerTitle: "Head" },
);
await schools.issueLicense({
  orgId: org.id,
  seats: 100,
  endsAt: new Date(Date.now() + 365 * 86_400_000).toISOString(),
});
await schools.addStaff({
  orgId: org.id,
  role: "admin",
  givenName: "Grace",
  familyName: "Okafor",
  accountId: "development-household",
});
const klass = await schools.createClass(org.id, {
  name: "Period 2 Math",
  courseBands: [],
});

async function geometry(page: Page, label: string) {
  await page.mouse.move(0, 0);
  await settle(page, 450);
  const result = await probe(page);
  check(`${label} overflow`, result.overflow === 0, result.overflow);
  check(
    `${label} targets`,
    result.smallTargets.length === 0,
    result.smallTargets,
  );
  check(`${label} overlaps`, result.overlaps.length === 0, result.overlaps);
  const { cls } = await shellRecord(page);
  check(`${label} CLS`, cls <= 0.01, cls);
}

let exit = 0;
const browser = await secureChromium(chromium).launch();
try {
  for (const width of [390, 1280]) {
    const label = `${width}`;
    const context = await browser.newContext({
      viewport: { width, height: width < 720 ? 844 : 900 },
    });
    await context.addInitScript(shiftRecorder);
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);
    page.on("pageerror", (error) =>
      check(`${label} page error`, false, String(error)),
    );
    await page.goto(`${origin}/school/${org.id}/classes/${klass.id}/roster`);
    await page
      .getByRole("button", { name: "Import from Google Classroom" })
      .click();
    // Google's consent, then back to the import with a connection.
    await page.waitForURL(/\/import\?google=ready/);
    check(
      `${label} three read-only scopes`,
      asked.at(-1) === CLASSROOM_SCOPES.join(" "),
      asked.at(-1),
    );
    await page.getByRole("button", { name: "Choose a course" }).click();
    await page.getByRole("button", { name: "Period 2 Math" }).click();
    await geometry(page, `${label} courses`);
    await page.getByRole("button", { name: "Preview changes" }).click();
    await page.getByRole("heading", { name: /^4 students/ }).waitFor();
    assert.ok(await page.getByText("Ana Fixture").first().isVisible());
    await geometry(page, `${label} preview`);
    if (width === 390) {
      await page.getByRole("button", { name: "Apply changes" }).click();
      await page.getByRole("heading", { name: /4 students added/ }).waitFor();
      await geometry(page, `${label} done`);
    } else {
      // The second import of the same course changes nothing.
      await page.getByText("Your roster already matches this file.").waitFor();
    }
    await context.close();
    // Importing again, the same four are already here.
    if (width === 390) {
      const students = await learning.pool.query(
        `SELECT count(*)::int AS n FROM amp_external_refs WHERE source='google-classroom:c-100' AND kind='person'`,
      );
      check(
        "four students imported",
        students.rows[0].n === 4,
        students.rows[0],
      );
      const classes = await learning.pool.query(
        `SELECT local_id FROM amp_external_refs WHERE source='google-classroom:c-100' AND kind='class'`,
      );
      check(
        "linked to the class the teacher was on",
        classes.rows[0]?.local_id === klass.id,
        classes.rows,
      );
    }
    // 1280 starts over: the same students reconcile as unchanged, never again new.
  }
  if (failures.length) {
    console.error(`${failures.length} failed:\n${failures.join("\n")}`);
    exit = 1;
  } else console.log("Google Classroom import verified");
} catch (error) {
  console.error(error);
  if (failures.length) console.error(failures.join("\n"));
  exit = 1;
} finally {
  await browser.close();
  await vite.close();
  await api.close();
  google.close();
  await learning.pool.end();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
process.exit(exit);
