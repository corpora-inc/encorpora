import type {
  BookBlock,
  BookPage,
  Diagram,
  Rational,
} from "../../src/publishing/schema.js";
import type {
  UnitRegionModel,
  GridPoint,
} from "../../src/publishing/unit-regions.js";
export const text = (text: string): BookBlock => ({ kind: "text", text });
export const note = (
  title: string,
  text: string,
  tone: "notice" | "predict" | "misconception" | "connect" = "notice",
): BookBlock => ({ kind: "callout", title, text, tone });
export const diagram = (diagram: Diagram): BookBlock => ({
  kind: "diagram",
  diagram,
});
export const worked = (
  title: string,
  prompt: string,
  steps: string[],
  conclusion: string,
): BookBlock => ({ kind: "worked", title, prompt, steps, conclusion });
export const cells = (columns: number, rows: number): GridPoint[] =>
  Array.from({ length: columns * rows }, (_, i) => ({
    column: i % columns,
    row: Math.floor(i / columns),
  }));
export const elbow = (): GridPoint[] =>
  cells(6, 5).filter((p) => p.column < 4 || p.row >= 3);
export const region = (
  id: string,
  model: Omit<UnitRegionModel, "kind">,
  caption: string,
): BookBlock =>
  diagram({
    kind: "unit-region",
    id,
    ...model,
    caption,
    alt: `Equal square units with side length 1 ${model.unit}. Occupied cells, listed by zero-based row and column: ${model.cells.map((p) => `(${p.row},${p.column})`).join(" ")}. ${model.showGrid ? "Unit grid visible." : "Only the outside boundary is drawn."} ${(model.partitions ?? []).map((p) => `Interior guide from column ${p.from.column}, row ${p.from.row} to column ${p.to.column}, row ${p.to.row}.`).join(" ")} ${caption}`,
  });
export const rectangle = (
  id: string,
  width: number,
  height: number,
  caption: string,
  showGrid = true,
  unit: "cm" | "m" | "unit" = "cm",
  scaleFrame?: { columns: number; rows: number },
): BookBlock =>
  region(
    id,
    {
      unit,
      cells: cells(width, height),
      showGrid,
      ...(scaleFrame ? { scaleFrame } : {}),
      edgeLabels: [
        {
          from: { column: 0, row: 0 },
          to: { column: width, row: 0 },
          side: "above",
        },
        {
          from: { column: 0, row: 0 },
          to: { column: 0, row: height },
          side: "left",
        },
      ],
    },
    caption,
  );
export const ruler = (
  id: string,
  min: number,
  max: number,
  divisions: number,
  marks: { at: Rational; label: string }[],
  caption: string,
  jumps: { from: Rational; to: Rational; label: string }[] = [],
): BookBlock =>
  diagram({
    kind: "number-line",
    id,
    wholeLabel: "One numbered interval represents 1 cm",
    min: [min, 1],
    max: [max, 1],
    divisionsPerUnit: divisions,
    marks,
    jumps,
    caption,
    alt: `Schematic centimeter scale from ${min} to ${max}, with ${divisions} equal intervals per centimeter. ${marks.map((m) => `${m.label} at ${m.at[0]}/${m.at[1]} cm`).join("; ")}. This printed drawing is not a life-size ruler.`,
  });
export const table = (
  id: string,
  inputLabel: string,
  outputLabel: string,
  rows: { input: Rational; output: Rational | null }[],
  caption: string,
): BookBlock =>
  diagram({
    kind: "value-table",
    id,
    inputLabel,
    outputLabel,
    rows,
    caption,
    alt: `${inputLabel} and ${outputLabel}: ${rows.map((r) => `${r.input[0]}/${r.input[1]} corresponds to ${r.output ? `${r.output[0]}/${r.output[1]}` : "a missing value"}`).join("; ")}. ${caption}`,
  });
const names: Record<string, string> = {
  entry: "Choose the quantity",
  length: "Length · Count the spaces",
  border: "Border · Walk the outside",
  cover: "Cover · Build square units",
  compare: "Compare · Change one condition",
  units: "Units · Rename the same measure",
  studio: "Studio · Design, test, return",
};
export class Author {
  pages: BookPage[] = [];
  keys: Record<string, Extract<BookBlock, { kind: "solution" }>[]> = {};
  section = "entry";
  task(
    id: string,
    prompt: string,
    answer: string,
    reasoning: string,
    check?: string,
    size: "short" | "medium" | "large" | "extended" = "medium",
    kind: "lines" | "grid" | "blank" = "lines",
  ): BookBlock {
    (this.keys[this.section] ??= []).push({
      kind: "solution",
      taskId: id,
      answer,
      reasoning,
      ...(check ? { check } : {}),
    });
    return { kind: "task", id, prompt, response: { kind, size } };
  }
  page(
    id: string,
    title: string,
    blocks: BookBlock[],
    kind: BookPage["kind"] = "lesson",
    subtitle?: string,
  ) {
    this.pages.push({
      id,
      title,
      eyebrow: names[this.section] ?? this.section,
      kind,
      blocks,
      ...(subtitle ? { subtitle } : {}),
    });
  }
  finish() {
    for (const [section, entries] of Object.entries(this.keys)) {
      let cursor = 0;
      const count = Math.ceil(entries.length / 4);
      for (let i = 0; i < count; i++) {
        const size = Math.ceil((entries.length - cursor) / (count - i));
        this.pages.push({
          id: `solutions-${section}-${i + 1}`,
          kind: "solutions",
          eyebrow: "Reasoned solutions",
          title: `${names[section]} · ${i + 1}`,
          blocks: entries.slice(cursor, cursor + size),
        });
        cursor += size;
      }
    }
    return this.pages;
  }
}
