/**
 * Ad capture: the real glossary drill-down in the real practice workspace.
 *
 * A learner answers "A triangle has side lengths 25 cm, 24 cm, and 7 cm. Is it
 * a right triangle?" correctly and taps "See why". In the explanation they tap
 * "hypotenuse" -> "right angle" (in its definition) -> "angle" (in that
 * definition), then Back, Back and Close; focus returns to "hypotenuse".
 *
 * For each viewport: PNG per state, states.json with CSS and device-pixel
 * boxes, and every animated transition as frames sampled from the real CSS
 * animations (paused with the Web Animations API and seeked frame by frame,
 * so frames are exact and evenly spaced in animation time).
 *
 *   cd amp && npx tsx ad-capture/glossary-capture.ts
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, type Locator, type Page } from "playwright";
import { generated, outcomes, SEED, serve, TEMPLATE } from "./glossary-server";

const OUT =
  process.env.AD_GLOSSARY_OUT ??
  "/Users/skyl/corpora-media/AMP-media/2026-11-02/amp-feature-ad-contest/entrants/anthropic/captures/glossary";
/** Frames per second of animation time in each transition's frame folder. */
const FPS = 120;
const VIEWPORTS = [
  {
    name: "phone",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
  },
  {
    name: "tablet",
    viewport: { width: 1024, height: 768 },
    deviceScaleFactor: 2,
    isMobile: false,
  },
] as const;

type Box = { x: number; y: number; width: number; height: number };
const SELECTORS = {
  card: ".term-dialog[open] .term-card",
  trail: ".term-dialog[open] .term-card-trail",
  back: ".term-dialog[open] .term-card-back",
  close: ".term-dialog[open] .term-card-close",
  heading: ".term-dialog[open] .term-card-header h2",
  definition: ".term-dialog[open] .term-card-plain",
  example: ".term-dialog[open] .term-card-example",
  figure: ".term-dialog[open] .term-card-figure",
  explanation: ".feedback-steps",
  question: ".problem-content .question",
};

