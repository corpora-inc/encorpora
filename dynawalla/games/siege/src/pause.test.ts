/**
 * The siege stops while the rules are up.
 *
 * "All games should pause while reading the instructions .. I can hear
 * counterweight playing in the background while I'm reading the instructions ...
 * stressing me out even more."
 *
 * Sound, keys and taps are held by the shared sheet for every game. A game's own
 * simulation clock is the one thing it cannot reach, and in SIEGE that clock is
 * the whole stake: the spawner keeps releasing, the wave keeps marching, and
 * every enemy that walks into the forge takes a life off a child who is reading
 * why they are losing. The overcharge window is a countdown and would expire
 * behind the sheet.
 *
 * **This is a mount-level test, on purpose.** SIEGE had no headless harness at
 * all — `siege.test.ts` proves pure functions and `ui/chrome.test.ts` proves
 * layout arithmetic, and neither of them ever constructs the game. A pause test
 * written against a pure function would prove nothing about the wiring, which is
 * the only thing here that can be wrong. So this file builds the harness: a fake
 * document, a fake `requestAnimationFrame`, a fake `performance.now`, a fake
 * `ResizeObserver`, and a 2d context that counts every call made through it.
 *
 * **Why `package.json` now runs `--experimental-transform-types`.** It is a
 * superset of `--experimental-strip-types` and it is what this file needs to
 * exist: `render/particles.ts` declares `const enum PKind`, which strip-only
 * mode refuses outright, so importing `mount.ts` from a test was impossible
 * before. The alternative was to demote the `const enum` to a const object,
 * which would put a property lookup into the hottest loop in the game to satisfy
 * a test runner. The flag changes nothing that ships.
 *
 * **Removing the fix fails this file.** Delete the `onOpen`/`onClose` pair in
 * `mount.ts` and the wave marches on behind the sheet; delete the `if
 * (this.paused)` guard in `frame` and it marches on regardless of the flag;
 * delete the `lastT`/`askedAt` rebasing and the resumed run diverges from the
 * uninterrupted one.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { Siege } from "./mount.ts";
import { createStubHost } from "./stubHost.ts";
import type { State } from "./game/state.ts";

type Handler = (e: unknown) => void;

/** A fake element. Every one carries its OWN listener map — see `helpButton`. */
type FakeEl = {
  className: string;
  listeners: Map<string, Handler[]>;
  children: FakeEl[];
} & Record<string, unknown>;

type Harness = {
  root: HTMLElement;
  install(): () => void;
  step(ms: number): void;
  advance(ms: number): void;
  now(): number;
  /** every element the run has made, in creation order */
  made: FakeEl[];
  /** calls made through any 2d context — the "did anything draw?" counter */
  draws(): number;
};

