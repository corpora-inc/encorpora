import { templates } from "../math/engine";
import {
  historicalTemplates,
  templateReplacements,
} from "../math/historical-templates";
import { linkTerms, type LinkContext } from "../glossary/link";
import { methodTermDefinitions } from "../glossary/resolve";
import type { TermId } from "../glossary/types";
import type { GradeBand } from "../curriculum/types";
import { lessons, type Lesson } from "./lessons";
import { methods } from "./problem-methods";
import { principles } from "./problem-principles";
import { hasProblemLesson, lessonGlossaryContext } from "./problem-lessons";
import {
  gradeBandOrder,
  referenceLessonBlocks,
  type LessonTextBlock,
} from "./lesson-text";
import { glossaryEntry } from "../glossary/index";
import { lessonUnits } from "./lesson-units";

/** The plain-language rules a machine can check (`src/content/AGENTS.md`,
 * "Plain-language standard"):
 *
 * - the first use of every glossary term on a screen sits in a sentence that
 *   defines it;
 * - no sentence in a summary, intuition, practice opening or goal has more
 *   than `MAX_WORDS` words.
 *
 * A screen is a reference lesson or one practice lesson. Each is walked in
 * render order: summary and intuition, worked example, method, watch for,
 * then principle and definitions. The parent note is for adults and is not
 * walked. A practice lesson's generated example is not walked either: it
 * changes with its generator, and `npm run review:plain` judges it. */
export const MAX_WORDS = 35;

/** One screen's violations: glossary terms whose first use there is not in a
 * defining sentence, and the over-long sentences of its summary, intuition,
 * opening or goal (each named by its first eight words). */
export type ScreenViolations = { terms: TermId[]; long: string[] };

/** A screen is `lesson:<lesson id>` or `practice:<template id>`. */
export type ScreenId = string;

/** Sentences of a text, split after . ! ? or ; outside `$…$`. A decimal
 * point or an abbreviation does not end a sentence. */
