/**
 * Closing returns to where a view was opened (Q-67, lib/return-to.ts), in a
 * real browser, on the founder's path as a teacher:
 *
 *   class map → a student → their missed answer → its lesson → the film
 *
 * then X on each, back out to the map. X puts the overlay away, back to
 * the context it was opened from: the film to its lesson, the lesson to the
 * answer replay under it (a replay is a base of its own), the replay to the
 * map, its student's sheet with it, in one step of the layer store
 * (src/web/nav/layer-store.ts). The sheets are the map's layers, never steps
 * in history: the address stays the map's, and Back from the film returns to
 * the lesson over its answer, as X does. The same closes hold after a
 * refresh at every step and from a shared link with no history (never
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
import { openHome } from "./launcher";
import { storedLayers } from "./layer-probe";

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
  /** The class map, and the lesson's film (a screen of its own). */
  map: string;
  film: string;
  /** The map's layers at each step (`kind:id`, oldest first). */
  sheet: string[];
  answer: string[];
  lesson: string[];
};
type Step = "map" | "sheet" | "answer" | "lesson" | "film";

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
  await openHome(page, origin);
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
/** The problem type's lesson sheet (features/pathways/LessonDialog): named
 * by the lesson's own title, so found by the lesson it holds. */
const lessonDialog = (page: Page) =>
  page
    .getByRole("dialog")
    .filter({ has: page.locator("article.problem-lesson") });
const replayLayer = (page: Page) => page.locator("[data-replay-facts]").first();
/** The student's sheet over the map (a layer, nav/LayerHost). */
const studentSheet = (page: Page, student: string) =>
  page.locator(`[role="dialog"]:has([data-map-student-record="${student}"])`);

/** The map's layers now, as `kind:id`. */
const layersOn = async (page: Page) =>
  (await storedLayers(page)).map((layer) => `${layer.kind}:${layer.id}`);
/** At the map with exactly `layers` open (none for the map alone). */
async function expectLayers(
  page: Page,
  chain: Chain,
  layers: string[],
  what: string,
) {
  await expectAt(page, chain.map, what);
  await page
    .waitForFunction(
      (want) => {
        const raw = sessionStorage.getItem("amp.layers");
        const stacks = raw ? JSON.parse(raw).state.stacks : {};
        const stack = stacks[location.pathname.replace(/\/+$/, "")] ?? [];
        return (
          stack
            .map((l: { kind: string; id: string }) => `${l.kind}:${l.id}`)
            .join() === want.join()
        );
      },
      layers,
      { timeout: 10_000 },
    )
    .catch(() => undefined);
  assert.deepEqual(await layersOn(page), layers, `${what}: its layers`);
}
/** What a step's place is: the film's own address, or the map's layers. */
const at = (page: Page, chain: Chain, step: Step, what: string) =>
  step === "film"
    ? expectAt(page, chain.film, what)
    : expectLayers(page, chain, step === "map" ? [] : chain[step], what);
/** A shared link to the map with a step's layers open. */
const sharedLink = (chain: Chain, step: "sheet" | "answer" | "lesson") =>
  `${chain.map}?open=${encodeURIComponent(chain[step].join(","))}`;

/** What each step shows, checked whenever it is reached. */
async function shows(page: Page, step: Step, student: string) {
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
  const sheet = await layersOn(page);
  if (record) await snap(page, "student-sheet");
  await studentSheet(page, miss.student)
    .locator(`[data-work-item="${miss.work}"]`)
    .first()
    .click();
  await shows(page, "answer", miss.student);
  const answer = await layersOn(page);
  if (record) await snap(page, "missed-answer");
  // The facts' "Lesson" link.
  await page
    .locator('[data-replay-facts] div:has(> dt:text-is("Lesson")) a')
    .first()
    .click();
  await shows(page, "lesson", miss.student);
  const lesson = await layersOn(page);
  // The layers stay out of the address.
  assert.ok(same(here(page), map), `the layers leave the map's address`);
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
    await at(page, chain, "lesson", "X on the film returns to its lesson");
    await shows(page, "lesson", miss.student);
    await snap(page, "x-film-lesson");
    await closeLesson(page);
    await at(page, chain, "answer", "X on the lesson returns to the answer");
    await shows(page, "answer", miss.student);
    await snap(page, "x-lesson-answer");
    // The answer's X closes to the map, its student's sheet with it: the
    // address and the layers agree in one step.
    await closeAnswer(page);
    await at(page, chain, "map", "X on the answer returns to the map");
    await shows(page, "map", miss.student);
    await snap(page, "x-answer-map");
    await context.close();
    console.log(`${width}: X returns to each sheet's context`);
  }

  // 2. The browser's Back from the film does what X does: the map, its
  //    layers as they were (the lesson over the answer). The layers were
  //    never steps in history, so there is nothing more to walk.
  {
    const { context, page } = await fresh(1280);
    const chain = await open(page, miss);
    await page.goBack();
    await at(page, chain, "lesson", "Back from the film");
    await shows(page, "lesson", miss.student);
    await context.close();
    console.log("Back from the film returns to its lesson");
  }

  // 3. A refresh at every step: closing still returns along the path.
  {
    const { context, page } = await fresh(1280);
    const chain = await open(page, miss);
    const steps = [
      ["film", "lesson", closeFilm],
      ["lesson", "answer", closeLesson],
      ["answer", "map", closeAnswer],
    ] as const;
    for (const [from, to, close] of steps) {
      await page.reload();
      await shows(page, from, miss.student);
      await close(page);
      await at(page, chain, to, `After a refresh, X from the ${from}`);
      await shows(page, to, miss.student);
    }
    await context.close();
    console.log("After a refresh, X returns to each sheet's context");
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
    for (const [from, to, close] of [
      ["film", "lesson", closeFilm],
      ["lesson", "answer", closeLesson],
      ["answer", "map", closeAnswer],
      ["sheet", "map", (p: Page) => closeSheet(p, miss.student)],
    ] as const) {
      const { context, page } = await fresh(1280);
      await page.goto(
        origin + (from === "film" ? chain.film : sharedLink(chain, from)),
      );
      await shows(page, from, miss.student);
      await close(page);
      await at(page, chain, to, `A shared ${from} closes to the ${to}`);
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
    await expectAt(page, today, "X on the answer returns to Today");
    await context.close();
    console.log("A miss opened from Today closes to Today");
  }
  console.log(`close-context: ok (${shot} screenshots in ${OUT})`);
} finally {
  await browser.close();
  await stack?.stop();
}
