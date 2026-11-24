/**
 * A family's Today as the live cockpit (round 2026-11-20, L8), against a
 * running, seeded preview and the family simulator (live-family-sim.ts):
 *
 * 1. Cold loads (a fresh browser, no cache, CPU 4x, a slow network, 390 px)
 *    of Today at rest, Today with a session running and a session's report:
 *    after the app's frame first shows, at most one neutral frame, then the
 *    destination, with the same tab current and the same title throughout,
 *    and no layout shift.
 * 2. At 320, 390, 768 and 1280 px, with one child and with three: Start (a
 *    tap) → row updates from children answering (one on the parent's device,
 *    one on a device of their own with a raised hand) → Stop. From the
 *    moment the session shows live until Stop is tapped, nothing on the page
 *    moves: no layout-shift entry without input, and the bar, the totals,
 *    the requests strip, every child's row and each child's block below hold
 *    their boxes. Starting never moves the date or the bar. Stop asks
 *    first, then opens the family's report, Today the current tab; a
 *    child's row opens the child's page; the report prints.
 * 3. The second parent opens Today with the session running (started by the
 *    first parent): the same cockpit; they stop it.
 * 4. Stills of every state at 390 and 1280, light and dark, when --shots.
 * 5. At every width the report never scrolls sideways (each child's facts
 *    and skills wrap inside the row), Past sessions' rows are one height
 *    whatever their numbers, and "See the time report" rests "This week"
 *    the page's own space under the bar. On a phone a child's row shows
 *    the help they opened, arriving with every box held.
 * 6. A session started from another browser while Today is open at rest
 *    (the cockpit's code not loaded yet): the cockpit arrives with no
 *    console error and no page error.
 * 8. Stop is one move: from "Stop session" to the report, sampled frame by
 *    frame, the live session holds and then the report shows. Never Today
 *    at rest or the "ended" bar on the way, and the children's list never
 *    jumps.
 * 7. Each child's block: "Last 20 problems" is one line of one height for
 *    every child whatever their counts (one line of text from 768 px), with
 *    no skill named on the page; it opens a sheet over Today listing every
 *    skill, each opening the skill, and Back closes it to Today. A child's
 *    name keeps its place under the pointer, its highlight whole on every
 *    side. Nothing scrolls sideways.
 *
 *   AMP_SIM_DATABASE_URL=postgres://amp:amp@127.0.0.1:55490/<db> \
 *     npx tsx scripts/verify-family-live-ui.ts \
 *       --origin http://127.0.0.1:4810 --api http://127.0.0.1:4811 \
 *       [--shots <dir>] [--updates 40] [--widths 390,1280] [--skip-cold]
 */
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium as rawChromium, type Browser, type Page } from "playwright";
import { secureChromium } from "../browser-security.mjs";
import { stopTrail, watchStop } from "./live-cockpit-checks";
import {
  PERSONA_PASSPHRASE,
  personaEmail,
} from "../src/web/features/dev/persona-list";

const chromium = secureChromium(rawChromium);
const arg = (name: string) => {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? process.argv[at + 1] : undefined;
};
const flag = (name: string) => process.argv.includes(`--${name}`);
const origin = arg("origin");
const api = arg("api") ?? origin;
const shots = arg("shots");
const UPDATES = Number(arg("updates") ?? 40);
const database = process.env.AMP_SIM_DATABASE_URL;
if (!origin || !database)
  throw new Error("--origin and AMP_SIM_DATABASE_URL are required");
const WIDTHS = (arg("widths") ?? "320,390,768,1280").split(",").map(Number);
const height = (width: number) =>
  width >= 1024 ? 800 : width >= 768 ? 1024 : 844;
const failures: string[] = [];
const fail = (message: string) => {
  console.log(`  FAIL ${message}`);
  failures.push(message);
};

// ---- the family and its simulator -----------------------------------------
type Person = {
  family: string;
  classId: string;
  token: string;
  /** The first child by name: their learner, and their person in the class. */
  first: { learner: string; person: string; name: string };
};
async function signIn(slug: string) {
  const response = await fetch(`${origin}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { Origin: origin!, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: personaEmail(slug),
      password: PERSONA_PASSPHRASE,
    }),
  });
  assert.ok(response.ok, `${slug} signs in: ${response.status}`);
  const cookie = response.headers
    .getSetCookie()
    .map((line) => line.split(";")[0])
    .join("; ");
  const session = (await (
    await fetch(`${origin}/api/auth/get-session`, { headers: { cookie } })
  ).json()) as { session: { token: string } };
  return session.session.token;
}
async function call(
  token: string,
  method: string,
  path: string,
  body?: unknown,
) {
  const response = await fetch(`${api}/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Origin: origin!,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  assert.ok(response.ok, `${method} ${path}: ${response.status}`);
  return response.json() as Promise<Record<string, any>>;
}
async function person(slug: string): Promise<Person> {
  const token = await signIn(slug);
  const { families } = await call(token, "GET", "/families");
  const family = families[0].familyId as string;
  const data = await call(token, "GET", `/families/${family}`);
  const classId = data.children[0].classes[0].id as string;
  const first = (
    data.children as {
      id: string;
      name: string;
      classes: { id: string; personId: string }[];
    }[]
  )
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))[0]!;
  return {
    family,
    token,
    classId,
    first: {
      name: first.name,
      learner: first.id,
      person: first.classes.find((entry) => entry.id === classId)!.personId,
    },
  };
}
/** The first child opens a hint, as their practice screen sends it (on the
 * parent's device, by the parent's real "practice here" grant). */