function harness(w = 820, h = 1180): Harness {
  const made: FakeEl[] = [];
  let drawCalls = 0;
  const rect = { left: 0, top: 0, width: w, height: h, right: w, bottom: h, x: 0, y: 0 };

  // Counts every call made through it and returns itself, so chains like
  // `createRadialGradient(...).addColorStop(...)` survive with no real canvas.
  const ctx: unknown = new Proxy(function () {} as unknown as Record<string, unknown>, {
    get: (_t, prop) => {
      if (prop === "then") return undefined;
      // Any coercion of a context value yields 0, so a real comparison in the
      // renderer — `measureText(label).width <= maxW` — reaches a decision
      // instead of throwing on an object with no primitive form.
      if (prop === Symbol.toPrimitive) return () => 0;
      return ctx;
    },
    set: () => true,
    apply: () => {
      drawCalls++;
      return ctx;
    },
  });

  const makeEl = (): FakeEl => {
    const listeners = new Map<string, Handler[]>();
    const children: FakeEl[] = [];
    const style: Record<string, unknown> = {
      cssText: "",
      setProperty(k: string, v: string) {
        style[k] = v;
      },
      removeProperty(k: string) {
        delete style[k];
      },
    };
    const classes = new Set<string>();
    const el: FakeEl = {
      className: "",
      listeners,
      children,
      style,
      classList: {
        add: (c: string) => classes.add(c),
        remove: (c: string) => classes.delete(c),
        toggle: (c: string, on?: boolean) => {
          const want = on ?? !classes.has(c);
          if (want) classes.add(c);
          else classes.delete(c);
          return want;
        },
        contains: (c: string) => classes.has(c),
      },
      textContent: "",
      id: "",
      type: "",
      hidden: false,
      disabled: false,
      tabIndex: 0,
      scrollTop: 0,
      width: 0,
      height: 0,
      offsetWidth: 100,
      offsetHeight: 40,
      clientWidth: w,
      clientHeight: h,
      appendChild: (c: FakeEl) => {
        children.push(c);
        return c;
      },
      append: (...cs: FakeEl[]) => {
        children.push(...cs);
      },
      replaceChildren: (...cs: FakeEl[]) => {
        children.length = 0;
        children.push(...cs);
      },
      remove: () => undefined,
      querySelectorAll: () => [],
      focus: () => undefined,
      animate: () => ({ onfinish: null }),
      setAttribute: () => undefined,
      getAttribute: () => null,
      removeAttribute: () => undefined,
      getBoundingClientRect: () => rect,
      getContext: () => ctx,
      setPointerCapture: () => undefined,
      releasePointerCapture: () => undefined,
      addEventListener: (k: string, fn: Handler) => {
        const list = listeners.get(k) ?? [];
        list.push(fn);
        listeners.set(k, list);
      },
      removeEventListener: (k: string, fn: Handler) => {
        const list = (listeners.get(k) ?? []).filter((x) => x !== fn);
        listeners.set(k, list);
      },
      get firstElementChild(): FakeEl | null {
        return children[0] ?? null;
      },
    };
    made.push(el);
    return el;
  };

  // A QUEUE, not a slot. The HUD schedules its own `requestAnimationFrame`
  // for a toast fade, and a harness that kept only the newest callback
  // silently dropped the GAME's frame the first time a toast appeared —
  // the loop stopped five seconds in and every assertion after that was
  // measuring a game that had quietly died.
  let pending: Array<(t: number) => void> = [];
  let clock = 1000;

  const globals = new Map<string, Handler[]>();
  const saved = {
    raf: globalThis.requestAnimationFrame,
    caf: globalThis.cancelAnimationFrame,
    ro: (globalThis as { ResizeObserver?: unknown }).ResizeObserver,
    now: performance.now,
    dateNow: Date.now,
    add: globalThis.addEventListener,
    rm: globalThis.removeEventListener,
    doc: (globalThis as { document?: unknown }).document,
    win: (globalThis as { window?: unknown }).window,
    dpr: (globalThis as { devicePixelRatio?: number }).devicePixelRatio,
  };

  const root = makeEl();

  const install = (): (() => void) => {
    globalThis.requestAnimationFrame = ((cb: (t: number) => void): number => {
      pending.push(cb);
      return pending.length;
    }) as typeof globalThis.requestAnimationFrame;
    globalThis.cancelAnimationFrame = ((): void => {
      pending = [];
    }) as typeof globalThis.cancelAnimationFrame;
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    };
    performance.now = () => clock;
    // Pinned: SIEGE seeds its run from the calendar day, and a suite whose seed
    // depends on when it runs is a suite that goes red for no reason.
    Date.now = () => 1_780_000_000_000;
    // A LIST per type, not one handler per type. The shared how-to-play surface
    // registers a capture-phase swallow for `keydown` on top of the game's own
    // `keydown`, and a map that kept only the last one would quietly delete half
    // the wiring this file is here to test.
    globalThis.addEventListener = ((k: string, fn: Handler): void => {
      const list = globals.get(k) ?? [];
      list.push(fn);
      globals.set(k, list);
    }) as unknown as typeof globalThis.addEventListener;
    globalThis.removeEventListener = ((k: string, fn: Handler): void => {
      globals.set(k, (globals.get(k) ?? []).filter((x) => x !== fn));
    }) as unknown as typeof globalThis.removeEventListener;
    (globalThis as { document?: unknown }).document = {
      createElement: () => makeEl(),
      createElementNS: () => makeEl(),
      createTextNode: () => makeEl(),
      getElementById: () => null,
      body: makeEl(),
      head: makeEl(),
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    };
    (globalThis as { window?: unknown }).window = globalThis;
    (globalThis as { devicePixelRatio?: number }).devicePixelRatio = 2;
    return () => {
      globalThis.requestAnimationFrame = saved.raf;
      globalThis.cancelAnimationFrame = saved.caf;
      (globalThis as { ResizeObserver?: unknown }).ResizeObserver = saved.ro;
      performance.now = saved.now;
      Date.now = saved.dateNow;
      globalThis.addEventListener = saved.add;
      globalThis.removeEventListener = saved.rm;
      (globalThis as { document?: unknown }).document = saved.doc;
      (globalThis as { window?: unknown }).window = saved.win;
      (globalThis as { devicePixelRatio?: number }).devicePixelRatio = saved.dpr;
    };
  };

  return {
    root: root as unknown as HTMLElement,
    install,
    step: (ms: number): void => {
      clock += ms;
      const due = pending;
      pending = [];
      for (const cb of due) cb(clock);
    },
    // Time passing with no frame delivered — which is exactly what a phone does
    // when the app goes to the background with the manual up: `rAF` stops, the
    // wall clock does not.
    advance: (ms: number): void => {
      clock += ms;
    },
    now: () => clock,
    made,
    draws: () => drawCalls,
  };
}

