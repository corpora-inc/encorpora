/**
 * A class's Today as the live cockpit (#2465, round 2026-11-20 L7 + L5),
 * with a simulated class of 14:
 *
 * 1. Cold loads (a fresh browser, no cache, CPU 4x, a slow network, 390 px)
 *    of Today at rest, Today with a session running, and a session's report:
 *    after the app's frame first shows, at most one neutral frame (a wait
 *    with no words of its own), then the destination, with the same tab
 *    current and the same title throughout, and no layout shift.
 * 2. At 320, 390, 768 and 1280 px in turn: Start (a tap) → 200 row updates
 *    from the simulated students → Stop. From the moment the session shows
 *    live until Stop is tapped, nothing on the page moves: no layout-shift
 *    entry without input, and the control, the totals and each tile, the
 *    requests strip and every student's row hold their boxes. Starting
 *    never moves the control or anything above it. Stop asks first, then
 *    opens that session's report. All the while every skill's name is
 *    whole or cut after a whole word (never inside one, never a hover
 *    title), a cut name's tap shows all of it, and from 390 px two open
 *    requests both show in the strip, with no "+1". The help drawings'
 *    key is on screen with the rows that show them and holds as still.
 *    The report's "Every student" rows are all one height, name the first
 *    skills that fit and how many more, open the student's sheet with all
 *    of them, and print every name.
 * 3. At 1280 px: the roster scrolled and sorted, a student opened as the
 *    student layer and closed, and the roster's scroll, the page's and the
 *    sort are exactly as they were.
 * 4. At 390 and 1280 px side by side: a session planned to end in a minute
 *    ends on screen by itself: the page shows it ended, with its report one
 *    tap away, and nothing moves.
 *
 * By itself (as CI runs it, `npm run test:live-cockpit-screen-ui`) it
 * starts its own stack on a fresh schema of AMP_TEST_DATABASE_URL
 * (scripts/persona-stack.ts) with the teacher it needs:
 *
 *   AMP_TEST_DATABASE_URL=postgres://…/amp_test \
 *     npx tsx scripts/verify-live-cockpit-screen-ui.ts [--port 4886] [--out <dir>]
 *
 * Or against a running, seeded preview and its database:
 *
 *   AMP_SIM_DATABASE_URL=postgres://amp:amp@127.0.0.1:55490/<db> \
 *     npx tsx scripts/verify-live-cockpit-screen-ui.ts \
 *       --origin http://127.0.0.1:4830 --api http://127.0.0.1:4831
 *
 * Either way:
 *       [--shots <dir>]   every state at 390 and 1280 light and dark, live
 *                         and the report at 320 and 768, and the report on
 *                         paper (report-print.pdf, report-print.png)
 *       [--video <dir>]   a recording of the 390 and 1280 runs
 *       [--updates 200] [--skip-ended] [--stills-only]
 *
 * The simulator (scripts/live-class-sim.ts) makes and reuses only its own
 * org and class, and is loopback-only.
 */
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, rename, writeFile } from "node:fs/promises";
import {
  chromium as rawChromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";
import pg from "pg";
import { secureChromium } from "../browser-security.mjs";
import {
  cutNameOpens,
  skillNames,
  stopTrail,
  watchStop,
} from "./live-cockpit-checks";
import { startPersonaStack } from "./persona-stack";
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
const shots = arg("shots");
const video = arg("video");
const UPDATES = Number(arg("updates") ?? 200);
if (arg("origin") && !process.env.AMP_SIM_DATABASE_URL)
  throw new Error("With --origin, AMP_SIM_DATABASE_URL is required");
const stack = arg("origin")
  ? null
  : await startPersonaStack({
      webPort: Number(arg("port") ?? 4886),
      personas: ["teacher-class"],
      name: "live_cockpit_screen",
      out: arg("out") ?? "artifacts/live-cockpit-screen",
    });
const origin = arg("origin") ?? stack!.origin;
const api = arg("api") ?? stack?.api ?? origin;
const database = stack?.database ?? process.env.AMP_SIM_DATABASE_URL!;
const WIDTHS = [320, 390, 768, 1280] as const;
const height = (width: number) =>
  width >= 1024 ? 800 : width >= 768 ? 1024 : 844;
const failures: string[] = [];
const fail = (message: string) => {
  console.log(`  FAIL ${message}`);
  failures.push(message);
};

// ---- the simulated class -------------------------------------------------
let sim: ChildProcess | undefined;
function simulate(minutes: number) {
  return new Promise<{ today: string; token: string }>((resolve, reject) => {
    sim = spawn(
      "npx",
      [
        "tsx",
        "scripts/live-class-sim.ts",
        "--students",
        "14",
        "--minutes",
        String(minutes),
        "--pace",
        "0.4",
        "--no-start",
        "--raise-hand",
        "--forgot-picture",
      ],
      {
        env: {
          ...process.env,
          AMP_SIM_DATABASE_URL: database,
          AMP_SIM_API: api,
          AMP_SIM_WEB: origin,
        },
        stdio: ["ignore", "pipe", "inherit"],
        detached: true,
      },
    );
    let out = "";
    let today = "";
    sim.stdout!.on("data", (chunk: Buffer) => {
      out += chunk.toString();
      today ||= out.match(/Live sim 1: (\S+)/)?.[1] ?? "";
      const token = out.match(/teacher token for curl: (\S+)/)?.[1];
      if (today && token) resolve({ today: new URL(today).pathname, token });
    });
    sim.on("exit", (code) =>
      reject(new Error(`The simulator ended (${code}):\n${out}`)),
    );
  });
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
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  assert.ok(response.ok, `${method} ${path}: ${response.status}`);
  return response.json() as Promise<Record<string, unknown>>;
}
/** No session running: a run starts from rest. */
async function rest(token: string, classId: string) {
  const live = (await call(
    token,
    "GET",
    `/school/classes/${classId}/live`,
  )) as {
    session: { id: string } | null;
  };
  if (live.session)
    await call(
      token,
      "POST",
      `/school/classes/${classId}/sessions/${live.session.id}/stop`,
      {},
    );
}

/** The simulator's student who never signs in today was last seen on a
 * sign-in of her own eleven minutes ago: earlier today, and past the ten
 * minutes "here" reaches back. The cockpit, the report and the wall board
 * must all leave her out. */
const SEEN_EARLIER = "Nell";
async function seenEarlierToday(classId: string) {
  const pool = new pg.Pool({ connectionString: database, max: 1 });
  try {
    const person = (
      await pool.query(
        `SELECT p.id FROM amp_enrollments e JOIN amp_people p ON p.id=e.person_id
         WHERE e.class_id=$1 AND e.role='student' AND p.deleted_at IS NULL AND p.given_name=$2`,
        [classId, SEEN_EARLIER],
      )
    ).rows[0] as { id: string } | undefined;
    assert.ok(person, `${SEEN_EARLIER} is in the simulated class`);
    const moved = await pool.query(
      `UPDATE amp_student_sessions SET last_seen_at=now()-interval '11 minutes',
         revoked_at=NULL,expires_at=now()+interval '12 hours' WHERE person_id=$1`,
      [person.id],
    );
    if (!moved.rowCount)
      await pool.query(
        `INSERT INTO amp_student_sessions(id,token_hash,person_id,mode,expires_at,last_seen_at)
         VALUES(gen_random_uuid(),encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex'),
           $1,'shared',now()+interval '12 hours',now()-interval '11 minutes')`,
        [person.id],
      );
  } finally {
    await pool.end();
  }
}

/** Each student's status as the cockpit shows it now, by person. */
const rowStatuses = (page: Page) =>
  page.evaluate(() => {
    const out: Record<string, { status: string; text: string }> = {};
    for (const cell of document.querySelectorAll<HTMLElement>(
      "[data-live-row]",
    )) {
      const row = (cell.closest("tr") ?? cell) as HTMLElement;
      out[cell.dataset.liveRow!] = {
        status:
          row.querySelector("svg[data-status]")?.getAttribute("data-status") ??
          "",
        text: row.innerText,
      };
    }
    return out;
  });

/** The names the report lists under each "Follow up first" group. */
const reportGroups = (page: Page) =>
  page.evaluate(() => {
    const out: Record<string, string[]> = {};
    for (const group of document.querySelectorAll<HTMLElement>("[data-group]"))
      out[group.dataset.group!] = [
        ...group.querySelectorAll<HTMLElement>("ul > li"),
      ]
        .map((item) => (item.firstElementChild?.textContent ?? "").trim())
        .sort();
    return out;
  });

/**
 * The report tells the story the cockpit told when it stopped: whoever's
 * row read anything but "Not signed in" is never under "Didn't sign in"
 * (a student signed in before Start who answered nothing is "Signed in, no
 * answers"), and whoever's row read "Not signed in" is.
 */
function reportAgrees(
  where: string,
  rows: Record<string, { status: string; text: string }>,
  names: Record<string, string>,
  groups: Record<string, string[]>,
) {
  const shown = Object.entries(rows).map(([id, row]) => ({
    name: names[id] ?? id,
    ...row,
  }));
  const didnt = groups["not-signed-in"] ?? [];
  const quiet = groups["no-answers"] ?? [];
  const here = shown.filter((row) => row.status !== "not_signed_in");
  const wrong = here.filter((row) => didnt.includes(row.name));
  if (wrong.length)
    fail(
      `${where}: the report lists under "Didn't sign in" students whose row read ${wrong.map((row) => `${row.name}: ${row.status}`).join(", ")} at Stop`,
    );
  const missing = shown.filter(
    (row) => row.status === "not_signed_in" && !didnt.includes(row.name),
  );
  if (missing.length)
    fail(
      `${where}: not signed in at Stop, but not under "Didn't sign in": ${missing.map((row) => row.name).join(", ")}`,
    );
  const unanswered = here.filter((row) => /No answers yet/.test(row.text));
  const unfiled = unanswered.filter((row) => !quiet.includes(row.name));
  if (unfiled.length)
    fail(
      `${where}: here with no answers at Stop, but not under "Signed in, no answers": ${unfiled.map((row) => row.name).join(", ")}`,
    );
  console.log(
    `${where}: at Stop ${here.length} here (${unanswered.map((row) => row.name).join(", ") || "nobody"} with no answers), ${shown.length - here.length} not signed in; the report: didn't sign in [${didnt.join(", ")}], signed in, no answers [${quiet.join(", ")}]`,
  );
}

/** The wall board counts who is here as the cockpit does, at the same
 * moment: the same students, by the same rule. */
async function boardAgrees(page: Page, today: string, where: string) {
  const board = await page.context().newPage();
  try {
    await board.goto(`${origin}${today.replace(/\/today$/, "/start")}`, {
      waitUntil: "domcontentloaded",
    });
    const count = board.getByText(/^\d+ of \d+ here$/);
    await count.waitFor({ timeout: 20_000 });
    let last = { board: "", cockpit: "" };
    // Each polls on its own clock: a few seconds to read the same moment.
    for (let attempt = 0; attempt < 8; attempt++) {
      last = {
        board: ((await count.textContent()) ?? "").trim(),
        cockpit:
          (await page
            .locator('[data-tile="here"] dd')
            .first()
            .getAttribute("aria-label")) ?? "",
      };
      if (last.board === last.cockpit) break;
      await page.waitForTimeout(1500);
    }
    console.log(
      `${where}: the board reads "${last.board}", the cockpit "${last.cockpit}"`,
    );
    if (last.board !== last.cockpit)
      fail(
        `${where}: the wall board reads "${last.board}" while the cockpit reads "${last.cockpit}"`,
      );
    await shot(board, `board-${where.replace(/\D/g, "")}`);
  } finally {
    await board.close();
  }
}

// ---- pages ---------------------------------------------------------------
async function teacherState(browser: Browser) {
  const context = await browser.newContext();
  const response = await context.request.post(
    `${origin}/api/auth/sign-in/email`,
    {
      headers: { Origin: origin },
      data: {
        email: personaEmail("teacher-class"),
        password: PERSONA_PASSPHRASE,
      },
    },
  );
  assert.ok(response.ok(), `the teacher signs in: ${response.status()}`);
  const state = await context.storageState();
  await context.close();
  return state;
}

/** Layout shifts without input, from the page's start. */
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
        "[data-cockpit], [data-session-report]",
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
    put("key", document.querySelector("[data-live-roster] [data-help-key]"));
    for (const tile of document.querySelectorAll<HTMLElement>("[data-tile]"))
      put(`tile:${tile.dataset.tile}`, tile);
    // Rows: the grid's (inside its own scroll: measured against it) or the
    // list's.
    for (const cell of document.querySelectorAll<HTMLElement>(
      "[data-live-row]",
    ))
      put(`row:${cell.dataset.liveRow}`, cell.closest("tr") ?? cell);
    return out;
  });
