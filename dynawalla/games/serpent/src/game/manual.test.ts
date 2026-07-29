/**
 * FROZEN BEHIND THE MANUAL.
 *
 * "All games should pause while reading the instructions .. I can hear
 * counterweight playing in the background while I'm reading the instructions ...
 * stressing me out even more."
 *
 * The shared how-to-play sheet holds sound, keys and taps for every game with no
 * per-game line. What it cannot hold is a game's own simulation clock, and in
 * this game that clock is a snake that keeps swimming, an arena that keeps
 * shrinking and a wall that keeps closing in behind the scrim a child raised
 * *because they were stuck*.
 *
 * So this file mounts the real game against a headless surface, reaches the
 * shared module's own help button the way a finger does, and watches the world.
 * Three things are proved, and each one fails if the `onOpen`/`onClose` pair in
 * `mount.ts` is deleted:
 *
 *   1. The water stops. Not "a flag was set" — `world.time`, the head's
 *      position and every orb hold exactly where they were, for three minutes
 *      of frames.
 *   2. It starts again on close, and does not teleport: the first frame after
 *      the sheet carries a normal delta, not the whole read.
 *   3. **A dive the CHILD paused stays paused.** They have their own pause verb
 *      here. Opening the manual on top of their own pause and closing it must
 *      not hand them back a moving snake.
 *
 * The fake elements below carry a listener map EACH, which is not tidiness: the
 * help button and the PLAY button both register a `"click"`, so one shared map
 * keyed by type silently drops the first and the test opens nothing.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { forgetAudioContexts } from "../../../../packs/shared/game-chrome/index.ts";
import { mountSerpent } from "./mount.ts";
import { createStubHost } from "../stub/host.ts";
import type { Host } from "../contract.ts";

type Handler = (e: unknown) => void;

type FakeEl = {
  className: string;
  fire(type: string, event?: unknown): void;
  has(type: string): boolean;
  [key: string]: unknown;
};

function makeSurface(width = 768, height = 1024) {
  const created: FakeEl[] = [];
  const rect = { left: 0, top: 0, right: width, bottom: height, width, height, x: 0, y: 0 };

  // Every method returns the context, so chained builder calls work; every
  // property read is a callable. Nothing about pixels is asserted here.
  const ctx: unknown = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") return undefined;
        if (typeof prop === "symbol") return undefined;
        return () => ctx;
      },
      set: () => true,
    },
  );

  const makeEl = (): FakeEl => {
    const listeners = new Map<string, Handler[]>();
    const el = {
      style: {} as Record<string, unknown>,
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
      setAttribute: () => undefined,
      getAttribute: () => null,
      removeAttribute: () => undefined,
      getBoundingClientRect: () => rect,
      getContext: () => ctx,
      setPointerCapture: () => undefined,
      releasePointerCapture: () => undefined,
      hasPointerCapture: () => false,
      addEventListener(type: string, h: Handler) {
        const list = listeners.get(type) ?? [];
        list.push(h);
        listeners.set(type, list);
      },
      removeEventListener(type: string, h: Handler) {
        const list = listeners.get(type) ?? [];
        const at = list.indexOf(h);
        if (at >= 0) list.splice(at, 1);
      },
      has: (type: string) => (listeners.get(type) ?? []).length > 0,
      fire(type: string, event: unknown = {}) {
        for (const h of [...(listeners.get(type) ?? [])]) h(event);
      },
    } as unknown as FakeEl;
    created.push(el);
    return el;
  };

  const root = makeEl();
  const globalKeys = new Map<string, Handler[]>();
  let pending: ((t: number) => void) | null = null;
  let clock = 0;

  const saved = {
    raf: globalThis.requestAnimationFrame,
    caf: globalThis.cancelAnimationFrame,
    ro: (globalThis as { ResizeObserver?: unknown }).ResizeObserver,
    now: performance.now,
    add: globalThis.addEventListener,
    remove: globalThis.removeEventListener,
    doc: (globalThis as { document?: unknown }).document,
    win: (globalThis as { window?: unknown }).window,
    dpr: (globalThis as { devicePixelRatio?: number }).devicePixelRatio,
    random: Math.random,
  };

  const install = (): (() => void) => {
    globalThis.requestAnimationFrame = ((cb: (t: number) => void): number => {
      pending = cb;
      return 1;
    }) as typeof globalThis.requestAnimationFrame;
    globalThis.cancelAnimationFrame = ((): void => {
      pending = null;
    }) as typeof globalThis.cancelAnimationFrame;
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    };
    performance.now = () => clock;
    // The arena is scattered with `Math.random` — where the orbs sit, which way
    // the serpent is facing on the first frame. Left alone, this whole file is
    // green four runs in five and has therefore proved nothing: the dive
    // sometimes ends before the manual is ever opened. A pinned stream makes a
    // failure reproducible from the failure message alone.
    let bits = 0x9e3779b9;
    Math.random = (): number => {
      bits = (bits + 0x6d2b79f5) | 0;
      let t = Math.imul(bits ^ (bits >>> 15), 1 | bits);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    globalThis.addEventListener = ((type: string, h: Handler): void => {
      const list = globalKeys.get(type) ?? [];
      list.push(h);
      globalKeys.set(type, list);
    }) as unknown as typeof globalThis.addEventListener;
    globalThis.removeEventListener = ((type: string, h: Handler): void => {
      const list = globalKeys.get(type) ?? [];
      const at = list.indexOf(h);
      if (at >= 0) list.splice(at, 1);
    }) as unknown as typeof globalThis.removeEventListener;
    (globalThis as { document?: unknown }).document = {
      createElement: (tag: string) => {
        const el = makeEl();
        el.tag = tag;
        return el;
      },
      getElementById: () => null,
      body: makeEl(),
      hidden: false,
      activeElement: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    };
    (globalThis as { window?: unknown }).window = globalThis;
    (globalThis as { innerWidth?: number }).innerWidth = width;
    (globalThis as { innerHeight?: number }).innerHeight = height;
    (globalThis as { devicePixelRatio?: number }).devicePixelRatio = 2;
    return () => {
      globalThis.requestAnimationFrame = saved.raf;
      globalThis.cancelAnimationFrame = saved.caf;
      (globalThis as { ResizeObserver?: unknown }).ResizeObserver = saved.ro;
      performance.now = saved.now;
      globalThis.addEventListener = saved.add;
      globalThis.removeEventListener = saved.remove;
      (globalThis as { document?: unknown }).document = saved.doc;
      (globalThis as { window?: unknown }).window = saved.win;
      (globalThis as { devicePixelRatio?: number | undefined }).devicePixelRatio = saved.dpr;
      Math.random = saved.random;
      forgetAudioContexts();
    };
  };

  return {
    root,
    install,
    step(ms: number): void {
      clock += ms;
      const cb = pending;
      pending = null;
      cb?.(clock);
    },
    now: () => clock,
    key(type: string, event: unknown): void {
      for (const h of [...(globalKeys.get(type) ?? [])]) h(event);
    },
    /** The shared module's own controls, found the way a finger finds them. */
    help: () => created.find((e) => e.className === "dwc-help"),
    closeButton: () => created.find((e) => e.className === "dwc-close"),
    canvas: () => created.find((e) => e.tag === "canvas"),
  };
}

