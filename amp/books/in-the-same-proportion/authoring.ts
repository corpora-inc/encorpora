import type {
  BookBlock,
  BookPage,
  Diagram,
  Rational,
} from "../../src/publishing/schema.js";
import type { RatioTapeModel } from "../../src/publishing/ratio-models.js";
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
): BookBlock => ({
  kind: "worked",
  promptPresentation: "context",
  title,
  prompt,
  steps,
  conclusion,
});
export const tape = (
  id: string,
  unitLabel: string,
  rows: RatioTapeModel["rows"],
  caption: string,
  frameParts = 6,
  partValue?: Rational,
): BookBlock =>
  diagram({
    kind: "ratio-tape",
    id,
    unitLabel,
    rows,
    frameParts,
    ...(partValue ? { partValue } : {}),
    caption,
    alt:
      rows
        .map(
          (r) =>
            `${r.label}: ${r.parts} equal parts${r.total ? `, total ${r.total[0]}/${r.total[1]} ${unitLabel}` : "; total not given"}.`,
        )
        .join(" ") +
      " " +
      caption,
  });
export const grid = (
  id: string,
  count: number,
  wholeLabel: string,
  caption: string,
): BookBlock =>
  diagram({
    kind: "percent-grid",
    id,
    wholeLabel,
    shadedCells: Array.from({ length: count }, (_, i) => i),
    caption,
    alt: `${count} of 100 equal squares are selected. Whole: ${wholeLabel}. ${caption}`,
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
    alt:
      rows
        .map(
          (r) =>
            `${inputLabel} ${r.input[0]}/${r.input[1]}; ${outputLabel} ${r.output ? r.output[0] + "/" + r.output[1] : "unknown"}`,
        )
        .join(". ") +
      ". " +
      caption,
  });
export const line = (
  id: string,
  topLabel: string,
  bottomLabel: string,
  pairs: { top: Rational; bottom: Rational }[],
  caption: string,
): BookBlock =>
  diagram({
    kind: "double-line",
    id,
    topLabel,
    bottomLabel,
    pairs,
    caption,
    alt:
      pairs
        .map(
          (p) =>
            `${p.top[0]}/${p.top[1]} ${topLabel} matches ${p.bottom[0]}/${p.bottom[1]} ${bottomLabel}`,
        )
        .join("; ") +
      ". " +
      caption,
  });
const names: Record<string, string> = {
  entry: "Read the relationship",
  scale: "Scale together",
  rates: "Rate per one",
  models: "Pairs, graphs and rules",
  percent: "Name the whole",
  studio: "Design, test, return",
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
