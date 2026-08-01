// THE FIRST THIRTY SECONDS.
//
// "'guilty' is not a bad concept but I think the auto-fire when sitting is a
// problem. The first time you jump in, you don't know what is going on but you
// are blasting all of the wrong things .. the default of just going into the
// game is that you are just blasting everything, it's all wrong and you don't
// know what the F is going on. I think maybe you should choose when to shoot,
// eh?"
//
// Three faults compounded into that, and this file is the gate on all three.
//
//   1. The gun fired by itself from a standstill, so a child standing still and
//      reading the trench was answering, repeatedly, wrongly.
//   2. A miss did `world.descent *= 1.14`, so every one of those answers made
//      the game faster — the child had less time to work out what was going on
//      than they had a second earlier.
//   3. A shell crossing the line was reported to the host as `correct: false`,
//      a wrong answer from a child who had given none.
//
// **Nothing here checks a flag.** Every test below mounts the real `mount()`
// against a headless surface, drives the real `attachInput` listeners the way a
// hand does — a pointer move to aim, the space bar to shoot — and pumps the
// real `requestAnimationFrame` loop. What it then reads is what the host was
// told, what is painted on the glass, and `pacing()`, which is a reading with
// no setter beside it: to make the trench move, these tests have to play.

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { forgetAudioContexts } from "../../../../packs/shared/game-chrome/audioHold.ts";
import type { Host, Question } from "../contract.ts";
import { GATE_Y, VIEW_HALF_H } from "../core/config.ts";
import { C } from "../core/palette.ts";
import { mount } from "./game.ts";

const WIDTH = 800;
const HEIGHT = 600;

type Handler = (e: unknown) => void;
type Report = { questionId: string; correct: boolean; ms: number; answered: string };
type TextOp = { text: string; style: string };

/* ─────────────────────────────────────────────────────────── the fake glass */

/**
 * A 2D context that answers everything and remembers the words.
 *
 * Only two things about it matter. `measureText` has to be plausible, because
 * every line a child must read is shrunk to fit through `fitFont` and a zero
 * width there would silently disable the fitting. And `fillText` is recorded
 * with the fill style in force at the time, because "the correction is in the
 * accent colour and never says WRONG" is an assertion about a colour.
 */
