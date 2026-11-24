/**
 * "Allow Colorful" in a real browser: the adult's one switch, and what a
 * learner sees on each side of it.
 *
 * - A teacher's class and their school (Student experience), and a parent's
 *   child (the child's settings): the switch flips with nothing on the screen
 *   moving, at 390 and 1280, light and dark. Off at the school shows the
 *   class's switch off, "Set by" the school, and not to be turned on.
 * - A student of the class, at 320, 390 and 1280. On: their menu has Look and
 *   Color, and they choose Colorful. Off: a cold load on that same device
 *   (which remembers Colorful) never paints Colorful, not for one frame; the
 *   menu has no Look and no Color, and nothing in it overflows; the server
 *   refuses Colorful. On again: the Colorful they chose is back.
 * - A screen already open, the switch flipped on another device: the
 *   student's practice turns Calm, and Colorful again, within a few seconds
 *   with the child doing nothing and nothing on the screen moving (390 and
 *   1280), for a class's switch, a school's and a parent's (a family's child
 *   on their own phone). A tab whose network holds the stream follows no
 *   later than its next problem.
 * - Their menu after the switch went off, watched frame by frame from the
 *   press: no Look or Color row in any frame and nothing in the sheet
 *   moving, both once the screen has followed and when the menu is opened
 *   the moment the switch is flipped (before anything told the screen); the
 *   other way, the rows are there from the first frame.
 * - The switch flipped while an answer's feedback is being read: the sheet
 *   keeps its shape, and the next problem arrives in the new look.
 * - A real right answer on the student's practice: no request comes back
 *   404 and nothing fails to load, and every icon the page names is served.
 *
 * Screenshots go to `--out` (default artifacts/allow-colorful).
 *
 *   AMP_TEST_DATABASE_URL=postgres://…/amp_test npx tsx scripts/verify-allow-colorful-ui.ts [--port 4990]
 */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
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
import { answerOne, trackPracticeProblems } from "./ui-practice-answer";
import { practicePath } from "../src/web/features/spaces/identity";

const chromium = secureChromium(rawChromium);
const argument = (name: string) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : undefined;
};
const OUT = argument("out") ?? "artifacts/allow-colorful";
await mkdir(OUT, { recursive: true });
const stack = await startPersonaStack({
  webPort: Number(argument("port") ?? 4990),
  personas: ["teacher-class", "family"],
  name: "allow_colorful_ui",
  out: OUT,
});
const { origin } = stack;
const failures: string[] = [];
const check = (ok: unknown, message: string, detail?: unknown) => {
  if (!ok)
    failures.push(
      detail === undefined ? message : `${message}: ${JSON.stringify(detail)}`,
    );
};

/** From the document's first frame: every look `<html>` wore, and every
 * layout shift (a click's own included: nothing may move at all). */
const OBSERVER = `(() => {
  const w = window;
  // tsx names the functions it passes to the page.
  w.__name = (fn) => fn;
  w.__looks = [];
  w.__shift = 0;
  const tick = () => {
    const look = document.documentElement.getAttribute("data-look") || "calm";
    if (w.__looks[w.__looks.length - 1] !== look) w.__looks.push(look);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) w.__shift += entry.value;
    }).observe({ type: "layout-shift", buffered: true });
  } catch {}
})();`;
const shiftOf = (page: Page) =>
  page.evaluate(() => (window as unknown as { __shift: number }).__shift);
const resetShift = (page: Page) =>
  page.evaluate(() => {
    (window as unknown as { __shift: number }).__shift = 0;
  });
/** Where everything a person reads or presses is, to a tenth of a pixel. */
const boxes = (page: Page, scope: string) =>
  page
    .locator(
      `${scope} :is(h1, h2, h3, dt, [role=radio], [role=switch], button, a)`,
    )
    .evaluateAll((nodes) =>
      nodes
        .filter((node) => (node as HTMLElement).offsetParent !== null)
        .map((node) => {
          const box = node.getBoundingClientRect();
          return [
            (node.getAttribute("aria-label") ?? node.textContent ?? "")
              .trim()
              .slice(0, 28),
            ...[box.x, box.y, box.width, box.height].map(
              (value) => Math.round(value * 10) / 10,
            ),
          ].join(" ");
        }),
    );
const settle = (page: Page, ms = 450) => page.waitForTimeout(ms);

async function signedIn(
  browser: Browser,
  person: string,
  width: number,
  colorScheme: "light" | "dark",
) {
  const context = await browser.newContext({
    viewport: { width, height: width < 600 ? 844 : 900 },
    colorScheme,
  });
  await context.addInitScript(OBSERVER);
  const response = await context.request.post(
    `${origin}/api/auth/sign-in/email`,
    {
      headers: { Origin: origin },
      data: { email: personaEmail(person), password: PERSONA_PASSPHRASE },
    },
  );
  assert.ok(response.ok(), `${person} signs in: ${response.status()}`);
  return context;
}
async function bearer(context: BrowserContext) {
  const session = (await (
    await context.request.get(`${origin}/api/auth/get-session`)
  ).json()) as { session: { token: string } };
  return { Authorization: `Bearer ${session.session.token}`, Origin: origin };
}
const allowSwitch = (page: Page, scope = "body") =>
  page.locator(scope).getByRole("switch", { name: "Allow Colorful" });
