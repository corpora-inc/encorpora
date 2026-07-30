/**
 * The condition fits the water, at every shape the fleet has.
 *
 * ## What was broken
 *
 * `scene.ts` drew the condition at `Math.max(56, view.scale * 0.52)` and blitted it
 * at whatever width that came out — **no measurement anywhere**. The first test
 * below is the record of that: at 320px, the smallest viewport the fleet tests, the
 * unmeasured size needs more than three times the width of the vent it is clipped
 * to, and the string ran out of the disc and out of the safe box.
 *
 * It was already wrong on the **shipped** ladder — this is not a future problem.
 * `WIDEST` is measured, not guessed: `activeNodes()` was swept for every
 * (skill, level) in the five domains this pack declares (`dw.add`, `dw.mul`,
 * `dw.div`, `dw.frac`, `dw.alg`), 6,000 seeds each, and the widest string the
 * shipped host can put on the water today is **thirteen** characters. With PR #720's
 * `dw.alg.equality.missing-addend` active it is **fourteen**, because
 * `packs/shared/game-host` admits items by *domain* and this pack declares
 * `dw.alg.equality.balance-meaning`.
 *
 * ## Removing the fix
 *
 * Each part of the fix has been deleted in turn and the failures are quoted in the
 * PR body. Seven removals, seven distinct failures. What each one guards:
 *
 * | delete this | and this trips |
 * |---|---|
 * | the fit (`layoutPrompt` returns `ideal`, one line) | inside the vent · measured DOWN · animation clears · cannot-reach-the-floor |
 * | the floor (`MIN_PROMPT_PX = 1`) | the audit's floor · cannot-reach-the-floor |
 * | fitting the ink → fitting the padded canvas box | inside the vent · reaches the floor honestly · unchanged where there is room |
 * | the peak headroom (`PROMPT_PEAK_SCALE = 1`) | the pop-in headroom |
 * | the circle → a width-only check | measured DOWN · animation clears |
 * | breaks allowed anywhere | never ends on an operator · measured DOWN |
 * | `scene.ts` back to its own size expression | scene.ts goes through the fit |
 *
 * ## Why the measurement is injected
 *
 * `labelInk` needs a canvas, and there is no canvas in Node. So the fit takes a
 * `MeasureLine` and the faces below stand in for one — the pattern `truedraw`
 * already uses. Three of them, and the third is the point: `PESSIMIST` gives every
 * glyph a full em, wider than any face a platform resolves, so the guarantees are
 * statements about the geometry and not about one metric table.
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";

import { NO_INSETS, safeRect, type Insets } from "../../../../../packs/shared/game-chrome/index.ts";
import { CAP_EM, type Ink } from "./glyphs.ts";
import { TUNE } from "../tuning.ts";
import {
  MAX_PROMPT_LINES,
  MIN_PROMPT_PX,
  PROMPT_PEAK_SCALE,
  breakings,
  fitsBudget,
  promptBudget,
  promptDrawScale,
  promptFit,
  promptIdeal,
  type MeasureLine,
} from "./prompt.ts";

/* -------------------------------------------------------------------------- */
/* The faces.                                                                 */
/* -------------------------------------------------------------------------- */

type Face = { name: string; em(ch: string): number };

/**
 * The real face, measured rather than guessed.
 *
 * `FONT_STACK` at `800 100px` in a Chromium on macOS, straight off
 * `measureText().width / 100`:
 *
 *     0-9  0.700   space 0.250   + − × ÷ = < >  0.666
 *     □    0.942   /     0.455   -              0.336
 *
 * Written down because the first version of this table was *guessed* at 0.60 for a
 * digit and 0.58 for an operator, which is 15% narrow — an optimistic fixture is a
 * test that passes while the device clips. Whatever a platform actually resolves,
 * `PESSIMIST` below brackets it from above.
 */
