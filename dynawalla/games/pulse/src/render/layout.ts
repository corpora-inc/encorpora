/**
 * Playfield geometry — the conceit of the whole game.
 *
 * The distance from the strike line to the far edge is **exactly one bar**. Not "a
 * comfortable scroll speed": one bar. So the field is a fraction bar you can see:
 * a thing halfway across is at 1/2, and it arrives halfway through the measure.
 * Position, value and moment are the same fact, which is why answering `1/2 + 1/4`
 * here is a rhythmic act rather than a quiz.
 *
 * Coordinates: `u` runs along time (0 = strike line, 1 = one bar ahead, negative =
 * already played); `v` runs across lanes, 0..1. Landscape scrolls right-to-left like
 * a drum score; portrait falls top-to-bottom like every phone rhythm game since
 * Cytus, and it is the same code with the axes swapped.
 *
 * **The frame is not ours alone.** `pack.html` declares `viewport-fit=cover`, which
 * opts this document into the notch, the home indicator and the rounded corners; and
 * the host floats an exit control over the top-left corner and a how-to-play control
 * over the top-right, 44px each. Everything below lays out inside `area` — the safe
 * rectangle — and below those two corners. The BACKGROUND still bleeds to every
 * edge, because that is what `cover` is for; it is the notes, the question and the
 * numbers that move.
 */

import {
  HOST_CONTROL,
  HOST_MARGIN,
  HOST_PROGRESS_H,
  type Rect,
} from "../../../../packs/shared/game-chrome/index.ts";

export type Orientation = "h" | "v";

/**
 * How far below the top of the safe rect the host's two corner squares reach.
 * Read from the shared constants so the host can move its chrome and every game
 * follows on the next build.
 */
const CHROME_BAND = HOST_PROGRESS_H + HOST_MARGIN + HOST_CONTROL;
const CHROME_GAP = 6;

/** A middle-baselined line of text of `size` px occupies about this much height. */
const LINE_H = 1.24;
/** A stacked fraction reaches ±1.18·size from its centre: numerator plus its own body. */
const STACK_H = 2.36;
/** The multiplier punches up to 1.3× when it changes; reserve for the punched size. */
const MULT_PUNCH = 1.3;
/** The combo count punches up to 1.28× on a hit. Same reasoning. */
const COMBO_PUNCH = 1.28;

const UMAX = 1.06;

/**
 * The smallest a gate candidate's number may ever be drawn, in CSS px.
 *
 * It used to be derived from the note: `gateR * 0.62 * 0.84`, which on a 390 px
 * phone is **15.1 px** for a stacked fraction and 17.9 px for a plain numeral —
 * drawn additively, mid-scroll, over a bloom halo a third of the glyph's own
 * size. The founder's report is exact: "Cant see the answers ... too blurry".
 *
 * So the dependency is inverted. The number gets a floor a child can read on a
 * moving bus, and the ring is sized to hold it. 22 px is the smallest numeral
 * that survives the phosphor bloom this game is made of; below that the halo is
 * wider than the strokes and a 3 reads as an 8.
 */
export const GATE_LABEL_MIN = 22;
/** …and a ceiling, so a tablet does not hand a child a dinner plate. */
export const GATE_LABEL_MAX = 40;

/**
 * A stacked fraction reaches ±1.18·size vertically, so a ring of 1.4·size in
 * radius holds one with a little air. Plain numerals are shrunk to fit the same
 * ring by the renderer, which measures them.
 */
const GATE_RING_PER_LABEL = 1.4;

/** The type size of a gate candidate's number at this viewport. */
export function gateLabelSizeFor(w: number, h: number): number {
  const short = Math.min(w, h);
  return Math.max(GATE_LABEL_MIN, Math.min(GATE_LABEL_MAX, short * 0.068));
}

/** A left/right/centre anchored line of text: `x` is the anchored edge. */
export type Anchor = { x: number; cy: number; size: number };

/** Where every readable thing in the HUD sits, already clear of the host's corners. */
export type Hud = {
  pad: number;
  /** Score, left-aligned. */
  score: Anchor;
  /** Multiplier, right-aligned: `x` is its RIGHT edge. */
  mult: Anchor & { boxH: number };
  health: Rect;
  /** The stage strip and the note-value glyph chain that trails it. */
  stage: Anchor & { glyphSize: number; rowH: number };
  /** The gate question, centred. */
  prompt: { cx: number; cy: number; size: number };
  /** The combo count. */
  combo: { cx: number; cy: number; size: number };
};

