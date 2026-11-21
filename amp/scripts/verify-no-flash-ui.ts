/**
 * No flash (amp/AGENTS.md, "Interface acceptance"): a cold load of any
 * address paints at most one neutral frame (the boot wave, or the
 * destination's own frame with its skeleton) and then the destination.
 * Never another screen, another place's bar or tabs, a heading or title
 * that changes, a sign-in or first-run screen on the way, or a redirect hop
 * after the first paint; at most one hop at all, and no layout shift once
 * the destination has painted.
 *
 * For each person (an adult's own practice, a family's parent and second
 * parent, a tutor, a teacher, a school's admin, a signed-in student and
 * someone signed out) and every route of the router's own table they can
 * fill in (`window.ampRouteTable`; scripts/route-addresses.ts, as the
 * navigation crawl reads it), the address is loaded in a new tab on a slow
 * phone (the CPU 4x slower, a slow network) at each width, and every change
 * of the screen's identity is recorded: the address, the title, the bar's
 * place and tabs, the main landmark and the heading. A table of offenders
 * prints with what they showed in order.
 *
 * Each tab is a new document with nothing in memory (the cold load the
 * founder sees from a link or a refresh); the browser's file cache is the
 * person's own, warm after the first, as a returning person's phone is.
 *
 *   AMP_TEST_DATABASE_URL=postgres://…/amp_test npx tsx scripts/verify-no-flash-ui.ts
 *   npx tsx scripts/verify-no-flash-ui.ts --origin http://127.0.0.1:4880 \
 *     [--people family,adult-3wk] [--widths 390] [--match workbooks] [--fast]
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
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
import { startPersonaStack } from "./persona-stack";
import { judge, type Load } from "./no-flash-judge";
import { fill, paramPattern, trim, type Route } from "./route-addresses";

const chromium = secureChromium(rawChromium);
const argument = (name: string) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : undefined;
};
const OUT = argument("out") ?? "artifacts/no-flash";
const PEOPLE = (
  argument("people") ??
  "family,adult-3wk,second-parent,tutor,teacher-class,school,student,signed-out"
).split(",");
const WIDTHS = (argument("widths") ?? "390,1280").split(",").map(Number);
const MATCH = argument("match") ? new RegExp(argument("match")!) : null;
const FAST = process.argv.includes("--fast");
/** Accounts the seeded people need: the student signs in with a card from
 * the teacher's class. */
const SEEDED = [
  ...new Set(
    PEOPLE.flatMap((person) =>
      person === "student"
        ? ["teacher-class"]
        : person === "signed-out"
          ? []
          : [person],
    ),
  ),
];
const stack = argument("origin")
  ? null
  : await startPersonaStack({
      webPort: Number(argument("port") ?? 4940),
      personas: SEEDED,
      name: "no_flash_ui",
      out: OUT,
    });
const origin = argument("origin") ?? stack!.origin;
// The origin the API trusts for sign-in, when this one is a second dev
// server in front of the same API (cookies are the host's, any port).
const authOrigin = argument("auth-origin") ?? origin;

/** What a catch-all opens as. */
const SPLATS: Record<string, string> = {
  "/$": "practice",
  "/school/$org/$": "no-such-page",
  "/school/$org/classes/$class/$": "no-such-page",
};
/** Addresses never cold-loaded here, and why. */
const SKIP: Record<string, string> = {
  "/sign-in/$step": "a step of a sign-in under way",
  "/reset-password": "a reset email's link",
  "/account/deleted": "only after an account is deleted",
  "/c": "a sign-in card's secret is in its fragment",
  "/join/continue": "a school sign-in's return, its session in the fragment",
  "/start/purchase": "Stripe Checkout's return",
  "/clever/$reason": "a Clever sign-in that stopped (Clever's lane)",
};

/**
 * Offenders known and left, with the reason: each names who fixes it.
 * Keyed `person route`. Remove a line when its screen is fixed; the check
 * fails on a listed one that no longer offends, so this list only shrinks.
 */
const KNOWN: Record<string, string> = {
  "second-parent /practice":
    "bare /practice hops to the shared child's practice, then on to the family (2 hops before the first paint); the second hop's source is not yet found (2026-11-20, round F1)",
};

/**
 * Every change of the screen's identity, from the document's first frame:
 * written as a string so no bundler helper leaks into the page.
 */