const ROUNDED: Face = {
  name: "rounded 800 (measured)",
  em(ch) {
    if (ch >= "0" && ch <= "9") return 0.7;
    if (ch === " ") return 0.25;
    if (ch === "□") return 0.942;
    if (ch === "/") return 0.455;
    if (ch === "-") return 0.336;
    return 0.666; // + − × ÷ = < >
  },
};

/** A condensed face, to prove the fit is not tuned to one set of advances. */
const NARROW: Face = { name: "narrow", em: (ch) => (ch === " " ? 0.22 : 0.48) };

/**
 * A face where every glyph is as wide as its own em box.
 *
 * No proportional face is this wide — an em is the type size, and the widest glyph
 * a condition uses in the measured face above is U+25A1 at 0.942 of one. It is here
 * so that "the condition fits" is a statement about the geometry rather than about
 * a metric fixture: any face a platform resolves is narrower than this one, so a
 * fit that holds here holds there.
 */
const PESSIMIST: Face = { name: "pessimist (1em per glyph)", em: () => 1 };

const FACES = [ROUNDED, NARROW, PESSIMIST];

/** Tracking, copied from `PROMPT_LABEL` in `scene.ts`. */
const TRACKING = 2;
const FRACTION = /^(-?\d+)\/(\d+)$/;

/** Mirrors `labelInk` branch for branch, over a face instead of a canvas. */
function measurer(face: Face): MeasureLine {
  return (line, size): Ink => {
    const frac = FRACTION.exec(line);
    if (frac) {
      const part = size * 0.62;
      const run = (s: string): number => [...s].reduce((a, ch) => a + face.em(ch), 0) * part;
      return { w: Math.max(run(frac[1] as string), run(frac[2] as string)) * 1.5, h: part * 2.35 };
    }
    const advance = [...line].reduce((a, ch) => a + face.em(ch), 0) * size;
    return { w: advance + TRACKING * Math.max(0, line.length - 1), h: size * CAP_EM };
  };
}

/* -------------------------------------------------------------------------- */
/* The frame, exactly as `scene.ts` computes it.                              */
/* -------------------------------------------------------------------------- */

const PORTRAIT: Insets = { top: 47, right: 0, bottom: 34, left: 0 };
const LANDSCAPE: Insets = { top: 0, right: 47, bottom: 21, left: 47 };

/** The same five the HUD is asserted at. 320 wide is the tightest. */
const VIEWPORTS: Array<[string, number, number]> = [
  ["phone portrait, small", 320, 568],
  ["phone portrait", 390, 844],
  ["tablet portrait", 768, 1024],
  ["tablet landscape", 1024, 768],
  ["phone landscape", 844, 390],
];

function insetsFor(w: number, h: number): Array<[string, Insets]> {
  return [
    ["no insets", NO_INSETS],
    w > h ? ["cutout at the side", LANDSCAPE] : ["cutout at the top", PORTRAIT],
  ];
}

/** The vent shrinks as a child dives. `arenaFloor` is as small as it ever gets. */
const ARENA_RADII = [1, 0.85, TUNE.arenaFloor];

/**
 * A frame the game can actually be in.
 *
 * `safe` and `scale` are computed the way `scene.ts: resize` computes them, and
 * everything downstream of that — the ideal size, the budget, the block — comes
 * from `prompt.ts` itself via `fit()`. Nothing here re-derives a number the
 * shipping code owns, which is the difference between a test of the renderer and
 * a test of a copy of the renderer.
 */
type Frame = {
  where: string;
  safe: { x: number; y: number; w: number; h: number };
  scale: number;
  arenaR: number;
  arenaPx: number;
  ideal: number;
};

