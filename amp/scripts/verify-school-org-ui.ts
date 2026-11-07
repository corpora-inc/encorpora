/**
 * The school and district layer in real browsers, against the real API and a real
 * database: an admin reads the overview, rolls a year over, moves a student to
 * another campus, turns on Google sign-in and a student signs in through a fake
 * provider that really signs its tokens, exports the school and the file parses,
 * deletes a student, and sees it all in the activity log. Geometry at 320, 390,
 * 768 and 1280, light and dark. A 10,000-student, 12-school district is built by
 * direct SQL and its overview is timed. Screenshots land in
 * docs/reviews/school-org/ for a person to look at.
 *
 *     AMP_TEST_DATABASE_URL=... npx tsx scripts/verify-school-org-ui.ts \
 *       [--engine chromium|webkit] [--widths 390,1280] [--themes light,dark] [--skip-sweep] [--skip-journey] [--measure-only] [--small]
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, mkdir } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { strFromU8, unzipSync } from "fflate";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { Pool } from "pg";
import {
  chromium as rawChromium,
  webkit,
  type Browser,
  type Page,
} from "playwright";
import { createServer } from "vite";
import { secureChromium } from "../browser-security.mjs";
import { registerAnalyticsRoutes } from "../src/analytics/routes";
import { registerUnavailableBilling } from "../src/billing/stripe/routes";
import { registerFamilyRoutes } from "../src/family/routes";
import type { OidcProvider } from "../src/schools/oidc";
import { SchoolRepository } from "../src/schools/repository";
import { registerSchoolRoutes } from "../src/schools/routes";
import { buildApp } from "../src/server/app";
import { developmentAuth, refuseStudentTokens } from "../src/server/auth";
import { PostgresRepository } from "../src/server/repository";
import {
  probe,
  resetRecord,
  settle,
  shellRecord,
  shiftRecorder,
} from "./app-shell-probe";
import { migrate } from "./migrate";
import { seedCalendar, seedSchools } from "./school-org-fixture";
import { assertTestDatabaseTarget } from "./test-database-preflight";

const url = process.env.AMP_TEST_DATABASE_URL;
if (!url) throw new Error("AMP_TEST_DATABASE_URL is required");
assertTestDatabaseTarget(url);
const argument = (name: string) => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : undefined;
};
const engines = argument("--engine")
  ? [argument("--engine") as "chromium" | "webkit"]
  : (["chromium", "webkit"] as const);
const widths = (argument("--widths") ?? "320,390,768,1280")
  .split(",")
  .map(Number);
const themes = (argument("--themes") ?? "light,dark").split(",") as (
  "light" | "dark"
)[];
const REVIEW = "docs/reviews/school-org";
const ARTIFACTS = "artifacts/school-org";
const webPort = 4404,
  apiPort = 4405,
  origin = `http://127.0.0.1:${webPort}`;
const ACCOUNT = "development-household";
const DAY = 86_400_000;

/* One account drives every screen as fast as a browser can load it, faster than
   any person: stay under the per-credential limit rather than measure it. */
const apiCalls: number[] = [];
async function paced() {
  for (;;) {
    const recent = apiCalls.filter((at) => at > Date.now() - 60_000).length;
    if (recent < 420) return;
    await new Promise((done) => setTimeout(done, 2000));
  }
}
const failures: string[] = [];
function check(label: string, ok: boolean, detail: unknown = "") {
  if (!ok) failures.push(`${label}: ${JSON.stringify(detail)}`);
}