function recordingContext(): { ctx: CanvasRenderingContext2D; text: TextOp[]; reset(): void } {
  const text: TextOp[] = [];
  const store: Record<string, unknown> = {
    font: "10px sans-serif",
    fillStyle: "#000",
    strokeStyle: "#000",
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    lineWidth: 1,
    lineCap: "butt",
    textAlign: "left",
    textBaseline: "alphabetic",
    shadowBlur: 0,
    shadowColor: "#000",
  };
  const gradient = { addColorStop: (): void => undefined };
  const named: Record<string, unknown> = {
    measureText: (s: string): { width: number } => {
      const px = Number(/(\d+(?:\.\d+)?)px/.exec(String(store.font))?.[1] ?? 10);
      return { width: String(s).length * px * 0.56 };
    },
    fillText: (s: string): void => {
      text.push({ text: String(s), style: String(store.fillStyle) });
    },
    strokeText: (s: string): void => {
      text.push({ text: String(s), style: String(store.strokeStyle) });
    },
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createPattern: () => null,
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  };
  const ctx = new Proxy(store, {
    get(target, prop: string) {
      if (prop in named) return named[prop];
      if (prop in target) return target[prop];
      // Anything else is a drawing call this test does not care about.
      return () => undefined;
    },
    set(target, prop: string, value: unknown) {
      target[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return {
    ctx,
    text,
    reset(): void {
      text.length = 0;
    },
  };
}

type FakeEl = {
  tag: string;
  className: string;
  fire(type: string, event?: Record<string, unknown>): void;
  [key: string]: unknown;
};

function makeSurface(): {
  root: FakeEl;
  install(): () => void;
  step(ms: number): void;
  /** One frame, and every word it painted. */
  frame(ms?: number): TextOp[];
  said(needle: string): TextOp | undefined;
  key(k: string): void;
  press(ms: number): void;
  /** Point the ship at a world x, and give it time to get there. */
  aim(worldX: number): void;
  canvas(): FakeEl | undefined;
} {
  const created: FakeEl[] = [];
  const rect = { left: 0, top: 0, right: WIDTH, bottom: HEIGHT, width: WIDTH, height: HEIGHT, x: 0, y: 0 };
  // Each canvas gets its own context: `bake.ts` makes offscreen canvases for
  // every glyph and glow, and their bake-time `fillText` calls must not land in
  // the record of what is on the glass.
  const glassRecord = recordingContext();
  // The FIRST canvas anyone asks for is the glass — `mount` makes it before it
  // makes anything else. Counting `created` instead would be wrong, because the
  // root div and `document.body` are already in there.
  let glassClaimed = false;

  const makeEl = (tag: string): FakeEl => {
    const listeners = new Map<string, Handler[]>();
    let own = recordingContext();
    if (tag === "canvas" && !glassClaimed) {
      glassClaimed = true;
      own = glassRecord;
    }
    const el = {
      tag,
      style: { setProperty: (): void => undefined, removeProperty: (): void => undefined } as Record<string, unknown>,
      classList: { add: (): void => undefined, remove: (): void => undefined, toggle: (): void => undefined },
      width: 0,
      height: 0,
      id: "",
      type: "",
      className: "",
      textContent: "",
      tabIndex: 0,
      hidden: false,
      scrollTop: 0,
      offsetHeight: 400,
      appendChild: (c: unknown) => c,
      append: () => undefined,
      remove: () => undefined,
      focus: () => undefined,
      blur: () => undefined,
      setAttribute: () => undefined,
      getAttribute: () => null,
      removeAttribute: () => undefined,
      getBoundingClientRect: () => rect,
      getContext: () => own.ctx,
      setPointerCapture: () => undefined,
      releasePointerCapture: () => undefined,
      hasPointerCapture: () => false,
      addEventListener(type: string, h: Handler) {
        listeners.set(type, [...(listeners.get(type) ?? []), h]);
      },
      removeEventListener(type: string, h: Handler) {
        listeners.set(type, (listeners.get(type) ?? []).filter((f) => f !== h));
      },
      fire(type: string, event: Record<string, unknown> = {}) {
        const full = { preventDefault: () => undefined, stopPropagation: () => undefined, ...event };
        for (const h of [...(listeners.get(type) ?? [])]) h(full);
      },
    } as unknown as FakeEl;
    created.push(el);
    return el;
  };

  const root = makeEl("div");
  const windowListeners = new Map<string, Handler[]>();
  let pending: ((t: number) => void) | null = null;
  let clock = 0;

  const g = globalThis as Record<string, unknown>;
  const saved: Record<string, unknown> = {};

  const install = (): (() => void) => {
    for (const k of [
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "ResizeObserver",
      "document",
      "window",
      "location",
      "devicePixelRatio",
      "performance",
      "addEventListener",
      "removeEventListener",
    ]) {
      saved[k] = g[k];
    }
    g.requestAnimationFrame = (cb: (t: number) => void): number => {
      pending = cb;
      return 1;
    };
    g.cancelAnimationFrame = (): void => {
      pending = null;
    };
    g.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    };
    g.performance = { now: () => clock };
    g.devicePixelRatio = 2;
    // Seeded from the query string, not from `Date.now()`: a suite that is
    // green four runs in five has proved nothing.
    g.location = { search: "?seed=20260728" };
    const addWindow = (type: string, h: Handler): void => {
      windowListeners.set(type, [...(windowListeners.get(type) ?? []), h]);
    };
    const removeWindow = (type: string, h: Handler): void => {
      windowListeners.set(type, (windowListeners.get(type) ?? []).filter((f) => f !== h));
    };
    // `input.ts` listens on `window`; `game-chrome` listens on `globalThis`.
    // One map behind both, so a key sent by this rig reaches whoever asked for
    // it — and so a listener left behind by either is visible to `detach`.
    g.addEventListener = addWindow;
    g.removeEventListener = removeWindow;
    const fakeWindow = {
      addEventListener: addWindow,
      removeEventListener: removeWindow,
      innerWidth: WIDTH,
      innerHeight: HEIGHT,
      devicePixelRatio: 2,
    };
    Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: fakeWindow });
    g.document = {
      createElement: (tag: string) => makeEl(tag),
      getElementById: () => null,
      body: makeEl("body"),
      documentElement: makeEl("html"),
      activeElement: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    };
    return () => {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) Reflect.deleteProperty(g, k);
        else g[k] = v;
      }
      forgetAudioContexts();
    };
  };

  const step = (ms: number): void => {
    clock += ms;
    const cb = pending;
    pending = null;
    cb?.(clock);
  };

  const fireWindow = (type: string, event: Record<string, unknown>): void => {
    const full = { preventDefault: () => undefined, stopPropagation: () => undefined, ...event };
    for (const h of [...(windowListeners.get(type) ?? [])]) h(full);
  };

  const canvas = (): FakeEl | undefined => created.find((e) => e.tag === "canvas");

  return {
    root,
    install,
    step,
    canvas,
    frame(ms = 16): TextOp[] {
      glassRecord.reset();
      step(ms);
      return [...glassRecord.text];
    },
    said(needle: string): TextOp | undefined {
      return glassRecord.text.find((op) => op.text.includes(needle));
    },
    key(k: string): void {
      fireWindow("keydown", { key: k, repeat: false });
      fireWindow("keyup", { key: k });
    },
    /** A finger, down and up, held for `ms` and never moving. */
    press(ms: number): void {
      const c = canvas();
      assert.ok(c, "the game mounted no canvas");
      c.fire("pointerdown", { pointerId: 3, pointerType: "touch", clientX: WIDTH / 2, clientY: 500 });
      clock += ms;
      // On the WINDOW, which is where `attachInput` listens for a release — a
      // finger that leaves the canvas mid-gesture still has to end it.
      fireWindow("pointerup", { pointerId: 3 });
    },
    aim(worldX: number): void {
      // Screen x from world x, through the camera's own arithmetic: the focal
      // length is fitted to the glass, so this is the pixel a finger would be
      // over. `pointermove` with a mouse steers with no button held, which is
      // this game's desktop scheme.
      const f = (HEIGHT / 2) * (300 / VIEW_HALF_H);
      const sx = WIDTH / 2 + (worldX * f) / 300;
      const c = canvas();
      assert.ok(c, "the game mounted no canvas");
      c.fire("pointermove", { pointerId: 7, pointerType: "mouse", clientX: sx, clientY: 500 });
      // The ship is not a teleport. Give it a second of real frames to arrive.
      for (let i = 0; i < 60; i++) step(16);
    },
  };
}

