// CAN A CHILD READ THE NUMBER IN THE CRYSTAL?
//
// *"better. numbers could be a bit more legible perhaps (in the crystals)."*
//
// Everything below is computed from the COMPOSITE — the water, the sheen, the
// light shafts, the membrane, the deep tint, the husk glow, the white hit-flash
// glow, and the glyph's own bloom, stacked in the order `drawHusk` stacks them.
// Not from a colour constant. Measuring constants is how COUNTERPOISE shipped
// two literal 1.00:1 cases: they were overlays, and nobody composited them.

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { HUSK_R } from "../core/config.ts";
import { C } from "../core/palette.ts";

import {
  bestSingleInk,
  contrast,
  core,
  crystalBloom,
  crystalColor,
  crystalGround,
  crystalSurfaces,
  EDGE_FLASH_GAIN,
  edgeWidthPx,
  equationBloom,
  equationGround,
  GLYPH_PAD,
  INK_RIM,
  luma,
  MIN_LETTERFORM,
  MIN_OBJECT,
  plus,
  rgb,
  rimReachPx,
  RIM_WIDTH,
  worstAgainst,
  worstEdge,
  type CrystalState,
} from "./ink.ts";

/**
 * Every state a crystal is drawn in, as `drawHusk` switches on them.
 *
 * Both quality tiers appear because the deep membrane tint is gated on
 * `world.quality > 0.7` and a thermally-throttled phone therefore reads its
 * numerals over a DARKER ground than a cold one — a difference no state name
 * would have carried.
 */
const STATES: Array<[string, CrystalState]> = [
  ["candidate, in formation", {}],
  ["candidate, throttled phone (no deep tint)", { quality: 0.5 }],
  ["candidate, struck — hit flash 0.5", { flash: 0.5 }],
  ["candidate, struck — hit flash 1.0", { flash: 1 }],
  ["candidate, struck, throttled", { flash: 1, quality: 0.5 }],
  ["marked hostile", { hostile: true }],
  ["marked hostile, throttled", { hostile: true, quality: 0.5 }],
  ["marked hostile, struck — hit flash 1.0", { hostile: true, flash: 1 }],
];

const rim = rgb(INK_RIM);

test("no single ink can make a crystal numeral legible — the dead end, measured", () => {
  // This is the assertion that stops the next person "fixing" this by picking a
  // brighter colour.
  //
  // The ceiling is computed over the UNION of every state, because a numeral's
  // colour is chosen once and then has to survive whatever the shell does next.
  // Per state the answer flatters: against a struck shell alone a dark ink
  // reaches 8.9:1 — and that same dark ink is invisible on the resting shell one
  // frame earlier, which is where the child actually reads it. An ink pale
  // enough to beat the bloom is lost in the white hit-flash; an ink dark enough
  // to beat the flash is lost in the membrane. There is no third option.
  const everySurface = STATES.flatMap(([, s]) => crystalSurfaces(s));
  const ceiling = bestSingleInk(everySurface);
  assert.ok(
    ceiling < MIN_LETTERFORM,
    `a single ink could reach ${ceiling.toFixed(2)}:1 over every state, so the pair is unnecessary`,
  );
  // The resting shell on its own — the state a child spends most of the wave
  // looking at — is already hopeless before any of the others are counted.
  const resting = bestSingleInk(crystalSurfaces({}));
  assert.ok(
    resting < MIN_LETTERFORM,
    `a single ink reaches ${resting.toFixed(2)}:1 on a resting crystal alone`,
  );
});

test("the numeral the game USED to draw is unreadable against its own bloom", () => {
  // The defect, pinned so that a change which reintroduces it fails here rather
  // than on a device. The old sprite was core-on-bloom and nothing else.
  const worst: Array<[string, number]> = [];
  for (const [name, s] of STATES) {
    worst.push([name, worstAgainst(core(crystalColor(s)), crystalBloom(s))]);
  }
  for (const [name, v] of worst) {
    assert.ok(v < MIN_LETTERFORM, `${name}: core-on-bloom already measured ${v.toFixed(2)}:1`);
  }
  // The two the founder was looking at, to the second decimal, so the table in
  // the pull request is checkable rather than recited.
  const resting = worst.find(([n]) => n === "candidate, in formation")?.[1] as number;
  const struck = worst.find(([n]) => n === "candidate, struck — hit flash 1.0")?.[1] as number;
  assert.ok(resting < 1.7, `a resting crystal's digit measured ${resting.toFixed(3)}:1 on its bloom`);
  assert.ok(struck < 1.1, `a struck crystal's digit measured ${struck.toFixed(3)}:1 on its bloom`);
});

test("the letterform clears 4.5:1 against its rim, in both inks", () => {
  // Both inks, not eight states: `contrast(core, rim)` depends on the accent and
  // nothing else, so the eight rows would be six duplicates. The states are
  // still walked, because which accent a state uses is `crystalColor`'s answer
  // and not this file's — but the claim is about the two inks.
  const inks = new Set(STATES.map(([, s]) => crystalColor(s)));
  assert.equal(inks.size, 2, "a crystal is drawn in an ink this test does not measure");
  for (const [name, s] of STATES) {
    const ratio = contrast(core(crystalColor(s)), rim);
    assert.ok(
      ratio >= MIN_LETTERFORM,
      `${name}: the digit is ${ratio.toFixed(2)}:1 against the rim that encircles it`,
    );
  }
});

