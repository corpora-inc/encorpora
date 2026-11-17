/**
 * Back and Forward never break the app (QA 2026-11-16): a parent's first run
 * with one child lands in practice; "Add a place", Cancel, then the browser's
 * Back hung the tab in a render loop ("Maximum update depth exceeded"), with
 * no menu and no way to navigate away. The cause was a rendered redirect
 * that navigated again on every render while its navigation was pending
 * (src/web/nav/Navigate.tsx). And a screen that fails still fails inside the
 * app's frame, with its bar, menu and a way home (the router's
 * defaultErrorComponent).
 *
 *   AMP_TEST_DATABASE_URL=postgres://…/amp_history_walk \
 *     npx tsx scripts/verify-history-walk-ui.ts [--port 4964] [--widths 390,1280]
 *
 * Each walk is a fresh account through the real sign-up and first run, then
 * in-app navigation and history steps. After every Back and Forward:
 * the tab answers within seconds (no hang), React logged no update-depth
 * error, the page threw nothing, the root is not blank, the app's bar is
 * there, and outside the first-run steps its menu is too. Each walk ends by
 * navigating away, which a hung tab can't.
 */
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import {
  chromium as rawChromium,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from "playwright";
import { secureChromium } from "../browser-security.mjs";
import { startShellFixture } from "./app-shell-fixture";

const chromium = secureChromium(rawChromium);
const arg = (name: string) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : undefined;
};
const port = Number(arg("port") ?? 4964);
const widths = (arg("widths") ?? "390,1280").split(",").map(Number);
const shots = arg("shots") ?? "artifacts/history-walk";
await mkdir(shots, { recursive: true });
/** `--only <text>`: the walks whose name has it (and no failing screen). */
const only = arg("only");

const failures: string[] = [];
const fail = (label: string, detail: unknown = "") => {
  failures.push(
    `${label} ${typeof detail === "string" ? detail : JSON.stringify(detail)}`,
  );
  console.error(`FAIL ${label}`, detail);
};

// The dev server's "New user" confirms the address in this same database.
process.env.AMP_DATABASE_URL ??= process.env.AMP_TEST_DATABASE_URL;
const f = await startShellFixture({ webPort: port });
const origin = f.origin;
const browser = await chromium.launch();

type Step = "back" | "forward";
type Walk = {
  id: string;
  /** In-app steps after the first run, ending somewhere history can walk. */
  before: (page: Page) => Promise<void>;
  steps: Step[];
  /** Where each step must land, when the walk knows (filled by `before`). */
  expect?: { current: string }[];
  /** Checks after a step has landed (filled by `before`). */
  after?: (page: Page, index: number) => Promise<void>;
  /** Just before a step is taken. */
  beforeStep?: (page: Page, index: number) => Promise<unknown> | undefined;
};

/** A fresh account through the real sign-up, signed in on its own context. */
async function freshParent(browser: Browser, width: number) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
  });
  const response = await context.request.post(
    `${origin}/api/auth/sign-up/email`,
    {
      headers: { Origin: origin },
      data: {
        email: `walk-${randomUUID().slice(0, 8)}@example.com`,
        password: "synthetic long fixture passphrase",
        name: "",
      },
    },
  );
  if (!response.ok())
    throw Error(`sign-up ${response.status()} ${await response.text()}`);
  await context.addInitScript(recordHistory);
  await context.addInitScript(recordShifts);
  return context;
}

/** Every layout shift the page makes (CLS entries), with when. */
const recordShifts = `(() => {
  const shifts = (window.__shifts = []);
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries())
      if (!entry.hadRecentInput)
        shifts.push({ at: entry.startTime, value: entry.value });
  }).observe({ type: "layout-shift", buffered: true });
})();`;
/** From now until practice paints: every frame, where the overlay's
 * Practice button is (or "gone"), while the screen is still the map. */
const watchPractice = `(() => {
  window.__tap = performance.now();
  const boxes = (window.__practiceBoxes = []);
  const poll = () => {
    if (location.pathname === "/practice") return;
    const button = document.querySelector(
      "[data-layer-frame] [data-curriculum-practice] button",
    );
    const box = button && button.getBoundingClientRect();
    boxes.push(
      box
        ? [box.x, box.y, box.width, box.height].map(Math.round).join(",")
        : "gone",
    );
    requestAnimationFrame(poll);
  };
  poll();
})()`;

