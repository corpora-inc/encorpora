/**
 * A class's Today as the live cockpit (#2465, round 2026-11-20 L7 + L5),
 * against a simulated class of 14 on a running, seeded preview:
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
 *    opens that session's report.
 * 3. At 1280 px: the roster scrolled and sorted, a student opened as the
 *    student layer and closed, and the roster's scroll, the page's and the
 *    sort are exactly as they were.
 * 4. At 390 and 1280 px side by side: a session planned to end in a minute
 *    ends on screen by itself: the page shows it ended, with its report one
 *    tap away, and nothing moves.
 *
 *   AMP_SIM_DATABASE_URL=postgres://amp:amp@127.0.0.1:55490/<db> \
 *     npx tsx scripts/verify-live-cockpit-screen-ui.ts \
 *       --origin http://127.0.0.1:4830 --api http://127.0.0.1:4831
 *       [--shots <dir>]   every state at 390 and 1280 light and dark, and
 *                         live and the report at 320 and 768
 *       [--video <dir>]   a recording of the 390 and 1280 runs
 *       [--updates 200] [--skip-ended]
 *
 * The simulator (scripts/live-class-sim.ts) makes and reuses only its own
 * org and class, and is loopback-only.
 */
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, rename } from "node:fs/promises";
import {
  chromium as rawChromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";
import { secureChromium } from "../browser-security.mjs";
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
const video = arg("video");
const UPDATES = Number(arg("updates") ?? 200);
const database = process.env.AMP_SIM_DATABASE_URL;
if (!origin || !database)
  throw new Error("--origin and AMP_SIM_DATABASE_URL are required");
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

async function call(token: string, method: string, path: string, body?: unknown) {
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
  const live = (await call(token, "GET", `/school/classes/${classId}/live`)) as {
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

// ---- pages ---------------------------------------------------------------
async function teacherState(browser: Browser) {
  const context = await browser.newContext();
  const response = await context.request.post(
    `${origin}/api/auth/sign-in/email`,
    {
      headers: { Origin: origin! },
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

function compareBoxes(where: string, before: Record<string, Box>, after: Record<string, Box>) {
  for (const [name, box] of Object.entries(before)) {
    const next = after[name];
    if (!next) continue; // a row that left (never in a class of 14)
    if (
      box.x !== next.x ||
      box.y !== next.y ||
      box.width !== next.width ||
      box.height !== next.height
    ) {
      fail(`${where}: ${name} moved ${JSON.stringify(box)} → ${JSON.stringify(next)}`);
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
    fail(`cold ${name}: ${states.length - 1} changes after the frame: ${trail}`);
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
  options: { dark?: boolean; record?: boolean } = {},
) {
  const context = await browser.newContext({
    viewport: { width, height: height(width) },
    storageState: state,
    colorScheme: options.dark ? "dark" : "light",
    ...(options.record && video
      ? { recordVideo: { dir: video, size: { width, height: height(width) } } }
      : {}),
  });
  await context.addInitScript(recorder);
  const page = await context.newPage();
  page.on("pageerror", (error) => fail(`${width}px page error: ${error.message}`));
  await page.goto(origin + path, { waitUntil: "networkidle" }).catch(() => undefined);
  await page.waitForSelector("[data-cockpit]");
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
  for (const name of ["header", "control"])
    if (JSON.stringify(above[name]) !== JSON.stringify(started[name]))
      fail(`${width}px: starting moved ${name}`);
  await shot(page, `started-${width}`);
  // From here on, nothing moves until Stop.
  const from = await now(page);
  let before = await boxes(page);
  let texts = await rowTexts(page);
  let updates = 0;
  const deadline = Date.now() + 8 * 60_000;
  while (updates < UPDATES && Date.now() < deadline) {
    await page.waitForTimeout(400);
    const next = await rowTexts(page);
    for (const [id, text] of Object.entries(next))
      if (texts[id] !== undefined && texts[id] !== text) updates++;
    texts = next;
    const after = await boxes(page);
    compareBoxes(`${width}px after ${updates} updates`, before, after);
    before = after;
  }
  if (updates < UPDATES) fail(`${width}px: only ${updates} row updates arrived`);
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
  if (width === 1280) await layerKeepsCockpit(page);
  // Stop asks first, then opens the report.
  await page.getByRole("button", { name: "Stop" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Stop session" }).click();
  await page.waitForSelector("[data-session-report]", { timeout: 20_000 });
  if (!/\/sessions\/[0-9a-f-]+$/.test(new URL(page.url()).pathname))
    fail(`${width}px: Stop landed on ${page.url()}`);
  await page.waitForTimeout(800);
  await shot(page, `report-${width}`);
  const report = new URL(page.url()).pathname;
  const file = await page.video()?.path();
  await context.close();
  if (file && video) await rename(file, `${video}/start-to-report-${width}.webm`);
  return report;
}

// ---- 3. a student layer leaves the cockpit as it was ------------------------
async function layerKeepsCockpit(page: Page) {
  // Sort by problems (a header), scroll the roster a little.
  await page.getByRole("button", { name: /^Problems/ }).first().click();
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
    fail(`the student layer moved the cockpit: ${JSON.stringify({ before, after })}`);
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
      if (JSON.stringify(marks[index]!.boxes[name]) !== JSON.stringify(after[name]))
        fail(`${width}px: ending on its own moved ${name}`);
    const cls = (await shifts(page))
      .filter((s) => s.at > marks[index]!.from)
      .reduce((sum, s) => sum + s.value, 0);
    console.log(`${width}px: ended on its own, CLS ${cls.toFixed(4)}`);
    if (cls > 0) fail(`${width}px: ending on its own shifted ${cls.toFixed(4)}`);
    const report = page.getByRole("link", { name: "See the report" });
    if (!(await report.isVisible())) fail(`${width}px: ended without its report link`);
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
      const { context, page } = await openToday(browser, state, report, width, { dark });
      await page.waitForTimeout(800);
      await shot(page, `report-${suffix}`);
      await page.goto(origin + time, { waitUntil: "networkidle" });
      await page.waitForSelector("#class-sessions");
      await page.locator("#class-sessions").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${shots}/sessions-${suffix}.png` });
      await context.close();
    }
  // Resting and busy, dark; just started, every width already.
  await rest(token, classId);
  for (const width of [390, 1280]) {
    const { context, page } = await openToday(browser, state, today, width, { dark: true });
    await page.waitForSelector('[data-cockpit="resting"]');
    await shot(page, `resting-${width}-dark`);
    await context.close();
  }
  await call(token, "POST", `/school/classes/${classId}/sessions`, {});
  await new Promise((resolve) => setTimeout(resolve, 30_000));
  for (const width of [390, 1280]) {
    const { context, page } = await openToday(browser, state, today, width, { dark: true });
    await page.waitForSelector('[data-cockpit="live"]');
    await page.waitForTimeout(2000);
    await shot(page, `live-${width}-dark`);
    await context.close();
  }
  for (const width of [320, 768]) {
    const { context, page } = await openToday(browser, state, report, width);
    await page.waitForTimeout(800);
    await shot(page, `report-${width}`);
    await context.close();
  }
  await rest(token, classId);
}

// ---- run -----------------------------------------------------------------
if (shots) await mkdir(shots, { recursive: true });
if (video) await mkdir(video, { recursive: true });
const browser = await chromium.launch();
try {
  const { today, token } = await simulate(30);
  const classId = today.split("/")[4]!;
  const state = await teacherState(browser);
  await rest(token, classId);
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
} finally {
  await browser.close();
  if (sim?.pid && sim.exitCode === null) process.kill(-sim.pid, "SIGTERM");
}
assert.deepEqual(failures, [], failures.join("\n"));
console.log("The live cockpit screen holds still, loads in one frame and reports.");