/** What a row shows, by person, without its clock ("now", "33s",
 * "2 min"), which changes every second: a change is new data. */
const rowTexts = (page: Page) =>
  page.evaluate(() => {
    const out: Record<string, string> = {};
    for (const cell of document.querySelectorAll<HTMLElement>(
      "[data-live-row]",
    ))
      out[cell.dataset.liveRow!] = (
        (cell.closest("tr") ?? cell) as HTMLElement
      ).innerText.replace(/\b(now|\d+s|\d+ min|\d+ h)\b/g, "");
    return out;
  });

function compareBoxes(
  where: string,
  before: Record<string, Box>,
  after: Record<string, Box>,
) {
  for (const [name, box] of Object.entries(before)) {
    const next = after[name];
    if (!next) continue; // a row that left (never in a class of 14)
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

// ---- 1. cold loads -------------------------------------------------------
async function coldLoad(
  browser: Browser,
  state: Awaited<ReturnType<typeof teacherState>>,
  path: string,
  name: string,
) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    storageState: state,
  });
  // tsx names functions with a helper the page lacks.
  await context.addInitScript("globalThis.__name ??= (f) => f;");
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
    .waitForSelector("[data-cockpit], [data-session-report]", {
      timeout: 60_000,
    })
    .catch(() => undefined);
  await page.waitForTimeout(2500);
  const frames = (await page.evaluate(
    () => (window as unknown as { __frames: Frame[] }).__frames,
  )) as Frame[];
  const cls = (await shifts(page)).reduce((sum, s) => sum + s.value, 0);
  await context.close();
  // Up to the destination's first frame: what follows is the screen at
  // work (a live roster changes by itself), not the load.
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
  // One neutral frame at most: a wait with no words, never another screen.
  if (states.length === 2 && states[0]!.text !== "")
    fail(`cold ${name}: the first frame showed something else: ${trail}`);
  if (new Set(states.map((s) => s.tab)).size > 1)
    fail(`cold ${name}: the current tab changed: ${trail}`);
  const titles = new Set(states.map((s) => s.title).filter(Boolean));
  if (titles.size > 1) fail(`cold ${name}: the title changed: ${trail}`);
  if (cls > 0.001) fail(`cold ${name}: layout shift ${cls.toFixed(4)}`);
}