/** Every history entry the app writes (push or replace), in order. */
const recordHistory = `(() => {
  const writes = (window.__writes = []);
  for (const kind of ["pushState", "replaceState"]) {
    const write = history[kind].bind(history);
    history[kind] = (state, unused, url) => {
      writes.push(kind.slice(0, -5) + " " + String(url ?? location.href).replace(location.origin, ""));
      return write(state, unused, url);
    };
  }
})();`;

/**
 * One action is one navigation, with no redirect hops: a link or a handoff
 * writes exactly the one entry it goes to; Back and Forward write nothing
 * (the entry is already there, and it is the screen); a full page load
 * writes only the router's own stamp of the address it loaded. A redirect,
 * or a chain of them, writes more, and fails here with each hop.
 */
async function oneHop(
  page: Page,
  label: string,
  at: "link" | "history" | "load",
) {
  const writes = await page.evaluate(() => {
    const w = window as unknown as { __writes: string[] };
    return w.__writes.splice(0);
  });
  const want = at === "history" ? 0 : 1;
  const ok = at === "load" ? writes.length <= 1 : writes.length === want;
  if (!ok)
    fail(
      `${label}: ${writes.length} history writes, want ${at === "load" ? "at most 1" : want}`,
      writes,
    );
}
/** Forget the writes so far (a full page load, or the first run's sign-up). */
const forget = (page: Page) =>
  page.evaluate(() => {
    (window as unknown as { __writes: string[] }).__writes.splice(0);
  });

/** "What brings you to AMP?" → I'm a parent → one child → their practice. */
async function firstRun(page: Page) {
  // `/` is the launcher: a new account's one way on is to start.
  // Typed, `/` welcomes a new account, never an empty page.
  await page.goto(`${origin}/`);
  await page.locator("[data-launcher]").waitFor();
  await page.getByRole("heading", { name: "Welcome to AMP" }).waitFor();
  await forget(page);
  await page.getByRole("link", { name: "Get started", exact: true }).click();
  await page
    .getByRole("heading", { name: "What brings you to AMP?" })
    .waitFor();
  await settled(page);
  await oneHop(page, "Get started", "link");
  await page.getByRole("link", { name: /^I’m a parent/ }).click();
  await page.getByRole("button", { name: "Birth year, Child 1" }).click();
  // Choosing the year saves the child; Next is tapped at once, while that
  // save is in flight, and goes on when it is done (never a dead button).
  await page
    .getByRole("dialog", { name: "Birth year, Child 1" })
    .getByRole("option", { name: "2016", exact: true })
    .click();
  await forget(page);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.waitForURL((url) => PRACTICE.test(url.pathname));
  await page.locator(".problem-stage").waitFor();
  await settled(page);
  // Setup's last step hands the device to the child: one entry, practice.
  await oneHop(page, "first practice", "link");
}

/** A learner's practice: its address names them (`/practice/<learner>`). */
const PRACTICE = /^\/practice\/[^/]+(?:\/(?:types|skills|areas)\/[^/]+)?$/;
const CHILD_PAGE = /^\/family\/[^/]+\/kids\/[^/]+$/;

/** Records whether anything on the page shows a wait from now on (a
 * loading screen, a skeleton, a busy region): read with `waited`. */
const watchWaits = (page: Page) =>
  // A string: a function here would carry the bundler's name helper.
  page.evaluate(`(() => {
    const waits = (window.__waited = []);
    new MutationObserver(() => {
      const found = document.querySelector(
        ".amp-loading, .amp-skeleton, [role=status][aria-busy=true]",
      );
      if (found) waits.push(String(found.className || found.tagName));
    }).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "aria-busy"],
    });
  })()`);
const waited = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __waited?: string[] }).__waited ?? [],
  );

/** No learner chooser on this screen (features/spaces/learner-choice.ts). */
async function noChooser(page: Page, label: string) {
  const choosers = await page
    .getByRole("button", { name: /^Learner\b|Choose learner/ })
    .count();
  if (choosers) fail(`${label}: a learner chooser with nobody to choose`);
}

const menu = (page: Page) =>
  page.getByRole("button", { name: "Open AMP menu" });

async function openMenu(page: Page) {
  await menu(page).click();
  await page.getByRole("button", { name: "Close AMP menu" }).first().waitFor();
}