const isOn = async (page: Page, scope = "body") =>
  (await allowSwitch(page, scope).getAttribute("aria-checked")) === "true";
/** Flips the switch and holds the screen to "nothing moved". */
async function flip(page: Page, scope: string, tag: string, to: boolean) {
  // In view first: the click's own scroll is not the screen moving.
  await allowSwitch(page, scope).scrollIntoViewIfNeeded();
  await settle(page);
  await resetShift(page);
  const before = await boxes(page, scope);
  await allowSwitch(page, scope).click();
  await page.waitForFunction(
    ([inside, want]) =>
      document
        .querySelector(inside as string)
        ?.querySelector('[role=switch][aria-label="Allow Colorful"]')
        ?.getAttribute("aria-checked") === want,
    [scope, String(to)],
  );
  await settle(page, 700);
  const after = await boxes(page, scope);
  const moved = [
    ...before.filter((box) => !after.includes(box)).map((box) => `was ${box}`),
    ...after.filter((box) => !before.includes(box)).map((box) => `now ${box}`),
  ]
    // The switch's own name is unchanged; its state is not a box.
    .slice(0, 8);
  check(
    moved.length === 0,
    `${tag}: nothing moves when the switch goes ${to ? "on" : "off"}`,
    moved,
  );
  const shift = await shiftOf(page);
  check(shift === 0, `${tag}: layout shift going ${to ? "on" : "off"}`, shift);
}

