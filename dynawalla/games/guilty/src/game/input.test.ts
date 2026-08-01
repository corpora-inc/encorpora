// A DOM scrim stops the pointer. It does not stop the keyboard.
//
// Every listener in `attachInput` is on `window`, not on the canvas, so when
// the how-to-play panel is up the game is still reading keys — and `keyDown`
// falls out of its switch into `on.onStart()` for EVERY key. `onStart` is
// `begin()`, which resets the wave, the lives, the score and the best combo.
//
// The path that mattered: a child dies, the screen says PRESS ANY KEY, they
// open the manual to work out what the wrong answers meant, and press Escape to
// close it. The shared panel calls `preventDefault` but not `stopPropagation`,
// so both listeners fire — the panel closes AND the run restarts. The
// game-over screen they were reading is gone and there is nothing to say why.
//
// `p` was worse still: it toggled pause on a loop that returns before it
// renders anything, so the panel closed onto a frozen trench with no
// indication that it was paused.
//
// This file drives the real `attachInput` against a fake window and asserts
// that nothing reaches the game while `blocked()` is true — and that everything
// does the moment it is false, because an input gate stuck shut is the same bug
// wearing a different hat.

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { attachInput, type InputHandlers } from "./input.ts";
import type { World } from "./world.ts";

type Listener = (event: unknown) => void;

/** A window and a canvas that only record what was attached to them. */
function rig(): {
  fire(type: string, event: Record<string, unknown>): void;
  listenerCount(): number;
  /** Advance the clock the tap/hold split is measured on. */
  advance(ms: number): void;
  restore(): void;
  canvas: HTMLCanvasElement;
} {
  const listeners = new Map<string, Listener[]>();
  const add = (type: string, fn: Listener): void => {
    listeners.set(type, [...(listeners.get(type) ?? []), fn]);
  };
  const remove = (type: string, fn: Listener): void => {
    listeners.set(type, (listeners.get(type) ?? []).filter((f) => f !== fn));
  };

  const canvas = {
    addEventListener: add,
    removeEventListener: remove,
    setPointerCapture: () => undefined,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  } as unknown as HTMLCanvasElement;

  const fakeWindow = { addEventListener: add, removeEventListener: remove };
  const g = globalThis as Record<string, unknown>;
  const savedWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const savedPerf = g.performance;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: fakeWindow,
  });
  // A clock this file owns, always. The tap/hold split is measured in
  // milliseconds of wall time, and a test that hopes a real clock stays under a
  // 230ms threshold is a test that goes red on a loaded machine for no reason.
  let clock = 0;
  g.performance = { now: () => clock };

  return {
    canvas,
    advance(ms) {
      clock += ms;
    },
    fire(type, event) {
      // Every real event has these; supplying them here means a gate that is
      // removed fails on the ASSERTION rather than on a TypeError, which is the
      // difference between a test that reports the bug and one that just goes
      // red for its own reasons.
      const full = { preventDefault: () => undefined, stopPropagation: () => undefined, ...event };
      for (const fn of [...(listeners.get(type) ?? [])]) fn(full);
    },
    listenerCount() {
      let n = 0;
      for (const list of listeners.values()) n += list.length;
      return n;
    },
    restore() {
      if (savedWindow) Object.defineProperty(globalThis, "window", savedWindow);
      else Reflect.deleteProperty(globalThis, "window");
      if (savedPerf === undefined) Reflect.deleteProperty(g, "performance");
      else g.performance = savedPerf;
    },
  };
}

/** Only the two fields the input layer ever touches. */
const fakeWorld = (): World =>
  ({
    touch: false,
    ship: { x: 0, targetX: 0 },
    cam: { f: 600, z: 300, cx: 400, x: 0 },
  }) as unknown as World;

