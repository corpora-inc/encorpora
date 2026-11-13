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
const port = Number(process.env.AMP_SCHOOL_CONNECT_UI_PORT ?? 4492),
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
  failConnect = false,
  paidStudents = 0,
  rosterRequests = 0;
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
api.post("/api/v1/school/buyer", async () => ({
  id: schoolId,
  schoolName: "Fixture school",
  seats: 30,
  status: "active",
  classCount: 1,
  students: 25,
  participating: 20,
  pilots: [
    {
      status: "expired",
      startedAt: null,
      endsAt: null,
      graceEndsAt: null,
      eligible: false,
      authorized: true,
      coverage: { students: 25, covered: paidStudents, paid: paidStudents },
    },
  ],
}));
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
  rosterRequests++;
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
const artifacts = "artifacts/school-connect";
await mkdir(artifacts, { recursive: true });
const failures: string[] = [];
const paths: string[] = [];
const context = await browser.newContext({
    viewport: { width: 390, height: 900 },
  }),
  page = await context.newPage();
page.on("pageerror", (error) => failures.push(error.message));
page.on("framenavigated", (frame) => {
  if (frame === page.mainFrame()) paths.push(new URL(frame.url()).pathname);
});
page.setDefaultTimeout(30000);
async function capture(name: string) {
  await page.waitForFunction(
    () =>
      !document.querySelector(".app-loading") &&
      !document.documentElement.hasAttribute("data-arriving"),
  );
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
  await page.evaluate(() =>
    localStorage.setItem(
      "amp.student",
      JSON.stringify({ accountId: "school:fixture", token: "st_fixture" }),
    ),
  );
  const escapedProof: string[] = [];
  page.on("request", (request) => {
    if (
      request.headers().authorization === `Bearer ${token}` &&
      ![
        "/api/v1/provider/onboarding-session",
        "/api/v1/school/clever/status",
        "/api/v1/school/clever/connect",
      ].includes(new URL(request.url()).pathname)
    )
      escapedProof.push(new URL(request.url()).pathname);
  });
  // A stale student's expiry check must not replace the incoming adult setup.
  await page.route("**/api/v1/provider/onboarding-session", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.continue();
  });
  await page.goto(`${origin}/school/connect#clever-onboarding=${token}`);
  await page
    .getByRole("heading", { name: "Reconnect your district" })
    .waitFor();
  assert.equal(new URL(page.url()).hash, "");
  assert.equal(
    await page.evaluate(() => localStorage.getItem("amp.student")),
    null,
  );
  await page.unroute("**/api/v1/provider/onboarding-session");
  await page.getByLabel("Your name", { exact: true }).fill("District Admin");
  await page.getByRole("checkbox", { name: /authorized to connect/ }).check();
  assert.ok(
    await page.getByRole("checkbox", { name: /Bring in schools/ }).isChecked(),
  );
  failConnect = true;
  await page
    .getByRole("button", { name: "Reconnect district", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: /hasn’t shared/ })
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
    .getByText("Connected. Bring in your existing AMP schools")
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Import roster" }).count(),
    0,
  );
  await page.getByRole("link", { name: "Review schools" }).waitFor();
  // A Clever sign-in mid-way is the sign-in: no second "Sign in" above it.
  assert.equal(await page.getByRole("link", { name: "Sign in" }).count(), 0);
  await capture("paused-proof");
  await page.evaluate(() => sessionStorage.clear());
  accountsMode = false;
  // The signed-in AMP account administers the connected district: only an
  // AMP admin is offered a sync.
  await page.route("**/api/v1/school/orgs", (route) =>
    route.fulfill({
      json: {
        orgs: [
          {
            id: orgId,
            kind: "district",
            name: "Fixture district",
            parentId: null,
            timezone: "UTC",
            roles: ["admin"],
            can: ["integrations.manage"],
          },
        ],
      },
    }),
  );
  await page.goto(`${origin}/school/connect`);
  await page.getByRole("link", { name: "Review schools" }).waitFor();
  state.connection.lastError = "clever_district_admin_required";
  await page.reload();
  await page
    .getByText("Sign in with Clever again to confirm you’re a district admin.")
    .waitFor();
  await page.getByRole("link", { name: "Sign in with Clever" }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Import roster" }).count(),
    0,
  );
  assert.equal(
    await page.getByRole("link", { name: "Review schools" }).count(),
    0,
  );
  await capture("paused-authority-error");
  state.connection.lastError = null;
  await page.reload();
  await page.getByRole("button", { name: "Import roster" }).click();
  await page.getByText("Importing").waitFor();
  state.connection = {
    ...state.connection,
    lastSyncAt: new Date().toISOString(),
    syncing: false,
  };
  state.identity.personId = randomUUID();
  await page.getByText(/^Synced /).waitFor();
  await page.getByRole("link", { name: "Open your classes" }).waitFor();
  await capture("ready");
  state.connection.syncState = "delayed";
  state.connection.syncing = true;
  state.connection.lastSyncAt = null;
  await page.reload();
  await page
    .getByText("Your connection is saved. The roster import is delayed.")
    .waitFor();
  assert.equal(await page.getByText("Importing", { exact: true }).count(), 0);
  assert.equal(
    await page.getByRole("button", { name: "Retry import" }).isDisabled(),
    false,
  );
  await capture("import-delayed");
  state.connection.syncState = "ready";
  state.connection.syncing = false;
  state.connection.lastSyncAt = new Date().toISOString();
  await page.reload();
  // Right after a sync the next isn't open yet: no button that would be
  // refused, only when it opens; a refresh keeps it so (server state).
  Object.assign(state.connection, {
    syncAvailableAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  });
  await page.reload();
  await page.getByText(/· next sync /).waitFor();
  assert.equal(await page.getByRole("button", { name: "Sync now" }).count(), 0);
  Object.assign(state.connection, { syncAvailableAt: null });
  await page.reload();
  await page.getByRole("button", { name: "Sync now" }).waitFor();
  state = freshState();
  await page.reload();
  await page.getByRole("button", { name: "Link Clever", exact: true }).click();
  await page
    .getByRole("link", { name: "Sign in again", exact: true })
    .waitFor();
  assert.ok(
    (
      await page
        .getByRole("link", { name: "Sign in again" })
        .getAttribute("href")
    )?.includes("next=%2Fschool%2Fconnect"),
  );
  await capture("link-reauth");
  await page
    .getByText("Connect another roster system", { exact: true })
    .click();
  await page
    .getByLabel("School or district", { exact: true })
    .fill("Fixture school");
  await page
    .getByLabel("Contact email", { exact: true })
    .fill("admin@example.test");
  await page
    .getByRole("button", { name: "Request a connection", exact: true })
    .click();
  await page
    .getByText(
      "Connection requested. Watch your email for an AnySchool invitation.",
    )
    .waitFor();
  await page.reload();
  await page
    .getByText(
      "Connection requested. Watch your email for an AnySchool invitation.",
    )
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Request a connection", exact: true })
      .count(),
    0,
  );
  await page
    .getByRole("link", { name: "Set up a class without Clever", exact: true })
    .waitFor();
  assert.equal(
    rosterRequests,
    1,
    "Reload resumes the request without submitting twice",
  );
  await capture("anyschool-requested");
  state.requests[0].status = "invited";
  await page.reload();
  await page
    .getByText(
      "Your AnySchool invitation is ready. Open the invitation in your email to connect your roster.",
    )
    .waitFor();
  state = {
    ...freshState(),
    identity: { districtId: "fixture", roles: ["teacher"], personId: null },
  };
  await page.reload();
  await page.getByText("Your district admin connects Clever.").waitFor();
  await page.getByRole("link", { name: "Set up your class" }).waitFor();
  assert.equal(
    await page
      .getByText("Connect another roster system", { exact: true })
      .count(),
    0,
  );
  await capture("teacher-waits");
  await page.goto(`${origin}/schools/continue#token=${"b".repeat(43)}`);
  await page.getByText("Your seats are confirmed.").waitFor();
  assert.equal(new URL(page.url()).hash, "");
  assert.equal(await page.getByText(/Students have access/).count(), 0);
  assert.equal(
    await page.getByRole("heading", { name: "Get a quote" }).count(),
    0,
  );
  await page.route("**/api/v1/school/buyer", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "school_service_unavailable" },
    }),
  );
  await page.reload();
  await page
    .getByRole("heading", { name: "This request couldn’t load" })
    .waitFor();
  assert.equal(
    await page.getByRole("heading", { name: "This link has expired" }).count(),
    0,
  );
  await page.unroute("**/api/v1/school/buyer");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page.getByText("Your seats are confirmed.").waitFor();
  paidStudents = 25;
  await page.reload();
  await page.getByText("Your seats are confirmed.").waitFor();
  await page.getByText(/Students have access/).waitFor();
  await capture("purchase-active");
  assert.deepEqual(escapedProof, []);
  accountsMode = true;
  await page.goto(`${origin}/sign-in?error=clever_sign_in_busy`);
  await page
    .getByText("Clever sign-in is busy. Try again in a moment.")
    .waitFor();
  await page
    .getByRole("link", { name: "Sign in with Clever", exact: true })
    .waitFor();
  await capture("clever-sign-in-busy");
  assert.deepEqual(failures, []);
  console.info(
    "Clever connection, paused authority recovery, teacher hand-off and confirmed purchase browser states passed.",
  );
} catch (error) {
  console.info("Connection navigation paths", paths);
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