const OBSERVER = `(() => {
  const w = window;
  w.__ids = [];
  w.__hops = [];
  w.__shifts = [];
  const t0 = performance.now();
  let last = "";
  const text = (el) => (el && el.innerText ? el.innerText : "").replace(/\\s+/g, " ").trim();
  const snap = () => {
    const bar = document.querySelector("[data-app-bar]");
    const tabs = bar ? [...bar.querySelectorAll("[role=tab], nav a")].map(text).filter(Boolean).join("|") : "";
    const boot = !!document.querySelector(".app-loading[aria-busy=true]");
    const main = document.querySelector("main");
    const dialog = document.querySelector("[role=dialog]:not([hidden])");
    const heading = text(document.querySelector("main h1, h1")).slice(0, 60);
    const sheet = dialog ? text(dialog.querySelector("h1, h2")).slice(0, 60) : "";
    const s = {
      url: location.pathname,
      title: document.title,
      bar: bar ? [bar.getAttribute("data-app-bar"), bar.getAttribute("data-bar") || "", text(bar.querySelector("[data-place-name], [class*=placeName]")).slice(0, 40)].join("/") : "",
      tabs,
      main: main ? (Object.keys(main.dataset)[0] || main.getAttribute("aria-label") || "main") : "",
      h1: heading,
      sheet,
      boot,
      wait: document.querySelectorAll(".amp-skeleton, [aria-busy=true]").length > 0,
    };
    const key = JSON.stringify(s);
    if (key === last) return;
    last = key;
    w.__ids.push({ t: Math.round(performance.now() - t0), ...s });
  };
  for (const name of ["pushState", "replaceState"]) {
    const original = history[name];
    history[name] = function (...args) {
      const before = location.pathname + location.search;
      const out = original.apply(this, args);
      const after = location.pathname + location.search;
      if (after !== before) w.__hops.push({ t: Math.round(performance.now() - t0), from: before, to: after, how: name });
      snap();
      return out;
    };
  }
  new MutationObserver(snap).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  const tick = () => { snap(); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        if (!e.hadRecentInput) w.__shifts.push({ t: Math.round(e.startTime - t0), v: e.value });
    }).observe({ type: "layout-shift", buffered: true });
  } catch {}
})();`;

async function throttle(page: Page) {
  if (FAST) return;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 80,
    downloadThroughput: 750_000,
    uploadThroughput: 250_000,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
}

async function coldLoad(context: BrowserContext, path: string): Promise<Load> {
  const page = await context.newPage();
  page.on("pageerror", (error) =>
    console.warn(`page error at ${path}:`, error.message),
  );
  await throttle(page);
  await page
    .goto(origin + path, { waitUntil: "load", timeout: 120_000 })
    .catch((error: unknown) => console.warn(`${path} didn't load`, error));
  // Settled: something past the wave painted, then the screen's identity
  // unchanged for a while (a screen that polls never goes network-idle);
  // at most a minute.
  const quiet = FAST ? 1500 : 4000;
  let count = -1;
  for (let still = 0, waited = 0; still < quiet && waited < 60_000;) {
    await page.waitForTimeout(250);
    waited += 250;
    const now = await page
      .evaluate(() => {
        const ids =
          (window as unknown as { __ids?: Record<string, unknown>[] }).__ids ??
          [];
        // Past the wave: an app bar, a main landmark or a heading.
        const painted = ids.some(
          (id) => !id.boot && (!!id.bar || !!id.main || !!id.h1),
        );
        return painted ? ids.length : -1;
      })
      .catch(() => -1);
    still = now >= 0 && now === count ? still + 250 : 0;
    count = now;
  }
  const load = (await page
    .evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      return { ids: w.__ids, hops: w.__hops, shifts: w.__shifts };
    })
    .catch(() => ({ ids: [], hops: [], shifts: [] }))) as Load;
  await page.close();
  return load;
}

/** Every same-origin link in `scope`. */
async function hrefs(page: Page, scope = "body") {
  return page
    .locator(`${scope} a[href]`)
    .evaluateAll((links) =>
      links.map((link) => {
        const url = new URL((link as HTMLAnchorElement).href);
        return url.origin === location.origin ? url.pathname : "";
      }),
    )
    .then((all) => all.filter(Boolean))
    .catch(() => [] as string[]);
}

async function settle(page: Page, path: string) {
  await page
    .goto(`${origin}${path}`)
    .catch((error: unknown) => console.warn(`${path} didn't open`, error));
  await page
    .waitForLoadState("networkidle", { timeout: 3_000 })
    .catch(() => undefined);
  await page.waitForTimeout(400);
  return trim(new URL(page.url()).pathname);
}

