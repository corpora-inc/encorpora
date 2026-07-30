/**
 * Every colour a child has to read, in every world this game can generate.
 *
 * The founder's report was "recharge questions are not always legible in every
 * theme ... black numbers on dark background". The honest way to answer that is
 * not to look at four screenshots — VOLTA does not have four themes. It has an
 * unbounded number: `biomeAt(i)` cycles four bases and hue-rotates the whole
 * palette 0.14 turns on every lap, for ever, and the *crossfade* between two of
 * them is a further continuum of worlds that are on screen for two seconds each
 * and are exactly as likely to be the one a child dies in.
 *
 * So this walks 32 biomes — eight laps, a full circuit of the hue wheel and
 * then some — and five points across each crossing between neighbours, and
 * computes WCAG contrast for every ink against every backdrop that ink can land
 * on. Nothing here is a spot check and nothing here is eyeballed.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { biomeAt } from "./biomes.ts";
import {
  AA,
  INK_DARK,
  LANE_FACE,
  PLAIN_STOPS,
  REVIVE_CONTENT_TOP,
  REVIVE_STOPS,
  VEIL_TINT,
  VOLT_BED,
  VOLT_BED_A,
  alphaAt,
  contrast,
  gradientStops,
  laneFaceStops,
  hex,
  inkFor,
  inkVars,
  laneBackdrops,
  luma,
  mix,
  over,
  plainBackdrops,
  readableInk,
  reviveBackdrops,
} from "./contrast.ts";
import { HUD_CSS } from "./hud.ts";

/* -------------------------------------------------------------------------- */
/* The primitives, against values that can be checked by hand.                */
/* -------------------------------------------------------------------------- */

test("luminance and contrast are the WCAG ones, not a lookalike", () => {
  assert.equal(luma(0x000000), 0);
  assert.equal(luma(0xffffff), 1);
  // The defining pair: white on black is 21:1 exactly.
  assert.equal(Math.round(contrast(0xffffff, 0x000000) * 100) / 100, 21);
  assert.equal(contrast(0x123456, 0x123456), 1);
  // Order must not matter — a ratio, not a difference.
  assert.equal(contrast(0xffffff, 0x336699), contrast(0x336699, 0xffffff));
  // The green channel dominates: same 8-bit value, very different luminance.
  assert.ok(luma(0x00ff00) > luma(0xff0000));
  assert.ok(luma(0xff0000) > luma(0x0000ff));
});

test("compositing matches what a browser paints rgba() over an opaque backdrop", () => {
  assert.equal(over(0xffffff, 0, 0x102030), 0x102030);
  assert.equal(over(0xffffff, 1, 0x102030), 0xffffff);
  assert.equal(over(0x000000, 0.5, 0xffffff), 0x808080);
  // The exact composite from the shipped defect: the recharge veil's lower band
  // over THE BLEACH's bone sky.
  assert.equal(over(0x030712, 0.88, 0xfdfaf2), 0x21242d);
});

test("alphaAt interpolates the gradient stops and clamps outside them", () => {
  const s = [
    [0, 0.2],
    [0.5, 0.8],
    [1, 1],
  ] as const;
  assert.equal(alphaAt(s, -1), 0.2);
  assert.equal(alphaAt(s, 0), 0.2);
  assert.ok(Math.abs(alphaAt(s, 0.25) - 0.5) < 1e-9);
  assert.equal(alphaAt(s, 0.5), 0.8);
  assert.ok(Math.abs(alphaAt(s, 0.75) - 0.9) < 1e-9);
  assert.equal(alphaAt(s, 2), 1);
});

test("readableInk picks the pole that is actually further away", () => {
  assert.ok(luma(readableInk([0x000000])) > 0.5, "on black it must go light");
  assert.ok(luma(readableInk([0xffffff])) < 0.5, "on white it must go dark");
  // A mid grey defeats both house inks. It must still return the best available
  // rather than a colour under the bar, and say so by clearing it.
  const grey = readableInk([0x808080]);
  assert.ok(
    contrast(grey, 0x808080) >= AA,
    `mid grey resolved to ${hex(grey)} at ${contrast(grey, 0x808080).toFixed(2)}:1`,
  );
});

test("toward keeps as much of the hue as clearing the bar allows", () => {
  // A dim accent on a dim scrim has to be lifted, but it must not be lifted all
  // the way to white — the RECHARGE label should still read as the biome.
  const bg = 0x21242d;
  const dim = 0x2f4f7f;
  const fixed = inkFor(0xfdfaf2, 0x0b0b0d, dim).accentOnVeil;
  assert.ok(contrast(fixed, bg) >= AA || luma(fixed) >= luma(dim));
  assert.notEqual(fixed, 0xffffff, "correction jumped straight to the pole");
});