/* The provider: its own keys, and it signs what the test says it signs. */
const keys = await generateKeyPair("RS256");
const jwk = { ...(await exportJWK(keys.publicKey)), kid: "k1", alg: "RS256" };
let nextEmail = "";
let nextVerified = true;
let lastNonce = "";
const providerServer = createHttpServer((request, response) => {
  const here = new URL(request.url ?? "/", "http://127.0.0.1");
  if (here.pathname === "/jwks") {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ keys: [jwk] }));
  } else if (here.pathname === "/authorize") {
    lastNonce = here.searchParams.get("nonce") ?? "";
    const back = new URL(here.searchParams.get("redirect_uri")!);
    back.searchParams.set("code", "fake-code");
    back.searchParams.set("state", here.searchParams.get("state")!);
    response.statusCode = 302;
    response.setHeader("location", back.href);
    response.end();
  } else if (here.pathname === "/token") {
    void new SignJWT({
      email: nextEmail,
      email_verified: nextVerified,
      nonce: lastNonce,
    })
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer("https://fake-provider.test")
      .setAudience("fake-google-client-id")
      .setSubject("student")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(keys.privateKey)
      .then((token) => {
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({ id_token: token }));
      });
  } else {
    response.statusCode = 404;
    response.end();
  }
});
await new Promise<void>((done) => providerServer.listen(0, "127.0.0.1", done));
const providerBase = `http://127.0.0.1:${(providerServer.address() as AddressInfo).port}`;
const fakeGoogle: OidcProvider = {
  clientId: "fake-google-client-id",
  clientSecret: "fake-secret",
  authorizationEndpoint: `${providerBase}/authorize`,
  tokenEndpoint: `${providerBase}/token`,
  jwksUri: `${providerBase}/jwks`,
  issuer: ({ iss }) => iss === "https://fake-provider.test",
  emailVerified: ({ email_verified: verified }) => verified === true,
};

const schema = `amp_org_ui_${randomUUID().replaceAll("-", "")}`;
const admin = new Pool({ connectionString: url, max: 1 });
const scoped = new URL(url);
scoped.searchParams.set("options", `-c search_path=${schema}`);
await admin.query(`CREATE SCHEMA ${schema}`);
await migrate(scoped.href);
const learning = new PostgresRepository(scoped.href);
const db = learning.pool;
const schools = new SchoolRepository(db);
const authenticate = refuseStudentTokens(developmentAuth());
const api = buildApp({ repository: learning, authenticate });
const mail: { to: string; subject: string }[] = [];
await registerFamilyRoutes(api, { pool: db, authenticate });
await registerSchoolRoutes(api, {
  pool: db,
  authenticate,
  services: {
    secret: "verify-secret",
    origin,
    mail: async (to, subject) => {
      mail.push({ to, subject });
    },
    signIn: {
      google: "fake-google-client-id.apps.example",
      microsoft: "00000000-0000-4000-8000-000000000000",
    },
    oidc: { google: fakeGoogle, microsoft: fakeGoogle },
  },
});
await registerUnavailableBilling(api, authenticate);
await registerAnalyticsRoutes(api, { pool: db, authenticate });
api.get("/api/v1/auth-config", async () => ({ mode: "development" }));
await api.listen({ host: "127.0.0.1", port: apiPort });
const vite = await createServer({
  cacheDir: "node_modules/.vite-school-org",
  server: {
    host: "127.0.0.1",
    port: webPort,
    strictPort: true,
    proxy: { "/api": `http://127.0.0.1:${apiPort}` },
  },
});
await vite.listen();

const agreement = (signerName: string, signerTitle: string) => ({
  version: "fixture-1",
  signerName,
  signerTitle,
});
const asTitled = (personId: string, name: string) =>
  db.query("UPDATE amp_people SET display_name=$2 WHERE id=$1", [
    personId,
    name,
  ]);
const yearAhead = new Date(Date.now() + 300 * DAY).toISOString();

/* One school, full of a term's practice: what a head sees. */
async function buildSchool() {
  const org = await schools.createOrg(
    {
      kind: "school",
      name: "Alder Street School",
      timezone: "America/New_York",
    },
    agreement("Ruth Adeyemi", "Head of School"),
  );
  const license = await schools.issueLicense({
    orgId: org.id,
    seats: 450,
    endsAt: yearAhead,
  });
  const head = await schools.addStaff({
    orgId: org.id,
    role: "admin",
    givenName: "Ruth",
    familyName: "Adeyemi",
    accountId: ACCOUNT,
  });
  await asTitled(head.personId, "Dr. Adeyemi");
  const client = await db.connect();
  const year = await seedCalendar(client, org.id).finally(() =>
    client.release(),
  );
  const counts = await seedSchools(
    schools,
    { id: org.id, timezone: "America/New_York" },
    year,
    [
      {
        id: org.id,
        name: "Alder Street School",
        grades: [3, 4, 5, 6, 7, 8],
        classesPerGrade: 3,
        studentsPerClass: 24,
      },
    ],
    {
      licenseId: license.licenseId,
      seatShare: 0.98,
      signedInShare: 0.97,
      quietEvery: 7,
      untaughtEvery: 11,
      emailDomain: "alderstreet.example",
    },
  );
  console.log(`Alder Street School: ${JSON.stringify(counts)}`);
  return org.id;
}

