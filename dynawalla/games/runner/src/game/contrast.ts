/**
 * Which colours VOLTA is allowed to write text in.
 *
 * ── the defect this exists to make impossible ────────────────────────────────
 *
 * The recharge gate — the one screen in the game that is *only* a question, and
 * the screen a child is looking at when they decide whether to keep playing —
 * shipped with unreadable numerals. Three separate fixed colours, each of which
 * happened to work in the biome it was authored in:
 *
 *   1. The whole HUD's ink was `biome.inverted ? "#12121a" : "#eaf6ff"`, chosen
 *      from the *sky*. The veils do not sit on the sky; they paint their own
 *      dark scrim over it. In THE BLEACH the sky is bone, so `inverted` is true,
 *      so the ink went to near-black — and the recharge veil's lower band is
 *      `rgba(3,7,18,0.88)` over that bone, which composites to rgb(33,36,45).
 *      Near-black numerals on a near-black panel: **1.19:1**. That is the
 *      founder's screenshot, and it is not a subtle miss — 4.5:1 is the bar.
 *
 *   2. `.vt-lane.vt-right span` was a fixed `#04060f` on a fill of the live
 *      accent. Accents are hue-rotated 0.14 turns per lap, for ever, and hue
 *      moves relative luminance enormously at constant HSL lightness. AURORA
 *      SHELF II's accent lands on royal blue `#3744ff`, where black text is
 *      **3.43:1**. Nobody authored that colour; the rotation produced it.
 *
 *   3. The voltage readout took the sky's ink too, and it sits on the *deck* —
 *      which is near-black in all four biomes, including the one whose sky is
 *      bone. In THE BLEACH the bar's fill was `#12121a` on `#0b0b0d`.
 *
 * The common shape is a colour picked from something other than the thing the
 * text actually lands on. So nothing here is authored: every ink below is
 * *derived* from the composited background of the specific surface, and
 * `contrast.test.ts` walks every biome the generator can produce — thirty-two
 * of them, a full lap of the hue circle, plus every crossfade between
 * neighbours — and fails the build on anything under 4.5:1.
 *
 * The luminance formula is WCAG 2.x relative luminance, and it is the same one
 * `games/stack` derives its own chrome from (`strata.ts`, `luma`/`isBright`).
 * That game learned this lesson first: AZURE shipped white-on-pale-blue because
 * a hand-maintained `invert` boolean was wrong on one stratum, and a run reaches
 * all of them.
 */

/** WCAG AA for body text. Everything here is body text. */
export const AA = 4.5;

/** The two house inks. Derivation starts from these and corrects from there. */
export const INK_LIGHT = 0xeaf6ff;
export const INK_DARK = 0x12121a;

const ch = (hex: number, i: number): number => (hex >> (8 * (2 - i))) & 255;
const pack = (r: number, g: number, b: number): number =>
  (clamp255(r) << 16) | (clamp255(g) << 8) | clamp255(b);
const clamp255 = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));

/** `0x37ecff` -> `"#37ecff"`. */
export function hex(c: number): string {
  return `#${(c >>> 0).toString(16).padStart(6, "0")}`;
}

/**
 * WCAG relative luminance of a packed `0xRRGGBB`, 0..1.
 *
 * Lifted from `games/stack/src/game/strata.ts` rather than reinvented — same
 * formula, same constants, same reason for existing.
 */
export function luma(c: number): number {
  const f = (v: number): number => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(ch(c, 0)) + 0.7152 * f(ch(c, 1)) + 0.0722 * f(ch(c, 2));
}

