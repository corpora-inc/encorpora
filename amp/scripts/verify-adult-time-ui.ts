/**
 * An adult's own sign-in never adds time or help to a child's record
 * (round 2026-11-20), against a running, seeded preview:
 *
 * 1. The family persona, with a child chosen, opens what a parent opens: the
 *    app's own address (`/`), the child's page, the child's Pathways, a
 *    skill, a lesson and a film, tapping and scrolling on each as a reader
 *    does. No request names the child's activity, and the child's active
 *    time, problems and help are exactly what they were: in the database
 *    and on the family's dashboard.
 * 2. The parent taps Practice (the hand-over): the tab is the child's. The
 *    child opens a hint and answers, and the same figures change.
 * 3. A child's practice opened by its address on the adult's sign-in (a
 *    bookmark, a typed address, an older link) is handed over before the
 *    first problem is asked for: the tab is the child's (its sign-in, the
 *    bar's way home, the menu), every problem and answer goes on the
 *    child's own sign-in, an answer and a hint are credited with their
 *    time, a reload keeps it, and the way back gives the parent's tab
 *    back. Back into the address hands over again.
 *
 *   AMP_SIM_DATABASE_URL=postgres://amp:amp@127.0.0.1:55490/<db> \
 *     npx tsx scripts/verify-adult-time-ui.ts --origin http://127.0.0.1:4810
 *       [--persona family] [--shots <dir>]
 *
 * Loopback-only; never the shared /amp database.
 */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import pg from "pg";
import { chromium as rawChromium, type Page } from "playwright";
import { secureChromium } from "../browser-security.mjs";
import { FILM_CAPABILITY, lessonFilmFor } from "../src/content/lesson-films";
import { lessons } from "../src/content/lessons";
import { templates } from "../src/math/engine";
import {
  PERSONA_PASSPHRASE,
  personaEmail,
} from "../src/web/features/dev/persona-list";
import { openMenu, practiceHere, returnToParent } from "./ui-controls";
import { answerOne, trackPracticeProblems } from "./ui-practice-answer";

const chromium = secureChromium(rawChromium);
const arg = (name: string) => {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? process.argv[at + 1] : undefined;
};
const origin = arg("origin");
const database = process.env.AMP_SIM_DATABASE_URL;
if (!origin || !database)
  throw new Error("--origin and AMP_SIM_DATABASE_URL are required");
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin))
  throw new Error("Loopback only");
const slug = arg("persona") ?? "family";
const shots = arg("shots");
const failures: string[] = [];
const fail = (message: string) => {
  console.log(`  FAIL ${message}`);
  failures.push(message);
};

// ---- the family, through the API -----------------------------------------
const signedIn = await fetch(`${origin}/api/auth/sign-in/email`, {
  method: "POST",
  headers: { Origin: origin, "Content-Type": "application/json" },
  body: JSON.stringify({
    email: personaEmail(slug),
    password: PERSONA_PASSPHRASE,
  }),
});
assert.ok(signedIn.ok, `${slug} signs in: ${signedIn.status}`);
const cookie = signedIn.headers
  .getSetCookie()
  .map((line) => line.split(";")[0])
  .join("; ");
const token = (
  (await (
    await fetch(`${origin}/api/auth/get-session`, { headers: { cookie } })
  ).json()) as { session: { token: string } }
).session.token;
async function call(path: string) {
  const response = await fetch(`${origin}/api/v1${path}`, {
    headers: { Authorization: `Bearer ${token}`, Origin: origin! },
  });
  assert.ok(response.ok, `GET ${path}: ${response.status}`);
  return response.json() as Promise<Record<string, any>>;
}
const family = (await call("/families")).families[0].familyId as string;
type Child = { id: string; name: string };
const children = (await call(`/families/${family}`)).children as Child[];
const child = children[0]!;
const others = children.slice(1);