// ---- 2. start → updates → stop, one width ---------------------------------
async function openToday(
  browser: Browser,
  state: Awaited<ReturnType<typeof teacherState>>,
  path: string,
  width: number,
  options: { dark?: boolean; record?: boolean; ready?: string } = {},
) {
  const context = await browser.newContext({
    viewport: { width, height: height(width) },
    storageState: state,
    colorScheme: options.dark ? "dark" : "light",
    ...(options.record && video
      ? { recordVideo: { dir: video, size: { width, height: height(width) } } }
      : {}),
  });
  // tsx names functions with a helper the page lacks.
  await context.addInitScript("globalThis.__name ??= (f) => f;");
  await context.addInitScript(recorder);
  const page = await context.newPage();
  page.on("pageerror", (error) =>
    fail(`${width}px page error: ${error.message}`),
  );
  await page
    .goto(origin + path, { waitUntil: "networkidle" })
    .catch(() => undefined);
  await page.waitForSelector(options.ready ?? "[data-cockpit]");
  return { context, page };
}

async function liveRun(
  browser: Browser,
  state: Awaited<ReturnType<typeof teacherState>>,
  today: string,
  token: string,
  classId: string,
  width: number,
) {
  await rest(token, classId);
  const { context, page } = await openToday(browser, state, today, width, {
    record: width === 390 || width === 1280,
  });
  await page.waitForSelector('[data-cockpit="resting"]');
  await shot(page, `resting-${width}`);
  const above = await boxes(page);
  await page.getByRole("button", { name: "Start class" }).first().click();
  await page.waitForSelector('[data-cockpit="live"] [data-live-roster]');
  await page.waitForTimeout(1500);
  const started = await boxes(page);
  // The bar keeps its place (on a desktop it gives the totals room beside
  // it, so its width may change; never where it is).
  for (const name of ["header", "control"]) {
    const before = above[name];
    const after = started[name];
    // On a phone the header gives the code one short row while a session
    // runs (L8): the bar comes up under the title, once, at the tap, so the
    // live roster starts on the first screen. It never moves down or
    // sideways; from 560 px nothing moves.
    const phoneBar = name === "control" && width < 560;
    if (
      before?.x !== after?.x ||
      (phoneBar ? (after?.y ?? 0) > (before?.y ?? 0) : before?.y !== after?.y)
    )
      fail(`${width}px: starting moved ${name}`);
  }
  if (width === 390) {
    // The first screen holds the Live bar, the totals, the requests strip
    // and at least four students without scrolling.
    const first = await page.evaluate((viewport) => {
      const rows = [
        ...document.querySelectorAll<HTMLElement>("[data-live-row]"),
      ];
      return {
        rowsShown: rows.filter(
          (row) => row.getBoundingClientRect().bottom <= viewport,
        ).length,
        stripShown:
          (document.querySelector("[data-live-strip]")?.getBoundingClientRect()
            .bottom ?? Infinity) <= viewport,
      };
    }, height(width));
    console.log(
      `390px: first screen shows ${first.rowsShown} students, strip ${first.stripShown}`,
    );
    if (first.rowsShown < 4 || !first.stripShown)
      fail(
        `390px: the first screen shows ${first.rowsShown} students (needs 4) and the strip ${first.stripShown}`,
      );
  }
  await shot(page, `started-${width}`);
  // The help drawings have their key wherever a row shows them (a tablet's
  // and a desktop's rows; a class's phone rows show none), from the moment
  // the roster does: it is one of the boxes that must hold still below.
  const helpShown = await page.evaluate(
    () =>
      document.querySelectorAll(
        '[data-live-roster] [role="img"][aria-label^="Help"]',
      ).length,
  );
  const keyTerms = await page.evaluate(() =>
    [...document.querySelectorAll("[data-live-roster] [data-help-key] li")].map(
      (item) => item.textContent ?? "",
    ),
  );
  if (
    helpShown > 0 &&
    keyTerms.join(",") !== "Hints,Lessons,Explanations,Videos"
  )
    fail(
      `${width}px: ${helpShown} rows show help drawings and the key says ${JSON.stringify(keyTerms)}`,
    );
  if (helpShown === 0 && keyTerms.length > 0)
    fail(`${width}px: a key to help drawings no row shows`);
  // From here on, nothing moves until Stop.
  const from = await now(page);
  let before = await boxes(page);
  let texts = await rowTexts(page);
  let updates = 0;
  let rounds = 0;
  const named = { read: 0, whole: 0, cut: 0, clipped: 0 };
  const names = async () => {
    const result = await skillNames(page);
    named.read += result.total;
    named.whole += result.whole;
    named.cut += result.cut;
    named.clipped += result.clipped;
    for (const failure of result.failures.slice(0, 5))
      fail(`${width}px: ${failure}`);
  };
  const deadline = Date.now() + 8 * 60_000;
  while (updates < UPDATES && Date.now() < deadline) {
    await page.waitForTimeout(400);
    // The names change as students move on: read as they do.
    if (rounds++ % 15 === 0) await names();
    const next = await rowTexts(page);
    for (const [id, text] of Object.entries(next))
      if (texts[id] !== undefined && texts[id] !== text) updates++;
    texts = next;
    const after = await boxes(page);
    compareBoxes(`${width}px after ${updates} updates`, before, after);
    before = after;
  }
  if (updates < UPDATES)
    fail(`${width}px: only ${updates} row updates arrived`);
  await names();
  if (named.read === 0) fail(`${width}px: no skill was named`);
  if (width >= 390 && named.clipped > 0)
    fail(`${width}px: ${named.clipped} name(s) cut inside a word`);
  // Two open requests both show from 390 px, and only a third brings "+N".
  const open = (
    (await call(token, "GET", `/school/classes/${classId}/live`)) as {
      signals: unknown[];
    }
  ).signals.length;
  const strip = await page.evaluate(() => {
    const strip = document.querySelector("[data-live-strip]");
    return {
      shown: strip?.querySelectorAll("[data-signal]").length ?? 0,
      more: [...(strip?.querySelectorAll("button") ?? [])].some((button) =>
        /^\+\d+$/.test(button.textContent ?? ""),
      ),
    };
  });
  console.log(
    `${width}px: ${named.read} skill names read, ${named.whole} whole, ${named.cut} cut after a whole word, ${named.clipped} with a first word wider than the line; ${open} request(s) open, ${strip.shown} shown${strip.more ? ' and "+N"' : ""}`,
  );
  if (width >= 390 && open === 2 && (strip.shown !== 2 || strip.more))
    fail(`${width}px: 2 requests open, ${strip.shown} shown`);
  if (strip.more !== strip.shown < open)
    fail(`${width}px: ${open} open, ${strip.shown} shown, "+N" ${strip.more}`);
  // Requests: answer whatever is open (a hand, a forgotten picture).
  for (const name of ["Got it", "Reset"]) {
    const button = page
      .locator("[data-live-strip] button")
      .filter({ hasText: name })
      .first();
    if (await button.isVisible().catch(() => false)) {
      await button.click();
      await page.waitForTimeout(1500);
    }
  }
  const moved = (await shifts(page)).filter((s) => s.at > from);
  const cls = moved.reduce((sum, s) => sum + s.value, 0);
  console.log(`${width}px: ${updates} row updates, CLS ${cls.toFixed(4)}`);
  if (cls > 0) fail(`${width}px: layout shift ${cls.toFixed(4)} while live`);
  await shot(page, `live-${width}`);
  // A cut name's tap shows all of it over the page, and nothing moves.
  await cutNameOpens(page, () => boxes(page), failures, `${width}px`);
  if (width === 1280) await layerKeepsCockpit(page);
  // The wall board and the cockpit count the same students here.
  if (width === 1280) await boardAgrees(page, today, `${width}px`);
  const whoIs = Object.fromEntries(
    (
      (await call(token, "GET", `/school/classes/${classId}/live`)) as {
        rows: { personId: string; name: string }[];
      }
    ).rows.map((row) => [row.personId, row.name]),
  );
  // Stop asks first, then opens the report: one move, never the cockpit
  // at rest or its "ended" bar for a frame on the way.
  await page.getByRole("button", { name: "Stop" }).click();
  // The rows as they stand at the moment of Stop.
  const atStop = await rowStatuses(page);
  await watchStop(page);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Stop session" })
    .click();
  await page.waitForSelector("[data-session-report]", { timeout: 20_000 });
  const stopped = await stopTrail(page);
  console.log(`${width}px: Stop: ${stopped.trail}`);
  for (const problem of stopped.problems) fail(`${width}px: ${problem}`);
  if (!/\/sessions\/[0-9a-f-]+$/.test(new URL(page.url()).pathname))
    fail(`${width}px: Stop landed on ${page.url()}`);
  await page.waitForTimeout(800);
  reportAgrees(`${width}px`, atStop, whoIs, await reportGroups(page));
  await shot(page, `report-${width}`);
  await reportRows(page, `${width}px`);
  const report = new URL(page.url()).pathname;
  const file = await page.video()?.path();
  await context.close();
  if (file && video)
    await rename(file, `${video}/start-to-report-${width}.webm`);
  return report;
}