/* A district at full size, for its overview and its clock. */
async function buildDistrict() {
  const org = await schools.createOrg(
    {
      kind: "district",
      name: "Juniper Valley Schools",
      timezone: "America/Chicago",
    },
    agreement("Dana Ruiz", "Superintendent"),
  );
  const head = await schools.addStaff({
    orgId: org.id,
    role: "admin",
    givenName: "Dana",
    familyName: "Ruiz",
    accountId: ACCOUNT,
  });
  await asTitled(head.personId, "Dr. Ruiz");
  const license = await schools.issueLicense({
    orgId: org.id,
    seats: 10_250,
    endsAt: yearAhead,
  });
  const client = await db.connect();
  const year = await seedCalendar(client, org.id).finally(() =>
    client.release(),
  );
  const elementary = [
    "Aspen Ridge",
    "Birch Hollow",
    "Cedar Grove",
    "Dogwood Lane",
    "Elm Crossing",
    "Fern Hill",
    "Glenwood",
  ];
  const middle = ["Harbor View", "Ironwood", "Juniper Heights"];
  const high = ["Kestrel Valley", "Larkspur"];
  const made: {
    id: string;
    name: string;
    grades: number[];
    classesPerGrade: number;
    studentsPerClass: number;
  }[] = [];
  for (const [names, suffix, grades, sections] of [
    [elementary, "Elementary", [0, 1, 2, 3, 4, 5], 4],
    [middle, "Middle School", [6, 7, 8], 10],
    [high, "High School", [9, 10, 11, 12], 16],
  ] as const)
    for (const name of names) {
      const full = `${name} ${suffix}`;
      const school = await schools.createOrg({
        kind: "school",
        name: full,
        parentId: org.id,
      });
      made.push({
        id: school.id,
        name: full,
        grades: [...grades],
        classesPerGrade: sections,
        studentsPerClass: 0,
      });
    }
  // 10,000 students across the twelve, in classes of about 25.
  const seats = made.reduce(
    (sum, school) => sum + school.grades.length * school.classesPerGrade,
    0,
  );
  const target = process.argv.includes("--small") ? 1200 : 10_000;
  for (const school of made)
    school.studentsPerClass = Math.floor(target / seats);
  const spare =
    target -
    made.reduce(
      (sum, school) =>
        sum +
        school.grades.length * school.classesPerGrade * school.studentsPerClass,
      0,
    );
  made[0]!.studentsPerClass += Math.ceil(
    spare / (made[0]!.grades.length * made[0]!.classesPerGrade),
  );
  const started = Date.now();
  const counts = await seedSchools(
    schools,
    { id: org.id, timezone: "America/Chicago" },
    year,
    made,
    {
      licenseId: license.licenseId,
      seatShare: 0.988,
      signedInShare: 0.965,
      quietEvery: 31,
      untaughtEvery: 47,
      skillsPerDay: 3,
      emailDomain: "junipervalley.example",
    },
  );
  console.log(
    `Juniper Valley Schools: ${JSON.stringify(counts)} in ${Math.round((Date.now() - started) / 1000)} s`,
  );
  return { id: org.id, school: made[0]!.id };
}

async function measure(orgId: string, label: string) {
  const times: number[] = [];
  let body = "";
  for (let index = 0; index < 60; index++) {
    const started = performance.now();
    const response = await fetch(
      `http://127.0.0.1:${apiPort}/api/v1/school/orgs/${orgId}/overview`,
      { headers: { authorization: "Bearer amp-local-development" } },
    );
    body = await response.text();
    assert.equal(response.status, 200, body);
    if (index >= 5) times.push(performance.now() - started);
  }
  times.sort((a, b) => a - b);
  const at = (share: number) =>
    Math.round(times[Math.floor((times.length - 1) * share)]!);
  const size = Math.round(body.length / 1024);
  console.log(
    `${label} overview: p50 ${at(0.5)} ms, p95 ${at(0.95)} ms, max ${at(1)} ms (${times.length} requests, ${size} KB)`,
  );
  return at(0.95);
}

await mkdir(REVIEW, { recursive: true });
await mkdir(ARTIFACTS, { recursive: true });

