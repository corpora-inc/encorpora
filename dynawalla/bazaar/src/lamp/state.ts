/**
 * The daily lamp — the free day as a physical object in the world.
 *
 * Three decisions make it gentle, and they are laws, not preferences:
 *
 *   BZ-LAW-14  Walking the bazaar is free. The day is consumed by time inside
 *              a stall only. Wandering, listening, watching the previews,
 *              waking the cat, reading the specimens — free, forever,
 *              unmetered. A child who has used their day can still spend
 *              twenty minutes in the marketplace wanting things.
 *   BZ-LAW-15  The day never ends inside a game. `d` clamps at 0.99 while a
 *              stall is open, plus a 90 s grace at the street.
 *   BZ-LAW-16  The end of the day is the most beautiful part of it: golden
 *              hour, then a 40 s dusk with a lamplighter walking the street.
 *
 * And the rules it must never break (§7.5): no countdown, no timer, no number,
 * no percentage, no urgency, no scarcity, no streak, no loss. The lamp's only
 * words are five day-states, because a glance is not available to everyone.
 */

import { clamp } from "../util/rng.ts";
import type { StringKey } from "../strings.ts";

export const DUSK_MS = 40_000;
export const GRACE_MS = 90_000;

export interface LampReading {
  /** Day-state, 0 = morning … 1 = dusk. Clamped at 0.99 inside a stall. */
  d: number;
  /** The dusk blend, 0…1, driving the whole semantic layer. */
  night: number;
  /** Oil level in the glass, 1 → 0. Position, not colour. */
  oil: number;
  /** Gnomon shadow angle across the engraved arc, 0…150°. Rotation. */
  gnomon: number;
  /** Is the flame lit? Binary shape. */
  lit: boolean;
  /** Within the 90 s grace: one more round, and no cliff. */
  grace: boolean;
  /** The only words the mechanism gets. */
  label: StringKey;
}

export class Lamp {
  private consumed = 0;
  private inStall = false;
  private subscribed = false;
  private duskStart: number | null = null;
  private graceStart: number | null = null;
  private forcedNight = false;

  /** 0…1 of the free day still available. Supplied by the host. */
  setRemaining(r: number): void {
    this.consumed = clamp(1 - r, 0, 1);
  }

  setSubscribed(v: boolean): void {
    this.subscribed = v;
    if (v) {
      this.duskStart = null;
      this.graceStart = null;
    }
  }

  /** The host tells us when a stall is open. BZ-16 hangs off this. */
  setInStall(v: boolean): void {
    if (v === this.inStall) return;
    this.inStall = v;
    if (!v && this.consumed >= 1 && this.graceStart === null) {
      // Stepping back into the street with the day spent: one more round.
      this.graceStart = Date.now();
    }
  }

  /** Force the night bazaar (dark theme, or a subscriber after dusk). */
  setForcedNight(v: boolean): void {
    this.forcedNight = v;
  }

  read(now = Date.now()): LampReading {
    // BZ-16: the day cannot complete while a stall is open.
    const raw = this.consumed;
    const d = this.inStall ? Math.min(raw, 0.99) : raw;

    const grace =
      this.graceStart !== null && now - this.graceStart < GRACE_MS && !this.subscribed;

    let night = 0;
    if (this.forcedNight) {
      night = 1;
    } else if (this.subscribed) {
      // The subscriber's lamp never falls; the night bazaar opens at dusk.
      night = d >= 1 ? 1 : 0;
    } else if (d >= 1 && !this.inStall && !grace) {
      if (this.duskStart === null) this.duskStart = now;
      night = clamp((now - this.duskStart) / DUSK_MS, 0, 1);
    }

    // The subscriber's lamp is a different lamp: full and lit at all times.
    const oil = this.subscribed ? 1 : 1 - d;
    const lit = this.subscribed || night > 0.02;

    return {
      d,
      night,
      oil,
      gnomon: d * 150,
      lit,
      grace,
      label: labelFor(d, night),
    };
  }

  /** The lamplighter is the entire monetisation surface, and it is always there. */
  get showsLamplighter(): boolean {
    return !this.subscribed;
  }
}

function labelFor(d: number, night: number): StringKey {
  if (night > 0.35) return "day.lit";
  if (d >= 0.9) return "day.evening";
  if (d >= 0.7) return "day.afternoon";
  if (d >= 0.35) return "day.midday";
  return "day.morning";
}