/** The menu's place switcher → "Add a place", the starter in adding mode. */
async function addPlace(page: Page) {
  await openMenu(page);
  await page.getByRole("button", { name: /switch place$/ }).click();
  await forget(page);
  await page.getByRole("menuitem", { name: /^Add a place/ }).click();
  await page.waitForURL((url) => url.pathname === "/start");
  await page.getByRole("heading", { name: "Add a place" }).waitFor();
  await settled(page);
  await oneHop(page, "Add a place", "link");
}

/** Changing their mind: "Add a place" has no in-page Back, so they leave
 * it the way a person does, with the browser's Back. */
async function addPlaceCancel(page: Page) {
  await addPlace(page);
  await page.evaluate(() => history.back());
  await page.waitForURL((url) => url.pathname !== "/start");
  await settled(page);
  await oneHop(page, "Add a place, browser Back", "history");
}

/** From the child's practice, the menu's "Back to family": the child's
 * session ends (a full load) and the parent is on their family's Today. */
async function today(page: Page) {
  await openMenu(page);
  await page
    .getByRole("button", { name: "Back to family", exact: true })
    .click();
  await page.waitForURL((url) => /^\/family\/[^/]+$/.test(url.pathname));
  await menu(page).waitFor();
  await settled(page);
  await oneHop(page, "Back to family", "load");
}

/** From the family's Today, a child's row: their page (one entry). */
async function childPage(page: Page) {
  await forget(page);
  await page.locator('main a[href*="/kids/"]').first().click();
  await page.waitForURL((url) =>
    /^\/family\/[^/]+\/kids\/[^/]+$/.test(url.pathname),
  );
  await settled(page);
  await oneHop(page, "a child's page", "link");
}

async function tab(page: Page, name: string, path: RegExp) {
  await forget(page);
  await page.getByRole("link", { name, exact: true }).first().click();
  await page.waitForURL((url) => path.test(url.pathname));
  await settled(page);
  await oneHop(page, name, "link");
}

/** The screen has arrived: its address has held still for a moment and
 * nothing on it is still loading, so the menu opened next stays open. */
async function settled(page: Page) {
  await page.waitForFunction(
    () => {
      const w = window as unknown as { __at?: [string, number] };
      const now = location.href;
      if (!w.__at || w.__at[0] !== now) w.__at = [now, performance.now()];
      return (
        performance.now() - w.__at[1] > 800 &&
        !document.querySelector('[aria-busy="true"]')
      );
    },
    null,
    { polling: 100, timeout: 15_000 },
  );
}

/** The layers open over the screen (nav/layer-store.ts), as the frame
 * draws them: one scrim, the trail's crumbs, how the frame came in. */
async function frameState(page: Page) {
  return page.evaluate(() => {
    const frame = document.querySelector<HTMLElement>("[data-layer-frame]");
    const scrims = [...document.querySelectorAll("[data-layer-scrim]")];
    const panel = frame?.querySelector<HTMLElement>("[data-layer-panel]");
    return {
      scrims: scrims.length,
      scrimOpacity: scrims[0] ? getComputedStyle(scrims[0]).opacity : "",
      dialogs: document.querySelectorAll("[role=dialog]").length,
      crumbs: [...document.querySelectorAll("[data-layer-crumb]")].map(
        (crumb) => crumb.textContent ?? "",
      ),
      frameMotion: frame?.dataset.motion ?? "",
      panelMotion: panel?.dataset.motion ?? "",
      // Anything in the overlay still moving (a replayed entrance).
      moving: document
        .getAnimations()
        .filter((animation) => {
          const target = (animation.effect as KeyframeEffect | null)?.target;
          return (
            target instanceof Element &&
            (target.matches("[data-layer-scrim]") ||
              !!target.closest("[data-layer-frame]"))
          );
        })
        .map((animation) => (animation as CSSAnimation).animationName ?? ""),
    };
  });
}
/** The layer frame has settled: nothing in it still moving. */
const frameSettled = (page: Page) =>
  page.waitForFunction(
    () =>
      !document
        .getAnimations()
        .some((animation) =>
          (
            (animation.effect as KeyframeEffect | null)
              ?.target as Element | null
          )?.closest?.("[data-layer-frame], [data-layer-scrim]"),
        ),
    null,
    { timeout: 5000 },
  );