async function shoot(
  page: Page,
  engine: string,
  name: string,
  width: number,
  theme: string,
) {
  const inReview = engine === "chromium" && (width === 1280 || width === 390);
  await page.screenshot({
    path: `${inReview ? REVIEW : ARTIFACTS}/${name}-${width}-${theme}${engine === "chromium" ? "" : `-${engine}`}.png`,
    fullPage: true,
  });
}
async function geometry(page: Page, label: string) {
  const result = await probe(page);
  check(`${label} overflow`, result.overflow === 0, result.overflow);
  check(
    `${label} targets`,
    result.smallTargets.length === 0,
    result.smallTargets,
  );
  check(
    `${label} mid-word wraps`,
    result.midWordWraps.length === 0,
    result.midWordWraps,
  );
  check(`${label} truncated`, result.truncated.length === 0, result.truncated);
  check(`${label} overlaps`, result.overlaps.length === 0, result.overlaps);
  const { shifts, cls } = await shellRecord(page);
  check(`${label} CLS`, cls <= 0.01, cls);
  check(`${label} moved`, shifts.length === 0, shifts);
}
type Box = { left: number; top: number; width: number; height: number };
const boxes = (page: Page, selector: string): Promise<Box[]> =>
  page.locator(selector).evaluateAll((elements) =>
    elements
      .map((element) => {
        const { left, top, width, height } = element.getBoundingClientRect();
        return { left, top: top + scrollY, width, height };
      })
      .filter((box) => box.width > 0 && box.height > 0),
  );
function sameBoxes(label: string, before: Box[], after: Box[]) {
  check(
    `${label} moved something`,
    JSON.stringify(before) === JSON.stringify(after),
    { before: before.slice(0, 3), after: after.slice(0, 3) },
  );
}
const heading = (page: Page, name: string | RegExp) =>
  page.getByRole("heading", { name, level: 1 });
const settled = async (page: Page) => {
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.fonts.ready);
  await settle(page, 450);
};
async function viewScreen(
  page: Page,
  engine: string,
  label: string,
  name: string,
  width: number,
  theme: string,
  path: string,
  ready: string | RegExp,
) {
  await paced();
  await page.goto(origin + path);
  await heading(page, ready).waitFor({ timeout: 45_000 });
  await settled(page);
  await geometry(page, `${label} ${name}`);
  await shoot(page, engine, name, width, theme);
  await resetRecord(page);
}