function rig(): {
  surface: ReturnType<typeof makeSurface>;
  handle: ReturnType<typeof mountSerpent>;
  stop(): void;
} {
  const surface = makeSurface();
  const restore = surface.install();
  const host: Host = createStubHost({ seed: "manual-freeze" });
  const handle = mountSerpent(surface.root as unknown as HTMLElement, host);
  return {
    surface,
    handle,
    stop(): void {
      handle.unmount();
      restore();
    },
  };
}

/** Tap the middle of the water: in attract that is what starts a dive. */
function tapCentre(surface: ReturnType<typeof makeSurface>): void {
  const canvas = surface.canvas();
  assert.ok(canvas, "the game mounted no canvas");
  const event = {
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientX: 384,
    clientY: 512,
    preventDefault: () => undefined,
    stopPropagation: () => undefined,
  };
  canvas.fire("pointerdown", event);
  canvas.fire("pointerup", { ...event, buttons: 0 });
}

function openManual(surface: ReturnType<typeof makeSurface>): void {
  const help = surface.help();
  assert.ok(help, "the shared how-to-play button was never mounted");
  help.fire("click", { target: help, type: "click" });
}

function closeManual(surface: ReturnType<typeof makeSurface>): void {
  const button = surface.closeButton();
  assert.ok(button, "the sheet has no PLAY button");
  button.fire("click", { target: button, type: "click" });
}