/** The report's "Every student" scans: every row is one height whatever
 * the student did; its Skills cell names the first skills that fit, whole,
 * then how many more (never cut, never a hover title); the help drawings
 * have their key; a row opens that student's sheet with every skill; and on
 * paper every skill's name prints beside its student. */
async function reportRows(page: Page, where: string) {
  const read = () =>
    page.evaluate(() => {
      const report = document.querySelector("[data-session-report]")!;
      const every = report.querySelector('[aria-labelledby="every-student"]')!;
      const rows = [
        ...every.querySelectorAll<HTMLElement>(
          "tbody tr[role=row], ul[aria-label]:not([data-key]) > li",
        ),
      ].filter((row) => row.getClientRects().length > 0);
      const lists = [
        ...every.querySelectorAll<HTMLElement>("[data-fit-list]"),
      ].filter((list) => list.getClientRects().length > 0);
      const problems: string[] = [];
      for (const list of lists) {
        const frame = list.getBoundingClientRect();
        const shown = [...list.querySelectorAll("[data-fit-item]")];
        const more = list.querySelector("[data-fit-more]")?.textContent ?? "";
        const hidden = Number(list.dataset.fitTotal) - shown.length;
        if (hidden > 0 && shown.length > 0 && more.trim() !== `+${hidden} more`)
          problems.push(
            `${shown.length} of ${list.dataset.fitTotal} shown, then "${more}"`,
          );
        if (/…/.test(list.textContent ?? ""))
          problems.push(`a skill's name is cut: ${list.textContent}`);
        for (const part of [
          ...shown,
          ...list.querySelectorAll("[data-fit-more]"),
        ])
          for (const rect of part.getClientRects())
            if (
              rect.right > frame.right + 0.5 ||
              rect.bottom > frame.bottom + 0.5
            ) {
              problems.push(`"${part.textContent}" runs past its cell`);
              break;
            }
      }
      const printed = [
        ...every.querySelectorAll<HTMLElement>("[data-report-open]"),
      ]
        // Rows that name skills, in the lists' own order.
        .filter(
          (cell) =>
            cell.getClientRects().length > 0 &&
            cell.querySelector("[data-fit-list]") !== null,
        )
        .map((cell) =>
          [...cell.children]
            .filter(
              (part) =>
                getComputedStyle(part).display !== "none" &&
                !part.matches("[data-fit-list]"),
            )
            .map((part) => part.textContent ?? "")
            .join(""),
        );
      const hover = every.querySelectorAll("[title]").length;
      if (hover) problems.push(`${hover} hover title(s)`);
      return {
        heights: [
          ...new Set(
            rows.map(
              (row) => Math.round(row.getBoundingClientRect().height * 10) / 10,
            ),
          ),
        ],
        rows: rows.length,
        lists: lists.length,
        most: Math.max(
          0,
          ...lists.map((list) => Number(list.dataset.fitTotal)),
        ),
        totals: lists.map((list) => Number(list.dataset.fitTotal)),
        printed,
        key: [
          ...(report.querySelector("[data-help-key]")?.querySelectorAll("li") ??
            []),
        ].map((item) => item.textContent ?? ""),
        problems: [...new Set(problems)],
        tableScrolls: every.querySelector("[data-scrolls]") !== null,
        sideways:
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      };
    });
  const screen = await read();
  for (const problem of screen.problems) fail(`${where} report: ${problem}`);
  if (screen.heights.length !== 1)
    fail(
      `${where} report: rows are ${Math.min(...screen.heights)} to ${Math.max(...screen.heights)} px tall (one height wanted)`,
    );
  if (screen.lists === 0)
    fail(`${where} report: no student's skills are named`);
  if (screen.key.join(",") !== "Hints,Lessons,Explanations,Videos")
    fail(
      `${where} report: the help drawings' key says ${JSON.stringify(screen.key)}`,
    );
  if (screen.sideways > 0)
    fail(`${where} report: the page scrolls sideways by ${screen.sideways}px`);
  if (screen.tableScrolls)
    fail(`${where} report: the table scrolls sideways inside the page`);
  // A row opens that student's sheet, with every skill of theirs.
  const row = page
    .locator('[aria-labelledby="every-student"]')
    .locator("tbody tr[role=row], ul[aria-label]:not([data-key]) > li")
    .filter({ has: page.locator("[data-fit-list]") })
    .first();
  const expected = Number(
    await row.locator("[data-fit-list]").getAttribute("data-fit-total"),
  );
  const url = page.url();
  await row.locator("[data-report-open]").click();
  const sheet = page.getByRole("dialog");
  await sheet.waitFor({ timeout: 5_000 });
  const listed = await sheet.locator("[data-report-student-skills] li").count();
  if (listed !== expected)
    fail(`${where} report: the sheet lists ${listed} of ${expected} skills`);
  if (page.url() !== url)
    fail(`${where} report: the sheet changed the address`);
  await page.goBack();
  await sheet.waitFor({ state: "detached", timeout: 5_000 });
  const after = await read();
  if (after.heights.join() !== screen.heights.join())
    fail(`${where} report: the rows changed height after the sheet`);
  // On paper every name prints: each row's whole list in place of the
  // fitted one (a list of n names has at least n - 1 commas; a name may
  // have its own).
  await page.emulateMedia({ media: "print" });
  const paper = await read();
  const short = paper.printed.filter(
    (text, index) =>
      (text.trim() ? text.split(", ").length : 0) < (screen.totals[index] ?? 0),
  ).length;
  const total = screen.totals.reduce((sum, count) => sum + count, 0);
  if (paper.printed.length !== screen.totals.length || short > 0)
    fail(
      `${where} report on paper: ${short} of ${screen.totals.length} rows print fewer names than they have`,
    );
  await page.emulateMedia({ media: "screen" });
  console.log(
    `${where}: the report's ${screen.rows} rows are ${screen.heights.join("/")} px; the most skills in one is ${screen.most}; a row's sheet lists all ${expected} of its skills; on paper each row's whole list prints (${total} skills); the key is there`,
  );
}

