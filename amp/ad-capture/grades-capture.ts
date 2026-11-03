/**
 * Ad capture: AMP's optional "Show grades and estimates" display, in the real
 * app (real routes, real Fastify API, in-memory synthetic learner "Maya",
 * src/workbook/synthetic.ts profile "third-grade"; see grades-fixture.ts).
 *
 * One session per viewport tells the story:
 *   a  home, toggle OFF (default)
 *   f  practice problem OFF
 *   b  drawer: control OFF (and drawer top OFF)
 *   c  control switched ON in the drawer (and drawer top ON)
 *   f  same practice problem ON (drawer closed)
 *   d  home ON, inventory, pathways skill, lessons (each OFF/ON in place)
 *   e  home switched OFF again with its own control
 *   f  practice continues: same problem, answered; feedback and its
 *      "Builds on" choices OFF/ON
 * Each OFF/ON pair is taken at the same scroll position. states.json holds
 * device-pixel boxes of the control, its indicator and every element that
 * appears, disappears or changes text when the toggle flips.
 *
 *   npx tsx ad-capture/grades-capture.ts [phone,tablet]
 */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { chromium, type Locator, type Page } from "playwright";
import { PNG } from "pngjs";
import { startGradesFixture, PROFILE, learnerId } from "./grades-fixture";

const OUT =
  "/Users/skyl/corpora-media/AMP-media/2026-11-02/amp-feature-ad-contest/entrants/anthropic/captures/grades/";
const VIEWPORTS = {
  phone: { width: 390, height: 844, deviceScaleFactor: 3 },
  tablet: { width: 820, height: 1180, deviceScaleFactor: 2 },
  "tablet-landscape": { width: 1024, height: 768, deviceScaleFactor: 2 },
} as const;
type ViewportName = keyof typeof VIEWPORTS;
const which = (process.argv[2] ?? "phone,tablet").split(",") as ViewportName[];
const PATHWAYS_SKILL = "equivalent-fractions";
const CONTROL = "Show grades and estimates";
mkdirSync(OUT, { recursive: true });

const fx = await startGradesFixture();
const browser = await chromium.launch();
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: new URL("..", import.meta.url).pathname,
})
  .toString()
  .trim();

type Box = { x: number; y: number; width: number; height: number };
type Item = { tag: string; text: string; box: Box; inViewport: boolean };
const report: Record<string, any> = {};

