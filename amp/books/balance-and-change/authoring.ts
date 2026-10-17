import type {
  BookBlock,
  BookPage,
  Diagram,
} from "../../src/publishing/schema.js";
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
export const array = (
  id: string,
  rows: number,
  columns: number,
  caption: string,
  split?: { row?: number; column?: number },
  labels?: { row: string; column: string },
): BookBlock =>
  diagram({
    kind: "array",
    id,
    rows,
    columns,
    rowLabel: labels?.row ?? `${rows} rows`,
    columnLabel: labels?.column ?? `${columns} in each row`,
    ...(split?.row ? { splitAfterRow: split.row } : {}),
    ...(split?.column ? { splitAfterColumn: split.column } : {}),
    caption,
    alt: `${rows} rows of ${columns} equal cells.${split?.row ? ` A horizontal line separates the first ${split.row} rows.` : ""}${split?.column ? ` A vertical line separates the first ${split.column} columns.` : ""} ${caption}`,
  });
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
      eyebrow: sectionNames[this.section] ?? this.section,
      kind,
      blocks,
      ...(subtitle ? { subtitle } : {}),
    });
  }
  finish() {
    const grouped = this.keys;
    for (const [section, entries] of Object.entries(grouped)) {
      let cursor = 0;
      const count = Math.ceil(entries.length / 4);
      for (let i = 0; i < count; i++) {
        const size = Math.ceil((entries.length - cursor) / (count - i));
        this.pages.push({
          id: `solutions-${section}-${i + 1}`,
          kind: "solutions",
          eyebrow: "Reasoned solutions",
          title: `${sectionNames[section]} · ${i + 1}`,
          blocks: entries.slice(cursor, cursor + size),
        });
        cursor += size;
      }
    }
    return this.pages;
  }
}
const sectionNames: Record<string, string> = {
  entry: "Find your starting point",
  expressions: "Expressions · Read the structure",
  equations: "Equality · Keep the same solutions",
  relationships: "Relationships · Connect quantities",
  models: "Change · Build and compare rules",
  transfer: "Transfer · Decide, explain, return",
};

export const balance = (
  id: string,
  left: { bags: number; units: number },
  right: { bags: number; units: number },
  caption: string,
): BookBlock =>
  diagram({
    kind: "balance",
    id,
    unknownLabel: "x",
    unitLabel: "one gram",
    left,
    right,
    caption,
    alt: `Left pan: ${left.bags} identical unknown bags and ${left.units} grams. Right pan: ${right.bags} identical unknown bags and ${right.units} grams. The pans balance.`,
  });
export const table = (
  id: string,
  inputLabel: string,
  outputLabel: string,
  rows: { input: [number, number]; output: [number, number] | null }[],
  caption: string,
): BookBlock =>
  diagram({
    kind: "value-table",
    id,
    inputLabel,
    outputLabel,
    rows,
    caption,
    alt: `${inputLabel} and ${outputLabel}. ${rows.map((row) => `${row.input.join("/")} maps to ${row.output?.join("/") ?? "an unknown output"}`).join("; ")}.`,
  });
export const plot = (
  id: string,
  model: Omit<
    Extract<Diagram, { kind: "coordinate-plot" }>,
    "kind" | "id" | "alt" | "caption"
  >,
  caption: string,
): BookBlock => {
  const label = ([n, d]: [number, number]) =>
    d === 1 ? String(n) : `${n}/${d}`;
  return diagram({
    kind: "coordinate-plot",
    id,
    ...model,
    caption,
    alt: `Horizontal axis: ${model.xLabel}, from ${model.xMin} to ${model.xMax}, step ${model.xStep}. Vertical axis: ${model.yLabel}, from ${model.yMin} to ${model.yMax}, step ${model.yStep}. ${model.points.map((p) => `${p.label ?? "Point"} (${label(p.x)}, ${label(p.y)})`).join("; ")}. ${(model.lines ?? []).map((l) => `Line ${l.label}: slope ${label(l.slope)}, intercept ${label(l.intercept)}${l.domain ? `, closed input interval ${label(l.domain[0])} to ${label(l.domain[1])}` : ", continuing beyond the window"}`).join(". ")}. ${(model.segments ?? []).map((s) => `Segment ${s.label ?? ""}: (${label(s.from.x)}, ${label(s.from.y)}) to (${label(s.to.x)}, ${label(s.to.y)})`).join("; ")}`,
  });
};
