import { secureChromium } from "../browser-security.mjs";
/**
 * The one app frame holds still (app/AppShell.tsx, #2062), asserted in a real
 * browser against real data (app-shell-fixture.ts):
 *
 *   AMP_TEST_DATABASE_URL=postgres://…/amp_shell_fixture \
 *     npx tsx scripts/verify-app-shell-stability.ts [--engines chromium,webkit]
 *       [--widths 320,390,768,1280] [--shots DIR]
 *
 * For every screen on the frame (Overview, Pathways, Inventory, the four
 * Account tabs, practice, an adult's own record and the free assessment's
 * Overview), at 320, 390, 768 and 1280 px, light and dark, in Chromium and WebKit:
 *
 * - the logo's box is identical on every screen;
 * - the logo opens the drawer, which shows the same logo in the same spot,
 *   and that logo closes it;
 * - a group's tabs keep their boxes on every screen of the group, and moving
 *   between them by tab keeps the very same bar (it never remounts);
 * - nothing moves from first paint to settled (layout shift, both engines);
 * - no resource is requested twice while a screen loads;
 * - no visible text changes without input in the first two seconds (a value
 *   inside a region marked busy may arrive; it may not flip).
 */
import { mkdir } from "node:fs/promises";
import {
  chromium as rawChromium,
  webkit,
  type Browser,
  type Page,
} from "playwright";
const chromium = secureChromium(rawChromium);
import { settle } from "./app-shell-probe";
import { startShellFixture, type ShellState } from "./app-shell-fixture";

const argument = (name: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : undefined;
};
const engines = (argument("engines") ?? "chromium,webkit").split(",");
const widths = (argument("widths") ?? "320,390,768,1280")
  .split(",")
  .map(Number);
const themes = ["light", "dark"] as const;
const shots = argument("shots");
if (shots) await mkdir(shots, { recursive: true });

const fixture = await startShellFixture({
  webPort: Number(process.env.AMP_SHELL_WEB_PORT ?? 4950),
});
const { origin } = fixture;

/** The paid parent also starts their own practice, so `/me` has a record. */
{
  const browser = await chromium.launch();
  const context = await fixture.context(browser, "paid");
  const session = await (
    await context.request.get(`${origin}/api/auth/get-session`)
  ).json();
  const started = await context.request.post(`${origin}/api/v1/me/practice`, {
    headers: {
      authorization: `Bearer ${session.session.token as string}`,
      Origin: origin,
    },
    data: { start: "elementary", timezone: "America/New_York" },
  });
  if (!started.ok())
    throw Error(`own practice ${started.status()} ${await started.text()}`);
  await context.close();
  await browser.close();
}

type Screen = {
  id: string;
  path: string;
  state: ShellState;
  group: "progress" | "account" | "practice";
  /** Shown once the screen has its data. */
  ready: (page: Page) => Promise<unknown>;
};
const screens: Screen[] = [
  {
    id: "overview",
    path: "/overview",
    state: "paid",
    group: "progress",
    ready: (p) => p.locator('.frontier-map[aria-busy="false"]').waitFor(),
  },
  {
    id: "pathways",
    path: "/pathways",
    state: "paid",
    group: "progress",
    ready: (p) => p.locator(".pathways-viewport").waitFor(),
  },
  {
    id: "inventory",
    path: "/inventory",
    state: "paid",
    group: "progress",
    ready: (p) =>
      p.locator('[aria-label="Inventory totals"][aria-busy="false"]').waitFor(),
  },
  {
    id: "security",
    path: "/family/security",
    state: "paid",
    group: "account",
    ready: (p) =>
      p.getByRole("heading", { name: /Sign-in & security/ }).waitFor(),
  },
  {
    id: "family",
    path: "/family/learners",
    state: "paid",
    group: "account",
    ready: (p) => p.locator(".family-section").first().waitFor(),
  },
  {
    id: "billing",
    path: "/family/access",
    state: "paid",
    group: "account",
    ready: (p) => p.locator(".family-section").first().waitFor(),
  },
  {
    id: "privacy",
    path: "/family/privacy",
    state: "paid",
    group: "account",
    ready: (p) => p.locator(".family-body section").first().waitFor(),
  },
  {
    id: "practice",
    path: "/practice",
    state: "paid",
    group: "practice",
    ready: (p) => p.locator("#problem-prompt").waitFor(),
  },
  {
    id: "me",
    path: "/me",
    state: "paid",
    group: "progress",
    ready: (p) => p.locator("main[data-dense] h1").waitFor(),
  },
  {
    id: "trial-map",
    path: "/try/map",
    state: "trial",
    group: "progress",
    ready: (p) => p.locator(".frontier-map").waitFor(),
  },
];