function frames(): Frame[] {
  const out: Frame[] = [];
  for (const [name, w, h] of VIEWPORTS) {
    for (const [label, insets] of insetsFor(w, h)) {
      const safe = safeRect(w, h, insets);
      // `scene.ts: resize` — the arena is centred in the safe box and sized off
      // its short side.
      const scale = Math.min(safe.w, safe.h) * 0.44;
      for (const arenaR of ARENA_RADII) {
        out.push({
          where: `${name} (${w}x${h}), ${label}, vent ${(arenaR * scale * 2).toFixed(0)}px across`,
          safe,
          scale,
          arenaR,
          arenaPx: arenaR * scale,
          ideal: promptIdeal(scale),
        });
      }
    }
  }
  return out;
}

/** The shipping path, for one condition in one frame. */
const fit = (f: Frame, text: string, measure: MeasureLine) =>
  promptFit(text, f.safe, f.scale, f.arenaR, measure);

/* -------------------------------------------------------------------------- */
/* What the host can actually send.                                           */
/* -------------------------------------------------------------------------- */

/**
 * The widest condition per shape the host can put on the water, measured.
 *
 * Rows 1-3 are the **shipped** ladder. Rows 4-6 arrive with PR #720. Row 7 is not
 * on any ladder and is here as headroom — an 18-character statement, half again
 * the longest thing the curriculum can currently draw.
 */
const WIDEST: Array<[string, string]> = [
  ["dw.mul.scale.times-power-of-ten L2 (active today)", "42739 × 10000"],
  ["dw.mul.multidigit.long-multiplication L2 (active today)", "41299 × 55313"],
  ["dw.add.regroup.subtract-short-subtrahend L2 (active today)", "927732 − 788"],
  ["dw.div.whole.divide-exact L3 (active today)", "132594 ÷ 66"],
  ["dw.alg.equality.missing-addend L2 (#720)", "946 + □ = 1142"],
  ["dw.alg.equality.missing-subtrahend L2 (#720, draft)", "1438 − □ = 947"],
  ["dw.alg.equality.missing-factor L1 (#720, draft)", "□ × 30 = 1680"],
  ["headroom: an 18-character statement no row serves yet", "12345 + □ = 67890"],
];

/** What this pack's own stub host serves, so the dev harness is covered too. */
const STUB: string[] = ["= 12", "6 × ?", "> 3/4", "< 17/20", "= −8"];

/* -------------------------------------------------------------------------- */
/* 1. The defect, on the record.                                              */
/* -------------------------------------------------------------------------- */

test("the unmeasured size overran the vent — this is what was shipping", () => {
  // Not a test of the fix. A test of the claim the fix is answering, so that the
  // number is in the tree rather than in a PR description.
  const measure = measurer(ROUNDED);
  const worst: string[] = [];
  for (const f of frames()) {
    const b = promptBudget(f.safe, f.arenaPx);
    for (const [, text] of WIDEST) {
      const ink = measure(text, f.ideal);
      if (!fitsBudget(ink.w, ink.h, b)) {
        worst.push(
          `${f.where}: "${text}" at the unmeasured ${f.ideal.toFixed(0)}px is ` +
            `${ink.w.toFixed(0)}x${ink.h.toFixed(0)}px of ink and the vent holds ` +
            `${(b.radius * 2).toFixed(0)}px`,
        );
      }
    }
  }
  assert.ok(
    worst.length > 0,
    "the unmeasured size fits everywhere, so there was nothing to fix — check WIDEST",
  );
  // The tightest viewport must be among the failures, and by a wide margin: at
  // 320px the unmeasured condition is more than twice the vent.
  const small = frames().filter((f) => f.safe.w === 320);
  for (const f of small) {
    const ink = measure("946 + □ = 1142", f.ideal);
    const b = promptBudget(f.safe, f.arenaPx);
    assert.ok(
      ink.w > b.radius * 2 * 2,
      `${f.where}: the unmeasured condition is only ${(ink.w / (b.radius * 2)).toFixed(2)}x the vent`,
    );
  }
});

/* -------------------------------------------------------------------------- */
/* 2. The gate.                                                               */
/* -------------------------------------------------------------------------- */

