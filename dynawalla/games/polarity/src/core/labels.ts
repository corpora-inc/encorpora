/**
 * Numeral addressing. Every printed number in the playfield is one quad
 * sampling one tile of one texture, so a screen full of labelled bullets costs
 * a single draw call and no text layout at all.
 *
 * Legibility rule learned the hard way elsewhere in this program: a numeral a
 * child has 0.45s to read gets a heavy geometric face, a solid backing plate
 * and a real U+2212 minus — never an engraved serif.
 *
 * **Why this is a book and not a baked range.** It used to bake −40…+40 into a
 * fixed 9×9 grid and return −1 for anything else, and the renderer skipped a −1
 * silently. The curriculum this pack actually asks for answers in the hundreds
 * and thousands: measured over the whole shipping ladder, 89.9% of the orb
 * values a Seal Bearer drops fell outside that range, and 87.3% of items put
 * FOUR blank glowing discs in front of the child, with no error and no warning.
 * A child cannot choose between four unlabelled circles.
 *
 * So tiles are claimed on demand instead. Any finite integer up to
 * `LABEL_MAX_CHARS` prints, whatever its magnitude, and a value that is somehow
 * not an integer prints `?` — loud in the console and visible on the field,
 * because the one thing a numeral must never be is absent.
 *
 * **There is still a width, and it is now derived rather than typed.** A
 * numeral cannot be narrower than half its own cap height and still be read, and
 * the width it has is the orb's lane — see `LABEL_ASPECT` and
 * `LABEL_MIN_ADVANCE_CAPS`. What that budget refuses, `seal.ts` turns into a
 * ceiling on the whole stream rather than a refusal per item, because a rung
 * whose every answer is too wide is a Seal Bearer that asks nothing.
 */

import { MINUS } from "../math/signed.ts";

/**
 * The grid. 49 cells: 48 claimable and one reserved.
 *
 * The playfield's entire numeric vocabulary in one frame is chaff at ±2…9,
 * charge at ±2…9, the float texts they leave behind (a subset of those), four
 * orbs and one lock — about two dozen distinct values, measured in
 * `labels.test.ts`. Twice that is headroom; more than that is texture nobody
 * looks at, and the cell has to stay big enough to read.
 *
 * It was 8 × 6 while the cell was 2:1. The cell is `LABEL_ASPECT`:1 now and the
 * texture cannot grow sideways — see that constant — so the grid is squarer at
 * the same claimable count.
 */
export const LABEL_COLS = 7;
export const LABEL_ROWS = 7;
export const LABEL_CAPACITY = LABEL_COLS * LABEL_ROWS;

/**
 * The last cell, reserved and never claimable: it always prints `?`.
 *
 * It is what a numeral becomes when something has gone wrong — a value that is
 * not an integer, or a frame that somehow wanted more numerals than the grid
 * holds. Reserving it is what lets `claim` refuse to evict a tile that is on
 * screen: the choice under pressure is "show a question mark and shout", never
 * "quietly repaint a numeral a child is mid-way through reading", and never the
 * old answer of showing nothing at all.
 */
export const LABEL_FAULT_TILE = LABEL_CAPACITY - 1;

/**
 * Cells are wider than they are tall, so a long answer gets ROOM rather than
 * being squeezed to a smear at the same height as a `7`. The quad the shader
 * draws is `size * LABEL_ASPECT` wide by `size` tall, and a short numeral simply
 * leaves transparent margin either side.
 *
 * **Why 2.25 and not more.** Not the texture: the atlas is `LABEL_COLS *
 * cellPx * LABEL_ASPECT` wide, which at 2.25 and a 128px cell is 2016 — under
 * 2048, the value WebGL guarantees for `MAX_TEXTURE_SIZE` and therefore the
 * hard ceiling on this dimension. The binding constraint is the ORB'S LANE.
 * Four orbs share `ORB_SPREAD` of the hundred-unit playfield, so each gets
 * `ORB_SPREAD / 4`; the label drawn over one is `size * LABEL_ASPECT` wide, and
 * two labels that overlap are worse than one that is condensed. See
 * `labels.test.ts`, which holds the two numbers against each other.
 */
export const LABEL_ASPECT = 2.25;

/** The cell's height in design units. `atlas.ts` scales the real cell to this. */
export const LABEL_CELL_H = 128;

/** The numeral's type size in design units — its HEIGHT, whatever its length. */
export const LABEL_EM = 76;