/* ─────────────────────────────────────────────────────────────── the ladder */

/**
 * A deterministic host. Fixed items, real mal-rule-shaped distractors, and a
 * difficulty low enough that `revealPlan` calls for a held reveal — which is
 * where a child who has just missed actually is.
 */
const ITEMS: readonly Question[] = [
  { id: "g1", prompt: "47 + 25", answer: "72", distractors: ["62", "612", "61"], domain: "add-sub", difficulty: 0.1 },
  { id: "g2", prompt: "63 − 28", answer: "35", distractors: ["45", "25", "41"], domain: "add-sub", difficulty: 0.1 },
  { id: "g3", prompt: "34 × 3", answer: "102", distractors: ["92", "912", "97"], domain: "mul", difficulty: 0.1 },
  { id: "g4", prompt: "56 ÷ 8", answer: "7", distractors: ["6", "8", "9"], domain: "div", difficulty: 0.1 },
];

function stubHost(reports: Report[]): Host {
  let i = 0;
  return {
    next: () => ITEMS[i++ % ITEMS.length] as Question,
    report: (r) => {
      reports.push(r);
    },
    haptic: () => undefined,
    prefersReducedMotion: () => false,
  };
}

function rig(): {
  surface: ReturnType<typeof makeSurface>;
  handle: ReturnType<typeof mount>;
  reports: Report[];
  stop(): void;
} {
  const surface = makeSurface();
  const restore = surface.install();
  const reports: Report[] = [];
  const handle = mount(surface.root as unknown as HTMLElement, stubHost(reports));
  return {
    surface,
    handle,
    reports,
    stop(): void {
      handle.unmount();
      restore();
    },
  };
}