/** A skill link in the frame that opens one level deeper than `depth`. */
async function deeper(page: Page, depth: number) {
  const links = page.locator("[data-layer-frame] a[data-entity=skill]:visible");
  for (let at = 0; at < (await links.count()); at++) {
    const href = await links.nth(at).getAttribute("href");
    const open = new URL(href!, origin).searchParams.get("open") ?? "";
    if (open.split(",").length === depth + 1) return links.nth(at);
  }
  throw Error(`no skill opens below level ${depth}`);
}
/** A layer opens, in the one frame, as a person's step: no history at all. */
async function openLevel(page: Page, depth: number, link: Locator) {
  await forget(page);
  await link.click();
  await page.locator(`[data-layer-frame][data-depth="${depth}"]`).waitFor();
  await frameSettled(page);
  await settled(page);
  await oneHop(page, `open level ${depth}`, "history");
}

/** The child's Pathways, three skills deep in its one overlay, and the top
 * one's Practice: the device goes to the child in one navigation, straight
 * to their practice of that skill, and Back returns to the parent's map
 * with the same three levels, settled, nothing replayed. */
const skillPractice: Walk = {
  id: "child's skills → practice",
  before: async (page) => {
    await today(page);
    await childPage(page);
    await tab(page, "Pathways", /^\/family\/[^/]+\/kids\/[^/]+\/pathways$/);
    const map = new URL(page.url());
    // A grade's skills, then the first of them.
    await page
      .locator("[data-plan-band]")
      .filter({ hasText: "Grade 3" })
      .locator("strong")
      .first()
      .click();
    await openLevel(
      page,
      1,
      page.locator('a[data-entity="skill"]:visible').first(),
    );
    const first = await frameState(page);
    await openLevel(page, 2, await deeper(page, 1));
    await openLevel(page, 3, await deeper(page, 2));
    // ONE overlay: one scrim, as dark as it was at the first level.
    const three = await frameState(page);
    if (three.scrims !== 1 || three.dialogs !== 1)
      fail("three levels: one scrim, one dialog", three);
    if (three.scrimOpacity !== first.scrimOpacity)
      fail("three levels: the scrim's opacity changed", [first, three]);
    // The trail names the two levels under the third; its title is the
    // third's own heading.
    if (three.crumbs.length !== 2)
      fail("three levels: two crumbs, the ancestors", three);
    if (page.url() !== map.href)
      fail("layers stay out of the address", page.url());
    const practice = page
      .locator("[data-layer-frame]")
      .getByRole("button", { name: /^Practice with / });
    await forget(page);
    await page.evaluate(watchPractice);
    await practice.click();
    await page.waitForURL((url) => PRACTICE.test(url.pathname));
    await page.locator(".problem-stage").waitFor();
    // Tapping Practice moves nothing: the overlay and its busy button hold
    // still until practice replaces the screen (founder 11-16, "it jerks
    // the page around"), and the switch itself shifts nothing.
    const held = (await page.evaluate(`({
      boxes: window.__practiceBoxes,
      cls: window.__shifts
        .filter((shift) => shift.at >= window.__tap)
        .reduce((sum, shift) => sum + shift.value, 0),
    })`)) as { boxes: string[]; cls: number };
    if (held.cls >= 0.01)
      fail("Practice: layout shift until practice paints", held.cls);
    if (new Set(held.boxes).size !== 1 || held.boxes[0] === "gone")
      fail("Practice: its button holds its place until practice", held.boxes);
    await settled(page);
    await oneHop(page, "Practice with the child", "link");
    const atPractice = new URL(page.url());
    const at = (url: URL) => ({ current: url.pathname + url.search });
    skillPractice.expect = [at(map), at(atPractice), at(map)];
    skillPractice.after = async (page, index) => {
      if (index === 0) {
        // Back to the parent's map after the child's practice: the map
        // and its record were already here, so nothing waits (Providers
        // keeps a family handoff's data).
        const waits = await waited(page);
        if (waits.length) fail("Back to Pathways after practice waited", waits);
      }
      if (index !== 0 && index !== 2) return;
      // Back on the map: the same three levels at once, drawn settled.
      await page.locator('[data-layer-frame][data-depth="3"]').waitFor();
      const back = await frameState(page);
      const label = `Back #${index + 1} to the map`;
      if (back.crumbs.join(" › ") !== three.crumbs.join(" › "))
        fail(`${label}: the same levels`, [three.crumbs, back.crumbs]);
      if (back.scrims !== 1) fail(`${label}: one scrim`, back);
      if (
        back.frameMotion !== "none" ||
        back.panelMotion !== "none" ||
        back.moving.length
      )
        fail(`${label}: a restored overlay replays nothing`, back);
      if (index !== 2) return;
      // The trail's first crumb goes back up to the first level.
      await page.locator('[data-layer-crumb="1"]').click();
      await page.locator('[data-layer-frame][data-depth="1"]').waitFor();
      const up = await frameState(page);
      if (up.crumbs.length !== 0 || up.panelMotion !== "out")
        fail(`${label}: crumb 1 is the first level`, up);
    };
  },
  steps: ["back", "forward", "back", "back", "forward"],
  beforeStep: (page, index) => (index === 0 ? watchWaits(page) : undefined),
};