export type Layout = {
  orient: Orientation;
  w: number;
  h: number;
  laneCount: number;
  /** Screen pixels for one bar. */
  runLen: number;
  /** Lane pitch in pixels across the field. */
  lanePitch: number;
  fieldThickness: number;
  compact: boolean;
  /** The safe rectangle this layout was built inside. */
  area: Rect;
  /** Drawn radius of an ordinary note, and of a gate note (which carries a label). */
  noteR: number;
  gateR: number;
  /**
   * Type size of the number a gate candidate carries. THE most important
   * readable in the game — it is the answer — so it is a first-class layout
   * value with a floor, and `gateR` is derived from it rather than the reverse.
   */
  gateLabelSize: number;
  hud: Hud;
  pt(u: number, v: number, out?: { x: number; y: number }): { x: number; y: number };
  laneV(lane: number): number;
  /** Unit vector along +u, in screen space. */
  along: { x: number; y: number };
  /** Unit vector along +v, in screen space. */
  across: { x: number; y: number };
  /** Where the strike line meets v=0 and v=1. */
  strikeA: { x: number; y: number };
  strikeB: { x: number; y: number };
  /** u beyond which a note is off-screen and can be dropped. */
  uMax: number;
  uMin: number;
};

/**
 * `area` is the region a child may be asked to read or touch: the safe rect from
 * `packs/shared/game-chrome`, free of the notch and the home indicator.
 *
 * It is REQUIRED, deliberately. Made optional, a caller that forgets it compiles
 * and quietly draws the question under the notch and the top of the note run
 * under the host's exit button — and the only way to find out is on a notched
 * device, which is not where this is tested.
 */