/** WCAG contrast ratio between two opaque colours, 1..21. Order-insensitive. */
export function contrast(a: number, b: number): number {
  const la = luma(a);
  const lb = luma(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * `fg` at `alpha` composited over `bg`.
 *
 * A straight per-channel lerp on 8-bit values, because that is what a browser
 * does for `rgba()` over an opaque backdrop in an un-managed sRGB document.
 * Compositing in linear light would be more correct and would not match what
 * the child is looking at.
 */
export function over(fg: number, alpha: number, bg: number): number {
  const a = Math.max(0, Math.min(1, alpha));
  return pack(
    ch(bg, 0) + (ch(fg, 0) - ch(bg, 0)) * a,
    ch(bg, 1) + (ch(fg, 1) - ch(bg, 1)) * a,
    ch(bg, 2) + (ch(fg, 2) - ch(bg, 2)) * a,
  );
}

/** Linear blend of two packed colours, `t` = 0 gives `a`. */
export function mix(a: number, b: number, t: number): number {
  return over(b, t, a);
}

/** The worst contrast `ink` achieves against any one of `bgs`. */
export function minContrast(ink: number, bgs: readonly number[]): number {
  let worst = Infinity;
  for (const bg of bgs) worst = Math.min(worst, contrast(ink, bg));
  return worst === Infinity ? 21 : worst;
}

/**
 * Push `ink` toward whichever pole it is already nearer until it clears
 * `target` against every background in `bgs`.
 *
 * A binary search on the blend, not a step to white or black: the accent-hued
 * "RECHARGE" label should still read as the biome's accent after correction,
 * and the smallest correction that clears the bar is the one that keeps most of
 * the hue. If even the pole cannot clear it — which no surface in this game
 * reaches, and `contrast.test.ts` is what says so — the pole is returned, which
 * is still the most readable colour available.
 */
export function toward(ink: number, bgs: readonly number[], target = AA): number {
  if (minContrast(ink, bgs) >= target) return ink;
  const pole = luma(ink) >= luma(bgs[0] ?? 0) ? 0xffffff : 0x000000;
  if (minContrast(pole, bgs) < target) return pole;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const midT = (lo + hi) / 2;
    if (minContrast(mix(ink, pole, midT), bgs) >= target) hi = midT;
    else lo = midT;
  }
  return mix(ink, pole, hi);
}

/**
 * The readable ink for a surface: the better house ink, then corrected.
 *
 * Choosing between the two first rather than always correcting one of them is
 * what keeps THE BLEACH's in-run HUD dark-on-bone instead of dragging it to
 * white — the biome's whole visual card is black ink on a pale world.
 */
export function readableInk(bgs: readonly number[], target = AA): number {
  const lightWorst = minContrast(INK_LIGHT, bgs);
  const darkWorst = minContrast(INK_DARK, bgs);
  const start = lightWorst >= darkWorst ? INK_LIGHT : INK_DARK;
  return toward(start, bgs, target);
}

/* -------------------------------------------------------------------------- */
/* The surfaces, described once so the stylesheet and the tests cannot drift.  */
/* -------------------------------------------------------------------------- */

/**
 * A gradient, as `[position 0..1, alpha]` stops of one colour over the world.
 *
 * `hud.ts` builds its `linear-gradient()` from these arrays and nowhere else,
 * and `contrast.test.ts` samples the same arrays. There is deliberately no
 * second copy of these numbers in the CSS to disagree with them — the same
 * discipline `chrome.ts` imposes on geometry, for the same reason.
 */
export type Stops = readonly (readonly [number, number])[];

/** The scrim every veil paints over the causeway. */
export const VEIL_TINT = 0x030712;

/**
 * The recharge veil, top to bottom.
 *
 * The clear window — where the causeway is genuinely visible in full colour, and
 * the reason this screen is a gate and not a dialog box — is the 20%..34% band,
 * with soft ramps either side, so the world shows through roughly the top two
 * fifths of the glass. Below `REVIVE_CONTENT_TOP` the scrim comes up to a floor,
 * because that is where the question and the three answers are and a numeral
 * cannot be legible against a background that runs from bone to black underneath
 * it. Sparsen the field; do not sand down the effect.
 */
export const REVIVE_STOPS: Stops = [
  [0, 0.86],
  [0.2, 0.18],
  [0.34, 0.18],
  [0.46, 0.9],
  [1, 0.94],
];

/**
 * Where the recharge veil's content starts, as a fraction of its height.
 *
 * The veil is `justify-content:flex-end`, so the charge ring, the question and
 * the three lanes stack up from the bottom. On the tallest content this game
 * produces — a 1024x768 tablet, where the lanes are capped at 820px wide and so
 * are 217px tall — the stack reaches a little under half way. 0.46 is that,
 * rounded toward the top.
 */
export const REVIVE_CONTENT_TOP = 0.46;

/**
 * The start and run-over veils: a radial scrim, sampled centre to edge.
 *
 * The centre used to be `rgba(2,4,12,0.55)`, which over THE BLEACH's bone sky
 * composites to rgb(115,114,116) — a mid grey where *neither* house ink clears
 * 4.5:1 (3.86:1 dark, 4.18:1 light). No choice of ink fixes a mid-grey
 * backdrop; the scrim itself had to come up.
 */
export const PLAIN_STOPS: Stops = [
  [0, 0.74],
  [0.72, 0.94],
  [1, 0.94],
];

/**
 * The recharge lane's own face, over the veil: `[position, colour, alpha]`.
 *
 * A numeral sits in the middle of this, so every stop is a candidate backdrop.
 */
export const LANE_FACE: readonly (readonly [number, number, number])[] = [
  [0, 0xffffff, 0.1],
  [0.55, 0x040a16, 0.3],
  [1, 0x040a16, 0.62],
];

/**
 * How far a secondary line of text is softened toward its own backdrop.
 *
 * This used to be an `opacity`, and an opacity is not decoration: it composites
 * the ink into the backdrop, so a 4.5:1 ink at 0.45 is a 3.86:1 ink. SCORE,
 * SURGE, VOLTAGE, the recharge counter and the start hint were at 0.45, 0.5 and
 * 0.6 — under the bar in THE BLEACH on every one of them.
 *
 * Raising the number was not the fix either. Halfway through the crossing from
 * THE ABYSS to THE BLEACH the sky is a mid grey, and against a mid grey the best
 * ink available clears 4.5:1 by a hair — so *any* opacity below 1 puts it under.
 * There is no constant that works.
 *
 * So the softening is applied as a derived colour instead: soften toward the
 * backdrop, then correct back until the result clears the bar. On a dark sky
 * SCORE is the quiet grey it was designed to be; on a mid-grey sky the
 * correction hands back the full-strength ink on its own, and nothing has to
 * know which sky it was. See `dimInk`.
 */
export const SOFTEN = 0.68;

/** The bed the voltage bar's fill is drawn on, so the fill has a known backdrop. */
export const VOLT_BED = 0x02050e;
export const VOLT_BED_A = 0.55;

/** `alpha` at position `p` along `stops`, linearly interpolated and clamped. */
export function alphaAt(stops: Stops, p: number): number {
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (!first || !last) return 0;
  if (p <= first[0]) return first[1];
  if (p >= last[0]) return last[1];
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    if (!a || !b || p > b[0]) continue;
    const span = b[0] - a[0];
    const t = span === 0 ? 0 : (p - a[0]) / span;
    return a[1] + (b[1] - a[1]) * t;
  }
  return last[1];
}