/**
 * Total horizontal padding inside a cell, design units, so glyphs never clip.
 *
 * Ten a side, and the number it has to clear is the baked contrast rim: the
 * painter strokes the numeral at `lineWidth 13` before filling it, which puts
 * ink 6.5 design units outside the glyph outline. Ten leaves three and a half
 * units of slack on top of that. It was 24 — a round number nothing derived —
 * and the four units are the difference between ten characters and nine.
 */
export const LABEL_CELL_MARGIN = 20;

/** The box a numeral is fitted into, design units wide. */
export const LABEL_INK_W = LABEL_CELL_H * LABEL_ASPECT - LABEL_CELL_MARGIN;

/**
 * What one character gets, in ems of the numeral's own height, when a numeral
 * of `chars` characters is fitted to the cell.
 *
 * This is the number that decides legibility, and it is font-independent:
 * anything wider than the box is squeezed to exactly fill it (`atlas.ts`), so a
 * long numeral's advance is the box divided by the character count whatever
 * face the device resolves. Height never moves — every numeral on the field is
 * drawn at the same `LABEL_EM`.
 *
 * For a numeral short enough not to be squeezed this is an upper bound: it gets
 * the face's own advance, which is smaller.
 */
export function labelAdvanceEm(chars: number): number {
  return LABEL_INK_W / (LABEL_EM * Math.max(1, chars));
}

/** Cap height as a fraction of the type size. Conservative for a geometric sans. */
export const LABEL_CAP_RATIO = 0.7;

/**
 * How narrow a digit is allowed to get, as a fraction of its own cap height.
 *
 * A half. Condensed tabular faces bottom out at about 0.45 to 0.5 of cap
 * height — below that the counters of `8`, `6` and `0` close and a child
 * reading at speed is guessing — and an unsqueezed face runs about 0.85. So
 * this is the narrow end of legible, deliberately, and it is stated against the
 * cap height rather than in pixels because the one hard gate this program has
 * for a numeral on a moving object is a cap-height gate:
 * `docs/catalog/arcade-canon.json` demands 22 rpx "at the moment of decision".
 * `labels.test.ts` computes the cap height across the fleet from these
 * constants and holds it to that.
 */
export const LABEL_MIN_ADVANCE_CAPS = 0.5;

/**
 * The same floor in ems, which is the unit the cell is measured in.
 *
 * **What it replaces.** `LABEL_MAX_CHARS = 8`, whose stated reason was that
 * eight "still fits the cell without squeezing". It does not: eight characters
 * at `LABEL_EM` measure about 365 design units against what was then a 232-unit
 * box, so the eight-character numeral the old constant permitted was already
 * squeezed to roughly 0.64 of its natural width — 0.38 em of advance, 0.55 of
 * cap height. Nothing measured that, nothing enforced it, and no shipped item
 * ever reached it: the widest the ladder emitted was six characters. The budget
 * is stated as the ratio it always really was, and the character count is
 * derived from it rather than chosen.
 */
export const LABEL_MIN_ADVANCE_EM = LABEL_MIN_ADVANCE_CAPS * LABEL_CAP_RATIO;

/**
 * The longest numeral a tile will hold — DERIVED, not chosen.
 *
 * The largest `n` for which `labelAdvanceEm(n) >= LABEL_MIN_ADVANCE_EM`, which
 * at the shipping geometry is ten — by a margin of less than one percent. Ten
 * characters is `48,826 × 82,726`, the widest answer the curriculum reaches and
 * the ceiling this whole program is aimed at, and it is reached because the
 * geometry allows it and not because anything was rounded in its favour: a
 * later change to the cell, the margin or the aspect moves this number, and
 * `labels.test.ts` asserts both that ten fits and that eleven does not.
 */
export const LABEL_MAX_CHARS = Math.floor(LABEL_INK_W / (LABEL_EM * LABEL_MIN_ADVANCE_EM));

/** What a tile with nothing legible to print shows. Never blank. */
export const LABEL_FAULT = "?";

/** The printed form of a value: `7`, `0`, `−5`, `3916`. */
export function labelText(v: number): string {
  if (!Number.isInteger(v)) return LABEL_FAULT;
  return v < 0 ? MINUS + String(-v) : String(v);
}