test("every condition the host can send is drawn inside the vent", () => {
  for (const face of FACES) {
    const measure = measurer(face);
    for (const f of frames()) {
      const b = promptBudget(f.safe, f.arenaPx);
      for (const [row, text] of [...WIDEST, ...STUB.map((s) => ["the stub host", s] as [string, string])]) {
        const block = fit(f, text, measure);
        assert.ok(
          fitsBudget(block.w, block.h, b),
          `${face.name}, ${f.where}: ${row} — "${text}" is drawn ` +
            `${block.size.toFixed(0)}px on ${block.lines.length} line(s), ` +
            `${block.w.toFixed(0)}x${block.h.toFixed(0)}px of ink, and the vent holds ` +
            `${(b.radius * 2).toFixed(0)}px`,
        );
        assert.ok(block.lines.length <= MAX_PROMPT_LINES, `${text} broke into ${block.lines.length} lines`);
      }
    }
  }
});

/**
 * The floor, as a literal.
 *
 * NOT `MIN_PROMPT_PX`. Asserting a module against its own constant is a test that
 * passes whatever the constant becomes: set `MIN_PROMPT_PX = 1` and a floor test
 * written that way still goes green while a 14px condition ships. 19 is the repo
 * legibility audit's number for a prompt, so the audit's number is what is written
 * here, and moving the constant has to be a deliberate edit in two places.
 */
const AUDIT_PROMPT_FLOOR_PX = 19;

test("the module's floor is still the audit's floor", () => {
  assert.equal(MIN_PROMPT_PX, AUDIT_PROMPT_FLOOR_PX);
});

test("nothing is ever drawn below the legibility floor", () => {
  // Shrinking past a floor is not fitting, it is hiding: a sibling pack shipped a
  // 15.1px answer under a bloom and the founder filed it as illegible.
  for (const face of FACES) {
    const measure = measurer(face);
    for (const f of frames()) {
      for (const [row, text] of WIDEST) {
        const block = fit(f, text, measure);
        assert.ok(
          block.size >= AUDIT_PROMPT_FLOOR_PX,
          `${face.name}, ${f.where}: ${row} — "${text}" is drawn at ` +
            `${block.size.toFixed(1)}px, under the ${AUDIT_PROMPT_FLOOR_PX}px floor`,
        );
      }
    }
  }
});

test("every condition on the shipped ladder and in #720 reaches the floor honestly", () => {
  // `fits: false` means the block was drawn AT the floor and did not get there
  // legitimately. No row the host can serve may be in that state, on any face.
  for (const face of FACES) {
    const measure = measurer(face);
    for (const f of frames()) {
      const b = promptBudget(f.safe, f.arenaPx);
      for (const [row, text] of WIDEST) {
        const block = fit(f, text, measure);
        assert.equal(
          block.fits,
          true,
          `${face.name}, ${f.where}: ${row} — "${text}" cannot be drawn at the ` +
            `${MIN_PROMPT_PX}px floor at all; it needs ` +
            `${block.w.toFixed(0)}x${block.h.toFixed(0)}px and the vent holds ` +
            `${(b.radius * 2).toFixed(0)}px`,
        );
      }
    }
  }
});

/* -------------------------------------------------------------------------- */
/* 3. That the fit is in the build, and is a fit rather than a shrink.        */
/* -------------------------------------------------------------------------- */

test("on the tightest viewport the widest condition is measured DOWN and broken", () => {
  // The assertion a no-op fix cannot pass. If `layoutPrompt` ever returns `ideal`
  // unmeasured, or stops breaking, this trips before anything reaches a device.
  const measure = measurer(ROUNDED);
  const f = frames().find((x) => x.safe.w === 320 && x.arenaPx === TUNE.arenaFloor * x.scale);
  assert.ok(f, "no 320px frame at the vent floor — the frame table changed");
  const block = fit(f, "946 + □ = 1142", measure);
  assert.ok(
    block.size < Math.floor(f.ideal),
    `the condition was drawn at the ideal ${f.ideal.toFixed(0)}px unmeasured`,
  );
  assert.ok(block.lines.length >= 2, "a fourteen-character statement was left on one line");
  assert.deepEqual([...block.lines], ["946 + □", "= 1142"], "the break is not at the relation");
});