async function opensHint(who: Person) {
  const grant = await call(
    who.token,
    "POST",
    `/family/learners/${who.first.learner}/practice-here`,
    {},
  );
  const batch = await call(
    grant.token as string,
    "POST",
    `/learners/${who.first.learner}/batches`,
    { count: 1 },
  );
  const problem = batch.problems[0] as { id: string; templateId: string };
  const response = await fetch(`${api}/api/v1/school/student/activity`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${grant.token}`,
      Origin: origin!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      deltas: [{ surface: "practice", activeMs: 1000 }],
      events: [
        {
          kind: "hint",
          source: "practice",
          ref: problem.templateId,
          problemId: problem.id,
          step: 1,
          ageMs: 0,
        },
      ],
    }),
  });
  assert.ok(response.ok, `a hint opens: ${response.status}`);
}
/** No session running: a run starts from rest. */
async function rest(who: Person) {
  const live = await call(
    who.token,
    "GET",
    `/school/classes/${who.classId}/live`,
  );
  // A raised hand left by an earlier run would bring the cockpit at rest.
  for (const signal of live.signals as { id: string; kind: string }[])
    if (signal.kind === "hand")
      await call(
        who.token,
        "POST",
        `/school/classes/${who.classId}/signals/${signal.id}/resolve`,
        {},
      );
  if (live.session)
    await call(
      who.token,
      "POST",
      `/school/classes/${who.classId}/sessions/${live.session.id}/stop`,
      {},
    );
}
let sim: ChildProcess | undefined;
function simulate(slug: string, minutes: number) {
  sim = spawn(
    "npx",
    [
      "tsx",
      "scripts/live-family-sim.ts",
      "--persona",
      slug,
      "--minutes",
      String(minutes),
      "--pace",
      "0.25",
      "--no-start",
      "--raise-hand",
    ],
    {
      env: {
        ...process.env,
        AMP_SIM_DATABASE_URL: database,
        AMP_SIM_API: api,
        AMP_SIM_WEB: origin,
      },
      stdio: ["ignore", "ignore", "inherit"],
      detached: true,
    },
  );
}
function stopSim() {
  if (sim?.pid && sim.exitCode === null) process.kill(-sim.pid, "SIGTERM");
  sim = undefined;
}

// ---- pages ---------------------------------------------------------------
async function stateOf(browser: Browser, slug: string) {
  const context = await browser.newContext();
  const response = await context.request.post(
    `${origin}/api/auth/sign-in/email`,
    {
      headers: { Origin: origin! },
      data: { email: personaEmail(slug), password: PERSONA_PASSPHRASE },
    },
  );
  assert.ok(response.ok(), `${slug} signs in: ${response.status()}`);
  const state = await context.storageState();
  await context.close();
  return state;
}
type State = Awaited<ReturnType<typeof stateOf>>;

/** Layout shifts without input, and every frame's words, from the start. */
const recorder = () => {
  const w = window as unknown as {
    __shifts: { value: number; at: number }[];
    __frames: unknown[];
  };
  w.__shifts = [];
  w.__frames = [];
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as {
        value: number;
        hadRecentInput: boolean;
        startTime: number;
      }[])
        if (!entry.hadRecentInput)
          w.__shifts.push({ value: entry.value, at: entry.startTime });
    }).observe({ type: "layout-shift", buffered: true });
  } catch {
    // An engine without layout-shift entries: the boxes still count.
  }
  const tick = () => {
    const main = document.querySelector("main");
    w.__frames.push({
      t: performance.now(),
      bar: !!document.querySelector("[data-app-bar]"),
      tab:
        document
          .querySelector('[data-app-bar] [aria-current="page"]')
          ?.textContent?.trim() ?? "",
      title: document.querySelector("h1")?.textContent?.trim() ?? "",
      text: (main?.innerText ?? "").replace(/\s+/g, " ").trim().slice(0, 300),
      destination: !!document.querySelector(
        (window as unknown as { __destination: string }).__destination,
      ),
    });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};
type Frame = {
  t: number;
  bar: boolean;
  tab: string;
  title: string;
  text: string;
  destination: boolean;
};
const shifts = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __shifts: { value: number; at: number }[] })
        .__shifts,
  );
const now = (page: Page) => page.evaluate(() => performance.now());

type Box = { x: number; y: number; width: number; height: number };
/** Every box that must hold still, by name. */
const boxes = (page: Page) =>
  page.evaluate(() => {
    const out: Record<string, Box> = {};
    const put = (name: string, element: Element | null) => {
      if (!element) return;
      const r = element.getBoundingClientRect();
      out[name] = {
        x: Math.round(r.x),
        y: Math.round(r.y + window.scrollY),
        width: Math.round(r.width),
        height: Math.round(r.height),
      };
    };
    put("header", document.querySelector("[data-today-title]"));
    put("control", document.querySelector("[data-live-control]"));
    put("totals", document.querySelector("[data-live-totals]"));
    put("strip", document.querySelector("[data-live-strip]"));
    put("roster", document.querySelector("[data-live-roster]"));
    for (const tile of document.querySelectorAll<HTMLElement>("[data-tile]"))
      put(`tile:${tile.dataset.tile}`, tile);
    for (const row of document.querySelectorAll<HTMLElement>("[data-live-row]"))
      put(`row:${row.dataset.liveRow}`, row);
    for (const block of document.querySelectorAll<HTMLElement>("[data-child]"))
      put(`child:${block.dataset.child}`, block);
    return out;
  });
/** What a row shows, by person, without its clock. */
const rowTexts = (page: Page) =>
  page.evaluate(() => {
    const out: Record<string, string> = {};
    for (const row of document.querySelectorAll<HTMLElement>("[data-live-row]"))
      out[row.dataset.liveRow!] = row.innerText.replace(
        /\b(now|\d+s|\d+ min|\d+ h)\b/g,
        "",
      );
    return out;
  });
function compareBoxes(
  where: string,
  before: Record<string, Box>,
  after: Record<string, Box>,
) {
  for (const [name, box] of Object.entries(before)) {
    const next = after[name];
    if (!next) continue;
    if (
      box.x !== next.x ||
      box.y !== next.y ||
      box.width !== next.width ||
      box.height !== next.height
    ) {
      fail(
        `${where}: ${name} moved ${JSON.stringify(box)} → ${JSON.stringify(next)}`,
      );
      return;
    }
  }
}
async function shot(page: Page, name: string) {
  if (!shots) return;
  await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
}
/** The page is as wide as the window: nothing runs off the right edge. */
async function noSideways(page: Page, where: string) {
  const [content, window_] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    window.innerWidth,
  ]);
  if (content !== window_)
    fail(`${where}: the page is ${content}px wide in a ${window_}px window`);
}
/** Console errors and page errors, from now on. */
function listen(page: Page) {
  const said: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error")
      said.push(`${message.text().slice(0, 240)} (${message.location().url})`);
  });
  page.on("pageerror", (error) => said.push(error.message.slice(0, 240)));
  return said;
}

// ---- 8. Stop is one move: the session, then its report -------------------
/** Between "Stop session" and the report nothing else shows
 * (live-cockpit-checks.ts `stopTrail`). */
async function stopWasOneMove(page: Page, where: string) {
  const { trail, problems } = await stopTrail(page);
  console.log(`${where}: Stop: ${trail}`);
  for (const problem of problems) fail(`${where}: ${problem}`);
}

// ---- 5. the report, past sessions, the time report, help on a phone ------
/** "Every child" on the report: at every width the page never scrolls
 * sideways; under the table's width each child's row is one height and
 * holds everything it shows inside it (the first skills' whole names, then
 * how many more: the row's sheet has the rest). */
async function reportFits(page: Page, where: string) {
  await noSideways(page, `${where} report`);
  const problems = await page.evaluate(() => {
    const out: string[] = [];
    const grid = document.querySelector(
      "[data-session-report] [data-grid-mode]",
    );
    if (!grid) return ["no “Every child” list"];
    // Every child's row is one height, the table's or the list's, and the
    // help drawings have their key.
    const heights = new Set(
      [
        ...grid.querySelectorAll<HTMLElement>(
          "tbody tr[role=row], [data-report-card]",
        ),
      ].map((row) => Math.round(row.getBoundingClientRect().height)),
    );
    if (heights.size > 1)
      out.push(`rows of ${[...heights].join(" and ")} px (one height wanted)`);
    if (!document.querySelector("[data-session-report] [data-help-key]"))
      out.push("no key to the help drawings");
    if (grid.getAttribute("data-grid-mode") !== "cards") return out;
    const children = [
      ...document.querySelectorAll<HTMLElement>("[data-report-card]"),
    ];
    if (children.length === 0) out.push("no child's row on a phone");
    for (const child of children) {
      const row = child.getBoundingClientRect();
      const name = child.innerText.split("\n")[0];
      if (row.right > window.innerWidth || row.left < 0)
        out.push(`${name}'s row runs past the window`);
      for (const part of child.querySelectorAll<HTMLElement>("*")) {
        const box = part.getBoundingClientRect();
        if (box.width === 0) continue;
        if (box.right > row.right + 0.5 || box.left < row.left - 0.5)
          out.push(
            `${name}: “${part.innerText.slice(0, 30)}” runs past the row`,
          );
        else if (
          part.children.length === 0 &&
          // The measuring copies of a fitted list are not on screen.
          !part.closest("[aria-hidden=true]") &&
          part.scrollWidth > part.clientWidth + 1 &&
          getComputedStyle(part).overflow !== "visible"
        )
          out.push(`${name}: “${part.innerText.slice(0, 30)}” is cut`);
      }
    }
    return [...new Set(out)];
  });
  for (const problem of problems) fail(`${where} report: ${problem}`);
}

