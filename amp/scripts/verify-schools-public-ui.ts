/**
 * The public school pages in real browsers, against the real API and a real
 * database: a signed-out visitor reads `/schools` and reaches `/school/new` and
 * the scope and sequence; the PDF and CSV download and parse; the trust page's
 * agreement matches `agreement.ts`; a teacher shares a link, a signed-out browser
 * opens it, a reload keeps working, and revoking shows the calm page. Geometry at
 * 320, 390, 768 and 1280, light and dark. PDFs come from the real local renderer.
 * Screenshots land in docs/reviews/schools-public/ for a person to look at.
 *
 *     AMP_TEST_DATABASE_URL=... npx tsx scripts/verify-schools-public-ui.ts \
 *       [--engine chromium|webkit] [--widths 390,1280] [--skip-sweep] [--skip-journeys]
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
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
import { skills } from "../src/curriculum/catalog";
import { registerFamilyRoutes } from "../src/family/routes";
import { templates } from "../src/math/engine";
import {
  agreementLead,
  agreementSections,
  AGREEMENT_VERSION,
} from "../src/schools/agreement";
import { SchoolRepository } from "../src/schools/repository";
import { registerSchoolRoutes } from "../src/schools/routes";
import {
  scopeAndSequence,
  SCOPE_CSV_HEADERS,
} from "../src/schools/scope-and-sequence";
import { buildApp } from "../src/server/app";
import { refuseStudentTokens } from "../src/server/auth";
import { ApiError, PostgresRepository } from "../src/server/repository";
import { localRenderer } from "../src/workbook/pdf";
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
const engines = argument("--engine")
  ? [argument("--engine") as "chromium" | "webkit"]
  : (["chromium", "webkit"] as const);
const widths = (argument("--widths") ?? "320,390,768,1280")
  .split(",")
  .map(Number);
const themes = ["light", "dark"] as const;
const REVIEW = "docs/reviews/schools-public";
const ARTIFACTS = "artifacts/schools-public";
const webPort = 4406,
  apiPort = 4407,
  origin = `http://127.0.0.1:${webPort}`;
const SIGNED_OUT_KEY = "amp.dev.signedOut";

const failures: string[] = [];
function check(label: string, ok: boolean, detail: unknown = "") {
  if (!ok) failures.push(`${label}: ${JSON.stringify(detail)}`);
}

const schema = `amp_schools_public_ui_${randomUUID().replaceAll("-", "")}`;
const admin = new Pool({ connectionString: url, max: 1 });
const scoped = new URL(url);
scoped.searchParams.set("options", `-c search_path=${schema}`);
await admin.query(`CREATE SCHEMA ${schema}`);
await migrate(scoped.href);
const learning = new PostgresRepository(scoped.href);
const db = learning.pool;
const schools = new SchoolRepository(db);
const renderer = localRenderer();

/** One signed-in browser per account: the fixture header says who it is. */
const authenticate = refuseStudentTokens(async (request) => {
  if (request.headers.authorization !== "Bearer amp-local-development")
    throw new ApiError(401, "Sign in to continue");
  const who = request.headers["x-fixture-account"];
  return typeof who === "string" ? who : "development-household";
});
const api = buildApp({ repository: learning, authenticate });
await registerFamilyRoutes(api, { pool: db, authenticate });
await registerSchoolRoutes(api, {
  pool: db,
  authenticate,
  services: {
    secret: "synthetic-schools-public-fixture-secret-0123456789",
    origin,
    learning,
    renderer,
  },
});
await registerUnavailableBilling(api, authenticate);
await registerAnalyticsRoutes(api, { pool: db, authenticate });
api.get("/api/v1/auth-config", async () => ({ mode: "development" }));
await api.listen({ host: "127.0.0.1", port: apiPort });
const vite = await createServer({
  cacheDir: "node_modules/.vite-schools-public",
  server: {
    host: "127.0.0.1",
    port: webPort,
    strictPort: true,
    proxy: { "/api": `http://127.0.0.1:${apiPort}` },
  },
});
await vite.listen();