test("a condition with room is drawn exactly as it always was", () => {
  // The fit must be a no-op where nothing was wrong, or it is a redesign rather
  // than a repair. A tablet at the surface has room for the stub's conditions at
  // the full ideal size, on one line.
  const measure = measurer(ROUNDED);
  const f = frames().find((x) => x.safe.w === 768 && x.arenaPx === x.scale);
  assert.ok(f, "no tablet-portrait frame at the surface");
  for (const text of ["= 12", "6 × ?", "> 3/4"]) {
    const block = fit(f, text, measure);
    assert.equal(block.lines.length, 1, `"${text}" was broken on a screen with room for it`);
    assert.equal(block.size, Math.floor(f.ideal), `"${text}" was shrunk on a screen with room for it`);
    assert.deepEqual([...block.offsets], [0], `"${text}" was offset off centre`);
  }
});

/* -------------------------------------------------------------------------- */
/* 4. How it breaks.                                                          */
/* -------------------------------------------------------------------------- */

test("a line never ends on an operator or a relation", () => {
  const trailing = ["+", "−", "×", "÷", "=", "<", ">", "-", "≤", "≥"];
  for (const [, text] of [...WIDEST, ...STUB.map((s) => ["", s] as [string, string])]) {
    for (const lines of breakings(text)) {
      for (const line of lines) {
        assert.ok(line.length > 0, `"${text}" produced an empty line`);
        const last = line.slice(-1);
        assert.ok(
          !trailing.includes(last),
          `"${text}" broke to [${lines.join(" / ")}] — a line ends on "${last}"`,
        );
      }
    }
  }
});

test("a break never splits a number", () => {
  for (const [, text] of WIDEST) {
    const want = text.split(/\s+/).filter((t) => t.length > 0).join(" ");
    for (const lines of breakings(text)) {
      assert.equal(lines.join(" "), want, `"${text}" lost or moved a token: [${lines.join(" / ")}]`);
    }
  }
});

test("a condition with no break point is left alone", () => {
  assert.deepEqual([...breakings("1234")], [["1234"]]);
  assert.deepEqual([...breakings("")], [[""]]);
});

/* -------------------------------------------------------------------------- */
/* 5. The premises the fit rests on.                                          */
/* -------------------------------------------------------------------------- */

test("ink width is monotone in size, which is what the binary search assumes", () => {
  for (const face of FACES) {
    const measure = measurer(face);
    for (const [, text] of [...WIDEST, ...STUB.map((s) => ["", s] as [string, string])]) {
      let last = -1;
      for (let size = MIN_PROMPT_PX; size <= 220; size++) {
        const w = measure(text, size).w;
        assert.ok(w >= last, `${face.name}: "${text}" got narrower from ${size - 1}px to ${size}px`);
        last = w;
      }
    }
  }
});

test("the pop-in never exceeds the headroom the budget reserved", () => {
  // `PROMPT_PEAK_SCALE` is what `promptBudget` divides by. `easeOutBack`
  // overshoots, so the largest the condition is ever drawn is NOT the size it was
  // fitted at, and this is the test that keeps that number honest if the
  // animation is ever retuned.
  let peak = 0;
  for (let promptT = 0; promptT <= 1.0001; promptT += 0.002) {
    for (let camT = 0; camT < 7.1; camT += 0.01) {
      peak = Math.max(peak, promptDrawScale(promptT, camT).core);
    }
  }
  assert.ok(
    peak <= PROMPT_PEAK_SCALE,
    `the condition is drawn at up to ${peak.toFixed(4)}x and the budget reserved ${PROMPT_PEAK_SCALE}x`,
  );
  // And not wastefully loose, or the reserve is quietly shrinking the type.
  assert.ok(peak > PROMPT_PEAK_SCALE - 0.02, `the reserve is ${PROMPT_PEAK_SCALE} for a peak of ${peak.toFixed(4)}`);
  // The halo is deliberately outside the fit. It is the same glyphs at a tenth of
  // the alpha and it is allowed to bleed over the rim; the core is not.
  const at = promptDrawScale(1, 0);
  assert.ok(at.halo > at.core, "the halo is no longer the outer pass");
});