for (const name of which) {
  const vp = VIEWPORTS[name];
  fx.reset();
  const dpr = vp.deviceScaleFactor;
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: dpr,
    colorScheme: "light",
  });
  // tsx keeps function names with a __name helper inside evaluated code.
  await context.addInitScript("globalThis.__name = (f) => f;");
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors = await fx.attach(page);
  const shots: any[] = [];
  const pairs: any[] = [];
  const checks: Record<string, unknown> = {};
  const dev = (b: Box): Box => ({
    x: Math.round(b.x * dpr),
    y: Math.round(b.y * dpr),
    width: Math.round(b.width * dpr),
    height: Math.round(b.height * dpr),
  });
  const control = () => page.getByRole("checkbox", { name: CONTROL }).last();

  /** Nothing loading, fonts in, layout still. */
  async function settle(extra = 500) {
    await page.evaluate(() => document.fonts.ready);
    await page
      .waitForFunction(
        () => !document.querySelector("[aria-busy=true], [data-placeholder]"),
        null,
        { timeout: 15000 },
      )
      .catch(() => console.warn(`${name}: still busy at ${page.url()}`));
    await page.waitForTimeout(extra);
  }
  /** Boxes of the visible control and indicator, in device pixels. */
  async function controlBoxes() {
    const box = control();
    if (!(await box.count()) || !(await box.isVisible())) return null;
    const label = box.locator("xpath=ancestor::label[1]");
    const indicator = box.locator("xpath=following-sibling::span[1]");
    const [l, i] = [await label.boundingBox(), await indicator.boundingBox()];
    return {
      checked: await box.isChecked(),
      control: l && dev(l),
      indicator: i && dev(i),
    };
  }
  /** Park the pointer where it hovers nothing interactive. */
  async function parkPointer() {
    const spot = await page.evaluate(() => {
      for (let y = innerHeight * 0.3; y < innerHeight; y += 23)
        for (let x = innerWidth - 4; x > 0; x -= 37) {
          const el = document.elementFromPoint(x, y);
          if (el && !el.closest("button, a, input, label, [role=button], canvas, summary"))
            return { x, y };
        }
      return { x: innerWidth - 2, y: innerHeight - 2 };
    });
    await page.mouse.move(spot.x, spot.y);
  }
  async function shot(file: string, story: string, full = false) {
    await parkPointer();
    await settle();
    const path = `${OUT}${name}-${file}.png`;
    await page.screenshot({ path, fullPage: full });
    const scroll = await page.evaluate(() => {
      const dialog = document.querySelector("[role=dialog]");
      const scroller = dialog
        ? ([dialog, ...dialog.querySelectorAll("*")].find(
            (el) =>
              el.scrollHeight > el.clientHeight + 1 &&
              /auto|scroll/.test(getComputedStyle(el).overflowY),
          ) as HTMLElement | undefined)
        : undefined;
      return {
        window: scrollY,
        dialog: scroller ? Math.round(scroller.scrollTop) : null,
      };
    });
    const entry = {
      file: `${name}-${file}.png`,
      story,
      url: new URL(page.url()).pathname,
      fullPage: full,
      scroll,
      ...(full ? {} : { toggle: await controlBoxes() }),
    };
    shots.push(entry);
    console.log(`${name} ${file} ${entry.url}`);
    return entry;
  }
  /** Remember every visible element, to diff after the toggle flips. */
  const mark = (key = "default") =>
    page.evaluate((key) => {
      const visible = (el: Element) => {
        const r = el.getBoundingClientRect();
        return (
          r.width >= 1 &&
          r.height >= 1 &&
          el.checkVisibility({ visibilityProperty: true } as any)
        );
      };
      const own = (el: Element) =>
        [...el.childNodes]
          .filter((n) => n.nodeType === 3)
          .map((n) => n.textContent)
          .join("")
          .replace(/\s+/g, " ")
          .trim();
      const before = new Map<Element, any>();
      for (const el of document.querySelectorAll("body *"))
        if (visible(el))
          before.set(el, {
            text: own(el),
            rect: el.getBoundingClientRect().toJSON(),
            label: (
              (el as HTMLElement).innerText ??
              el.getAttribute("aria-label") ??
              ""
            )
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 160),
          });
      ((window as any).__gradesMarks ??= {})[key] = before;
      (window as any).__gradesVisible = visible;
      (window as any).__gradesOwn = own;
    }, key);
  /** What appeared, disappeared, changed text or moved since mark(). */
  const diff = (key = "default"): Promise<{
    appeared: Item[];
    disappeared: Item[];
    changedText: (Item & { before: string })[];
    movedControls: number;
  }> =>
    page.evaluate(
      ({ dpr, w, h, key }) => {
        const before: Map<Element, any> = (window as any).__gradesMarks[key];
        const visible = (window as any).__gradesVisible;
        const own = (window as any).__gradesOwn;
        const item = (el: Element, rect: DOMRect | any, label?: string) => ({
          tag:
            el.tagName.toLowerCase() +
            (el.getAttribute("class")
              ? "." + String(el.getAttribute("class")).split(" ")[0]
              : "") +
            (el.getAttribute("data-testid")
              ? `[data-testid=${el.getAttribute("data-testid")}]`
              : ""),
          text: (
            label ??
            (el as HTMLElement).innerText ??
            el.getAttribute("aria-label") ??
            ""
          )
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 160),
          box: {
            x: Math.round(rect.x * dpr),
            y: Math.round(rect.y * dpr),
            width: Math.round(rect.width * dpr),
            height: Math.round(rect.height * dpr),
          },
          inViewport:
            rect.y < h && rect.y + rect.height > 0 && rect.x < w && rect.x + rect.width > 0,
        });
        const now = [...document.querySelectorAll("body *")].filter(visible);
        const fresh = new Set(now.filter((el) => !before.has(el)));
        const gone = new Set(
          [...before.keys()].filter((el) => !el.isConnected || !visible(el)),
        );
        const top = (set: Set<Element>) =>
          [...set].filter((el) => !el.parentElement || !set.has(el.parentElement));
        const changedText = [...before]
          .filter(
            ([el, info]) =>
              !gone.has(el) && info.text && own(el) && own(el) !== info.text,
          )
          .map(([el, info]) => ({
            ...item(el, el.getBoundingClientRect()),
            before: info.text,
          }));
        const movedControls = [...before].filter(
          ([el, info]) =>
            !gone.has(el) &&
            el.matches("button, a, input, [role=radio]") &&
            Math.abs(el.getBoundingClientRect().y - info.rect.y) > 1,
        ).length;
        return {
          appeared: top(fresh).map((el) => item(el, el.getBoundingClientRect())),
          disappeared: top(gone).map((el) =>
            item(el, before.get(el).rect, before.get(el).label),
          ),
          changedText,
          movedControls,
        };
      },
      { dpr, w: vp.width, h: vp.height, key },
    );
  /** Pixels that differ between two screenshots of this viewport. */
  const pixelDiff = (a: string, b: string) => {
    const [x, y] = [a, b].map((f) => PNG.sync.read(readFileSync(OUT + f)));
    if (x.width !== y.width || x.height !== y.height) return -1;
    let n = 0;
    for (let i = 0; i < x.data.length; i += 4)
      if (
        x.data[i] !== y.data[i] ||
        x.data[i + 1] !== y.data[i + 1] ||
        x.data[i + 2] !== y.data[i + 2]
      )
        n++;
    return n;
  };
  const openMenu = async () => {
    await page.getByRole("button", { name: "Open AMP menu" }).first().click();
    await control().waitFor();
    await page
      .getByText("Skills illuminated")
      .last()
      .waitFor();
    await settle(400);
  };
  const closeMenu = async () => {
    await page.getByRole("button", { name: "Close AMP menu" }).click();
    await page.getByRole("dialog").waitFor({ state: "detached" }).catch(() => {});
    await settle(400);
  };
  const scrollDrawer = (to: "top" | "control") =>
    page.evaluate((to) => {
      const dialog = document.querySelector("[role=dialog]")!;
      const scroller = [dialog, ...dialog.querySelectorAll("*")].find(
        (el) =>
          el.scrollHeight > el.clientHeight + 1 &&
          /auto|scroll/.test(getComputedStyle(el).overflowY),
      ) as HTMLElement | undefined;
      if (!scroller) return;
      if (to === "top") scroller.scrollTop = 0;
      else {
        const input = dialog.querySelector(
          'input[aria-label="Show grades and estimates"]',
        )!;
        const label = input.closest("label")!;
        const r = label.getBoundingClientRect(),
          s = scroller.getBoundingClientRect();
        scroller.scrollTop += r.top - s.top - (s.height - r.height) / 2;
      }
    }, to);
  /** Flip the toggle with the drawer, then close it. */
  const toggleInDrawer = async (on: boolean) => {
    await openMenu();
    await scrollDrawer("control");
    await page.waitForTimeout(200);
    await control()[on ? "check" : "uncheck"]();
    await settle(200);
    await closeMenu();
  };
  /** Flip the toggle with the screen's own control (no scrolling). */
  const toggleHere = async (on: boolean) => {
    const box = control();
    const b = await box.boundingBox();
    assert(b && b.y >= 0 && b.y + b.height <= vp.height, "control in view");
    await box[on ? "check" : "uncheck"]();
    await settle(300);
  };
  const pair = async (
    screen: string,
    off: string,
    on: string,
    flipped: Awaited<ReturnType<typeof diff>>,
    direction: "off→on" | "on→off",
    note?: string,
  ) => {
    const d =
      direction === "off→on"
        ? flipped
        : {
            ...flipped,
            appeared: flipped.disappeared,
            disappeared: flipped.appeared,
            changedText: flipped.changedText.map((c) => ({
              ...c,
              text: c.before,
              before: c.text,
            })),
          };
    const changed = pixelDiff(`${name}-${off}.png`, `${name}-${on}.png`);
    pairs.push({
      screen,
      off: `${name}-${off}.png`,
      on: `${name}-${on}.png`,
      flippedInPlace: direction,
      sameScroll:
        JSON.stringify(shots.find((s) => s.file === `${name}-${off}.png`)?.scroll) ===
        JSON.stringify(shots.find((s) => s.file === `${name}-${on}.png`)?.scroll),
      differingDevicePixels: changed,
      appearsWhenOn: d.appeared,
      disappearsWhenOn: d.disappeared,
      textChangesWhenOn: d.changedText.map((c) => ({
        ...c,
        off: c.before,
        on: c.text,
      })),
      controlsMovedWhenFlipped: d.movedControls,
      ...(note ? { note } : {}),
    });
  };

  // a. Home, default OFF.
  await page.goto(fx.origin + "/");
  await page.getByRole("heading", { name: "Maya", level: 1 }).waitFor();
  await page.getByText("Practice by area").waitFor();
  assert.equal(await control().isChecked(), false, "default is off");
  await shot("a-home-off", "a: home, toggle off (default)");
  await shot("a-home-off-full", "a: home, toggle off (full page)", true);
  await page.evaluate(() => scrollTo(0, 0));

  // f (before). Practice: Go.
  // Practice opens on a typed-answer problem with a figure when one is
  // served within a few fresh visits (batches are randomly seeded), so the
  // story can answer it on the keypad.
  let visits = 0;
  for (let attempt = 0; ; attempt++) {
    visits = attempt + 1;
    await page.getByRole("button", { name: /^(Go|Continue)$/ }).click();
    await page.locator(".problem-stage").waitFor();
    await settle(300);
    const id = await page
      .locator("[data-problem-id]")
      .first()
      .getAttribute("data-problem-id");
    const p = fx.problems.get(id!)!;
    const typed = ["number", "fraction"].includes(p.public.response.kind);
    const figure = !!(p.public as any).figure;
    if ((typed && figure) || (typed && attempt >= 20) || attempt >= 30) break;
    await page.goto(fx.origin + "/");
    await page.getByText("Practice by area").waitFor();
  }
  const problemId = await page
    .locator("[data-problem-id]")
    .first()
    .getAttribute("data-problem-id");
  const problemText = async () =>
    (await page.locator(".problem-stage").innerText()).replace(/\s+/g, " ");
  const practiceOffText = await problemText();
  await shot("f1-practice-off", "f: the practice problem, toggle off");
  await mark("practice");

  // b. Drawer, control OFF.
  await openMenu();
  await scrollDrawer("top");
  await shot("b-drawer-top-off", "b: drawer opened over practice, top (off)");
  await scrollDrawer("control");
  await shot("b-control-off", "b: drawer scrolled to the control, off");
  // c. Switch it ON.
  await mark("drawer");
  await control().check();
  await settle(300);
  const drawerFlip = await diff("drawer");
  await shot("c-control-on", "c: the control switched on, same scroll");
  await scrollDrawer("top");
  await shot("c-drawer-top-on", "c: drawer top after switching on");
  pairs.push({
    screen: "drawer (control)",
    off: `${name}-b-control-off.png`,
    on: `${name}-c-control-on.png`,
    flippedInPlace: "off→on",
    sameScroll: true,
    differingDevicePixels: pixelDiff(
      `${name}-b-control-off.png`,
      `${name}-c-control-on.png`,
    ),
    appearsWhenOn: drawerFlip.appeared,
    disappearsWhenOn: drawerFlip.disappeared,
    textChangesWhenOn: drawerFlip.changedText.map((c) => ({
      ...c,
      off: c.before,
      on: c.text,
    })),
    controlsMovedWhenFlipped: drawerFlip.movedControls,
    note: "Element diff covers the whole drawer, including its top (stats and the 'Your progress' row), which is scrolled out of this frame.",
  });
  pairs.push({
    screen: "drawer (top)",
    off: `${name}-b-drawer-top-off.png`,
    on: `${name}-c-drawer-top-on.png`,
    flippedInPlace: "off→on (switched while scrolled to the control)",
    sameScroll: true,
    differingDevicePixels: pixelDiff(
      `${name}-b-drawer-top-off.png`,
      `${name}-c-drawer-top-on.png`,
    ),
    note: "See the 'drawer (control)' pair for the element diff; boxes there are at the control's scroll position. drawerTopBoxes below are at this frame's scroll.",
    drawerTopBoxes: await page.evaluate((dpr) => {
      const dialog = document.querySelector("[role=dialog]")!;
      const find = (text: string) =>
        [...dialog.querySelectorAll("small, span, strong, a, p")].find(
          (el) => (el as HTMLElement).innerText.trim() === text,
        );
      const box = (el?: Element | null) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          x: Math.round(r.x * dpr),
          y: Math.round(r.y * dpr),
          width: Math.round(r.width * dpr),
          height: Math.round(r.height * dpr),
        };
      };
      const level = find("Estimated level")?.parentElement;
      return {
        estimatedLevelStat: {
          text: (level as HTMLElement | undefined)?.innerText.replace(/\s+/g, " "),
          box: box(level),
        },
        progressRowSubtitle: {
          text: "Estimated grade level by area",
          box: box(find("Estimated grade level by area")),
        },
      };
    }, dpr),
  });
  await closeMenu();
  // f (after). Same problem, ON.
  const practiceOnText = await problemText();
  await shot("f2-practice-on", "f: same practice problem after switching on");
  const practiceFlip = await diff("practice");
  assert.equal(
    await page.locator("[data-problem-id]").first().getAttribute("data-problem-id"),
    problemId,
  );
  await pair(
    "practice problem",
    "f1-practice-off",
    "f2-practice-on",
    practiceFlip,
    "off→on",
    "Switched in the drawer opened over this problem.",
  );
  checks.practiceSameProblem = {
    problemId,
    templateId: fx.problems.get(problemId!)!.public.templateId,
    responseKind: fx.problems.get(problemId!)!.public.response.kind,
    practiceVisitsUntilServed: visits,
    textIdenticalOffOn: practiceOffText === practiceOnText,
    text: practiceOnText,
  };

  // d. Home ON, through the drawer's "Your progress".
  await openMenu();
  await scrollDrawer("top");
  await page.getByRole("link", { name: /^Your progress/ }).click();
  await page.getByText("Where you are").waitFor();
  await page.getByTestId("level-readout").waitFor();
  await page.evaluate(() => scrollTo(0, 0));
  await shot("d-home-on", "d: home with grades and estimates on");
  await shot("d-home-on-full", "d: home on (full page)", true);
  await page.evaluate(() => scrollTo(0, 0));
  // e. Switch OFF with home's own control.
  await mark();
  await toggleHere(false);
  await page.getByText("Practice by area").waitFor();
  const homeFlip = await diff();
  await shot("e-home-off", "e: home switched off again, numbers gone");
  await shot("e-home-off-full", "e: home off again (full page)", true);
  await page.evaluate(() => scrollTo(0, 0));
  await pair("home", "e-home-off", "d-home-on", homeFlip, "on→off");
  checks.homeOffMatchesFirstVisit =
    pixelDiff(`${name}-a-home-off.png`, `${name}-e-home-off.png`) === 0;
  // Home ON again to finish the d set with matched in-place flips elsewhere.

  // d. Lessons (in app, from the Lessons tab): OFF, then ON in place.
  await page.getByRole("button", { name: "Lessons", exact: true }).click();
  await control().waitFor();
  await shot("d-lessons-off", "d: lesson library, off");
  await mark();
  await toggleHere(true);
  const lessonsFlip = await diff();
  await shot("d-lessons-on", "d: lesson library, switched on in place");
  await pair("lessons", "d-lessons-off", "d-lessons-on", lessonsFlip, "off→on");
  await toggleHere(false);

  // f. Practice continues, OFF: the same problem, then answered.
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.locator(".problem-stage").waitFor();
  assert.equal(
    await page.locator("[data-problem-id]").first().getAttribute("data-problem-id"),
    problemId,
    "practice resumes the same problem",
  );
  checks.practiceResumedSameProblem = (await problemText()) === practiceOffText;
  await shot("f3-practice-continue-off", "f: practice resumes the same problem, off");
  checks.practiceContinueMatchesFirst = pixelDiff(
    `${name}-f1-practice-off.png`,
    `${name}-f3-practice-continue-off.png`,
  );
  const saved = fx.problems.get(problemId!)!;
  await page.getByRole("textbox").first().fill(saved.answer);
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await page.locator("[data-answer-feedback]").waitFor();
  // Let the correct-answer celebration finish before the matched pair.
  await page
    .locator(".practice-celebration")
    .waitFor({ state: "detached", timeout: 10000 })
    .catch(() => console.warn("celebration still mounted"));
  await page.getByText(/without help/).first().waitFor();
  await shot("f4-feedback-off", "f: answered correctly, feedback, off");
  await mark();
  await toggleInDrawer(true);
  const feedbackFlip = await diff();
  await shot("f5-feedback-on", "f: same feedback after switching on");
  await pair(
    "answer feedback",
    "f4-feedback-off",
    "f5-feedback-on",
    feedbackFlip,
    "off→on",
  );
  const builds = page.getByRole("button", { name: /Builds on/ });
  /** Every text leaf in the open dialog, with its device-pixel box. */
  const dialogLeaves = () =>
    page.evaluate((dpr) => {
      const dialog = [...document.querySelectorAll("dialog[open], [role=dialog]")].at(-1)!;
      return [...dialog.querySelectorAll("*")]
        .filter(
          (el) =>
            [...el.childNodes].some(
              (n) => n.nodeType === 3 && n.textContent!.trim(),
            ) && el.getBoundingClientRect().height > 0,
        )
        .map((el) => {
          const r = el.getBoundingClientRect();
          return {
            tag: el.tagName.toLowerCase(),
            text: (el as HTMLElement).innerText.replace(/\s+/g, " ").trim(),
            box: {
              x: Math.round(r.x * dpr),
              y: Math.round(r.y * dpr),
              width: Math.round(r.width * dpr),
              height: Math.round(r.height * dpr),
            },
          };
        });
    }, dpr);
  if (await builds.count()) {
    await builds.click();
    await page.getByRole("dialog").waitFor();
    await shot("f6-builds-on-on", "f: 'Builds on' choices with grades on");
    const onLeaves = await dialogLeaves();
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "detached" });
    await toggleInDrawer(false);
    await builds.click();
    await page.getByRole("dialog").waitFor();
    await shot("f6-builds-on-off", "f: 'Builds on' choices with grades off");
    const offLeaves = await dialogLeaves();
    const key = (l: { tag: string; text: string }) => `${l.tag}|${l.text}`;
    const offKeys = new Set(offLeaves.map(key)),
      onKeys = new Set(onLeaves.map(key));
    pairs.push({
      screen: "answer feedback 'Builds on' dialog",
      off: `${name}-f6-builds-on-off.png`,
      on: `${name}-f6-builds-on-on.png`,
      flippedInPlace:
        "no: the dialog was closed, the toggle switched off in the drawer, and the dialog reopened",
      sameScroll: true,
      differingDevicePixels: pixelDiff(
        `${name}-f6-builds-on-off.png`,
        `${name}-f6-builds-on-on.png`,
      ),
      appearsWhenOn: onLeaves.filter((l) => !offKeys.has(key(l))),
      disappearsWhenOn: offLeaves.filter((l) => !onKeys.has(key(l))),
      dialogTextOn: onLeaves,
      dialogTextOff: offLeaves,
      note: "Text leaves compared by tag and text. With the toggle off the dialog offers its own 'Show details' button that reveals the same grades for this dialog only.",
    });
    await page.keyboard.press("Escape");
  }

  // d. Inventory: OFF, then ON with its own control.
  await page.goto(fx.origin + "/inventory");
  await page.getByText("Your inventory").waitFor();
  await page.getByText("Skills illuminated").first().waitFor();
  await shot("d-inventory-off", "d: inventory, off");
  await mark();
  await toggleHere(true);
  await page.getByText("Estimated level").first().waitFor();
  const inventoryFlip = await diff();
  await shot("d-inventory-on", "d: inventory, switched on in place");
  await pair(
    "inventory",
    "d-inventory-off",
    "d-inventory-on",
    inventoryFlip,
    "off→on",
  );

  // d. Pathways skill (real URL): ON, then OFF with the drawer. Motion
  // paused with the map's own control so the 3D map holds still.
  await page.goto(`${fx.origin}/pathways/${PATHWAYS_SKILL}`);
  await page.locator(".pathways-detail h2").waitFor();
  await page.locator(".pathways-range").waitFor();
  const pause = page.getByRole("button", { name: "Pause motion" });
  if (await pause.count()) await pause.click();
  await page.waitForTimeout(1500);
  await shot("d-pathways-on", "d: pathways skill detail, on");
  await shot("d-pathways-on-full", "d: pathways on (full page)", true);
  await page.evaluate(() => scrollTo(0, 0));
  await mark();
  await toggleInDrawer(false);
  await page.waitForTimeout(1000);
  const pathwaysFlip = await diff();
  await shot("d-pathways-off", "d: pathways skill detail, off");
  // The skill card below the map, scrolled into view, for both states.
  await page
    .locator(".pathways-detail")
    .evaluate((el) => el.scrollIntoView({ block: "start" }));
  await shot("d-pathways-detail-off", "d: pathways skill card, off");
  const cardScroll = await page.evaluate(() => scrollY);
  await mark();
  await toggleInDrawer(true);
  await page.waitForTimeout(1000);
  await page.evaluate((y) => scrollTo(0, y), cardScroll);
  await page.waitForTimeout(300);
  const pathwaysDetailFlip = await diff();
  await shot("d-pathways-detail-on", "d: pathways skill card, on");
  await pair(
    "pathways (map)",
    "d-pathways-off",
    "d-pathways-on",
    pathwaysFlip,
    "on→off",
    "3D map motion paused with the map's own Pause motion button.",
  );
  await pair(
    "pathways (skill card)",
    "d-pathways-detail-off",
    "d-pathways-detail-on",
    pathwaysDetailFlip,
    "off→on",
  );

  // Transition: is the indicator or any readout animated?
  checks.transition = await page.evaluate(() => {
    const input = document.querySelector(
      'input[aria-label="Show grades and estimates"]',
    );
    const indicator = input?.nextElementSibling;
    const style = indicator ? getComputedStyle(indicator) : null;
    return {
      indicatorTransition: style
        ? `${style.transitionProperty} ${style.transitionDuration}`
        : "control not mounted here",
      runningAnimations: document.getAnimations().length,
    };
  });

  checks.consoleErrors = [...errors];
  report[name] = {
    viewport: vp,
    shots,
    pairs,
    checks,
  };
  writeFileSync(
    `${OUT}states-${name}.json`,
    JSON.stringify(
      {
        viewport: { ...vp, colorScheme: "light" },
        units: "device pixels, relative to the screenshot's top-left (viewport frames)",
        shots,
        pairs,
        checks,
      },
      null,
      2,
    ),
  );
  await context.close();
}

writeFileSync(
  `${OUT}capture-raw.json`,
  JSON.stringify(
    {
      commit,
      script: "ad-capture/grades-capture.ts (+ grades-fixture.ts)",
      fixtureProfile: PROFILE,
      learner: { name: "Maya", id: learnerId, birthYear: 2017 },
      unhandledApi: [...fx.unhandled],
      viewports: Object.fromEntries(which.map((n) => [n, VIEWPORTS[n]])),
      report: Object.fromEntries(
        Object.entries(report).map(([k, v]) => [k, { checks: v.checks }]),
      ),
    },
    null,
    2,
  ),
);
await browser.close();
await fx.close();
process.exit(0);