// ---- 3. a student layer leaves the cockpit as it was ------------------------
async function layerKeepsCockpit(page: Page) {
  // Sort by problems (a header), scroll the roster a little.
  await page
    .getByRole("button", { name: /^Problems/ })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const box = document.querySelector("[data-live-roster] > div");
    if (box) box.scrollTop = 120;
  });
  const read = () =>
    page.evaluate(() => ({
      page: window.scrollY,
      roster:
        document.querySelector("[data-live-roster] > div")?.scrollTop ?? -1,
      sorted:
        document
          .querySelector("[data-live-roster] [aria-sort]:not([aria-sort=none])")
          ?.textContent?.trim() ?? "",
      order: [...document.querySelectorAll<HTMLElement>("[data-live-row]")]
        .map((row) => row.dataset.liveRow)
        .join(","),
    }));
  const before = await read();
  const link = page.locator("[data-live-row] a").nth(3);
  await link.click();
  await page.waitForSelector('[role="dialog"]');
  await page.waitForTimeout(600);
  await page.keyboard.press("Escape");
  await page.waitForSelector('[role="dialog"]', { state: "detached" });
  await page.waitForTimeout(400);
  const after = await read();
  console.log(
    `layer: sorted "${before.sorted}", roster scroll ${before.roster} → ${after.roster}, page ${before.page} → ${after.page}`,
  );
  if (before.roster !== after.roster || before.page !== after.page)
    fail(
      `the student layer moved the cockpit: ${JSON.stringify({ before, after })}`,
    );
  if (before.sorted !== after.sorted || before.order !== after.order)
    fail("the student layer changed the cockpit's sort or order");
}