export function computeLayout(w: number, h: number, laneCount: number, area: Rect): Layout {
  const orient: Orientation = w >= h * 1.02 ? "h" : "v";
  const compact = Math.min(w, h) < 460;
  const lanes = Math.max(1, laneCount);

  const pad = compact ? 14 : 26;
  const big = compact ? 26 : 38;
  const gap = compact ? 8 : 12;
  const stageSize = compact ? 10 : 12;
  const glyphSize = compact ? 9 : 11;
  const healthW = compact ? 110 : 168;
  const healthH = compact ? 5 : 7;
  const comboSize = compact ? 30 : 46;
  const promptSize = compact ? 26 : Math.min(46, w * 0.05);

  // The top row starts below the host's two corners, not below the top of the
  // canvas. Pushing a HUD row down costs nothing: the chrome OVERLAYS the game,
  // so this takes no playfield away — it only stops the score being printed
  // underneath the exit button.
  const hudTop = area.y + CHROME_BAND + CHROME_GAP;
  const rowH = big * MULT_PUNCH * LINE_H;
  const rowCy = hudTop + rowH / 2;
  const stageRowH = Math.max(stageSize * LINE_H, glyphSize * STACK_H);
  const promptH = promptSize * STACK_H;
  const promptCy = hudTop + promptH / 2;
  const promptBottom = hudTop + promptH;

  const score: Anchor = { x: area.x + pad, cy: rowCy, size: big };
  const mult = { x: area.x + area.w - pad, cy: rowCy, size: big * 0.8, boxH: rowH };

  if (orient === "h") {
    // Landscape: the HUD column stands BESIDE the field, left of the strike
    // line, so it stacks the way it always has — score, health, stage — and the
    // field band starts below both it and the question.
    const healthY = rowCy + rowH / 2 + gap;
    const stageCy = healthY + healthH + gap + stageRowH / 2;
    const hudBottom = stageCy + stageRowH / 2;
    const reservedTop = Math.max(hudBottom, promptBottom) + CHROME_GAP;
    const bottomPad = compact ? 12 : 16;

    const room = area.y + area.h - bottomPad - reservedTop;
    const fieldThickness = Math.min(
      Math.min(area.h * 0.56, Math.max(196, 128 * lanes + 40)),
      Math.max(132, room),
    );
    const centred = area.y + area.h * 0.5 - fieldThickness / 2 + area.h * 0.02;
    const top = Math.max(
      reservedTop,
      Math.min(centred, area.y + area.h - bottomPad - fieldThickness),
    );
    const lanePitch = fieldThickness / lanes;
    const noteR = Math.min(lanePitch * 0.3, compact ? 17 : 24);
    const gateLabelSize = Math.min(
      gateLabelSizeFor(w, h),
      // Never taller than the field it rides in, whatever the viewport says.
      (fieldThickness * 0.46) / GATE_RING_PER_LABEL,
    );
    const gateR = gateLabelSize * GATE_RING_PER_LABEL;
    const strikeX = area.x + Math.max(72, Math.min(160, area.w * 0.19));
    // The trailing margin is at least a gate note's radius, so a note one whole
    // bar out is drawn complete rather than clipped by the safe edge.
    const runLen = area.x + area.w - strikeX - Math.max(gateR + 2, area.w * 0.02);

    return {
      orient,
      w,
      h,
      laneCount,
      runLen,
      lanePitch,
      fieldThickness,
      compact,
      area,
      noteR,
      gateR,
      gateLabelSize,
      hud: {
        pad,
        score,
        mult,
        health: { x: area.x + pad, y: healthY, w: healthW, h: healthH },
        stage: { x: area.x + pad, cy: stageCy, size: stageSize, glyphSize, rowH: stageRowH },
        prompt: { cx: area.x + area.w / 2, cy: promptCy, size: promptSize },
        combo: {
          cx: strikeX + runLen * 0.02,
          cy: Math.max(top - fieldThickness * 0.22, hudTop + (comboSize * COMBO_PUNCH * LINE_H) / 2),
          size: comboSize,
        },
      },
      pt(u, v, out) {
        const o = out ?? { x: 0, y: 0 };
        o.x = strikeX + u * runLen;
        o.y = top + v * fieldThickness;
        return o;
      },
      laneV: (lane) => (lane + 0.5) / lanes,
      along: { x: 1, y: 0 },
      across: { x: 0, y: 1 },
      strikeA: { x: strikeX, y: top },
      strikeB: { x: strikeX, y: top + fieldThickness },
      uMax: UMAX,
      uMin: -strikeX / runLen - 0.06,
    };
  }

  // Portrait: the field is nearly the full width, so a stacked HUD column at the
  // top-left would sit ON the lanes and, at 320px, collide with the question. So
  // the top carries only the score and the multiplier — the question centred
  // between them — and the health bar and the stage strip move to the dead strip
  // below the strike line, which nothing else uses.
  const fieldThickness = Math.min(area.w * 0.94, Math.max(190, 132 * lanes + 30));
  const left = area.x + (area.w - fieldThickness) / 2;
  const strikeY = area.y + area.h * 0.775;
  const lanePitch = fieldThickness / lanes;
  const noteR = Math.min(lanePitch * 0.3, compact ? 17 : 24);
  const gateLabelSize = Math.min(
    gateLabelSizeFor(w, h),
    (fieldThickness * 0.46) / GATE_RING_PER_LABEL,
  );
  const gateR = gateLabelSize * GATE_RING_PER_LABEL;
  // A note at uMax is the first frame a child could read it. Its own radius has
  // to clear the question above it, which in turn clears the host's corners.
  const runTop = promptBottom + gateR + CHROME_GAP;
  const runLen = Math.max(60, (strikeY - runTop) / UMAX);

  const bottomH = healthH + gap + stageRowH;
  const blockTop = area.y + area.h - pad - bottomH;

  return {
    orient,
    w,
    h,
    laneCount,
    runLen,
    lanePitch,
    fieldThickness,
    compact,
    area,
    noteR,
    gateR,
    gateLabelSize,
    hud: {
      pad,
      score,
      mult,
      health: { x: area.x + pad, y: blockTop, w: healthW, h: healthH },
      stage: {
        x: area.x + pad,
        cy: blockTop + healthH + gap + stageRowH / 2,
        size: stageSize,
        glyphSize,
        rowH: stageRowH,
      },
      prompt: { cx: area.x + area.w / 2, cy: promptCy, size: promptSize },
      combo: { cx: left + fieldThickness / 2, cy: strikeY + comboSize * 0.9, size: comboSize },
    },
    pt(u, v, out) {
      const o = out ?? { x: 0, y: 0 };
      o.x = left + v * fieldThickness;
      o.y = strikeY - u * runLen;
      return o;
    },
    laneV: (lane) => (lane + 0.5) / lanes,
    along: { x: 0, y: -1 },
    across: { x: 1, y: 0 },
    strikeA: { x: left, y: strikeY },
    strikeB: { x: left + fieldThickness, y: strikeY },
    uMax: UMAX,
    uMin: -(h - strikeY) / runLen - 0.06,
  };
}

/** Which lane a pointer at screen (x,y) belongs to. */
export function laneAtPoint(l: Layout, x: number, y: number): number {
  if (l.orient === "h") {
    const v = (y - l.strikeA.y) / l.fieldThickness;
    return Math.max(0, Math.min(l.laneCount - 1, Math.floor(v * l.laneCount)));
  }
  const v = (x - l.strikeA.x) / l.fieldThickness;
  return Math.max(0, Math.min(l.laneCount - 1, Math.floor(v * l.laneCount)));
}