test("the inked blob clears 3.0:1 against every surface it lands on", () => {
  for (const [name, s] of STATES) {
    const edge = worstEdge(core(crystalColor(s)), rim, crystalGround(s));
    assert.ok(
      edge >= MIN_OBJECT,
      `${name}: the numeral's best edge against its ground is ${edge.toFixed(2)}:1`,
    );
  }
});

test("the accusation at the top of the trench is fixed by the same rim", () => {
  // The equation is the same baked sprite in amber, so it had the same defect.
  const amberCore = core(C.amber);
  const before = worstAgainst(amberCore, equationBloom());
  assert.ok(before < MIN_LETTERFORM, `the sum already read ${before.toFixed(2)}:1 on its own bloom`);
  assert.ok(
    contrast(amberCore, rim) >= MIN_LETTERFORM,
    `the sum is ${contrast(amberCore, rim).toFixed(2)}:1 against its rim`,
  );
  assert.ok(
    worstEdge(amberCore, rim, equationGround()) >= MIN_OBJECT,
    `the sum's best edge against the water is ${worstEdge(amberCore, rim, equationGround()).toFixed(2)}:1`,
  );
});

test("the wireframe is WIDER than the rim, and crosses it additively", () => {
  // `game.ts` flushes the line batch AFTER every husk has blitted its glyph, and
  // flushes it under `lighter`, so the twelve edges of the cell are ADDED on top
  // of the numeral wherever they cross it.
  //
  // The first version of this test claimed the rim outlasted that crossing by
  // measuring the rim at its very widest — a ONE-digit label at the size cap —
  // against an edge at a scale this game never runs at. Both halves of the
  // comparison were picked at operating points that never co-occur. The truth is
  // the other way round and is asserted as such below: at every viewport the
  // edge is two to five times the ring.
  //
  // What makes the pair hold anyway is that the ring is a CLOSED CONTOUR and the
  // crossing is ADDITIVE. It brightens a short arc of the ring and the core
  // under it by the same amount; it cannot darken the core, cannot invert the
  // pair, and cannot reach the rest of the contour, which is what the letterform
  // is read against.
  const cyan = rgb(C.cyan);
  const litRim = plus(cyan, rim, 0.72);
  const litCore = plus(cyan, core(C.cyan), 0.72);
  assert.ok(
    luma(litRim) >= luma(rim) && luma(litCore) >= luma(core(C.cyan)),
    "an edge crossing the numeral darkened it, so it is not being added",
  );
  assert.ok(
    contrast(litCore, litRim) < MIN_LETTERFORM,
    "an additive edge over the digit no longer washes it out, so this note is stale",
  );

  // The real widths, at the two extremes this game runs at. `scale = h / 260`
  // (`fitCamera` maps `VIEW_HALF_H` onto half the glass at `CAM_Z`), and a
  // three-digit label — the one the fit change was for — draws at about
  // `0.89 × r × scale`, which is where the ring is narrowest.
  for (const [name, glassH] of [
    ["320×568 portrait", 568],
    ["844×390 landscape", 390],
  ] as Array<[string, number]>) {
    const scale = glassH / 260;
    const size = 0.89 * HUSK_R * scale;
    const ring = rimReachPx(size);
    assert.ok(
      ring < edgeWidthPx(scale, 0),
      `${name}: the ring is ${ring.toFixed(2)}px and a resting edge ${edgeWidthPx(scale, 0).toFixed(2)}px — if the ring now wins, say so instead of this`,
    );
    // And the widest crossings are transient: `hitFlash` decays at 5.5/s from 1,
    // so `1 + EDGE_FLASH_GAIN` of edge lives about 180ms — after a strike has
    // landed, which is a frame a child has answered in rather than read in.
    assert.ok(
      edgeWidthPx(scale, 1) / edgeWidthPx(scale, 0) <= 1 + EDGE_FLASH_GAIN + 0.001,
      `${name}: a struck husk's edge grew more than the flash gain allows`,
    );
  }
});

test("a shut shell stays deliberately unreadable, and that is on purpose", () => {
  // `drawHusk` draws a shut shell's scrambled label at alpha 0.32 and the shell
  // opens as it descends — the pressure IS that you cannot read it yet. The rim
  // must not accidentally make it readable, so this is a checked absence.
  const ground = crystalGround({})[0] as [number, number, number];
  const shutCore = core(C.cyan).map((v, i) =>
    Math.round(v * 0.32 + ground[i] * 0.68),
  ) as unknown as [number, number, number];
  const shutRim = rim.map((v, i) => Math.round(v * 0.32 + ground[i] * 0.68)) as unknown as [
    number,
    number,
    number,
  ];
  assert.ok(
    contrast(shutCore, shutRim) < MIN_LETTERFORM,
    "a shut shell became readable; the descent no longer carries any pressure",
  );
});

test("the rim fits inside the sprite's own padding", () => {
  // `getGlyph` pads the bake by `GLYPH_PAD` em on every side for the blurred
  // halo. The rim is stroked centred on the letterform, so it reaches half its
  // width beyond the advance — if that ever exceeded the padding the sprite
  // would clip its own contour and the digit would read as a broken outline.
  //
  // Against the constant `bake.ts` actually pads with, not a literal copy of it:
  // a copy passes happily while somebody tightens the pad underneath it.
  assert.ok(
    RIM_WIDTH / 2 < GLYPH_PAD,
    `the rim reaches ${String(RIM_WIDTH / 2)} em into a ${String(GLYPH_PAD)} em pad`,
  );
});