/** Press space on the title, then let the shells fly out and settle. */
function begin(r: ReturnType<typeof rig>): void {
  r.surface.step(16);
  r.surface.key(" ");
  for (let i = 0; i < 90; i++) r.surface.step(16);
}

/** The three lanes wave one puts its shells in, in world units. */
function lanes(): number[] {
  const worldHalfW = VIEW_HALF_H * (WIDTH / HEIGHT);
  const playHalfW = Math.max(52, Math.min(168, worldHalfW * 0.84));
  const spread = playHalfW * 0.82;
  return [-spread, 0, spread];
}

/** A world x with no shell anywhere near it. */
const EMPTY_LANE = -60;

/** Pump frames until `done` or the budget runs out. Returns the frames spent. */
function pumpUntil(r: ReturnType<typeof rig>, done: () => boolean, frames = 2400): number {
  for (let i = 0; i < frames; i++) {
    if (done()) return i;
    r.surface.frame();
  }
  return frames;
}

/* ──────────────────────────────────────────────────────────────── the tests */

test("a child who only looks is never answered for, never hurried and never wrong", () => {
  const r = rig();
  try {
    begin(r);
    const opening = r.handle.pacing();
    assert.equal(opening.armed, false, "the trench armed itself without a shot");

    // Two minutes of a child holding the tablet and reading it. No pointer, no
    // key, nothing. This is the exact state the founder opened the game in.
    for (let i = 0; i < 7500; i++) r.surface.step(16);
    const after = r.handle.pacing();

    assert.equal(r.reports.length, 0, `${r.reports.length} answers were reported for a child who did nothing`);
    assert.equal(after.descent, opening.descent, "the trench got faster while nobody was playing");
    assert.equal(after.formationY, opening.formationY, "the shells sank towards the line while nobody was playing");
    assert.equal(after.lives, opening.lives, "a life was taken from a child who did nothing");
    assert.equal(after.wave, 1, "the wave turned over on its own");
    assert.equal(after.over, false, "the run ended while nobody was playing");

    // And the glass says why nothing is happening, and what the game is.
    const painted = r.surface.frame();
    const rule = painted.find((op) => op.text.includes("RIGHT ANSWER"));
    assert.ok(rule, "the trench is waiting and never says what the player is meant to do");
    assert.ok(
      painted.some((op) => op.text.includes("TO FIRE")),
      "the trench is waiting and never says how to fire",
    );
    assert.ok(
      painted.some((op) => op.text.includes("NOTHING MOVES UNTIL YOU DO")),
      "the trench is waiting and never says that it is waiting",
    );
  } finally {
    r.stop();
  }
});

test("the first shot is the player's, and it is what starts the trench", () => {
  // The counterpart to the test above, and the reason it is not just a game
  // that never begins: one deliberate shot, at nothing at all, and the trench
  // starts — without that shot having answered anything.
  const r = rig();
  try {
    begin(r);
    const before = r.handle.pacing();
    r.surface.aim(EMPTY_LANE);
    r.surface.key(" ");
    for (let i = 0; i < 60; i++) r.surface.step(16);
    const after = r.handle.pacing();

    assert.equal(after.armed, true, "a deliberate shot did not start the trench");
    assert.ok(
      after.formationY < before.formationY - 1,
      `the shells never began to sink (${before.formationY} -> ${after.formationY})`,
    );
    assert.equal(r.reports.length, 0, "a shot that hit nothing was reported as an answer");
    assert.equal(after.descent, before.descent, "arming the trench also made it faster");
  } finally {
    r.stop();
  }
});