test("the drawn condition, animation included, still clears the vent", () => {
  // The end-to-end statement: fitted size times the largest scale the animation
  // reaches, against the vent as it really is — `ARENA_USE` and the peak reserve
  // both removed from the budget, so nothing in the chain is measuring itself.
  const measure = measurer(ROUNDED);
  let peak = 0;
  for (let t = 0; t <= 1.0001; t += 0.005) peak = Math.max(peak, promptDrawScale(t, 0.9).core);
  for (const f of frames()) {
    for (const [row, text] of WIDEST) {
      const block = fit(f, text, measure);
      const w = block.w * peak;
      const h = block.h * peak;
      assert.ok(
        (w / 2) ** 2 + (h / 2) ** 2 <= f.arenaPx ** 2,
        `${f.where}: ${row} — at the peak of the pop-in "${text}" is ` +
          `${w.toFixed(0)}x${h.toFixed(0)}px and the vent is ${(f.arenaPx * 2).toFixed(0)}px across`,
      );
      assert.ok(w <= f.safe.w && h <= f.safe.h, `${f.where}: ${row} — "${text}" leaves the safe box`);
    }
  }
});

test("a condition that cannot reach the floor is drawn and says so", () => {
  // Only reachable on a surface no device has, which is exactly when nobody is
  // watching. It must not be a blank arena and it must not be silent.
  const measure = measurer(PESSIMIST);
  const block = promptFit("12345 + □ = 67890", { x: 0, y: 0, w: 60, h: 60 }, 55, 1, measure);
  assert.equal(block.fits, false, "an impossible condition reported that it fitted");
  assert.equal(block.size, MIN_PROMPT_PX, "an impossible condition was shrunk below the floor anyway");
  assert.ok(block.lines.length > 1, "an impossible condition was not broken as far as it goes");
  assert.equal(block.lines.join(" "), "12345 + □ = 67890", "an impossible condition lost a token");
});

test("the block is centred: the line offsets sum to zero", () => {
  const measure = measurer(ROUNDED);
  for (const f of frames()) {
    for (const [, text] of WIDEST) {
      const block = fit(f, text, measure);
      const sum = block.offsets.reduce((a, o) => a + o, 0);
      assert.ok(Math.abs(sum) < 1e-9, `"${text}" offsets sum to ${sum}`);
      assert.equal(block.offsets.length, block.lines.length);
    }
  }
});

/* -------------------------------------------------------------------------- */
/* 6. The renderer really goes through the fit.                               */
/* -------------------------------------------------------------------------- */

test("scene.ts writes the condition through the fit and by no other route", () => {
  // Everything above tests `prompt.ts`. This is the one assertion that the
  // RENDERER uses it — the gap a module-only suite leaves is a perfect fit sitting
  // beside a `drawLabel` call that ignores it, which is what shipped.
  //
  // Source-level because `createRenderer` needs a canvas and there is none in
  // Node. It is two facts, both cheap to keep true: the fit is called, and the
  // expression it replaced is gone.
  const scene = readFileSync(join(dirname(new URL(import.meta.url).pathname), "scene.ts"), "utf8");
  assert.ok(scene.includes("promptFit("), "scene.ts no longer calls promptFit — the fit is not in the build");
  assert.ok(
    scene.includes("drawPromptBlock(block"),
    "scene.ts no longer draws the fitted block; a fit nothing draws is not a fix",
  );
  assert.ok(
    !scene.includes("view.scale * 0.52"),
    "scene.ts computes the prompt size itself again — that expression is `promptIdeal` now, " +
      "and a second copy of it is how the renderer and this test part company",
  );
  // The condition is written INSIDE the vent's clip, which is the whole reason the
  // budget is a circle. If the clip goes, the budget is measuring the wrong shape.
  assert.ok(scene.includes("g.clip()"), "the arena clip is gone — see the header of prompt.ts");
});

