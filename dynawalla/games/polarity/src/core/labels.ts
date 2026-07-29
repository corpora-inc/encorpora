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
 * So tiles are claimed on demand instead. Any finite integer prints, whatever
 * its magnitude, and a value that is somehow not one prints `?` — loud in the
 * console and visible on the field, because the one thing a numeral must never
 * be is absent.
 */

import { MINUS } from "../math/signed.ts";

/**
 * The grid. 48 cells: 47 claimable and one reserved.
 *
 * The playfield's entire numeric vocabulary in one frame is chaff at ±2…9,
 * charge at ±2…9, the float texts they leave behind (a subset of those), four
 * orbs and one lock — about two dozen distinct values, measured in
 * `labels.test.ts`. Twice that is headroom; more than that is texture nobody
 * looks at, and the cell has to stay big enough to read.
 */
export const LABEL_COLS = 8;
export const LABEL_ROWS = 6;
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
 * Cells are twice as wide as they are tall, so a four-digit answer gets ROOM
 * rather than being squeezed to a smear at the same height as a `7`. The quad
 * the shader draws is `size * LABEL_ASPECT` wide by `size` tall, and a short
 * numeral simply leaves transparent margin either side.
 */
export const LABEL_ASPECT = 2;

/**
 * The longest numeral a tile is expected to hold. Evidence, not a guess: the
 * widest value the shipping ladder emits across 44,000 measured orbs is
 * `998232` — six characters — and the longest a mal-rule or near-miss
 * distractor pushes it to is seven. Eight leaves a character of headroom and
 * still fits the cell without squeezing.
 */
export const LABEL_MAX_CHARS = 8;

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
 */
export function isPrintable(v: number): boolean {
  if (!Number.isInteger(v)) return false;
  return labelText(v).length <= LABEL_MAX_CHARS;
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
