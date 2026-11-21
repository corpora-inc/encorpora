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
type Person = { family: string; classId: string; token: string };
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
  return {
    family,
    token,
    classId: data.children[0].classes[0].id as string,
  };
}
/** No session running: a run starts from rest. */
async function rest(who: Person) {
  const live = await call(
    who.token,
    "GET",
    `/school/classes/${who.classId}/live`,
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
  const deadline = Date.now() + 5 * 60_000;
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
  if (updates < UPDATES)
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
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Stop session" })
    .click();
  await page.waitForSelector("[data-session-report]", { timeout: 20_000 });
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
  await shot(page, `${tag}-report-${width}`);
  if (width === WIDTHS.at(-1)) await printsReport(page, tag);
  stopSim();
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
      await first.page.waitForSelector('[data-family-live="rest"]');
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
  await endedAndStills(browser, threeState, three, "family");
  await rest(three);
} finally {
  stopSim();
  await browser.close();
}
assert.deepEqual(failures, [], failures.join("\n"));
console.log(
  "A family's live session holds still, loads in one frame and reports.",
);