/** Every screen at one width and theme, looked at and measured. */
async function sweep(
  browser: Browser,
  engine: string,
  width: number,
  theme: "light" | "dark",
  places: {
    school: string;
    district: string;
    districtSchool: string;
    studentPerson: string;
  },
) {
  const label = `${engine} ${width} ${theme}`;
  const context = await browser.newContext({
    viewport: { width, height: width < 720 ? 844 : 900 },
    colorScheme: theme,
    acceptDownloads: true,
  });
  await context.addInitScript(shiftRecorder);
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  page.on("pageerror", (error) =>
    console.log(`${label} page error: ${error.message}`),
  );
  if (process.env.VERIFY_CONSOLE)
    page.on("console", (message) => {
      if (message.type() === "error")
        console.log(`${label} console: ${message.text().slice(0, 400)}`);
    });
  page.on("response", (response) => {
    if (response.url().includes("/api/")) apiCalls.push(Date.now());
    if (response.status() >= 500 && response.url().includes("/api/v1/school/"))
      failures.push(
        `${label} ${response.status()} ${new URL(response.url()).pathname}`,
      );
  });
  try {
    const { school, district, districtSchool } = places;
    await viewScreen(
      page,
      engine,
      label,
      "school-overview",
      width,
      theme,
      `/school/${school}`,
      /^Good /,
    );
    await viewScreen(
      page,
      engine,
      label,
      "district-overview",
      width,
      theme,
      `/school/${district}`,
      /^Good /,
    );
    await viewScreen(
      page,
      engine,
      label,
      "district-school",
      width,
      theme,
      `/school/${districtSchool}`,
      /^Good /,
    );
    await viewScreen(
      page,
      engine,
      label,
      "schools",
      width,
      theme,
      `/school/${district}/schools`,
      "Schools",
    );
    await viewScreen(
      page,
      engine,
      label,
      "year-dates",
      width,
      theme,
      `/school/${school}/year`,
      "Start the new school year",
    );
    await viewScreen(
      page,
      engine,
      label,
      "year-classes",
      width,
      theme,
      `/school/${school}/year?step=classes`,
      "Start the new school year",
    );
    await viewScreen(
      page,
      engine,
      label,
      "year-grades",
      width,
      theme,
      `/school/${school}/year?step=grades`,
      "Start the new school year",
    );
    await viewScreen(
      page,
      engine,
      label,
      "year-review",
      width,
      theme,
      `/school/${school}/year?step=review`,
      "Start the new school year",
    );
    await page.getByText("Nothing has changed yet").waitFor();
    await page.getByRole("button", { name: /^Start / }).waitFor();
    await page.locator("dl dt").first().waitFor();
    await settled(page);
    await shoot(page, engine, "year-review", width, theme);
    await geometry(page, `${label} year review`);
    await resetRecord(page);
    await viewScreen(
      page,
      engine,
      label,
      "integrations",
      width,
      theme,
      `/school/${school}/integrations`,
      "Integrations",
    );
    // A failed toggle overlays a toast and moves nothing.
    const stable = "main h1, main h2, main h3, main button";
    const before = await boxes(page, stable);
    await page.route("**/integrations/sign-in", (route) => route.abort());
    await page.getByRole("radio", { name: "On" }).first().click();
    await page.getByRole("alert").first().waitFor();
    await settled(page);
    sameBoxes(`${label} failed toggle`, before, await boxes(page, stable));
    await page.unroute("**/integrations/sign-in");
    await viewScreen(
      page,
      engine,
      label,
      "privacy",
      width,
      theme,
      `/school/${school}/privacy`,
      "Privacy",
    );
    await viewScreen(
      page,
      engine,
      label,
      "privacy-district",
      width,
      theme,
      `/school/${district}/privacy`,
      "Privacy",
    );
    // A failed export says so in its reserved line.
    const privacyBefore = await boxes(page, "main h1, main h2, main button");
    await page.route("**/privacy/export.zip", (route) => route.abort());
    await page.getByRole("button", { name: "Export all student data" }).click();
    await page.getByText("The export didn’t download").waitFor();
    await settled(page);
    sameBoxes(
      `${label} failed export`,
      privacyBefore,
      await boxes(page, "main h1, main h2, main button"),
    );
    await page.unroute("**/privacy/export.zip");
    await viewScreen(
      page,
      engine,
      label,
      "activity",
      width,
      theme,
      `/school/${district}/activity`,
      "Activity",
    );
    await page.goto(`${origin}/school/${school}/classes`);
    await heading(page, "Classes").waitFor();
    await settled(page);
    await geometry(page, `${label} classes`);
    await shoot(page, engine, "classes", width, theme);
  } catch (error) {
    if (process.env.VERIFY_CONSOLE)
      console.log(
        await page.evaluate(() =>
          import("/src/web/features/school/org/index.ts" as string).then(
            () => "module ok",
            (failure: Error) => String(failure.stack ?? failure),
          ),
        ),
      );
    await page
      .screenshot({
        path: `${ARTIFACTS}/failure-${engine}-${width}-${theme}.png`,
      })
      .catch(() => undefined);
    throw error;
  } finally {
    await context.close();
  }
}

