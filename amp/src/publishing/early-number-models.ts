/** Cell indexes are zero-based. Counts are derived from explicit unique cells. */
export type EarlyNumberModel =
  | {
      kind: "ten-frame";
      frames: 1 | 2;
      occupied: number[];
      emphasized?: number[];
      emphasisLabel?: string;
      unitLabel: string;
    }
  | {
      kind: "base-ten";
      tens: number;
      ones: number;
      emphasizedTens?: number[];
      emphasizedOnes?: number[];
      emphasisLabel?: string;
      unitLabel: string;
    }
  | {
      kind: "count-collection";
      unitLabel: string;
      icon: "circle" | "square";
      relationship: "single" | "conserved" | "comparison";
      panels: {
        label: string;
        cells: { column: number; row: number }[];
        emphasized?: number[];
        emphasisLabel?: string;
      }[];
    };
export const isEarlyNumberModel = (d: {
  kind: string;
}): d is EarlyNumberModel =>
  ["ten-frame", "base-ten", "count-collection"].includes(d.kind);
function requireValue(ok: boolean, message: string): asserts ok {
  if (!ok) throw new Error(`Early-number model: ${message}`);
}
function integer(n: number, min: number, max: number) {
  requireValue(
    Number.isSafeInteger(n) && n >= min && n <= max,
    "integer out of range",
  );
}
function label(value: string, max = 28) {
  requireValue(
    typeof value === "string" && !!value.trim() && value.length <= max,
    "missing or long label",
  );
}
function indexes(values: number[], limit: number) {
  requireValue(Array.isArray(values), "expected cell indexes");
  requireValue(
    new Set(values).size === values.length,
    "duplicate cell indexes",
  );
  for (const value of values) integer(value, 0, limit - 1);
}
function emphasis(
  values: number[] | undefined,
  available: number[],
  text: string | undefined,
) {
  indexes(values ?? [], Math.max(0, ...available) + 1);
  requireValue(
    (values ?? []).every((v) => available.includes(v)),
    "emphasis must name existing cells",
  );
  if (values?.length) label(text ?? "");
  else requireValue(text === undefined, "empty emphasis cannot have a legend");
}
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
export function validateEarlyNumberModel(d: EarlyNumberModel): void {
  label(d.unitLabel);
  switch (d.kind) {
    case "ten-frame":
      integer(d.frames, 1, 2);
      indexes(d.occupied, d.frames * 10);
      emphasis(d.emphasized, d.occupied, d.emphasisLabel);
      break;
    case "base-ten":
      integer(d.tens, 0, 6);
      integer(d.ones, 0, 19);
      indexes(d.emphasizedTens ?? [], d.tens);
      indexes(d.emphasizedOnes ?? [], d.ones);
      if ((d.emphasizedTens?.length ?? 0) + (d.emphasizedOnes?.length ?? 0))
        label(d.emphasisLabel ?? "");
      else
        requireValue(
          d.emphasisLabel === undefined,
          "empty emphasis cannot have a legend",
        );
      break;
    case "count-collection":
      requireValue(["circle", "square"].includes(d.icon), "unknown unit icon");
      requireValue(
        ["single", "conserved", "comparison"].includes(d.relationship),
        "unknown panel relationship",
      );
      requireValue(
        Array.isArray(d.panels) &&
          d.panels.length === (d.relationship === "single" ? 1 : 2),
        "wrong panel count",
      );
      requireValue(
        new Set(d.panels.map((p) => p.label)).size === d.panels.length,
        "panel labels must differ",
      );
      for (const panel of d.panels) {
        label(panel.label, 16);
        requireValue(
          Array.isArray(panel.cells) && panel.cells.length <= 20,
          "collection exceeds twenty units",
        );
        for (const cell of panel.cells) {
          integer(cell.column, 0, 5);
          integer(cell.row, 0, 3);
        }
        requireValue(
          new Set(panel.cells.map((c) => `${c.column}:${c.row}`)).size ===
            panel.cells.length,
          "overlapping collection units",
        );
        emphasis(
          panel.emphasized,
          range(panel.cells.length),
          panel.emphasisLabel,
        );
      }
      if (d.relationship === "conserved")
        requireValue(
          d.panels[0]!.cells.length === d.panels[1]!.cells.length,
          "conserved panels must have equal quantities",
        );
      break;
  }
}