/** The shared sheet's help control, found the way a finger finds it. */
function control(h: Harness, cls: string): FakeEl {
  const found = h.made.filter((el) => el.className === cls);
  assert.equal(found.length, 1, `expected exactly one .${cls}, found ${found.length}`);
  return found[0] as FakeEl;
}

function click(el: FakeEl): void {
  const list = el.listeners.get("click") ?? [];
  assert.ok(list.length > 0, `.${el.className} has no click listener`);
  for (const fn of list) fn({ type: "click", target: el });
}

/**
 * Everything about the run that is SIMULATION, and nothing that is not.
 *
 * `fps` and `worstFrame` are instrumentation about the harness's own pumping and
 * are deliberately excluded; every other field here is something a child would
 * see change, and every one of them must be identical between a run that was
 * interrupted by the manual and a run that was not.
 */
function sim(s: State): unknown {
  return {
    wave: s.wave,
    phase: s.phase,
    coreHp: s.coreHp,
    embers: s.embers,
    overcharge: s.overcharge,
    hpRemaining: s.hpRemaining,
    intermissionT: s.intermissionT,
    towers: s.towers.map((t) => ({ kind: t.kind, level: t.level, plotId: t.plotId })),
    stats: { ...s.stats },
    enemies: s.enemies.map((e) => ({
      kind: e.kind,
      alive: e.alive,
      hp: e.hp,
      s: e.s,
      x: e.x,
      y: e.y,
    })),
  };
}

function live(count: State): number {
  let n = 0;
  for (const e of count.enemies) if (e.alive) n++;
  return n;
}

/** Frames enough for the first waves to release and start walking. */
const WARM = 900;

test("nothing in the siege advances while the manual is open", () => {
  const h = harness();
  const restore = h.install();
  const game = new Siege(h.root, createStubHost({ seed: 0x51e6 }));
  try {
    for (let i = 0; i < WARM; i++) h.step(16);

    // The run has to actually be running, or "nothing advanced" is vacuous.
    assert.ok(live(game.live) > 0, "no enemy ever walked — the warm-up proved nothing");
    assert.ok(h.draws() > 0, "nothing ever drew — the counter proves nothing");

    click(control(h, "dwc-help"));

    const before = sim(game.live);
    const drawsBefore = h.draws();

    // Two full minutes of a child reading. A wave is thirty seconds.
    for (let i = 0; i < 7500; i++) h.step(16);

    assert.deepEqual(sim(game.live), before, "the siege advanced behind the sheet");
    assert.equal(h.draws(), drawsBefore, `${h.draws() - drawsBefore} draw calls behind the sheet`);

    click(control(h, "dwc-close"));

    for (let i = 0; i < 120; i++) h.step(16);
    assert.notDeepEqual(sim(game.live), before, "the siege never restarted after the manual closed");
    assert.ok(h.draws() > drawsBefore, "nothing drew again after the manual closed");
  } finally {
    game.destroy();
    restore();
  }
});

test("a read costs the child nothing and gives them nothing — the resume does not jump", () => {
  // The strongest form of both claims at once: the same seed, the same number of
  // LIVE frames, one run interrupted by two minutes of reading and one not. If
  // anything advanced behind the sheet the interrupted run is ahead; if any
  // wall-clock mark leapt on resume it is ahead by a different amount. Only an
  // exact freeze makes these equal.
  const play = (readAt: number | null): unknown => {
    const h = harness();
    const restore = h.install();
    const game = new Siege(h.root, createStubHost({ seed: 0x51e6 }));
    try {
      for (let i = 0; i < 1800; i++) {
        if (readAt !== null && i === readAt) {
          click(control(h, "dwc-help"));
          for (let k = 0; k < 7500; k++) h.step(16);
          click(control(h, "dwc-close"));
        }
        h.step(16);
      }
      return sim(game.live);
    } finally {
      game.destroy();
      restore();
    }
  };

  assert.deepEqual(play(900), play(null));
});