/** The whole story, in order, on a small district of its own. */
async function journey(browser: Browser, engine: string) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    colorScheme: "light",
    acceptDownloads: true,
  });
  await context.addInitScript(shiftRecorder);
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  page.on("pageerror", (error) =>
    console.log(`${engine} page error: ${error.message}`),
  );
  try {
    const district = await schools.createOrg(
      {
        kind: "district",
        name: `Harbor Schools ${engine}`,
        timezone: "America/New_York",
      },
      agreement("Dana Ruiz", "Superintendent"),
    );
    const person = await schools.addStaff({
      orgId: district.id,
      role: "admin",
      givenName: "Dana",
      familyName: "Ruiz",
      accountId: ACCOUNT,
    });
    await asTitled(person.personId, "Dr. Ruiz");
    await schools.issueLicense({
      orgId: district.id,
      seats: 20,
      endsAt: yearAhead,
    });
    const client = await db.connect();
    await seedCalendar(client, district.id).finally(() => client.release());
    const north = await schools.createOrg({
      kind: "school",
      name: "North Campus",
      parentId: district.id,
    });
    const south = await schools.createOrg({
      kind: "school",
      name: "South Campus",
      parentId: district.id,
    });
    const math = await schools.createClass(north.id, {
      name: "Grade 5 Math",
      gradingKind: "semester",
    });
    const reading = await schools.createClass(north.id, {
      name: "Math Support",
      gradingKind: "semester",
    });
    const add = (
      givenName: string,
      familyName: string,
      gradeLevel: number,
      email?: string,
    ) =>
      schools.provisionStudent(north.id, {
        givenName,
        familyName,
        gradeLevel,
        classId: math.id,
        ...(email ? { email } : {}),
      });
    const amara = await add(
      "Amara",
      "Osei",
      5,
      `amara.${engine}@north.example`,
    );
    const caleb = await add("Caleb", "Ortiz", 5);
    await add("Gia", "Lane", 8);
    const removable = await add("Nia", "Obi", 5);

    // The overview: a head's morning read, with one action on each item.
    await page.goto(`${origin}/school/${north.id}`);
    await heading(page, /^Good /).waitFor();
    await page.getByText(/students practiced this week/).waitFor();
    await page.getByRole("heading", { name: "Needs attention" }).waitFor();
    await page.getByRole("link", { name: "See who" }).click();
    await page.waitForURL(/status=never-signed-in/);
    await page.getByText("who haven’t signed in yet").waitFor();
    await page.goBack();
    await heading(page, /^Good /).waitFor();
    // The class row opens the class.
    await page.getByRole("link", { name: "Grade 5 Math" }).first().click();
    await page.waitForURL(`**/classes/${math.id}/today`);
    await page.goBack();
    await heading(page, /^Good /).waitFor();
    // A one-class solo school never sees any of it.
    const solo = await schools.createOrg(
      { kind: "school", name: "Just One Class", timezone: "UTC" },
      agreement("Pat Lee", "Teacher"),
    );
    await db.query("UPDATE amp_orgs SET solo=true WHERE id=$1", [solo.id]);
    await schools.addStaff({
      orgId: solo.id,
      role: "admin",
      givenName: "Pat",
      accountId: ACCOUNT,
    });
    await page.goto(`${origin}/school/${solo.id}`);
    await page.waitForURL(`**/school/${solo.id}/classes**`);
    await heading(page, "Classes").waitFor();
    await settled(page);
    check(
      `${engine} a lone teacher has no overview in the rail`,
      (await page.getByRole("link", { name: "Overview" }).count()) === 0,
    );

    // Campus transfer, from the Students screen at district scope.
    await page.goto(
      `${origin}/school/${district.id}/students?student=${amara.personId}`,
    );
    await page.getByRole("button", { name: "Move to another school" }).click();
    await page.getByRole("button", { name: /^Move Amara/ }).waitFor();
    await page.getByText(/seat stays/).waitFor();
    await page.getByRole("button", { name: /^Move Amara/ }).click();
    await page
      .getByRole("button", { name: /^Move Amara/ })
      .waitFor({ state: "detached" });
    const moved = await db.query(
      `SELECT o.name FROM amp_org_roles r JOIN amp_orgs o ON o.id=r.org_id
       WHERE r.person_id=$1 AND r.role='student' AND r.end_on IS NULL`,
      [amara.personId],
    );
    check(
      `${engine} moved to South`,
      moved.rows[0]?.name === "South Campus",
      moved.rows,
    );
    // The same move is offered on the student's own record.
    await page.goto(
      `${origin}/school/${district.id}/students/${caleb.personId}`,
    );
    await page
      .getByRole("button", { name: "Move to another school" })
      .waitFor();
    // Back to North for the rest of the story, through the API the sheet uses.
    await fetch(
      `http://127.0.0.1:${apiPort}/api/v1/school/students/${amara.personId}/transfer`,
      {
        method: "POST",
        headers: {
          authorization: "Bearer amp-local-development",
          "content-type": "application/json",
        },
        body: JSON.stringify({ to: north.id, classId: math.id }),
      },
    );

    // Year rollover: every step has a URL, and the dry run changes nothing.
    await page.goto(`${origin}/school/${north.id}/calendar`);
    await page.getByRole("link", { name: "Start next year" }).click();
    await page.waitForURL(`**/school/${north.id}/year`);
    await heading(page, "Start the new school year").waitFor();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL(/step=classes/);
    await page.getByLabel(/Math Support/).uncheck();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL(/step=grades/);
    await page.reload();
    await heading(page, "Start the new school year").waitFor();
    check(
      `${engine} draft survives a reload`,
      page.url().includes("step=grades"),
    );
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL(/step=review/);
    await page.getByText("Nothing has changed yet").waitFor();
    await page.locator("dl dt", { hasText: "carry over" }).waitFor();
    const untouched = await db.query(
      "SELECT grade_level FROM amp_people WHERE id=$1",
      [caleb.personId],
    );
    check(
      `${engine} dry run changes nothing`,
      untouched.rows[0].grade_level === 5,
    );
    await page.getByRole("button", { name: /^Start / }).click();
    await heading(page, /is ready$/).waitFor();
    const advanced = await db.query(
      "SELECT grade_level FROM amp_people WHERE id=$1",
      [caleb.personId],
    );
    check(`${engine} grades moved up`, advanced.rows[0].grade_level === 6);
    const copy = await db.query(
      "SELECT join_code FROM amp_classes WHERE rolled_from=$1",
      [math.id],
    );
    check(
      `${engine} class copied`,
      copy.rowCount === 1 && copy.rows[0].join_code !== math.joinCode,
    );
    const skipped = await db.query(
      "SELECT 1 FROM amp_classes WHERE rolled_from=$1",
      [reading.id],
    );
    check(`${engine} a skipped class stays behind`, skipped.rowCount === 0);
    // The year switcher reaches the new year, and last year's gradebook opens.
    await page
      .getByRole("link", { name: /classes$/ })
      .first()
      .click();
    await heading(page, "Classes").waitFor();
    await page.goto(`${origin}/school/${north.id}/classes`);
    await heading(page, "Classes").waitFor();
    await page.getByRole("radiogroup", { name: "School year" }).waitFor();

    // Integrations: a real request, and a real sign-in.
    await page.goto(`${origin}/school/${north.id}/integrations`);
    await heading(page, "Integrations").waitFor();
    await page.getByRole("button", { name: "Set up Clever with us" }).click();
    await page
      .getByText(/^Requested /)
      .first()
      .waitFor();
    check(
      `${engine} the mailbox heard`,
      mail.some((entry) => /Clever for North Campus/.test(entry.subject)),
      mail,
    );
    await page
      .getByRole("radiogroup", { name: "Google sign-in" })
      .getByRole("radio", { name: "On" })
      .click();
    await page.getByText("Google sign-in is on").waitFor();
    const student = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await student.addInitScript(shiftRecorder);
    try {
      const phone = await student.newPage();
      phone.setDefaultTimeout(30_000);
      nextEmail = `amara.${engine}@north.example`;
      nextVerified = true;
      await phone.goto(`${origin}/join/${math.joinCode}`);
      await phone.getByRole("link", { name: "Sign in with Google" }).click();
      await phone.waitForURL("**/practice");
      await phone
        .locator(".problem-stage .question")
        .waitFor({ timeout: 45_000 });
      check(
        `${engine} the session is a student's, stored for the device`,
        await phone.evaluate(
          () =>
            !!(
              sessionStorage.getItem("amp.student") ??
              localStorage.getItem("amp.student")
            ),
        ),
      );
      check(
        `${engine} the grant left the address bar`,
        !phone.url().includes("#"),
        phone.url(),
      );
      await student.clearCookies();
      await phone.evaluate(() => {
        sessionStorage.clear();
        localStorage.clear();
      });
      // No match: a clear message, and the code and card right there.
      nextEmail = "nobody@north.example";
      await phone.goto(`${origin}/join/${math.joinCode}`);
      await phone.getByRole("link", { name: "Sign in with Google" }).click();
      await phone.waitForURL(/sso=not_on_roster/);
      await phone.getByRole("alert").waitFor();
      await phone.getByRole("link", { name: "scan your card" }).waitFor();
      await phone.getByRole("heading", { name: "Tap your name" }).waitFor();
      await settled(phone);
      await shoot(phone, engine, "join-sso-problem", 390, "light");
      const stable = await probe(phone);
      check(
        `${engine} sso problem overflow`,
        stable.overflow === 0,
        stable.overflow,
      );
      // The address isn't vouched for.
      nextEmail = `amara.${engine}@north.example`;
      nextVerified = false;
      await phone.goto(`${origin}/join/${math.joinCode}`);
      await phone.getByRole("link", { name: "Sign in with Google" }).click();
      await phone.waitForURL(/sso=email_unverified/);
      nextVerified = true;
      await settled(phone);
      await shoot(phone, engine, "join-sso-button", 390, "light");
    } finally {
      await student.close();
    }

    // Privacy: export the school, and the file parses.
    await page.goto(`${origin}/school/${north.id}/privacy`);
    await heading(page, "Privacy").waitFor();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export all student data" }).click();
    const file = await download;
    check(
      `${engine} export name`,
      /north-campus-student-data\.zip$/.test(file.suggestedFilename()),
      file.suggestedFilename(),
    );
    const saved = `${ARTIFACTS}/export-${engine}.zip`;
    await file.saveAs(saved);
    const entries = unzipSync(new Uint8Array(await readFile(saved)));
    const roster = strFromU8(entries["roster.csv"]!);
    check(
      `${engine} export lists students`,
      /Amara,Osei/.test(roster) && /Caleb,Ortiz/.test(roster),
      roster.slice(0, 200),
    );
    for (const name of [
      "enrollments.csv",
      "grades.csv",
      "skill_days.csv",
      "level_days.csv",
      "active_days.csv",
    ])
      check(`${engine} export has ${name}`, !!entries[name]);
    await page.getByText(/^Downloaded /).waitFor();

    // Delete one student, through the path removal already takes.
    await page.getByLabel("Find a student to delete").fill("Nia");
    await page.getByLabel(/Nia Obi/).check();
    await page.getByRole("button", { name: "Delete 1 student" }).click();
    await page.getByRole("button", { name: "Delete for good" }).click();
    await page.getByText("Deleted 1 student").waitFor();
    const gone = await db.query(
      "SELECT given_name,deleted_at FROM amp_people WHERE id=$1",
      [removable.personId],
    );
    check(
      `${engine} deleted`,
      gone.rows[0].given_name === "Removed" && !!gone.rows[0].deleted_at,
      gone.rows,
    );

    // All of it, in the log, as sentences.
    await page.goto(`${origin}/school/${district.id}/activity`);
    await heading(page, "Activity").waitFor();
    for (const sentence of [
      /Dr\. Ruiz moved Amara Osei from South Campus to North Campus/,
      /Dr\. Ruiz started /,
      /Dr\. Ruiz turned on Google sign-in/,
      /Dr\. Ruiz asked to set up Clever/,
      /Dr\. Ruiz exported all student data for North Campus/,
      /Dr\. Ruiz removed a student and deleted their learning data/,
    ])
      await page.getByText(sentence).first().waitFor();
    // Filters live in the URL, and survive a reload.
    await page.goto(
      `${origin}/school/${district.id}/activity?kind=privacy&person=not-a-uuid&from=nonsense`,
    );
    await heading(page, "Activity").waitFor();
    await page
      .getByText(/exported all student data/)
      .first()
      .waitFor();
    check(
      `${engine} a filter narrows`,
      (await page.getByText(/moved Amara Osei/).count()) === 0,
    );
    await page.reload();
    await page
      .getByText(/exported all student data/)
      .first()
      .waitFor();
    const { cls } = await shellRecord(page);
    check(`${engine} journey CLS`, cls <= 0.01, cls);
  } catch (error) {
    await page
      .screenshot({ path: `${ARTIFACTS}/journey-${engine}.png` })
      .catch(() => undefined);
    throw error;
  } finally {
    await context.close();
  }
}