/** Installed before any page script: the requests the screen makes, and
 * every element whose own visible text changes while nothing was pressed. */
const recorder = `(() => {
  if (window.__stable) return;
  const state = { flips: [], input: false };
  window.__stable = state;
  for (const type of ["pointerdown", "keydown", "wheel", "touchstart"])
    addEventListener(type, () => { state.input = true; }, true);
  const seen = new WeakMap();
  const own = (el) => {
    let text = "";
    for (const node of el.childNodes) if (node.nodeType === 3) text += node.nodeValue;
    return text.replace(/\\s+/g, " ").trim();
  };
  const visible = (el) => {
    if (el.closest("[aria-hidden=true], [hidden]")) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight) return false;
    const style = getComputedStyle(el);
    return style.visibility !== "hidden" && style.opacity !== "0";
  };
  const busy = (el) => !!el.closest("[aria-busy=true], .amp-loading, .amp-skeleton, .app-loading");
  const start = performance.now();
  const sample = () => {
    if (state.input || performance.now() - start > 2000) return;
    for (const el of document.body ? document.body.querySelectorAll("*") : []) {
      const text = own(el);
      if (!text) continue;
      const shown = visible(el);
      const before = seen.get(el);
      if (before && before.shown && shown && before.text !== text && !before.busy)
        state.flips.push(el.tagName.toLowerCase() + ": \\"" + before.text.slice(0, 40) + "\\" → \\"" + text.slice(0, 40) + "\\" @" + Math.round(performance.now()));
      seen.set(el, { text, shown, busy: busy(el) });
    }
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
})();`;

type Box = { x: number; y: number; width: number; height: number };
const same = (a: Box | null, b: Box | null) =>
  !!a &&
  !!b &&
  Math.abs(a.x - b.x) < 0.6 &&
  Math.abs(a.y - b.y) < 0.6 &&
  Math.abs(a.width - b.width) < 0.6 &&
  Math.abs(a.height - b.height) < 0.6;
const show = (box: Box | null) =>
  box
    ? `${box.x.toFixed(1)},${box.y.toFixed(1)} ${box.width.toFixed(1)}×${box.height.toFixed(1)}`
    : "none";

const failures: string[] = [];
const check = (ok: unknown, message: string) => {
  if (!ok) failures.push(message);
};

async function tabBoxes(page: Page) {
  return page.evaluate(() =>
    Object.fromEntries(
      [
        ...document.querySelectorAll<HTMLElement>("[data-app-bar] [data-tab]"),
      ].map((tab) => {
        const r = tab.getBoundingClientRect();
        return [
          tab.dataset.tab!,
          { x: r.x, y: r.y, width: r.width, height: r.height },
        ];
      }),
    ),
  );
}

async function open(
  browser: Browser,
  screen: Screen,
  width: number,
  theme: (typeof themes)[number],
) {
  const context = await fixture.context(browser, screen.state, {
    viewport: { width, height: width < 700 ? 844 : 800 },
    colorScheme: theme,
  });
  await context.addInitScript(recorder);
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const requests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    // Reads of a resource; sends (analytics events, answers) are not reads.
    if (
      request.method() === "GET" &&
      url.origin === origin &&
      url.pathname.startsWith("/api/")
    )
      requests.push(`GET ${url.pathname}${url.search}`);
  });
  await page.goto(origin + screen.path, { waitUntil: "domcontentloaded" });
  return { context, page, errors, requests };
}

