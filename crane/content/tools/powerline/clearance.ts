// Power line clearance: deterministic, cited, no model.
// Data: ./clearance.json (verbatim from 29 CFR 1926.1408 Table A, 1926.1409, 1926.1411 Table T).
import data from "./clearance.json" with { type: "json" };

export type Activity = "operation" | "assembly" | "travel";
export type VoltageClass = "up-to-350" | "over-350-to-1000" | "over-1000";

export interface Citation { section_id: string; quote: string }
export interface Row { over_kv: number; to_kv: number | null; clearance_ft: number | null; cell: Citation }

export interface ClearanceResult {
  activity: Activity;
  /** "A" for operations and assembly/disassembly, "T" for traveling with no load. */
  table: "A" | "T";
  /** The table row that applies, or null when the voltage is unknown. */
  row: Row | null;
  /** Minimum clearance in feet from the table; null when it must be set by the utility or an engineer, or the voltage is unknown. */
  minClearanceFt: number | null;
  /** The distance that triggers Options (1)-(3): 20 ft up to 350 kV, 50 ft over 350 to 1,000 kV, null above 1,000 kV or unknown. */
  thresholdFt: number | null;
  /** What decides the distance when no number applies. */
  decidedBy: "table" | "utility-or-engineer" | "voltage-needed";
  /** Plain-language summary for the screen (not verbatim). */
  summary: string;
  cites: Citation[];
}

export const TABLE_A: Row[] = data.tables.A.rows as Row[];
export const TABLE_T: Row[] = data.tables.T.rows as Row[];
const RULES: Record<string, Citation> = Object.fromEntries(
  data.rules.map((r) => [r.rule_id, { section_id: r.section_id, quote: r.quote }]),
);
export const rule = (id: string): Citation => {
  const r = RULES[id];
  if (!r) throw new Error(`unknown rule ${id}`);
  return r;
};

/** Row whose range holds kv. Upper bounds are inclusive ("over 50 to 200 means up to and including 200kV"). */
export function lookup(rows: Row[], kv: number): Row {
  if (!Number.isFinite(kv) || kv <= 0) throw new RangeError("voltage must be a positive number of kV");
  for (const r of rows) {
    if (kv > r.over_kv && (r.to_kv === null || kv <= r.to_kv)) return r;
  }
  throw new RangeError(`no row for ${kv} kV`);
}

export function voltageClass(kv: number): VoltageClass {
  return kv <= 350 ? "up-to-350" : kv <= 1000 ? "over-350-to-1000" : "over-1000";
}

function thresholdFor(cls: VoltageClass | null): number | null {
  return cls === "up-to-350" ? 20 : cls === "over-350-to-1000" ? 50 : null;
}

/**
 * Minimum clearance for an activity.
 * voltageKv: nominal kV AC from the utility, or null if not known yet.
 * knownClass: when the exact voltage is unknown but its class is (e.g. the utility says "under 350 kV").
 */
export function clearance(activity: Activity, voltageKv: number | null, knownClass: VoltageClass | null = null): ClearanceResult {
  const table = activity === "travel" ? "T" : "A";
  const rows = table === "T" ? TABLE_T : TABLE_A;
  const caption = (table === "T" ? data.tables.T.caption : data.tables.A.caption) as Citation;
  if (voltageKv === null) {
    const cls = knownClass;
    const thresholdFt = activity === "travel" ? null : thresholdFor(cls);
    const cites = [rule("presumed-energized"), rule("voltage-information")];
    if (cls === "up-to-350") cites.unshift(rule("option-2"));
    if (cls === "over-350-to-1000") cites.unshift(rule("over-350-to-1000"));
    if (cls === "over-1000") cites.unshift(rule("over-1000"));
    const summary = activity === "travel"
      ? "Table T needs the line's voltage. Get it from the utility before traveling near the line, and treat the line as energized."
      : thresholdFt !== null
        ? `Voltage unknown: Table A (Option 3) can't be used. Keep everything at least ${thresholdFt} ft away (Option 2) or have the line deenergized and grounded (Option 1). Treat the line as energized.`
        : cls === "over-1000"
          ? "Over 1,000 kV: the utility owner/operator or a qualified registered professional engineer sets the clearance."
          : "Voltage unknown: get it from the utility (they must answer within two working days when you use Option 3). Until then treat the line as energized and keep the equipment away from it.";
    return { activity, table, row: null, minClearanceFt: null, thresholdFt, decidedBy: cls === "over-1000" ? "utility-or-engineer" : "voltage-needed", summary, cites };
  }
  const row = lookup(rows, voltageKv);
  const cls = voltageClass(voltageKv);
  const thresholdFt = activity === "travel" ? null : thresholdFor(cls);
  const cites: Citation[] = [caption, row.cell];
  if (activity !== "travel") {
    cites.push(cls === "up-to-350" ? rule("twenty-foot-check") : cls === "over-350-to-1000" ? rule("over-350-to-1000") : rule("over-1000"));
  } else {
    cites.push(rule("travel-spotter"));
  }
  if (row.clearance_ft === null) {
    return { activity, table, row, minClearanceFt: null, thresholdFt, decidedBy: "utility-or-engineer",
      summary: `${voltageKv} kV is over 1,000 kV: the utility owner/operator or a qualified registered professional engineer sets the minimum clearance.`, cites };
  }
  const summary = activity === "travel"
    ? `Traveling with no load near a ${voltageKv} kV line: keep at least ${row.clearance_ft} ft (Table T).`
    : `${voltageKv} kV: Table A minimum clearance is ${row.clearance_ft} ft. If any part could get within ${thresholdFt} ft, use Option 1, 2 or 3 with the encroachment precautions.`;
  return { activity, table, row, minClearanceFt: row.clearance_ft, thresholdFt, decidedBy: "table", summary, cites };
}

export interface DistanceCheck { ok: boolean; marginFt: number | null; needsPrecautions: boolean; result: ClearanceResult }

/** Compare the closest planned approach (feet, any part of equipment, load line or load) to the clearance. */
export function checkApproach(activity: Activity, voltageKv: number | null, closestFt: number, knownClass: VoltageClass | null = null): DistanceCheck {
  const result = clearance(activity, voltageKv, knownClass);
  const limit = result.minClearanceFt ?? result.thresholdFt;
  if (limit === null) return { ok: false, marginFt: null, needsPrecautions: true, result };
  const marginFt = Math.round((closestFt - limit) * 100) / 100;
  const needsPrecautions = result.thresholdFt !== null && closestFt < result.thresholdFt;
  return { ok: closestFt >= limit, marginFt, needsPrecautions, result };
}