/* -------------------------------------------------------------------------- */
/* Every world.                                                               */
/* -------------------------------------------------------------------------- */

/** Eight laps of four biomes: a full circuit of the 0.14-turn hue rotation. */
const LAPS = 8;
const BIOMES = 4 * LAPS;

/** The blends a crossing actually puts on screen, including the endpoints. */
const CROSSFADE = [0, 0.25, 0.5, 0.75, 1];

type World = { label: string; sky: number; deck: number; accent: number };

/**
 * Every world the generator can produce, discrete and mid-crossing.
 *
 * `mount.ts` derives its inks from `uSkyBot`, `uDeck` and `uAccent`, which are
 * the crossfade's live blends, so this reproduces exactly those three.
 */
function worlds(): World[] {
  const out: World[] = [];
  for (let i = 0; i < BIOMES; i++) {
    const a = biomeAt(i);
    const b = biomeAt(i + 1);
    for (const m of CROSSFADE) {
      out.push({
        label: m === 0 ? a.name : `${a.name} -> ${b.name} @${m}`,
        sky: mix(a.skyBot, b.skyBot, m),
        deck: mix(a.deck, b.deck, m),
        accent: mix(a.accent, b.accent, m),
      });
    }
  }
  return out;
}

const WORLDS = worlds();

test("the world list is the real generator and is not trivially small", () => {
  assert.equal(WORLDS.length, BIOMES * CROSSFADE.length);
  assert.ok(WORLDS.length >= 160, `only ${WORLDS.length} worlds — this is a spot check`);
  // A guard on the guard: if `biomeAt` ever stopped rotating, every lap would be
  // identical and this whole file would be testing four worlds while claiming
  // thirty-two.
  const accents = new Set(WORLDS.map((w) => w.accent));
  assert.ok(accents.size > 60, `only ${accents.size} distinct accents across ${BIOMES} biomes`);
  // Both a bone world and near-black worlds must be in the set, or the test is
  // not exercising the case that shipped.
  assert.ok(WORLDS.some((w) => luma(w.sky) > 0.7), "no bright sky in the set");
  assert.ok(WORLDS.some((w) => luma(w.sky) < 0.02), "no dark sky in the set");
});

/**
 * Every ink, and every backdrop it is drawn on, for one world.
 *
 * This is the table the whole file turns on, so each entry names the surface in
 * the terms a person debugging a screenshot would use.
 */
function surfaces(w: World): { what: string; ink: number; bgs: number[] }[] {
  const k = inkFor(w.sky, w.deck, w.accent);
  return [
    { what: "the prompt, score and surge, on the sky", ink: k.sky, bgs: [w.sky] },
    { what: "SCORE / SURGE, tracked and quiet, on the sky", ink: k.skyDim, bgs: [w.sky] },
    {
      what: "the voltage readout, on the deck",
      ink: k.deck,
      bgs: [w.deck, over(VOLT_BED, VOLT_BED_A, w.deck)],
    },
    {
      what: "the voltage fill, on its bed",
      ink: k.voltFill,
      bgs: [over(VOLT_BED, VOLT_BED_A, w.deck)],
    },
    { what: "the recharge question, on the veil", ink: k.veil, bgs: reviveBackdrops(w.sky) },
    { what: "the start and run-over veils", ink: k.veil, bgs: plainBackdrops(w.sky) },
    {
      what: "the VOLTAGE label, quiet, on the deck",
      ink: k.deckDim,
      bgs: [w.deck, over(VOLT_BED, VOLT_BED_A, w.deck)],
    },
    {
      what: "the recharge counter and the start hint, quiet, on the veil",
      ink: k.veilDim,
      bgs: [...reviveBackdrops(w.sky), ...plainBackdrops(w.sky)],
    },
    { what: "a recharge lane's numeral, on the lane face", ink: k.lane, bgs: laneBackdrops(w.sky) },
    { what: "the chosen lane's numeral, on the accent fill", ink: k.onAccent, bgs: [w.accent] },
    { what: "the RUN button's label, on a fill of the veil ink", ink: k.onVeilInk, bgs: [k.veil] },
    { what: "a pressed tool's glyph, on a fill of the deck ink", ink: k.onDeckInk, bgs: [k.deck] },
    { what: "the RECHARGE label, accent-hued, on the veil", ink: k.accentOnVeil, bgs: reviveBackdrops(w.sky) },
  ];
}