const agreement = {
  version: "fixture-1",
  signerName: "Fixture Signer",
  signerTitle: "Head of School",
};
const yearAhead = new Date(Date.now() + 365 * 86_400_000).toISOString();
const dayBack = (back: number) =>
  new Date(Date.now() - back * 86_400_000).toISOString().slice(0, 10);

/** A class with a student worth reading about, and a gap three students share. */
async function makeClass(suffix: string, name: string) {
  const org = await schools.createOrg(
    {
      kind: "school",
      name,
      timezone: "America/New_York",
    },
    agreement,
  );
  await schools.issueLicense({ orgId: org.id, seats: 60, endsAt: yearAhead });
  const period = await schools.createClass(org.id, { name: "Grade 5 Math" });
  const teacher = `fixture-teacher-${suffix}`;
  await schools.addStaff({
    orgId: org.id,
    role: "teacher",
    givenName: "Ana",
    familyName: "Ruiz",
    accountId: teacher,
    classId: period.id,
  });
  const orgAdmin = `fixture-admin-${suffix}`;
  await schools.addStaff({
    orgId: org.id,
    role: "admin",
    givenName: "Grace",
    familyName: "Okafor",
    accountId: orgAdmin,
  });
  const enroll = (givenName: string, familyName: string) =>
    schools.provisionStudent(org.id, {
      givenName,
      familyName,
      gradeLevel: 5,
      classId: period.id,
    });
  const amara = await enroll("Amara", "Osei");
  const others = [
    await enroll("Caleb", "Ortiz"),
    await enroll("Diego", "Salas"),
    await enroll("Hana", "Sato"),
  ];
  const strands = {
    fractions: [5.7, 0.35, 44],
    operations: [5.5, 0.3, 40],
    number: [5.2, 0.32, 32],
    measurement: [5.0, 0.4, 20],
    geometry: [4.8, 0.45, 14],
    data: [5.3, 0.5, 9],
  } as const;
  await db.query(
    `INSERT INTO amp_level_days(learner_id,day,frontier,policy_version) VALUES($1,$2,$3,'fixture')`,
    [
      amara.learnerId,
      dayBack(1),
      JSON.stringify({
        overall: { level: 5.3, sd: 0.25, answered: 159, independent: 110 },
        strands: Object.fromEntries(
          Object.entries(strands).map(([id, [level, sd, answered]]) => [
            id,
            { level, sd, answered, independent: Math.round(answered * 0.7) },
          ]),
        ),
      }),
    ],
  );
  const gained = skills
    .filter((skill) => skill.gradeBand === "5" && skill.strand !== "modeling")
    .slice(0, 9);
  for (const [index, skill] of gained.entries())
    await db.query(
      `INSERT INTO amp_skill_days(learner_id,day,skill_id,attempts,correct,independent)
       VALUES($1,$2,$3,6,5,3)`,
      [amara.learnerId, dayBack(1 + index * 3), skill.id],
    );
  for (let back = 1; back < 28; back += 2)
    await db.query(
      `INSERT INTO amp_active_days(learner_id,day,surface,skill_id,active_ms)
       VALUES($1,$2,'practice','',$3)`,
      [amara.learnerId, dayBack(back), (18 + (back % 7)) * 60_000],
    );
  const gapSkill = skills.find(
    (skill) =>
      skill.gradeBand === "5" &&
      skill.strand === "fractions" &&
      templates.some((template) => template.skillId === skill.id),
  )!;
  const gapTemplate = templates.find(
    (template) => template.skillId === gapSkill.id,
  )!;
  for (const student of others)
    await db.query(
      `INSERT INTO amp_skill_evidence(learner_id,skill_id,state) VALUES($1,$2,$3)`,
      [
        student.learnerId,
        gapSkill.id,
        JSON.stringify({
          version: 1,
          skillId: gapSkill.id,
          recentOutcomes: [1, 2, 3].map((n) => ({
            id: `fixture-${n}`,
            skillId: gapSkill.id,
            templateId: gapTemplate.id,
            correct: false,
            assisted: false,
            evidenceWeight: 1,
            createdAt: new Date(Date.now() - n * 3_600_000).toISOString(),
          })),
        }),
      ],
    );
  const session = (
    await db.query("SELECT session_id FROM amp_classes WHERE id=$1", [
      period.id,
    ])
  ).rows[0].session_id;
  const final = await fetch(
    `http://127.0.0.1:${apiPort}/api/v1/school/classes/${period.id}/students/${amara.personId}/final`,
    {
      method: "POST",
      headers: {
        authorization: "Bearer amp-local-development",
        "x-fixture-account": teacher,
        "content-type": "application/json",
      },
      body: JSON.stringify({ term: session, value: "A-" }),
    },
  );
  assert.equal(final.ok, true, `final grade ${final.status}`);
  return {
    org,
    period,
    teacher,
    orgAdmin,
    amara,
    others,
    gapSkill,
  };
}