/** Past sessions: every row the same height, whatever its numbers, and
 * neither of its lines cut. */
async function pastSessionsEven(page: Page, who: Person, where: string) {
  await page.goto(`${origin}/family/${who.family}`, { waitUntil: "load" });
  await page.waitForSelector("[data-past-sessions]");
  await page.waitForTimeout(400);
  const rows = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-past-session]")].map(
      (row) => ({
        height: Math.round(row.getBoundingClientRect().height * 10) / 10,
        text: row.innerText.replace(/\s+/g, " ").trim(),
        cut: [...row.querySelectorAll<HTMLElement>("span")].some(
          (line) => line.scrollWidth > line.clientWidth + 1,
        ),
      }),
    ),
  );
  const heights = [...new Set(rows.map((row) => row.height))];
  console.log(
    `${where}: ${rows.length} past sessions, ${heights.join("/")}px tall`,
  );
  if (heights.length > 1)
    fail(
      `${where}: past sessions' rows are ${heights.join(" and ")}px tall: ${rows
        .map((row) => `${row.height} “${row.text}”`)
        .join("; ")}`,
    );
  for (const row of rows.filter((row) => row.cut))
    fail(`${where}: a past session's line is cut: “${row.text}”`);
  await noSideways(page, `${where} Today`);
}

/** "See the time report" (the family's week by its address): the heading
 * rests the page's own top space under the bar, or as far up as a short
 * page scrolls. */