// --------------------------------------------------------------------- boxes
//
// The renderer draws FROM these rectangles and the tests assert ON them. That is
// the point of them existing at all: a clearance test that rebuilds the HUD's
// arithmetic out of its own magic numbers goes on passing while the renderer
// drifts away underneath it.

/** The box a line of text of `size` occupies, anchored at `x` by `align`. */
export function textRect(
  x: number,
  cy: number,
  width: number,
  size: number,
  align: "left" | "right" | "centre",
): Rect {
  const h = size * LINE_H;
  const rx = align === "left" ? x : align === "right" ? x - width : x - width / 2;
  return { x: rx, y: cy - h / 2, w: width, h };
}

export function scoreBox(l: Layout, textW: number): Rect {
  return textRect(l.hud.score.x, l.hud.score.cy, textW, l.hud.score.size, "left");
}

/**
 * Reserved at the PUNCHED size: the multiplier grows when it changes, and it
 * grows right next to the host's help button.
 */
export function multBox(l: Layout, textW: number): Rect {
  const m = l.hud.mult;
  const width = textW * MULT_PUNCH;
  return { x: m.x - width, y: m.cy - m.boxH / 2, w: width, h: m.boxH };
}

export function healthBox(l: Layout): Rect {
  return { ...l.hud.health };
}

/** `textW` covers the strip AND the glyph chain that trails it. */
export function stageBox(l: Layout, textW: number): Rect {
  const s = l.hud.stage;
  return { x: s.x, y: s.cy - s.rowH / 2, w: textW, h: s.rowH };
}

export function promptBox(l: Layout, textW: number): Rect {
  const p = l.hud.prompt;
  const height = p.size * STACK_H;
  return { x: p.cx - textW / 2, y: p.cy - height / 2, w: textW, h: height };
}

/** Also reserved punched: the combo swells on every hit, which is most frames. */
export function comboBox(l: Layout, textW: number): Rect {
  const c = l.hud.combo;
  return textRect(c.cx, c.cy, textW * COMBO_PUNCH, c.size * COMBO_PUNCH, "centre");
}

// ------------------------------------------------------------------ the gate
//
// `GateFit` in `game/gate.ts` documents `minGapDenom` as "a *display*
// constraint, not a mathematical one, so it is passed in rather than fixed: a
// 1372 px landscape bar can hold four orbs a twelfth apart, and a 544 px phone
// bar cannot". It was then passed in as the constant 12 from one call site and
// never varied. So the constraint said "a twelfth" on every viewport, and a
// twelfth of a 390 px phone's bar is 34.0 px between two candidates that are
// 57.8 px across: they OVERLAPPED, by 24 px, in ordinary play — and the
// measured minimum gap over 5000 real gates was exactly 1/12, so the bad case
// was the normal case. At 320 px they overlapped by 36 px of a 58 px orb.
//
// A gap is a number of pixels. Turning it back into a fraction of the bar is
// this function's whole job, and it is the only place that knows both numbers.

/** Clear air between two candidate rings, as a fraction of one ring's diameter. */
const GATE_BREATH = 1.18;

/**
 * How far apart candidates must sit and how many of them fit, at THIS viewport.
 *
 * The caller ANDs this with whatever the stage allows: the fit says what the
 * screen can hold, the stage says what the child should be asked for.
 */
export function gateFitFor(l: Layout): { maxCandidates: number; minGapDenom: number } {
  const needPx = l.gateR * 2 * GATE_BREATH;
  // The largest number of equal parts the bar divides into where one part is
  // still wider than a candidate needs. Never below 2 — the bar has to hold at
  // least the answer and one wrong turning.
  const denom = Math.max(2, Math.floor(l.runLen / needPx));
  // The flat fallback in `buildGate` spaces n candidates at 1/(n+1) of the bar,
  // so it obeys the same gap only while n + 1 <= denom. Capped at 4, which is
  // as many numbers as a child reads while a bar goes past.
  return { maxCandidates: Math.max(2, Math.min(4, denom - 1)), minGapDenom: denom };
}

/** The box a note occupies on screen. Gate notes are drawn larger and carry a label. */
export function noteBox(l: Layout, u: number, lane: number, gate = false): Rect {
  const p = l.pt(u, l.laneV(lane));
  const r = gate ? l.gateR : l.noteR;
  return { x: p.x - r, y: p.y - r, w: r * 2, h: r * 2 };
}