// ---- 4. a session that ends by its own time ------------------------------
async function endsOnItsOwn(
  browser: Browser,
  state: Awaited<ReturnType<typeof teacherState>>,
  today: string,
  token: string,
  classId: string,
) {
  await rest(token, classId);
  await call(token, "POST", `/school/classes/${classId}/sessions`, {
    minutes: 1,
  });
  const pages = await Promise.all(
    [390, 1280].map((width) => openToday(browser, state, today, width)),
  );
  const marks = await Promise.all(
    pages.map(async ({ page }) => {
      await page.waitForSelector('[data-cockpit="live"]');
      await page.waitForTimeout(1000);
      return { from: await now(page), boxes: await boxes(page) };
    }),
  );
  for (const [index, { page, context }] of pages.entries()) {
    const width = index ? 1280 : 390;
    await page.waitForSelector('[data-cockpit="ended"]', { timeout: 120_000 });
    await page.waitForTimeout(1000);
    const after = await boxes(page);
    for (const name of ["header", "control", "totals", "strip", "roster"])
      if (
        JSON.stringify(marks[index]!.boxes[name]) !==
        JSON.stringify(after[name])
      )
        fail(`${width}px: ending on its own moved ${name}`);
    const cls = (await shifts(page))
      .filter((s) => s.at > marks[index]!.from)
      .reduce((sum, s) => sum + s.value, 0);
    console.log(`${width}px: ended on its own, CLS ${cls.toFixed(4)}`);
    if (cls > 0)
      fail(`${width}px: ending on its own shifted ${cls.toFixed(4)}`);
    const report = page.getByRole("link", { name: "See the report" });
    if (!(await report.isVisible()))
      fail(`${width}px: ended without its report link`);
    await shot(page, `ended-${width}`);
    await context.close();
  }
}