/** Family → the child's page → Practice: one entry, at the child's practice
 * address; a refresh keeps the child; Back writes nothing and lands on the
 * child's page; a refresh there keeps the child too. On the child's own
 * (handed) session, Pathways, Inventory and the Overview offer no learner
 * chooser. */
const childPractice: Walk = {
  id: "child's page → practice → back",
  before: async (page) => {
    // The handed child's own session (the first run left them practicing):
    // their screens have one learner, so no chooser anywhere.
    for (const path of ["/pathways", "/inventory", "/overview"]) {
      await page.goto(`${origin}${path}`);
      await page.locator("[data-app-logo]").first().waitFor();
      await settled(page);
      await noChooser(page, `handed child's ${path}`);
    }
    await today(page);
    await childPage(page);
    const childAt = new URL(page.url());
    const child = decodeURIComponent(childAt.pathname.split("/").at(-1)!);
    await forget(page);
    await page
      .getByRole("button", { name: /^Practice with / })
      .first()
      .click();
    await page.waitForURL((url) => PRACTICE.test(url.pathname));
    await page.locator(".problem-stage").waitFor();
    await settled(page);
    await oneHop(page, "the child's page → Practice", "link");
    const practice = new URL(page.url());
    if (decodeURIComponent(practice.pathname.split("/").at(-1)!) !== child)
      fail("practice names another learner", [practice.pathname, child]);
    // A refresh keeps the child's practice.
    await page.reload();
    await page.locator(".problem-stage").waitFor();
    await settled(page);
    await forget(page);
    if (new URL(page.url()).pathname !== practice.pathname)
      fail("a refresh of practice moved", page.url());
    const at = (url: URL) => ({ current: url.pathname + url.search });
    childPractice.expect = [at(childAt), at(practice)];
    childPractice.after = async (page, index) => {
      if (index !== 0) return;
      // Back on the child's page; a refresh keeps the child.
      await page.reload();
      await page.waitForURL((url) => url.pathname === childAt.pathname);
      await settled(page);
      await forget(page);
      if (new URL(page.url()).pathname !== childAt.pathname)
        fail("a refresh of the child's page moved", page.url());
    };
  },
  steps: ["back", "forward"],
};

/** A parent with two children: Pathways offers the chooser, and choosing
 * the other child is one navigation to that child's address. */
const twoChildren: Walk = {
  id: "two children → chooser",
  before: async (page) => {
    await today(page);
    const added = await page.evaluate(async () => {
      const response = await fetch("/api/v1/learners", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Second", birthYear: 2015 }),
      });
      return response.status;
    });
    if (added >= 300) throw Error(`adding a second child: ${added}`);
    await page.reload();
    await settled(page);
    await childPage(page);
    await tab(page, "Pathways", /^\/family\/[^/]+\/kids\/[^/]+\/pathways$/);
    const before = new URL(page.url()).pathname;
    const chooser = page.getByRole("button", { name: /^Learner\b/ });
    if (!(await chooser.count())) {
      fail("two children: no learner chooser on Pathways");
      return;
    }
    await chooser.first().click();
    await forget(page);
    await page.getByRole("option", { name: "Second" }).click();
    await page.waitForURL((url) => url.pathname !== before);
    await settled(page);
    await oneHop(page, "choosing the other child", "link");
    if (!/\/pathways$/.test(new URL(page.url()).pathname))
      fail("the other child's Pathways", page.url());
  },
  steps: ["back", "forward"],
};