const browser = await chromium.launch();
let failed = false;
try {
  // ---- who and where --------------------------------------------------
  const lead = await signedIn(browser, "teacher-class", 1280, "light");
  const teacher = await bearer(lead);
  const home = await lead.newPage();
  // Their class: where `/` opens, or the first class a screen of theirs
  // links to (a teacher with more than one place lands on the launcher).
  const CLASS = /^\/school\/([^/]+)\/classes\/([^/]+)/;
  const linked = async () => {
    await home
      .waitForLoadState("networkidle", { timeout: 5_000 })
      .catch(() => undefined);
    await settle(home, 600);
    return [
      new URL(home.url()).pathname,
      ...(await home
        .locator("a[href]")
        .evaluateAll((links) =>
          links.map(
            (link) => new URL((link as HTMLAnchorElement).href).pathname,
          ),
        )),
    ];
  };
  await home.goto(`${origin}/`);
  let paths = await linked();
  if (!paths.some((path) => CLASS.test(path))) {
    const place = paths.find((path) => /^\/school\/[^/]+/.test(path));
    assert.ok(place, `the teacher's school (from ${paths.join(", ")})`);
    await home.goto(`${origin}${place.match(/^\/school\/[^/]+/)![0]}/classes`);
    paths = await linked();
  }
  const found = paths.map((path) => path.match(CLASS)).find(Boolean);
  assert.ok(found, `the teacher's class (from ${paths.join(", ")})`);
  const [, orgId, classId] = found;
  await home.close();
  const api = `${origin}/api/v1/school`;
  type View = {
    canEdit: boolean;
    scope: { name: string };
    settings: { look: { lockedBy: { name: string } | null } };
  };
  const view = async (path: string) =>
    (await (
      await lead.request.get(`${api}/${path}/experience`, { headers: teacher })
    ).json()) as View;
  const write = async (path: string, allowed: boolean) => {
    const sent = await lead.request.post(`${api}/${path}/experience`, {
      headers: teacher,
      data: allowed
        ? { values: { look: null }, locks: { look: false } }
        : { values: { look: "calm" }, locks: { look: true } },
    });
    assert.ok(sent.ok(), `${path} ${allowed ? "on" : "off"}: ${sent.status()}`);
  };
  const classPath = `classes/${classId}`;
  const orgPath = `orgs/${orgId}`;
  const school = await view(orgPath);
  const klass = await view(classPath);
  assert.ok(school.canEdit && klass.canEdit, "the teacher runs both scopes");
  assert.equal(klass.settings.look.lockedBy, null, "Colorful starts allowed");

  // ---- the class's and the school's switch ----------------------------
  for (const width of [390, 1280])
    for (const scheme of ["light", "dark"] as const) {
      const tag = `${width} ${scheme}`;
      const context = await signedIn(browser, "teacher-class", width, scheme);
      const page = await context.newPage();
      const shot = (name: string) =>
        page.screenshot({ path: `${OUT}/${name}-${width}-${scheme}.png` });
      await page.goto(
        `${origin}/school/${orgId}/classes/${classId}/experience`,
      );
      await allowSwitch(page).waitFor();
      check(await isOn(page), `class ${tag}: on by default`);
      check(
        (await page.getByRole("radiogroup", { name: "Look" }).count()) === 0 &&
          (await page.getByRole("button", { name: /^Lock/ }).count()) === 0,
        `class ${tag}: no Calm/Colorful choice and no lock on a class`,
      );
      await settle(page);
      await shot("class-on");
      await flip(page, "main", `class ${tag}`, false);
      await shot("class-off");
      check(
        (await view(classPath)).settings.look.lockedBy?.name ===
          klass.scope.name,
        `class ${tag}: off is stored for the class`,
      );
      await flip(page, "main", `class ${tag}`, true);
      check(
        (await view(classPath)).settings.look.lockedBy === null,
        `class ${tag}: on again`,
      );
      // The school above: off there is off here, and says who set it.
      await page.goto(`${origin}/school/${orgId}/experience`);
      await allowSwitch(page).waitFor();
      check(await isOn(page), `school ${tag}: on by default`);
      await flip(page, "main", `school ${tag}`, false);
      await shot("school-off");
      await page.goto(
        `${origin}/school/${orgId}/classes/${classId}/experience`,
      );
      await allowSwitch(page).waitFor();
      await settle(page);
      check(
        !(await isOn(page)) && (await allowSwitch(page).isDisabled()),
        `class ${tag}: off above is off here, and not to be turned on`,
      );
      check(
        (await allowSwitch(page).innerText()).includes(
          `Set by ${school.scope.name}`,
        ),
        `class ${tag}: says who set it`,
        await allowSwitch(page).innerText(),
      );
      await shot("class-set-by-school");
      await page.goto(`${origin}/school/${orgId}/experience`);
      await allowSwitch(page).waitFor();
      await flip(page, "main", `school ${tag}`, true);
      await context.close();
    }

  // ---- a student of the class -----------------------------------------
  const cards = await lead.request.post(`${api}/classes/${classId}/cards`, {
    headers: teacher,
    data: {},
  });
  assert.ok(cards.ok(), `the class's cards: ${cards.status()}`);
  const { cards: issued } = (await cards.json()) as {
    cards: { token: string }[];
  };
  const joined = await lead.request.post(`${api}/join/card`, {
    headers: { Origin: origin },
    data: { token: issued[0]!.token },
  });
  assert.ok(joined.ok(), `a card signs a student in: ${joined.status()}`);
  const grant = (await joined.json()) as { accountId: string; token: string };
  const student = { Authorization: `Bearer ${grant.token}`, Origin: origin };
  const me = (await (
    await lead.request.get(`${origin}/api/v1/me`, { headers: student })
  ).json()) as { learners: { id: string }[] };
  const statePath = `${origin}/api/v1/learners/${me.learners[0]!.id}/practice-state`;
  type State = {
    revision: number;
    look: string | null;
    effectiveLook: string;
    lookLocked: boolean;
  };
  const state = async () =>
    (await (
      await lead.request.get(statePath, { headers: student })
    ).json()) as State;
  const choose = async (look: string) =>
    lead.request.post(statePath, {
      headers: student,
      data: {
        kind: "look",
        look,
        revision: (await state()).revision,
        requestId: crypto.randomUUID(),
      },
    });

  for (const width of [320, 390, 1280]) {
    const tag = `student ${width}`;
    await write(classPath, true);
    assert.equal((await choose("calm")).status(), 200);
    const context = await browser.newContext({
      viewport: { width, height: width < 600 ? 740 : 900 },
    });
    await context.addInitScript(OBSERVER);
    // A student's sign-in is the tab's own (a printed card's link).
    await context.addInitScript(
      `if (!sessionStorage.getItem("amp.student")) sessionStorage.setItem("amp.student", ${JSON.stringify(JSON.stringify(grant))});`,
    );
    const practice = async () => {
      const page = await context.newPage();
      // Their practice, as "Continue" on their home opens it.
      await page.goto(`${origin}/practice`);
      await page
        .locator(".problem-stage .question")
        .waitFor()
        .catch(async (error: unknown) => {
          await page.screenshot({ path: `${OUT}/failure-${width}.png` });
          throw new Error(
            `${tag}: practice didn't open at ${page.url()}: ${(await page.locator("body").innerText()).slice(0, 300)}`,
            { cause: error },
          );
        });
      return page;
    };
    const menu = async (page: Page) => {
      await page.getByRole("button", { name: "Open AMP menu" }).click();
      const drawer = page.getByRole("dialog", {
        name: "Adaptive Math Pathways",
      });
      await drawer.waitFor();
      await settle(page);
      return drawer;
    };
    /** Nothing in the menu is cut off or pushed out of it. */
    const menuHolds = async (page: Page, what: string) => {
      const found = await page
        .getByRole("dialog", { name: "Adaptive Math Pathways" })
        .evaluate((drawer) => {
          const box = drawer.getBoundingClientRect();
          return {
            wide: drawer.scrollWidth - drawer.clientWidth,
            out: [...drawer.querySelectorAll("button, a, [role=switch]")]
              .filter((node) => (node as HTMLElement).offsetParent !== null)
              .map((node) => node.getBoundingClientRect())
              .filter((b) => b.left < box.left - 1 || b.right > box.right + 1)
              .length,
            sound: !!drawer.querySelector('[role=switch][aria-label="Sound"]'),
          };
        });
      check(
        found.wide <= 0 && found.out === 0 && found.sound,
        `${tag}: the menu ${what} holds together`,
        found,
      );
    };

    // On: the look is theirs.
    let page = await practice();
    let drawer = await menu(page);
    check(
      (await drawer.locator("[data-look-setting]").count()) === 1 &&
        (await drawer.getByRole("radio", { name: "Colorful" }).isEnabled()) &&
        (await drawer.getByRole("slider", { name: "Color" }).count()) === 1,
      `${tag}: allowed, the menu has Look and Color`,
    );
    await menuHolds(page, "with Look");
    await drawer.getByRole("radio", { name: "Colorful" }).click();
    await page
      .locator(':root[data-look="bold"]')
      .waitFor({ state: "attached" });
    await settle(page, 600);
    await page.screenshot({ path: `${OUT}/menu-with-look-${width}.png` });
    check(
      await page.evaluate(() =>
        (localStorage.getItem("amp.look-ahead") ?? "").includes(":"),
      ),
      `${tag}: this device remembers Colorful`,
    );
    await page.close();

    // Off, on a device that remembers Colorful: Calm from the first frame.
    await write(classPath, false);
    page = await practice();
    await settle(page, 1500);
    const looks = await page.evaluate(
      () => (window as unknown as { __looks: string[] }).__looks,
    );
    check(
      !looks.includes("bold"),
      `${tag}: off, a cold load never paints Colorful`,
      looks,
    );
    check(
      await page.evaluate(
        () =>
          ![
            ...document.querySelectorAll("[data-celebration] [data-shown]"),
          ].some((node) => (node as HTMLElement).checkVisibility()),
      ),
      `${tag}: off, no points chip`,
    );
    await page.screenshot({ path: `${OUT}/practice-off-${width}.png` });
    drawer = await menu(page);
    check(
      (await drawer.locator("[data-look-setting]").count()) === 0 &&
        (await drawer.getByRole("radio", { name: "Colorful" }).count()) === 0 &&
        (await drawer.getByRole("slider", { name: "Color" }).count()) === 0 &&
        (await drawer.getByText(/^(Look|Color)$/).count()) === 0 &&
        (await drawer.getByText(/Set by/).count()) === 0,
      `${tag}: off, the menu has no Look and no Color at all`,
    );
    await menuHolds(page, "without Look");
    await page.screenshot({ path: `${OUT}/menu-without-look-${width}.png` });
    const refused = await choose("bold");
    check(
      refused.status() === 409,
      `${tag}: off, the server refuses Colorful`,
      refused.status(),
    );
    const held = await state();
    check(
      held.effectiveLook === "calm" && held.lookLocked && held.look === "bold",
      `${tag}: off is Calm, and their own choice is kept`,
      held,
    );
    await page.close();

    // On again: the Colorful they chose is back, with its menu.
    await write(classPath, true);
    page = await practice();
    await page
      .locator(':root[data-look="bold"]')
      .waitFor({ state: "attached", timeout: 10_000 })
      .catch(() => undefined);
    check(
      (await page.evaluate(() =>
        document.documentElement.getAttribute("data-look"),
      )) === "bold",
      `${tag}: on again, their Colorful is back`,
    );
    drawer = await menu(page);
    check(
      (await drawer.locator("[data-look-setting]").count()) === 1,
      `${tag}: on again, the menu has Look`,
    );
    await context.close();
  }

  // ---- a screen already open follows the switch -----------------------
  /** Where everything on an open practice screen is. */
  const practiceBoxes = (page: Page) =>
    page
      .locator(
        ":is(.practice-topic, .practice-topic span, .question, .problem-content, .answer-dock, .answer-dock button, .answer-dock input, [data-app-bar] button, [data-app-bar] a)",
      )
      .evaluateAll((nodes) =>
        nodes
          .filter((node) => (node as HTMLElement).offsetParent !== null)
          .map((node) => {
            const box = node.getBoundingClientRect();
            return [
              `${node.tagName.toLowerCase()}.${String(node.className).split(" ")[0]}`,
              (node.getAttribute("aria-label") ?? node.textContent ?? "")
                .trim()
                .slice(0, 18),
              ...[box.x, box.y, box.width, box.height].map(
                (value) => Math.round(value * 10) / 10,
              ),
            ].join(" ");
          }),
      );
  const lookNow = (page: Page) =>
    page.evaluate(
      () => document.documentElement.getAttribute("data-look") ?? "calm",
    );
  /** Someone else flips the switch; the open screen must wear `want` within
   * `withinMs` with the child doing nothing, and nothing on it may move. */
  async function follows(
    page: Page,
    tag: string,
    want: "calm" | "bold",
    flipIt: () => Promise<void>,
    withinMs = 5_000,
  ) {
    await settle(page, 900);
    await resetShift(page);
    const before = await practiceBoxes(page);
    const started = Date.now();
    await flipIt();
    const arrived = await page
      .waitForFunction(
        (look) =>
          (document.documentElement.getAttribute("data-look") ?? "calm") ===
          look,
        want,
        { timeout: withinMs },
      )
      .then(
        () => true,
        () => false,
      );
    const took = Date.now() - started;
    check(
      arrived,
      `${tag}: the open screen turns ${want === "bold" ? "Colorful" : "Calm"} by itself within ${withinMs / 1000} s`,
      { look: await lookNow(page), waitedMs: took },
    );
    if (!arrived) return;
    console.log(
      `  ${tag}: ${want === "bold" ? "Colorful" : "Calm"} after ${took} ms`,
    );
    // The hue's arrival and the chip's own placement have run.
    await settle(page, 1200);
    const after = await practiceBoxes(page);
    const moved = [
      ...before
        .filter((box) => !after.includes(box))
        .map((box) => `was ${box}`),
      ...after
        .filter((box) => !before.includes(box))
        .map((box) => `now ${box}`),
    ].slice(0, 8);
    check(
      moved.length === 0,
      `${tag}: nothing moves when the look turns ${want === "bold" ? "Colorful" : "Calm"}`,
      moved,
    );
    const shift = await shiftOf(page);
    check(
      shift === 0,
      `${tag}: layout shift turning ${want === "bold" ? "Colorful" : "Calm"}`,
      shift,
    );
  }
  /** From now, every frame the menu's sheet is on the page: whether the
   * Look rows are in it, the look the page wears behind it, and where each
   * of its rows is within the sheet (the sheet slides in; its rows may not
   * move inside it). Also whether the Look rows were ever in the document
   * at all, painted or not. */
  const watchMenu = (page: Page) =>
    page.evaluate(() => {
      const w = window as unknown as {
        __menu: {
          frames: {
            look: boolean;
            page: string;
            rows: Record<string, string>;
          }[];
          ever: boolean;
          stop: boolean;
        };
      };
      const state = (w.__menu = {
        frames: [] as (typeof w.__menu)["frames"],
        ever: !!document.querySelector("[data-look-setting]"),
        stop: false,
      });
      new MutationObserver(() => {
        if (!state.stop && document.querySelector("[data-look-setting]"))
          state.ever = true;
      }).observe(document.body, { childList: true, subtree: true });
      const tick = () => {
        if (state.stop) return;
        const sheet = document.querySelector("[data-navigation-sheet]");
        if (sheet) {
          const at = sheet.getBoundingClientRect();
          const rows: Record<string, string> = {};
          for (const node of sheet.querySelectorAll(
            "a, button, legend, [role=switch], [role=radio], [role=slider]",
          )) {
            if ((node as HTMLElement).offsetParent === null) continue;
            const box = node.getBoundingClientRect();
            const name = `${node.tagName.toLowerCase()} ${(
              node.getAttribute("aria-label") ??
              node.textContent ??
              ""
            )
              .trim()
              .slice(0, 24)}`;
            let key = name;
            for (let n = 2; key in rows; n++) key = `${name} #${n}`;
            rows[key] = [box.x - at.x, box.y - at.y, box.width, box.height]
              .map((value) => Math.round(value * 10) / 10)
              .join(" ");
          }
          state.frames.push({
            look: !!sheet.querySelector("[data-look-setting]"),
            page: document.documentElement.getAttribute("data-look") ?? "calm",
            rows,
          });
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  /** Opens the menu and reads what `watchMenu` saw of it, then closes it. */
  async function menuFrames(page: Page, tag: string, rows: "none" | "all") {
    await page.locator("[data-navigation-trigger]").first().click();
    await page.locator("[data-navigation-sheet]").waitFor();
    await settle(page, 900);
    const seen = await page.evaluate(() => {
      const w = window as unknown as {
        __menu: {
          frames: {
            look: boolean;
            page: string;
            rows: Record<string, string>;
          }[];
          ever: boolean;
          stop: boolean;
        };
      };
      w.__menu.stop = true;
      return { frames: w.__menu.frames, ever: w.__menu.ever };
    });
    check(seen.frames.length > 5, `${tag}: the menu was watched as it opened`, {
      frames: seen.frames.length,
    });
    const withLook = seen.frames.filter((frame) => frame.look).length;
    if (rows === "none")
      check(
        withLook === 0 && !seen.ever,
        `${tag}: the menu never has the Look or Color rows, in any frame`,
        { framesWithLook: withLook, of: seen.frames.length, ever: seen.ever },
      );
    else
      check(
        withLook === seen.frames.length,
        `${tag}: the menu has the Look and Color rows from its first frame`,
        { framesWithLook: withLook, of: seen.frames.length },
      );
    check(
      seen.frames.every(
        (frame) => frame.page === (rows === "none" ? "calm" : "bold"),
      ),
      `${tag}: the page behind the menu is ${rows === "none" ? "Calm" : "Colorful"} from the menu's first frame`,
      [...new Set(seen.frames.map((frame) => frame.page))],
    );
    // Nothing in the sheet moves, comes or goes once it is on the page.
    const first = seen.frames[0]?.rows ?? {};
    const moved = new Set<string>();
    for (const frame of seen.frames) {
      for (const [key, at] of Object.entries(frame.rows))
        if (first[key] !== at)
          moved.add(`${key}: ${first[key] ?? "absent"} -> ${at}`);
      for (const key of Object.keys(first))
        if (!(key in frame.rows)) moved.add(`${key}: gone`);
    }
    check(
      moved.size === 0,
      `${tag}: nothing in the menu moves, comes or goes as it opens`,
      [...moved].slice(0, 6),
    );
    await page.keyboard.press("Escape");
    await page
      .locator("[data-navigation-sheet]")
      .waitFor({ state: "detached" });
    await settle(page, 300);
  }
  const wears = (page: Page, look: "calm" | "bold", timeout = 5_000) =>
    page.waitForFunction(
      (want) =>
        (document.documentElement.getAttribute("data-look") ?? "calm") === want,
      look,
      { timeout },
    );
  /** The open screen wears `look` within five seconds, by itself; said,
   * and the journey goes on, where it doesn't. */
  const followed = async (page: Page, look: "calm" | "bold", tag: string) =>
    check(
      await wears(page, look).then(
        () => true,
        () => false,
      ),
      `${tag}: the open screen is ${look === "bold" ? "Colorful" : "Calm"} by itself before its menu is opened`,
    );
  const studentTab = async (
    width: number,
    who: { accountId: string; token: string },
    prepare?: (context: BrowserContext) => Promise<unknown>,
  ) => {
    const context = await browser.newContext({
      viewport: { width, height: width < 600 ? 844 : 900 },
    });
    await context.addInitScript(OBSERVER);
    await context.addInitScript(
      `if (!sessionStorage.getItem("amp.student")) sessionStorage.setItem("amp.student", ${JSON.stringify(JSON.stringify(who))});`,
    );
    await prepare?.(context);
    const page = await context.newPage();
    await page.goto(`${origin}/practice`);
    await page.locator(".problem-stage .question").waitFor();
    return { context, page };
  };

  // A right answer on a student's practice asks for nothing that isn't
  // there: a 404 is a route that is missing or misnamed, or a question the
  // page should not ask, and an error in every console a check reads.
  {
    await write(orgPath, true);
    await write(classPath, true);
    assert.equal((await choose("bold")).status(), 200);
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await context.addInitScript(OBSERVER);
    await context.addInitScript(
      `if (!sessionStorage.getItem("amp.student")) sessionStorage.setItem("amp.student", ${JSON.stringify(JSON.stringify(grant))});`,
    );
    const page = await context.newPage();
    const notFound: string[] = [];
    page.on("response", (response) => {
      if (response.status() === 404)
        notFound.push(
          `${response.request().method()} ${new URL(response.url()).pathname}`,
        );
    });
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        /Failed to load resource/.test(message.text())
      )
        notFound.push(`${message.text()} (${message.location().url})`);
    });
    trackPracticeProblems(page);
    await page.goto(`${origin}/practice`);
    await page.locator(".problem-stage .question").waitFor();
    await answerOne(page, true);
    // The moment, the skill's record and what the sheet links to.
    await settle(page, 3_000);
    // The icons every page names: the browser asks for the favicon by
    // itself and late, so each is asked for here too.
    for (const href of await page
      .locator('link[rel~="icon"], link[rel="apple-touch-icon"]')
      .evaluateAll((links) =>
        links.map((link) => (link as HTMLLinkElement).href),
      )) {
      const got = await page.request.get(href);
      check(got.status() === 200, `a page's icon is there: ${href}`, {
        status: got.status(),
      });
    }
    check(
      notFound.length === 0,
      "a right answer on a student's practice: no request comes back not found",
      notFound,
    );
    await context.close();
  }

  // A class's student, their teacher's and their school's switch.
  for (const width of [390, 1280]) {
    await write(orgPath, true);
    await write(classPath, true);
    assert.equal((await choose("bold")).status(), 200);
    const { context, page } = await studentTab(width, grant);
    await page
      .locator(':root[data-look="bold"]')
      .waitFor({ state: "attached" });
    // A skill whose name is long enough to wrap beside the points chip on
    // a phone, and to be shortened in the bar: the chip's room must not
    // come and go with the look under it.
    await page.goto(
      `${origin}${practicePath(me.learners[0]!.id, { template: "mark-unit-squares" })}`,
    );
    await page.locator(".problem-stage .question").waitFor();
    await page
      .locator(':root[data-look="bold"]')
      .waitFor({ state: "attached" });
    for (const [source, path] of [
      ["the class", classPath],
      ["the school", orgPath],
    ] as const) {
      const tag = `open screen ${width}, ${source}`;
      await follows(page, tag, "calm", () => write(path, false));
      await follows(page, tag, "bold", () => write(path, true));
    }

    // Their menu, after the switch went off. It must never paint the Look
    // and Color rows it is about to take away: not once the screen has
    // followed, and not when it is opened the moment the switch is flipped,
    // before anything could have told this screen.
    {
      const tag = `menu ${width}`;
      await write(classPath, false);
      await followed(page, "calm", tag);
      await watchMenu(page);
      await menuFrames(page, `${tag}, off and the screen followed`, "none");
      await write(classPath, true);
      await followed(page, "bold", tag);
      await settle(page, 2_500);
      await watchMenu(page);
      await write(classPath, false);
      await menuFrames(page, `${tag}, opened as the switch goes off`, "none");
      await settle(page, 2_500);
      await watchMenu(page);
      await write(classPath, true);
      await menuFrames(page, `${tag}, opened as the switch goes on`, "all");
      await followed(page, "bold", tag);
    }

    // An answer's feedback is on screen when the switch is flipped: the
    // sheet being read keeps its shape; the next problem arrives in the
    // new look, in its first frame.
    {
      const tag = `feedback on screen ${width}`;
      for (const want of ["calm", "bold"] as const) {
        const now = want === "calm" ? "bold" : "calm";
        const word = want === "bold" ? "Colorful" : "Calm";
        await page
          .getByRole("button", { name: "Skip this problem and see its answer" })
          .click();
        await page.locator(".feedback").waitFor();
        await settle(page, 1_200);
        await resetShift(page);
        const before = await boxes(page, ".feedback");
        await write(classPath, want === "bold");
        await settle(page, 3_000);
        check(
          (await lookNow(page)) === now,
          `${tag}: turning ${word} waits while the feedback is read`,
          await lookNow(page),
        );
        check(
          JSON.stringify(await boxes(page, ".feedback")) ===
            JSON.stringify(before),
          `${tag}: the feedback keeps its shape as the switch turns ${word}`,
        );
        const shift = await shiftOf(page);
        check(shift === 0, `${tag}: layout shift, switch to ${word}`, shift);
        const shown = await page
          .locator(".problem-content")
          .getAttribute("data-problem-id");
        await page.evaluate(() => {
          (window as unknown as { __looks: string[] }).__looks = [];
        });
        await page.locator(".next-action").click();
        await page.waitForFunction(
          (id) =>
            document
              .querySelector(".problem-content")
              ?.getAttribute("data-problem-id") !== id,
          shown,
        );
        const arrived = await wears(page, want, 1_500).then(
          () => true,
          () => false,
        );
        check(
          arrived,
          `${tag}: the next problem arrives ${word}`,
          await lookNow(page),
        );
        await settle(page, 600);
      }
    }
    await context.close();
  }

  // A tab nothing feeds (its network holds the stream): no later than the
  // next problem.
  {
    const tag = "open screen 390, no stream";
    await write(classPath, true);
    assert.equal((await choose("bold")).status(), 200);
    const { context, page } = await studentTab(390, grant, (made) =>
      made.route("**/api/v1/school/student/live/stream", (route) =>
        route.abort(),
      ),
    );
    await page
      .locator(':root[data-look="bold"]')
      .waitFor({ state: "attached" });
    const nextProblem = async () => {
      const shown = await page
        .locator(".problem-content")
        .getAttribute("data-problem-id");
      await page
        .getByRole("button", { name: "Skip this problem and see its answer" })
        .click();
      await page.locator(".feedback").waitFor();
      await page.locator(".next-action").click();
      await page.waitForFunction(
        (id) =>
          document
            .querySelector(".problem-content")
            ?.getAttribute("data-problem-id") !== id,
        shown,
      );
    };
    for (const want of ["calm", "bold"] as const) {
      await write(classPath, want === "bold");
      await nextProblem();
      const arrived = await page
        .waitForFunction(
          (look) =>
            (document.documentElement.getAttribute("data-look") ?? "calm") ===
            look,
          want,
          { timeout: 4_000 },
        )
        .then(
          () => true,
          () => false,
        );
      check(
        arrived,
        `${tag}: ${want === "bold" ? "Colorful" : "Calm"} no later than the next problem`,
        await lookNow(page),
      );
    }
    await context.close();
  }
  await lead.close();

  // A family's child on their own phone, the parent's switch on another.
  for (const width of [390, 1280]) {
    const tag = `open screen ${width}, a parent`;
    const home = await signedIn(browser, "family", 1280, "light");
    const parent = await bearer(home);
    const me = (await (
      await home.request.get(`${origin}/api/v1/me`, { headers: parent })
    ).json()) as {
      family?: { learners: { id: string; name: string; adult?: boolean }[] };
    };
    const kid = me.family?.learners.find((l) => !l.adult && l.name);
    assert.ok(kid, "the family has a named child");
    const kidState = `${origin}/api/v1/learners/${kid.id}/practice-state`;
    const send = async (body: object) => {
      const now = (await (
        await home.request.get(kidState, { headers: parent })
      ).json()) as { revision: number };
      const sent = await home.request.post(kidState, {
        headers: parent,
        data: {
          ...body,
          revision: now.revision,
          requestId: crypto.randomUUID(),
        },
      });
      assert.ok(sent.ok(), `${JSON.stringify(body)}: ${sent.status()}`);
    };
    await send({ kind: "allowColorful", allowed: true });
    await send({ kind: "look", look: "bold" });
    // The family's link, as the parent's home shows it.
    const front = await home.newPage();
    await front.goto(`${origin}/`);
    const link = front.locator("[data-join-link] span").first();
    await link.waitFor();
    const address = `http://${(await link.innerText()).trim().replace(/^https?:\/\//, "")}`;
    await front.close();
    const phone = await browser.newContext({
      viewport: { width, height: width < 600 ? 844 : 900 },
    });
    await phone.addInitScript(OBSERVER);
    const page = await phone.newPage();
    await page.goto(address);
    await page.getByText("Tap your name").waitFor();
    await page
      .getByRole("link", { name: new RegExp(kid.name) })
      .or(page.getByRole("button", { name: new RegExp(kid.name) }))
      .first()
      .click();
    await page
      .getByText(/Pick 3 pictures|Pick your 3 pictures/)
      .first()
      .waitFor();
    for (const picture of ["fox", "boat", "kite"])
      await page
        .locator("button[aria-pressed]")
        .and(page.getByRole("button", { name: new RegExp(picture, "i") }))
        .click();
    const mine = page.getByRole("button", { name: "These are mine" });
    if (
      await mine.waitFor({ timeout: 1_500 }).then(
        () => true,
        () => false,
      )
    )
      await mine.click();
    await page.locator(".problem-stage .question").waitFor();
    await page
      .locator(':root[data-look="bold"]')
      .waitFor({ state: "attached" });
    await follows(page, tag, "calm", () =>
      send({ kind: "allowColorful", allowed: false }),
    );
    await follows(page, tag, "bold", () =>
      send({ kind: "allowColorful", allowed: true }),
    );
    await phone.close();
    await home.close();
  }

  // ---- a parent's child -----------------------------------------------
  for (const width of [390, 1280])
    for (const scheme of ["light", "dark"] as const) {
      const tag = `parent ${width} ${scheme}`;
      const context = await signedIn(browser, "family", width, scheme);
      const parent = await bearer(context);
      const page = await context.newPage();
      await page.goto(`${origin}/`);
      await page.waitForURL(/\/family\/[^/]+/);
      const family = new URL(page.url()).pathname.match(
        /^\/family\/([^/]+)/,
      )![1];
      await page.goto(`${origin}/family/${family}/settings`);
      const open = page.locator("[data-child-settings-open]").first();
      await open.waitFor();
      const child = (await open.getAttribute("data-child-settings-open"))!;
      await open.click();
      const sheet = `[data-child-settings-sheet="${child}"]`;
      await allowSwitch(page, sheet).waitFor();
      const childState = async () =>
        (await (
          await context.request.get(
            `${origin}/api/v1/learners/${child}/practice-state`,
            { headers: parent },
          )
        ).json()) as State & { lookLockedBy: string | null };
      check(await isOn(page, sheet), `${tag}: on by default`);
      check(
        (await page.locator(sheet).getByRole("radio").count()) === 0 &&
          (await page
            .locator(sheet)
            .getByRole("button", { name: "Lock" })
            .count()) === 0,
        `${tag}: no look to choose for the child, and no lock`,
      );
      await settle(page);
      await page.screenshot({ path: `${OUT}/child-on-${width}-${scheme}.png` });
      await flip(page, sheet, tag, false);
      await page.screenshot({
        path: `${OUT}/child-off-${width}-${scheme}.png`,
      });
      const off = await childState();
      check(
        off.lookLocked &&
          off.lookLockedBy === "adult" &&
          off.effectiveLook === "calm",
        `${tag}: off is stored for the child`,
        off,
      );
      await flip(page, sheet, tag, true);
      check(!(await childState()).lookLocked, `${tag}: on again`);
      await context.close();
    }

  if (failures.length) {
    failed = true;
    console.error(
      `${failures.length} checks failed:\n  ${failures.join("\n  ")}`,
    );
  } else
    console.log(
      `Allow Colorful: the switch at a class, a school and a child (390 and 1280, light and dark) moves nothing; off above is off below; a student under off never paints Colorful and has no Look in the menu (320, 390, 1280); their choice comes back; a screen already open follows the switch by itself (a class's, a school's, a parent's) with nothing moving, and a tab with no stream by its next problem; a menu opened the moment the switch goes off never paints the Look rows; feedback being read keeps its shape. Screenshots in ${OUT}`,
    );
} catch (error) {
  failed = true;
  console.error(error);
  if (failures.length) console.error(`Also:\n  ${failures.join("\n  ")}`);
} finally {
  await browser.close();
  await stack.stop();
}
process.exit(failed ? 1 : 0);