// ---- what a child's record holds -----------------------------------------
const pool = new pg.Pool({ connectionString: database, max: 1 });
type Record_ = {
  activeMs: number;
  problems: number;
  helpEvents: number;
  helpOpened: number;
  weekMinutes: number;
  weekProblems: number;
};
async function recordOf(who: Child): Promise<Record_> {
  const { rows } = await pool.query(
    `SELECT
       (SELECT COALESCE(sum(active_ms),0)::int FROM amp_active_days WHERE learner_id=$1) AS "activeMs",
       (SELECT count(*)::int FROM amp_attempts WHERE learner_id=$1) AS problems,
       (SELECT count(*)::int FROM amp_help_events WHERE learner_id=$1) AS "helpEvents",
       (SELECT COALESCE(sum(opened),0)::int FROM amp_help_days WHERE learner_id=$1) AS "helpOpened"`,
    [who.id],
  );
  const dashboard = await call(`/families/${family}/dashboard`);
  const week = (
    dashboard.children as {
      id: string;
      week: { minutes: number; problems: number };
    }[]
  ).find((entry) => entry.id === who.id)!.week;
  return {
    ...rows[0],
    weekMinutes: week.minutes,
    weekProblems: week.problems,
  };
}

// ---- the pages -----------------------------------------------------------
const filmed = templates.find((type) =>
  lessonFilmFor(type.id, FILM_CAPABILITY),
);
assert.ok(filmed, "a problem type with a film");
const lesson = lessons.find((entry) => entry.templateIds.length > 0)!;
const skill = templates.find((type) =>
  lesson.templateIds.includes(type.id),
)!.skillId;