const walks: Walk[] = [
  skillPractice,
  childPractice,
  twoChildren,
  {
    // The first run hands the device to the one child, in practice; Back
    // walks the setup it came through.
    id: "first practice → back",
    before: async () => {},
    // Back as far as `/`: the launcher, the screen it was.
    steps: ["back", "forward", "back", "back", "back", "forward", "forward"],
  },
  {
    id: "today → add a place → cancel",
    before: async (page) => {
      await today(page);
      await addPlaceCancel(page);
    },
    steps: ["back", "back", "back", "forward", "forward", "forward"],
  },
  {
    id: "progress → add a place → cancel",
    before: async (page) => {
      await today(page);
      await childPage(page);
      await addPlaceCancel(page);
    },
    steps: ["back", "back", "forward", "back", "back", "forward", "forward"],
  },
  {
    id: "settings → add a place → cancel",
    before: async (page) => {
      await today(page);
      await tab(page, "Settings", /^\/family\/[^/]+\/settings$/);
      await addPlaceCancel(page);
    },
    steps: ["back", "back", "forward", "back", "back", "forward", "forward"],
  },
  {
    id: "today → add a place → myself",
    before: async (page) => {
      await today(page);
      await addPlace(page);
      await page
        .getByRole("link", { name: /^I’m learning for myself/ })
        .click();
      await page.waitForURL((url) => url.pathname === "/start/myself");
      await page
        .getByRole("heading", { name: "What year were you born?" })
        .waitFor();
      await settled(page);
      await oneHop(page, "I’m learning for myself", "link");
    },
    steps: ["back", "back", "back", "forward", "forward", "back", "back"],
  },
];

/** Answers within the time, or null: a hung renderer never answers. */
async function within<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const result = await Promise.race([
    promise,
    new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), ms);
    }),
  ]);
  clearTimeout(timer);
  return result;
}

/** The tab is alive and the app is whole: bar, menu, something on screen. */
async function healthy(page: Page, label: string, errors: string[]) {
  // A history step resolves the route; give its redirects time to settle.
  const alive = await within(
    page
      .waitForFunction(() => document.readyState === "complete", null, {
        timeout: 8000,
      })
      .then(() => page.waitForTimeout(700))
      .then(() =>
        page.evaluate(() => ({
          path: location.pathname,
          text: (document.getElementById("root")?.innerText ?? "").trim()
            .length,
          header: !!document.querySelector("header"),
        })),
      ),
    10_000,
  );
  if (!alive) {
    fail(`${label}: the tab stopped answering (hung)`);
    return false;
  }
  if (errors.length) fail(`${label}: errors`, errors.splice(0));
  if (alive.text === 0) fail(`${label}: blank root at ${alive.path}`);
  if (!alive.header) fail(`${label}: no app bar at ${alive.path}`);
  // The first-run steps are a passage with the logo alone; every other
  // screen keeps the menu.
  if (!/^\/start(\/|$)/.test(alive.path)) {
    // The menu's button (the logo); a layer open over the screen makes it
    // inert, not absent.
    const shown = await page
      .locator("[data-app-logo]")
      .first()
      .waitFor({ timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (!shown) fail(`${label}: no menu at ${alive.path}`);
  }
  return true;
}

function watch(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (/Maximum update depth/i.test(message.text()))
      errors.push(`console: ${message.text().slice(0, 200)}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

async function walk(width: number, w: Walk) {
  const label = `${width} ${w.id}`;
  const context: BrowserContext = await freshParent(browser, width);
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    const errors = watch(page);
    try {
      await firstRun(page);
      await w.before(page);
    } catch (error) {
      // A step that couldn't be taken: what was on screen, for the report.
      const shot = `${shots}/${label.replace(/[^\w]+/g, "-")}.png`;
      await page.screenshot({ path: shot }).catch(() => undefined);
      fail(
        `${label}: couldn't walk there (${shot})`,
        String(error).split("\n")[0],
      );
      return;
    }
    if (!(await healthy(page, `${label} before walking`, errors))) return;
    const trail: string[] = [new URL(page.url()).pathname];
    for (const [index, step] of w.steps.entries()) {
      // The browser's own Back and Forward, as a person presses them: the
      // history step itself (Playwright's goBack waits for a navigation
      // event that a same-document step, replaced on arrival, never sends).
      await forget(page);
      await w.beforeStep?.(page, index);
      const moved = await within(
        page.evaluate(
          (back) => (back ? history.back() : history.forward()),
          step === "back",
        ),
        5000,
      );
      if (moved === null) {
        fail(
          `${label}: ${step} #${index + 1}: the tab stopped answering`,
          trail,
        );
        return;
      }
      const ok = await healthy(page, `${label} ${step} #${index + 1}`, errors);
      trail.push(`${step}:${new URL(page.url()).pathname}`);
      if (!ok) {
        console.error("  trail", trail.join(" → "));
        return;
      }
      await settled(page);
      await oneHop(page, `${label} ${step} #${index + 1}`, "history");
      // Back to `/` is the launcher itself, never a redirect onward.
      if (
        new URL(page.url()).pathname === "/" &&
        !(await page.locator("[data-launcher]").isVisible())
      )
        fail(`${label} ${step} #${index + 1}: / is not the launcher`);
      const want = w.expect?.[index];
      const here = new URL(page.url());
      if (want && here.pathname + here.search !== want.current)
        fail(
          `${label} ${step} #${index + 1}: at ${here.pathname + here.search}, want ${want.current}`,
        );
      await w.after?.(page, index);
    }
    // Still able to go anywhere: a hung tab can't even load another page.
    await page.goto(`${origin}/`, { timeout: 15_000 });
    await page.locator("[data-launcher]").waitFor();
    await healthy(page, `${label} navigating away`, errors);
    console.log(`ok ${label}: ${trail.join(" → ")}`);
  } finally {
    await context.close();
  }
}

