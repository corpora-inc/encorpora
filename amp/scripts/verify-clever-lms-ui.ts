/**
 * The gradebook's LMS button and sheet in a real browser, against the real
 * API and a real database: a Clever-imported class in a Canvas district with
 * assignments in each state. Geometry at 320, 390, 768 and 1280, light and
 * dark. Screenshots land in docs/reviews/clever-lms/ for a person to look at.
 *
 *     AMP_TEST_DATABASE_URL=... npx tsx scripts/verify-clever-lms-ui.ts \
 *       [--widths 390,1280] [--port 4412]
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { Pool } from "pg";
import { chromium as rawChromium, type Browser, type Page } from "playwright";
import { createServer } from "vite";
import { secureChromium } from "../browser-security.mjs";
import { registerSchoolRoutes } from "../src/schools/routes";
import { SchoolRepository } from "../src/schools/repository";
import { registerCleverConnection } from "../src/schools/clever/connection";
import { syncCleverConnection } from "../src/schools/clever/sync";
import type { Snapshot } from "../src/schools/clever/model";
import { buildApp } from "../src/server/app";
import { refuseStudentTokens } from "../src/server/auth";
import { ApiError, PostgresRepository } from "../src/server/repository";
import { probe, settle, shellRecord, shiftRecorder } from "./app-shell-probe";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";

const url = process.env.AMP_TEST_DATABASE_URL;
if (!url) throw new Error("AMP_TEST_DATABASE_URL is required");
assertTestDatabaseTarget(url);
const argument = (name: string) => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : undefined;
};
const widths = (argument("--widths") ?? "320,390,768,1280")
  .split(",")
  .map(Number);
const themes = ["light", "dark"] as const;
const REVIEW = process.env.AMP_UI_REVIEW ?? "docs/reviews/clever-lms";
const ARTIFACTS = "artifacts/clever-lms";
const webPort = Number(argument("--port") ?? 4412),
  apiPort = webPort + 1,
  origin = `http://127.0.0.1:${webPort}`;
const TEACHER = "fixture-lms-teacher";
const failures: string[] = [];
const check = (label: string, ok: boolean, detail: unknown = "") => {
  if (!ok) failures.push(`${label}: ${JSON.stringify(detail)}`);
};

const D = "100000000000000000000001",
  S = "200000000000000000000001",
  T = "300000000000000000000099",
  X = "400000000000000000000001",
  TERM = "600000000000000000000001";
const NAMES = ["Amara", "Caleb", "Diego", "Hana", "Imani", "Jonah"];
const students = NAMES.map(
  (_, n) => `3000000000000000000000${String(n + 10).padStart(2, "0")}`,
);
const snapshot: Snapshot = {
  district: { id: D, name: "Riverbend District" },
  schools: [{ id: S, district: D, name: "Alder Street School" }],
  users: [
    {
      id: T,
      district: D,
      name: { first: "Ana", last: "Ruiz" },
      roles: { teacher: { school: S } },
    },
    ...students.map((id, n) => ({
      id,
      district: D,
      name: { first: NAMES[n]!, last: "Fixture" },
      roles: { student: { school: S, grade: "5" } },
    })),
  ],
  sections: [
    {
      id: X,
      district: D,
      school: S,
      name: "Grade 5 Math",
      students,
      teacher: T,
      teachers: [T],
      term_id: TERM,
    },
  ],
  courses: [],
  terms: [
    {
      id: TERM,
      district: D,
      name: "Fall",
      start_date: "2026-08-15",
      end_date: "2027-01-20",
    },
  ],
};

const schema = `amp_lms_ui_${randomUUID().replaceAll("-", "")}`;
const admin = new Pool({ connectionString: url, max: 1 });
const scoped = new URL(url);
scoped.searchParams.set("options", `-c search_path=${schema}`);
await admin.query(`CREATE SCHEMA ${schema}`);
await migrate(scoped.href);
const learning = new PostgresRepository(scoped.href);
const db = learning.pool;

const authenticate = refuseStudentTokens(async (request) => {
  if (request.headers.authorization !== "Bearer amp-local-development")
    throw new ApiError(401, "Sign in to continue");
  const who = request.headers["x-fixture-account"];
  return typeof who === "string" ? who : TEACHER;
});
const api = buildApp({ repository: learning, authenticate });
await registerSchoolRoutes(api, {
  pool: db,
  authenticate,
  services: {
    secret: "fixture-secret",
    origin: "",
    learning,
    lms: { environment: "sandbox" },
  },
});
api.get("/api/v1/auth-config", async () => ({ mode: "development" }));
await api.listen({ host: "127.0.0.1", port: apiPort });
const vite = await createServer({
  cacheDir: process.env.AMP_VITE_CACHE_DIR ?? "artifacts/vite-clever-lms",
  server: {
    hmr: false,
    host: "127.0.0.1",
    port: webPort,
    strictPort: true,
    proxy: { "/api": `http://127.0.0.1:${apiPort}` },
  },
});
await vite.listen();

const org = await new SchoolRepository(db).createOrg(
  { kind: "district", name: "Riverbend District", timezone: "America/Chicago" },
  { version: "fixture-1", signerName: "Fixture Signer", signerTitle: "Admin" },
);
const { id: connectionId } = await registerCleverConnection(db, {
  environment: "sandbox",
  districtId: D,
  tenantId: org.id,
});
await syncCleverConnection(
  db,
  connectionId,
  {
    districtToken: async () => "fixture",
    snapshot: async () => snapshot,
    latestEvent: async () => null,
    events: async () => [],
  },
  { mode: "full", now: new Date(Date.now() - 20 * 86_400_000) },
);
const bound = (
  await db.query(
    `SELECT b.kind,b.clever_id,b.local_id,c.org_id FROM amp_clever_bindings b
     LEFT JOIN amp_classes c ON c.id=b.local_id AND b.kind='section'
     WHERE b.connection_id=$1 AND b.kind IN ('section','user')`,
    [connectionId],
  )
).rows;
const section = bound.find((row) => row.kind === "section")!;
const classId = section.local_id as string;
const schoolId = section.org_id as string;
await db.query("UPDATE amp_people SET account_id=$2 WHERE id=$1", [
  bound.find((row) => row.clever_id === T)!.local_id,
  TEACHER,
]);
await db.query(
  "INSERT INTO amp_clever_lms(connection_id,lms_state,lms_type,checked_at) VALUES($1,'success','canvas',now())",
  [connectionId],
);
const day = (offset: number) =>
  new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const insert = async (fields: Record<string, unknown>) => {
  const id = randomUUID();
  const row = {
    id,
    class_id: classId,
    connection_id: connectionId,
    section_id: X,
    kind: "practice",
    title: "Practice this week",
    points_possible: 100,
    target_minutes: 60,
    opens_on: day(-3),
    due_on: day(3),
    due_at: new Date(Date.now() + 3 * 86_400_000),
    status: "published",
    clever_assignment_id: randomUUID(),
    lms_type: "canvas",
    ...fields,
  };
  const keys = Object.keys(row);
  await db.query(
    `INSERT INTO amp_lms_assignments(${keys.join(",")}) VALUES(${keys.map((_, n) => `$${n + 1}`).join(",")})`,
    Object.values(row),
  );
  return id;
};
const graded = await insert({});
for (const [n, id] of students.slice(0, 4).entries())
  await db.query(
    "INSERT INTO amp_lms_submissions(assignment_id,user_id,lms_state,sent_points,sent_at,failure_code) VALUES($1,$2,'submitted',$3,now(),$4)",
    [graded, id, 40 + n * 10, n === 3 ? "lms_user_not_in_lms" : null],
  );
await insert({
  title: "Fractions review, two weeks of practice before the unit test",
  failure_code: "lms_assignment_unpublished",
});
await insert({
  title: "Week of Nov 30",
  status: "unknown",
  clever_assignment_id: null,
  failure_code: "lms_create_outcome_unknown",
});
await insert({
  kind: "term_grade",
  title: "Fall grade",
  target_minutes: null,
  opens_on: null,
  session_id: (
    await db.query("SELECT session_id FROM amp_classes WHERE id=$1", [classId])
  ).rows[0].session_id,
  finalized_at: new Date(),
});

await mkdir(REVIEW, { recursive: true });
await mkdir(ARTIFACTS, { recursive: true });
const gradebook = `${origin}/school/${schoolId}/classes/${classId}/gradebook`;

async function device(
  browser: Browser,
  width: number,
  theme: "light" | "dark",
) {
  const context = await browser.newContext({
    viewport: { width, height: width < 720 ? 844 : 900 },
    colorScheme: theme,
    extraHTTPHeaders: { "x-fixture-account": TEACHER },
  });
  await context.addInitScript(shiftRecorder);
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  page.on("pageerror", (error) =>
    failures.push(`page error: ${error.message}`),
  );
  page.on("response", (response) => {
    if (response.status() >= 500 && response.url().includes("/api/"))
      failures.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  return { context, page };
}
async function shoot(page: Page, name: string, width: number, theme: string) {
  const review = width === 1280 || width === 390;
  await page.screenshot({
    path: `${review ? REVIEW : ARTIFACTS}/${name}-${width}-${theme}.png`,
  });
}
async function measure(page: Page, label: string) {
  const result = await probe(page);
  check(`${label} overflow`, result.overflow === 0, result.overflowing);
  check(
    `${label} targets`,
    result.smallTargets.length === 0,
    result.smallTargets,
  );
  check(`${label} truncated`, result.truncated.length === 0, result.truncated);
  check(`${label} overlaps`, result.overlaps.length === 0, result.overlaps);
  check(
    `${label} mid-word wraps`,
    result.midWordWraps.length === 0,
    result.midWordWraps,
  );
}

const browser = await secureChromium(rawChromium).launch();
try {
  for (const width of widths)
    for (const theme of themes) {
      const label = `${width} ${theme}`;
      const { context, page } = await device(browser, width, theme);
      try {
        await page.goto(gradebook);
        const button = page.getByRole("button", {
          name: "Canvas",
          exact: true,
        });
        await button.waitFor();
        await settle(page, 400);
        const record = await shellRecord(page);
        check(
          `${label} gradebook shifts`,
          !record || record.shifts.length === 0,
          record?.shifts,
        );
        await button.click();
        const sheet = page.getByRole("dialog");
        await sheet.getByText("Practice this week").waitFor();
        await settle(page, 300);
        check(
          `${label} rows`,
          (await sheet.getByRole("listitem").count()) === 4,
        );
        check(
          `${label} blocked line`,
          (await sheet.getByText("1 not in Canvas").count()) === 1,
        );
        check(
          `${label} unpublished line`,
          (await sheet
            .getByText("Publish it in Canvas to send grades.")
            .count()) === 1,
        );
        await measure(page, `${label} sheet`);
        await shoot(page, "lms-sheet", width, theme);
        await sheet.getByRole("button", { name: "New assignment" }).click();
        await sheet.getByLabel("Minutes").waitFor();
        await settle(page, 200);
        await measure(page, `${label} form`);
        await shoot(page, "lms-new", width, theme);
        await sheet.getByRole("radio", { name: "Term grade" }).click();
        await sheet.getByText("Term", { exact: true }).waitFor();
        await settle(page, 200);
        await measure(page, `${label} term form`);
        if (width === 390 || width === 1280)
          await shoot(page, "lms-term", width, theme);
      } finally {
        await context.close();
      }
    }
  // Publishing a real assignment through the sheet queues it.
  const { context, page } = await device(browser, 1280, "light");
  try {
    await page.goto(gradebook);
    await page.getByRole("button", { name: "Canvas", exact: true }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("button", { name: "New assignment" }).click();
    await sheet.getByLabel("Title").fill("Practice for the holiday week");
    await sheet.getByRole("button", { name: "Publish" }).click();
    await sheet.getByText("Practice for the holiday week").waitFor();
    const queued = (
      await db.query(
        "SELECT status,target_minutes FROM amp_lms_assignments WHERE title=$1",
        ["Practice for the holiday week"],
      )
    ).rows;
    assert.deepEqual(
      queued.map((row) => row.status),
      ["pending"],
    );
    check(
      "published row badge",
      (await sheet.getByText("Publishing").count()) >= 1,
    );
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
  await vite.close();
  await api.close();
  await db.end();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else
  console.log(`LMS sheet verified at ${widths.join(", ")} px, light and dark.`);
