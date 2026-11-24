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
  await lead.close();

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
      `Allow Colorful: the switch at a class, a school and a child (390 and 1280, light and dark) moves nothing; off above is off below; a student under off never paints Colorful and has no Look in the menu (320, 390, 1280); their choice comes back. Screenshots in ${OUT}`,
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
