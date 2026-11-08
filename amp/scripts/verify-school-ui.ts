/**
 * AMP for Schools from end to end, in real browsers, against the real API in
 * accounts mode, a real database and the real local PDF renderer:
 *
 *   1. We issue a school; its head opens the setup link, signs up, sets it up,
 *      imports 24 students and invites a teacher.
 *   2. The teacher accepts and prints cards.
 *   3. One student signs in by picture and another by card, and both answer
 *      problems in practice.
 *   4. The teacher sees them on Today; the gradebook suggests a range and the
 *      teacher sets a grade.
 *   5. The CSV export parses and the report cards render.
 *   6. A workbook stack of 24 merges.
 *   7. A family link opens.
 *   8. Removing a student releases the seat, and deletion works.
 *
 * The class's earlier weeks are real answers through the practice API, dated
 * back by the class fixture, so the gradebook has a term to suggest from.
 * Chromium at 1280 and WebKit at 390. The per-feature verify scripts cover
 * each screen's geometry at every width; `capture-schools.ts` sweeps them all.
 *
 *     AMP_TEST_DATABASE_URL=... npx tsx scripts/verify-school-ui.ts [--engine chromium|webkit] [--port 4425]
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import pg from "pg";
import {
  chromium as rawChromium,
  webkit,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";
import { createServer } from "vite";
import { secureChromium } from "../browser-security.mjs";
import { registerFamilyRoutes } from "../src/family/routes";
import { SchoolRepository } from "../src/schools/repository";
import { registerSchoolRoutes } from "../src/schools/routes";
import { schoolAdmin } from "./school-admin";
import {
  accountsAuth,
  accountsConfiguration,
  createAccounts,
  registerAccountRoutes,
} from "../src/server/accounts";
import { buildApp } from "../src/server/app";
import { refuseStudentTokens } from "../src/server/auth";
import { PostgresRepository } from "../src/server/repository";
import { localRenderer } from "../src/workbook/pdf";
import { probe, settle, shellRecord, shiftRecorder } from "./app-shell-probe";
import { migrate } from "./migrate";
import {
  GRADE_5_CLASS,
  SHARED_GAP,
  STUCK,
  seedClass,
  type ClassWorld,
  type Student,
} from "./school-class-fixture";
import { assertTestDatabaseTarget } from "./test-database-preflight";
import { answerOne, trackPracticeProblems } from "./ui-practice-answer";

const argument = (name: string) => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : undefined;
};
const url = process.env.AMP_TEST_DATABASE_URL;
if (!url) throw new Error("AMP_TEST_DATABASE_URL is required");
assertTestDatabaseTarget(url);
const webPort = Number(argument("--port") ?? 4425);
const apiPort = webPort + 1;
const origin = `http://127.0.0.1:${webPort}`;
const ARTIFACTS = "artifacts/school-launch";
await mkdir(ARTIFACTS, { recursive: true });

const schema = `amp_school_launch_${randomUUID().replaceAll("-", "")}`;
const admin = new pg.Pool({ connectionString: url, max: 1 });
await admin.query(`CREATE SCHEMA ${schema}`);
const scoped = new URL(url);
scoped.searchParams.set("options", `-c search_path=${schema}`);
await migrate(scoped.href);
const repository = new PostgresRepository(scoped.href, { development: false });
const db = repository.pool;
const schools = new SchoolRepository(db);
const accounts = await createAccounts(
  db,
  accountsConfiguration({
    AMP_ACCOUNTS_URL: origin,
    AMP_ACCOUNTS_SECRET: "synthetic-school-launch-fixture-secret-0123456789",
    NODE_ENV: "development",
  } as unknown as NodeJS.ProcessEnv),
);
const authenticate = refuseStudentTokens(accountsAuth(accounts));
const mail: { to: string; subject: string; url: string }[] = [];
const info = console.info.bind(console);
console.info = (...args: unknown[]) => {
  if (!String(args[0] ?? "").startsWith("[accounts]")) info(...args);
};
const renderer = localRenderer();
const services = {
  secret: accounts.config.secret,
  origin,
  mail: async (to: string, subject: string, _text: string, link: string) => {
    mail.push({ to, subject, url: link });
  },
};
const app = buildApp({ repository, authenticate, publicUrl: origin });
await registerAccountRoutes(app, accounts, authenticate);
await registerFamilyRoutes(app, { pool: db, authenticate });
await registerSchoolRoutes(app, {
  pool: db,
  authenticate,
  services: { ...services, learning: repository, renderer },
});
await app.listen({ host: "127.0.0.1", port: apiPort });
const vite = await createServer({
  cacheDir: "node_modules/.vite-school-launch",
  optimizeDeps: { include: ["pdf-lib"] },
  server: {
    host: "127.0.0.1",
    port: webPort,
    strictPort: true,
    proxy: { "/api": `http://127.0.0.1:${apiPort}` },
  },
});
await vite.listen();
const world: ClassWorld = {
  db,
  learning: repository,
  schools,
  api: `http://127.0.0.1:${apiPort}`,
};

const failures: string[] = [];
const check = (label: string, ok: boolean, detail: unknown = "") => {
  if (!ok) failures.push(`${label}: ${JSON.stringify(detail).slice(0, 300)}`);
};
const PASSWORD = "synthetic long fixture passphrase";
const DAY = 86_400_000;

/** The class: the teacher verification's 24. Their earlier weeks end eight days
 * ago, so this week's work is what the two in the browser do (and the few the
 * fixture has missing an idea lately). */
