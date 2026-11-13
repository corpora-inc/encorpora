/** Browser acceptance for provider setup states. Provider responses are fixtures;
 * real provider authority/roster semantics are exercised by database integration tests. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { Pool } from "pg";
import { chromium as rawChromium } from "playwright";
import { createServer } from "vite";
import { secureChromium } from "../browser-security.mjs";
import { buildApp } from "../src/server/app";
import { PostgresRepository } from "../src/server/repository";
import { developmentAuth, refuseStudentTokens } from "../src/server/auth";
import { registerFamilyRoutes } from "../src/family/routes";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";

const url = process.env.AMP_TEST_DATABASE_URL!;
assertTestDatabaseTarget(url);
const port = 4492,
  origin = `http://127.0.0.1:${port}`;
const schema = `school_connect_ui_${randomUUID().replaceAll("-", "")}`;
const admin = new Pool({ connectionString: url, max: 1 });
await admin.query(`CREATE SCHEMA ${schema}`);
const scoped = new URL(url);
scoped.searchParams.set("options", `-c search_path=${schema}`);
await migrate(scoped.href);
const learning = new PostgresRepository(scoped.href);
const authenticate = refuseStudentTokens(developmentAuth());
const api = buildApp({ repository: learning, authenticate });
await registerFamilyRoutes(api, { pool: learning.pool, authenticate });
let accountsMode = true,
  failConnect = false;
let state: any;
const connectionId = randomUUID(),
  orgId = randomUUID(),
  schoolId = randomUUID();
const token = `po_${"a".repeat(43)}`;
const freshState = () => ({
  enabled: true,
  signInUrl: "/api/v1/school/sso/clever/start",
  districtSignupUrl: "https://schools.clever.com/signup/fixture",
  identity: null,
  connection: null,
  requests: [],
  existingSchools: [],
});
api.get("/api/v1/auth-config", async () =>
  accountsMode
    ? { mode: "accounts", passwords: true, providers: [], clever: true }
    : { mode: "development" },
);
api.get("/api/v1/provider/session", async (_request, reply) =>
  reply.code(401).send({ error: "provider_session_absent" }),
);
api.get("/api/auth/get-session", async () => null);
api.get("/api/v1/provider/onboarding-session", async (request, reply) =>
  request.headers.authorization === `Bearer ${token}`
    ? {
        token,
        accountId: "amp|fixture",
        expiresAt: new Date(Date.now() + 600000).toISOString(),
      }
    : reply.code(401).send({ error: "sign_in_required" }),
);
api.get("/api/v1/school/clever/status", async () => state);
api.post("/api/v1/school/sso/clever/link", async (_request, reply) =>
  reply.code(403).send({ error: "reauth_required" }),
);
api.post("/api/v1/school/clever/connect", async (request, reply) => {
  const input = request.body as { importNow: boolean };
  if (failConnect) {
    failConnect = false;
    return reply.code(503).send({ error: "clever_http_403" });
  }
  state.connection = {
    id: connectionId,
    orgId,
    status: "active",
    lastSyncAt: null,
    launchDate: null,
    lastError: null,
    syncing: input.importNow,
    syncPaused: !input.importNow,
  };
  return reply.code(202).send({
    connectionId,
    orgId,
    status: input.importNow ? "syncing" : "ready_to_import",
  });
});
api.post("/api/v1/school/clever/sync", async () => {
  state.connection.syncPaused = false;
  state.connection.syncing = true;
  return { status: "syncing" };
});
api.post("/api/v1/school/connection-requests", async (request, reply) => {
  assert.deepEqual(request.body, {
    institutionName: "Fixture school",
    contactEmail: "admin@example.test",
    method: "anyschool",
  });
  const row = {
    id: randomUUID(),
    method: "anyschool",
    status: "requested",
    createdAt: new Date().toISOString(),
  };
  state.requests = [row];
  return reply.code(202).send({
    ...row,
    next: "provider_invitation",
    manualStartUrl: "/school/start",
  });
});
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
const artifacts = "artifacts/school-connect";
await mkdir(artifacts, { recursive: true });
const failures: string[] = [];
const context = await browser.newContext({
    viewport: { width: 390, height: 900 },
  }),
  page = await context.newPage();
page.on("pageerror", (error) => failures.push(error.message));
page.setDefaultTimeout(30000);
async function capture(name: string) {
  for (const width of [320, 390, 768, 1280])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate((t) => {
        document.documentElement.dataset.theme = t;
        window.scrollTo(0, 0);
      }, theme);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${name} fits${width}`,
      );
      await page.screenshot({
        path: `${artifacts}/${name}-${width}-${theme}.png`,
        fullPage: true,
      });
    }
  await page.setViewportSize({ width: 390, height: 900 });
}
try {
  state = freshState();
  await page.goto(`${origin}/school/connect`);
  await page
    .getByRole("link", { name: "Continue with Clever", exact: true })
    .waitFor();
  await capture("guest");
  state = {
    ...freshState(),
    identity: {
      districtId: "fixture",
      roles: ["district_admin"],
      personId: null,
    },
    existingSchools: [{ id: schoolId, name: "Existing school" }],
    connection: {
      id: connectionId,
      orgId,
      status: "disconnected",
      lastSyncAt: null,
      launchDate: null,
      lastError: null,
      syncing: false,
      syncPaused: false,
    },
  };
  await page.goto(`${origin}/school/connect#clever-onboarding=${token}`);
  await page
    .getByRole("heading", { name: "Reconnect your district" })
    .waitFor();
  assert.equal(new URL(page.url()).hash, "");
  await page.getByLabel("Your name", { exact: true }).fill("District Admin");
  await page.getByRole("checkbox", { name: /authorized to connect/ }).check();
  assert.ok(
    await page.getByRole("checkbox", { name: /Bring existing/ }).isChecked(),
  );
  failConnect = true;
  await page
    .getByRole("button", { name: "Reconnect district", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: /has not granted/ })
    .waitFor();
  assert.equal(
    await page.getByLabel("Your name", { exact: true }).inputValue(),
    "District Admin",
  );
  await capture("connection-error");
  await page
    .getByRole("button", { name: "Reconnect district", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Bring your existing classes" })
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Import Clever roster" }).count(),
    0,
  );
  await page
    .getByRole("link", { name: "Continue with Clever to review schools" })
    .waitFor();
  await capture("paused-proof");
  await page.evaluate(() => sessionStorage.clear());
  accountsMode = false;
  await page.goto(`${origin}/school/connect`);
  await page.getByRole("link", { name: "Review existing schools" }).waitFor();
  await page.getByRole("button", { name: "Import Clever roster" }).click();
  await page.getByText("Syncing schools, classes and students").waitFor();
  state.connection = {
    ...state.connection,
    lastSyncAt: new Date().toISOString(),
    syncing: false,
  };
  state.identity.personId = randomUUID();
  await page
    .getByRole("heading", { name: "Your roster is connected" })
    .waitFor();
  await page.getByRole("link", { name: "Open your classes" }).waitFor();
  await capture("ready");
  state = freshState();
  await page.reload();
  await page
    .getByRole("button", {
      name: "Link Clever to this AMP account",
      exact: true,
    })
    .click();
  await page
    .getByRole("link", { name: "Sign in again to link Clever", exact: true })
    .waitFor();
  assert.ok(
    (
      await page
        .getByRole("link", { name: "Sign in again to link Clever" })
        .getAttribute("href")
    )?.includes("next=%2Fschool%2Fconnect"),
  );
  await capture("link-reauth");
  state = {
    ...freshState(),
    identity: { districtId: "fixture", roles: ["teacher"], personId: null },
  };
  await page.reload();
  await page
    .getByRole("heading", { name: "Your administrator connects Clever" })
    .waitFor();
  await page.getByLabel("School or district name").fill("Fixture school");
  await page.getByLabel("Contact email").fill("admin@example.test");
  await page
    .getByRole("button", { name: "Request a connection", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: /Request saved/ })
    .waitFor();
  await capture("provider-invitation");
  assert.deepEqual(failures, []);
  console.info(
    "Clever guest, reconnect failure/retry, preserved-roster pause, ready roster and pending AnySchool browser states passed.",
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