async function weekRestsClear(
  browser: Browser,
  state: State,
  who: Person,
  width: number,
) {
  const { context, page } = await openToday(
    browser,
    state,
    `/family/${who.family}`,
    width,
    { ready: "[data-family-week]" },
  );
  await page.waitForTimeout(400);
  // The feed's own button when everyone worked today; else its address.
  const button = page.getByRole("link", { name: "See the time report" });
  if (await button.isVisible().catch(() => false)) await button.click();
  else
    await page.evaluate(() => {
      location.hash = "family-week";
    });
  await page.waitForTimeout(900);
  const at = await page.evaluate(() => {
    const bar = document.querySelector("[data-app-bar]")!;
    const heading = document.querySelector("#family-week")!;
    return {
      gap: Math.round(
        heading.getBoundingClientRect().top -
          bar.getBoundingClientRect().bottom,
      ),
      space: Math.round(
        parseFloat(
          getComputedStyle(heading).getPropertyValue("scroll-margin-top"),
        ),
      ),
      top: Math.round(window.scrollY),
      end:
        Math.round(window.scrollY + window.innerHeight) >=
        document.documentElement.scrollHeight - 1,
    };
  });
  console.log(
    `week ${width}px: “This week” ${at.gap}px under the bar (space ${at.space}px, scrolled ${at.top}px)`,
  );
  if (!(at.space >= 16))
    fail(`week ${width}px: no space set above “This week”`);
  // Scrolled to: exactly its space. Not scrolled, or the page ended first:
  // at least its space.
  if (
    at.top > 0 && !at.end
      ? Math.abs(at.gap - at.space) > 1
      : at.gap < at.space - 1
  )
    fail(
      `week ${width}px: “This week” rests ${at.gap}px under the bar, not ${at.space}px`,
    );
  if (shots && (width === 390 || width === 1280))
    await page.screenshot({ path: `${shots}/week-${width}.png` });
  await context.close();
}

/** The first child opens a hint mid-session: on a phone their row shows it
 * at the end of the name's line; with room, in the Help column. Either way
 * every box holds and nothing shifts. */
async function helpArrives(page: Page, who: Person, where: string) {
  const row = `[data-live-row="${who.first.person}"]`;
  const read = () =>
    page.evaluate(
      ({ selector, called }) => {
        const element = document.querySelector<HTMLElement>(selector);
        const layout =
          document
            .querySelector("[data-live-roster]")
            ?.getAttribute("data-layout") ?? "";
        const marks = element?.querySelector<HTMLElement>("[data-help-marks]");
        const counts = element?.querySelector<HTMLElement>(
          '[role="img"][aria-label^="Help:"]',
        );
        const hint = marks?.querySelector<HTMLElement>(
          '[data-help="hints"][data-opened]',
        );
        // The name's own words, wherever the row keeps them.
        const name = [...(element?.querySelectorAll("span") ?? [])].find(
          (part) =>
            part.childElementCount === 0 && part.textContent?.trim() === called,
        );
        const box = (part?: Element | null) => {
          const r = part?.getBoundingClientRect();
          return r
            ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom }
            : null;
        };
        return {
          layout,
          label: (marks ?? counts)?.getAttribute("aria-label") ?? "",
          places: marks?.querySelectorAll("[data-help]").length ?? 0,
          row: box(element),
          hint: box(hint),
          visible: !!hint && hint.getBoundingClientRect().width > 0,
          name: box(name),
        };
      },
      { selector: row, called: who.first.name },
    );
  const before = await read();
  if (!before.row) return fail(`${where}: the first child has no row`);
  if (before.layout === "phone" && before.places !== 4)
    fail(`${where}: a phone's row holds ${before.places} help places, not 4`);
  const still = await boxes(page);
  const from = await now(page);
  await opensHint(who);
  const deadline = Date.now() + 20_000;
  let after = before;
  while (Date.now() < deadline && after.label === before.label) {
    await page.waitForTimeout(300);
    after = await read();
  }
  if (after.label === before.label)
    return fail(
      `${where}: a hint opened and the ${before.layout} row never showed it (“${before.label}”)`,
    );
  await page.waitForTimeout(600);
  compareBoxes(`${where} when help arrives`, still, await boxes(page));
  const cls = (await shifts(page))
    .filter((entry) => entry.at > from)
    .reduce((sum, entry) => sum + entry.value, 0);
  if (cls > 0)
    fail(`${where}: layout shift ${cls.toFixed(4)} when help arrived`);
  console.log(
    `${where}: help arrived in the ${after.layout} row: “${before.label}” → “${after.label}”`,
  );
  if (after.layout !== "phone") return;
  after = await read();
  if (!after.visible || !after.hint || !after.row)
    return fail(`${where}: the phone row shows no hint mark`);
  if (
    after.hint.left < after.row.left ||
    after.hint.right > after.row.right ||
    after.hint.top < after.row.top ||
    after.hint.bottom > after.row.bottom
  )
    fail(`${where}: the hint mark sits outside its row`);
  if (!after.name) fail(`${where}: the row shows no name`);
  else if (after.hint.left < after.name.right)
    fail(`${where}: the hint mark overlaps the name`);
}

// ---- 1. cold loads -------------------------------------------------------
async function coldLoad(
  browser: Browser,
  state: State,
  path: string,
  name: string,
  destination: string,
) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    storageState: state,
  });
  await context.addInitScript("globalThis.__name ??= (f) => f;");
  await context.addInitScript(
    `window.__destination = ${JSON.stringify(destination)};`,
  );
  await context.addInitScript(recorder);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 80,
    downloadThroughput: 750_000,
    uploadThroughput: 250_000,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.goto(origin + path, { waitUntil: "load", timeout: 120_000 });
  await page
    .waitForSelector(destination, { timeout: 60_000 })
    .catch(() => undefined);
  await page.waitForTimeout(2500);
  const frames = (await page.evaluate(
    () => (window as unknown as { __frames: Frame[] }).__frames,
  )) as Frame[];
  const cls = (await shifts(page)).reduce((sum, s) => sum + s.value, 0);
  await context.close();
  const states: Frame[] = [];
  for (const frame of frames.filter((f) => f.bar)) {
    const last = states.at(-1);
    if (last?.destination) break;
    if (last && last.text === frame.text && last.tab === frame.tab) continue;
    states.push(frame);
  }
  const final = states.at(-1);
  const trail = states
    .map((s) => `${Math.round(s.t)}ms [${s.tab}] "${s.text.slice(0, 40)}"`)
    .join(" → ");
  console.log(`cold ${name}: ${states.length} state(s), CLS ${cls.toFixed(4)}`);
  if (!final?.destination) fail(`cold ${name}: never reached it: ${trail}`);
  if (states.length > 2)
    fail(
      `cold ${name}: ${states.length - 1} changes after the frame: ${trail}`,
    );
  if (states.length === 2 && states[0]!.text !== "")
    fail(`cold ${name}: the first frame showed something else: ${trail}`);
  if (new Set(states.map((s) => s.tab)).size > 1)
    fail(`cold ${name}: the current tab changed: ${trail}`);
  const titles = new Set(states.map((s) => s.title).filter(Boolean));
  if (titles.size > 1) fail(`cold ${name}: the title changed: ${trail}`);
  if (cls > 0.001) fail(`cold ${name}: layout shift ${cls.toFixed(4)}`);
}