if (shots) await mkdir(shots, { recursive: true });
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const login = await context.request.post(`${origin}/api/auth/sign-in/email`, {
    headers: { Origin: origin },
    data: { email: personaEmail(slug), password: PERSONA_PASSPHRASE },
  });
  assert.ok(login.ok(), `${slug} signs in: ${login.status()}`);
  const page = await context.newPage();
  trackPracticeProblems(page);

  /** Every activity request this tab sends, with the screen it came from. */
  const sent: { screen: string; to: string; body: string }[] = [];
  let screen = "";
  const nameOf = (learnerId: string) =>
    children.find((entry) => entry.id === learnerId)?.name ?? learnerId;
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (request.method() !== "POST" || !url.pathname.endsWith("/activity"))
      return;
    const learner = /\/learners\/([^/]+)\/activity$/.exec(url.pathname)?.[1];
    sent.push({
      screen,
      to: learner
        ? `learner ${nameOf(decodeURIComponent(learner))}`
        : "the student's own",
      body: request.postData() ?? "",
    });
  });

  /** A reader: a tap, a scroll and a key every second or so. */
  async function read(seconds: number) {
    const until = Date.now() + seconds * 1000;
    while (Date.now() < until) {
      await page.mouse.click(640, 400).catch(() => undefined);
      await page.mouse.wheel(0, 160);
      await page.mouse.wheel(0, -160);
      await page.keyboard.press("Shift");
      await page.waitForTimeout(900);
    }
  }
  async function visit(name: string, path: string, seconds = 7) {
    screen = name;
    await page.goto(`${origin}${path}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    await read(seconds);
    const lost = await page
      .getByText("There’s no page here")
      .isVisible()
      .catch(() => false);
    console.log(
      `  ${name}: ${new URL(page.url()).pathname}${lost ? " (no page)" : ""}`,
    );
    if (lost) fail(`${name}: ${path} is not a page`);
    if (shots)
      await page.screenshot({
        path: `${shots}/adult-${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`,
      });
  }

  // ---- 1. the parent, on the parent's own sign-in -------------------------
  const before = await recordOf(child);
  const othersBefore = await Promise.all(others.map(recordOf));
  console.log(
    `${child.name}, before the parent opens anything: ${JSON.stringify(before)}`,
  );
  // The child's page first: the child is the one chosen from here on.
  await visit(`${child.name}’s page`, `/family/${family}/kids/${child.id}`);
  await visit("the app’s address", "/");
  await visit(`${child.name}’s Pathways`, "/pathways");
  await visit("a skill", `/pathways/${encodeURIComponent(skill)}`);
  await visit("a lesson", `/lessons/${encodeURIComponent(lesson.id)}`);
  await visit(
    "a film",
    `/lessons/${encodeURIComponent(filmed.id)}/watch`,
    // Long enough for a heartbeat's own tick (30 s) to pass on a screen.
    32,
  );
  // Leaving sends whatever a screen counted.
  screen = "the family’s Today";
  await page.goto(`${origin}/family/${family}`, {
    waitUntil: "domcontentloaded",
  });
  await page.locator("[data-today-title]").waitFor();
  await read(4);
  await page.waitForTimeout(2500);

  const after = await recordOf(child);
  console.log(
    `${child.name}, after the parent read all of it: ${JSON.stringify(after)}`,
  );
  if (sent.length)
    for (const request of sent)
      console.log(
        `  sent from ${request.screen} → ${request.to}: ${request.body}`,
      );
  else console.log("  no activity request left the parent's tab");
  const named = sent.filter((request) => request.to.startsWith("learner "));
  if (named.length)
    fail(
      `the parent's tab sent ${named.length} activity request(s) for a child: ${[...new Set(named.map((request) => `${request.screen} → ${request.to}`))].join("; ")}`,
    );
  try {
    assert.deepEqual(after, before);
  } catch {
    fail(
      `${child.name}'s record changed while only the parent used the device: ${JSON.stringify(before)} → ${JSON.stringify(after)}`,
    );
  }
  const othersAfter = await Promise.all(others.map(recordOf));
  try {
    assert.deepEqual(othersAfter, othersBefore);
  } catch {
    fail(
      `another child's record changed: ${JSON.stringify(othersBefore)} → ${JSON.stringify(othersAfter)}`,
    );
  }

  // ---- 2. the hand-over: the tab is the child's ---------------------------
  sent.length = 0;
  screen = `${child.name}’s practice, handed over`;
  /** At the device without touching a control: a key every second. */
  const attend = async (on: Page, seconds: number) => {
    for (let second = 0; second < seconds; second++) {
      await on.keyboard.press("Shift");
      await on.waitForTimeout(1000);
    }
  };
  /** An answer, then the next problem and its hint, as a child at it. */
  const answerAndHint = async (on: Page) => {
    await attend(on, 2);
    await answerOne(on, true);
    await on.locator(".next-action").click();
    await on.locator(".next-action").waitFor({ state: "hidden" });
    await on.locator(".problem-stage .question").waitFor();
    await on.getByRole("button", { name: "Hint", exact: true }).click();
    await attend(on, 4);
  };
  await practiceHere(page, child.id);
  await answerAndHint(page);
  if (shots) await page.screenshot({ path: `${shots}/handed-hint.png` });
  // The tab going to the background sends what it counted.
  await page.goto("about:blank");
  await page.waitForTimeout(2500);
  const handed = await recordOf(child);
  console.log(
    `${child.name}, after a hint and an answer on the handed device: ${JSON.stringify(handed)}`,
  );
  for (const request of sent)
    console.log(`  sent from ${request.screen} → ${request.to}`);
  if (!sent.some((request) => request.to === "the student's own"))
    fail("the handed-over tab sent no activity of the child's own");
  if (sent.some((request) => request.to.startsWith("learner ")))
    fail("the handed-over tab sent activity on the parent's sign-in");
  if (!(handed.activeMs > after.activeMs))
    fail(`no active time for ${child.name} after practice on a handed device`);
  if (handed.problems !== after.problems + 1)
    fail(`${child.name}'s problems: ${after.problems} → ${handed.problems}`);
  if (handed.weekProblems !== after.weekProblems + 1)
    fail(
      `the dashboard's problems this week: ${after.weekProblems} → ${handed.weekProblems}`,
    );
  if (!(handed.helpEvents > after.helpEvents))
    fail(`no help recorded for ${child.name} after opening a hint`);
  if (!(handed.helpOpened > after.helpOpened))
    fail(`the help rollup didn't move for ${child.name}`);

  // ---- 3. the child's practice by its address, on the adult's sign-in -----
  // A new tab: the adult's sign-in and nothing else (one tab is one person).
  const tab = await context.newPage();
  trackPracticeProblems(tab);
  /** Whose sign-in each learning request of this tab went on. */
  const asked: { what: string; student: boolean }[] = [];
  tab.on("request", (request) => {
    const url = new URL(request.url());
    const what = /\/(batches|attempts|activity)$/.exec(url.pathname)?.[1];
    if (request.method() !== "POST" || !what) return;
    asked.push({
      what,
      student: (request.headers().authorization ?? "").startsWith("Bearer st_"),
    });
  });
  const whose = (on: Page) =>
    on.evaluate(() => ({
      student: !!sessionStorage.getItem("amp.student"),
      handed: sessionStorage.getItem("amp.student.handed") === "1",
      home: sessionStorage.getItem("amp.student.return"),
    }));
  const childs = { student: true, handed: true, home: `/family/${family}` };
  /** The tab is the child's: its sign-in, the bar's way home, the menu. */
  async function isTheChilds(how: string) {
    await tab.locator(".problem-stage .question").waitFor();
    const now = await whose(tab);
    if (JSON.stringify(now) !== JSON.stringify(childs))
      fail(
        `${how}: the tab is not ${child.name}'s: ${JSON.stringify(now)}, want ${JSON.stringify(childs)}`,
      );
    if (!(await tab.locator("[data-handed-home]").first().isVisible()))
      fail(`${how}: the bar has no way home to the family`);
    const drawer = await openMenu(tab);
    if (
      !(await drawer
        .getByRole("button", { name: "Back to family", exact: true })
        .isVisible())
    )
      fail(`${how}: the menu has no "Back to family"`);
    await tab.keyboard.press("Escape");
    await drawer.waitFor({ state: "detached" });
    console.log(
      `  ${how}: ${new URL(tab.url()).pathname} is ${child.name}'s tab`,
    );
  }
  const address = `/practice/${child.id}`;
  await tab.goto(`${origin}${address}`, { waitUntil: "domcontentloaded" });
  await isTheChilds("opened by its address");
  if (shots) await tab.screenshot({ path: `${shots}/address-practice.png` });
  await answerAndHint(tab);
  await tab.reload({ waitUntil: "domcontentloaded" });
  await isTheChilds("after a reload");
  // The way back: the parent's tab again, on the family's Today.
  await returnToParent(tab);
  await tab.waitForTimeout(2500);
  const back = await whose(tab);
  if (back.student || back.handed)
    fail(`back to family left the child's sign-in: ${JSON.stringify(back)}`);
  if (new URL(tab.url()).pathname !== `/family/${family}`)
    fail(`back to family opened ${new URL(tab.url()).pathname}`);
  const addressed = await recordOf(child);
  console.log(
    `${child.name}, after practice opened by its address: ${JSON.stringify(addressed)}`,
  );
  const onAdult = asked.filter((request) => !request.student);
  if (onAdult.length)
    fail(
      `opened by its address, ${onAdult.length} request(s) went on the adult's sign-in: ${[...new Set(onAdult.map((request) => request.what))].join(", ")}`,
    );
  for (const what of ["batches", "attempts", "activity"])
    if (!asked.some((request) => request.what === what && request.student))
      fail(`opened by its address: no ${what} request on the child's sign-in`);
  if (!(addressed.activeMs > handed.activeMs))
    fail(`no active time for ${child.name} after practice by its address`);
  if (addressed.problems !== handed.problems + 1)
    fail(
      `${child.name}'s problems by address: ${handed.problems} → ${addressed.problems}`,
    );
  if (!(addressed.helpEvents > handed.helpEvents))
    fail(`no help recorded for ${child.name} after a hint by its address`);
  // Back into the address: handed over again, and a reload keeps it.
  await tab.goBack({ waitUntil: "domcontentloaded" });
  await isTheChilds("Back into the address");
  await tab.reload({ waitUntil: "domcontentloaded" });
  await isTheChilds("reloaded again");
  await returnToParent(tab);
  if ((await whose(tab)).student)
    fail("the second return left the child's sign-in in the tab");
} finally {
  await browser.close();
  await pool.end();
}
assert.deepEqual(failures, [], failures.join("\n"));
console.log(
  "An adult's sign-in adds nothing to a child's record; a handed device does, and a child's practice by its address is the child's.",
);
