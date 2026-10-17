import { diagram } from "./authoring.js";
const sequence = (count: number) => Array.from({ length: count }, (_, i) => i);
export const frame = (
  id: string,
  count: number,
  caption: string,
  options: { frames?: 1 | 2; emphasized?: number[]; legend?: string } = {},
) => {
  const frames = options.frames ?? (count > 10 ? 2 : 1);
  if (!Number.isInteger(count) || count < 0 || count > frames * 10)
    throw new Error(`Invalid authored frame count: ${id}`);
  return diagram({
    kind: "ten-frame",
    id,
    frames,
    occupied: sequence(count),
    unitLabel: "counter",
    ...(options.emphasized
      ? { emphasized: options.emphasized, emphasisLabel: options.legend }
      : {}),
    caption,
    alt: `${frames} ten-frame${frames === 1 ? "" : "s"}, each with two rows of five places. ${count} places contain counters; ${frames * 10 - count} places are empty.${options.emphasized ? ` ${options.emphasized.length} counters are marked: ${options.legend}.` : ""}`,
  });
};
const spread = [
  { column: 0, row: 0 },
  { column: 4, row: 0 },
  { column: 2, row: 1 },
  { column: 5, row: 2 },
  { column: 0, row: 3 },
  { column: 3, row: 3 },
  { column: 1, row: 2 },
  { column: 5, row: 0 },
  { column: 3, row: 1 },
  { column: 2, row: 3 },
];
export const collection = (
  id: string,
  panels: { label: string; count: number; arrangement: "rows" | "spread" }[],
  caption: string,
  relationship: "single" | "conserved" | "comparison" = "single",
) => {
  for (const p of panels)
    if (
      !Number.isInteger(p.count) ||
      p.count < 0 ||
      p.count > 20 ||
      (p.arrangement === "spread" && p.count > 10)
    )
      throw new Error(`Invalid authored collection: ${id}`);
  return diagram({
    kind: "count-collection",
    id,
    unitLabel: "counter",
    icon: "circle",
    relationship,
    panels: panels.map((p) => ({
      label: p.label,
      cells:
        p.arrangement === "spread"
          ? spread.slice(0, p.count)
          : sequence(p.count).map((i) => ({
              column: i % 5,
              row: Math.floor(i / 5),
            })),
    })),
    caption,
    alt: panels
      .map(
        (p) =>
          `${p.label}: ${p.count} counters${p.count === 0 ? " on an empty mat" : p.arrangement === "spread" ? " spread across the mat" : " arranged in rows of up to five"}.`,
      )
      .join(" "),
  });
};
export const tens = (
  id: string,
  tenCount: number,
  ones: number,
  caption: string,
  options: {
    emphasizedTens?: number[];
    emphasizedOnes?: number[];
    legend?: string;
  } = {},
) =>
  diagram({
    kind: "base-ten",
    id,
    tens: tenCount,
    ones,
    unitLabel: "one",
    ...(options.emphasizedTens
      ? { emphasizedTens: options.emphasizedTens }
      : {}),
    ...(options.emphasizedOnes
      ? { emphasizedOnes: options.emphasizedOnes }
      : {}),
    ...(options.legend ? { emphasisLabel: options.legend } : {}),
    caption,
    alt: `${tenCount} ten-strips of ten equal unit squares each and ${ones} loose unit squares.${options.legend ? ` Marked units: ${options.legend}.` : ""}`,
  });