// ---- 2. start → updates → stop --------------------------------------------
async function openToday(
  browser: Browser,
  state: State,
  path: string,
  width: number,
  options: { dark?: boolean; ready?: string } = {},
) {
  const context = await browser.newContext({
    viewport: { width, height: height(width) },
    storageState: state,
    colorScheme: options.dark ? "dark" : "light",
  });
  await context.addInitScript("globalThis.__name ??= (f) => f;");
  await context.addInitScript(`window.__destination = "main";`);
  await context.addInitScript(recorder);
  const page = await context.newPage();
  page.on("pageerror", (error) =>
    fail(`${width}px page error: ${error.message}`),
  );
  await page
    .goto(origin + path, { waitUntil: "networkidle" })
    .catch(() => undefined);
  await page.waitForSelector(options.ready ?? "[data-family-live]");
  return { context, page };
}

async function liveRun(
  browser: Browser,
  state: State,
  who: Person,
  slug: string,
  width: number,
  tag: string,
) {
  await rest(who);
  const { context, page } = await openToday(
    browser,
    state,
    `/family/${who.family}`,
    width,
  );
  await page.waitForSelector('[data-family-live="rest"]');
  await page.waitForTimeout(600);
  await shot(page, `${tag}-rest-${width}`);
  const above = await boxes(page);
  // The first child must be above the fold at rest on a phone.
  const firstChild = await page.evaluate(() => {
    const block = document.querySelector("[data-child]");
    return block ? Math.round(block.getBoundingClientRect().top) : -1;
  });
  console.log(`${tag} ${width}px: the first child starts at ${firstChild}px`);
  if (width <= 390 && (firstChild < 0 || firstChild > height(width) - 120))
    fail(`${tag} ${width}px: the first child is pushed to ${firstChild}px`);
  simulate(slug, 6);
  await page.getByRole("button", { name: "Start practice" }).first().click();
  await page.waitForSelector('[data-cockpit="live"] [data-live-roster]');
  await page.waitForTimeout(1500);
  const started = await boxes(page);
  for (const name of ["header", "control"])
    if (
      above[name]?.y !== started[name]?.y ||
      above[name]?.x !== started[name]?.x
    )
      fail(`${tag} ${width}px: starting moved ${name}`);
  await shot(page, `${tag}-started-${width}`);
  const from = await now(page);
  let before = await boxes(page);
  let texts = await rowTexts(page);
  let updates = 0;
  // The one-child family (a free allowance of 100 problems) may run out
  // after many runs on one scratch database: it is held to stillness for
  // as long as it answers, not to a count.
  const deadline = Date.now() + (tag === "one" ? 60_000 : 5 * 60_000);
  while (updates < UPDATES && Date.now() < deadline) {
    await page.waitForTimeout(400);
    const next = await rowTexts(page);
    for (const [id, text] of Object.entries(next))
      if (texts[id] !== undefined && texts[id] !== text) updates++;
    texts = next;
    const after = await boxes(page);
    compareBoxes(`${tag} ${width}px after ${updates} updates`, before, after);
    before = after;
  }
  if (updates < UPDATES && tag !== "one")
    fail(`${tag} ${width}px: only ${updates} row updates arrived`);
  const raised = await page
    .locator("[data-live-strip] button")
    .filter({ hasText: "Got it" })
    .first()
    .isVisible()
    .catch(() => false);
  if (slug === "family" && !raised && width === WIDTHS[0])
    console.log("  (no raised hand showed yet)");
  const moved = (await shifts(page)).filter((s) => s.at > from);
  const cls = moved.reduce((sum, s) => sum + s.value, 0);
  console.log(
    `${tag} ${width}px: ${updates} row updates, CLS ${cls.toFixed(4)}`,
  );
  if (cls > 0)
    fail(`${tag} ${width}px: layout shift ${cls.toFixed(4)} while live`);
  if (tag === "three") await helpArrives(page, who, `${tag} ${width}px`);
  await noSideways(page, `${tag} ${width}px live`);
  await shot(page, `${tag}-live-${width}`);
  if (raised) {
    await page
      .locator("[data-live-strip] button")
      .filter({ hasText: "Got it" })
      .first()
      .click();
    await page.waitForTimeout(1200);
  }
  // A child's row opens the child's page; back to Today and on.
  if (width === WIDTHS.at(-1)) await childLink(page, who);
  await page.getByRole("button", { name: "Stop" }).click();
  await watchStop(page);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Stop session" })
    .click();
  await page.waitForSelector("[data-session-report]", { timeout: 20_000 });
  await stopWasOneMove(page, `${tag} ${width}px`);
  const path = new URL(page.url()).pathname;
  if (!new RegExp(`^/family/${who.family}/sessions/[0-9a-f-]+$`).test(path))
    fail(`${tag} ${width}px: Stop landed on ${page.url()}`);
  const tab = await page
    .locator('[data-app-bar] [aria-current="page"]')
    .first()
    .textContent()
    .catch(() => null);
  if (tab?.trim() !== "Today")
    fail(`${tag} ${width}px: the report's current tab is "${tab}"`);
  await page.waitForTimeout(800);
  await reportFits(page, `${tag} ${width}px`);
  await shot(page, `${tag}-report-${width}`);
  if (width === WIDTHS.at(-1)) await printsReport(page, tag);
  stopSim();
  await pastSessionsEven(page, who, `${tag} ${width}px`);
  await context.close();
  return path;
}

