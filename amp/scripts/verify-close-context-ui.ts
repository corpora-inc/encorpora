/**
 * Closing returns to where a view was opened (Q-67, lib/return-to.ts), in a
 * real browser, on the founder's path as a teacher:
 *
 *   class map → a student → their missed answer → its lesson → the film
 *
 * then X on each, back out to the map. The same chain closes the same way
 * with the browser's Back, after a refresh at every step, and from a shared
 * link with no history (each view falls back to its logical parent, never
 * Pathways or the learner's home). An answer opened from Today closes back
 * to Today.
 *
 * The teacher is the design preview's synthetic one (scripts/design-personas.ts).
 * By default the check starts its own stack, as CI would: the real API
 * (accounts mode) on a fresh schema of AMP_TEST_DATABASE_URL, Vite in front.
 * Or point it at a running, seeded preview:
 *
 *   AMP_TEST_DATABASE_URL=postgres://…/amp_test npx tsx scripts/verify-close-context-ui.ts [--port 4936]
 *   npx tsx scripts/verify-close-context-ui.ts --origin http://127.0.0.1:4930
 *     [--out artifacts/close-context]
 *
 * Screenshots of the path, at 1280 and 390, go to artifacts/close-context/.
 */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import {
  chromium as rawChromium,
  type BrowserContext,
  type Page,
} from "playwright";
import { secureChromium } from "../browser-security.mjs";
import { startPersonaStack } from "./persona-stack";
import {
  PERSONA_PASSPHRASE,
  personaEmail,
} from "../src/web/features/dev/persona-list";

const chromium = secureChromium(rawChromium);
const argument = (name: string) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : undefined;
};
const OUT = argument("out") ?? "artifacts/close-context";
const stack = argument("origin")
  ? null
  : await startPersonaStack({
      webPort: Number(argument("port") ?? 4936),
      personas: ["teacher"],
      name: "close_ui",
      out: OUT,
    });
const origin = argument("origin") ?? stack!.origin;

type Chain = {
  /** The class map, a student's sheet over it, their answer, its lesson,
   * the lesson's film. */
  map: string;
  sheet: string;
  answer: string;
  lesson: string;
  film: string;
};

/** A teacher's missed answer whose lesson has a film, from the real API. */
async function findMiss(context: BrowserContext) {
  const session = await (
    await context.request.get(`${origin}/api/auth/get-session`)
  ).json();
  const auth = {
    headers: { Authorization: `Bearer ${session.session.token}` },
  };
  const get = async (path: string) => {
    const response = await context.request.get(`${origin}/api/v1${path}`, auth);
    assert.ok(response.ok(), `${path}: ${response.status()}`);
    return response.json();
  };
  // Where the teacher lands is their class's Today.
  const page = await context.newPage();
  await page.goto(`${origin}/`);
  await page.waitForURL(/\/school\/[^/]+\/classes\/[^/]+\/today/);
  const [, org, classId] = new URL(page.url()).pathname.match(
    /^\/school\/([^/]+)\/classes\/([^/]+)/,
  )!;
  await page.close();
  const map = await get(`/school/classes/${classId}/map`);
  for (const student of map.students as { id: string }[]) {
    const record = await get(`/school/students/${student.id}/record`);
    const missed = (record.work as { id: string; result: string }[])
      .slice(0, 8)
      .filter((item) => item.result === "missed");
    for (const item of missed) {
      const replay = await get(
        `/school/students/${student.id}/work/${encodeURIComponent(item.id)}`,
      );
      const template = replay.lesson?.templateId as string | null;
      if (!template) continue;
      const lesson = await get(
        `/problem-lessons/${encodeURIComponent(template)}?film=lesson-film-v4`,
      );
      if (lesson.lesson?.film)
        return { org, classId, student: student.id, work: item.id, template };
    }
  }
  throw new Error(
    "No missed answer with a filmed lesson in the teacher's class",
  );
}

const here = (page: Page) => {
  const url = new URL(page.url());
  return url.pathname + url.search;
};
/** The same screen: path and search, in any order. */
function same(a: string, b: string) {
  const left = new URL(a, origin);
  const right = new URL(b, origin);
  left.searchParams.sort();
  right.searchParams.sort();
  return left.pathname === right.pathname && left.search === right.search;
}
async function expectAt(page: Page, href: string, what: string) {
  await page
    .waitForFunction(
      (target) => {
        const a = new URL(location.href);
        const b = new URL(target, location.origin);
        a.searchParams.sort();
        b.searchParams.sort();
        return a.pathname === b.pathname && a.search === b.search;
      },
      href,
      { timeout: 15_000 },
    )
    .catch(() => undefined);
  if (!same(here(page), href)) await snap(page, "FAILED");
  assert.ok(same(here(page), href), `${what}: at ${here(page)}, not ${href}`);
  assert.doesNotMatch(here(page), /^\/(pathways|practice|me)?(\?|$)/);
}
const lessonDialog = (page: Page) =>
  page.getByRole("dialog", { name: "Explore a problem type" });