/**
 * Play until an innocent shell has been shot.
 *
 * Which lane holds the truth is decided by a shuffle seeded from the item's id,
 * and reproducing that here would be a second copy of it that could drift. At
 * most one of the three lanes is the right answer, so trying two of them finds
 * a wrong one — and the second attempt gets a fresh rig, because a right answer
 * clears the wave and there would be nothing left to measure.
 */
function rigAfterWrongShot(): { r: ReturnType<typeof rig>; descentBefore: number } {
  const order = [0, 1];
  for (const lane of order) {
    const r = rig();
    begin(r);
    r.surface.aim(lanes()[lane] as number);
    // Read the speed of the trench BEFORE the trigger is pulled. Reading it
    // after would make the whole assertion vacuous — `descent *= 1.14` ran on
    // the miss itself, so a "before" sampled once the correction was already up
    // is a "before" that has the escalation baked into it. It did, and this
    // comment is here because a mutation caught it.
    const descentBefore = r.handle.pacing().descent;
    r.surface.key(" ");
    pumpUntil(r, () => r.reports.length > 0, 120);
    const report = r.reports[0];
    assert.ok(report, `a shot down lane ${lane} hit nothing at all`);
    if (!report.correct) return { r, descentBefore };
    r.stop();
  }
  throw new Error("two different lanes were both the right answer");
}

test("a wrong answer never speeds the trench up, and nothing moves while the correction is up", () => {
  const { r, descentBefore } = rigAfterWrongShot();
  try {
    const report = r.reports[0] as Report;
    assert.equal(report.correct, false);
    assert.notEqual(report.answered, "", "a wrong answer was reported with nothing answered");

    const hit = r.handle.pacing();
    assert.equal(hit.revealed, true, "a miss did not put the completed sum on the glass");

    // THE ESCALATION THAT IS GONE. `world.descent *= 1.14` used to run on this
    // exact path, so the game got faster because the child got it wrong — and
    // it did it while the correction was on screen, so the child had less time
    // to work out what had happened than they had a second earlier.
    assert.equal(
      hit.descent,
      descentBefore,
      `a wrong answer made the trench faster (${descentBefore} -> ${hit.descent})`,
    );

    const item = ITEMS.find((q) => q.id === report.questionId) as Question;
    assert.ok(item, "the report named a question the host never asked");

    // Half a minute of the child reading the correction. In a game with a timer
    // on the reveal this would be five reveals ago.
    const before = r.handle.pacing();
    for (let i = 0; i < 1875; i++) r.surface.step(16);
    const after = r.handle.pacing();
    assert.equal(after.descent, before.descent, "the trench sped up while the correction was being read");
    assert.equal(after.formationY, before.formationY, "the shells sank while the correction was being read");
    assert.equal(after.lives, before.lives, "a life was lost while the correction was being read");
    assert.equal(after.wave, before.wave, "the wave turned over while the correction was being read");
    assert.equal(after.revealed, true, "the correction took itself down on a timer");
    assert.equal(r.reports.length, 1, "the held correction reported something else on its own");

    // The completed sum, in the accent colour, and nowhere the word WRONG.
    const painted = r.surface.frame();
    const line = painted.find((op) => op.text === `${item.prompt} = ${item.answer}`);
    assert.ok(line, `the completed sum "${item.prompt} = ${item.answer}" is not on the glass`);
    assert.equal(line.style, C.amber, "the completed sum is not in the accent colour");
    assert.notEqual(line.style, C.hostile, "the completed sum is in the red used for hostiles");
    for (const op of painted) {
      assert.ok(!/WRONG|INCORRECT/i.test(op.text), `the glass says "${op.text}"`);
    }

    // A hand takes it down, and only then does the trench start again.
    r.surface.key(" ");
    r.surface.frame();
    assert.equal(r.handle.pacing().revealed, false, "a tap did not take the correction down");
    const resumedFrom = r.handle.pacing();
    for (let i = 0; i < 60; i++) r.surface.step(16);
    assert.ok(
      r.handle.pacing().formationY < resumedFrom.formationY - 1,
      "the trench never started again after the correction",
    );
  } finally {
    r.stop();
  }
});