/** A person's browser: signed in through the API (or not at all). */
async function personContext(browser: Browser, person: string, width: number) {
  const context = await browser.newContext({
    viewport: { width, height: width < 600 ? 844 : 860 },
  });
  await context.addInitScript(OBSERVER);
  if (person === "signed-out") return context;
  if (person === "student") {
    const grant = await studentGrant(browser);
    await context.addInitScript(
      `if (!sessionStorage.getItem("amp.student")) sessionStorage.setItem("amp.student", ${JSON.stringify(JSON.stringify(grant))});`,
    );
  } else {
    const response = await context.request.post(
      `${authOrigin}/api/auth/sign-in/email`,
      {
        headers: { Origin: authOrigin },
        data: { email: personaEmail(person), password: PERSONA_PASSPHRASE },
      },
    );
    assert.ok(response.ok(), `${person} signs in: ${response.status()}`);
  }
  return context;
}

async function bearer(context: BrowserContext) {
  const session = (await (
    await context.request.get(`${origin}/api/auth/get-session`)
  ).json()) as { session: { token: string } };
  return { Authorization: `Bearer ${session.session.token}`, Origin: origin };
}

let grant: { accountId: string; token: string } | null = null;
/** A student of the teacher's class, signed in with a card the teacher
 * made, as a printed card's link does. */
async function studentGrant(browser: Browser) {
  if (grant) return grant;
  const context = await browser.newContext();
  try {
    await context.request.post(`${authOrigin}/api/auth/sign-in/email`, {
      headers: { Origin: authOrigin },
      data: {
        email: personaEmail("teacher-class"),
        password: PERSONA_PASSPHRASE,
      },
    });
    const page = await context.newPage();
    const home = await settle(page, "/");
    // Their class: where `/` opened, or the first class it lists.
    const classOf = (path: string) =>
      path.match(/^\/school\/[^/]+\/classes\/([^/]+)/)?.[1];
    const classId =
      classOf(home) ?? (await hrefs(page)).map(classOf).find(Boolean);
    assert.ok(classId, `the teacher's class (home ${home})`);
    const headers = await bearer(context);
    const cards = await context.request.post(
      `${origin}/api/v1/school/classes/${classId}/cards`,
      { headers, data: {} },
    );
    assert.ok(cards.ok(), `the class's cards: ${cards.status()}`);
    const { cards: issued } = (await cards.json()) as {
      cards: { token: string }[];
    };
    const signIn = await context.request.post(
      `${origin}/api/v1/school/join/card`,
      { headers: { Origin: origin }, data: { token: issued[0]!.token } },
    );
    assert.ok(signIn.ok(), `a card signs a student in: ${signIn.status()}`);
    const body = (await signIn.json()) as { accountId: string; token: string };
    grant = { accountId: body.accountId, token: body.token };
    return grant;
  } finally {
    await context.close();
  }
}

/** A family child's workbook with results, so its results screen opens. */
async function seedWorkbook(context: BrowserContext) {
  const headers = await bearer(context);
  const me = (await (
    await context.request.get(`${origin}/api/v1/me`, { headers })
  ).json()) as {
    family?: {
      learners: { id: string; adult?: boolean; deletedAt?: string | null }[];
    };
  };
  const child = me.family?.learners.find((l) => !l.adult && !l.deletedAt);
  if (!child) return;
  const date = new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);
  const made = await context.request.post(
    `${origin}/api/v1/learners/${child.id}/workbooks`,
    { headers, data: { date, minutes: 30, paper: "letter" } },
  );
  if (!made.ok()) {
    console.warn(`A workbook wasn't made: ${made.status()}`);
    return;
  }
  const { id } = (await made.json()) as { id: string };
  const base = `${origin}/api/v1/learners/${child.id}/workbooks/${id}/results`;
  const { rows } = (await (
    await context.request.get(base, { headers })
  ).json()) as { rows: { n: number }[] };
  await context.request.post(base, {
    headers,
    data: {
      entries: rows.slice(0, 2).map((row) => ({ n: row.n, mark: "right" })),
    },
  });
}

/** The addresses this person can open: every route of the table filled
 * from their own screens' links. */