let exit = 0;
try {
  const district = await buildDistrict();
  if (!process.argv.includes("--small")) {
    const p95 = await measure(
      district.id,
      "District (10,000 students, 12 schools)",
    );
    check("the district overview's p95 is under 300 ms", p95 < 300, p95);
    await measure(district.school, "One school in it");
  }
  if (!process.argv.includes("--measure-only")) {
    const school = await buildSchool();
    const student = (
      await db.query(
        "SELECT id FROM amp_people WHERE tenant_id=$1 AND learner_id IS NOT NULL LIMIT 1",
        [school],
      )
    ).rows[0].id as string;
    for (const engine of engines) {
      const browser = await (
        engine === "webkit" ? webkit : secureChromium(rawChromium)
      ).launch();
      try {
        if (!process.argv.includes("--skip-journey"))
          await journey(browser, engine);
        if (!process.argv.includes("--skip-sweep"))
          for (const width of widths)
            for (const theme of themes)
              await sweep(browser, engine, width, theme, {
                school,
                district: district.id,
                districtSchool: district.school,
                studentPerson: student,
              });
      } finally {
        await browser.close();
      }
    }
  }
  if (failures.length) {
    console.error(`${failures.length} failed:\n${failures.join("\n")}`);
    exit = 1;
  } else console.log("School and district layer verified");
} catch (error) {
  console.error(error);
  if (failures.length) console.error(failures.join("\n"));
  exit = 1;
} finally {
  await vite.close();
  await api.close();
  await new Promise((done) => providerServer.close(done));
  await learning.pool.end();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
process.exit(exit);