const server = await serve();
const browser = await chromium.launch();
const summary: Record<string, unknown> = {};
try {
  for (const vp of VIEWPORTS) {
    const dir = `${OUT}/${vp.name}`;
    await mkdir(`${dir}/transitions`, { recursive: true });
    const dpr = vp.deviceScaleFactor;
    const context = await browser.newContext({
      viewport: vp.viewport,
      deviceScaleFactor: dpr,
      isMobile: vp.isMobile,
      hasTouch: true,
      colorScheme: "light",
      reducedMotion: "no-preference",
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error" || m.type() === "warning")
        errors.push(`${m.type()}: ${m.text()}`);
    });
    // The workspace posts a "practice viewed" event; there is no API here.
    const posted: string[] = [];
    await page.route("**/api/**", (route) => {
      posted.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
      return route.fulfill({ status: 204, body: "" });
    });

    await page.goto(server.url("why"));
    await page.getByRole("button", { name: "See why" }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole("button", { name: "See why" }).tap();
    await page.locator(".feedback-steps").waitFor();
    await settle(page);
    // Below the side-by-side width the feedback sheet covers the bottom of
    // the problem; the stage scrolls so the question sits above it.
    if (vp.name === "phone")
      await page
        .locator(".problem-stage")
        .evaluate((el) => (el.scrollTop = el.scrollHeight));
    await settle(page);

    const word = page
      .locator('.feedback-steps .glossary-term[data-term-id="hypotenuse"]')
      .first();
    const card = page.locator(".term-dialog[open]");
    const inCard = (id: string) =>
      card.locator(`.term-card-body .glossary-term[data-term-id="${id}"]`).first();

    const states: unknown[] = [];
    const definitions: Record<string, unknown> = {};
    const shoot = async (
      id: string,
      label: string,
      tapped: { name: string; box: Box } | null,
      next: { name: string; locator: Locator } | null,
    ) => {
      await settle(page);
      const file = `${vp.name}-${id}.png`;
      await page.screenshot({ path: `${dir}/${file}` });
      const boxes = await measure(page);
      const nextBox = next ? await box(next.locator) : null;
      const openCard = (await card.count())
        ? await card.evaluate((d) => ({
            heading: d.querySelector(".term-card-header h2")!.textContent,
            trail: d.querySelector(".term-card-trail")?.textContent ?? null,
            definition: d.querySelector(".term-card-plain")?.textContent ?? null,
            example:
              d.querySelector(".term-card-example")?.textContent ?? null,
            linked: [...d.querySelectorAll<HTMLElement>(".term-card-body .glossary-term")].map(
              (t) => ({ id: t.dataset.termId, text: t.textContent }),
            ),
            hasFigure: !!d.querySelector(".term-card-figure svg"),
          }))
        : null;
      const focus = await page.evaluate(() => {
        const a = document.activeElement as HTMLElement | null;
        return a
          ? {
              tag: a.tagName.toLowerCase(),
              className: a.className,
              termId: a.dataset?.termId ?? null,
              text: a.textContent?.slice(0, 60) ?? null,
              focusVisible: a.matches(":focus-visible"),
            }
          : null;
      });
      if (openCard) definitions[openCard.heading!] = openCard;
      states.push({
        id,
        file,
        label,
        tapped: tapped && withDevice(tapped, dpr),
        next: next && nextBox && withDevice({ name: next.name, box: nextBox }, dpr),
        card: openCard,
        focus,
        boxes: Object.fromEntries(
          Object.entries(boxes).map(([k, b]) => [k, b && device(b, dpr)]),
        ),
      });
    };

    const transitions: unknown[] = [];
    /** Tap, then sample the step's real CSS animations frame by frame. */
    const step = async (name: string, target: Locator) => {
      const tapBox = await box(target);
      assert.ok(tapBox, `${vp.name}: nothing to tap for ${name}`);
      await target.tap();
      const frames = await sample(page, `${dir}/transitions/${name}`);
      transitions.push({ name, folder: `transitions/${name}`, ...frames });
      return { name, box: tapBox };
    };

    await shoot("00-problem", "Correct answer, explanation open (See why)", null, {
      name: "hypotenuse",
      locator: word,
    });
    let tapped = await step("01-open-hypotenuse", word);
    await card.getByRole("heading", { name: "hypotenuse" }).waitFor();
    await shoot("01-card-hypotenuse", "Card: hypotenuse", tapped, {
      name: "right angle",
      locator: inCard("right-angle"),
    });
    tapped = await step("02-drill-right-angle", inCard("right-angle"));
    await card.getByRole("heading", { name: "right angle" }).waitFor();
    await shoot("02-card-right-angle", "Card: right angle (trail: hypotenuse)", tapped, {
      name: "angle",
      locator: inCard("angle"),
    });
    tapped = await step("03-drill-angle", inCard("angle"));
    await card.getByRole("heading", { name: "angle", exact: true }).waitFor();
    await shoot("03-card-angle", "Card: angle (trail: hypotenuse › right angle)", tapped, {
      name: "Back",
      locator: card.locator(".term-card-back"),
    });
    tapped = await step("04-back-right-angle", card.locator(".term-card-back"));
    await card.getByRole("heading", { name: "right angle" }).waitFor();
    await shoot("04-back-right-angle", "Back: right angle", tapped, {
      name: "Back",
      locator: card.locator(".term-card-back"),
    });
    tapped = await step("05-back-hypotenuse", card.locator(".term-card-back"));
    await card.getByRole("heading", { name: "hypotenuse" }).waitFor();
    await shoot("05-back-hypotenuse", "Back: hypotenuse", tapped, {
      name: "Close",
      locator: card.locator(".term-card-close"),
    });
    tapped = await step("06-close", card.locator(".term-card-close"));
    await card.waitFor({ state: "detached" });
    await shoot("06-closed", "Closed: focus back on hypotenuse", tapped, null);

    const last = states.at(-1) as { focus: { termId: string | null } };
    assert.equal(last.focus.termId, "hypotenuse", "focus returns to the word");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    assert.equal(overflow, false, "horizontal overflow");
    await writeFile(
      `${dir}/states.json`,
      JSON.stringify(
        {
          viewport: vp.viewport,
          deviceScaleFactor: dpr,
          screenshotPx: {
            width: vp.viewport.width * dpr,
            height: vp.viewport.height * dpr,
          },
          note: "Boxes are viewport coordinates (the page never scrolls). css = CSS px; device = css x deviceScaleFactor = PNG pixels. 'tapped' is the element tapped to reach this state, measured just before the tap; 'next' is the element tapped to leave it.",
          states,
          transitions,
        },
        null,
        2,
      ),
    );
    summary[vp.name] = { definitions, errors, posted, transitions: transitions.length };
    assert.deepEqual(errors, [], `${vp.name}: console errors`);
    await context.close();
  }

  const cards = outcomes.why.glossary!;
  const pick = (id: string) => {
    const c = cards.find((c) => c.id === id)!;
    return {
      id: c.id,
      term: c.term,
      plain: c.plain,
      example: c.example ?? null,
      uses: c.uses,
      figure: c.figure ? "rendered (scenes-v1 Scene from glossary figure)" : null,
    };
  };
  await writeFile(
    `${OUT}/capture.json`,
    JSON.stringify(
      {
        sourceCommit: "cd71711864e61fd20ffed7ba41ef6baa666ed07c",
        branch: "anthropic-ad-capture",
        scripts: [
          "amp/ad-capture/glossary-capture.ts",
          "amp/ad-capture/glossary-server.ts",
        ],
        command: "cd amp && npx tsx ad-capture/glossary-capture.ts",
        browser: `chromium ${browser.version()} (Playwright)`,
        colorScheme: "light",
        viewports: VIEWPORTS.map((v) => ({
          name: v.name,
          viewport: v.viewport,
          deviceScaleFactor: v.deviceScaleFactor,
          isMobile: v.isMobile,
          hasTouch: true,
        })),
        template: TEMPLATE,
        seed: SEED,
        problem: {
          prompt: generated.public.prompt,
          options: generated.public.response,
          answer: generated.answer,
          explanation: generated.explanation,
        },
        screen:
          "Real PracticeWorkspace (src/web/PracticeWorkspace.tsx) mounted through vite middleware with the generated problem and a correct outcome carrying the server's own glossaryPayload (as withGlossary in src/server/app.ts). The learner taps 'See why'; the explanation's linked words are the screen's terms.",
        explanationLinks: Object.entries(outcomes.why.glossaryLexicon ?? {})
          .filter(([, id]) => id)
          .map(([form, id]) => ({ form, id })),
        chain: ["hypotenuse", "right-angle", "angle"].map(pick),
        cardsSeen: summary,
        motion: {
          method:
            "After each tap the real CSS animations inside .term-dialog are paused with the Web Animations API and seeked; one PNG per 1/FPS s of animation time. Play the frames at FPS for real speed, or at 30 fps for 1/4 speed.",
          fps: FPS,
          css: {
            open_phone: "term-sheet-in 280ms var(--ease-standard): translateY(48px), opacity 0 -> rest",
            open_tablet: "term-card-in 180ms: translateY(-4px) scale(0.98), opacity 0 -> rest",
            drill_forward: "term-step-forward 220ms on each child of the card: translateX(16px), opacity 0 -> rest",
            back: "term-step-back 220ms: translateX(-16px), opacity 0 -> rest",
            close: "none: the dialog and its scrim are removed at once",
            scrim: "no transition: appears with the card at full strength",
          },
        },
        notes: [
          "No API runs; the practice-viewed event POST /api/v1/events is answered 204 by the capture script.",
          "AnswerFeedback (the progress line under 'Correct') needs the progress API and is not mounted; the real app shows it when its request succeeds.",
          "Phone: after 'See why' the feedback sheet covers the bottom of the problem stage; the script scrolls the stage (a learner's scroll, scrollTop to its end) so the question is fully visible above the sheet.",
          "Tablet: the hypotenuse card (with its figure) is too tall to fit below its word at 768 px, so TermCard clamps it inside the viewport and it overlaps the word; the shorter right angle and angle cards sit just below the word. Each step re-places the card beside the original word (TermCard place()), so the card's top edge moves between steps.",
          "Phone: the sheet's height follows its content, so its top edge jumps between steps (hypotenuse with figure is tall; right angle is short).",
          "06-close has no animation: the frame folder holds only the closed state.",
          "Inside cards every word the definition uses is linked; on the practice screen only words this grade-8 screen teaches link (hypotenuse, converse, Pythagorean theorem).",
        ],
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await browser.close();
  await server.close();
}

function device(b: Box, dpr: number) {
  return {
    css: round(b, 1),
    device: round(
      { x: b.x * dpr, y: b.y * dpr, width: b.width * dpr, height: b.height * dpr },
      0,
    ),
  };
}
function withDevice(t: { name: string; box: Box }, dpr: number) {
  return { name: t.name, ...device(t.box, dpr) };
}
function round(b: Box, digits: number) {
  const f = 10 ** digits;
  const r = (n: number) => Math.round(n * f) / f;
  return { x: r(b.x), y: r(b.y), width: r(b.width), height: r(b.height) };
}
async function box(locator: Locator): Promise<Box | null> {
  if (!(await locator.count())) return null;
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
}
async function measure(page: Page) {
  const out: Record<string, Box | null> = {};
  for (const [name, selector] of Object.entries(SELECTORS))
    out[name] = await box(page.locator(selector).first());
  return out;
}
/** Let every running animation end and two frames paint. */
async function settle(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        for (const a of document.getAnimations()) a.finish();
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}
/** Freeze the card's animations at 0 and shoot one frame per 1/FPS s. */
async function sample(page: Page, folder: string) {
  await mkdir(folder, { recursive: true });
  const info = await page.evaluate(() => {
    const all = document.getAnimations();
    const ours = all.filter((a) => {
      const t = (a.effect as KeyframeEffect | null)?.target as Element | null;
      return !!t?.closest(".term-dialog");
    });
    for (const a of all) if (!ours.includes(a)) a.finish();
    for (const a of ours) {
      a.pause();
      a.currentTime = 0;
    }
    (window as unknown as { __ours: Animation[] }).__ours = ours;
    return ours.map((a) => ({
      name: (a as CSSAnimation).animationName ?? null,
      duration: Number(a.effect?.getComputedTiming().duration ?? 0),
      target: ((a.effect as KeyframeEffect).target as Element).className,
    }));
  });
  const duration = Math.max(0, ...info.map((a) => a.duration));
  const count = duration ? Math.ceil((duration / 1000) * FPS) + 1 : 1;
  const frames: { file: string; timeMs: number }[] = [];
  for (let i = 0; i < count; i++) {
    const time = Math.min(duration, (i * 1000) / FPS);
    await page.evaluate(
      (time) =>
        new Promise<void>((resolve) => {
          for (const a of (window as unknown as { __ours: Animation[] }).__ours)
            a.currentTime = time;
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }),
      time,
    );
    const file = `frame-${String(i).padStart(3, "0")}.png`;
    await page.screenshot({ path: `${folder}/${file}` });
    frames.push({ file, timeMs: Math.round(time * 100) / 100 });
  }
  await page.evaluate(() => {
    for (const a of (window as unknown as { __ours: Animation[] }).__ours)
      a.finish();
  });
  const timing = {
    animations: info,
    durationMs: duration,
    animated: duration > 0,
    fps: FPS,
    frameIntervalMs: 1000 / FPS,
    effectivePlaybackRate: `play at ${FPS} fps = 1.0x real speed; at 30 fps = ${30 / FPS}x`,
    frames,
  };
  await writeFile(`${folder}/timing.json`, JSON.stringify(timing, null, 2));
  return { durationMs: duration, frames: frames.length, animations: info.map((a) => a.name) };
}