test("the read is not charged to the child as thinking time", () => {
  // `askedAt` is a `performance.now()` mark and the only thing SIEGE reports
  // about how long a child took. Left alone across a two-minute read it turns a
  // child who was shown a sheet into a child who could not answer, and the
  // learner model believes it.
  const h = harness();
  const restore = h.install();
  const reports: number[] = [];
  const game = new Siege(
    h.root,
    createStubHost({ seed: 0x51e6, onReport: (r) => reports.push(r.ms) }),
  );
  try {
    for (let i = 0; i < 600; i++) h.step(16); // 9.6s of genuine thinking

    click(control(h, "dwc-help"));
    for (let i = 0; i < 7500; i++) h.step(16); // two minutes of reading
    click(control(h, "dwc-close"));

    assert.equal(game.autoAnswer(), true, "the anvil would not take an answer after the read");
    assert.equal(reports.length, 1, "the answer was not reported");
    const ms = reports[0] as number;
    assert.ok(ms >= 0, `thinking time went negative: ${ms}ms`);
    assert.ok(ms < 20_000, `the sheet's two minutes were billed to the child: ${ms}ms`);
  } finally {
    game.destroy();
    restore();
  }
});

test("a read through a backgrounded app does not land one enormous frame", () => {
  // The manual is up and the child switches apps. `requestAnimationFrame` stops
  // dead; `performance.now()` does not. Whatever `lastT` held is now two minutes
  // stale, and the first frame after the sheet closes carries all of it.
  const play = (background: boolean): { sim: unknown; worst: number } => {
    const h = harness();
    const restore = h.install();
    const game = new Siege(h.root, createStubHost({ seed: 0x51e6 }));
    try {
      for (let i = 0; i < 1200; i++) {
        if (i === 600 && background) {
          click(control(h, "dwc-help"));
          h.advance(120_000); // away, with no frames at all
          click(control(h, "dwc-close"));
        }
        h.step(16);
      }
      return { sim: sim(game.live), worst: game.worstFrame };
    } finally {
      game.destroy();
      restore();
    }
  };

  const away = play(true);
  const straight = play(false);
  assert.deepEqual(away.sim, straight.sim, "coming back from the background moved the siege");
  assert.ok(
    away.worst < 1,
    `the frame after the sheet measured ${Math.round(away.worst * 1000)}ms of siege`,
  );
});

test("the manual only lifts a pause it put on itself", () => {
  // Nothing else pauses SIEGE today. The day something does — a host sheet over
  // the frame, a parent gate — a child who opens and closes the rules underneath
  // it must not be handed back a running wave. Reaching past the type is the
  // only way to stand in for that second pause, and the guard is worth proving
  // before the second pause exists rather than after.
  const h = harness();
  const restore = h.install();
  const game = new Siege(h.root, createStubHost({ seed: 0x51e6 }));
  const priv = game as unknown as { paused: boolean; heldForManual: boolean };
  try {
    for (let i = 0; i < WARM; i++) h.step(16);

    // The control, so this test cannot pass by the whole feature being absent:
    // with nobody else holding the clock, the manual takes it and gives it back.
    click(control(h, "dwc-help"));
    assert.equal(priv.paused, true, "the manual did not stop the clock at all");
    assert.equal(priv.heldForManual, true, "the manual did not record its own hold");
    click(control(h, "dwc-close"));
    assert.equal(priv.paused, false, "the manual did not start the clock again");

    priv.paused = true; // somebody else stopped the clock
    click(control(h, "dwc-help"));
    assert.equal(priv.heldForManual, false, "the manual claimed a pause it did not put on");

    const before = sim(game.live);
    const drawsBefore = h.draws();
    click(control(h, "dwc-close"));
    for (let i = 0; i < 600; i++) h.step(16);

    assert.deepEqual(sim(game.live), before, "closing the rules resumed somebody else's pause");
    assert.equal(h.draws(), drawsBefore, "closing the rules resumed drawing under another pause");
  } finally {
    priv.paused = false;
    game.destroy();
    restore();
  }
});

test("opening and closing the manual repeatedly never double-pauses or double-resumes", () => {
  const h = harness();
  const restore = h.install();
  const game = new Siege(h.root, createStubHost({ seed: 0x51e6 }));
  const priv = game as unknown as { paused: boolean; heldForManual: boolean };
  const help = () => control(h, "dwc-help");
  const close = () => control(h, "dwc-close");
  try {
    for (let i = 0; i < 400; i++) h.step(16);
    for (let n = 0; n < 8; n++) {
      click(help());
      click(help()); // `open` is documented safe to call when already open
      assert.equal(priv.paused, true, "the manual did not stop the clock");
      for (let i = 0; i < 30; i++) h.step(16);
      click(close());
      click(close());
      assert.equal(priv.paused, false, "the manual did not start the clock again");
      assert.equal(priv.heldForManual, false, "the hold outlived the sheet");
      for (let i = 0; i < 30; i++) h.step(16);
    }
    assert.equal(game.live.phase === "defeat", false, "eight reads lost the run");
  } finally {
    game.destroy();
    restore();
  }
});