function counted(
  blocked: () => boolean,
  /** What `onStart` says: true means "I began a run and spent this input". */
  startConsumes = false,
): {
  handlers: InputHandlers;
  calls: Record<string, number>;
  /** The run has begun; from now on `onStart` consumes nothing. */
  started(): void;
} {
  let consumes = startConsumes;
  const calls: Record<string, number> = {
    onStart: 0,
    onFire: 0,
    onFocus: 0,
    onToggleMute: 0,
    onTogglePause: 0,
    onToggleStats: 0,
  };
  const bump = (k: string) => (): void => {
    calls[k] = (calls[k] ?? 0) + 1;
  };
  return {
    calls,
    started(): void {
      consumes = false;
    },
    handlers: {
      blocked,
      onStart: (): boolean => {
        calls.onStart = (calls.onStart ?? 0) + 1;
        return consumes;
      },
      onFire: bump("onFire"),
      onFocus: bump("onFocus"),
      onToggleMute: bump("onToggleMute"),
      onTogglePause: bump("onTogglePause"),
      onToggleStats: bump("onToggleStats"),
    },
  };
}

const KEYS = [
  { key: "Escape" },
  { key: "p" },
  { key: " " },
  { key: "m" },
  { key: "`" },
  { key: "Tab" },
  { key: "ArrowLeft" },
  { key: "Enter" },
];

test("no key reaches the game while the manual is open", () => {
  const r = rig();
  try {
    const { handlers, calls } = counted(() => true);
    const input = attachInput(r.canvas, fakeWorld(), handlers);
    for (const k of KEYS) r.fire("keydown", k);
    r.fire("pointerdown", { pointerId: 1, clientX: 400, pointerType: "touch" });
    r.fire("pointerup", { pointerId: 1 });

    for (const [name, n] of Object.entries(calls)) {
      assert.equal(n, 0, `${name} fired ${n} times through the manual`);
    }
    // And the steering axis never latched, so closing the panel does not fly
    // the ship into a wall.
    assert.equal(input.axis(), 0, "an arrow key latched behind the panel");
    input.detach();
  } finally {
    r.restore();
  }
});

test("every key reaches the game the moment the manual closes", () => {
  // The counterpart. A gate that is stuck shut is the same bug in a hat: it
  // would pass the test above and make the game unplayable.
  const r = rig();
  try {
    const { handlers, calls } = counted(() => false);
    const input = attachInput(r.canvas, fakeWorld(), handlers);

    r.fire("keydown", { key: "Escape" });
    assert.equal(calls.onStart, 1, "a key press no longer starts the game");

    r.fire("keydown", { key: "p" });
    assert.equal(calls.onTogglePause, 1, "p no longer pauses");

    r.fire("keydown", { key: " " });
    assert.equal(calls.onFire, 1, "space no longer shoots");
    assert.equal(calls.onFocus, 0, "space still spends deep focus");

    r.fire("keydown", { key: "f" });
    assert.equal(calls.onFocus, 1, "f no longer spends deep focus");

    r.fire("keydown", { key: "m" });
    assert.equal(calls.onToggleMute, 1, "m no longer mutes");

    r.fire("keydown", { key: "ArrowLeft" });
    assert.equal(input.axis(), -1, "the left arrow no longer steers");
    r.fire("keyup", { key: "ArrowLeft" });
    assert.equal(input.axis(), 0, "the left arrow never let go");

    input.detach();
    assert.equal(r.listenerCount(), 0, "detach left a listener on the window");
  } finally {
    r.restore();
  }
});

test("a key released while the manual is open still lets go", () => {
  // `keyUp` is deliberately NOT gated. A child holding left when they tapped
  // the `?` would otherwise come back to a ship steering by itself.
  const r = rig();
  try {
    let open = false;
    const { handlers } = counted(() => open);
    const input = attachInput(r.canvas, fakeWorld(), handlers);

    r.fire("keydown", { key: "ArrowRight" });
    assert.equal(input.axis(), 1);
    open = true;
    r.fire("keyup", { key: "ArrowRight" });
    assert.equal(input.axis(), 0, "the held key survived the panel");
    input.detach();
  } finally {
    r.restore();
  }
});

/* ────────────────────────────────────────────────────────────── the trigger */
//
// "I think maybe you should choose when to shoot, eh?"
//
// The gun used to fire on a timer from a standstill, so the input layer had no
// trigger at all. It has one now, and the tests below are about the two ways
// that trigger can go wrong: never firing, and firing for a child who was doing
// something else entirely.