/** Every way in opens its destination itself: a new account lands on its
 * first question (/start) in one navigation, never through `/`. */
async function entries(width: number) {
  const label = `${width} sign-up`;
  // The sign-up screen, as a person fills it in.
  {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
    });
    await context.addInitScript(recordHistory);
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);
    const seen: string[] = [];
    try {
      await page.goto(`${origin}/sign-up`);
      const fallback = page.getByRole("button", {
        name: "Use a password instead",
      });
      const password = page.getByLabel("Password", { exact: true });
      await Promise.race([fallback.waitFor(), password.waitFor()]);
      if (await fallback.isVisible()) await fallback.click();
      await page
        .getByLabel("Email")
        .fill(`walk-${randomUUID().slice(0, 8)}@example.com`);
      await password.fill("synthetic long fixture passphrase");
      await settled(page);
      await forget(page);
      page.on("framenavigated", (frame) => {
        if (frame === page.mainFrame())
          seen.push(new URL(frame.url()).pathname);
      });
      await page.getByRole("button", { name: "Create account" }).click();
      await page.waitForURL((url) => url.pathname === "/start");
      await page
        .getByRole("heading", { name: "What brings you to AMP?" })
        .waitFor();
      await settled(page);
      await oneHop(page, `${label}: Create account`, "link");
      if (seen.includes("/")) fail(`${label}: went through /`, seen);
      console.log(`ok ${label}: ${seen.join(" → ")}`);
    } catch (error) {
      fail(`${label}: didn't land on /start`, {
        at: page.url(),
        seen,
        error: String(error).split("\n")[0],
      });
    } finally {
      await context.close();
    }
  }
  // The design preview's "New user": a brand-new account, then its place.
  {
    const label = `${width} dev New user`;
    const context = await browser.newContext({
      viewport: { width, height: 900 },
    });
    await context.addInitScript(recordHistory);
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);
    const seen: string[] = [];
    try {
      await page.goto(`${origin}/dev/personas`);
      const create = page.getByRole("button", { name: /New user/ });
      await create.waitFor();
      page.on("framenavigated", (frame) => {
        if (frame === page.mainFrame())
          seen.push(new URL(frame.url()).pathname);
      });
      await create.click();
      await page.waitForURL((url) => url.pathname === "/start");
      await page
        .getByRole("heading", { name: "What brings you to AMP?" })
        .waitFor();
      await settled(page);
      // A full load of /start: the router's own stamp, no redirect.
      await oneHop(page, `${label}: New user`, "load");
      if (seen.includes("/")) fail(`${label}: went through /`, seen);
      console.log(`ok ${label}: ${seen.join(" → ")}`);
    } catch (error) {
      fail(`${label}: didn't land on /start`, String(error).split("\n")[0]);
    } finally {
      await context.close();
    }
  }
}

/** A screen that throws while rendering: an inline error in the content
 * area, the bar and menu still working, and Go home leaving it. */
