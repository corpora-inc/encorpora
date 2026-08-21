/**
 * The endless street, the day that never ends inside a game, the one live
 * preview, the gear law, and the twelve strings.
 *
 * BZ-06, BZ-09, BZ-10, BZ-14, BZ-16, and the generator's own guarantees.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { Street } from "./street.ts";
import { QUARTERS } from "./quarters.ts";
import { layout } from "./layout.ts";
import { ambient, semanticAt } from "./daylight.ts";
import { Lamp, GRACE_MS } from "../lamp/state.ts";
import { gearTrain } from "../geometry/gears.ts";
import { STRINGS, LOCALES, t, resolveLocale } from "../strings.ts";
import { PreviewDirector } from "../stall/preview.ts";
import { Bed } from "../sound/bed.ts";
import type { StallSpec, StallPreview } from "../types.ts";

const stalls: StallSpec[] = QUARTERS.map((q) => ({
  id: q.id,
  title: q.id,
  quarter: q.id,
  preview: { period: 6, render: () => {} },
}));

const street = (m = 320) => new Street({ seed: 0x1453, module: m, stalls });

// ── the street generates itself, forever ───────────────────────────────────

test("the street extends as far as it is asked to, and never ends", () => {
  const s = street();
  s.ensure(40_000);
  assert.ok(s.width >= 40_000, `street stopped at ${s.width}`);
  assert.ok(s.stalls.length > 60, "not enough stalls generated");
  // Past the last built quarter there is scaffolding, not a wall.
  const beyond = s.stalls.slice(QUARTERS.length);
  assert.ok(beyond.length > 20);
  for (const f of beyond) assert.equal(f.stall.state, "scaffold");
});

test("interstitial fabric never repeats within five, and fountains stay apart", () => {
  const s = street();
  s.ensure(30_000);
  const kinds = s.features.filter((f) => f.kind === "interstitial").map((f) => f.type);
  for (let i = 0; i < kinds.length; i++) {
    const window = kinds.slice(Math.max(0, i - 5), i);
    assert.ok(!window.includes(kinds[i]!), `${kinds[i]} repeats within five`);
  }
  const fountains = kinds
    .map((k, i) => (k === "fountain" ? i : -1))
    .filter((i) => i >= 0);
  for (let i = 1; i < fountains.length; i++) {
    assert.ok(fountains[i]! - fountains[i - 1]! >= 9, "two fountains too close");
  }
});

test("a gate stands at every ward boundary and nowhere else", () => {
  const s = street();
  s.ensure(12_000);
  let ward: string | null = null;
  for (const f of s.features) {
    if (f.kind === "gate") {
      assert.notEqual(f.ward, ward, "a gate where the ward did not change");
    }
    if (f.kind === "stall") ward = f.quarter.ward;
  }
  assert.ok(s.wardBoundaries().length > 4, "no ward boundaries found");
});

test("the generated street is deterministic on its seed", () => {
  const a = street();
  const b = street();
  a.ensure(9000);
  b.ensure(9000);
  assert.equal(a.features.length, b.features.length);
  assert.deepEqual(
    a.features.map((f) => `${f.kind}:${Math.round(f.x)}`),
    b.features.map((f) => `${f.kind}:${Math.round(f.x)}`),
  );
});

// ── BZ-LAW-10 and the vertical composition ─────────────────────────────────

test("BZ-LAW-10: a stall never fills the viewport, at any rung", () => {
  for (const [w, h] of [
    [320, 568],
    [360, 640],
    [390, 844],
    [768, 1024],
    [1024, 768],
    [1440, 900],
  ] as const) {
    const l = layout(w, h, 2);
    assert.ok(l.M <= w * 0.82, `${w}×${h}: M=${l.M} fills the viewport`);
    // §4.5's 44 % floor is a portrait rule; in landscape the 4:3 aperture
    // shape governs and the floor relaxes to 28 %.
    const floor = h > w ? 0.44 : 0.28;
    assert.ok(
      l.apertureH >= h * floor,
      `${w}×${h}: aperture ${Math.round(l.apertureH)}px is under ${Math.round(h * floor)}px`,
    );
    assert.ok(l.M >= 180, `${w}×${h}: M=${l.M} is unusably small`);
    assert.ok(
      Math.abs(l.skyH + l.canopyH + l.stallH + l.floorH - h) < 0.5,
      `${w}×${h}: the bands do not sum to the viewport`,
    );
  }
});

// ── BZ-16 / BZ-LAW-14 / BZ-LAW-15 — the lamp ───────────────────────────────

test("BZ-16: the day cannot complete while a stall is open", () => {
  const lamp = new Lamp();
  lamp.setRemaining(0);
  lamp.setInStall(true);
  assert.equal(lamp.read().d, 0.99, "the day completed inside a game");
  assert.equal(lamp.read().night, 0, "dusk began inside a game");
});

test("BZ-LAW-15: stepping back into the street buys a 90 s grace", () => {
  const lamp = new Lamp();
  lamp.setRemaining(0);
  lamp.setInStall(true);
  lamp.setInStall(false);
  const now = Date.now();
  assert.equal(lamp.read(now).grace, true);
  assert.equal(lamp.read(now).night, 0, "dusk started during the grace");
  assert.equal(lamp.read(now + GRACE_MS + 1).grace, false);
});

test("BZ-LAW-14: walking the bazaar costs nothing", () => {
  const lamp = new Lamp();
  lamp.setRemaining(0.5);
  const a = lamp.read();
  // No tick, no timer, no run-length: only the host's own accounting moves it.
  const b = lamp.read(Date.now() + 600_000);
  assert.equal(a.d, b.d);
  assert.equal(a.oil, b.oil);
});

test("the lamp reads on four carriers, three of which are not colour", () => {
  const lamp = new Lamp();
  const seen = new Set<string>();
  for (const r of [1, 0.6, 0.25, 0.05]) {
    lamp.setRemaining(r);
    const x = lamp.read();
    seen.add(x.label);
    assert.ok(x.oil >= 0 && x.oil <= 1);
    assert.ok(x.gnomon >= 0 && x.gnomon <= 150);
    assert.equal(x.lit, false, "the flame is a shape, and by day there is none");
  }
  lamp.setForcedNight(true);
  const night = lamp.read();
  seen.add(night.label);
  assert.equal(night.lit, true, "the lamps did not light at dusk");
  assert.equal(seen.size, 5, "the five day-states are not all reachable");
});

test("a subscriber's lamp never falls, and has no lamplighter to tap", () => {
  const lamp = new Lamp();
  lamp.setSubscribed(true);
  lamp.setRemaining(0);
  const r = lamp.read();
  assert.equal(r.oil, 1);
  assert.equal(r.lit, true);
  assert.equal(lamp.showsLamplighter, false, "BZ-15: an upgrade surface for a subscriber");
});

test("the free child at dusk is not ejected: the ambient still resolves", () => {
  const am = ambient(1, 1);
  assert.ok(am.lanternGain >= 1);
  const sem = semanticAt(1);
  assert.notEqual(sem.ground, semanticAt(0).ground);
  // …and the dusk is continuous, not a cut.
  const mid = semanticAt(0.5);
  assert.notEqual(mid.ground, semanticAt(0).ground);
  assert.notEqual(mid.ground, semanticAt(1).ground);
});

// ── BZ-10 — the gear law ───────────────────────────────────────────────────

test("BZ-10: ω_b = −ω_a·(N_a/N_b) for every meshing pair, as drawn", () => {
  const spec = [{ teeth: 24 }, { teeth: 18, bearing: -20 }, { teeth: 12, bearing: 40 }];
  const gears = gearTrain({ spec, module: 4, origin: { x: 0, y: 0 }, omega: 0.5 }, 0);
  for (let i = 1; i < gears.length; i++) {
    const a = gears[i - 1]!;
    const b = gears[i]!;
    assert.ok(
      Math.abs(b.omega + a.omega * (a.teeth / b.teeth)) < 1e-9,
      `pair ${a.teeth}→${b.teeth} violates the ratio law`,
    );
    // …and they actually mesh: centre distance is the sum of pitch radii.
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    assert.ok(Math.abs(d - (a.r + b.r)) < 1e-9, "gears are not in contact");
  }
});

test("BZ-10: a follower's angle is derived, so it cannot be assigned wrongly", () => {
  const spec = [{ teeth: 20 }, { teeth: 15, bearing: -34 }];
  const t0 = gearTrain({ spec, module: 4, origin: { x: 0, y: 0 }, omega: 0.55 }, 0);
  const t1 = gearTrain({ spec, module: 4, origin: { x: 0, y: 0 }, omega: 0.55 }, 1);
  const dA = t1[0]!.angle - t0[0]!.angle;
  const dB = t1[1]!.angle - t0[1]!.angle;
  assert.ok(Math.abs(dB + dA * (20 / 15)) < 1e-9, "the drawn rotation broke the ratio");
});

// ── BZ-06 — exactly one live preview ───────────────────────────────────────

test("BZ-06: at most one preview renders per frame once posters exist", () => {
  const calls: string[] = [];
  const mk = (id: string): StallPreview => ({
    period: 6,
    render: () => {
      calls.push(id);
    },
  });
  const director = new PreviewDirector();
  const ctx = fakeCtx();
  const ids = ["a", "b", "c", "d"];
  const previews = Object.fromEntries(ids.map((i) => [i, mk(i)]));

  // First pass: each stall paints one still frame and caches a poster.
  director.setLive("a");
  director.beginFrame();
  for (const id of ids) director.draw(ctx, id, previews[id], 100, 100, 1, 0, 1, false);
  assert.equal(director.rendersThisFrame, ids.length);

  // Thereafter only the centred stall animates.
  for (let frame = 0; frame < 5; frame++) {
    director.beginFrame();
    calls.length = 0;
    for (const id of ids) director.draw(ctx, id, previews[id], 100, 100, 1, frame, 1, false);
    assert.equal(director.rendersThisFrame, 1, `frame ${frame} ran ${calls.length} previews`);
    assert.deepEqual(calls, ["a"]);
  }
  assert.ok(director.posterCount <= 24, "the poster cache is unbounded");
});

test("BZ-06: a preview that throws is demoted and never asked again", () => {
  const director = new PreviewDirector();
  const ctx = fakeCtx();
  let asked = 0;
  const bad: StallPreview = {
    period: 6,
    render: () => {
      asked++;
      throw new Error("boom");
    },
  };
  director.setLive("x");
  director.beginFrame();
  director.draw(ctx, "x", bad, 100, 100, 1, 0, 1, false);
  director.beginFrame();
  director.draw(ctx, "x", bad, 100, 100, 1, 1, 1, false);
  assert.equal(asked, 1, "a broken preview was asked twice");
});

// ── BZ-09 — sound is never load-bearing ────────────────────────────────────

test("BZ-09: the bed is a silent no-op when AudioContext throws", () => {
  const g = globalThis as { AudioContext?: unknown };
  const saved = g.AudioContext;
  g.AudioContext = class {
    constructor() {
      throw new Error("no audio on this device");
    }
  };
  try {
    const bed = new Bed();
    bed.start();
    bed.setOpen(true);
    bed.setDuck("preview");
    bed.chime(0.2);
    bed.strike(0, 0.5);
    bed.shutter(0);
    bed.suspend();
    bed.resume();
    bed.destroy();
  } finally {
    g.AudioContext = saved;
  }
});

// ── BZ-14 — the string budget ──────────────────────────────────────────────

test("BZ-14: twelve user-visible strings, present in all five locales", () => {
  const keys = Object.keys(STRINGS.en);
  assert.ok(keys.length <= 12, `${keys.length} strings; the budget is 12`);
  for (const loc of LOCALES) {
    const table = STRINGS[loc];
    assert.deepEqual(Object.keys(table).sort(), keys.sort(), `${loc} has different keys`);
    for (const k of keys) {
      const v = table[k as keyof typeof table];
      assert.ok(v.length > 0, `${loc}.${k} is empty`);
      // Slots must survive translation.
      const enSlots = (STRINGS.en[k as keyof typeof table].match(/\{\w+\}/g) ?? []).sort();
      const locSlots = (v.match(/\{\w+\}/g) ?? []).sort();
      assert.deepEqual(locSlots, enSlots, `${loc}.${k} lost a placeholder`);
    }
  }
});

test("the accessible name for a stall reads as a sentence", () => {
  const s = t("en", "stall", {
    name: "Tessera",
    quarter: "Tilers’ Court",
    specimen: "twelve times eight",
  });
  assert.equal(s, "Tessera, Tilers’ Court, twelve times eight");
  assert.equal(resolveLocale("pt-PT"), "pt-BR");
  assert.equal(resolveLocale(undefined), "en");
});

test("no string in the bazaar narrates status, roadmap or a countdown", () => {
  const banned = /coming soon|left|remaining|minutes|seconds|upgrade|free|trial|\d/i;
  for (const loc of LOCALES) {
    for (const [k, v] of Object.entries(STRINGS[loc])) {
      assert.ok(!banned.test(v), `${loc}.${k} narrates: "${v}"`);
    }
  }
});

// ── a canvas stub good enough for the director ─────────────────────────────

function fakeCtx(): CanvasRenderingContext2D {
  const canvas = { width: 100, height: 100 };
  const noop = () => {};
  const ctx = new Proxy(
    { canvas, drawImage: noop },
    {
      get(target: Record<string, unknown>, prop: string) {
        if (prop in target) return target[prop];
        return noop;
      },
      set() {
        return true;
      },
    },
  );
  return ctx as unknown as CanvasRenderingContext2D;
}

// The director captures posters onto real canvases; in Node there is no DOM,
// so give it the smallest possible one.
const g = globalThis as { document?: unknown };
if (!g.document) {
  g.document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => fakeCtx(),
    }),
  };
}