async function childLink(page: Page, who: Person) {
  const link = page.locator("[data-live-row] a[data-child-link]").first();
  const href = await link.getAttribute("href");
  const url = page.url();
  await link.click();
  await page.waitForURL(/\/kids\//, { timeout: 15_000 });
  if (!href?.startsWith(`/family/${who.family}/kids/`))
    fail(`a child's row linked to ${href}`);
  await page.goBack();
  await page.waitForSelector('[data-cockpit="live"] [data-live-roster]');
  if (page.url() !== url)
    fail(`back from a child's page landed on ${page.url()}`);
}

async function printsReport(page: Page, tag: string) {
  await page.emulateMedia({ media: "print" });
  const pdf = await page.pdf({ format: "Letter" });
  console.log(`${tag}: the report prints: ${pdf.length} bytes`);
  if (pdf.length < 2000) fail(`${tag}: the report's print is empty`);
  const text = await page.evaluate(() => document.body.innerText);
  if (!/Session on/.test(text)) fail(`${tag}: the printed report has no title`);
  await page.emulateMedia({ media: "screen" });
}

// ---- 3. the second parent ---------------------------------------------------
async function secondParent(browser: Browser, state: State, who: Person) {
  await rest(who);
  await call(who.token, "POST", `/school/classes/${who.classId}/sessions`, {});
  const { context, page } = await openToday(
    browser,
    state,
    `/family/${who.family}`,
    390,
    { ready: '[data-cockpit="live"]' },
  );
  await page.waitForTimeout(800);
  await shot(page, "second-parent-live-390");
  await page.getByRole("button", { name: "Stop" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Stop session" })
    .click();
  await page.waitForSelector("[data-session-report]", { timeout: 20_000 });
  console.log("second parent: saw the running session and stopped it");
  await context.close();
}

// ---- 6. started from another browser, the cockpit's code not in yet -----
async function lateCockpit(
  browser: Browser,
  state: State,
  who: Person,
  width: number,
) {
  await rest(who);
  // A fresh browser at rest: nothing has asked for the cockpit's code.
  const { context, page } = await openToday(
    browser,
    state,
    `/family/${who.family}`,
    width,
  );
  const said = listen(page);
  await page.waitForSelector('[data-family-live="rest"]');
  await page.waitForTimeout(600);
  const loaded = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .some((entry) => /FamilyCockpit/.test(entry.name)),
  );
  if (loaded)
    fail(`late ${width}px: the cockpit's code was loaded at rest already`);
  const above = await boxes(page);
  // The other parent's browser starts the session. Nothing here touches the
  // page meanwhile: a click before the cockpit arrives makes React forget
  // which component waited, and its report with it.
  await call(who.token, "POST", `/school/classes/${who.classId}/sessions`, {});
  await page.waitForSelector('[data-cockpit="live"] [data-live-roster]', {
    timeout: 30_000,
  });
  await page.waitForTimeout(1500);
  const started = await boxes(page);
  for (const name of ["header", "control"])
    if (
      above[name]?.y !== started[name]?.y ||
      above[name]?.x !== started[name]?.x
    )
      fail(`late ${width}px: the session arriving moved ${name}`);
  for (const line of said) fail(`late ${width}px: the console said: ${line}`);
  console.log(
    `late ${width}px: started elsewhere, the cockpit arrived; console errors: ${said.length}`,
  );
  await rest(who);
  await context.close();
}

// ---- 7. each child's block ------------------------------------------------
type Mix = { key: string; count: number; skills: { title: string }[] }[];
async function childBlocks(
  browser: Browser,
  state: State,
  who: Person,
  width: number,
) {
  await rest(who);
  const where = `block ${width}px`;
  const board = await call(
    who.token,
    "GET",
    `/families/${who.family}/dashboard`,
  );
  const mixes = new Map<string, Mix>(
    (board.children as { id: string; focus: { answered: number; mix: Mix } }[])
      .filter((child) => child.focus.answered > 0)
      .map((child) => [child.id, child.focus.mix]),
  );
  const { context, page } = await openToday(
    browser,
    state,
    `/family/${who.family}`,
    width,
    { ready: "[data-focus-line]" },
  );
  await page.waitForTimeout(500);
  const blocks = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-child]")].flatMap(
      (block) => {
        const line = block.querySelector<HTMLElement>("[data-focus-line]");
        if (!line) return [];
        const box = line.getBoundingClientRect();
        const inset = parseFloat(getComputedStyle(line).paddingRight);
        const reasons = [
          ...line.querySelectorAll<HTMLElement>("span > [data-focus]"),
        ].filter((reason) => reason.dataset.focus !== "chosen");
        const boxes = reasons.map((reason) => reason.getBoundingClientRect());
        const label = line.querySelector("span")!.getBoundingClientRect();
        return [
          {
            child: block.dataset.child!,
            height: Math.round(box.height * 10) / 10,
            words: line.innerText.replace(/\s+/g, " ").trim(),
            // By their middles: the label is set a little smaller.
            rows: new Set(
              [label, ...boxes].map(
                (part) => Math.round((part.top + part.bottom) / 4) * 2,
              ),
            ).size,
            past: boxes.some((reason) => reason.right > box.right - inset + 1),
            overlap: boxes.some((reason, index) =>
              boxes
                .slice(index + 1)
                .some(
                  (next) =>
                    Math.abs(next.top - reason.top) < 2 &&
                    next.left < reason.right,
                ),
            ),
            named: block.querySelectorAll("a[data-entity=skill]").length,
            // Blocks made of the same parts are the same height.
            parts: [
              block.querySelectorAll("[data-learner-row] ~ p").length,
              block.querySelectorAll("li").length,
              Math.round(
                block
                  .querySelector("[data-focus-mix]")!
                  .nextElementSibling?.getBoundingClientRect().height ?? 0,
              ),
            ].join("/"),
            block: Math.round(block.getBoundingClientRect().height * 10) / 10,
          },
        ];
      },
    ),
  );
  if (blocks.length === 0) fail(`${where}: no child has a line`);
  const heights = [...new Set(blocks.map((block) => block.height))];
  console.log(
    `${where}: ${blocks.length} lines ${heights.join("/")}px tall on ${[...new Set(blocks.map((block) => block.rows))].join("/")} row(s): ${blocks.map((block) => `“${block.words}”`).join(" ")}`,
  );
  if (heights.length > 1)
    fail(`${where}: the lines are ${heights.join(" and ")}px tall`);
  for (const block of blocks) {
    if (width >= 768 && (block.rows !== 1 || block.height !== 44))
      fail(
        `${where}: “${block.words}” is ${block.height}px on ${block.rows} rows, not one 44 px line`,
      );
    if (block.past || block.overlap)
      fail(`${where}: “${block.words}” runs past its line or over itself`);
    if (block.named > 0)
      fail(`${where}: ${block.named} skills are still named on the page`);
  }
  const byParts = new Map<string, Set<number>>();
  for (const block of blocks)
    byParts.set(
      block.parts,
      (byParts.get(block.parts) ?? new Set()).add(block.block),
    );
  for (const [parts, tall] of byParts)
    if (tall.size > 1)
      fail(
        `${where}: blocks of the same parts (${parts}) are ${[...tall].join(" and ")}px tall`,
      );
  await noSideways(page, where);
  if (shots && (width === 390 || width === 1280))
    await page.screenshot({ path: `${shots}/blocks-${width}.png` });

  // A child's name: its highlight whole on every side, the name not moved.
  const name = page.locator("[data-child] a[data-child-link]").first();
  const letters = () =>
    name.evaluate((link) => {
      const range = document.createRange();
      range.selectNodeContents(link.firstChild!);
      const text = range.getBoundingClientRect();
      const box = link.getBoundingClientRect();
      const hit = (x: number, y: number) =>
        link.contains(document.elementFromPoint(x, y));
      const middle = (box.top + box.bottom) / 2;
      return {
        text: [text.left, text.top].map((n) => Math.round(n * 10) / 10),
        room: [
          text.left - box.left,
          box.right - text.right,
          text.top - box.top,
          box.bottom - text.bottom,
        ].map((n) => Math.round(n)),
        whole:
          hit(box.left + 1, middle) &&
          hit(box.right - 1, middle) &&
          hit((box.left + box.right) / 2, box.top + 1) &&
          hit((box.left + box.right) / 2, box.bottom - 1),
        fill: getComputedStyle(link).backgroundColor,
      };
    });
  const quiet = await letters();
  await name.hover();
  await page.waitForTimeout(150);
  const hovered = await letters();
  if (quiet.text.join() !== hovered.text.join())
    fail(`${where}: the name moved under the pointer`);
  if (hovered.fill === quiet.fill)
    fail(`${where}: the name shows no highlight under the pointer`);
  // The same room before the name as above and below it (the chevron
  // follows the name, so the far side has its own).
  if (hovered.room[0]! < 7 || Math.abs(hovered.room[0]! - hovered.room[2]!) > 1)
    fail(
      `${where}: the name's highlight has ${hovered.room[0]}px before it and ${hovered.room[2]}px above`,
    );
  if (!hovered.whole) fail(`${where}: the name's highlight is cut at an edge`);
  await page.mouse.move(0, 0);

  // The line opens the sheet: every skill, each a link; Back closes it.
  const first = blocks[0]!;
  const said = listen(page);
  const address = page.url();
  await page.locator(`[data-child="${first.child}"] [data-focus-line]`).click();
  const sheet = page.locator(`[data-focus-sheet="${first.child}"]`);
  await sheet.waitFor();
  await page.waitForTimeout(500);
  const listed = await sheet.evaluate((element) => ({
    skills: [
      ...element.querySelectorAll<HTMLElement>("a[data-entity=skill]"),
    ].map((link) => link.innerText.trim()),
    short: [...element.querySelectorAll<HTMLElement>("li")].filter(
      (row) => row.getBoundingClientRect().height < 44,
    ).length,
    past: [...element.querySelectorAll<HTMLElement>("*")].filter(
      (part) => part.getBoundingClientRect().right > window.innerWidth,
    ).length,
    more: /and \d+ more/.test((element as HTMLElement).innerText),
  }));
  const expected = (mixes.get(first.child) ?? []).flatMap((entry) =>
    entry.skills.map((skill) => skill.title),
  );
  console.log(
    `${where}: the sheet lists ${listed.skills.length} skills of ${expected.length}`,
  );
  if (
    listed.skills.length === 0 ||
    listed.skills.join("|") !== expected.join("|")
  )
    fail(
      `${where}: the sheet lists ${listed.skills.length} skills, the dashboard has ${expected.length}`,
    );
  if (listed.more) fail(`${where}: the sheet still says “and N more”`);
  if (listed.short) fail(`${where}: ${listed.short} skill rows under 44 px`);
  if (listed.past) fail(`${where}: the sheet runs past the window`);
  await noSideways(page, `${where} sheet`);
  if (page.url() !== address)
    fail(`${where}: opening the sheet changed the address to ${page.url()}`);
  if (shots && (width === 390 || width === 1280))
    await page.screenshot({ path: `${shots}/blocks-sheet-${width}.png` });
  // A skill opens over it, as anywhere on Today, and closes back to it.
  await sheet.locator("a[data-entity=skill]").first().click();
  await page.waitForSelector("[data-layer-frame]", { timeout: 15_000 });
  await page.waitForTimeout(600);
  await noSideways(page, `${where} skill`);
  await page.keyboard.press("Escape");
  await page
    .waitForSelector("[data-layer-frame]", {
      state: "detached",
      timeout: 15_000,
    })
    .catch(() => fail(`${where}: the skill didn't close`));
  // Back closes the sheet to Today.
  if (await sheet.isVisible()) await page.goBack();
  await sheet
    .waitFor({ state: "detached", timeout: 10_000 })
    .catch(() => fail(`${where}: Back left the sheet open`));
  if (page.url() !== address)
    fail(`${where}: closing the sheet left ${page.url()}`);
  if (!(await page.locator("[data-family-kids]").isVisible()))
    fail(`${where}: closing the sheet didn't show Today`);
  for (const line of said) fail(`${where}: the console said: ${line}`);
  await context.close();
}