const down = (x = 400, type = "touch"): Record<string, unknown> => ({
  pointerId: 1,
  clientX: x,
  pointerType: type,
});

test("a quick still tap is a shot", () => {
  const r = rig();
  try {
    const { handlers, calls } = counted(() => false);
    const input = attachInput(r.canvas, fakeWorld(), handlers);
    r.fire("pointerdown", down());
    r.advance(90);
    r.fire("pointerup", { pointerId: 1 });
    assert.equal(calls.onFire, 1, "a tap did not fire");
    assert.equal(calls.onFocus, 0, "a tap spent deep focus");
    input.detach();
  } finally {
    r.restore();
  }
});

test("the tap that begins a run does not also answer its first question", () => {
  // The whole change, in one gesture. TAP TO BEGIN is a single tap, and if its
  // release fires, a child's first act in the game is a shot they did not aim —
  // the auto-fire defect surviving in a smaller hat.
  const r = rig();
  try {
    const c = counted(() => false, true);
    const { handlers, calls } = c;
    const input = attachInput(r.canvas, fakeWorld(), handlers);
    r.fire("pointerdown", down());
    r.advance(90);
    r.fire("pointerup", { pointerId: 1 });
    assert.equal(calls.onStart, 1, "the tap did not start the game");
    assert.equal(calls.onFire, 0, "the tap that started the game also fired");

    // And the very next tap, which begins nothing, does fire — a swallow that
    // sticks is the same bug the other way round.
    c.started();
    r.fire("pointerdown", down());
    r.advance(90);
    r.fire("pointerup", { pointerId: 1 });
    assert.equal(calls.onFire, 1, "the trigger stayed swallowed after the start tap");
    input.detach();
  } finally {
    r.restore();
  }
});

test("the key that begins a run does not also answer its first question", () => {
  const r = rig();
  try {
    const { handlers, calls } = counted(() => false, true);
    const input = attachInput(r.canvas, fakeWorld(), handlers);
    r.fire("keydown", { key: " " });
    assert.equal(calls.onStart, 1, "space did not start the game");
    assert.equal(calls.onFire, 0, "the space that started the game also fired");
    input.detach();
  } finally {
    r.restore();
  }
});

test("a long still press is deep focus, and never also a shot", () => {
  const r = rig();
  try {
    const { handlers, calls } = counted(() => false);
    const input = attachInput(r.canvas, fakeWorld(), handlers);
    r.fire("pointerdown", down());
    r.advance(600);
    r.fire("pointerup", { pointerId: 1 });
    assert.equal(calls.onFocus, 1, "a long press did not spend deep focus");
    assert.equal(calls.onFire, 0, "a long press also fired");
    input.detach();
  } finally {
    r.restore();
  }
});

test("steering is neither a shot nor deep focus", () => {
  // A drag is how the ship crosses the field, and crossing the field must never
  // cost an answer — that was the original sin of the settle-gate auto-fire.
  const r = rig();
  try {
    const { handlers, calls } = counted(() => false);
    const input = attachInput(r.canvas, fakeWorld(), handlers);
    r.fire("pointerdown", down(200));
    r.advance(40);
    r.fire("pointermove", { pointerId: 1, clientX: 520, pointerType: "touch" });
    r.advance(40);
    r.fire("pointerup", { pointerId: 1 });
    assert.equal(calls.onFire, 0, "a drag fired the gun");
    assert.equal(calls.onFocus, 0, "a drag spent deep focus");

    // Same again, but slow enough to pass the hold threshold: still steering.
    r.fire("pointerdown", down(200));
    r.advance(900);
    r.fire("pointermove", { pointerId: 1, clientX: 520, pointerType: "touch" });
    r.fire("pointerup", { pointerId: 1 });
    assert.equal(calls.onFire, 0, "a slow drag fired the gun");
    assert.equal(calls.onFocus, 0, "a slow drag spent deep focus");
    input.detach();
  } finally {
    r.restore();
  }
});