/**
 * Can this value be an orb?
 *
 * The one question `askQuestion` asks before it drops anything: a value the
 * game cannot print must never be offered as an answer. Magnitude is no longer
 * a reason to say no — only a value that is not a finite integer, or one so
 * long the cell could not hold it legibly, is refused, and both are refused out
 * loud where they happen.
 *
 * **Why `maxChars` is a parameter.** The thing this refusal exists to protect
 * against is a curriculum WIDER than the one that ships, and today's ships
 * inside the budget with nothing to spare on either side — so a test that
 * cannot narrow the budget cannot exercise the refusal, or the ceiling built on
 * top of it in `seal.ts`, until the day the curriculum has already broken.
 * `game/ask.test.ts` narrows it and plays the real ladder through the real
 * host; nothing in the game passes anything but the default.
 */
export function isPrintable(v: number, maxChars: number = LABEL_MAX_CHARS): boolean {
  if (!Number.isInteger(v)) return false;
  return labelText(v).length <= maxChars;
}

/**
 * Which tile prints which numeral, right now.
 *
 * DOM-free and allocation-free in the steady state, so the whole policy is
 * testable in node without a canvas. `render/atlas.ts` owns the pixels and asks
 * this what to paint.
 *
 * Tiles are resolved at DRAW time, once per label per frame, which is what
 * makes eviction safe: a tile is only ever reclaimed if it was not asked for
 * this frame, so nothing on screen can have its numeral pulled out from under
 * it. `overflows` counts the impossible case — a single frame asking for more
 * distinct numerals than the grid holds — and it is loud, not silent.
 */
export class LabelBook {
  readonly capacity: number;
  /** Values asked for that are not integers. A bug upstream; the tile says `?`. */
  faults = 0;
  /** Frames that wanted more distinct numerals than the grid holds. */
  overflows = 0;

  private readonly tileOf = new Map<number, number>();
  private readonly text: (string | null)[];
  private readonly key: number[];
  private readonly touched: number[];
  private readonly dirty = new Set<number>();
  private frame = 0;

  /** The reserved `?` cell. Always the last one, whatever the capacity is. */
  readonly faultTile: number;

  constructor(capacity: number = LABEL_CAPACITY) {
    this.capacity = capacity;
    this.faultTile = capacity - 1;
    this.text = new Array<string | null>(capacity).fill(null);
    this.key = new Array<number>(capacity).fill(0);
    this.touched = new Array<number>(capacity).fill(-1);
    this.text[this.faultTile] = LABEL_FAULT;
    this.dirty.add(this.faultTile);
  }

  /** Call once per frame, before any `tileFor`. */
  beginFrame(): void {
    this.frame++;
  }

  /**
   * The tile printing `v`, claiming one if this is the first time it has been
   * asked for. Never negative: every value gets a tile, and a value that is not
   * an integer gets one that prints `?`.
   */
  tileFor(v: number): number {
    if (!Number.isInteger(v)) {
      this.faults++;
      return this.faultTile;
    }
    const found = this.tileOf.get(v);
    if (found !== undefined) {
      this.touched[found] = this.frame;
      return found;
    }
    const tile = this.claim();
    if (tile < 0) return this.faultTile;
    this.tileOf.set(v, tile);
    this.key[tile] = v;
    this.text[tile] = labelText(v);
    this.touched[tile] = this.frame;
    this.dirty.add(tile);
    return tile;
  }

  /** What a tile currently prints, or null if it has never been claimed. */
  textAt(tile: number): string | null {
    return this.text[tile] ?? null;
  }

  /** Tiles whose contents changed since the last call. The painter's worklist. */
  takeDirty(): number[] {
    if (this.dirty.size === 0) return [];
    const out = [...this.dirty];
    this.dirty.clear();
    return out;
  }

  /** A free tile, or -1 when every one of them is already on screen. */
  private claim(): number {
    let lru = 0;
    for (let i = 0; i < this.faultTile; i++) {
      if (this.text[i] === null) return i;
      if ((this.touched[i] as number) < (this.touched[lru] as number)) lru = i;
    }
    if (this.touched[lru] === this.frame) {
      // Unreachable with the shipping grid — the whole playfield vocabulary is
      // half the capacity — and loud rather than silent, because the only two
      // ways out are a `?` and a numeral changing under a child mid-read.
      this.overflows++;
      console.error(
        `[polarity] the label atlas ran out of tiles in one frame (${String(this.capacity)})`,
      );
      return -1;
    }
    this.tileOf.delete(this.key[lru] as number);
    this.text[lru] = null;
    return lru;
  }
}