/* -------------------------------------------------------------------------- */
/* 7. The safe area is measured, never read from CSS.                         */
/* -------------------------------------------------------------------------- */

/**
 * Lines that would actually *use* `env(safe-area-inset-*)`, as opposed to the ones
 * that explain why nothing may.
 *
 * `chrome.ts` and `chrome.test.ts` both name the token in prose and must stay able
 * to, so a plain substring sweep over the tree is not the check — it is a check
 * that fails on its own documentation, which is the shape of guard that gets
 * deleted rather than obeyed. A comment line is skipped; anything else is not.
 *
 * Exported to the two control tests below rather than inlined, because a
 * rule-walker nobody exercised is how a guard passes green over the very
 * regression it stands for.
 */
function envInsetUses(source: string): string[] {
  const out: string[] = [];
  let inBlockComment = false;
  for (const raw of source.split("\n")) {
    const line = raw.trim();
    const opened = line.includes("/*");
    const closed = line.includes("*/");
    const commented =
      inBlockComment || line.startsWith("//") || line.startsWith("*") || (opened && !closed);
    if (opened && !closed) inBlockComment = true;
    if (closed) inBlockComment = false;
    if (commented) continue;
    if (line.includes("env(safe-area-inset")) out.push(line);
  }
  return out;
}

test("the safe-area guard catches a real use and ignores the prose about it", () => {
  // The positive control. Without this the guard below could be walking nothing.
  assert.deepEqual(envInsetUses("#app { padding-top: env(safe-area-inset-top); }"), [
    "#app { padding-top: env(safe-area-inset-top); }",
  ]);
  assert.deepEqual(envInsetUses('el.style.top = "env(safe-area-inset-top)"'), [
    'el.style.top = "env(safe-area-inset-top)"',
  ]);
  // The negative control: the three comment shapes this tree actually uses.
  assert.deepEqual(envInsetUses(" * `env(safe-area-inset-*)` is zero inside a pack"), []);
  assert.deepEqual(envInsetUses("// env(safe-area-inset-top) is zero here"), []);
  assert.deepEqual(
    envInsetUses("/* a block\n   env(safe-area-inset-top) never works\n*/\n#app { inset: 0 }"),
    [],
  );
  // And a use on the line AFTER a block comment closes is still caught.
  assert.deepEqual(envInsetUses("/* why not */\n#app { top: env(safe-area-inset-top) }"), [
    "#app { top: env(safe-area-inset-top) }",
  ]);
});

test("nothing in this pack uses env(safe-area-inset", () => {
  // `env(safe-area-inset-*)` is ZERO inside a pack: the insets belong to the
  // top-level browsing context and this document is framed. Four packs in this
  // fleet have shipped that bug. `runner`'s fix was to delete every positional CSS
  // declaration and let the test fail the build if the token reappears — the
  // insets come from `safeInsets()` in `packs/shared/game-chrome`, which measures.
  const root = join(dirname(new URL(import.meta.url).pathname), "..", "..", "..");
  const offenders: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".") || entry.name.startsWith("dist")) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (!/\.(html|css|ts|tsx)$/.test(entry.name)) continue;
      if (entry.name === "prompt.test.ts") continue;
      for (const line of envInsetUses(readFileSync(path, "utf8"))) offenders.push(`${path}: ${line}`);
    }
  };
  walk(root);
  assert.ok(offenders.length === 0, `env(safe-area-inset is zero inside a pack:\n${offenders.join("\n")}`);
});