async function addresses(
  context: BrowserContext,
  person: string,
  table: Route[],
  catalog: { templateId: string; skillId: string },
) {
  const page = await context.newPage();
  const seen = new Set<string>();
  const home = await settle(page, "/");
  const known: Record<string, string> = { ...catalog };
  const place = home.match(/^\/school\/([^/]+)(?:\/classes\/([^/]+))?/);
  if (place) {
    known.org = place[1]!;
    if (place[2]) known.class = place[2];
  }
  const family = home.match(/^\/family\/([^/]+)/);
  if (family) known.family = family[1]!;
  const collect = async () => {
    for (const href of await hrefs(page)) seen.add(href);
    const menu = page.getByRole("button", { name: "Open AMP menu" }).first();
    if (await menu.isVisible().catch(() => false)) {
      await menu.click().catch(() => undefined);
      await page.waitForTimeout(500);
      for (const href of await hrefs(page, '[role="dialog"]')) seen.add(href);
      await page.keyboard.press("Escape");
    }
  };
  await collect();
  // One level further: the pages home links to show the ids of what they
  // list (a child, a workbook, a student).
  for (const href of [...seen].slice(0, 30)) {
    if (href === home) continue;
    await settle(page, href);
    for (const more of await hrefs(page, "main")) seen.add(more);
  }
  // Every id the links name, by the table's own parameter names (a
  // family child's workbook link names the learner the printed workbook's
  // own address does).
  for (const href of seen)
    for (const route of table) {
      const names = [...route.path.matchAll(/\$([A-Za-z]+)/g)].map(
        (m) => m[1]!,
      );
      const values = paramPattern(route.path).exec(trim(href))?.slice(1);
      if (!values || !names.length) continue;
      names.forEach((name, at) => {
        known[name] ??= values[at]!;
      });
    }
  if (known.learner) known.learnerId ??= known.learner;
  if (known.learnerId) known.learner ??= known.learnerId;
  const found: string[] = [];
  const out = new Set<string>(["/"]);
  if (home !== "/") out.add(home);
  for (const route of table) {
    if (route.path in SKIP) continue;
    const path = fill(route, known, seen, SPLATS);
    if (path && !out.has(path)) out.add(path);
  }
  for (const path of out) if (!MATCH || MATCH.test(path)) found.push(path);
  await page.close();
  void person;
  return found;
}

type Row = {
  person: string;
  width: number;
  path: string;
  problems: string[];
  trail: string;
  /** What the page recorded, to judge again. */
  load: Load;
};

const rows: Row[] = [];
const browser = await chromium.launch();
try {
  await mkdir(OUT, { recursive: true });
  const api = await browser.newContext();
  const catalogBody = (await (
    await api.request.get(`${origin}/api/v1/catalog`)
  ).json()) as { templates: { id: string; skillId: string }[] };
  const type = catalogBody.templates[0]!;
  const catalog = { templateId: type.id, skillId: type.skillId };
  // The route table, from a screen of the app (development only).
  const probe = await api.newPage();
  await probe.goto(`${origin}/sign-in`);
  await probe.waitForFunction("typeof window.ampRouteTable === 'function'");
  const table = (await probe.evaluate(() =>
    (window as unknown as { ampRouteTable: () => Route[] }).ampRouteTable(),
  )) as Route[];
  await api.close();
  for (const person of PEOPLE) {
    const discovery = await personContext(browser, person, 1280);
    if (person === "family") await seedWorkbook(discovery);
    const paths = await addresses(discovery, person, table, catalog);
    await discovery.close();
    console.log(`${person}: ${paths.length} addresses`);
    for (const width of WIDTHS) {
      const context = await personContext(browser, person, width);
      for (const path of paths) {
        const load = await coldLoad(context, path);
        const { problems, trail } = judge(load);
        rows.push({ person, width, path, problems, trail, load });
        console.log(
          `${problems.length ? "FLASH" : "ok   "} ${person} ${width} ${path}${problems.length ? `\n      ${problems.join("\n      ")}\n      seen: ${trail}` : ""}`,
        );
      }
      await context.close();
      // As it goes: a long run's rows are there if it stops.
      await writeFile(`${OUT}/no-flash.json`, JSON.stringify(rows));
    }
  }
} finally {
  await browser.close();
  await stack?.stop();
}

const offenders = rows.filter((row) => row.problems.length);
await writeFile(`${OUT}/no-flash.json`, JSON.stringify(rows));
console.log(
  `\n| person | width | address | what it showed | problem |\n|---|---|---|---|---|`,
);
for (const row of offenders)
  console.log(
    `| ${row.person} | ${row.width} | ${row.path} | ${row.trail} | ${row.problems.join("; ")} |`,
  );
const pattern = (path: string) =>
  path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, "$id");
const unexpected = offenders.filter(
  (row) => !(`${row.person} ${pattern(row.path)}` in KNOWN),
);
const healed = Object.keys(KNOWN).filter(
  (key) =>
    !offenders.some((row) => `${row.person} ${pattern(row.path)}` === key) &&
    rows.some((row) => `${row.person} ${pattern(row.path)}` === key),
);
console.log(
  `\n${rows.length} loads, ${offenders.length} flashed (${unexpected.length} not known).`,
);
assert.deepEqual(
  healed,
  [],
  `fixed, so take them off KNOWN: ${healed.join(", ")}`,
);
assert.deepEqual(
  unexpected.map((row) => `${row.person} ${row.width} ${row.path}`),
  [],
  "every cold load paints one neutral frame, then its destination",
);