// ---- dark and the other widths' stills -------------------------------------
async function stills(
  browser: Browser,
  state: Awaited<ReturnType<typeof teacherState>>,
  today: string,
  report: string,
  token: string,
  classId: string,
) {
  if (!shots) return;
  const time = today.replace(/\/today$/, "/time");
  for (const dark of [false, true])
    for (const width of [390, 1280]) {
      const suffix = `${width}${dark ? "-dark" : ""}`;
      const { context, page } = await openToday(browser, state, report, width, {
        dark,
        ready: "[data-session-report]",
      });
      await page.waitForTimeout(800);
      await shot(page, `report-${suffix}`);
      await page.goto(origin + time, { waitUntil: "load" });
      await page.waitForSelector("#class-sessions");
      await page.waitForTimeout(800);
      await page.locator("#class-sessions").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${shots}/sessions-${suffix}.png` });
      await context.close();
    }
  // The report on paper: the sheet itself (Letter), and the same layout as
  // a picture at the sheet's width.
  {
    const { context, page } = await openToday(browser, state, report, 1280, {
      ready: "[data-session-report]",
    });
    await page.waitForTimeout(800);
    await page.emulateMedia({ media: "print" });
    await writeFile(
      `${shots}/report-print.pdf`,
      await page.pdf({ format: "Letter", printBackground: true }),
    );
    await page.setViewportSize({ width: 816, height: 1056 });
    await page.waitForTimeout(400);
    await shot(page, "report-print");
    await context.close();
  }
  // Resting and busy, dark; just started, every width already.
  await rest(token, classId);
  for (const width of [390, 1280]) {
    const { context, page } = await openToday(browser, state, today, width, {
      dark: true,
    });
    await page.waitForSelector('[data-cockpit="resting"]');
    await shot(page, `resting-${width}-dark`);
    await context.close();
  }
  await call(token, "POST", `/school/classes/${classId}/sessions`, {});
  await new Promise((resolve) => setTimeout(resolve, 30_000));
  for (const width of [390, 1280]) {
    const { context, page } = await openToday(browser, state, today, width, {
      dark: true,
    });
    await page.waitForSelector('[data-cockpit="live"]');
    await page.waitForTimeout(2000);
    await shot(page, `live-${width}-dark`);
    await context.close();
  }
  for (const width of [320, 768]) {
    const { context, page } = await openToday(browser, state, report, width, {
      ready: "[data-session-report]",
    });
    await page.waitForTimeout(800);
    await shot(page, `report-${width}`);
    await context.close();
  }
  await rest(token, classId);
}

// ---- run -----------------------------------------------------------------
/** What the run proved, in a sentence. */
async function run(browser: Browser) {
  const { today, token } = await simulate(30);
  const classId = today.split("/")[4]!;
  const state = await teacherState(browser);
  await rest(token, classId);
  await seenEarlierToday(classId);
  if (flag("stills-only")) {
    // The newest stopped session's report, for the stills alone.
    const list = (await call(
      token,
      "GET",
      `/school/classes/${classId}/sessions`,
    )) as {
      sessions: { id: string; endedAt: string | null }[];
    };
    const last = list.sessions.find((entry) => entry.endedAt);
    assert.ok(last, "a stopped session to show");
    await stills(
      browser,
      state,
      today,
      today.replace(/\/today$/, `/sessions/${last.id}`),
      token,
      classId,
    );
    return `Stills in ${shots}.`;
  }
  await coldLoad(browser, state, today, "Today at rest");
  let report = "";
  for (const width of WIDTHS) {
    const at = await liveRun(browser, state, today, token, classId, width);
    report ||= at;
    if (width === 1280) report = at;
  }
  await coldLoad(browser, state, report, "a session's report");
  await call(token, "POST", `/school/classes/${classId}/sessions`, {});
  await coldLoad(browser, state, today, "Today live");
  if (!flag("skip-ended"))
    await endsOnItsOwn(browser, state, today, token, classId);
  await stills(browser, state, today, report, token, classId);
  await rest(token, classId);
  return "The live cockpit screen holds still, loads in one frame and reports.";
}

if (shots) await mkdir(shots, { recursive: true });
if (video) await mkdir(video, { recursive: true });
const browser = await chromium.launch();
let failed = false;
try {
  const proved = await run(browser);
  assert.deepEqual(failures, [], failures.join("\n"));
  console.log(proved);
} catch (error) {
  failed = true;
  console.error(error);
} finally {
  await browser.close();
  if (sim?.pid && sim.exitCode === null) process.kill(-sim.pid, "SIGTERM");
  // The check's own stack: its servers stop and its schema goes.
  await stack?.stop();
}
process.exit(failed ? 1 : 0);
