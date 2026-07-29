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
  if (typeof savedPerf !== "object") g.performance = { now: () => 0 };

  return {
    canvas,
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
      if (typeof savedPerf !== "object") Reflect.deleteProperty(g, "performance");
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

function counted(blocked: () => boolean): {
  handlers: InputHandlers;
  calls: Record<string, number>;
} {
  const calls: Record<string, number> = {
    onStart: 0,
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
    handlers: {
      blocked,
      onStart: bump("onStart"),
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
    assert.equal(calls.onFocus, 1, "space no longer spends deep focus");

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
