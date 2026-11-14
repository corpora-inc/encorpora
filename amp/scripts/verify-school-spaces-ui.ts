/**
 * The Classroom and School spaces, end to end, against the real API and
 * accounts (docs/architecture/spaces.md, SPEC §4, R7, R11, R14, R16):
 *
 * 1. The school revenue path: a teacher signs up and sets up a class by
 *    hand, imports a roster, sees no class code until Start practice, a
 *    student walks from the code to a first problem, the records fill,
 *    the buyer gets a link, and practice runs through active, grace,
 *    expired (reports, exports, workbooks and paper results kept) and paid
 *    coverage on the same records.
 * 2. School first runs: no school, a teacher's own pilot, an
 *    administrator, an invitation on the device.
 * 3. Roles: a viewer, an aide, an administrator who teaches nothing, and
 *    staff of two schools, each at 320, 390, 768 and 1280 px, light and
 *    dark: what each is offered, and nothing more.
 *
 * AMP_TEST_DATABASE_URL=... npx tsx scripts/verify-school-spaces-ui.ts [--port 4954]
 * Screenshots go to $AMP_SPACES_SHOTS (default artifacts/school-spaces).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { Pool } from "pg";
import {
  chromium as rawChromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";
import { createServer } from "vite";
import { secureChromium } from "../browser-security.mjs";
import { registerFamilyRoutes } from "../src/family/routes";
import { AGREEMENT_VERSION } from "../src/schools/agreement";
import { SchoolRepository } from "../src/schools/repository";
import { registerSchoolRoutes } from "../src/schools/routes";
import { buildApp } from "../src/server/app";
import { refuseStudentTokens } from "../src/server/auth";
import {
  ACCOUNT_PREFIX,
  accountsAuth,
  createAccounts,
  registerAccountRoutes,
} from "../src/server/accounts";
import { PostgresRepository } from "../src/server/repository";
import { templates } from "../src/math/engine";
import { workbookWorker } from "../src/workbook/off-thread";
import { localRenderer } from "../src/workbook/pdf";
import { PDFDocument } from "pdf-lib";
import { migrate } from "./migrate";
import { schoolAdmin } from "./school-admin";
import { assertTestDatabaseTarget } from "./test-database-preflight";

const url = process.env.AMP_TEST_DATABASE_URL!;
assertTestDatabaseTarget(url);
const at = process.argv.indexOf("--port");
const port = at >= 0 ? Number(process.argv[at + 1]) : 4954;
const origin = `http://127.0.0.1:${port}`;
const shots = process.env.AMP_SPACES_SHOTS ?? "artifacts/school-spaces";
const WIDTHS = [320, 390, 768, 1280] as const;
const THEMES = ["light", "dark"] as const;
const PASSWORD = "fixture-school-spaces-password-123";

const schema = `amp_spaces_ui_${randomUUID().replaceAll("-", "")}`;
const admin = new Pool({ connectionString: url, max: 1 });
await admin.query(`CREATE SCHEMA ${schema}`);
const scoped = new URL(url);
scoped.searchParams.set("options", `-c search_path=${schema}`);
await migrate(scoped.href);
const learning = new PostgresRepository(scoped.href);
// Course placement (R14) is the server's, behind its rollout switch: on
// here, so a class's course decides where its students begin.
await learning.pool.query("UPDATE amp_course_placement SET enabled=true");
const schools = new SchoolRepository(learning.pool);
const db = learning.pool;
const mail: string[] = [];
const originalInfo = console.info;
console.info = (...args: unknown[]) => {
  const message = String(args[0] ?? "");
  if (message.startsWith("[accounts] email to "))
    mail.push(message.split("\n").at(-1)!);
  else originalInfo(...args);
};
const renderer = localRenderer();
const accounts = await createAccounts(db, {
  baseURL: origin,
  secret: "fixture-school-spaces-accounts-secret-1234",
  production: false,
  passwords: true,
  trustedOrigins: [],
});
const authenticate = refuseStudentTokens(accountsAuth(accounts));
const api = buildApp({ repository: learning, authenticate });
await registerAccountRoutes(api, accounts);
await registerFamilyRoutes(api, { pool: db, authenticate });
await registerSchoolRoutes(api, {
  pool: db,
  authenticate,
  services: {
    origin,
    secret: "fixture-school-spaces-browser-secret",
    // Workbooks are made and printed as production does; nothing prints.
    learning,
    // The real renderer (Chromium), so a printed workbook is a real PDF.
    renderer,
  },
});
await api.listen({ host: "127.0.0.1", port: port + 1 });
await workbookWorker().warm();
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
await mkdir(shots, { recursive: true });
const browser: Browser = await secureChromium(rawChromium).launch();
const failures: string[] = [];
const contexts: BrowserContext[] = [];

/** A fresh device. Layout shifts are summed from the first paint
 * (`window.__shift`), so a state change can be held to none. */
async function device(width = 390) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
  });
  contexts.push(context);
  await context.addInitScript(() => {
    (window as unknown as { __shift: number }).__shift = 0;
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as unknown as {
          value: number;
          hadRecentInput: boolean;
        }[])
          if (!entry.hadRecentInput)
            (window as unknown as { __shift: number }).__shift += entry.value;
      }).observe({ type: "layout-shift", buffered: true });
    } catch {
      // Not every engine reports layout shifts.
    }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  page.on("pageerror", (error) => failures.push(error.message));
  return page;
}

async function settled(page: Page) {
  await page.waitForFunction(
    () =>
      !document.querySelector(".app-loading") &&
      !document.documentElement.hasAttribute("data-arriving") &&
      !document.querySelector("main [aria-busy=true]"),
  );
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
}

/** Every width and theme: nothing scrolls sideways, and a shot of each. */
async function capture(page: Page, name: string) {
  // The pointer off the page, so no control is shot in its hover state,
  // and no colour caught mid-transition between the themes.
  await page.mouse.move(0, 0);
  await page.addStyleTag({
    content: "*, *::before, *::after { transition: none !important; }",
  });
  await settled(page);
  const start = page.viewportSize()!;
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of THEMES) {
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
        window.scrollTo(0, 0);
      }, theme);
      await settled(page);
      const wide = await page.evaluate(() =>
        document.documentElement.scrollWidth <= innerWidth
          ? null
          : [...document.querySelectorAll("body *")]
              .filter((node) => node.getBoundingClientRect().right > innerWidth)
              .slice(-3)
              .map((node) => `${node.tagName}.${node.className}`),
      );
      assert.equal(wide, null, `${name} fits ${width}`);
      // Nothing is cut short with an ellipsis (premium rule 8).
      const cut = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>("body *")]
          .filter((node) => {
            const style = getComputedStyle(node);
            return (
              style.textOverflow === "ellipsis" &&
              style.visibility !== "hidden" &&
              node.offsetParent !== null &&
              node.scrollWidth > node.clientWidth + 1
            );
          })
          .map((node) => node.innerText.slice(0, 40)),
      );
      assert.deepEqual(cut, [], `${name} cuts nothing short at ${width}`);
      await page.screenshot({
        path: `${shots}/${name}-${width}-${theme}.png`,
        fullPage: true,
      });
    }
  }
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "light";
  });
  await page.setViewportSize(start);
  await settled(page);
}

const shift = (page: Page) =>
  page.evaluate(() => (window as unknown as { __shift: number }).__shift);
async function noShift(page: Page, what: string, action: () => Promise<void>) {
  const before = await shift(page);
  await action();
  await settled(page);
  const moved = (await shift(page)) - before;
  assert.ok(moved < 0.01, `${what}: nothing moves (shift ${moved})`);
}

/** Today's practice slot never shows an empty band: at 320, 390, 768 and
 * 1280, no run of blank pixel rows across it (top and bottom included) is
 * taller than 24 px. Decoded on a blank page of its own (the app's content
 * policy keeps data images out). */