const CLASS = GRADE_5_CLASS.map((person) => ({
  ...person,
  answers: Math.round(person.answers * 0.4),
  lastActive: Math.max(person.lastActive ?? 0, 8),
}));
const BY_PICTURE = "Mei";
const BY_CARD = "Felix";
const REMOVED = "Theo";
function rosterCsv() {
  const lines = ["Student ID,Last Name,First Name,Grade,Class"];
  for (const person of CLASS)
    lines.push(
      `${person.identifier},${person.name[1]},${person.name[0]},5,Grade 5 Math`,
    );
  return `${lines.join("\r\n")}\r\n`;
}

async function signUp(page: Page, email: string) {
  const fallback = page.getByRole("button", {
    name: "Use a password instead",
  });
  const password = page.getByLabel("AMP password");
  await Promise.race([
    fallback.waitFor({ timeout: 20_000 }),
    password.waitFor({ timeout: 20_000 }),
  ]);
  if (await fallback.isVisible()) await fallback.click();
  await page.getByLabel("Email").fill(email);
  await password.fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
}
const heading = (page: Page, name: string | RegExp) =>
  page
    .getByRole("heading", { name, level: 1 })
    .first()
    .waitFor({ timeout: 45_000 });
async function measured(page: Page, label: string) {
  await page.mouse.move(0, 0);
  await settle(page, 400);
  const result = await probe(page);
  check(`${label} overflow`, result.overflow === 0, result.overflow);
  check(
    `${label} targets`,
    result.smallTargets.length === 0,
    result.smallTargets,
  );
  const { cls } = await shellRecord(page);
  check(`${label} CLS`, cls <= 0.01, cls);
}
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  const source = text.replace(/^﻿/, "");
  for (let i = 0; i < source.length; i++) {
    const char = source[i]!;
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  return rows;
}
async function newContext(
  browser: Browser,
  width: number,
): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: { width, height: width < 720 ? 844 : 900 },
    acceptDownloads: true,
  });
  await context.addInitScript(shiftRecorder);
  return context;
}
async function students(orgId: string) {
  const { rows } = await db.query(
    `SELECT id,learner_id,given_name FROM amp_people WHERE tenant_id=$1 AND learner_id IS NOT NULL`,
    [orgId],
  );
  return new Map<string, Student>(
    rows.map((row) => [
      row.given_name,
      {
        personId: row.id,
        learnerId: row.learner_id,
        accountId: `school:${row.id}`,
      },
    ]),
  );
}
async function answerSome(page: Page, count: number) {
  for (let index = 0; index < count; index++) {
    await answerOne(page, index % 3 !== 2);
    await page.locator(".next-action").click();
  }
}