async function failingScreen(width: number) {
  const label = `${width} failing screen`;
  const context = await freshParent(browser, width);
  try {
    // The Inventory screen's module, replaced by one that throws.
    await context.route(
      /\/src\/web\/features\/inventory\/InventoryScreen\.tsx/,
      (route) =>
        route.fulfill({
          contentType: "text/javascript",
          body: 'export function InventoryScreen() { throw new Error("synthetic screen failure"); }',
        }),
    );
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    const errors = watch(page);
    await firstRun(page);
    await page.goto(`${origin}/inventory`);
    await page.getByText("This screen could not be loaded.").waitFor();
    // Inside the shell: its bar and a menu that opens.
    if (!(await page.locator("header").first().isVisible()))
      fail(`${label}: the bar is gone`);
    await openMenu(page);
    await page.keyboard.press("Escape");
    await page.getByRole("link", { name: "Go home" }).click();
    await page.waitForURL((url) => url.pathname === "/");
    await page.locator("[data-launcher]").waitFor();
    // The failure was the screen's own, not a loop.
    const depth = errors.filter((e) => /Maximum update depth/.test(e));
    if (depth.length) fail(`${label}: update depth`, depth);
    await healthy(page, `${label} after Go home`, []);
    console.log(`ok ${label}`);
  } finally {
    await context.close();
  }
}

/** The 3D map opens on the whole map, framed (Q-9), on every way in: from
 * Grades, with a skill open, on a refresh, and from the child's Progress
 * tab. `data-whole-map` is the map's own check that every skill is inside
 * its view (features/pathways/Graph.tsx). */
async function wholeMap(width: number) {
  const label = `${width} 3D whole map`;
  const context = await freshParent(browser, width);
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    await firstRun(page);
    await today(page);
    await childPage(page);
    await tab(page, "Pathways", /^\/family\/[^/]+\/kids\/[^/]+\/pathways$/);
    const view = (name: "Grades" | "3D") =>
      page
        .getByRole("radiogroup", { name: "Map view" })
        .getByRole("radio", { name, exact: true })
        .click();
    const whole = async (way: string) => {
      await page.locator(".pathways-canvas canvas").waitFor();
      const framed = await page
        .waitForFunction(
          () =>
            document.querySelector<HTMLElement>("[data-whole-map]")?.dataset
              .wholeMap === "true",
          null,
          { timeout: 6000 },
        )
        .then(() => true)
        .catch(() => false);
      if (!framed) {
        const shot = `${shots}/${label.replace(/[^\w]+/g, "-")}-${way.replace(/[^\w]+/g, "-")}.png`;
        await page.screenshot({ path: shot });
        fail(`${label}: ${way}: the 3D map opened zoomed in (${shot})`);
      }
    };
    // A skill of the plan, to open later.
    await page
      .locator("[data-plan-band]")
      .filter({ hasText: "Grade 3" })
      .locator("strong")
      .first()
      .click();
    const skill = await page
      .locator("a[data-plan-skill]:visible")
      .first()
      .getAttribute("data-plan-skill");
    await view("3D");
    await whole("Grades → 3D");
    // A link with a skill open over the map (the overlay restored with
    // it): the skill is marked, the map still whole.
    const map = new URL(page.url());
    await page.goto(`${map.origin}${map.pathname}?open=skill:${skill}`);
    await page.locator("[data-layer-frame]").waitFor();
    await whole("a link with a skill open");
    await page.reload();
    await page.locator("[data-layer-frame]").waitFor();
    await whole("a refresh with a skill open");
    await page.keyboard.press("Escape");
    // The child's page, then their Pathways tab again.
    await tab(page, "Overview", /^\/family\/[^/]+\/kids\/[^/]+$/);
    await tab(page, "Pathways", /^\/family\/[^/]+\/kids\/[^/]+\/pathways$/);
    await whole("the child's Pathways tab");
    console.log(`ok ${label}`);
  } catch (error) {
    const shot = `${shots}/${label.replace(/[^\w]+/g, "-")}.png`;
    await context
      .pages()[0]
      ?.screenshot({ path: shot })
      .catch(() => undefined);
    fail(
      `${label}: couldn't walk there (${shot})`,
      String(error).split("\n")[0],
    );
  } finally {
    await context.close();
  }
}

try {
  for (const width of widths) {
    for (const w of walks)
      if (!only || w.id.includes(only)) await walk(width, w);
    if (!only || "failing screen".includes(only)) await failingScreen(width);
    if (!only || "3D whole map".includes(only)) await wholeMap(width);
    if (!only || "sign-up new user".includes(only)) await entries(width);
  }
} finally {
  await browser.close();
  await f.close();
}
if (failures.length) {
  console.error(`\n${failures.length} failure(s):\n${failures.join("\n")}`);
  process.exit(1);
}
console.log("history walk: Back and Forward keep the app whole");
process.exit(0);
