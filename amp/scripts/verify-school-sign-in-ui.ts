/**
 * Student sign-in and the teacher's board in real browsers, against the real API
 * and a real database: code and pictures as a first-timer and returning, a card
 * link, wrong pictures to lockout, a teacher's reset, a name lighting up on the
 * board, then a real problem on /practice. Geometry at 320, 390, 768 and 1280,
 * light and dark. Screenshots land in docs/reviews/school-sign-in/ for a person
 * to look at.
 *
 *     AMP_TEST_DATABASE_URL=... npx tsx scripts/verify-school-sign-in-ui.ts \
 *       [--engine chromium|webkit] [--widths 390,1280] [--skip-sweep] [--skip-journeys]
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { Pool } from "pg";
import QRCode from "qrcode";
import {
  chromium as rawChromium,
  webkit,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";
import { createServer } from "vite";
import { secureChromium } from "../browser-security.mjs";
import { registerAnalyticsRoutes } from "../src/analytics/routes";
import { registerUnavailableBilling } from "../src/billing/stripe/routes";
import { registerFamilyRoutes } from "../src/family/routes";
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
const themes = ["light", "dark"] as const;
const REVIEW = "docs/reviews/school-sign-in";
const ARTIFACTS = "artifacts/school-sign-in";
const webPort = 4396,
  apiPort = 4397,
  origin = `http://127.0.0.1:${webPort}`;
const TEACHER = "development-household";
const MINE = ["Fox", "Boat", "Kite"];
const WRONG = ["Owl", "Frog", "Sun"];
const NAMES = [
  ["Amara", "Osei"],
  ["Caleb", "Ortiz"],
  ["Diego", "Salas"],
  ["Elias", "Frost"],
  ["Eli", "Novak"],
  ["Felix", "Grant"],
  ["Hana", "Sato"],
  ["Imani", "Clarke"],
  ["Isaac", "Moreno"],
  ["Jonah", "Reyes"],
  ["Kai", "Nakamura"],
  ["Lena", "Fischer"],
  ["Marcus", "Bell"],
  ["Mei", "Tran"],
  ["Nadia", "Petrov"],
  ["Noor", "Haddad"],
  ["Owen", "Hartley"],
  ["Priya", "Raman"],
  ["Ruth", "Adeyemi"],
  ["Sam", "Whitlock"],
  ["Sofia", "Marin"],
  ["Theo", "Lindqvist"],
  ["Tomas", "Vega"],
  ["Zara", "Mensah"],
] as const;

const failures: string[] = [];
function check(label: string, ok: boolean, detail: unknown = "") {
  if (!ok) failures.push(`${label}: ${JSON.stringify(detail)}`);
}

const schema = `amp_sign_in_ui_${randomUUID().replaceAll("-", "")}`;
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
await registerFamilyRoutes(api, { pool: db, authenticate });
await registerSchoolRoutes(api, { pool: db, authenticate });
await registerUnavailableBilling(api, authenticate);
await registerAnalyticsRoutes(api, { pool: db, authenticate });
api.get("/api/v1/auth-config", async () => ({ mode: "development" }));
await api.listen({ host: "127.0.0.1", port: apiPort });
const vite = await createServer({
  cacheDir: "node_modules/.vite-school-sign-in",
  server: {
    host: "127.0.0.1",
    port: webPort,
    strictPort: true,
    proxy: { "/api": `http://127.0.0.1:${apiPort}` },
  },
});
await vite.listen();

const org = await schools.createOrg(
  { kind: "school", name: "Alder Street School", timezone: "America/New_York" },
  {
    version: "fixture-1",
    signerName: "Fixture Signer",
    signerTitle: "Head of School",
  },
);
await schools.issueLicense({
  orgId: org.id,
  seats: 5000,
  endsAt: new Date(Date.now() + 365 * 86_400_000).toISOString(),
});
await schools.addStaff({
  orgId: org.id,
  role: "admin",
  givenName: "Grace",
  familyName: "Okafor",
  accountId: TEACHER,
});
async function makeClass(name: string) {
  return schools.createClass(org.id, { name, courseBands: [] });
}
const addStudent = (classId: string, givenName: string, familyName?: string) =>
  schools.provisionStudent(org.id, {
    givenName,
    ...(familyName ? { familyName } : {}),
    gradeLevel: 5,
    classId,
  });
const staff = async (method: "GET" | "POST", path: string, body?: object) => {
  const response = await fetch(
    `http://127.0.0.1:${apiPort}/api/v1/school/${path}`,
    {
      method,
      headers: {
        authorization: "Bearer amp-local-development",
        ...(method === "POST" ? { "content-type": "application/json" } : {}),
      },
      ...(method === "POST" ? { body: JSON.stringify(body ?? {}) } : {}),
    },
  );
  assert.equal(response.ok, true, `${path} ${response.status}`);
  return response.json();
};
const classUrl = (id: string, leaf: string) =>
  `/school/${org.id}/classes/${id}/${leaf}`;
const join = async (path: string, body: object) =>
  fetch(`http://127.0.0.1:${apiPort}/api/v1/school/join/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());

const big = await makeClass("Grade 5 Math");
const bigStudents: Awaited<ReturnType<typeof addStudent>>[] = [];
for (const [given, family] of NAMES)
  bigStudents.push(await addStudent(big.id, given, family));
// A class partly here, for the board and the roster.
for (const student of bigStudents.filter((_, index) => index % 3 === 0))
  await schools.issueStudentSession({
    personId: student.personId,
    mode: "shared",
  });
for (const student of bigStudents.slice(2, 12).filter((_, i) => i % 2 === 0))
  await join("picture", {
    code: big.joinCode,
    personId: student.personId,
    pictures: ["fox", "boat", "kite"],
    set: true,
  });
await staff("POST", `classes/${big.id}/cards`, {
  personIds: bigStudents.slice(0, 7).map((s) => s.personId),
});

/** Presence starts over at the school's midnight, and a run can cross it. */
const stillHere = () =>
  db.query(
    "UPDATE amp_student_sessions SET last_seen_at=now() WHERE person_id=ANY($1::uuid[]) AND revoked_at IS NULL",
    [bigStudents.map((student) => student.personId)],
  );

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
    elements.map((element) => {
      const { left, top, width, height } = element.getBoundingClientRect();
      // Against the page, so a scroll to reach a control isn't a move.
      return { left, top: top + scrollY, width, height };
    }),
  );