async function journey(browser: Browser, engine: string, width: number) {
  const label = `${engine} ${width}`;
  const opened: BrowserContext[] = [];
  const context = async () => {
    const made = await newContext(browser, width);
    opened.push(made);
    return made;
  };
  let last: Page | null = null;
  try {
    // 1. We issue the school. The head opens the setup link, signs up, sets
    // it up, imports 24 and invites a teacher.
    const head = await (await context()).newPage();
    last = head;
    head.setDefaultTimeout(30_000);
    const tag = randomUUID().slice(0, 8);
    const schoolName = `Linden Park School ${engine}`;
    const headEmail = `head-${tag}@linden.example`;
    const school = (await schoolAdmin(
      schools,
      "create-school",
      {
        name: schoolName,
        adminEmail: headEmail,
        seats: 30,
        startsOn: new Date(Date.now() - DAY).toISOString().slice(0, 10),
        endsOn: new Date(Date.now() + 300 * DAY).toISOString().slice(0, 10),
        reference: "Pilot",
      },
      services,
    )) as { orgId: string; setupUrl: string };
    const setupMail = mail.find((entry) => entry.url === school.setupUrl);
    assert.equal(setupMail?.to, headEmail, "The setup link was mailed");
    await head.goto(school.setupUrl);
    await heading(head, `Set up ${schoolName}`);
    await head.getByRole("link", { name: "Create an account" }).click();
    await head.waitForURL(/\/sign-up/);
    await signUp(head, headEmail);
    await heading(head, `Set up ${schoolName}`);
    await head.getByLabel(/Your name/).fill("Ruth Adeyemi");
    await head.getByRole("button", { name: "Start setup" }).click();
    await heading(head, "When does your school year run?");
    const orgId = school.orgId;
    check(
      `${label} setup opens at the calendar for the issued school`,
      head.url().includes(`org=${orgId}`),
      head.url(),
    );
    await head.getByRole("button", { name: "Continue" }).click();
    await heading(head, "What should students see?");
    await head.getByRole("button", { name: "Continue" }).click();
    await heading(head, "Accept the data agreement");
    await head.getByLabel("Your name").fill("Ruth Adeyemi");
    await head.getByLabel("Your title").fill("Head of School");
    await head.getByRole("button", { name: "Accept" }).click();
    await heading(head, "Add your students");
    await head.getByRole("button", { name: /Import a roster/ }).click();
    await heading(head, "Import a roster");
    await head.getByLabel("Choose a roster file").setInputFiles({
      name: "linden-roster.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(rosterCsv()),
    });
    await heading(head, "Check the columns");
    await head.getByRole("button", { name: "Check for changes" }).click();
    await heading(head, /24 students, 1 class/);
    await head.getByRole("button", { name: "Apply changes" }).click();
    await heading(head, /24 students added/);
    await measured(head, `${label} import done`);
    const roster = await students(orgId);
    check(`${label} 24 imported`, roster.size === 24, roster.size);
    const seated = (
      await db.query(
        `SELECT count(*)::int AS n FROM amp_seats s JOIN amp_people p ON p.id=s.person_id
         WHERE p.tenant_id=$1 AND s.released_at IS NULL`,
        [orgId],
      )
    ).rows[0].n;
    check(`${label} every student holds a seat`, seated === 24, seated);
    const classId = (
      await db.query("SELECT id,join_code FROM amp_classes WHERE org_id=$1", [
        orgId,
      ])
    ).rows[0].id as string;
    const klass = `${origin}/school/${orgId}/classes/${classId}`;

    await head.goto(`${origin}/school/${orgId}/staff`);
    await heading(head, "Staff");
    const teacherEmail = `teacher-${tag}@linden.example`;
    await head.getByLabel("Email").fill(teacherEmail);
    await head.getByRole("radio", { name: "Teacher" }).click();
    await head.getByLabel("Grade 5 Math").check();
    await head.getByRole("button", { name: "Send invitation" }).click();
    await head.getByText(`Invitation sent to ${teacherEmail}.`).waitFor();
    const invitation = [...mail]
      .reverse()
      .find((entry) => entry.to === teacherEmail);
    assert.ok(invitation, "The invitation was mailed");

    // 2. The teacher accepts, in another browser, and prints cards.
    const teacher = await (await context()).newPage();
    last = teacher;
    teacher.setDefaultTimeout(30_000);
    await teacher.goto(invitation.url);
    await heading(teacher, `Join ${schoolName}`);
    await teacher.getByRole("link", { name: "Create an account" }).click();
    await teacher.waitForURL(/\/sign-up/);
    await signUp(teacher, teacherEmail);
    await heading(teacher, `Join ${schoolName}`);
    await teacher.getByLabel(/Your name/).fill("Grace Okafor");
    await teacher.getByRole("button", { name: /Join as teacher/ }).click();
    await teacher.waitForURL(/\/school\/[0-9a-f-]{36}\/classes/);

    // The class's earlier weeks: real answers through the API, dated back.
    const year = (
      await db.query(
        "SELECT starts_on::text AS starts FROM amp_academic_sessions WHERE org_id=$1 AND parent_id IS NULL ORDER BY starts_on LIMIT 1",
        [orgId],
      )
    ).rows[0].starts as string;
    const yearAgo = Math.max(
      30,
      Math.round((Date.now() - Date.parse(`${year}T12:00:00Z`)) / DAY),
    );
    await db.query("UPDATE amp_enrollments SET begin_on=$2 WHERE class_id=$1", [
      classId,
      year,
    ]);
    await db.query(
      "UPDATE amp_org_roles SET begin_on=$2 WHERE org_id=$1 AND role='student'",
      [orgId, year],
    );
    const started = performance.now();
    await seedClass(world, {
      personas: CLASS,
      students: roster,
      start: yearAgo,
      timezone: (
        await db.query("SELECT timezone FROM amp_orgs WHERE id=$1", [orgId])
      ).rows[0].timezone,
      sharedGap: SHARED_GAP,
      stuck: STUCK,
    });
    console.log(
      `${label}: the class's term seeded in ${Math.round((performance.now() - started) / 1000)} s`,
    );

    await teacher.goto(`${klass}/cards`);
    await heading(teacher, /Print cards/);
    const issued = teacher.waitForResponse(
      (response) =>
        response.url().endsWith("/cards") &&
        response.request().method() === "POST",
    );
    await teacher.getByRole("button", { name: "Make 24 cards" }).click();
    const cards = (await (await issued).json()).cards as {
      personId: string;
      name: string;
      token: string;
    }[];
    await heading(teacher, "24 cards ready");
    await measured(teacher, `${label} cards`);
    await teacher.emulateMedia({ media: "print" });
    if (engine === "chromium") {
      const pdf = await PDFDocument.load(
        await teacher.pdf({ format: "Letter" }),
      );
      check(
        `${label} the cards print`,
        pdf.getPageCount() >= 2,
        pdf.getPageCount(),
      );
    } else
      await teacher.screenshot({
        path: `${ARTIFACTS}/cards-print-${engine}.png`,
        fullPage: true,
      });
    await teacher.emulateMedia({ media: "screen" });

    // Today before anyone works this week.
    await teacher.goto(`${klass}/today`);
    await heading(teacher, /^Good /);
    const working = async () =>
      Number(
        (
          await teacher
            .getByText(/^\d+ of 24$/)
            .first()
            .textContent()
        )?.split(" ")[0],
      );
    const before = await working();

    // 3. One student by pictures, one by card, on phones.
    const code = (
      await db.query("SELECT join_code FROM amp_classes WHERE id=$1", [classId])
    ).rows[0].join_code as string;
    const phone = async () => {
      const made = await browser.newContext({
        viewport: { width: 390, height: 844 },
      });
      opened.push(made);
      await made.addInitScript(shiftRecorder);
      const page = await made.newPage();
      page.setDefaultTimeout(30_000);
      trackPracticeProblems(page);
      return page;
    };
    const pictures = await phone();
    last = pictures;
    await pictures.goto(`${origin}/join`);
    await heading(pictures, "Type your class code");
    await pictures.getByLabel("Class code").fill(code);
    await pictures.waitForURL(`**/join/${code}`);
    await heading(pictures, "Tap your name");
    await pictures
      .getByRole("link", { name: new RegExp(`^${BY_PICTURE} `) })
      .click();
    await heading(pictures, /Pick 3 pictures/);
    for (const picture of ["Fox", "Boat", "Kite"])
      await pictures
        .getByRole("button", { name: picture, exact: true })
        .click();
    await heading(pictures, "Remember these 3");
    await pictures.getByRole("button", { name: "These are mine" }).click();
    await pictures.waitForURL("**/practice");
    await answerSome(pictures, 4);

    const card = await phone();
    last = card;
    const felix = roster.get(BY_CARD)!;
    const token = cards.find(
      (entry) => entry.personId === felix.personId,
    )?.token;
    assert.ok(token, "Felix has a card");
    await card.goto(`${origin}/c#${token}`);
    await card.waitForURL("**/practice");
    check(
      `${label} the card leaves the address bar`,
      !card.url().includes(token),
      card.url(),
    );
    await answerSome(card, 4);

    // 4. Today shows them; the gradebook suggests; the teacher decides.
    last = teacher;
    await teacher.reload();
    await heading(teacher, /^Good /);
    const after = await working();
    check(`${label} Today counts both students`, after === before + 2, {
      before,
      after,
    });
    await measured(teacher, `${label} today`);
    await teacher.goto(`${klass}/gradebook`);
    await teacher.getByRole("heading", { name: /grades$/, level: 1 }).waitFor();
    const book = await teacher.locator("main").innerText();
    check(
      `${label} the gradebook suggests a range`,
      /\b[A-D][+−]? to [A-D][+−]?, \d+–\d+/.test(book),
      book.slice(0, 300),
    );
    const final = teacher.getByRole("textbox", {
      name: "Final grade for Isaac Moreno",
    });
    await final.scrollIntoViewIfNeeded();
    const saved = teacher.waitForResponse(/\/final$/);
    await final.fill("B+");
    await final.blur();
    check(`${label} the final saves`, (await saved).ok());
    await measured(teacher, `${label} gradebook`);

    // 5. The CSV export parses, and the report cards render.
    await teacher.getByRole("button", { name: "Export", exact: true }).click();
    const sheet = teacher.getByRole("dialog");
    await sheet.waitFor();
    const [download] = await Promise.all([
      teacher.waitForEvent("download"),
      sheet.getByRole("button", { name: "Download CSV" }).click(),
    ]);
    const csvPath = `${ARTIFACTS}/${engine}-gradebook.csv`;
    await download.saveAs(csvPath);
    const csv = parseCsv(await readFile(csvPath, "utf8"));
    check(`${label} CSV has a row per student`, csv.length === 25, csv.length);
    check(
      `${label} CSV carries the final`,
      csv.find((row) => row[1] === "Isaac Moreno")?.[2] === "B+",
      csv.find((row) => row[1] === "Isaac Moreno"),
    );
    await teacher.keyboard.press("Escape");
    await teacher.goto(`${klass}/report-cards`);
    await teacher
      .getByRole("heading", { name: /report cards$/, level: 1 })
      .waitFor();
    await settle(teacher, 300);
    const reports = await teacher.locator("article").count();
    check(`${label} a report card each`, reports === 24, reports);
    const reportText = await teacher.locator("article").first().innerText();
    for (const expected of [schoolName, "Final grade", "Active minutes"])
      check(
        `${label} report card has ${expected}`,
        reportText.includes(expected),
      );

    // 6. A workbook stack of 24, merged in the browser.
    const workers: string[] = [];
    teacher.on("worker", (worker) => workers.push(worker.url()));
    await teacher.goto(`${klass}/workbooks`);
    const print = teacher.getByRole("button", { name: "Print 24 workbooks" });
    await print.waitFor({ timeout: 45_000 });
    await print.click();
    const open = teacher.getByRole("link", { name: "Open 24 workbooks" });
    await open.waitFor({ timeout: 300_000 });
    check(
      `${label} merged in a worker`,
      workers.some((worker) => worker.includes("merge-worker")),
      workers,
    );
    const base64 = await open.evaluate(async (link) => {
      const buffer = await (
        await fetch((link as HTMLAnchorElement).href)
      ).arrayBuffer();
      let text = "";
      for (const byte of new Uint8Array(buffer))
        text += String.fromCharCode(byte);
      return btoa(text);
    });
    const merged = await PDFDocument.load(Buffer.from(base64, "base64"));
    const pages = merged.getPageCount();
    check(`${label} 24 workbooks, merged`, pages >= 24, pages);
    await teacher
      .getByText(`24 workbooks ready, ${pages} pages.`)
      .waitFor({ timeout: 10_000 })
      .catch(() =>
        failures.push(`${label} the stack names its ${pages} pages`),
      );

    // 7. A family link opens, signed out.
    const amara = roster.get("Amara")!;
    await teacher.goto(`${origin}/school/${orgId}/students/${amara.personId}`);
    await teacher.getByRole("button", { name: "Share with family" }).click();
    const share = teacher.getByRole("dialog");
    await share.getByRole("button", { name: "Make a link" }).click();
    const link = await share.getByLabel("Family link").inputValue();
    check(`${label} the link is a family link`, /\/p#/.test(link), link);
    const family = await (await context()).newPage();
    last = family;
    await family.goto(link);
    await family.getByText(/Amara/).first().waitFor({ timeout: 30_000 });
    check(
      `${label} the token leaves the address bar`,
      !family.url().includes("#"),
      family.url(),
    );
    await measured(family, `${label} family page`);

    // 8. Removing a student frees the seat and deletes their learning.
    last = head;
    const theo = roster.get(REMOVED)!;
    await head.goto(
      `${origin}/school/${orgId}/students?student=${theo.personId}`,
    );
    const record = head.getByRole("dialog");
    await record.getByRole("button", { name: "Remove student" }).click();
    await record
      .getByRole("button", { name: "Delete history and remove" })
      .click();
    await record.waitFor({ state: "detached" });
    const gone = (
      await db.query(
        `SELECT p.given_name,p.deleted_at,p.learner_id,
           (SELECT count(*)::int FROM amp_seats s WHERE s.person_id=p.id AND s.released_at IS NULL) AS seats,
           (SELECT count(*)::int FROM amp_attempts a WHERE a.learner_id=$2) AS attempts
         FROM amp_people p WHERE p.id=$1`,
        [theo.personId, theo.learnerId],
      )
    ).rows[0];
    check(
      `${label} removed and tombstoned`,
      gone.given_name === "Removed" && !!gone.deleted_at && !gone.learner_id,
      gone,
    );
    check(`${label} the seat is free`, gone.seats === 0, gone.seats);
    check(`${label} the answers are gone`, gone.attempts === 0, gone.attempts);
    await head.goto(`${origin}/school/${orgId}/license`);
    await heading(head, "License");
    await head.getByText("in use").first().waitFor();
    const license = await head.locator("main").innerText();
    check(
      `${label} the license counts 23 in use`,
      /\bin use\s+23\b/.test(license),
      license.slice(0, 200),
    );
    await measured(head, `${label} license`);
  } catch (error) {
    await last
      ?.screenshot({ path: `${ARTIFACTS}/stuck-${engine}.png`, fullPage: true })
      .catch(() => undefined);
    console.error(`${label} stopped at ${last?.url()}`);
    throw error;
  } finally {
    for (const made of opened) await made.close().catch(() => undefined);
  }
}

let exit = 0;
try {
  const engines = argument("--engine")
    ? [argument("--engine")!]
    : ["chromium", "webkit"];
  for (const engine of engines) {
    const browser = await (
      engine === "webkit" ? webkit : secureChromium(rawChromium)
    ).launch();
    try {
      await journey(browser, engine, engine === "webkit" ? 390 : 1280);
    } finally {
      await browser.close();
    }
  }
} catch (error) {
  console.error(error);
  exit = 1;
} finally {
  await writeFile(
    `${ARTIFACTS}/failures.json`,
    JSON.stringify(failures, null, 1),
  );
  await vite.close();
  await app.close();
  await renderer.close();
  await repository.close();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
console.info = info;
if (failures.length) {
  console.error(`${failures.length} checks failed:`);
  for (const failure of failures) console.error(`  ${failure}`);
  exit = 1;
}
if (!exit) console.log("AMP for Schools verified end to end.");
process.exit(exit);