/** Everything about the world a frame is allowed to change. */
function snapshot(world: ReturnType<typeof mountSerpent>["world"]): string {
  return JSON.stringify({
    time: world.time,
    runTime: world.runTime,
    x: world.serpent.x,
    y: world.serpent.y,
    heading: world.serpent.heading,
    segments: world.serpent.segments,
    pathHead: world.serpent.pathHead,
    bodyX: [...world.serpent.bodyX.slice(0, world.serpent.bodyCount)],
    arenaR: world.arenaR,
    score: world.score,
    depth: world.depth,
    combo: world.combo,
    orbs: world.orbs.map((o) => [o.x, o.y, o.label]),
  });
}

test("the water stops while the rules are up, and starts again when they go down", () => {
  const { surface, handle, stop } = rig();
  try {
    for (let i = 0; i < 60; i++) surface.step(16);
    tapCentre(surface);
    for (let i = 0; i < 240; i++) surface.step(16);
    assert.equal(handle.world.phase, "play", "the dive never started");

    // The observable is live: a frame of play moves the world.
    const before = snapshot(handle.world);
    surface.step(16);
    assert.notEqual(snapshot(handle.world), before, "the snake was not moving to begin with");

    openManual(surface);
    const held = snapshot(handle.world);
    // Three minutes of frames behind the sheet — longer than any child reads,
    // and long enough that a leak of even a hundredth of a second per frame
    // would be unmissable.
    for (let i = 0; i < 11_250; i++) surface.step(16);
    assert.equal(snapshot(handle.world), held, "the world moved behind the manual");

    closeManual(surface);
    // And it does not teleport. One frame after the sheet must carry one
    // frame's worth of world, not three minutes of it.
    const timeAtClose = handle.world.time;
    surface.step(16);
    const firstStep = handle.world.time - timeAtClose;
    assert.ok(firstStep > 0, "the water never started again");
    assert.ok(
      firstStep < 0.1,
      `the first frame after the sheet carried ${firstStep.toFixed(3)}s of simulation`,
    );

    for (let i = 0; i < 120; i++) surface.step(16);
    assert.ok(handle.world.time > timeAtClose + 1, "the world did not come back");
  } finally {
    stop();
  }
});

test("a dive the CHILD paused is still paused when they close the rules", () => {
  const { surface, handle, stop } = rig();
  try {
    for (let i = 0; i < 60; i++) surface.step(16);
    tapCentre(surface);
    for (let i = 0; i < 240; i++) surface.step(16);
    assert.equal(handle.world.phase, "play");

    // Their own pause verb. A child who stops the game, opens the manual to
    // work out what the rule in the middle means, and closes it again has not
    // asked to be dropped back into a moving arena.
    surface.key("keydown", { code: "KeyP", key: "p", preventDefault: () => undefined });
    surface.step(16);
    assert.equal(handle.world.paused, true, "the pause key did nothing");

    const held = snapshot(handle.world);
    openManual(surface);
    for (let i = 0; i < 600; i++) surface.step(16);
    closeManual(surface);
    for (let i = 0; i < 600; i++) surface.step(16);

    assert.equal(handle.world.paused, true, "closing the manual lifted the child's own pause");
    assert.equal(snapshot(handle.world), held, "the snake swam again after the rules closed");
  } finally {
    stop();
  }
});

test("the manual is not thinking time: the answer clock is rebased across it", () => {
  const { surface, handle, stop } = rig();
  try {
    for (let i = 0; i < 60; i++) surface.step(16);
    tapCentre(surface);
    for (let i = 0; i < 240; i++) surface.step(16);
    assert.equal(handle.world.phase, "play");

    const trial = handle.world.pending[0];
    assert.ok(trial, "no question was live");
    // How long the child has had this question so far. Everything after this is
    // reading, and reading is not answering.
    const spentBefore = surface.now() - trial.servedAtMs;

    openManual(surface);
    for (let i = 0; i < 11_250; i++) surface.step(16); // three minutes
    closeManual(surface);

    const spentAfter = surface.now() - trial.servedAtMs;
    assert.ok(
      Math.abs(spentAfter - spentBefore) < 50,
      `the sheet put ${Math.round(spentAfter - spentBefore)}ms of reading on the child's record`,
    );
  } finally {
    stop();
  }
});