test("a shell that crosses the line is never reported as an answer", () => {
  // A timeout is not an answer. It used to be sent to the host as
  // `correct: false` with an empty `answered` — a wrong answer from a child who
  // had not given one. There is no `skip` on this game's Host, so the honest
  // thing is silence: the item is closed, the ladder never sees it, and the run
  // still pays a life for it.
  const r = rig();
  try {
    begin(r);
    r.surface.aim(EMPTY_LANE);
    r.surface.key(" ");
    assert.equal(r.handle.pacing().armed, true, "the arming shot did not arm the trench");

    const lives = r.handle.pacing().lives;
    const spent = pumpUntil(r, () => r.handle.pacing().lives < lives);
    assert.ok(spent < 2400, "no shell ever reached the line");

    assert.equal(
      r.reports.length,
      0,
      `a wave nobody answered was reported: ${JSON.stringify(r.reports)}`,
    );
    // And it still teaches: the sum finishes itself, held, exactly as a miss does.
    assert.equal(r.handle.pacing().revealed, true, "a wave that ran out taught nothing");
    const painted = r.surface.frame();
    assert.ok(
      painted.some((op) => op.text.includes("=") && op.style === C.amber),
      "no completed sum was drawn after a shell crossed the line",
    );

    // Twenty seconds of reading it, and then a hand. The beat that turns the
    // wave over starts from the hand, not from the breach — a phase timer that
    // ran behind the correction would spend the whole beat while the child was
    // reading and flip the wave in the frame they looked up.
    const wave = r.handle.pacing().wave;
    for (let i = 0; i < 1250; i++) r.surface.step(16);
    // A LONG press, not a tap. Every hand on the glass means "I have read it"
    // while the sum is up — a deliberate press that did nothing there would
    // leave a child pressing a screen that is asking to be pressed.
    r.surface.press(700);
    r.surface.frame();
    assert.equal(r.handle.pacing().revealed, false, "a tap did not take the correction down");
    assert.equal(r.handle.pacing().wave, wave, "the wave turned over in the frame the correction came down");
    pumpUntil(r, () => r.handle.pacing().wave > wave, 240);
    assert.equal(r.handle.pacing().wave, wave + 1, "the wave never turned over after the correction");
    assert.equal(r.reports.length, 0, "the abandoned wave was reported after all");
  } finally {
    r.stop();
  }
});

test("a right answer is still reported, and still clears the wave", () => {
  // The gate stuck shut is the same bug in a hat. A game nobody can answer
  // would pass every test above.
  let cleared = false;
  for (const lane of lanes()) {
    const r = rig();
    try {
      begin(r);
      r.surface.aim(lane);
      r.surface.key(" ");
      pumpUntil(r, () => r.reports.length > 0, 120);
      const report = r.reports[0];
      if (!report || !report.correct) continue;
      assert.equal(report.answered, "72", "a right answer reported something other than the answer");
      assert.ok(report.ms > 0, "a right answer was reported with no time on it");
      // The wave turns over on its own beat once the truth is destroyed.
      pumpUntil(r, () => r.handle.pacing().wave > 1, 240);
      assert.equal(r.handle.pacing().wave, 2, "a cleared wave never turned over");
      cleared = true;
    } finally {
      r.stop();
    }
    if (cleared) break;
  }
  assert.ok(cleared, "no lane in wave one could be answered correctly at all");
});