async function noEmptyBand(page: Page, what: string) {
  const blank = await page.context().newPage();
  const size = page.viewportSize()!;
  try {
    for (const width of [320, 390, 768, 1280]) {
      // The decoding page must not leave this one in the background, where
      // the browser stops its frames (and a screenshot waits for them).
      await page.bringToFront();
      await page.setViewportSize({ width, height: 900 });
      await settled(page);
      await page.mouse.move(0, 0);
      const png = await page
        .locator("[data-code-slot]")
        .screenshot({ animations: "disabled" });
      const band = await blank.evaluate(async (data) => {
        const image = new Image();
        image.src = `data:image/png;base64,${data}`;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext("2d")!;
        context.drawImage(image, 0, 0);
        const px = context.getImageData(0, 0, image.width, image.height).data;
        const bg = [px[0]!, px[1]!, px[2]!];
        let run = 0;
        let longest = 0;
        for (let y = 0; y < image.height; y++) {
          let empty = true;
          for (let x = 0; x < image.width && empty; x++) {
            const i = (y * image.width + x) * 4;
            if (
              Math.abs(px[i]! - bg[0]!) +
                Math.abs(px[i + 1]! - bg[1]!) +
                Math.abs(px[i + 2]! - bg[2]!) >
              24
            )
              empty = false;
          }
          run = empty ? run + 1 : 0;
          longest = Math.max(longest, run);
        }
        return longest;
      }, png.toString("base64"));
      const scale = await page.evaluate(() => devicePixelRatio);
      console.log(`  slot band ${what} at ${width}: ${band / scale} px`);
      assert.ok(
        band / scale <= 24,
        `${what} at ${width}: an empty band of ${band / scale} px in the slot`,
      );
    }
  } finally {
    await blank.close();
    await page.bringToFront();
    await page.setViewportSize(size);
    await settled(page);
  }
}

/** An account, created and signed in on this page. */
async function signUp(page: Page, email: string, name: string) {
  const created = await page.request.post(`${origin}/api/auth/sign-up/email`, {
    headers: { Origin: origin, "Content-Type": "application/json" },
    data: { email, password: PASSWORD, name },
  });
  assert.ok(created.ok(), `sign-up ${email}: ${created.status()}`);
  const body = (await created.json()) as { user: { id: string } };
  return `${ACCOUNT_PREFIX}${body.user.id}`;
}
async function signIn(page: Page, email: string) {
  const response = await page.request.post(`${origin}/api/auth/sign-in/email`, {
    headers: { Origin: origin, "Content-Type": "application/json" },
    data: { email, password: PASSWORD },
  });
  assert.ok(response.ok(), `sign-in ${email}: ${response.status()}`);
}
const count = (page: Page, text: string | RegExp) =>
  page.getByText(text).filter({ visible: true }).count();
async function drawer(page: Page) {
  await page.getByRole("button", { name: "Open AMP menu" }).click();
  const menu = page.getByRole("dialog").last();
  await menu.waitFor();
  const text = (await menu.innerText()).replace(/\s+/g, " ");
  await page.keyboard.press("Escape");
  await menu.waitFor({ state: "hidden" });
  return text;
}
/** The place switcher's places, opened from the drawer. */
async function places(page: Page) {
  await page.getByRole("button", { name: "Open AMP menu" }).click();
  await page.getByRole("button", { name: /: switch place$/ }).click();
  const list = page.getByRole("menu").last();
  await list.waitFor();
  const text = (await list.innerText()).replace(/\s+/g, " ");
  // Escape closes the list, then the drawer, one layer at a time.
  await page.keyboard.press("Escape");
  await list.waitFor({ state: "hidden" });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Open AMP menu" }).waitFor();
  return text;
}
/** No two text boxes of a roster card overlap, at the narrowest width. */
async function cardsClear(page: Page, what: string) {
  const start = page.viewportSize()!;
  await page.setViewportSize({ width: 320, height: 900 });
  await settled(page);
  const clash = await page.evaluate(() => {
    for (const card of document.querySelectorAll("[class*=card_]")) {
      const parts = [...card.children].map((node) =>
        node.getBoundingClientRect(),
      );
      for (let a = 0; a < parts.length; a++)
        for (let b = a + 1; b < parts.length; b++) {
          const [p, q] = [parts[a]!, parts[b]!];
          if (
            p.width &&
            q.width &&
            p.left < q.right - 1 &&
            q.left < p.right - 1 &&
            p.top < q.bottom - 1 &&
            q.top < p.bottom - 1
          )
            return (card as HTMLElement).innerText.slice(0, 40);
        }
    }
    return null;
  });
  assert.equal(clash, null, `${what}: a roster card's parts never overlap`);
  await page.setViewportSize(start);
}
/** The place the bar names, whole (its title), and checks what it shows:
 * a phone shows the class alone, and no width ever cuts a name short. */
async function placeName(page: Page) {
  const name = page.locator("[data-place-name]").first();
  await name.waitFor();
  const whole = (await name.getAttribute("title")) ?? "";
  const shown = (await name.getAttribute("data-place-name")) ?? "";
  if ((page.viewportSize()?.width ?? 0) < 768)
    assert.equal(shown, whole.split(" · ")[0], "a phone's bar: the class");
  assert.ok(
    await name.evaluate((node) =>
      [...node.querySelectorAll("[data-shown]")].every(
        (option) =>
          option.getBoundingClientRect().right <=
          node.getBoundingClientRect().right + 0.5,
      ),
    ),
    `the bar shows "${shown}" whole`,
  );
  return whole;
}