test("every ink clears WCAG AA in every world VOLTA can generate", () => {
  const failures: string[] = [];
  let checks = 0;
  for (const w of WORLDS) {
    for (const s of surfaces(w)) {
      for (const bg of s.bgs) {
        checks++;
        const r = contrast(s.ink, bg);
        if (r < AA) {
          failures.push(
            `${w.label}: ${s.what} — ${hex(s.ink)} on ${hex(bg)} is ${r.toFixed(2)}:1, under ${AA}:1`,
          );
        }
      }
    }
  }
  assert.ok(checks > 5000, `only ${checks} contrast checks were made`);
  assert.deepEqual(failures.slice(0, 12), [], `${failures.length} of ${checks} surfaces are illegible`);
});

test("the recharge gate specifically — the screen the founder photographed", () => {
  // Stated separately from the sweep above so that a regression on this one
  // screen cannot hide inside a general failure count, and so the failure
  // message names the gate.
  for (const w of WORLDS) {
    const k = inkFor(w.sky, w.deck, w.accent);
    for (const bg of reviveBackdrops(w.sky)) {
      assert.ok(
        contrast(k.veil, bg) >= AA,
        `${w.label}: the recharge QUESTION is ${hex(k.veil)} on ${hex(bg)} — ${contrast(k.veil, bg).toFixed(2)}:1`,
      );
    }
    for (const bg of laneBackdrops(w.sky)) {
      assert.ok(
        contrast(k.lane, bg) >= AA,
        `${w.label}: a recharge ANSWER is ${hex(k.lane)} on ${hex(bg)} — ${contrast(k.lane, bg).toFixed(2)}:1`,
      );
    }
    assert.ok(
      contrast(k.onAccent, w.accent) >= AA,
      `${w.label}: the CHOSEN answer is ${hex(k.onAccent)} on the accent ${hex(w.accent)} — ${contrast(k.onAccent, w.accent).toFixed(2)}:1`,
    );
  }
});

test("the three colours that shipped are each provably illegible", () => {
  // The regression this file exists for, stated as the failure rather than the
  // fix — so that if someone reverts contrast.ts to a fixed ink, the reason it
  // was wrong is still written down and still computed.
  const bleach = biomeAt(3);
  assert.equal(bleach.id, "void", "THE BLEACH moved; this test is measuring the wrong world");

  // 1. The whole HUD's ink came from `biome.inverted`, i.e. from the SKY, and
  //    the veil does not sit on the sky.
  const veilBottom = over(VEIL_TINT, alphaAt(REVIVE_STOPS, 1), bleach.skyBot);
  const wasVeil = contrast(INK_DARK, veilBottom);
  assert.ok(wasVeil < 2, `the shipped recharge ink was ${wasVeil.toFixed(2)}:1, expected under 2:1`);
  assert.ok(
    contrast(inkFor(bleach.skyBot, bleach.deck, bleach.accent).veil, veilBottom) >= AA,
    "and the derived one must not be",
  );

  // 2. `.vt-lane.vt-right span` was a fixed #04060f on the live accent, and the
  //    hue rotation walks the accent to royal blue on the second lap.
  const auroraII = biomeAt(4);
  assert.equal(auroraII.id, "aurora");
  const wasOnAccent = contrast(0x04060f, auroraII.accent);
  assert.ok(
    wasOnAccent < AA,
    `${auroraII.name}'s accent ${hex(auroraII.accent)} gave the fixed black label ${wasOnAccent.toFixed(2)}:1`,
  );
  assert.ok(contrast(inkFor(auroraII.skyBot, auroraII.deck, auroraII.accent).onAccent, auroraII.accent) >= AA);

  // 3. The voltage bar took the sky's ink and sits on the deck, which is
  //    near-black in the biome whose sky is bone.
  const wasVolt = contrast(INK_DARK, bleach.deck);
  assert.ok(wasVolt < 1.5, `the shipped voltage fill was ${wasVolt.toFixed(2)}:1 on the deck`);
});

/* -------------------------------------------------------------------------- */
/* ...and the stylesheet cannot disagree with any of it.                      */
/* -------------------------------------------------------------------------- */

test("the veils' scrims are generated from the stops the test samples", () => {
  // The same contract chrome.ts imposes on geometry. If the CSS carried its own
  // copy of these numbers, every contrast assertion above would be measuring a
  // gradient that is not on screen — which is precisely how the geometry bug
  // shipped twice before it was tracked to the same shape of mistake.
  assert.ok(
    HUD_CSS.includes(gradientStops(REVIVE_STOPS)),
    "the recharge veil's gradient is not built from REVIVE_STOPS",
  );
  assert.ok(
    HUD_CSS.includes(gradientStops(PLAIN_STOPS)),
    "the start / run-over veil's gradient is not built from PLAIN_STOPS",
  );
});

