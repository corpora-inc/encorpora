import { segments } from "../content/math-segments";
import { formPattern, normalizeForm, scanForms } from "./scan";
import { glossary, glossaryEntry } from "./index";
import type {
  GlossaryEntry,
  GlossaryLexicon,
  GlossarySenses,
  TermId,
} from "./types";

/** A piece of rendered text: a formula (never linked), prose, or a glossary
 * term as written in the prose. */
export type LinkSpan =
  | { kind: "math"; text: string; plain?: string }
  | { kind: "text"; text: string }
  | { kind: "term"; text: string; id: TermId };

/** How one lesson, method or template reads its words. `senses` names the
 * entry an ambiguous form means (lowercase form → id); `noLink` lists forms
 * used as ordinary words there. */
export type LinkContext = {
  senses?: GlossarySenses;
  noLink?: readonly string[];
};

/** A form that only `autoLink: false` entries carry, met with no sense. */
export type Unresolved = { form: string; candidates: TermId[] };

type Matcher = { owners: Map<string, GlossaryEntry[]>; pattern: RegExp };
let cached: Matcher | undefined;

function matcher(): Matcher {
  if (cached) return cached;
  const owners = new Map<string, GlossaryEntry[]>();
  for (const entry of glossary)
    for (const form of entry.forms) {
      const key = normalizeForm(form.toLowerCase());
      owners.set(key, [...(owners.get(key) ?? []), entry]);
    }
  return (cached = { owners, pattern: formPattern(owners.keys()) });
}

/** The entry a form means here, null for an ordinary word, or the
 * candidates when only a sense could decide. */
function resolve(
  form: string,
  context: LinkContext,
): TermId | null | Unresolved {
  if (
    context.noLink?.some((word) => normalizeForm(word.toLowerCase()) === form)
  )
    return null;
  const sense = context.senses?.[form];
  if (sense) return glossaryEntry(sense).id;
  const owners = matcher().owners.get(form) ?? [];
  const chosen = context.senses ? Object.values(context.senses) : [];
  const named = owners.find((entry) => chosen.includes(entry.id));
  if (named) return named.id;
  const auto = owners.filter((entry) => entry.autoLink !== false);
  if (auto.length === 1) return auto[0]!.id;
  return { form, candidates: owners.map((entry) => entry.id) };
}

/** Glossary terms in one prose run (no formulas), in order. `onMatch`
 * sees every form found and what it resolved to (null: an ordinary word or
 * unresolved). */
function scanProse(
  prose: string,
  context: LinkContext,
  onUnresolved?: (u: Unresolved) => void,
  onMatch?: (form: string, id: TermId | null) => void,
): { start: number; end: number; id: TermId }[] {
  const out: { start: number; end: number; id: TermId }[] = [];
  for (const { start, end, form } of scanForms(prose, matcher().pattern)) {
    const id = resolve(form, context);
    if (typeof id === "string") {
      onMatch?.(form, id);
      out.push({ start, end, id });
      continue;
    }
    onMatch?.(form, null);
    if (id !== null) onUnresolved?.(id);
  }
  return out;
}

/** Splits text into formulas, prose and linked terms. Words are matched
 * case-insensitively at word boundaries, longest form first, and never
 * inside `$…$` or a formula MathText would typeset. */
export function linkTerms(
  text: string,
  context: LinkContext = {},
  onUnresolved?: (u: Unresolved) => void,
): LinkSpan[] {
  const spans: LinkSpan[] = [];
  for (const segment of segments(text)) {
    if (segment.math) {
      spans.push({
        kind: "math",
        text: segment.text,
        ...(segment.plain !== undefined ? { plain: segment.plain } : {}),
      });
      continue;
    }
    let at = 0;
    for (const { start, end, id } of scanProse(
      segment.text,
      context,
      onUnresolved,
    )) {
      if (start > at)
        spans.push({ kind: "text", text: segment.text.slice(at, start) });
      spans.push({ kind: "term", text: segment.text.slice(start, end), id });
      at = end;
    }
    if (at < segment.text.length)
      spans.push({ kind: "text", text: segment.text.slice(at) });
  }
  return spans;
}

/** Ids of the glossary terms a text uses, in first-use order. */
export function termsIn(
  text: string,
  context: LinkContext = {},
  onUnresolved?: (u: Unresolved) => void,
): TermId[] {
  const ids: TermId[] = [];
  for (const span of linkTerms(text, context, onUnresolved))
    if (span.kind === "term" && !ids.includes(span.id)) ids.push(span.id);
  return ids;
}

/** One block (a lesson section, a method list, an explanation list) links
 * only the first use of each term, so a page stays calm. */
export function firstUses(block: readonly LinkSpan[][]): LinkSpan[][] {
  const seen = new Set<TermId>();
  return block.map((spans) => {
    const out: LinkSpan[] = [];
    for (const span of spans) {
      const plain =
        span.kind === "term" && seen.has(span.id)
          ? { kind: "text" as const, text: span.text }
          : span;
      if (span.kind === "term") seen.add(span.id);
      const last = out.at(-1);
      if (plain.kind === "text" && last?.kind === "text")
        out[out.length - 1] = { kind: "text", text: last.text + plain.text };
      else out.push(plain);
    }
    return out;
  });
}

/** How an entry's own definition reads its words: the senses are the terms
 * it lists in `uses`. */
export function entryContext(entry: GlossaryEntry): LinkContext {
  const senses: GlossarySenses = {};
  for (const id of entry.uses)
    for (const form of glossaryEntry(id).forms) senses[form] ??= id;
  // Its own forms stay ordinary words: an entry never links to itself.
  return { senses, noLink: [...(entry.noLink ?? []), ...entry.forms] };
}

/** Every form the linker finds in these texts, with the entry it means
 * there or null (an ordinary word, or ambiguous with no sense). A client that
 * matches only these forms links the texts exactly as `linkTerms` does,
 * without the glossary (`scan.ts`, `linkProse`). */
export function glossaryLexicon(
  texts: readonly string[],
  context: LinkContext = {},
): GlossaryLexicon {
  const lexicon: GlossaryLexicon = {};
  for (const text of texts)
    for (const segment of segments(text))
      if (!segment.math)
        scanProse(segment.text, context, undefined, (form, id) => {
          lexicon[form] = id;
        });
  return lexicon;
}