// ---- 4. ended by another device, and stills ----------------------------------
async function endedAndStills(
  browser: Browser,
  state: State,
  who: Person,
  slug: string,
) {
  if (!shots) return;
  for (const dark of [false, true])
    for (const width of [390, 1280]) {
      const suffix = `${width}${dark ? "-dark" : ""}`;
      await rest(who);
      const first = await openToday(
        browser,
        state,
        `/family/${who.family}`,
        width,
        {
          dark,
        },
      );
      await first.page.waitForSelector("[data-family-live]");
      await first.page.waitForTimeout(500);
      await shot(first.page, `still-rest-${suffix}`);
      await first.context.close();
      simulate(slug, 3);
      await call(
        who.token,
        "POST",
        `/school/classes/${who.classId}/sessions`,
        {},
      );
      await new Promise((resolve) => setTimeout(resolve, 25_000));
      const live = await openToday(
        browser,
        state,
        `/family/${who.family}`,
        width,
        {
          dark,
          ready: '[data-cockpit="live"] [data-live-roster]',
        },
      );
      await live.page.waitForTimeout(1500);
      await shot(live.page, `still-live-${suffix}`);
      // Another device stops it: this one shows it ended, with its report.
      const running = await call(
        who.token,
        "GET",
        `/school/classes/${who.classId}/live`,
      );
      await call(
        who.token,
        "POST",
        `/school/classes/${who.classId}/sessions/${running.session.id}/stop`,
        {},
      );
      await live.page.waitForSelector('[data-cockpit="ended"]', {
        timeout: 30_000,
      });
      await live.page.waitForTimeout(800);
      await shot(live.page, `still-ended-${suffix}`);
      await live.page.getByRole("link", { name: "See the report" }).click();
      await live.page.waitForSelector("[data-session-report]");
      await live.page.waitForTimeout(800);
      await shot(live.page, `still-report-${suffix}`);
      await live.page.goto(`${origin}/family/${who.family}`, {
        waitUntil: "load",
      });
      await live.page.waitForSelector("[data-past-sessions]");
      await live.page.locator("[data-past-sessions]").scrollIntoViewIfNeeded();
      await live.page.screenshot({ path: `${shots}/still-past-${suffix}.png` });
      await live.context.close();
      stopSim();
    }
}

