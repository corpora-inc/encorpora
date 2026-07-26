/**
 * The public contract. Everything the games team and the host app touch.
 */

import type { Fold } from "./geometry/tilings.ts";
import type { WardId } from "./tokens/palette.ts";
import type { Locale } from "./strings.ts";

export type { Fold, WardId, Locale };

/** The instrument at the head of a ward's tower. The second identity axis. */
export type Finial = "meridian" | "vane" | "signal" | "gear" | "armillary";

/** A worked specimen of the quarter's own mathematics. */
export interface Specimen {
  /** Set in figures, on the sign board. `aria-hidden`. */
  display: string;
  /** The same thing in words, for the accessible name. */
  spoken: string;
}

export interface Quarter {
  id: string;
  ward: WardId;
  finial: Finial;
  fold: Fold;
  /** Index into STRIPES. */
  stripe: number;
  /** Place names are content, localised per launch locale. */
  name: Record<Locale, string>;
  specimen: Specimen;
  /** Which of the ten crafts the automaton performs. */
  craft: Craft;
}

export type Craft =
  | "balance"
  | "coin"
  | "tessera"
  | "rope"
  | "astrolabe"
  | "water"
  | "vat"
  | "kite"
  | "gears"
  | "mill";

/**
 * BZ-06/BZ-07 — what a stall shows through its aperture.
 *
 * The preview shows the game being *played correctly*: a ghost hand solving, at
 * half speed, looping on `period`. Not a title card, not a logo, not a menu. A
 * child must be able to tell what they would do in there without entering.
 *
 * Deterministic on `seed`. No input, no audio, no network, no persistence.
 * Silent — sound belongs to the street. Budget: 4 ms per frame at 30 fps; over
 * budget and the stall falls back to its poster permanently.
 */
export interface StallPreview {
  render(ctx: CanvasRenderingContext2D, o: PreviewFrame): void;
  /** Loop period in seconds. 4–8. */
  readonly period: number;
}

export interface PreviewFrame {
  width: number;
  height: number;
  dpr: number;
  /** Seconds since the preview started. */
  t: number;
  seed: number;
  reducedMotion: boolean;
}

export type StallState = "open" | "shut" | "scaffold";

export interface StallSpec {
  id: string;
  /** The game's name. Owned by the game, not by the bazaar. */
  title: string;
  /** Which quarter it stands in. */
  quarter: string;
  preview?: StallPreview;
  /** Defaults to `open`, or `scaffold` when there is no preview. */
  state?: StallState;
  /** Physical accretion at this stall: 0…1. Never a number in the UI. */
  accretion?: number;
  /** Overrides the quarter's default specimen. */
  specimen?: Specimen;
}

export interface BazaarOptions {
  stalls: StallSpec[];
  /**
   * How much of the free day is left, 0…1. Walking the bazaar is free
   * (BZ-LAW-14); only time inside a stall consumes it.
   */
  dayRemaining?: number;
  subscribed?: boolean;
  seed?: number;
  locale?: string;
  /** `auto` follows the OS and the day-state; the night bazaar is a place. */
  theme?: "auto" | "light" | "night";
  sound?: boolean;
  /** Extra quarters beyond the ten built in. */
  quarters?: Quarter[];
  onEnter?(stallId: string): void;
  /** The single upgrade surface. Non-modal, and never during play. */
  onUpgrade?(): void;
}

export interface BazaarHandle {
  destroy(): void;
  setStalls(stalls: StallSpec[]): void;
  setDay(remaining: number): void;
  setSubscribed(v: boolean): void;
  /** Called by the host when a stall is open, so the day cannot end inside it. */
  setInStall(v: boolean): void;
  goToStall(id: string): void;
  scrollLeft(): number;
  /** Last measured frame statistics, for the perf gate. */
  stats(): { fps: number; p90: number; tier: number; liveNodes: number };
}