try {
  /** Every student of a class and what they have, by the records'
   * contents (CP-3 r3 M2): the same people, learners and enrollments; each
   * answer by id and a digest of its whole outcome (answer, response,
   * correctness, skill); each skill's evidence by a digest of its state;
   * each day's active time by surface and skill; each workbook by id and a
   * digest of its problems; and each final grade by term, value and who
   * decided it. */
  async function records(classId: string) {
    const { rows } = await db.query(
      `SELECT p.id AS person,p.learner_id AS learner,e.id AS enrollment,
       COALESCE((SELECT json_agg(json_build_object('id',a.id,'digest',md5(a.outcome::text),
           'skill',a.outcome->>'skillId','problem',a.problem_id) ORDER BY a.id)
         FROM amp_attempts a WHERE a.learner_id=p.learner_id),'[]') AS attempts,
       COALESCE((SELECT json_agg(json_build_object('skill',s.skill_id,'digest',md5(s.state::text),
           'attempts',(s.state->>'attempts')::int,
           'recent',COALESCE((SELECT json_agg(x->>'id' ORDER BY n) FROM jsonb_array_elements(s.state->'recentOutcomes') WITH ORDINALITY AS r(x, n)),'[]'))
           ORDER BY s.skill_id)
         FROM amp_skill_evidence s WHERE s.learner_id=p.learner_id),'[]') AS evidence,
       COALESCE((SELECT json_agg(json_build_object('day',d.day::text,'surface',d.surface,
           'skill',d.skill_id,'ms',d.active_ms) ORDER BY d.day,d.surface,d.skill_id)
         FROM amp_active_days d WHERE d.learner_id=p.learner_id),'[]') AS days,
       COALESCE((SELECT json_agg(json_build_object('id',w.id,'digest',md5(w.spec::text)) ORDER BY w.id)
         FROM amp_workbooks w WHERE w.learner_id=p.learner_id),'[]') AS workbooks,
       COALESCE((SELECT json_agg(json_build_object('session',g.session_id,'final',g.final_value,
           'by',g.final_by) ORDER BY g.session_id)
         FROM amp_term_grades g WHERE g.person_id=p.id AND g.class_id=e.class_id
           AND g.final_value IS NOT NULL),'[]') AS grades
     FROM amp_enrollments e JOIN amp_people p ON p.id=e.person_id
     WHERE e.class_id=$1 AND e.role='student' ORDER BY p.id`,
      [classId],
    );
    return rows as {
      person: string;
      learner: string;
      enrollment: string;
      attempts: {
        id: string;
        digest: string;
        skill: string;
        problem: string;
      }[];
      evidence: {
        skill: string;
        digest: string;
        attempts: number;
        recent: string[];
      }[];
      days: { day: string; surface: string; skill: string; ms: number }[];
      workbooks: { id: string; digest: string }[];
      grades: { session: string; final: string; by: string }[];
    }[];
  }
  type Records = Awaited<ReturnType<typeof records>>;
  /** No new work between them: every record identical, contents and all. */
  function same(before: Records, later: Records, when: string) {
    assert.deepEqual(later, before, `${when}: every record exactly as it was`);
  }
  /** Paper marks went in for one student between them: their new answers
   * are exactly the marks, every earlier answer is unchanged, evidence
   * changes only for the skills the marks practiced, and nothing else of
   * anyone's changes. */
  /** Answers an evidence window holds (src/server/evidence.ts). */
  const WINDOW = 5;
  function afterMarks(
    before: Records,
    later: Records,
    student: string,
    marks: number,
  ) {
    assert.equal(later.length, before.length);
    for (const [index, row] of later.entries()) {
      const was = before[index]!;
      if (row.person !== student) {
        assert.deepEqual(row, was, "nobody else's records change");
        continue;
      }
      const { attempts, evidence, ...rest } = row;
      const { attempts: wasAttempts, evidence: wasEvidence, ...wasRest } = was;
      assert.deepEqual(rest, wasRest, "identity, time, workbooks, grades");
      for (const answer of wasAttempts)
        assert.deepEqual(
          attempts.find((entry) => entry.id === answer.id),
          answer,
          `answer ${answer.id} unchanged`,
        );
      const added = attempts.filter(
        (entry) => !wasAttempts.some((old) => old.id === entry.id),
      );
      assert.equal(added.length, marks, "one answer per paper mark");
      const practiced = new Set(added.map((entry) => entry.skill));
      for (const state of wasEvidence)
        if (!practiced.has(state.skill))
          assert.deepEqual(
            evidence.find((entry) => entry.skill === state.skill),
            state,
            `evidence for ${state.skill} unchanged`,
          );
      // Each practiced skill's evidence is the earlier evidence plus the
      // marks: it exists, counts exactly the new answers on top of the old,
      // holds each new answer, and keeps the earlier ones it had room for.
      for (const skill of practiced) {
        const now = evidence.find((entry) => entry.skill === skill);
        const then = wasEvidence.find((entry) => entry.skill === skill);
        const marked = added.filter((entry) => entry.skill === skill);
        assert.ok(now, `evidence for the marked skill ${skill} exists`);
        assert.equal(
          now.attempts,
          (then?.attempts ?? 0) + marked.length,
          `${skill}: the marks counted on top of the earlier answers`,
        );
        // The window holds the last five answers (src/server/evidence.ts):
        // the newest earlier answers it has room for, in their order, then
        // exactly the marks.
        const earlier = then?.recent ?? [];
        const room = Math.max(0, WINDOW - marked.length);
        const kept = room === 0 ? [] : earlier.slice(-room);
        assert.equal(
          now.recent.length,
          Math.min(WINDOW, earlier.length + marked.length),
          `${skill}: the window is as full as it can be`,
        );
        assert.deepEqual(
          now.recent.slice(0, kept.length),
          kept,
          `${skill}: the newest earlier answers are kept, in order`,
        );
        assert.deepEqual(
          [...now.recent.slice(kept.length)].sort(),
          marked
            .map((entry) => entry.id)
            .slice(-WINDOW)
            .sort(),
          `${skill}: the rest of the window is exactly the marks`,
        );
      }
    }
  }

  /** A staff member of a school, signed in on a device of their own. */
  async function member(
    orgId: string,
    slug: string,
    given: string,
    family: string,
    role: "admin" | "viewer" | "aide" | "teacher",
    classId?: string,
  ) {
    const page = await device();
    const address = `${slug}@staff.example.test`;
    const accountId = await signUp(page, address, `${given} ${family}`);
    await schools.addStaff({
      orgId,
      role,
      givenName: given,
      familyName: family,
      accountId,
      ...(classId ? { classId } : {}),
    });
    await signIn(page, address);
    return page;
  }

  // ── 1. The revenue path ────────────────────────────────────────────────
  const teacher = await device();
  const email = "rosa.lindqvist@example.test";
  // A teacher with no school yet: the school first run's next step is her
  // own class (R11), and a signed-in /school/new is never the public page.
  await teacher.goto(`${origin}/schools`);
  await teacher
    .getByRole("link", { name: "Start with your class", exact: true })
    .first()
    .click();
  await teacher.waitForURL(/sign-up/);
  const passwordChoice = teacher.getByRole("button", {
    name: "Use a password instead",
    exact: true,
  });
  if (await passwordChoice.count()) await passwordChoice.click();
  await teacher.getByLabel("Email", { exact: true }).fill(email);
  await teacher.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await teacher
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await teacher
    .getByRole("heading", { name: /^(Confirm|Check) your email$/ })
    .waitFor();
  await teacher.goto(`${origin}/school/new`);
  await teacher.waitForURL(`${origin}/start/school`);
  await teacher.locator("[data-school-next=none]").waitFor();
  assert.equal(await count(teacher, "Sign in"), 0, "no Sign in when signed in");
  await capture(teacher, "first-run-none");
  await teacher.goto(mail.at(-1)!);
  await teacher.getByRole("heading", { name: "Set up your class" }).waitFor();
  await teacher.getByLabel("School name").fill("Birchwood Elementary");
  await teacher.getByLabel("Class name").fill("Grade 4 Math");
  if (await teacher.getByLabel("Your name", { exact: true }).count())
    await teacher
      .getByLabel("Your name", { exact: true })
      .fill("Rosa Lindqvist");
  // The class's name suggests its course.
  await teacher
    .getByLabel("Course", { exact: true })
    .filter({ hasText: "Grade 4" })
    .waitFor();
  await teacher.getByRole("checkbox").check();
  await capture(teacher, "class-setup");
  await teacher
    .getByRole("button", { name: "Create class", exact: true })
    .click();
  await teacher.waitForURL(/\/classes\/[\w-]+\/roster/);
  const created = (
    await db.query("SELECT org_id,class_id FROM amp_school_starts")
  ).rows[0] as { org_id: string; class_id: string };
  const classUrl = `${origin}/school/${created.org_id}/classes/${created.class_id}`;
  const code = (
    await db.query("SELECT join_code FROM amp_classes WHERE id=$1", [
      created.class_id,
    ])
  ).rows[0].join_code as string;
  const shown = (value: string) =>
    [value, `${value.slice(0, 3)}-${value.slice(3)}`].map((text) =>
      count(teacher, text),
    );
  const noCode = async (where: string) => {
    for (const hits of shown(code))
      assert.equal(await hits, 0, `${where}: no class code before Start`);
  };
  // The bar names the class and its school (R16).
  assert.equal(await placeName(teacher), "Grade 4 Math · Birchwood Elementary");
  await teacher.getByRole("heading", { name: "Add your students" }).waitFor();
  await capture(teacher, "class-day0-students");
  // Its school's viewer and the class's aide read the class; neither is
  // offered what only its teacher and school may do (M1).
  const pilotViewer = await member(
    created.org_id,
    "omar",
    "Omar",
    "Nasser",
    "viewer",
  );
  const pilotAide = await member(
    created.org_id,
    "june",
    "June",
    "Park",
    "aide",
    created.class_id,
  );
  for (const page of [pilotViewer, pilotAide]) {
    await page.goto(`${classUrl}/today`);
    await settled(page);
    assert.equal(
      await page.getByRole("link", { name: "Add students" }).count(),
      0,
      "only the teacher and the school add students",
    );
  }
  // The board waits for students, then for practice.
  await teacher.goto(`${classUrl}/start`);
  await teacher
    .getByRole("heading", { name: "Add your students first" })
    .waitFor();
  await noCode("the empty board");
  await teacher.goto(`${classUrl}/import`);
  await teacher
    .getByLabel("Or paste names")
    .fill("Ana Brook\nBen Cole\nCara Diaz\nDev Patel");
  await teacher
    .getByRole("button", { name: /^(Add these names|Use these rows)$/ })
    .click();
  await teacher.getByRole("button", { name: "Add 4 students" }).click();
  await teacher.waitForURL(/\/roster$/);
  await teacher
    .getByRole("button", { name: "Start practice", exact: true })
    .waitFor();
  await noCode("Students before Start");
  // Every way a code reaches students waits for Start practice (R14).
  for (const leaf of ["today", "settings", "start", "cards"]) {
    await teacher.goto(`${classUrl}/${leaf}`);
    await settled(teacher);
    await noCode(leaf);
  }
  await teacher.goto(`${classUrl}/start`);
  await teacher
    .getByRole("heading", { name: "Practice hasn’t started" })
    .waitFor();
  await capture(teacher, "board-before-start");
  await teacher.goto(`${classUrl}/cards`);
  await teacher
    .getByRole("heading", { name: "Practice hasn’t started" })
    .waitFor();
  // Whatever their role, nobody's screens carry the code before Start (H2).
  const closedFor = async (page: Page, where: string, ended: boolean) => {
    for (const leaf of ["today", "roster", "start", "settings"]) {
      await page.goto(`${classUrl}/${leaf}`);
      await settled(page);
      const text = await page.locator("body").innerText();
      assert.ok(
        !text.includes(code) &&
          !text.includes(`${code.slice(0, 3)}-${code.slice(3)}`),
        `${where} ${leaf}: no class code`,
      );
      if (leaf === "start")
        await page
          .getByRole("heading", {
            name: ended
              ? "Practice has ended"
              : /^(Practice hasn’t started|Waiting for the class’s teacher to start practice)$/,
          })
          .waitFor();
    }
  };
  await closedFor(pilotViewer, "viewer before Start", false);
  await pilotViewer.goto(`${classUrl}/today`);
  await pilotViewer
    .locator('[data-code-slot="waiting"]')
    .getByRole("heading", {
      name: "Waiting for the class’s teacher to start practice",
    })
    .waitFor();
  await noEmptyBand(pilotViewer, "waiting for the teacher");
  await closedFor(pilotAide, "aide before Start", false);
  await capture(pilotAide, "aide-board-before-start");
  await teacher.goto(`${classUrl}/today`);
  // Today's one required step leads the header: Start practice, its
  // button Start, in the slot the code will take (PracticeSlot), and not
  // again in the feed.
  const slot = teacher.locator("[data-code-slot]");
  const item = teacher.locator('[data-code-slot="start"]');
  await item.getByRole("heading", { name: "Start practice" }).waitFor();
  const start = item.getByRole("button", { name: "Start", exact: true });
  await start.waitFor();
  assert.equal(
    await teacher.locator('[data-feed="practice-start"]').count(),
    0,
  );
  assert.equal(await count(teacher, "Start class"), 0, "no Start class yet");
  await capture(teacher, "today-ready");
  await noEmptyBand(teacher, "Start practice");
  // Practice opens while Today is open, started from another tab: no input
  // on this page, so the browser's own layout-shift score counts every
  // move. The slot holds one height (PracticeSlot): the code takes the
  // Start action's place, and what follows the header stays where it was
  // at every width.
  // Where the header ends is where the feed starts (before Start the feed
  // may have nothing in it yet).
  const header = teacher.locator("header:has([data-today-title])");
  const widths = [320, 390, 768, 1280] as const;
  const tops = async () => {
    const seen: number[] = [];
    for (const width of widths) {
      await teacher.setViewportSize({ width, height: 900 });
      await settled(teacher);
      const box = (await header.boundingBox())!;
      seen.push(box.y + box.height);
    }
    await teacher.setViewportSize({ width: 390, height: 900 });
    await settled(teacher);
    return seen;
  };
  const closedTops = await tops();
  const other = await teacher.context().newPage();
  await other.goto(`${classUrl}/today`);
  await other
    .locator('[data-code-slot="start"]')
    .getByRole("button", { name: "Start", exact: true })
    .click();
  await other
    .getByRole("link", { name: "Start class", exact: true })
    .first()
    .waitFor();
  await other.close();
  await noShift(teacher, "practice opening while Today is open", async () => {
    await teacher.bringToFront();
    // Coming back to the tab: the page reads again (its focus refetch
    // listens for the document becoming visible).
    await teacher.evaluate(() =>
      window.dispatchEvent(new Event("visibilitychange")),
    );
    await teacher.getByText(`${code.slice(0, 3)}-${code.slice(3)}`).waitFor();
    await teacher
      .getByRole("link", { name: "Start class", exact: true })
      .first()
      .waitFor();
  });
  assert.equal(await slot.getAttribute("data-code-slot"), "open");
  assert.deepEqual(
    await tops(),
    closedTops,
    "the header ends (and the feed starts) where it did, at 320, 390, 768 and 1280",
  );
  await noEmptyBand(teacher, "the class code");
  // Started: the board carries the code.
  await teacher.goto(`${classUrl}/start`);
  await teacher.getByText("0 of 4 here").waitFor();
  await teacher.goto(`${classUrl}/today`);
  await teacher.getByText(`${code.slice(0, 3)}-${code.slice(3)}`).waitFor();
  await capture(teacher, "today-active");
  // The code's first read fails (CP-3 r8): Today keeps its frame and feed,
  // says so in its slot with Try again, and asks again on the practice
  // recheck's spacing (5 s, 15 s, then a minute), never in a burst; a
  // failed Try again says so again; a working one shows the code.
  const failingPresence = `**/api/v1/school/classes/${created.class_id}/presence`;
  let presenceReads = 0;
  await teacher.route(failingPresence, (route) => {
    presenceReads++;
    return route.fulfill({
      status: 503,
      json: { error: "school_service_unavailable" },
    });
  });
  await teacher.reload();
  const failedSlot = teacher.locator('[data-code-slot="unavailable"]');
  await failedSlot.getByText("Couldn’t load the class code").waitFor();
  await teacher.locator("[data-today-title]").waitFor();
  await teacher.waitForTimeout(16_000);
  assert.ok(
    presenceReads >= 2 && presenceReads <= 4,
    `a failed code read is asked again on a backoff, not in a burst: ${presenceReads} reads in 16 s`,
  );
  assert.equal(await teacher.locator(".app-loading").count(), 0);
  await teacher.locator("[data-today-title]").waitFor();
  const beforeRetry = presenceReads;
  await failedSlot.getByRole("button", { name: "Try again" }).click();
  await teacher.waitForTimeout(1_000);
  assert.ok(presenceReads > beforeRetry, "Try again reads the code");
  await failedSlot.getByRole("button", { name: "Try again" }).waitFor();
  await capture(teacher, "today-code-failed");
  await teacher.unroute(failingPresence);
  await failedSlot.getByRole("button", { name: "Try again" }).click();
  await teacher.getByText(`${code.slice(0, 3)}-${code.slice(3)}`).waitFor();

  // A student: from the code to a first problem.
  const student = await device();
  // The first problems the server serves this student.
  const served: Promise<{ templateId: string }[]> = new Promise((resolve) =>
    student.on("response", (response) => {
      if (/\/api\/v1\/learners\/[^/]+\/batches$/.test(response.url()))
        void response
          .json()
          .then((body: { problems?: { templateId: string }[] }) =>
            resolve(body.problems ?? []),
          )
          .catch(() => undefined);
    }),
  );
  await student.goto(`${origin}/join`);
  await student
    .getByRole("heading", { name: "Type your class code" })
    .waitFor();
  await student.locator("input").first().fill(code);
  await student.getByRole("heading", { name: "Tap your name" }).waitFor();
  await capture(student, "student-names");
  await student.getByRole("link", { name: /Ana B/ }).click();
  for (const picture of ["Fox", "Moon", "Kite"]) {
    const button = student.getByRole("button", { name: picture, exact: true });
    if (await button.count()) await button.click();
  }
  // Any three, if the set differs.
  while (
    !(await student
      .getByRole("button", { name: "These are mine", exact: true })
      .count())
  )
    await student.locator("[aria-pressed=false]").first().click();
  await student
    .getByRole("button", { name: "These are mine", exact: true })
    .click();
  await student.waitForURL(`${origin}/practice`);
  // A problem is on screen (every kind has Skip; not every kind has Check).
  await student.getByRole("button", { name: /^Skip this problem/ }).waitFor();
  const ana = (
    await db.query(
      "SELECT p.id FROM amp_people p WHERE p.given_name='Ana' AND p.family_name='Brook'",
    )
  ).rows[0].id as string;
  // A "Grade 4 Math" student with no birth year begins at the class's
  // course band, never at early arithmetic (R14).
  const firstProblem = (await served)[0];
  assert.ok(firstProblem, "the server served a first problem");
  const band = templates.find(
    (entry) => entry.id === firstProblem.templateId,
  )?.gradeBand;
  assert.ok(
    band,
    `the first problem's template is known (${firstProblem.templateId})`,
  );
  assert.notEqual(
    band,
    "K–2",
    `a grade 4 student starts at grade 4, not ${firstProblem.templateId}`,
  );
  // Exactly the class's course, saved as the learner's own start.
  const anaLearner = (
    await db.query("SELECT learner_id FROM amp_people WHERE id=$1", [ana])
  ).rows[0].learner_id as string;
  const placed = (
    await db.query(
      "SELECT starting_course_level,birth_year FROM amp_learners WHERE id=$1",
      [anaLearner],
    )
  ).rows[0] as {
    starting_course_level: number | null;
    birth_year: number | null;
  };
  assert.equal(Number(placed.starting_course_level), 4, "starts at grade 4");
  assert.equal(placed.birth_year, null, "a course never invents a birth year");
  await capture(student, "student-first-problem");
  // A few answers, so the records have something in them: at least one
  // answer is saved, or the journey fails.
  let answered = 0;
  const skip = student.getByRole("button", { name: /^Skip this problem/ });
  for (let n = 0; n < 10 && answered < 3; n++) {
    await skip.waitFor();
    const answer = student.getByLabel("Answer", { exact: true });
    // A problem without a typed answer (pick the statements, drag, plot) is
    // skipped: this journey types its answers.
    if (await answer.count()) {
      answered++;
      await answer.fill("7");
      await student.getByRole("button", { name: "Check", exact: true }).click();
    } else await skip.click();
    // Then on to the next problem.
    const next = student.getByRole("button", { name: /^(Next|Continue)/ });
    await next
      .first()
      .waitFor({ timeout: 10_000 })
      .catch(() => undefined);
    if (await next.count()) await next.first().click();
    await student
      .locator("button.skip-action:not([disabled])")
      .waitFor({ timeout: 10_000 })
      .catch(() => undefined);
  }

  assert.ok(answered > 0, "the student answered");
  const attempts = (
    await db.query(
      "SELECT count(*)::int AS n FROM amp_attempts WHERE learner_id=$1",
      [anaLearner],
    )
  ).rows[0].n as number;
  assert.ok(attempts > 0, "the student's answers are saved");
  // The aide prints workbooks, but never sign-in cards (M1).
  await pilotAide.goto(`${classUrl}/today`);
  await settled(pilotAide);
  assert.equal(
    await pilotAide.getByRole("link", { name: "Print cards" }).count(),
    0,
    "an aide prints no sign-in cards",
  );
  // An issued workbook, and a final grade: records that must outlast
  // practice and payment.
  const classApi = `${origin}/api/v1/school/classes/${created.class_id}`;
  const stack = (await (
    await teacher.request.get(`${classApi}/workbooks`)
  ).json()) as { today: string };
  let workbook: string | null = null;
  for (let tries = 0; tries < 30 && !workbook; tries++) {
    const made = await teacher.request.post(
      `${classApi}/students/${ana}/workbooks`,
      {
        headers: { Origin: origin },
        data: { date: stack.today, minutes: 30, paper: "letter", number: 1 },
      },
    );
    const body = (await made.json()) as {
      id?: string;
      workbook?: { id: string };
    };
    workbook = made.ok() ? (body.id ?? null) : null;
    if (!workbook) await teacher.waitForTimeout(1000);
  }
  assert.ok(workbook, "a workbook was made for the student");
  const termRead = (await (
    await teacher.request.get(`${classApi}/gradebook`)
  ).json()) as { term?: { id: string } };
  const graded = await teacher.request.post(
    `${classApi}/students/${ana}/final`,
    {
      headers: { Origin: origin },
      data: { term: termRead.term!.id, value: "B+" },
    },
  );
  assert.equal(graded.status(), 200, "a final grade is entered");
  // The student steps away (the page sends its active time as it goes), so
  // nothing records between snapshots.
  await student.goto("about:blank");
  const activeTime = async () =>
    (
      await db.query(
        "SELECT COALESCE(sum(active_ms),0)::bigint AS ms FROM amp_active_days WHERE learner_id=$1",
        [anaLearner],
      )
    ).rows[0].ms as string;
  // Its last report lands after it leaves: wait until the time is there and
  // holds still.
  const timeSettled = async () => {
    let last = "";
    for (let tries = 0; tries < 60; tries++) {
      const now = await activeTime();
      if (now === last && Number(now) > 0) return;
      last = now;
      await new Promise((resolve) => setTimeout(resolve, 750));
    }
  };
  await timeSettled();
  const before = await records(created.class_id);
  assert.equal(before.length, 4);
  const anaBefore = before.find((row) => row.person === ana)!;
  assert.ok(anaBefore.attempts.length > 0, "answers recorded");
  assert.ok(anaBefore.evidence.length > 0, "skill evidence recorded");
  assert.ok(
    anaBefore.days.reduce((sum, day) => sum + Number(day.ms), 0) > 0,
    "active time recorded",
  );
  assert.equal(anaBefore.workbooks.length, 1, "the issued workbook");
  assert.equal(anaBefore.grades.length, 1, "one final grade");
  assert.equal(
    anaBefore.grades[0]!.final,
    "B+",
    "the final grade, bound to the student, the class and the term",
  );
  assert.ok(anaBefore.grades[0]!.by, "and who decided it");

  // A second class, not started, where one student is already covered (by
  // the first class's practice): the server says its students can practice,
  // and the screens say so too: its code and board, no "hasn't started"
  // (CP-3 r2 H2). Starting a pilot is never a prerequisite for a student
  // who already has access.
  // Her second class, as a teacher adds one (the school's agreement covers
  // it), with a student of its own whom nothing covers yet.
  const second = await teacher.request.post(`${origin}/api/v1/school/start`, {
    headers: { Origin: origin },
    data: {
      requestId: randomUUID(),
      schoolName: "Birchwood Elementary",
      orgId: created.org_id,
      className: "Math support",
      timezone: "UTC",
      signerName: "Rosa Lindqvist",
      signerTitle: "Teacher",
      agreementVersion: AGREEMENT_VERSION,
      authorized: true,
      names: ["Zed Imani"],
      courseBands: ["4"],
    },
  });
  assert.ok(second.ok(), `the second class: ${second.status()}`);
  const support = {
    id: ((await second.json()) as { classId: string }).classId,
  };
  // And Ana, whom the first class's practice covers.
  await schools.transaction(async (client) => {
    const today = new Date().toISOString().slice(0, 10);
    await schools.enroll(client, support.id, ana, "student", today);
  });
  const supportCode = (
    await db.query("SELECT join_code FROM amp_classes WHERE id=$1", [
      support.id,
    ])
  ).rows[0].join_code as string;
  const supportUrl = `${origin}/school/${created.org_id}/classes/${support.id}`;
  await teacher.goto(`${supportUrl}/start`);
  await teacher.getByText(/^[0-2] of 2 here$/).waitFor();
  assert.equal(
    await count(teacher, "Practice hasn’t started"),
    0,
    "an open class's board is open",
  );
  await capture(teacher, "partial-ready-board");
  await teacher.goto(`${supportUrl}/today`);
  await teacher
    .getByText(`${supportCode.slice(0, 3)}-${supportCode.slice(3)}`)
    .waitFor();
  // The records: the map, grades, report cards, time, workbooks.
  for (const leaf of [
    "map",
    "gradebook",
    "report-cards",
    "time",
    "workbooks",
  ]) {
    await teacher.goto(`${classUrl}/${leaf}`);
    await settled(teacher);
    assert.equal(
      await teacher.getByRole("heading", { name: /didn’t load/ }).count(),
      0,
      `${leaf} loads`,
    );
  }
  await teacher.goto(`${classUrl}/map`);
  await capture(teacher, "class-map-day1");

  // The buyer handoff, from the class.
  await teacher.goto(`${classUrl}/today?seats=1`);
  await teacher
    .getByRole("dialog")
    .getByRole("button", { name: "Get link" })
    .click();
  // The sheet's link, never the class code's own Copy link beneath it.
  const copy = teacher
    .getByRole("dialog")
    .getByRole("button", { name: "Copy link" });
  await copy.waitFor();
  const buyer = (await copy.getAttribute("data-share-url"))!;
  assert.equal(new URL(buyer).pathname, "/schools/continue");
  await capture(teacher, "buyer-link");
  await teacher.keyboard.press("Escape");
  // The buyer's page: the school and the request, never a student's name.
  const buyerPage = await device();
  await buyerPage.goto(buyer);
  await buyerPage
    .getByRole("heading", { name: "AMP for Birchwood Elementary", exact: true })
    .waitFor();
  assert.equal(
    new URL(buyerPage.url()).hash,
    "",
    "the token leaves the address",
  );
  for (const name of ["Ana Brook", "Ben Cole", "Ana B."])
    assert.equal(await buyerPage.getByText(name).count(), 0, name);
  await capture(buyerPage, "buyer-page");

  // The teacher's own pilot, in the school first run: her class, and the
  // buyer handoff beside it.
  await teacher.goto(`${origin}/start/school`);
  await teacher.locator("[data-school-next=teacher]").waitFor();
  await teacher
    .getByRole("link", { name: "Open Grade 4 Math", exact: true })
    .waitFor();
  await teacher
    .getByRole("link", { name: "Send to your school’s buyer", exact: true })
    .waitFor();
  await capture(teacher, "first-run-teacher");

  // Grace: practice continues, with the date it ends and Request seats.
  await db.query(
    "UPDATE amp_teacher_pilots SET started_at=now()-interval '31 days',ends_at=now()-interval '1 day',grace_ends_at=now()+interval '6 days'",
  );
  await teacher.goto(`${classUrl}/today`);
  await teacher.getByRole("heading", { name: /^Practice ends / }).waitFor();
  await teacher
    .getByRole("button", { name: "Request seats", exact: true })
    .waitFor();
  await capture(teacher, "today-grace");
  // Natural expiry on pages left open (CP-3 r3 H1): grace ends in a few
  // seconds while the teacher's new cards and the aide's Today are open.
  // When the clock passes it, the cards and the code go, with no reload.
  await db.query(
    "UPDATE amp_teacher_pilots SET grace_ends_at=now()+interval '12 seconds'",
  );
  await teacher.goto(`${classUrl}/cards`);
  await teacher.getByRole("button", { name: /^Make (4|the) / }).click();
  await teacher.getByRole("heading", { name: /cards? ready$/ }).waitFor();
  await pilotAide.goto(`${classUrl}/today`);
  await pilotAide
    .getByText(`${code.slice(0, 3)}-${code.slice(3)}`)
    .first()
    .waitFor();
  await teacher.getByRole("heading", { name: "Practice has ended" }).waitFor({
    timeout: 20_000,
  });
  assert.equal(
    await teacher.getByRole("heading", { name: /cards? ready$/ }).count(),
    0,
    "the made cards go when practice ends",
  );
  await capture(teacher, "cards-natural-expiry");
  await pilotAide
    .getByText(`${code.slice(0, 3)}-${code.slice(3)}`)
    .first()
    .waitFor({ state: "detached", timeout: 10_000 });
  // Expired: no code, board or cards; the records stay.
  await db.query(
    "UPDATE amp_teacher_pilots SET started_at=now()-interval '40 days',ends_at=now()-interval '10 days',grace_ends_at=now()-interval '3 days'",
  );
  // Practice ending changes no record.
  const quiet = await records(created.class_id);
  same(before, quiet, "at expiry");
  await teacher.goto(`${classUrl}/today`);
  await teacher.getByRole("heading", { name: "Practice has ended" }).waitFor();
  await noCode("Today after practice");
  // Nothing that opens the closed board: no Start class anywhere on Today.
  assert.equal(
    await teacher
      .getByRole("link", { name: "Start class" })
      .filter({ visible: true })
      .count(),
    0,
    "no Start class after practice",
  );
  await capture(teacher, "today-expired");
  await noEmptyBand(teacher, "Practice has ended");
  for (const leaf of ["start", "cards"]) {
    await teacher.goto(`${classUrl}/${leaf}`);
    await teacher
      .getByRole("heading", { name: "Practice has ended" })
      .waitFor();
    await noCode(`${leaf} after practice`);
    await teacher
      .getByRole("link", { name: "Request seats", exact: true })
      .waitFor();
  }
  await capture(teacher, "board-expired");
  // Where practice stands can't be checked: a calm Try again, never a dead
  // closed screen (CP-3 r2 M1). An answer without the state…
  const yearRoute = `**/api/v1/school/classes/${created.class_id}/year`;
  await teacher.route(yearRoute, async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as Record<string, unknown>;
    delete body.practice;
    await route.fulfill({ response, json: body });
  });
  // The board's own poll still says practice ended: that fresher word is
  // the board's explanation (CP-3 r3 H1).
  await teacher.goto(`${classUrl}/start`);
  await teacher.getByRole("heading", { name: "Practice has ended" }).waitFor();
  await noCode("the board whose year read had no state");
  // Neither read says: Couldn't check practice, with Try again and Exit.
  const presenceRoute = `**/api/v1/school/classes/${created.class_id}/presence`;
  await teacher.route(presenceRoute, async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as {
      class: Record<string, unknown>;
    };
    delete body.class.practice;
    await route.fulfill({ response, json: body });
  });
  await teacher.goto(`${classUrl}/start`);
  await teacher
    .getByRole("heading", { name: "Couldn’t check practice" })
    .waitFor();
  await teacher.getByRole("link", { name: "Exit" }).waitFor();
  await noCode("the board that couldn't check");
  await capture(teacher, "board-unknown");
  await teacher.unroute(yearRoute);
  await teacher.unroute(presenceRoute);
  await teacher.getByRole("button", { name: "Try again" }).click();
  await teacher.getByRole("heading", { name: "Practice has ended" }).waitFor();
  // …and a failed pilot read.
  const pilotRoute = `**/api/v1/school/classes/${created.class_id}/pilot`;
  await teacher.route(pilotRoute, (route) =>
    route.fulfill({
      status: 503,
      json: { error: "school_service_unavailable" },
    }),
  );
  await teacher.goto(`${classUrl}/today`);
  const unknown = teacher.locator('[data-code-slot="unavailable"]');
  await unknown
    .getByRole("heading", { name: "Couldn’t check practice" })
    .waitFor({ timeout: 45_000 });
  await capture(teacher, "today-unknown");
  await noEmptyBand(teacher, "Couldn’t check practice");
  await teacher.unroute(pilotRoute);
  await unknown.getByRole("button", { name: "Try again" }).click();
  await unknown.waitFor({ state: "detached" });
  await teacher.getByRole("heading", { name: "Practice has ended" }).waitFor();
  await closedFor(pilotViewer, "viewer after practice", true);
  await closedFor(pilotAide, "aide after practice", true);
  await capture(pilotViewer, "viewer-board-expired");
  // The issued workbook still prints, and its paper results still go in.
  const pdf = await teacher.request.get(
    `${classApi}/students/${ana}/workbooks/${workbook}/pdf`,
  );
  assert.equal(pdf.status(), 200, "an issued workbook prints after practice");
  const printed = await pdf.body();
  assert.equal(printed.subarray(0, 5).toString(), "%PDF-", "a real PDF");
  assert.ok(
    (await PDFDocument.load(printed)).getPageCount() >= 1,
    "the workbook prints at least one page",
  );
  const mark = async (entries: { n: number; mark: "right" | "not-yet" }[]) => {
    const response = await teacher.request.post(
      `${classApi}/students/${ana}/workbooks/${workbook}/marks`,
      { headers: { Origin: origin }, data: { entries } },
    );
    assert.equal(response.status(), 200, "paper results go in after practice");
    return (await response.json()) as {
      recorded: number;
      problems: { n: number; mark: string | null }[];
    };
  };
  const first = await mark([{ n: 1, mark: "right" }]);
  assert.equal(first.recorded, 1);
  // A recorded mark is evidence: it stays as it was (immutable), and the
  // next problem's goes in beside it.
  const again = await mark([
    { n: 1, mark: "not-yet" },
    { n: 2, mark: "not-yet" },
  ]);
  assert.equal(again.recorded, 1, "only the new problem's mark is recorded");
  const markOf = (problems: { n: number; mark: string | null }[], n: number) =>
    problems.find((problem) => problem.n === n)?.mark;
  assert.equal(markOf(again.problems, 1), "right");
  assert.equal(markOf(again.problems, 2), "not-yet");
  // The student can't practice: the server refuses new problems (402).
  await student.goto(`${origin}/site.webmanifest`);
  const denied = await student.evaluate(async (learner) => {
    const saved = JSON.parse(
      sessionStorage.getItem("amp.student") ??
        localStorage.getItem("amp.student") ??
        "null",
    ) as { token: string } | null;
    const response = await fetch(`/api/v1/learners/${learner}/batches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${saved?.token ?? ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ count: 1 }),
    });
    return response.status;
  }, anaLearner);
  assert.equal(denied, 402, "no new problems after practice ends");
  // Exports answer after practice ends (docs/schools.md, "When a school
  // pays"): the gradebook's CSV and the time CSV.
  await teacher.goto(`${classUrl}/gradebook`);
  await settled(teacher);
  const book = await teacher.request.get(`${classApi}/gradebook`);
  assert.equal(book.status(), 200, "the gradebook reads after practice");
  const term = ((await book.json()) as { term?: { id: string } }).term?.id;
  assert.ok(term, "the class has a term");
  for (const path of [
    `exports/gradebook.csv?term=${term}`,
    "exports/time.csv",
    `report-cards?term=${term}`,
  ]) {
    const response = await teacher.request.get(`${classApi}/${path}`);
    assert.equal(response.status(), 200, `${path} after practice`);
  }
  await teacher.goto(`${classUrl}/report-cards`);
  await teacher.getByText("Report card").first().waitFor();
  await teacher.getByText("Ana Brook").first().waitFor();
  await capture(teacher, "report-cards-expired");
  await teacher.goto(`${classUrl}/workbooks`);
  await settled(teacher);
  assert.equal(
    await teacher.getByRole("heading", { name: /didn’t load/ }).count(),
    0,
    "workbooks after practice",
  );
  // A school's students have no free allowance to have used up.
  assert.equal(await count(teacher, /free workbooks/i), 0);
  await capture(teacher, "workbooks-expired");
  // After expiry: the two paper marks are the only change, and they are
  // Ana's answers of her own.
  const expired = await records(created.class_id);
  afterMarks(quiet, expired, ana, 2);
  // A student's next step says so, without a code to retry.
  await student.goto(`${origin}/practice`);
  await settled(student);
  await student
    .getByText(/has ended/)
    .first()
    .waitFor();
  assert.equal(
    await student.getByRole("button", { name: "Check", exact: true }).count(),
    0,
    "no problem after practice ends",
  );
  await capture(student, "student-expired");
  // Her visit counts its seconds on screen, and changes nothing else.
  await student.goto("about:blank");
  await timeSettled();
  const visited = await records(created.class_id);
  for (const [index, row] of visited.entries()) {
    const was = expired[index]!;
    const { days, ...rest } = row;
    const { days: wasDays, ...wasRest } = was;
    assert.deepEqual(
      rest,
      wasRest,
      "a visit to a closed screen changes no record",
    );
    for (const day of wasDays)
      assert.ok(
        days.some(
          (entry) =>
            entry.day === day.day &&
            entry.surface === day.surface &&
            entry.skill === day.skill &&
            Number(entry.ms) >= Number(day.ms),
        ),
        "earlier time kept",
      );
    if (row.person !== ana) assert.deepEqual(days, wasDays);
  }

  // Paid: the school buys from the teacher's link; the same records, the
  // same students, practice back on.
  const request = (
    await db.query("SELECT id FROM amp_school_purchase_requests LIMIT 1")
  ).rows[0].id as string;
  // First a partial purchase: two seats for four students.
  await schoolAdmin(schools, "activate-purchase", {
    id: request,
    seats: 2,
    endsAt: new Date(Date.now() + 300 * 864e5).toISOString(),
    reference: "PO-FIXTURE-1",
  });
  await teacher.goto(`${classUrl}/today`);
  await teacher
    .getByRole("heading", { name: "2 of 4 students have practice access" })
    .waitFor();
  await capture(teacher, "today-partial");
  same(visited, await records(created.class_id), "after partial payment");
  // Then the whole class.
  const license = (
    await db.query(
      "SELECT id FROM amp_school_licenses WHERE org_id=$1 ORDER BY created_at DESC LIMIT 1",
      [created.org_id],
    )
  ).rows[0].id as string;
  await schoolAdmin(schools, "set-seats", { licenseId: license, seats: 4 });
  await teacher.goto(`${classUrl}/today`);
  await teacher.getByText(`${code.slice(0, 3)}-${code.slice(3)}`).waitFor();
  assert.equal(await count(teacher, "Practice has ended"), 0);
  assert.equal(await count(teacher, /^Practice ends/), 0);
  await capture(teacher, "today-paid");
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int AS n FROM amp_people WHERE given_name='Ana' AND family_name='Brook'",
      )
    ).rows[0].n,
    1,
    "no student is imported twice",
  );
  assert.equal(
    (
      await db.query(
        "SELECT p.id FROM amp_people p WHERE p.given_name='Ana' AND p.family_name='Brook'",
      )
    ).rows[0].id,
    ana,
    "the same student, the same records",
  );
  // Every student, learner, enrollment and record is the same one: paid
  // coverage lands on the pilot's records, with nothing re-imported and
  // nothing changed.
  const paid = await records(created.class_id);
  same(visited, paid, "after payment");
  await student.goto(`${origin}/practice`);
  // A problem is on screen (every kind has Skip; not every kind has Check).
  await student.getByRole("button", { name: /^Skip this problem/ }).waitFor();
  // The paper marks read back after payment: Ana's, on her workbook, by
  // problem.
  const marksAfter = (await (
    await teacher.request.get(
      `${classApi}/workbooks/marks?date=${stack.today}&set=1`,
    )
  ).json()) as {
    students: {
      id: string;
      workbook: {
        id: string;
        problems: { n: number; mark: string | null }[];
      } | null;
    }[];
  };
  const anaMarks = marksAfter.students.find((row) => row.id === ana)?.workbook;
  assert.equal(anaMarks?.id, workbook, "her issued workbook");
  assert.equal(markOf(anaMarks!.problems, 1), "right");
  assert.equal(markOf(anaMarks!.problems, 2), "not-yet");
  assert.ok(
    anaMarks!.problems.filter((problem) => problem.mark !== null).length === 2,
    "only the two marked problems",
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int AS n FROM amp_people WHERE tenant_id=(SELECT path[1] FROM amp_orgs WHERE id=$1) AND learner_id IS NOT NULL",
        [created.org_id],
      )
    ).rows[0].n,
    5,
    "no student was imported twice (four, and Math support's Zed)",
  );
  const grade = (await (
    await teacher.request.get(`${classApi}/gradebook`)
  ).json()) as {
    term: { id: string } | null;
    students: { id: string; final: string | null }[];
  };
  assert.equal(grade.term?.id, termRead.term!.id, "the same term");
  assert.equal(
    grade.students.find((row) => row.id === ana)?.final,
    "B+",
    "Ana's final grade in that term, kept",
  );

  // ── 2. Roles at a licensed school ──────────────────────────────────────
  const lakeside = await schools.createOrg(
    { kind: "school", name: "Lakeside Middle", timezone: "UTC" },
    {
      version: AGREEMENT_VERSION,
      signerName: "Marta Okafor",
      signerTitle: "Principal",
    },
  );
  const six = await schools.createClass(lakeside.id, { name: "Grade 6 Math" });
  const seven = await schools.createClass(lakeside.id, {
    name: "Grade 7 Math",
  });
  for (const [given, family, klass, grade] of [
    ["Omar", "Haddad", six.id, 6],
    ["Lucia", "Ferreira", six.id, 6],
    ["Kenji", "Mori", seven.id, 7],
  ] as const)
    await schools.provisionStudent(lakeside.id, {
      givenName: given,
      familyName: family,
      classId: klass,
      gradeLevel: grade,
    });
  await schools.issueLicense({
    orgId: lakeside.id,
    seats: 40,
    endsAt: new Date(Date.now() + 300 * 864e5).toISOString(),
    reference: "LAKESIDE-1",
  });
  const staff = async (
    slug: string,
    given: string,
    family: string,
    role: "admin" | "viewer" | "aide" | "teacher",
    classId?: string,
  ) => {
    const page = await device();
    const address = `${slug}@lakeside.example.test`;
    const accountId = await signUp(page, address, `${given} ${family}`);
    await schools.addStaff({
      orgId: lakeside.id,
      role,
      givenName: given,
      familyName: family,
      accountId,
      ...(classId ? { classId } : {}),
    });
    await signIn(page, address);
    return { page, accountId };
  };
  const school = `${origin}/school/${lakeside.id}`;
  const lakeClass = `${school}/classes/${six.id}`;

  // An administrator who teaches nothing: the school whole, and a class
  // with her own rights (never its teacher).
  const principal = await staff("marta", "Marta", "Okafor", "admin");
  await principal.page.goto(school);
  await principal.page
    .getByRole("heading", { name: "Lakeside Middle" })
    .first()
    .waitFor();
  await capture(principal.page, "admin-overview");
  for (const leaf of [
    "classes",
    "students",
    "staff",
    "sign-in-help",
    "license",
    "calendar",
    "privacy",
    "activity",
    "settings",
    "integrations",
  ]) {
    await principal.page.goto(`${school}/${leaf}`);
    await settled(principal.page);
    assert.equal(
      await principal.page
        .getByRole("heading", { name: /didn’t load|isn’t available/ })
        .count(),
      0,
      `admin ${leaf}`,
    );
  }
  await principal.page.goto(`${lakeClass}/today`);
  await settled(principal.page);
  assert.equal(
    await placeName(principal.page),
    "Grade 6 Math · Lakeside Middle",
  );
  assert.equal(
    await principal.page
      .getByRole("button", { name: "Start practice" })
      .count(),
    0,
    "an admin is never offered the teacher's Start practice",
  );
  await capture(principal.page, "admin-class");
  // A licensed school's empty class is open (the server says so): its
  // board has the code, waiting for students (CP-3 r2 H2).
  const eight = await schools.createClass(lakeside.id, {
    name: "Grade 8 Math",
  });
  await principal.page.goto(`${school}/classes/${eight.id}/start`);
  await principal.page.getByText("0 of 0 here").waitFor();
  assert.equal(
    await count(principal.page, "Add your students first"),
    0,
    "a licensed class's board is open",
  );
  const adminDrawer = await drawer(principal.page);
  assert.match(adminDrawer, /School/);
  assert.equal(
    await principal.page
      .getByRole("button", { name: /^Start( practice)?$/ })
      .count(),
    0,
  );
  await principal.page.goto(`${lakeClass}/roster`);
  await principal.page.getByRole("heading", { name: "Teachers" }).waitFor();
  await principal.page
    .getByRole("link", { name: "Invite a co-teacher" })
    .click();
  await principal.page.waitForURL(/\/staff\?class=/);
  assert.ok(
    await principal.page
      .getByRole("checkbox", { name: "Grade 6 Math" })
      .isChecked(),
    "the class is chosen for the invitation",
  );

  // A viewer: reads everything, changes nothing.
  const viewer = await staff("theo", "Theo", "Banks", "viewer");
  await viewer.page.goto(school);
  await viewer.page
    .getByRole("heading", { name: "Lakeside Middle" })
    .first()
    .waitFor();
  await capture(viewer.page, "viewer-overview");
  await viewer.page.goto(`${lakeClass}/roster`);
  await settled(viewer.page);
  for (const action of ["Add students", "Print cards", "Invite a co-teacher"])
    assert.equal(
      await viewer.page.getByRole("link", { name: action }).count(),
      0,
      `a viewer has no ${action}`,
    );
  await cardsClear(viewer.page, "viewer");
  await capture(viewer.page, "viewer-class");

  // An aide in one class: that class's records, no roster changes.
  const aide = await staff("ines", "Ines", "Varga", "aide", six.id);
  await aide.page.goto(`${lakeClass}/today`);
  await settled(aide.page);
  assert.equal(await placeName(aide.page), "Grade 6 Math · Lakeside Middle");
  await aide.page.goto(`${lakeClass}/roster`);
  await settled(aide.page);
  assert.equal(
    await aide.page.getByRole("link", { name: "Add students" }).count(),
    0,
    "an aide adds no students",
  );
  await cardsClear(aide.page, "aide");
  await capture(aide.page, "aide-class");

  // A teacher here who also runs the pilot at Birchwood: both places, each
  // whole, nothing of one in the other.
  const rosa = (
    await db.query("SELECT id FROM amp_auth_users WHERE email=$1", [email])
  ).rows[0].id as string;
  await schools.addStaff({
    orgId: lakeside.id,
    role: "teacher",
    givenName: "Rosa",
    familyName: "Lindqvist",
    accountId: `${ACCOUNT_PREFIX}${rosa}`,
    classId: seven.id,
  });
  await teacher.goto(`${school}/classes/${seven.id}/today`);
  await settled(teacher);
  assert.equal(await placeName(teacher), "Grade 7 Math · Lakeside Middle");
  await capture(teacher, "multi-school-class");
  const both = await places(teacher);
  assert.match(both, /Grade 4 Math/);
  assert.match(both, /Grade 7 Math/);
  const menu = await drawer(teacher);
  assert.doesNotMatch(menu, /Kenji|Omar|Ana Brook|Birchwood/);
  await teacher.goto(`${classUrl}/today`);
  await settled(teacher);
  assert.equal(await placeName(teacher), "Grade 4 Math · Birchwood Elementary");

  // A stale invitation kept on this device (used, expired or unknown) is
  // dropped: the account's own next step shows, and it never returns (M3).
  const invited = await device();
  await signUp(invited, "nora@lakeside.example.test", "Nora Quinn");
  await invited.goto(`${origin}/start/school`);
  // As a sign-in carries it (lib/link-carry.ts): the fragment and how
  // long it is held.
  const carry = (fragment: string) =>
    invited.evaluate(
      (value) =>
        localStorage.setItem(
          "amp.school-invite",
          JSON.stringify({ value, until: Date.now() + 3_600_000 }),
        ),
      fragment,
    );
  await carry("A".repeat(43));
  await invited.reload();
  await invited.locator("[data-school-next=none]").waitFor();
  await invited.waitForFunction(
    () => localStorage.getItem("amp.school-invite") === null,
  );
  // An open one leads, by its school's name.
  const sent = await principal.page.request.post(
    `${origin}/api/v1/school/orgs/${lakeside.id}/staff/invites`,
    {
      headers: { Origin: origin },
      data: { email: "nora@lakeside.example.test", role: "teacher" },
    },
  );
  assert.equal(sent.status(), 201, "the invitation is made");
  const listed = (await (
    await principal.page.request.get(
      `${origin}/api/v1/school/orgs/${lakeside.id}/staff`,
    )
  ).json()) as
    | { staff?: { inviteUrl?: string | null }[] }
    | { inviteUrl?: string | null }[];
  const people = Array.isArray(listed) ? listed : (listed.staff ?? []);
  const link = people.find((person) => person.inviteUrl)?.inviteUrl;
  assert.ok(link, "the invitation's link");
  await carry(new URL(link).hash.slice(1));
  await invited.reload();
  await invited.locator("[data-school-next=invited]").waitFor();
  await invited
    .getByRole("link", { name: "Join Lakeside Middle", exact: true })
    .waitFor();
  // A failed lookup (the service, not a refusal) keeps the invitation, with
  // the account's own step and a way to try again (CP-3 r2 M2).
  const lookup = "**/api/v1/school/invites/lookup";
  await invited.route(lookup, (route) =>
    route.fulfill({
      status: 503,
      json: { error: "school_service_unavailable" },
    }),
  );
  await invited.reload();
  await invited.locator("[data-school-next=none]").waitFor();
  await invited.locator("[data-invite-retry]").waitFor();
  assert.ok(
    await invited.evaluate(() => !!localStorage.getItem("amp.school-invite")),
    "the invitation is kept through a failed lookup",
  );
  await invited.unroute(lookup);
  await invited
    .locator("[data-invite-retry]")
    .getByRole("button", { name: "Try again" })
    .click();
  await invited
    .getByRole("link", { name: "Join Lakeside Middle", exact: true })
    .waitFor();
  await invited.evaluate(() => localStorage.removeItem("amp.school-invite"));

  // A viewer of a school its admin is still setting up waits; nothing
  // leads into a setup only its admin can do (M2).
  const pending = await schools.createOrg(
    { kind: "school", name: "Cedar Hill School", timezone: "UTC" },
    {
      version: AGREEMENT_VERSION,
      signerName: "Cedar Admin",
      signerTitle: "Principal",
    },
  );
  await db.query("UPDATE amp_orgs SET setup_pending=true WHERE id=$1", [
    pending.id,
  ]);
  const waiting = await member(pending.id, "ivo", "Ivo", "Berg", "viewer");
  for (const path of ["/school/new", `/school/new?org=${pending.id}`]) {
    await waiting.goto(`${origin}${path}`);
    await waiting.waitForURL(`${origin}/start/school`);
  }
  const next = await waiting
    .locator("[data-school-next]")
    .getAttribute("data-school-next");
  assert.equal(next, "pending", "a viewer waits for the school's admin");
  await waiting
    .getByText(/Cedar Hill School’s admin is setting it up/)
    .waitFor();
  assert.equal(
    await waiting
      .getByRole("link", { name: /Finish setting up|Open Cedar/ })
      .count(),
    0,
  );

  // The administrator's first run opens her school.
  await principal.page.goto(`${origin}/start/school`);
  await principal.page.locator("[data-school-next=admin]").waitFor();
  await principal.page
    .getByRole("link", { name: "Open Lakeside Middle", exact: true })
    .waitFor();

  // The overview at a phone's width after a wider window: no sideways
  // scroll from a chart measured wider (audit #13).
  await principal.page.setViewportSize({ width: 1280, height: 900 });
  await principal.page.goto(school);
  await settled(principal.page);
  for (const width of [390, 320]) {
    await principal.page.setViewportSize({ width, height: 900 });
    await settled(principal.page);
    assert.ok(
      await principal.page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `the overview fits ${width} after 1280`,
    );
  }

  assert.deepEqual(failures, []);
  console.info(
    "Classroom and School: revenue path, first runs, roles and widths passed.",
  );
} catch (error) {
  for (const [index, context] of contexts.entries())
    for (const page of context.pages())
      await page
        .screenshot({ path: `${shots}/failure-${index}.png`, fullPage: true })
        .catch(() => undefined);
  throw error;
} finally {
  console.info = originalInfo;
  for (const context of contexts) await context.close();
  await browser.close();
  await vite.close();
  await renderer.close();
  await api.close();
  await learning.close();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