export function sentences(text: string): string[] {
  const out: string[] = [];
  let math = false;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (c === "$") math = !math;
    if (math || !".!?;".includes(c)) continue;
    const next = text.slice(i + 1);
    if (!/^\s+\S/.test(next)) continue;
    if (c === "." && /\b(e\.g|i\.e|vs|approx)$/i.test(text.slice(0, i)))
      continue;
    // After . ! ? a new sentence starts with a capital, digit, formula,
    // bracket or quote; a semicolon always ends a clause.
    if (c !== ";" && !/^\s+[A-Z0-9$(“"‘'[]/.test(next)) continue;
    out.push(text.slice(start, i + 1).trim());
    start = i + 1;
  }
  const rest = text.slice(start).trim();
  if (rest) out.push(rest);
  return out;
}

/** Words in a sentence; a formula counts as one word. */
export function wordCount(sentence: string) {
  return sentence
    .replace(/\$[^$]*\$/g, " x ")
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/** A long sentence's name in the baseline: its first eight words. */
export const sentenceKey = (sentence: string) =>
  sentence.replace(/\s+/g, " ").trim().split(" ").slice(0, 8).join(" ");

const before = [
  // "… is called a hypotenuse", "we write $x^2$", "let … be"
  String.raw`(?:called|named|known as|we write|written|stands? for|denoted|let)\s+(?:an?\s+|the\s+)?["“‘']?$`,
  // "we write $|x|$ for the absolute value"
  String.raw`\bwe write\b.*\bfor\s+(?:an?\s+|the\s+)?$`,
  // The term as the named thing: "the longest side is the hypotenuse",
  // "the two sides are the legs", "the result is their sum"
  String.raw`\b(?:is|are)\s+(?:also\s+)?(?:called\s+)?(?:the|a|an|its|their)\s+(?:[\p{L}’'-]+\s+){0,2}$`,
].map((p) => new RegExp(p, "iu"));
const after = [
  // "x is a …", "factors are …", "x means …", "x stands for …", "x is called"
  String.raw`^["”’']?\s*(?:\)|s)?\s*(?:is|are)\s+(?:called\s+|also\s+)?(?:a|an|the|one|two|how|what|when|where|any|each|every|all)\b`,
  String.raw`^["”’']?\s*(?:are|means?|stands? for|refers? to|tells|names?|is short for|is written|is read|has|have)\b`,
  // An appositive: "x, the …," "x (the …)", "x, which …", "x —". A list
  // ("the slope, the intercept and the vertex") is not one.
  String.raw`^["”’']?\s*(?:,|\(|—|–)\s*(?:the|a|an|which|or|also|one|its|their|how|what|where|when|any|each|every|all)\b(?![^,;:.)]*\b(?:and|or)\b[^,;:.)]*[.;]?$)`,
  // An explicit definition: "x, meaning …", "x, that is …", even when the
  // meaning itself names two things ("sides, meaning the left and the right").
  String.raw`^["”’']?\s*(?:,|\(|—|–)\s*(?:that is|meaning)\b`,
  // A colon definition: "x: …"
  String.raw`^["”’']?\s*:`,
].map((p) => new RegExp(p, "iu"));

/** Whether the term spanning [start, end) in a sentence is defined there. */
export function definesAt(sentence: string, start: number, end: number) {
  const head = sentence.slice(0, start);
  const tail = sentence.slice(end);
  return before.some((p) => p.test(head)) || after.some((p) => p.test(tail));
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Glossary terms in a sentence with their positions in it. The linker
 * returns spans, not offsets (a formula span need not keep its source text),
 * so each term is found again in the sentence: as a whole word, outside
 * `$…$`, after the previous term. */
function termsInSentence(sentence: string, context: LinkContext) {
  const found: { id: TermId; start: number; end: number }[] = [];
  const prose = sentence
    .replace(/’/g, "'")
    // A hyphen after a formula starts a word, as in the linker: "$y$-intercept".
    .replace(/\$[^$]*\$-?/g, (m) => " ".repeat(m.length));
  let at = 0;
  for (const span of linkTerms(sentence, context)) {
    if (span.kind !== "term") continue;
    const word = new RegExp(
      `(?<![\\p{L}\\p{N}'-])${escape(span.text.replace(/’/g, "'"))}(?![\\p{L}\\p{N}'-])`,
      "giu",
    );
    word.lastIndex = at;
    const match = word.exec(prose);
    if (!match) throw new Error(`"${span.text}" not found in "${sentence}"`);
    found.push({ id: span.id, start: match.index, end: word.lastIndex });
    at = word.lastIndex;
  }
  return found;
}

const lengthStages = new Set(["summary", "intuition", "goal"]);

/** Words first met in kindergarten to grade 2 (counting, equal, half, sum,
 * fraction, angle, …) count as known from grade 3 on. Every later word is
 * defined on each screen that uses it, at any level. */
const KNOWN_FROM = gradeBandOrder.indexOf("3");
export function mustDefine(term: TermId, band: GradeBand) {
  return (
    gradeBandOrder.indexOf(band) < KNOWN_FROM ||
    gradeBandOrder.indexOf(glossaryEntry(term).band) >= KNOWN_FROM
  );
}

/** A block of a screen. `lengthOnly`: held to the sentence limit but not on
 * screen. `measuredElsewhere`: its sentences are measured on another screen. */
export type ScreenBlock = LessonTextBlock & {
  lengthOnly?: boolean;
  measuredElsewhere?: boolean;
};

/** Violations on one screen, walked in render order. */
export function screenViolations(
  blocks: ScreenBlock[],
  context: LinkContext,
  band: GradeBand,
): ScreenViolations {
  const seen = new Set<TermId>();
  const terms: TermId[] = [];
  const long: string[] = [];
  for (const block of blocks) {
    if (block.stage === "partner") continue;
    for (const line of block.lines) {
      if (/^(Figure|Illustration): /.test(line)) continue;
      const prose = line.replace(/^(Problem|Step \d+|Choice \d+|Answer): /, "");
      for (const sentence of sentences(prose)) {
        if (
          lengthStages.has(block.stage) &&
          !block.measuredElsewhere &&
          wordCount(sentence) > MAX_WORDS
        )
          long.push(sentenceKey(sentence));
        if (block.lengthOnly) continue;
        for (const { id, start, end } of termsInSentence(sentence, context)) {
          if (seen.has(id) || !mustDefine(id, band)) continue;
          seen.add(id);
          if (!definesAt(sentence, start, end)) terms.push(id);
        }
      }
    }
  }
  return { terms, long };
}

const templateById = new Map(
  [...templates, ...historicalTemplates].map((t) => [t.id, t]),
);

/** A practice lesson's authored text in render order, as `problemLesson()`
 * builds it, without the generated example. The goal is not on screen; it is
 * held to the sentence limit only. Sentences the reference summary already
 * shows are measured there, not again. */
export function practiceBlocks(templateId: string): ScreenBlock[] {
  const id = templateReplacements[templateId] ?? templateId;
  const template = templateById.get(templateId);
  const authored = methods[id];
  const reference = lessons.find((l) => l.templateIds.includes(id));
  const goal = authored?.goal ?? template?.description ?? "";
  const opening =
    authored?.intuition ?? reference?.summary ?? authored?.goal ?? goal;
  const watch = authored?.watch ?? reference?.pitfalls[0];
  const principle = principles[id];
  const terms = methodTermDefinitions(authored?.terms ?? []);
  return [
    {
      stage: "intuition",
      label: "opening",
      lines: [opening],
      ...(opening === reference?.summary ? { measuredElsewhere: true } : {}),
    },
    { stage: "method", label: "method", lines: authored?.method ?? [goal] },
    ...(watch
      ? [{ stage: "watch" as const, label: "watch for", lines: [watch] }]
      : []),
    {
      stage: "formal",
      label: "principle and definitions",
      lines: [
        ...(principle ? [principle] : []),
        ...terms.map((t) => `${t.term}: ${t.meaning}`),
      ],
    },
    ...(goal && goal !== opening
      ? [
          {
            stage: "goal" as const,
            label: "goal",
            lines: [goal],
            lengthOnly: true,
          },
        ]
      : []),
  ];
}

const lessonContext = (lesson: Lesson): LinkContext => ({
  senses: lesson.senses,
  noLink: lesson.noLink,
});

/** Every screen's violations and band: each reference lesson, then the
 * practice lesson of every template. */
export function plainLanguageViolations(): Map<
  ScreenId,
  ScreenViolations & { band: GradeBand }
> {
  const out = new Map<ScreenId, ScreenViolations & { band: GradeBand }>();
  for (const unit of lessonUnits()) {
    if (unit.lesson)
      out.set(`lesson:${unit.lesson.id}`, {
        band: unit.band,
        ...screenViolations(
          referenceLessonBlocks(unit.lesson),
          lessonContext(unit.lesson),
          unit.band,
        ),
      });
    for (const templateId of unit.templateIds) {
      if (!hasProblemLesson(templateId)) continue;
      const context = lessonGlossaryContext(
        templateReplacements[templateId] ?? templateId,
        templateById.get(templateId),
      );
      out.set(`practice:${templateId}`, {
        band: unit.band,
        ...screenViolations(practiceBlocks(templateId), context, unit.band),
      });
    }
  }
  return out;
}

/** A progress report on the plain-language rules: counts per band, the
 * terms most often used before they are defined, and every screen's
 * violations. It never fails anything; quality comes from the standard, the
 * judge (`npm run review:plain`) and review. */
export function plainLanguageReport(top = 20) {
  const all = plainLanguageViolations();
  const screens = [...all.entries()].sort(([a], [b]) => a.localeCompare(b));
  const bands = gradeBandOrder
    .map((band) => {
      const rows = screens.filter(([, v]) => v.band === band).map(([, v]) => v);
      return {
        band,
        screens: rows.length,
        clear: rows.filter((v) => !v.terms.length && !v.long.length).length,
        undefinedFirstUses: rows.reduce((n, v) => n + v.terms.length, 0),
        longSentences: rows.reduce((n, v) => n + v.long.length, 0),
      };
    })
    .filter((row) => row.screens > 0);
  const counts = new Map<TermId, number>();
  for (const [, v] of screens)
    for (const t of v.terms) counts.set(t, (counts.get(t) ?? 0) + 1);
  const topTerms = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, top)
    .map(([term, screens]) => ({ term, screens }));
  return {
    bands,
    topTerms,
    screens: Object.fromEntries(
      screens
        .filter(([, v]) => v.terms.length || v.long.length)
        .map(([id, v]) => [id, { band: v.band, terms: v.terms, long: v.long }]),
    ),
  };
}

/** The report as a markdown table, for logs and pull requests. */
export function plainLanguageReportTable(
  report: ReturnType<typeof plainLanguageReport>,
) {
  const sum = (
    k: "screens" | "clear" | "undefinedFirstUses" | "longSentences",
  ) => report.bands.reduce((n, b) => n + b[k], 0);
  return [
    "| Band | Screens | Clear | Undefined first uses | Long sentences |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...report.bands.map(
      (b) =>
        `| ${b.band} | ${b.screens} | ${b.clear} | ${b.undefinedFirstUses} | ${b.longSentences} |`,
    ),
    `| all | ${sum("screens")} | ${sum("clear")} | ${sum("undefinedFirstUses")} | ${sum("longSentences")} |`,
    "",
    "Most often undefined: " +
      report.topTerms.map((t) => `${t.term} (${t.screens})`).join(", "),
  ].join("\n");
}
