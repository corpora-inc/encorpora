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
    size: "short" | "medium" | "large" | "extended" = "large",
    kind: "lines" | "grid" | "blank" = "blank",
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
  entry: "Look · Build · Tell",
  counting: "How many?",
  partners: "Parts that fit",
  tens: "A ten is a unit",
  stories: "What changed?",
  strategies: "Use what you know",
  transfer: "Make it yours",
};