const rgba = (c: number, a: number): string =>
  `rgba(${ch(c, 0)},${ch(c, 1)},${ch(c, 2)},${a})`;

/** `stops` as the body of a CSS gradient, in the tint the veils use. */
export function gradientStops(stops: Stops): string {
  return stops.map(([p, a]) => `${rgba(VEIL_TINT, a)} ${Math.round(p * 100)}%`).join(", ");
}

/** `LANE_FACE` as the body of the recharge lane's own CSS gradient. */
export function laneFaceStops(): string {
  return LANE_FACE.map(([p, c, a]) => `${rgba(c, a)} ${Math.round(p * 100)}%`).join(", ");
}

const SAMPLES = 17;

/** Every backdrop the recharge veil's *content* can land on, over `sky`. */
export function reviveBackdrops(sky: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    const p = REVIVE_CONTENT_TOP + ((1 - REVIVE_CONTENT_TOP) * i) / (SAMPLES - 1);
    out.push(over(VEIL_TINT, alphaAt(REVIVE_STOPS, p), sky));
  }
  return out;
}

/** Every backdrop the start / run-over veils' content can land on, over `sky`. */
export function plainBackdrops(sky: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    const p = i / (SAMPLES - 1);
    out.push(over(VEIL_TINT, alphaAt(PLAIN_STOPS, p), sky));
  }
  return out;
}

/** Every backdrop a recharge lane's numeral can land on, over `sky`. */
export function laneBackdrops(sky: number): number[] {
  const out: number[] = [];
  for (const veil of reviveBackdrops(sky)) {
    for (const [, c, a] of LANE_FACE) out.push(over(c, a, veil));
  }
  return out;
}