test("reading time is billed to nobody", () => {
  // Speed is REWARDED, never enforced — so the reward has to be measured on
  // time the child could actually have been answering in. `world.time` runs
  // every animation in the game and cannot stop; it used to be what latency was
  // measured on, so half a minute of looking at a motionless opening was
  // reported to the ladder as half a minute of thinking, and `quickness()`
  // scores anything past twelve seconds at zero. A child who read carefully and
  // then answered at once came out looking like the slowest in the session.
  let checked = false;
  for (const lane of lanes()) {
    const r = rig();
    try {
      begin(r);
      // Half a minute of a child reading the sum before touching anything.
      for (let i = 0; i < 1875; i++) r.surface.step(16);
      r.surface.aim(lane);
      r.surface.key(" ");
      pumpUntil(r, () => r.reports.length > 0, 120);
      const report = r.reports[0];
      if (!report) continue;
      assert.ok(
        report.ms < 8000,
        `${report.ms}ms was reported for an answer given seconds after a long look`,
      );
      assert.ok(report.ms > 0, "the answer clock never ran at all");
      checked = true;
    } finally {
      r.stop();
    }
    if (checked) break;
  }
  assert.ok(checked, "no lane in wave one produced an answer to measure");
});

test("a run that ends on a wave nobody answered still shows the sum, then the ledger", () => {
  // The compound of two new rules. `phaseT` is frozen while a correction is up,
  // and the game-over screen fades in on `phaseT` — so a run whose LAST life
  // goes to a wave that ran out used to reach a state where the ledger was
  // painted at alpha zero over a stopped trench, forever, with the correction
  // suppressed too. That is the most likely ending for exactly the child this
  // change is for.
  const r = rig();
  try {
    begin(r);
    r.surface.aim(EMPTY_LANE);
    r.surface.key(" ");

    // Let wave after wave run out, dismissing each correction, until the run is
    // over. Three lives and one second wind.
    let guard = 0;
    while (!r.handle.pacing().over && guard++ < 20) {
      pumpUntil(r, () => r.handle.pacing().revealed || r.handle.pacing().over);
      if (r.handle.pacing().over) break;
      for (let i = 0; i < 40; i++) r.surface.step(16);
      r.surface.key(" ");
      r.surface.frame();
    }
    assert.equal(r.handle.pacing().over, true, "the run never ended");
    assert.equal(r.reports.length, 0, "a run of waves nobody answered reported something");

    // The sum stands, alone, and the ledger is not painted invisibly behind it.
    assert.equal(r.handle.pacing().revealed, true, "the last wave taught nothing");
    const held = r.surface.frame();
    assert.ok(
      held.some((op) => op.text.includes("=") && op.style === C.amber),
      "no completed sum on the screen that ended the run",
    );
    assert.ok(
      !held.some((op) => op.text.includes("THE TRENCH TAKES YOU")),
      "the ledger was drawn behind the correction, where its fade-in cannot run",
    );

    // A hand takes it down; only then does the ledger arrive, and it is legible.
    for (let i = 0; i < 40; i++) r.surface.step(16);
    r.surface.key(" ");
    assert.equal(r.handle.pacing().revealed, false, "the correction outlived the hand");
    let ledger: TextOp[] = [];
    for (let i = 0; i < 90; i++) ledger = r.surface.frame();
    assert.ok(
      ledger.some((op) => op.text.includes("THE TRENCH TAKES YOU")),
      "the run ended and never said so",
    );
    assert.ok(
      ledger.some((op) => op.text.includes("BEST")),
      "the run ended and never showed the ledger",
    );
  } finally {
    r.stop();
  }
});

test("the gate is where the game says it is", () => {
  // A guard on the two constants the tests above reason about. If the gate ever
  // moves above the formation's birthplace, "nothing sank" and "a shell crossed
  // the line" both stop meaning what they say here.
  assert.ok(GATE_Y < VIEW_HALF_H - 26 - 62, "the gate is no longer below the formation");
});