test("the content band of the recharge veil is scrimmed, not transparent", () => {
  // The fix is a *sparser field*, not a heavier ink: no ink clears 4.5:1 against
  // a band that runs from bone to black behind it, so the band under the
  // question and the answers has a floor. Above it the causeway still shows.
  for (let i = 0; i <= 20; i++) {
    const p = REVIVE_CONTENT_TOP + ((1 - REVIVE_CONTENT_TOP) * i) / 20;
    assert.ok(
      alphaAt(REVIVE_STOPS, p) >= 0.85,
      `the scrim is ${alphaAt(REVIVE_STOPS, p)} at ${p.toFixed(2)}, where an answer is drawn`,
    );
  }
  const clear = alphaAt(REVIVE_STOPS, 0.27);
  assert.ok(clear <= 0.25, `the window onto the causeway closed to ${clear} — this is a dialog box now`);
});

test("the stylesheet holds no ink of its own for anything a child reads", () => {
  // Structural, like the positional guard next door: a literal colour on one of
  // these selectors is an ink the stylesheet owns and contrast.ts also owns, and
  // the two drift. Glows, strokes, scrims and hairlines are exempt — they are
  // not text, and `text-shadow`/`background` are not `color`.
  const READ = [
    ".vt-root",
    ".vt-prompt",
    ".vt-tl",
    ".vt-tr",
    ".vt-volt",
    ".vt-tools",
    ".vt-veil",
    ".vt-charge-label",
  ];
  // Comments are stripped first: a rule preceded by one would otherwise have the
  // whole comment glued onto the front of its selector list.
  const sheet = HUD_CSS.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = new Map<string, string>();
  for (const m of sheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    for (const sel of (m[1] ?? "").split(",")) {
      const key = sel.trim();
      rules.set(key, (rules.get(key) ?? "") + ";" + (m[2] ?? ""));
    }
  }
  for (const sel of READ) {
    const body = rules.get(sel);
    assert.ok(body !== undefined, `${sel} left the stylesheet; this test is measuring nothing`);
    for (const decl of body.split(";")) {
      const colon = decl.indexOf(":");
      if (colon < 0) continue;
      if (decl.slice(0, colon).trim() !== "color") continue;
      const value = decl.slice(colon + 1).trim();
      assert.ok(
        value.startsWith("var(--vt-"),
        `${sel} { color: ${value} } — a fixed ink is the whole defect; derive it in contrast.ts`,
      );
    }
  }
});

test("inkVars produces a colour for every ink var the stylesheet asks for", () => {
  const vars = inkVars(0x071230, 0x070a18, 0x37ecff);
  for (const m of HUD_CSS.matchAll(/var\((--vt-(?:ink|on|accent-veil|volt-fill)[a-z-]*)/g)) {
    const name = m[1] ?? "";
    assert.ok(name in vars, `the stylesheet reads ${name} and inkVars never sets it`);
  }
  for (const [name, value] of Object.entries(vars)) {
    assert.ok(/^#[0-9a-f]{6}$/.test(value), `${name} is "${value}", which is not a colour`);
  }
});

test("the lane face and the subdued opacity are the ones the sheet uses", () => {
  // The remaining two numbers that exist in both places. LANE_FACE is what the
  // lane's own gradient composites, and SUBDUED is the opacity that turns a
  // 4.5:1 ink into a 3.9:1 one.
  assert.ok(LANE_FACE.length >= 3, "the lane face lost its stops");
  assert.ok(
    HUD_CSS.includes(laneFaceStops()),
    "the recharge lane's face is not built from LANE_FACE",
  );
  // No text may carry an `opacity` again. An opacity composites the ink into the
  // backdrop, which is a contrast cut that no amount of ink derivation can see —
  // it is applied after `color` is chosen. The tracked labels used to, and every
  // one of them was under the bar in THE BLEACH.
  for (const sel of [".vt-label", ".vt-hint", ".vt-sub", ".vt-surge-x", ".vt-dist", ".vt-stat i"]) {
    const m = new RegExp(`\\${sel.replace(/ /g, " ")}\\s*\\{([^}]*)\\}`).exec(HUD_CSS);
    assert.ok(m, `${sel} left the stylesheet; this test is measuring nothing`);
    assert.ok(
      !/(^|;)\s*opacity\s*:/.test(m[1] ?? ""),
      `${sel} carries an opacity again — soften it with a derived ink, not by fading it`,
    );
    assert.ok(
      /color:var\(--vt-ink-[a-z]+-dim/.test(m[1] ?? ""),
      `${sel} does not take a derived dim ink`,
    );
  }
});