/**
 * `ink`, softened toward its backdrop by `SOFTEN`, then corrected back to AA.
 *
 * The whole trick is that the correction is unconditional: on a backdrop with
 * room to spare it does nothing and the label is quiet, and on a backdrop with
 * no room it undoes the softening entirely. Neither the stylesheet nor the
 * caller has to know which case it is in.
 */
export function dimInk(ink: number, bgs: readonly number[], target = AA): number {
  const anchor = bgs[0] ?? 0;
  return toward(mix(ink, anchor, 1 - SOFTEN), bgs, target);
}

/* -------------------------------------------------------------------------- */
/* The inks themselves.                                                       */
/* -------------------------------------------------------------------------- */

export type Ink = {
  /** Prompt, score, surge, banner — text that sits on the sky. */
  sky: number;
  /** Voltage and the tool buttons — furniture that sits on the deck. */
  deck: number;
  /** Every veil's text, derived from the scrim rather than from the sky. */
  veil: number;
  /** A recharge lane's numeral, over the lane face over the veil. */
  lane: number;
  /** Text on a solid fill of the live accent — the chosen lane. */
  onAccent: number;
  /** Text on a fill painted in `veil` — the Run / Run-again button label. */
  onVeilInk: number;
  /** Text on a fill painted in `deck` — a pressed tool button's glyph. */
  onDeckInk: number;
  /** The accent, corrected until it is legible as text on the veil scrim. */
  accentOnVeil: number;
  /** The voltage fill, on its own bed. */
  voltFill: number;
  /** SCORE / SURGE, tracked and quiet, on the sky. */
  skyDim: number;
  /** VOLTAGE, tracked and quiet, on the deck. */
  deckDim: number;
  /** The recharge counter and the start hint, quiet, on the veil. */
  veilDim: number;
};

/**
 * Every ink, derived from the three world colours the HUD actually lands on.
 *
 * Takes the *live* colours, not the biome record: `mount.ts` calls this with the
 * crossfade's current blend, so a child who dies half way between AURORA and
 * SOLAR gets a recharge gate derived from the sky that is actually on screen.
 */
export function inkFor(sky: number, deck: number, accent: number): Ink {
  const veilBgs = [...reviveBackdrops(sky), ...plainBackdrops(sky)];
  const veil = readableInk(veilBgs);
  const deckBgs = [deck, over(VOLT_BED, VOLT_BED_A, deck)];
  const deckInk = readableInk(deckBgs);
  return {
    sky: readableInk([sky]),
    deck: deckInk,
    veil,
    lane: readableInk(laneBackdrops(sky)),
    onAccent: readableInk([accent]),
    onVeilInk: readableInk([veil]),
    onDeckInk: readableInk([deckInk]),
    accentOnVeil: toward(accent, veilBgs),
    voltFill: readableInk([over(VOLT_BED, VOLT_BED_A, deck)]),
    skyDim: dimInk(readableInk([sky]), [sky]),
    deckDim: dimInk(deckInk, deckBgs),
    veilDim: dimInk(veil, veilBgs),
  };
}

/**
 * The custom properties `hud.ts` colours itself from.
 *
 * The stylesheet holds no colour of its own for anything a child reads — the
 * same contract `hudVars` has for geometry. `chrome.test.ts` checks that every
 * `var(--vt-ink-*)` and `var(--vt-on-*)` the sheet asks for is produced here.
 */
export function inkVars(sky: number, deck: number, accent: number): Record<string, string> {
  const k = inkFor(sky, deck, accent);
  return {
    "--vt-ink-sky": hex(k.sky),
    "--vt-ink-deck": hex(k.deck),
    "--vt-ink-veil": hex(k.veil),
    "--vt-ink-lane": hex(k.lane),
    "--vt-on-accent": hex(k.onAccent),
    "--vt-on-veil-ink": hex(k.onVeilInk),
    "--vt-on-deck-ink": hex(k.onDeckInk),
    "--vt-accent-veil": hex(k.accentOnVeil),
    "--vt-volt-fill": hex(k.voltFill),
    "--vt-ink-sky-dim": hex(k.skyDim),
    "--vt-ink-deck-dim": hex(k.deckDim),
    "--vt-ink-veil-dim": hex(k.veilDim),
  };
}
