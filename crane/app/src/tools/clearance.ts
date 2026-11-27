/**
 * Power line clearance for the Tools screen. The rows, quotes and the
 * trigger distance come from crane/content/tools/powerline, the one verified
 * source (Table A to 29 CFR 1926.1408 and 1926.1409); this file only shapes
 * them for the screen.
 */
import { TABLE_A as ROWS, clearance, rule, type Citation } from "../../../content/tools/powerline/clearance.ts";

export const TABLE_A_SECTION = "29cfr1926.1408";

export interface Band {
  id: string;
  /** Exclusive lower bound, kV. */
  overKv: number;
  /** Inclusive upper bound, kV; null = no upper bound. */
  toKv: number | null;
  /** Feet; null = set by the utility or a registered professional engineer. */
  feet: number | null;
  /** The table cell, verbatim. */
  cell: Citation;
  /**
   * Operations within this distance trigger Option 1, 2 or 3: 20 ft up to
   * 350 kV (1926.1408(a)(2)), 50 ft over 350 to 1,000 kV (1926.1409(a));
   * null over 1,000 kV, where the utility or an engineer sets the distance.
   */
  triggerFeet: number | null;
  /** The rule that sets the trigger. */
  triggerRule: Citation;
}

export const TABLE_A: readonly Band[] = Object.freeze(
  ROWS.map((r): Band => {
    const result = clearance("operation", r.to_kv ?? r.over_kv + 1);
    return {
      id: r.to_kv === null ? `over${r.over_kv}` : String(r.to_kv),
      overKv: r.over_kv,
      toKv: r.to_kv,
      feet: r.clearance_ft,
      cell: r.cell,
      triggerFeet: result.thresholdFt,
      triggerRule: r.to_kv === null ? rule("over-1000") : r.to_kv <= 350 ? rule("twenty-foot-check") : rule("over-350-to-1000"),
    };
  }),
);

/** The band for a nominal voltage in kV, or null for a non-positive or non-finite value. */
export function bandFor(kv: number): Band | null {
  if (!Number.isFinite(kv) || kv <= 0) return null;
  return TABLE_A.find((b) => kv > b.overKv && (b.toKv === null || kv <= b.toKv)) ?? null;
}
