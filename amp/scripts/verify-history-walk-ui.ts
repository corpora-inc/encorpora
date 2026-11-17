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
import {
  chromium as rawChromium,
  type Browser,
  type BrowserContext,
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
/** `--only <text>`: the walks whose name has it (and no failing screen). */
const only = arg("only");

const failures: string[] = [];
const fail = (label: string, detail: unknown = "") => {
  failures.push(
    `${label} ${typeof detail === "string" ? detail : JSON.stringify(detail)}`,
  );
  console.error(`FAIL ${label}`, detail);
};

const f = await startShellFixture({ webPort: port });
const origin = f.origin;
const browser = await chromium.launch();

type Step = "back" | "forward";
type Walk = {
  id: string;
  /** In-app steps after the first run, ending somewhere history can walk. */
  before: (page: Page) => Promise<void>;
  steps: Step[];
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
  return context;
}

/** "What brings you to AMP?" → I'm a parent → one child → their practice. */
async function firstRun(page: Page) {
  await page.goto(`${origin}/`);
  await page
    .getByRole("heading", { name: "What brings you to AMP?" })
    .waitFor();
  await page.getByRole("link", { name: /^I’m a parent/ }).click();
  await page.getByRole("button", { name: "Birth year, Child 1" }).click();
  await page
    .getByRole("dialog", { name: "Birth year, Child 1" })
    .getByRole("radio", { name: "2016", exact: true })
    .click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/practice");
  await page.locator(".problem-stage").waitFor();
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
  await page.getByRole("menuitem", { name: /^Add a place/ }).click();
  await page.waitForURL((url) => url.pathname === "/start");
  await page.getByRole("heading", { name: "Add a place" }).waitFor();
}

async function addPlaceCancel(page: Page) {
  await addPlace(page);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.waitForURL((url) => url.pathname !== "/start");
}

/** From practice, the menu's Today: the family's own page. */
async function today(page: Page) {
  await openMenu(page);
  await page.getByRole("link", { name: "Today", exact: true }).first().click();
  await page.waitForURL((url) => /^\/family\/[^/]+$/.test(url.pathname));
  await settled(page);
}

async function tab(page: Page, name: string, path: RegExp) {
  await page.getByRole("link", { name, exact: true }).first().click();
  await page.waitForURL((url) => path.test(url.pathname));
  await settled(page);
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

const walks: Walk[] = [
  {
    // The founder's exact path.
    id: "practice → add a place → cancel",
    before: addPlaceCancel,
    steps: ["back", "forward", "back", "back", "forward", "forward", "back"],
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
      await tab(page, "Progress", /^\/family\/[^/]+\/kids\/[^/]+$/);
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
    id: "practice → add a place → myself",
    before: async (page) => {
      await addPlace(page);
      await page
        .getByRole("link", { name: /^I’m learning for myself/ })
        .click();
      await page.waitForURL((url) => url.pathname === "/start/myself");
      await page
        .getByRole("heading", { name: "What year were you born?" })
        .waitFor();
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
    const shown = await menu(page)
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
    await firstRun(page);
    await w.before(page);
    if (!(await healthy(page, `${label} before walking`, errors))) return;
    const trail: string[] = [new URL(page.url()).pathname];
    for (const [index, step] of w.steps.entries()) {
      // The browser's own Back and Forward, as a person presses them: the
      // history step itself (Playwright's goBack waits for a navigation
      // event that a same-document step, replaced on arrival, never sends).
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
    }
    // Still able to go anywhere: the menu's Account page.
    await openMenu(page);
    await page.getByRole("link", { name: "Account", exact: true }).click();
    await page.waitForURL((url) => url.pathname.startsWith("/account/"));
    await healthy(page, `${label} navigating away`, errors);
    console.log(`ok ${label}: ${trail.join(" → ")}`);
  } finally {
    await context.close();
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
    await page.waitForURL((url) => !url.pathname.endsWith("/inventory"));
    // The failure was the screen's own, not a loop.
    const depth = errors.filter((e) => /Maximum update depth/.test(e));
    if (depth.length) fail(`${label}: update depth`, depth);
    await healthy(page, `${label} after Go home`, []);
    console.log(`ok ${label}`);
  } finally {
    await context.close();
  }
}

try {
  for (const width of widths) {
    for (const w of walks)
      if (!only || w.id.includes(only)) await walk(width, w);
    if (!only || "failing screen".includes(only)) await failingScreen(width);
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