for (const engine of engines) {
  const browser = await (engine === "webkit" ? webkit : chromium).launch();
  for (const width of widths)
    for (const theme of themes) {
      const where = `${engine} ${width} ${theme}`;
      let logo: Box | null = null;
      const tabs: Record<string, Record<string, Box>> = {};
      for (const screen of screens) {
        const tag = `${screen.id} ${where}`;
        // A screen that moved or flickered loads once more: a load-order
        // accident on a busy machine shows once, a real flicker every time,
        // and only a second showing fails. The first is still reported.
        let opened: Awaited<ReturnType<typeof open>> | null = null;
        for (let attempt = 1; attempt <= 2; attempt++) {
          if (opened) await opened.context.close();
          opened = await open(browser, screen, width, theme);
          const { page, errors, requests } = opened;
          try {
            await screen.ready(page);
          } catch (error) {
            console.error(error);
            if (attempt === 2) failures.push(`${tag}: never ready`);
            continue;
          }
          // Past the first two seconds, so every recorder has run its course.
          await page.waitForTimeout(2200);
          await settle(page, 300);
          const counts = new Map<string, number>();
          for (const request of requests)
            counts.set(request, (counts.get(request) ?? 0) + 1);
          const twice = [...counts].filter(([, n]) => n > 1);
          const recorded = await page.evaluate(() => {
            const w = window as unknown as {
              __shell: { cls: number; shifts: string[] };
              __stable: { flips: string[] };
            };
            return {
              cls: w.__shell.cls,
              shifts: w.__shell.shifts,
              flips: w.__stable.flips,
            };
          });
          const found = [
            ...(twice.length
              ? [
                  `requested twice while loading: ${twice.map(([r, n]) => `${r} ×${n}`).join("; ")}`,
                ]
              : []),
            ...(recorded.cls >= 0.001
              ? [`layout shift ${recorded.cls.toFixed(4)}`]
              : []),
            ...(recorded.shifts.length
              ? [`moved while loading: ${recorded.shifts.join("; ")}`]
              : []),
            ...(recorded.flips.length
              ? [`text changed without input: ${recorded.flips.join("; ")}`]
              : []),
            ...(errors.length ? [`page errors ${errors.join("; ")}`] : []),
          ];
          if (!found.length) break;
          if (attempt === 1) {
            console.warn(`${tag}: once, loading again: ${found.join(" | ")}`);
            continue;
          }
          for (const finding of found) failures.push(`${tag}: ${finding}`);
        }
        const { context, page } = opened!;
        if (!(await page.locator("[data-app-logo]").count())) {
          await context.close();
          continue;
        }

        // The logo: one spot on every screen.
        const bar = await page.locator("[data-app-logo]").first().boundingBox();
        logo ??= bar;
        check(
          same(bar, logo),
          `${tag}: logo at ${show(bar)}, elsewhere ${show(logo)}`,
        );
        // A group's tabs: one place on every screen of the group.
        if (screen.group !== "practice") {
          const here = await tabBoxes(page);
          const key = `${screen.group}:${screen.state}`;
          const first = (tabs[key] ??= here);
          for (const [id, box] of Object.entries(here))
            check(
              same(box, first[id] ?? null),
              `${tag}: tab ${id} at ${show(box)}, elsewhere ${show(first[id] ?? null)}`,
            );
          check(
            Object.keys(here).length === Object.keys(first).length,
            `${tag}: ${Object.keys(here).length} tabs, elsewhere ${Object.keys(first).length}`,
          );
        }
        if (shots && engine === "chromium")
          await page.screenshot({
            path: `${shots}/${screen.id}-${width}-${theme}.png`,
          });

        // The drawer opens from the logo and closes on the same spot.
        await page.locator("[data-app-logo]").first().click();
        const close = page.locator("[data-shell-close]");
        await close.waitFor();
        await page.waitForTimeout(250);
        const inside = await close.boundingBox();
        check(
          same(inside, bar),
          `${tag}: the open drawer's logo at ${show(inside)}, the bar's at ${show(bar)}`,
        );
        if (shots && engine === "chromium" && screen.id === "overview")
          await page.screenshot({
            path: `${shots}/drawer-${width}-${theme}.png`,
          });
        await close.click();
        await page.getByRole("dialog").waitFor({ state: "detached" });
        await page.waitForFunction(() =>
          document.activeElement?.matches(
            "[data-app-bar] [data-navigation-trigger]",
          ),
        );
        await page.keyboard.press("Enter");
        await close.waitFor();
        await page.keyboard.press("Escape");
        await page.getByRole("dialog").waitFor({ state: "detached" });
        await page.waitForFunction(() =>
          document.activeElement?.matches(
            "[data-app-bar] [data-navigation-trigger]",
          ),
        );
        check(
          same(
            await page.locator("[data-app-logo]").first().boundingBox(),
            bar,
          ),
          `${tag}: the logo moved after the drawer closed`,
        );
        await context.close();
      }

      // Going between a group's tabs keeps the very same bar: never remounted,
      // its tabs never moved.
      for (const [group, path, order] of [
        ["progress", "/overview", ["pathways", "inventory", "overview"]],
        ["account", "/family/security", ["learners", "access", "privacy"]],
      ] as const) {
        const screen = screens.find((s) => s.path === path)!;
        const { context, page, errors, requests } = await open(
          browser,
          screen,
          width,
          theme,
        );
        await screen.ready(page);
        await settle(page, 500);
        await page.evaluate(() => {
          (
            document.querySelector("[data-app-bar]") as HTMLElement & {
              __mark?: number;
            }
          ).__mark = 1;
        });
        const before = await tabBoxes(page);
        const logoBefore = await page
          .locator("[data-app-logo]")
          .first()
          .boundingBox();
        for (const id of order) {
          const accountReads = requests.filter(
            (r) => r === "GET /api/v1/me",
          ).length;
          const refreshed = page.waitForResponse(
            (response) => new URL(response.url()).pathname === "/api/v1/me",
          );
          await page.locator(`[data-app-bar] [data-tab="${id}"]`).click();
          await refreshed;
          await page
            .locator(`[data-app-bar] [data-tab="${id}"][aria-current="page"]`)
            .waitFor();
          await settle(page, 400);
          check(
            requests.filter((r) => r === "GET /api/v1/me").length ===
              accountReads + 1,
            `${group} → ${id} ${where}: navigation must refresh the account once`,
          );
          const kept = await page.evaluate(
            () =>
              (
                document.querySelector("[data-app-bar]") as HTMLElement & {
                  __mark?: number;
                }
              ).__mark === 1,
          );
          check(kept, `${group} → ${id} ${where}: the bar was remounted`);
          const after = await tabBoxes(page);
          for (const [tab, box] of Object.entries(before))
            check(
              same(after[tab] ?? null, box),
              `${group} → ${id} ${where}: tab ${tab} moved to ${show(after[tab] ?? null)}`,
            );
          check(
            same(
              await page.locator("[data-app-logo]").first().boundingBox(),
              logoBefore,
            ),
            `${group} → ${id} ${where}: the logo moved`,
          );
        }
        check(!errors.length, `${group} tabs ${where}: page errors ${errors}`);
        await context.close();
      }
    }
  await browser.close();
}

await fixture.close();
if (failures.length) {
  console.error(`${failures.length} app frame failure(s):`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log(
  `App frame holds still: ${screens.length} screens × ${widths.join("/")} px × light/dark × ${engines.join("/")}.`,
);
process.exit(0);