await mkdir(REVIEW, { recursive: true });
await mkdir(ARTIFACTS, { recursive: true });

async function device(
  browser: Browser,
  options: {
    width?: number;
    theme?: "light" | "dark";
    account?: string;
    signedOut?: boolean;
  } = {},
) {
  const width = options.width ?? 1280;
  const context = await browser.newContext({
    viewport: { width, height: width < 720 ? 844 : 900 },
    colorScheme: options.theme ?? "light",
    ...(options.account
      ? { extraHTTPHeaders: { "x-fixture-account": options.account } }
      : {}),
    acceptDownloads: true,
  });
  await context.addInitScript(shiftRecorder);
  if (options.signedOut)
    await context.addInitScript((key) => {
      try {
        sessionStorage.setItem(key, "1");
      } catch {
        /* The blank page before the first navigation has no storage. */
      }
    }, SIGNED_OUT_KEY);
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  page.on("pageerror", (error) => console.log(`page error: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() >= 500 && response.url().includes("/api/"))
      console.log(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  return { context, page };
}

const heading = (page: Page, name: string | RegExp) =>
  page.getByRole("heading", { name, level: 1 });
const settled = async (page: Page) => {
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.fonts.ready);
  await settle(page, 400);
};
/** Lazy screens load as a person scrolls to them, so walk down and back. */
async function walk(page: Page) {
  await page.evaluate(async () => {
    const step = Math.max(400, innerHeight - 100);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      scrollTo(0, y);
      await new Promise((done) => setTimeout(done, 90));
    }
    await Promise.all(
      [...document.images].map((image) =>
        image.complete
          ? undefined
          : new Promise((done) => {
              image.addEventListener("load", done, { once: true });
              image.addEventListener("error", done, { once: true });
            }),
      ),
    );
    scrollTo(0, 0);
  });
  await settle(page, 150);
}
async function shoot(
  page: Page,
  engine: string,
  name: string,
  width: number,
  theme: string,
  /** The window alone, for a dialog; or how far down a very long page to keep. */
  frame: "window" | { height: number } | "page" = "page",
) {
  const inReview = engine === "chromium" && (width === 1280 || width === 390);
  await page.evaluate(() => {
    const shell = (window as unknown as { __shell?: { paused: boolean } })
      .__shell;
    if (shell) shell.paused = true;
  });
  await page.screenshot({
    path: `${inReview ? REVIEW : ARTIFACTS}/${name}-${width}-${theme}${engine === "chromium" ? "" : `-${engine}`}.png`,
    fullPage: frame !== "window",
    ...(typeof frame === "object"
      ? { clip: { x: 0, y: 0, width, height: frame.height } }
      : {}),
  });
  await page.evaluate(() => {
    const shell = (window as unknown as { __shell?: { paused: boolean } })
      .__shell;
    if (shell) shell.paused = false;
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

const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
const NOT_ON_THIS_PAGE =
  /\/api\/v1\/(events|trials|me|school\/student)\b|googletagmanager|google-analytics\.com/;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  const body = text.replace(/^﻿/, "");
  for (let i = 0; i < body.length; i++) {
    const c = body[i]!;
    if (quoted) {
      if (c === '"' && body[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  return rows;
}

/** Turns PDF pages into images for a person to look at, where the tool exists. */
async function pdfPages(pdf: Buffer, pages: number[]) {
  const path = `${ARTIFACTS}/scope-and-sequence.pdf`;
  await writeFile(path, pdf);
  try {
    for (const number of pages)
      execFileSync("pdftoppm", [
        "-png",
        "-r",
        "110",
        "-singlefile",
        "-f",
        String(number),
        "-l",
        String(number),
        path,
        `${REVIEW}/scope-pdf-page-${number}`,
      ]);
    return execFileSync("pdftotext", [path, "-"]).toString();
  } catch (error) {
    console.log(`No PDF images: ${(error as Error).message}`);
    return null;
  }
}

/** The whole story, in order. */
async function journeys(browser: Browser, engine: string) {
  const open: Awaited<ReturnType<typeof device>>[] = [];
  const start = async (options?: Parameters<typeof device>[1]) => {
    const made = await device(browser, options);
    open.push(made);
    return made;
  };
  const label = `journey ${engine}`;
  const fixture = await makeClass(
    engine === "webkit" ? "WK" : "CR",
    `Cedar Hill School ${engine}`,
  );
  const scope = scopeAndSequence();
  try {
    // A signed-out visitor reads the pitch.
    const visitor = await start({ signedOut: true });
    const responses: string[] = [];
    visitor.page.on("response", (response) => {
      if (response.status() === 404) responses.push(response.url());
    });
    await visitor.page.goto(`${origin}/schools`);
    await heading(visitor.page, /complete math curriculum/).waitFor();
    const main = await visitor.page.locator("main").innerText();
    for (const count of [scope.objectives, scope.problemTypes, scope.lessons])
      check(
        `${label} says the live count ${count}`,
        main.includes(count.toLocaleString("en-US")),
      );
    check(`${label} says no price`, !/[$€£]\s?\d/.test(main));
    check(`${label} every file found`, responses.length === 0, responses);
    check(
      `${label} talk to us is mail`,
      (await visitor.page
        .getByRole("link", { name: "Talk to us" })
        .first()
        .getAttribute("href")) === "mailto:support@corpora.inc",
    );

    // On to the curriculum, by the link a school would follow.
    await visitor.page.getByRole("link", { name: "Read it here" }).click();
    await heading(visitor.page, "Scope and sequence").waitFor();
    check(
      `${label} scope has a URL`,
      new URL(visitor.page.url()).pathname === "/schools/scope-and-sequence",
    );
    check(
      `${label} every objective is on the page`,
      (await visitor.page.locator("tbody tr[data-strand]").count()) ===
        scope.objectives,
    );
    const scopeText = await visitor.page.locator("main").innerText();
    check(`${label} SAT reads as words`, !scopeText.includes("SAT."));
    check(`${label} SAT label`, scopeText.includes("SAT Advanced Math"));
    check(`${label} the lead`, scopeText.includes(scope.lead));

    const csvDownload = visitor.page.waitForEvent("download");
    await visitor.page
      .getByRole("link", { name: "Download CSV" })
      .first()
      .click();
    const csvFile = await csvDownload;
    check(
      `${label} CSV name`,
      csvFile.suggestedFilename() === "amp-scope-and-sequence.csv",
      csvFile.suggestedFilename(),
    );
    const csv = parseCsv(await readFile(await csvFile.path(), "utf8"));
    check(
      `${label} CSV header`,
      csv[0]?.join() === SCOPE_CSV_HEADERS.join(),
      csv[0],
    );
    check(`${label} CSV rows`, csv.length === scope.objectives + 1, csv.length);
    check(
      `${label} CSV every row whole`,
      csv.every((row) => row.length === SCOPE_CSV_HEADERS.length),
    );

    const pdfDownload = visitor.page.waitForEvent("download");
    await visitor.page
      .getByRole("link", { name: "Download PDF" })
      .first()
      .click();
    const pdfFile = await pdfDownload;
    const pdfBytes = await readFile(await pdfFile.path());
    const parsed = await PDFDocument.load(pdfBytes);
    const pages = parsed.getPages();
    check(`${label} PDF pages`, pages.length >= 14, pages.length);
    check(
      `${label} PDF is letter landscape`,
      pages.every(
        (one) =>
          Math.round(one.getWidth()) === 792 &&
          Math.round(one.getHeight()) === 612,
      ),
      pages.slice(0, 2).map((one) => one.getSize()),
    );
    if (engine === "chromium") {
      const text = await pdfPages(pdfBytes, [1, 2, 11]);
      if (text) {
        check(
          `${label} PDF has the lead`,
          normalize(text).includes(scope.lead),
        );
        check(`${label} PDF has no raw SAT id`, !text.includes("SAT."));
        const heads = text.match(/Prerequisites/g)?.length ?? 0;
        check(`${label} PDF repeats its headers`, heads >= pages.length - 1, {
          heads,
          pages: pages.length,
        });
      }
    }

    // The trust page holds what schools accept, word for word.
    await visitor.page.goto(`${origin}/schools/trust`);
    await heading(visitor.page, "How AMP handles student data").waitFor();
    const sections = await visitor.page
      .locator("[data-agreement-section]")
      .evaluateAll((elements) =>
        elements.map((element) => ({
          heading: element.querySelector("h3")?.textContent ?? "",
          paragraphs: [...element.querySelectorAll("p")].map(
            (p) => p.textContent ?? "",
          ),
        })),
      );
    check(
      `${label} the agreement matches agreement.ts`,
      JSON.stringify(sections) === JSON.stringify(agreementSections),
    );
    check(
      `${label} the agreement's lead`,
      (await visitor.page.locator("[data-agreement-lead]").innerText()) ===
        agreementLead,
    );
    check(
      `${label} the version`,
      (await visitor.page.locator("main").innerText()).includes(
        `Version ${AGREEMENT_VERSION}`,
      ),
    );

    // Start a class: through sign-up and straight back to setup.
    await visitor.page.goto(`${origin}/schools`);
    await visitor.page
      .getByRole("link", { name: "Start a class" })
      .first()
      .click();
    await visitor.page.waitForURL(/\/sign-up\?/);
    check(
      `${label} start a class goes to setup`,
      new URL(visitor.page.url()).searchParams.get("next") === "/school/new",
      visitor.page.url(),
    );

    // A teacher shares a link from the student's record.
    const teacher = await start({ account: fixture.teacher });
    await teacher.page.goto(
      `${origin}/school/${fixture.org.id}/students/${fixture.amara.personId}`,
    );
    await teacher.page
      .getByRole("button", { name: "Share with family" })
      .click();
    await teacher.page.getByRole("button", { name: "Make a link" }).click();
    const field = teacher.page.getByRole("textbox", { name: "Family link" });
    await field.waitFor();
    const link = await field.inputValue();
    check(
      `${label} the link's shape`,
      /\/p#[A-Za-z0-9_-]{43}$/.test(link),
      link.replace(/#.*/, "#…"),
    );
    const token = link.split("#")[1]!;
    if (engine === "chromium") {
      await teacher.context.grantPermissions([
        "clipboard-read",
        "clipboard-write",
      ]);
      await teacher.page.getByRole("button", { name: "Copy link" }).click();
      await teacher.page.getByRole("button", { name: "Link copied" }).waitFor();
      check(
        `${label} copied whole`,
        (await teacher.page.evaluate(() => navigator.clipboard.readText())) ===
          link,
      );
    }
    await teacher.page.keyboard.press("Escape");

    // A signed-out browser opens it.
    const family = await start({ signedOut: true });
    const seen: { url: string; referer?: string }[] = [];
    family.page.on("request", (request) =>
      seen.push({
        url: request.url(),
        ...(request.headers().referer
          ? { referer: request.headers().referer }
          : {}),
      }),
    );
    await family.page.goto(link);
    await heading(family.page, "Amara Osei").waitFor();
    check(
      `${label} the fragment leaves at once`,
      family.page.url() === `${origin}/p`,
      "address bar",
    );
    const body = await family.page.locator("body").innerText();
    for (const expected of [
      "Grade 5 Math",
      "Where Amara is",
      "Active time",
      "Objectives gained",
      "Recent objectives",
      "Final grades",
      "A-",
    ])
      check(`${label} the page shows ${expected}`, body.includes(expected));
    for (const other of ["Caleb", "Diego", "Hana"])
      check(`${label} nobody else: ${other}`, !body.includes(other));
    check(`${label} no suggestion`, !/suggest/i.test(body));
    check(
      `${label} no navigation`,
      (await family.page.locator("nav, a[href]").count()) === 0,
    );
    check(
      `${label} noindex`,
      (await family.page
        .locator('meta[name="robots"]')
        .getAttribute("content")) === "noindex, nofollow",
    );
    check(
      `${label} no-referrer`,
      (await family.page
        .locator('meta[name="referrer"]')
        .getAttribute("content")) === "no-referrer",
    );
    const apiCalls = () =>
      seen.filter(({ url }) => new URL(url).pathname.startsWith("/api/"));
    check(
      `${label} no analytics or engagement`,
      !seen.some(({ url }) => NOT_ON_THIS_PAGE.test(url)),
      seen
        .filter(({ url }) => NOT_ON_THIS_PAGE.test(url))
        .map(({ url }) => url),
    );
    check(
      `${label} the token is in no address`,
      !seen.some(({ url }) => url.includes(token)),
    );
    check(
      `${label} the exchange sends no referrer`,
      apiCalls()
        .filter(({ url }) => url.endsWith("/school/share/view"))
        .every(({ referer }) => !referer),
    );

    // A reload keeps working, with no token in the address.
    await family.page.reload();
    await heading(family.page, "Amara Osei").waitFor();
    check(`${label} still no fragment`, family.page.url() === `${origin}/p`);

    // Group sheet: from Today straight to the stack, with the students chosen.
    await teacher.page.goto(
      `${origin}/school/${fixture.org.id}/classes/${fixture.period.id}/today`,
    );
    const sheet = teacher.page.getByRole("link", {
      name: "Print a group sheet",
    });
    await sheet.waitFor();
    const href = new URL((await sheet.getAttribute("href"))!, origin)
      .searchParams;
    check(
      `${label} sheet names the skill`,
      href.get("skill") === fixture.gapSkill.id,
    );
    check(
      `${label} sheet names the students`,
      [...(href.get("students") ?? "").split(",")].sort().join() ===
        fixture.others
          .map((student) => student.personId)
          .sort()
          .join(),
      href.get("students"),
    );
    await sheet.click();
    await teacher.page.waitForURL(/\/workbooks\?/);
    await heading(teacher.page, "Workbooks").waitFor();
    await teacher.page
      .getByText("Group sheet: each workbook leans on")
      .waitFor();
    await teacher.page
      .getByRole("heading", { name: "3 of 4 students" })
      .waitFor();

    // Device mode: one control at class scope, and a lock from above shows.
    await teacher.page.goto(
      `${origin}/school/${fixture.org.id}/classes/${fixture.period.id}/experience`,
    );
    const devices = teacher.page.getByRole("radiogroup", { name: "Devices" });
    await devices.waitFor();
    await devices.getByRole("radio", { name: "Personal" }).click();
    await teacher.page.getByText("Set by Grade 5 Math").last().waitFor();
    const principal = await start({ account: fixture.orgAdmin });
    await principal.page.goto(`${origin}/school/${fixture.org.id}/experience`);
    const orgDevices = principal.page.getByRole("radiogroup", {
      name: "Devices",
    });
    await orgDevices.getByRole("radio", { name: "Shared" }).click();
    await principal.page
      .getByRole("button", { name: "Lock for everyone below" })
      .last()
      .click();
    await principal.page
      .getByRole("button", { name: "Locked for everyone below" })
      .waitFor();
    await teacher.page.reload();
    await teacher.page.getByText(/^Locked by Cedar Hill School/).waitFor();
    check(
      `${label} a locked control doesn't offer a change`,
      await teacher.page
        .getByRole("radiogroup", { name: "Devices" })
        .getByRole("radio", { name: "Personal" })
        .isDisabled(),
    );

    // Parent links: a fresh file, and the old link stops.
    await teacher.page.goto(
      `${origin}/school/${fixture.org.id}/classes/${fixture.period.id}/roster`,
    );
    await teacher.page.getByRole("button", { name: "Parent links" }).click();
    const linksDownload = teacher.page.waitForEvent("download");
    await teacher.page
      .getByRole("button", { name: "Download new links" })
      .click();
    const linksFile = await linksDownload;
    const links = parseCsv(await readFile(await linksFile.path(), "utf8"));
    check(`${label} links header`, links[0]?.join() === "Student,Link");
    check(`${label} links rows`, links.length === 5, links.length);
    const freshLink = links.find((row) => row[0] === "Amara Osei")?.[1];
    check(
      `${label} a fresh link`,
      !!freshLink && freshLink !== link,
      "rotated",
    );
    await family.page.reload();
    await heading(family.page, "Ask the school for a new link").waitFor();

    // Revoke from the record: the calm page.
    await family.page.goto(freshLink!);
    await heading(family.page, "Amara Osei").waitFor();
    await teacher.page.goto(
      `${origin}/school/${fixture.org.id}/students/${fixture.amara.personId}`,
    );
    await teacher.page
      .getByRole("button", { name: "Share with family" })
      .click();
    await teacher.page.getByRole("button", { name: "Revoke link" }).click();
    await teacher.page.getByRole("button", { name: "Make a link" }).waitFor();
    await family.page.reload();
    await heading(family.page, "Ask the school for a new link").waitFor();
    check(
      `${label} the calm page asks for nothing else`,
      (await family.page.locator("button, a[href]").count()) === 0,
    );
    // No link at all, in a new tab.
    const stranger = await start({ signedOut: true });
    await stranger.page.goto(`${origin}/p`);
    await heading(stranger.page, "Ask the school for a new link").waitFor();
  } catch (error) {
    let shot = 0;
    for (const { page } of open)
      await page
        .screenshot({
          path: `${ARTIFACTS}/failure-${engine}-${shot++}.png`,
          fullPage: true,
        })
        .catch(() => undefined);
    throw error;
  } finally {
    await Promise.all(
      open.map(({ context }) => context.close().catch(() => undefined)),
    );
  }
}

let sweepFixture: Awaited<ReturnType<typeof makeClass>> | undefined;
async function sweep(
  browser: Browser,
  engine: string,
  width: number,
  theme: "light" | "dark",
) {
  const label = `${engine} ${width} ${theme}`;
  const open: Awaited<ReturnType<typeof device>>[] = [];
  const start = async (options: Parameters<typeof device>[1]) => {
    const made = await device(browser, { width, theme, ...options });
    open.push(made);
    return made;
  };
  sweepFixture ??= await makeClass("SWEEP", "Alder Street School");
  const fixture = sweepFixture;
  try {
    const visitor = await start({ signedOut: true });
    for (const [name, path, title] of [
      ["schools", "/schools", /complete math curriculum/],
      ["scope", "/schools/scope-and-sequence", "Scope and sequence"],
      ["trust", "/schools/trust", "How AMP handles student data"],
    ] as const) {
      await visitor.page.goto(`${origin}${path}`);
      await heading(visitor.page, title).waitFor();
      await settled(visitor.page);
      await settle(visitor.page, name === "schools" ? 1500 : 150);
      await geometry(visitor.page, `${label} ${name} first paint`);
      await walk(visitor.page);
      await geometry(visitor.page, `${label} ${name}`);
      await shoot(
        visitor.page,
        engine,
        name,
        width,
        theme,
        name === "scope" ? { height: width < 720 ? 3200 : 2400 } : "page",
      );
    }
    // Without the counts, the page still reads, and says no numbers.
    await visitor.page.route("**/api/v1/schools/curriculum", (route) =>
      route.abort(),
    );
    await visitor.page.goto(`${origin}/schools`);
    await heading(visitor.page, /complete math curriculum/).waitFor();
    await settled(visitor.page);
    check(
      `${label} no counts, no ribbon`,
      (await visitor.page.locator("ol[role=img]").count()) === 0,
    );
    await geometry(visitor.page, `${label} schools without counts`);
    await visitor.page.unroute("**/api/v1/schools/curriculum");
    // A failed curriculum explains itself.
    await visitor.page.route("**/api/v1/schools/scope-and-sequence", (route) =>
      route.abort(),
    );
    await visitor.page.goto(`${origin}/schools/scope-and-sequence`);
    await visitor.page
      .getByText("The scope and sequence didn’t load")
      .waitFor();
    await settled(visitor.page);
    await geometry(visitor.page, `${label} scope failed`);
    await visitor.page.unroute("**/api/v1/schools/scope-and-sequence");

    const teacher = await start({ account: fixture.teacher });
    await teacher.page.goto(
      `${origin}/school/${fixture.org.id}/students/${fixture.amara.personId}`,
    );
    await teacher.page
      .getByRole("button", { name: "Share with family" })
      .waitFor();
    await settled(teacher.page);
    await geometry(teacher.page, `${label} record`);
    await teacher.page
      .getByRole("button", { name: "Share with family" })
      .click();
    const make = teacher.page.getByRole("button", { name: "Make a link" });
    await make
      .waitFor({ timeout: 1500 })
      .then(() => make.click())
      .catch(() => undefined);
    const field = teacher.page.getByRole("textbox", { name: "Family link" });
    await field.waitFor();
    await settled(teacher.page);
    await shoot(teacher.page, engine, "share-sheet", width, theme, "window");
    const link = await field.inputValue();
    await teacher.page.keyboard.press("Escape");

    const family = await start({ signedOut: true });
    await family.page.goto(link);
    await heading(family.page, "Amara Osei").waitFor();
    await settled(family.page);
    await geometry(family.page, `${label} parent`);
    await shoot(family.page, engine, "parent", width, theme);
    // A request that fails asks to try again, and getting through shows the page.
    await family.page.route("**/school/share/view", (route) => route.abort());
    await family.page.reload();
    await heading(family.page, "This page didn’t load").waitFor();
    await settled(family.page);
    await geometry(family.page, `${label} parent failed`);
    await family.page.unroute("**/school/share/view");
    await family.page.getByRole("button", { name: "Try again" }).click();
    await heading(family.page, "Amara Osei").waitFor();

    const ended = await start({ signedOut: true });
    await ended.page.goto(`${origin}/p`);
    await heading(ended.page, "Ask the school for a new link").waitFor();
    await settled(ended.page);
    await geometry(ended.page, `${label} ended`);
    await shoot(ended.page, engine, "parent-ended", width, theme);

    await teacher.page.goto(
      `${origin}/school/${fixture.org.id}/classes/${fixture.period.id}/today`,
    );
    await teacher.page
      .getByRole("link", { name: "Print a group sheet" })
      .waitFor();
    await settled(teacher.page);
    await geometry(teacher.page, `${label} today`);
    await shoot(teacher.page, engine, "today-group-sheet", width, theme);

    await teacher.page.goto(
      `${origin}/school/${fixture.org.id}/classes/${fixture.period.id}/experience`,
    );
    await teacher.page.getByRole("radiogroup", { name: "Devices" }).waitFor();
    await settled(teacher.page);
    await geometry(teacher.page, `${label} experience`);
    await shoot(teacher.page, engine, "experience-devices", width, theme);

    await teacher.page.goto(
      `${origin}/school/${fixture.org.id}/classes/${fixture.period.id}/roster`,
    );
    await teacher.page.getByRole("button", { name: "Parent links" }).waitFor();
    await settled(teacher.page);
    await geometry(teacher.page, `${label} roster`);
  } catch (error) {
    let shot = 0;
    for (const { page } of open)
      await page
        .screenshot({
          path: `${ARTIFACTS}/failure-${engine}-${width}-${theme}-${shot++}.png`,
          fullPage: true,
        })
        .catch(() => undefined);
    throw error;
  } finally {
    await Promise.all(
      open.map(({ context }) => context.close().catch(() => undefined)),
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
  } else console.log("Public school pages verified");
} catch (error) {
  console.error(error);
  if (failures.length) console.error(failures.join("\n"));
  exit = 1;
} finally {
  await vite.close();
  await api.close();
  await renderer.close();
  await learning.pool.end();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
process.exit(exit);