const replayLayer = (page: Page) => page.locator("[data-replay-facts]").first();
/** The student's sheet over the map (a layer, nav/LayerHost). */
const studentSheet = (page: Page, student: string) =>
  page.locator(`[role="dialog"]:has([data-map-student-record="${student}"])`);

/** What each step shows, checked whenever it is reached. */
async function shows(page: Page, step: keyof Chain, student: string) {
  if (step === "film") {
    await page.locator(".live-back").waitFor();
    return;
  }
  if (step === "lesson") {
    await lessonDialog(page).waitFor();
    await page.locator("[data-film-link]").waitFor();
    return;
  }
  await lessonDialog(page).waitFor({ state: "hidden" });
  if (step === "answer") {
    await replayLayer(page).waitFor();
    return;
  }
  await page.locator("[data-replay-facts]").waitFor({ state: "detached" });
  if (step === "sheet") await studentSheet(page, student).waitFor();
  else {
    await studentSheet(page, student).waitFor({ state: "detached" });
    await page.locator(`[data-map-student="${student}"]`).first().waitFor();
  }
}

let shot = 0;
async function snap(page: Page, name: string) {
  const width = page.viewportSize()!.width;
  await page.waitForTimeout(250);
  await page.screenshot({
    path: `${OUT}/${String(++shot).padStart(2, "0")}-${width}-${name}.png`,
  });
}

/** Opens the chain by clicking, as the founder did, from the class map. */
async function open(
  page: Page,
  miss: Awaited<ReturnType<typeof findMiss>>,
  record = false,
): Promise<Chain> {
  const map = `/school/${miss.org}/classes/${miss.classId}/map`;
  await page.goto(origin + map);
  await shows(page, "map", miss.student);
  if (record) await snap(page, "class-map");
  await page.locator(`[data-map-student="${miss.student}"]`).first().click();
  await shows(page, "sheet", miss.student);
  const sheet = here(page);
  if (record) await snap(page, "student-sheet");
  await studentSheet(page, miss.student)
    .locator(`[data-work-item="${miss.work}"]`)
    .first()
    .click();
  await shows(page, "answer", miss.student);
  const answer = here(page);
  if (record) await snap(page, "missed-answer");
  // The facts' "Lesson" link.
  await page
    .locator('[data-replay-facts] div:has(> dt:text-is("Lesson")) a')
    .first()
    .click();
  await shows(page, "lesson", miss.student);
  const lesson = here(page);
  if (record) await snap(page, "lesson-over-answer");
  await lessonDialog(page).locator("[data-film-link]").click();
  await shows(page, "film", miss.student);
  const film = here(page);
  assert.match(film, /^\/lessons\/[^/]+\/watch\?/);
  if (record) await snap(page, "film");
  return { map, sheet, answer, lesson, film };
}

/** X on each view, innermost first. */
async function closeFilm(page: Page) {
  await page.locator(".live-back").click();
}
async function closeLesson(page: Page) {
  await lessonDialog(page).getByRole("button", { name: "Close" }).click();
}
async function closeAnswer(page: Page) {
  await page.locator("[data-replay-close]").first().click();
}
async function closeSheet(page: Page, student: string) {
  await studentSheet(page, student)
    .getByRole("button", { name: /^Close/ })
    .first()
    .click();
}

