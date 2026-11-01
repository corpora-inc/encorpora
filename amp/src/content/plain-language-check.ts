import { templates } from "../math/engine";
import { templateReplacements } from "../math/historical-templates";
import { linkTerms, type LinkContext } from "../glossary/link";
import { methodTermDefinitions } from "../glossary/resolve";
import type { TermId } from "../glossary/types";
import type { GradeBand } from "../curriculum/types";
import { lessons, type Lesson } from "./lessons";
import { methods } from "./problem-methods";
import { principles } from "./problem-principles";
import { lessonGlossaryContext } from "./problem-lessons";
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

export type PlainLanguageViolations = {
  /** `<screen>/<term id>`: a term whose first use on that screen is not in a
   * defining sentence. The screen is `lesson` or a template id. */
  undefined: string[];
  /** Sentences in a summary, intuition, opening or goal over `MAX_WORDS`. */
  long: number;
};

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
  // An appositive: "x, the …," "x (the …)", "x, meaning …", "x, or …", "x —"
  String.raw`^["”’']?\s*(?:,|\(|—|–)\s*(?:the|a|an|which|that is|meaning|or|also|one|its|their|how|what|where|when|any|each|every|all)\b`,
  // A colon definition: "x: …"
  String.raw`^["”’']?\s*:`,
].map((p) => new RegExp(p, "iu"));

/** Whether the term spanning [start, end) in a sentence is defined there. */
export function definesAt(sentence: string, start: number, end: number) {
  const head = sentence.slice(0, start);
  const tail = sentence.slice(end);
  return before.some((p) => p.test(head)) || after.some((p) => p.test(tail));
}

/** Glossary terms in a sentence with their positions in it. */
function termsInSentence(sentence: string, context: LinkContext) {
  const found: { id: TermId; start: number; end: number }[] = [];
  // Formula spans may not keep their source text, so each term is located
  // in the sentence itself, after the previous one.
  const lower = sentence.toLowerCase().replace(/’/g, "'");
  let at = 0;
  for (const span of linkTerms(sentence, context)) {
    if (span.kind !== "term") continue;
    const start = lower.indexOf(span.text.toLowerCase().replace(/’/g, "'"), at);
    if (start < 0) continue;
    found.push({ id: span.id, start, end: start + span.text.length });
    at = start + span.text.length;
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

/** Violations on one screen, in render order. */
export function screenViolations(
  screen: string,
  blocks: LessonTextBlock[],
  context: LinkContext,
  band: GradeBand,
): PlainLanguageViolations {
  const seen = new Set<TermId>();
  const undefinedTerms: string[] = [];
  let long = 0;
  for (const block of blocks) {
    if (block.stage === "partner") continue;
    for (const line of block.lines) {
      if (/^(Figure|Illustration): /.test(line)) continue;
      const prose = line.replace(/^(Problem|Step \d+|Choice \d+|Answer): /, "");
      for (const sentence of sentences(prose)) {
        if (lengthStages.has(block.stage) && wordCount(sentence) > MAX_WORDS)
          long++;
        for (const { id, start, end } of termsInSentence(sentence, context)) {
          if (seen.has(id) || !mustDefine(id, band)) continue;
          seen.add(id);
          if (!definesAt(sentence, start, end))
            undefinedTerms.push(`${screen}/${id}`);
        }
      }
    }
  }
  return { undefined: undefinedTerms, long };
}

/** A practice lesson's authored text in render order, as `problemLesson()`
 * builds it, without the generated example. Its goal is checked for length
 * only; the screen shows its opening. */
export function practiceBlocks(templateId: string): LessonTextBlock[] {
  const id = templateReplacements[templateId] ?? templateId;
  const template = templates.find((t) => t.id === templateId);
  const authored = methods[id];
  const reference = lessons.find((l) => l.templateIds.includes(id));
  const goal = authored?.goal ?? template?.description ?? "";
  const opening =
    authored?.intuition ?? reference?.summary ?? authored?.goal ?? goal;
  const watch = authored?.watch ?? reference?.pitfalls[0];
  const principle = principles[id];
  const terms = methodTermDefinitions(authored?.terms ?? []);
  return [
    { stage: "intuition", label: "opening", lines: [opening] },
    {
      stage: "method",
      label: "method",
      lines: authored?.method ?? [goal],
    },
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
    // Not rendered beside the opening; held to the sentence limit only.
    ...(goal ? [{ stage: "goal" as const, label: "goal", lines: [goal] }] : []),
  ];
}

const lessonContext = (lesson: Lesson): LinkContext => ({
  senses: lesson.senses,
  noLink: lesson.noLink,
});

/** Every lesson unit's violations, keyed by unit id (`lessonUnits()`). */
export function plainLanguageViolations(): Record<
  string,
  PlainLanguageViolations & { band: GradeBand }
> {
  const out: Record<string, PlainLanguageViolations & { band: GradeBand }> = {};
  for (const unit of lessonUnits()) {
    const screens: PlainLanguageViolations[] = [];
    if (unit.lesson)
      screens.push(
        screenViolations(
          "lesson",
          referenceLessonBlocks(unit.lesson),
          lessonContext(unit.lesson),
          unit.band,
        ),
      );
    for (const templateId of unit.templateIds) {
      const blocks = practiceBlocks(templateId);
      const context = lessonGlossaryContext(
        templateReplacements[templateId] ?? templateId,
      );
      // The goal is not on screen: it only counts toward sentence length.
      const shown = screenViolations(
        templateId,
        blocks.filter((b) => b.stage !== "goal"),
        context,
        unit.band,
      );
      const goalLong = blocks
        .filter((b) => b.stage === "goal")
        .flatMap((b) => b.lines.flatMap(sentences))
        .filter((s) => wordCount(s) > MAX_WORDS).length;
      screens.push({ undefined: shown.undefined, long: shown.long + goalLong });
    }
    out[unit.id] = {
      band: unit.band,
      undefined: screens.flatMap((s) => s.undefined),
      long: screens.reduce((n, s) => n + s.long, 0),
    };
  }
  return out;
}

/** The recorded violations: unit id → its violations. Units with none are
 * left out. */
export type PlainLanguageBaseline = Record<string, PlainLanguageViolations>;

/** The current violations in baseline form, sorted for stable diffs. */
export function currentBaseline(): PlainLanguageBaseline {
  const out: PlainLanguageBaseline = {};
  const all = plainLanguageViolations();
  for (const id of Object.keys(all).sort()) {
    const v = all[id]!;
    if (v.undefined.length || v.long)
      out[id] = { undefined: [...new Set(v.undefined)].sort(), long: v.long };
  }
  return out;
}

/** What changed against the baseline: violations it does not record (grown)
 * and recorded ones that are gone (stale). */
export function diffBaseline(
  current: PlainLanguageBaseline,
  baseline: PlainLanguageBaseline,
) {
  const grown: string[] = [];
  const stale: string[] = [];
  for (const id of new Set([
    ...Object.keys(current),
    ...Object.keys(baseline),
  ])) {
    const now = current[id] ?? { undefined: [], long: 0 };
    const was = baseline[id] ?? { undefined: [], long: 0 };
    for (const term of now.undefined)
      if (!was.undefined.includes(term)) grown.push(`${id}: ${term}`);
    for (const term of was.undefined)
      if (!now.undefined.includes(term)) stale.push(`${id}: ${term}`);
    if (now.long > was.long)
      grown.push(`${id}: ${now.long} long sentences (baseline ${was.long})`);
    if (now.long < was.long)
      stale.push(`${id}: ${now.long} long sentences (baseline ${was.long})`);
  }
  return { grown, stale };
}
