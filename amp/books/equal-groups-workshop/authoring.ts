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
    const grouped: typeof this.keys = {
      ...this.keys,
      meaning: [...(this.keys.entry ?? []), ...(this.keys.meaning ?? [])],
    };
    delete grouped.entry;
    for (const [section, entries] of Object.entries(grouped)) {
      let cursor = 0;
      const count = Math.ceil(entries.length / 5);
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
  entry: "Your workshop route",
  meaning: "Meaning · Build equal groups",
  strategies: "Strategies · Break apart and connect",
  division: "Division · Find the missing quantity",
  decisions: "Decisions · Interpret and compare",
  transfer: "Transfer · Choose, explain, return",
};