const browser = await chromium.launch();
try {
  await mkdir(OUT, { recursive: true });
  const signIn = await browser.newContext();
  const response = await signIn.request.post(
    `${origin}/api/auth/sign-in/email`,
    {
      headers: { Origin: origin },
      data: { email: personaEmail("teacher"), password: PERSONA_PASSPHRASE },
    },
  );
  assert.ok(response.ok(), `the teacher signs in: ${response.status()}`);
  const state = await signIn.storageState();
  const miss = await findMiss(signIn);
  await signIn.close();
  const fresh = async (width: number) => {
    const context = await browser.newContext({
      viewport: { width, height: width < 500 ? 844 : 860 },
      storageState: state,
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => console.error("page error:", error));
    return { context, page };
  };

  for (const width of [1280, 390]) {
    // 1. X on each, from the film back to the map, as the founder went.
    const { context, page } = await fresh(width);
    const chain = await open(page, miss, true);
    await closeFilm(page);
    await expectAt(page, chain.lesson, "X on the film returns to its lesson");
    await shows(page, "lesson", miss.student);
    await snap(page, "x-film-lesson");
    await closeLesson(page);
    await expectAt(page, chain.answer, "X on the lesson returns to the answer");
    await shows(page, "answer", miss.student);
    await snap(page, "x-lesson-answer");
    await closeAnswer(page);
    await expectAt(page, chain.sheet, "X on the answer returns to the student");
    await shows(page, "sheet", miss.student);
    await snap(page, "x-answer-student");
    await closeSheet(page, miss.student);
    await expectAt(page, chain.map, "X on the student returns to the map");
    await shows(page, "map", miss.student);
    await snap(page, "x-student-map");
    // Back after the closes never reopens what was closed.
    await page.goBack();
    await page.waitForTimeout(500);
    assert.doesNotMatch(here(page), /open=|\/watch/);
    await context.close();
    console.log(`${width}: X returns along the path`);
  }

  // 2. The browser's Back does what X does.
  {
    const { context, page } = await fresh(1280);
    const chain = await open(page, miss);
    for (const step of ["lesson", "answer", "sheet", "map"] as const) {
      await page.goBack();
      await expectAt(page, chain[step], `Back to the ${step}`);
      await shows(page, step, miss.student);
    }
    await context.close();
    console.log("Back returns along the path");
  }

  // 3. A refresh at every step: closing still returns along the path.
  {
    const { context, page } = await fresh(1280);
    const chain = await open(page, miss);
    const steps = [
      ["film", "lesson", closeFilm],
      ["lesson", "answer", closeLesson],
      ["answer", "sheet", closeAnswer],
      ["sheet", "map", (p: Page) => closeSheet(p, miss.student)],
    ] as const;
    for (const [at, to, close] of steps) {
      await page.reload();
      await shows(page, at, miss.student);
      await close(page);
      await expectAt(page, chain[to], `After a refresh, X from the ${at}`);
      await shows(page, to, miss.student);
    }
    // And Back after them never reopens what was closed.
    await page.goBack();
    await page.waitForTimeout(500);
    assert.doesNotMatch(here(page), /open=|\/watch/);
    await context.close();
    console.log("After a refresh, X returns along the path");
  }

  // 4. A shared link, with no history: each view closes to its logical
  //    parent in the class, never Pathways or home.
  {
    const chain = await (async () => {
      const { context, page } = await fresh(1280);
      const opened = await open(page, miss);
      await context.close();
      return opened;
    })();
    for (const [at, to, close] of [
      ["film", "lesson", closeFilm],
      ["lesson", "answer", closeLesson],
      ["answer", "sheet", closeAnswer],
      ["sheet", "map", (p: Page) => closeSheet(p, miss.student)],
    ] as const) {
      const { context, page } = await fresh(1280);
      await page.goto(origin + chain[at]);
      await shows(page, at, miss.student);
      await close(page);
      await expectAt(page, chain[to], `A shared ${at} closes to the ${to}`);
      await shows(page, to, miss.student);
      await context.close();
    }
    console.log("A shared link closes to its parent in the class");
  }

  // 5. A miss opened from Today (the student, their answer over them)
  //    closes one layer at a time, back to Today.
  {
    const { context, page } = await fresh(1280);
    await page.goto(
      `${origin}/school/${miss.org}/classes/${miss.classId}/today`,
    );
    const link = page.locator('main a[data-entity="work"]').first();
    await link.waitFor();
    const today = here(page);
    await link.click();
    await replayLayer(page).waitFor();
    await closeAnswer(page);
    await page.locator("[data-map-student-record]").waitFor();
    assert.match(
      here(page),
      /\/today\?.*open=student/,
      "X pops to the student",
    );
    await page
      .locator('[role="dialog"]:has([data-map-student-record])')
      .getByRole("button", { name: /^Close/ })
      .first()
      .click();
    await expectAt(page, today, "then to Today");
    await context.close();
    console.log("A miss opened from Today closes to Today, a layer at a time");
  }
  console.log(`close-context: ok (${shot} screenshots in ${OUT})`);
} finally {
  await browser.close();
  await stack?.stop();
}