// ---- run -----------------------------------------------------------------
if (shots) await mkdir(shots, { recursive: true });
const browser = await chromium.launch();
try {
  const three = await person("family");
  const one = await person("parent-day1");
  const [threeState, oneState, secondState] = await Promise.all([
    stateOf(browser, "family"),
    stateOf(browser, "parent-day1"),
    stateOf(browser, "second-parent"),
  ]);
  await rest(three);
  await rest(one);
  if (flag("stop-only")) {
    for (const width of WIDTHS)
      await liveRun(browser, threeState, three, "family", width, "three");
    await rest(three);
    assert.deepEqual(failures, [], failures.join("\n"));
    console.log("Stop is one move at every width.");
    process.exit(0);
  }
  if (flag("blocks-only")) {
    for (const width of WIDTHS)
      await childBlocks(browser, threeState, three, width);
    assert.deepEqual(failures, [], failures.join("\n"));
    console.log("Each child's block holds one line, and its sheet opens.");
    process.exit(0);
  }
  if (flag("stills-only")) {
    await endedAndStills(browser, threeState, three, "family");
    await rest(three);
    process.exit(0);
  }
  const paths: string[] = [];
  if (!flag("skip-cold")) {
    await coldLoad(
      browser,
      threeState,
      `/family/${three.family}`,
      "Today at rest",
      "[data-family-live], [data-family-hero]",
    );
  }
  for (const width of WIDTHS) {
    paths.push(
      await liveRun(browser, threeState, three, "family", width, "three"),
    );
    if (width === 390 || width === 1280)
      await liveRun(browser, oneState, one, "parent-day1", width, "one");
  }
  if (!flag("skip-cold")) {
    await coldLoad(
      browser,
      threeState,
      paths.at(-1)!,
      "a session's report",
      "[data-session-report]",
    );
    await call(
      three.token,
      "POST",
      `/school/classes/${three.classId}/sessions`,
      {},
    );
    await coldLoad(
      browser,
      threeState,
      `/family/${three.family}`,
      "Today live",
      '[data-cockpit="live"] [data-live-row]',
    );
  }
  await secondParent(browser, secondState, three);
  for (const width of WIDTHS) {
    await lateCockpit(browser, threeState, three, width);
    await weekRestsClear(browser, threeState, three, width);
    await childBlocks(browser, threeState, three, width);
  }
  await endedAndStills(browser, threeState, three, "family");
  await rest(three);
} finally {
  stopSim();
  await browser.close();
}
assert.deepEqual(failures, [], failures.join("\n"));
console.log(
  "A family's live session holds still, loads in one frame, shows help on a phone and reports within the window.",
);