function sameBoxes(label: string, before: Box[], after: Box[]) {
  check(
    `${label} moved something`,
    JSON.stringify(before) === JSON.stringify(after),
    { before: before.slice(0, 3), after: after.slice(0, 3) },
  );
}
const tap = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true }).click();
async function pick(page: Page, pictures: readonly string[]) {
  for (const picture of pictures) await tap(page, picture);
}
const pictureButtons = "button[aria-pressed]";
const heading = (page: Page, name: string | RegExp) =>
  page.getByRole("heading", { name, level: 1 });
const firstProblem = (page: Page) =>
  page.locator(".problem-stage .question").waitFor({ timeout: 30_000 });
const settled = async (page: Page) => {
  // Off any control, so a hover's scale isn't measured as a move.
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.fonts.ready);
  await settle(page, 550);
};

/** Every screen at one width and theme, looked at and measured. */
async function sweep(
  browser: Browser,
  engine: string,
  width: number,
  theme: (typeof themes)[number],
) {
  const label = `${engine} ${width} ${theme}`;
  const context = await browser.newContext({
    viewport: { width, height: width < 720 ? 844 : 900 },
    colorScheme: theme,
  });
  await context.addInitScript(shiftRecorder);
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  page.on("response", (response) => {
    if (response.status() >= 400 && response.url().includes("/api/"))
      console.log(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  try {
    const small = await makeClass("Math Club");
    const priya = await addStudent(small.id, "Priya", "Raman");
    const returning = await addStudent(small.id, "Sam", "Whitlock");
    await join("picture", {
      code: small.joinCode,
      personId: returning.personId,
      pictures: ["fox", "boat", "kite"],
      set: true,
    });

    // /join: a wrong code moves nothing.
    await page.goto(`${origin}/join`);
    await heading(page, "Type your class code").waitFor();
    await settled(page);
    await geometry(page, `${label} join`);
    await shoot(page, engine, "join", width, theme);
    const input = page.getByLabel("Class code");
    const layout = "h1, label, button";
    const before = await boxes(page, layout);
    await input.fill("zzz-zzz");
    await page.getByText("That code didn’t work").waitFor();
    await settled(page);
    sameBoxes(`${label} wrong code`, before, await boxes(page, layout));
    await geometry(page, `${label} join error`);
    await shoot(page, engine, "join-error", width, theme);
    // Any case, with a hyphen, straight to the names.
    await input.fill("");
    const shown = `${big.joinCode.slice(0, 3).toLowerCase()}-${big.joinCode.slice(3)}`;
    await input.fill(shown);
    await page.waitForURL(`**/join/${big.joinCode}`);
    await heading(page, "Tap your name").waitFor();
    await settled(page);
    await geometry(page, `${label} names`);
    await shoot(page, engine, "names", width, theme);
    await page.goBack();
    await heading(page, "Type your class code").waitFor();
    await page.goForward();
    await heading(page, "Tap your name").waitFor();
    await page.reload();
    await heading(page, "Tap your name").waitFor();

    // First time: choose, confirm.
    await page.goto(`${origin}/join/${small.joinCode}`);
    await page.getByRole("link", { name: /Priya R\./ }).click();
    await heading(page, /Pick 3 pictures/).waitFor();
    await settled(page);
    await geometry(page, `${label} pictures`);
    await shoot(page, engine, "pictures-first", width, theme);
    const size = (await boxes(page, pictureButtons)).map((b) => b.width);
    check(
      `${label} picture size`,
      size.length === 16 && Math.min(...size) >= 60,
      size,
    );
    await pick(page, MINE);
    await heading(page, "Remember these 3").waitFor();
    await settled(page);
    await geometry(page, `${label} confirm`);
    await shoot(page, engine, "pictures-confirm", width, theme);
    await tap(page, "Pick again");
    await heading(page, /Pick 3 pictures/).waitFor();
    await pick(page, MINE);
    await tap(page, "These are mine");
    await page.waitForURL("**/practice");
    await firstProblem(page);
    await settled(page);
    await shoot(page, engine, "practice", width, theme);
    const practice = await probe(page);
    check(
      `${label} practice overflow`,
      practice.overflow === 0,
      practice.overflow,
    );
    check(
      `${label} practice overlaps`,
      practice.overlaps.length === 0,
      practice.overlaps,
    );
    check(
      `${label} practice targets`,
      practice.smallTargets.length === 0,
      practice.smallTargets,
    );
    await page.getByRole("button", { name: "Sign out" }).waitFor();

    // Back from practice goes to the class, whichever way it came.
    await page.goBack();
    await heading(page, "Tap your name").waitFor();

    // Returning: wrong pictures shake and clear. Nothing moves, and no count.
    await page.evaluate(() => sessionStorage.clear());
    await page.goto(`${origin}/join/${small.joinCode}/${returning.personId}`);
    await heading(page, "Pick your 3 pictures").waitFor();
    await settled(page);
    await resetRecord(page);
    const stable = "ol, button[aria-pressed]";
    const start = await boxes(page, stable);
    const headingTop = async () => {
      const [box] = await boxes(page, "h1");
      return [box!.top, box!.height];
    };
    const titleAt = await headingTop();
    for (let wrong = 1; wrong < 5; wrong++) {
      await pick(page, WRONG);
      await page.getByText("Try again").waitFor();
      if (wrong === 1) {
        await shoot(page, engine, "pictures-wrong", width, theme);
        await settled(page);
        sameBoxes(`${label} wrong pictures`, start, await boxes(page, stable));
      }
      await page.waitForFunction(() => !document.querySelector("ol svg"));
      await page.waitForFunction(
        () => !document.querySelector('[aria-busy="true"]'),
      );
    }
    const body = await page.locator("main").innerText();
    check(`${label} no tries left`, !/\d+ (tries|more|left)/i.test(body), body);
    await pick(page, WRONG);
    await heading(page, "Ask your teacher").waitFor();
    await settled(page);
    sameBoxes(`${label} locked`, start, await boxes(page, stable));
    check(
      `${label} locked title`,
      JSON.stringify(titleAt) === JSON.stringify(await headingTop()),
    );
    await geometry(page, `${label} locked`);
    await shoot(page, engine, "pictures-locked", width, theme);

    // A failed request keeps the pictures, explains itself, moves nothing.
    await db.query(
      "UPDATE amp_person_credentials SET locked_until=NULL,failed_count=0 WHERE person_id=$1",
      [returning.personId],
    );
    await page.goto(`${origin}/join/${small.joinCode}/${returning.personId}`);
    await heading(page, "Pick your 3 pictures").waitFor();
    await settled(page);
    await resetRecord(page);
    const open = await boxes(page, `h1, ${stable}`);
    await page.route("**/api/v1/school/join/picture", (route) => route.abort());
    await pick(page, MINE);
    await page.getByText("AMP can’t connect").waitFor();
    await settled(page);
    sameBoxes(
      `${label} failed request`,
      open,
      await boxes(page, `h1, ${stable}`),
    );
    await geometry(page, `${label} failed request`);
    await shoot(page, engine, "pictures-offline", width, theme);
    await page.unroute("**/api/v1/school/join/picture");
    await tap(page, "Try again");
    await page.waitForURL("**/practice");
    await page.evaluate(() => sessionStorage.clear());

    // An expired card says what to do.
    await page.goto(`${origin}/c#${"x".repeat(43)}`);
    await heading(page, /This card doesn’t work anymore/).waitFor();
    check(`${label} card url`, page.url() === `${origin}/c`, page.url());
    await settled(page);
    await geometry(page, `${label} expired card`);
    await shoot(page, engine, "card-expired", width, theme);

    // A paused class says what to do.
    const paused = await makeClass("Paused Class");
    await db.query(
      "UPDATE amp_classes SET join_locked_until=now()+interval '5 minutes' WHERE id=$1",
      [paused.id],
    );
    await page.goto(`${origin}/join/${paused.joinCode}`);
    await heading(page, /This class is paused/).waitFor();
    await settled(page);
    await geometry(page, `${label} paused class`);
    await shoot(page, engine, "class-paused", width, theme);

    // The board.
    await stillHere();
    await page.goto(origin + classUrl(big.id, "start"));
    await page.locator("li[data-here]").first().waitFor();
    await settled(page);
    await resetRecord(page);
    await geometry(page, `${label} board`);
    await shoot(page, engine, "board", width, theme);
    const names = "li, h1, [aria-live]";
    const board = await boxes(page, names);
    await page.route("**/presence", (route) => route.abort());
    await page.getByText("Reconnecting to AMP").waitFor({ timeout: 12_000 });
    await shoot(page, engine, "board-reconnecting", width, theme);
    sameBoxes(`${label} board offline`, board, await boxes(page, names));
    await page.unroute("**/presence");
    await page.waitForFunction(
      () => !document.querySelector('[role="status"][data-on]'),
      undefined,
      { timeout: 12_000 },
    );
    await geometry(page, `${label} board after`);

    // The roster.
    await page.goto(origin + classUrl(big.id, "roster"));
    await heading(page, "Roster").waitFor();
    await page.getByRole("link", { name: "Start class" }).waitFor();
    await settled(page);
    await geometry(page, `${label} roster`);
    await shoot(page, engine, "roster", width, theme);

    // Printable cards: nothing happens on open; making them shows the page.
    const cardClass = await makeClass("Math Club");
    for (const [given, family] of NAMES.slice(0, 11))
      await addStudent(cardClass.id, given, family);
    await page.goto(origin + classUrl(cardClass.id, "cards"));
    await heading(page, /Print cards/).waitFor();
    await settled(page);
    await geometry(page, `${label} cards prepare`);
    await shoot(page, engine, "cards-prepare", width, theme);
    const none = await db.query(
      `SELECT 1 FROM amp_person_credentials k JOIN amp_enrollments e ON e.person_id=k.person_id
       WHERE e.class_id=$1 AND k.kind='card'`,
      [cardClass.id],
    );
    check(`${label} opening makes no cards`, none.rowCount === 0);
    await tap(page, "Make 11 cards");
    await heading(page, "11 cards ready").waitFor();
    await settled(page);
    await resetRecord(page);
    await geometry(page, `${label} cards`);
    await shoot(page, engine, "cards", width, theme);
  } catch (error) {
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

/** One context: its own device, fresh storage. */
async function device(
  browser: Browser,
  options: {
    width?: number;
    theme?: "light" | "dark";
    reducedMotion?: "reduce";
  } = {},
) {
  const context = await browser.newContext({
    viewport: { width: options.width ?? 390, height: 844 },
    colorScheme: options.theme ?? "light",
    ...(options.reducedMotion ? { reducedMotion: options.reducedMotion } : {}),
  });
  await context.addInitScript(shiftRecorder);
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  return { context, page, requests };
}
function noCollection(label: string, requests: string[]) {
  const collected = requests.filter((request) =>
    /\/api\/v1\/(events|engagement)|googletagmanager\.com|google-analytics\.com|\/api\/auth\//.test(
      request,
    ),
  );
  check(`${label} no collection`, collected.length === 0, collected);
}

/** The whole story, in order. */
async function journeys(browser: Browser, engine: string) {
  const cohort = await makeClass("Grade 2");
  const mina = await addStudent(cohort.id, "Mina", "Park");
  const jo = await addStudent(cohort.id, "Jo");
  const teacherBoard = await device(browser, { width: 1280 });
  const contexts: BrowserContext[] = [teacherBoard.context];
  const open = async (options?: Parameters<typeof device>[1]) => {
    const made = await device(browser, options);
    contexts.push(made.context);
    return made;
  };
  try {
    await teacherBoard.page.goto(origin + classUrl(cohort.id, "start"));
    await teacherBoard.page.getByText("0 of 2 here").waitFor();
    await teacherBoard.page.getByRole("img", { name: /QR code/ }).waitFor();
    await settled(teacherBoard.page);
    await resetRecord(teacherBoard.page);
    const names = "li, h1, [aria-live]";
    const boardBefore = await boxes(teacherBoard.page, names);

    // A first-timer, by code and pictures.
    const first = await open();
    await first.page.goto(`${origin}/join`);
    await first.page
      .getByLabel("Class code")
      .fill(cohort.joinCode.toLowerCase());
    await first.page.waitForURL(`**/join/${cohort.joinCode}`);
    await first.page.getByRole("link", { name: /Mina P\./ }).click();
    await heading(first.page, /Pick 3 pictures/).waitFor();
    await pick(first.page, MINE);
    await tap(first.page, "These are mine");
    await first.page.waitForURL("**/practice");
    await firstProblem(first.page);
    check(
      `${engine} shared uses session storage`,
      await first.page.evaluate(
        () =>
          !!sessionStorage.getItem("amp.student") &&
          !localStorage.getItem("amp.student"),
      ),
    );
    noCollection(`${engine} first-timer`, first.requests);

    // The name lights up on the board, within a poll, moving nothing.
    await teacherBoard.page.getByText("1 of 2 here").waitFor({ timeout: 8000 });
    await teacherBoard.page
      .locator("li[data-here]", { hasText: "Mina P." })
      .waitFor();
    await settled(teacherBoard.page);
    sameBoxes(
      `${engine} lighting up`,
      boardBefore,
      await boxes(teacherBoard.page, names),
    );
    const { cls } = await shellRecord(teacherBoard.page);
    check(`${engine} board CLS`, cls <= 0.01, cls);

    // One tap signs out, back to /join, leaving nothing behind.
    await first.page.getByRole("button", { name: "Sign out" }).click();
    await first.page.waitForURL("**/join");
    check(
      `${engine} signed out`,
      await first.page.evaluate(() => !sessionStorage.getItem("amp.student")),
    );

    // Returning: the third tap signs in.
    const back = await open({ width: 1280 });
    await back.page.goto(`${origin}/join/${cohort.joinCode}`);
    await back.page.getByRole("link", { name: /Mina P\./ }).click();
    await heading(back.page, "Pick your 3 pictures").waitFor();
    const at = Date.now();
    await pick(back.page, MINE);
    await back.page.waitForURL("**/practice");
    await firstProblem(back.page);
    if (engine === "chromium")
      console.log(`Returning student to a problem: ${Date.now() - at} ms`);
    await back.context.close();

    // A card link: instant, and the secret goes nowhere.
    const issued = await staff("POST", `classes/${cohort.id}/cards`, {
      personIds: [jo.personId],
    });
    const token: string = issued.cards[0].token;
    const card = await open();
    await card.page.goto(`${origin}/c#${token}`);
    await card.page.waitForURL("**/practice");
    await firstProblem(card.page);
    check(
      `${engine} card leaves no trace in the address`,
      !card.requests.some((request) => request.includes(token)),
    );
    check(
      `${engine} card url`,
      !card.page.url().includes(token),
      card.page.url(),
    );
    check(
      `${engine} card leaves no trace in history`,
      await card.page.evaluate((secret) => {
        const seen = JSON.stringify(history.state) + location.href;
        return !seen.includes(secret);
      }, token),
    );
    noCollection(`${engine} card`, card.requests);
    await card.page.goBack().catch(() => undefined);
    await card.page.waitForTimeout(400);
    check(
      `${engine} Back from a card`,
      !card.page.url().includes(token),
      card.page.url(),
    );
    // Reloading /c with no token goes to /join.
    const reloaded = await open();
    await reloaded.page.goto(`${origin}/c`);
    await reloaded.page.waitForURL("**/join");
    await reloaded.context.close();
    // Printing again makes the old card stop working.
    await staff("POST", `classes/${cohort.id}/cards`, {
      personIds: [jo.personId],
    });
    const revoked = await open();
    await revoked.page.goto(`${origin}/c#${token}`);
    await heading(revoked.page, /This card doesn’t work anymore/).waitFor();
    await revoked.page.getByRole("link", { name: "Type a class code" }).click();
    await revoked.page.waitForURL("**/join");
    await revoked.context.close();

    // Wrong pictures to lockout, a teacher's reset, a new choice.
    const locked = await open();
    await locked.page.goto(
      `${origin}/join/${cohort.joinCode}/${mina.personId}`,
    );
    await heading(locked.page, "Pick your 3 pictures").waitFor();
    for (let wrong = 1; wrong < 5; wrong++) {
      await pick(locked.page, WRONG);
      await locked.page.getByText("Try again").waitFor();
      await locked.page.waitForFunction(
        () => !document.querySelector("ol svg"),
      );
    }
    await pick(locked.page, WRONG);
    await heading(locked.page, "Ask your teacher").waitFor();
    const teacher = await open({ width: 1280 });
    await teacher.page.goto(origin + classUrl(cohort.id, "roster"));
    await teacher.page.getByText("Locked for now").waitFor();
    await teacher.page.getByRole("button", { name: "Manage Mina P." }).click();
    await teacher.page
      .getByRole("menuitem", { name: "Reset pictures" })
      .click();
    await teacher.page.getByRole("button", { name: "Reset pictures" }).click();
    await teacher.page
      .getByText(/picks new pictures/)
      .first()
      .waitFor();
    await heading(locked.page, /Pick 3 pictures/).waitFor({ timeout: 12_000 });
    await pick(locked.page, ["Moon", "Tree", "Fish"]);
    await tap(locked.page, "These are mine");
    await locked.page.waitForURL("**/practice");
    await firstProblem(locked.page);

    // Sign out everywhere ends that device on its next step.
    await teacher.page.getByRole("button", { name: "Manage Mina P." }).click();
    await teacher.page
      .getByRole("menuitem", { name: "Sign out everywhere" })
      .click();
    await teacher.page
      .getByRole("button", { name: "Sign out everywhere" })
      .click();
    await teacher.page
      .getByText(/signed out on every device/)
      .first()
      .waitFor();
    await locked.page.reload();
    await locked.page.waitForURL("**/join");

    // A new code: the old one fails, the board shows the new one.
    // New code lives in More, unless sign-in is paused, when it shows itself.
    const paused = teacher.page.getByRole("button", {
      name: "New code",
      exact: true,
    });
    if (await paused.count()) await paused.click();
    else {
      await teacher.page
        .getByRole("button", { name: "More for the class code" })
        .click();
      await teacher.page
        .getByRole("menuitem", { name: "New class code" })
        .click();
    }
    await teacher.page.getByRole("button", { name: "Make a new code" }).click();
    await teacher.page
      .getByText(/The new class code is/)
      .first()
      .waitFor();
    const { class: rotated } = await staff(
      "GET",
      `classes/${cohort.id}/presence`,
    );
    check(`${engine} rotated`, rotated.joinCode !== cohort.joinCode);
    await teacherBoard.page
      .getByRole("img", {
        name: `Class code ${[...rotated.joinCode].join(" ")}`,
      })
      .waitFor({ timeout: 8000 });
    // Exit returns to the class.
    await teacherBoard.page.getByRole("link", { name: "Exit" }).click();
    await teacherBoard.page.waitForURL("**/today");
    await teacherBoard.page.goBack();
    await teacherBoard.page.waitForURL("**/start");

    // Personal devices stay signed in across tabs.
    const own = await makeClass("Own Devices");
    await db.query(
      `INSERT INTO amp_scope_settings(scope_kind,scope_id,"values") VALUES('class',$1,$2)`,
      [own.id, JSON.stringify({ deviceMode: "personal" })],
    );
    const kit = await addStudent(own.id, "Kit", "Lane");
    const personal = await open();
    await personal.page.goto(`${origin}/join/${own.joinCode}/${kit.personId}`);
    await pick(personal.page, MINE);
    await tap(personal.page, "These are mine");
    await personal.page.waitForURL("**/practice");
    check(
      `${engine} personal uses local storage`,
      await personal.page.evaluate(
        () =>
          !!localStorage.getItem("amp.student") &&
          !sessionStorage.getItem("amp.student"),
      ),
    );
    const tab = await personal.context.newPage();
    await tab.goto(`${origin}/practice`);
    await firstProblem(tab);
    await personal.context.close();

    // Reduced motion: the board changes at once.
    const quiet = await open({ width: 1280, reducedMotion: "reduce" });
    await stillHere();
    await quiet.page.goto(origin + classUrl(big.id, "start"));
    await quiet.page.locator("li[data-here]").first().waitFor();
    const transition = await quiet.page
      .locator("li")
      .first()
      .evaluate(
        (node) => getComputedStyle(node, "::before").transitionDuration,
      );
    check(`${engine} reduced motion`, transition === "0s", transition);

    // A shared device signs out after 30 idle minutes.
    const idle = await open();
    await idle.page.goto(
      `${origin}/c#${(await staff("POST", `classes/${cohort.id}/cards`, { personIds: [jo.personId] })).cards[0].token}`,
    );
    await idle.page.waitForURL("**/practice");
    // Left alone 31 minutes ago. The tab's own timer notices, on real time.
    await idle.page.evaluate(() =>
      sessionStorage.setItem(
        "amp.student.active",
        String(Date.now() - 31 * 60_000),
      ),
    );
    await idle.page.waitForURL("**/join", { timeout: 20_000 });
    await heading(idle.page, "Type your class code").waitFor();
    check(
      `${engine} idle sign-out`,
      await idle.page.evaluate(() => !sessionStorage.getItem("amp.student")),
    );

    if (engine === "chromium") {
      // "Scan my card", in place: a real QR on a camera, read by jsQR here.
      const scan = await open();
      const { cards } = await staff("POST", `classes/${cohort.id}/cards`, {
        personIds: [jo.personId],
      });
      const { modules } = QRCode.create(`${origin}/c#${cards[0].token}`, {
        errorCorrectionLevel: "M",
      });
      const matrix = Array.from({ length: modules.size }, (_, row) =>
        Array.from(
          { length: modules.size },
          (_, col) => !!modules.get(row, col),
        ),
      );
      await scan.page.addInitScript((qr: boolean[][]) => {
        delete (window as unknown as { BarcodeDetector?: unknown })
          .BarcodeDetector;
        navigator.mediaDevices.getUserMedia = async () => {
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 480;
          const context = canvas.getContext("2d")!;
          const scale = Math.floor(400 / qr.length);
          const paint = () => {
            context.fillStyle = "white";
            context.fillRect(0, 0, 480, 480);
            context.fillStyle = "black";
            qr.forEach((row, y) =>
              row.forEach((on, x) => {
                if (on)
                  context.fillRect(
                    40 + x * scale,
                    40 + y * scale,
                    scale,
                    scale,
                  );
              }),
            );
            requestAnimationFrame(paint);
          };
          paint();
          return canvas.captureStream(15);
        };
      }, matrix);
      await scan.page.goto(`${origin}/join`);
      await heading(scan.page, "Type your class code").waitFor();
      await settled(scan.page);
      await resetRecord(scan.page);
      await scan.page.route("**/api/v1/school/join/card", async (route) => {
        await new Promise((done) => setTimeout(done, 600));
        await route.continue();
      });
      await tap(scan.page, "Scan my card");
      await scan.page.waitForURL("**/practice", { timeout: 25_000 });
      await firstProblem(scan.page);
      const { cls: scanShift } = await shellRecord(scan.page);
      check("scan CLS", scanShift <= 0.01, scanShift);
      check(
        "scan keeps the secret out of the address",
        !scan.requests.some((request) => request.includes(cards[0].token)),
      );
      // The camera opens and closes in the code's own space.
      for (const width of [390, 1280]) {
        const viewing = await open({ width });
        await viewing.page.addInitScript(() => {
          navigator.mediaDevices.getUserMedia = async () => {
            const canvas = document.createElement("canvas");
            canvas.width = 640;
            canvas.height = 480;
            const context = canvas.getContext("2d")!;
            const paint = () => {
              context.fillStyle = "#5b6f68";
              context.fillRect(0, 0, 640, 480);
              requestAnimationFrame(paint);
            };
            paint();
            return canvas.captureStream(15);
          };
        });
        await viewing.page.goto(`${origin}/join`);
        await heading(viewing.page, "Type your class code").waitFor();
        await settled(viewing.page);
        await resetRecord(viewing.page);
        const title = async () => {
          const [box] = await boxes(viewing.page, "h1");
          return [box!.top, box!.height];
        };
        const titleBefore = await title();
        const buttonBefore = await boxes(viewing.page, "button");
        await tap(viewing.page, "Scan my card");
        await heading(viewing.page, "Hold up your card").waitFor();
        await viewing.page.locator("video").waitFor();
        await settled(viewing.page);
        check("scan title", String(titleBefore) === String(await title()));
        sameBoxes(
          "scan opens",
          buttonBefore,
          await boxes(viewing.page, "button"),
        );
        await shoot(viewing.page, "chromium", "scan", width, "light");
        await tap(viewing.page, "Type a code instead");
        await heading(viewing.page, "Type your class code").waitFor();
        await settled(viewing.page);
        check(
          "scan closes title",
          String(titleBefore) === String(await title()),
        );
        sameBoxes(
          "scan closes",
          buttonBefore,
          await boxes(viewing.page, "button"),
        );
        const { cls: moved } = await shellRecord(viewing.page);
        check("scan open and close CLS", moved <= 0.01, moved);
      }
      // A camera that's refused says what to do, in place.
      const denied = await open();
      await denied.page.addInitScript(() => {
        navigator.mediaDevices.getUserMedia = async () => {
          throw new DOMException("no", "NotAllowedError");
        };
      });
      await denied.page.goto(`${origin}/join`);
      await heading(denied.page, "Type your class code").waitFor();
      await settled(denied.page);
      await resetRecord(denied.page);
      const beforeDenied = await boxes(denied.page, "h1, label, button");
      await tap(denied.page, "Scan my card");
      await denied.page.getByText("The camera is off").waitFor();
      await settled(denied.page);
      sameBoxes(
        "camera refused",
        beforeDenied,
        await boxes(denied.page, "h1, label, button"),
      );

      // Eight to a page, on paper.
      const printing = await open({ width: 1280 });
      const printClass = await makeClass("Grade 5 Math");
      for (const [given, family] of NAMES.slice(0, 11))
        await addStudent(printClass.id, given, family);
      await printing.page.goto(origin + classUrl(printClass.id, "cards"));
      await tap(printing.page, "Make 11 cards");
      await heading(printing.page, "11 cards ready").waitFor();
      await printing.page.emulateMedia({ media: "print" });
      const rows = await printing.page
        .locator("section")
        .evaluateAll((sheets) =>
          sheets.map((sheet) => sheet.querySelectorAll("article").length),
        );
      assert.deepEqual(rows, [8, 3]);
      check(
        "print hides the toolbar",
        !(await printing.page
          .getByRole("button", { name: "Print" })
          .isVisible()),
      );
      const pdf = await printing.page.pdf({
        path: `${ARTIFACTS}/cards.pdf`,
        preferCSSPageSize: true,
        printBackground: true,
      });
      const pagesInPdf = (
        pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) ?? []
      ).length;
      check("two printed pages", pagesInPdf === 2, pagesInPdf);
      await printing.page.emulateMedia({ media: "screen" });
      // One student's card.
      const single = await open();
      await single.page.goto(
        `${origin}${classUrl(printClass.id, "cards")}?student=${mina.personId}`,
      );
      await single.page.getByText("There are no cards to make here").waitFor();
    }
  } catch (error) {
    let shot = 0;
    for (const context of contexts)
      for (const page of context.pages())
        await page
          .screenshot({ path: `${ARTIFACTS}/journey-${engine}-${shot++}.png` })
          .catch(() => undefined);
    throw error;
  } finally {
    await Promise.all(
      contexts.map((context) => context.close().catch(() => undefined)),
    );
  }
}

let exit = 0;
try {
  for (const engine of engines) {
    const browser = await (
      engine === "webkit" ? webkit : secureChromium(rawChromium)
    ).launch();
    try {
      if (!process.argv.includes("--skip-journeys"))
        await journeys(browser, engine);
      if (!process.argv.includes("--skip-sweep"))
        for (const width of widths)
          for (const theme of themes)
            await sweep(browser, engine, width, theme);
    } finally {
      await browser.close();
    }
  }
  if (failures.length) {
    console.error(`${failures.length} failed:\n${failures.join("\n")}`);
    exit = 1;
  } else console.log("School sign-in verified");
} catch (error) {
  console.error(error);
  if (failures.length) console.error(failures.join("\n"));
  exit = 1;
} finally {
  await vite.close();
  await api.close();
  await learning.pool.end();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
process.exit(exit);
