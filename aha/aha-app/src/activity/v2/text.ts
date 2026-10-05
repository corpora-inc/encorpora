/**
 * Activity Spec v2 templates: prose with `{{placeholders}}` bound to the model (README §6).
 *
 * The model writes text and TeX with placeholders where numbers, nouns and view names go; the app
 * resolves every placeholder from the model, so the prose cannot state a number of its own. This
 * module is the mechanism only: parsing, the closed-list prose rules, and rendering through a
 * resolver. What a placeholder may name where (the reveal, leak and masking policy) is decided by
 * the validator, which supplies the resolver.
 *
 * Grammar. A text block is v1 rich text (plain text with inline `$TeX$`, a literal dollar written
 * `\$`); a math block is TeX. In both, `{{path}}` is a placeholder, where path is an id followed by
 * at most two lowercase member names (`g`, `s.total`, `s.groups.one`). Inside math, `{{` is always
 * a placeholder.
 *
 * Closed-list prose rules (never NLU): no numerals of any script outside placeholders, no number
 * words of two or more, and no view-kind words outside `{{s.view}}`.
 *
 * Safety runs on the result: rendered text passes v1's rich-text rules and rendered TeX passes v1's
 * TeX rules (denylist, KaTeX parse, words in math only inside `\text{}`).
 */
import { checkRichText, checkTex, splitRichText } from '../text';
import type { Issue, Result, Rich } from './quantity';

export type TemplMode = 'text' | 'math';
export interface Placeholder {
  /** id, then members: ["s", "groups", "one"]. */
  path: readonly string[];
  /** True when the placeholder sits inside TeX (a math block, or `$…$` in text). */
  math: boolean;
}
type Node = { k: 'lit'; text: string } | { k: 'ph'; ph: Placeholder };
interface Segment { kind: TemplMode; nodes: Node[] }
export interface Templ { mode: TemplMode; segments: Segment[]; placeholders: Placeholder[] }

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = (code: string, message: string): { ok: false; error: Issue } => ({ ok: false, error: { code, message } });

export const PLACEHOLDER_PATH = /^[a-z][a-z0-9]{0,7}(?:\.[a-z]{1,16}){0,2}$/;
const MAX_PLACEHOLDERS = 24;

/** Split one segment's source into literal text and placeholders. */
function scan(source: string, math: boolean): Result<Node[]> {
  const nodes: Node[] = [];
  let i = 0;
  while (i < source.length) {
    let open = source.indexOf('{{', i);
    // In a run of braces the placeholder opens at the last two, so "\frac{{{a.n}}}{…}" is a TeX group around {{a.n}}.
    while (open >= 0 && source[open + 2] === '{') open++;
    const literal = source.slice(i, open < 0 ? source.length : open);
    // Outside math a stray "}}" means a broken placeholder; in TeX it closes nested groups ("\frac{a}{\sqrt{b}}").
    if (!math && literal.includes('}}')) return fail('placeholder_syntax', 'A placeholder is closed with }} but never opened with {{.');
    if (literal) nodes.push({ k: 'lit', text: literal });
    if (open < 0) break;
    const close = source.indexOf('}}', open + 2);
    if (close < 0) return fail('placeholder_syntax', 'A placeholder opened with {{ is never closed with }}.');
    const path = source.slice(open + 2, close);
    if (!PLACEHOLDER_PATH.test(path)) return fail('placeholder_syntax', `{{${path.slice(0, 40)}}} is not a placeholder: write {{id}}, {{id.member}} or {{id.member.member}} in lowercase, with no spaces.`);
    nodes.push({ k: 'ph', ph: { path: path.split('.'), math } });
    i = close + 2;
  }
  return ok(nodes);
}

/** Parse a template: a text block's rich text, or a math block's TeX. */
export function parseTempl(source: string, mode: TemplMode): Result<Templ> {
  if (typeof source !== 'string' || !source.trim()) return fail('templ_empty', 'Text is empty.');
  let parts: { kind: TemplMode; source: string }[];
  if (mode === 'math') parts = [{ kind: 'math', source }];
  else {
    try { parts = splitRichText(source).map(s => s.kind === 'text' ? { kind: 'text', source: s.text } : { kind: 'math', source: s.tex }); }
    catch (e) { return fail('templ_math', (e as Error).message); }
  }
  const segments: Segment[] = [];
  for (const part of parts) {
    const nodes = scan(part.source, part.kind === 'math');
    if (!nodes.ok) return nodes;
    segments.push({ kind: part.kind, nodes: nodes.value });
  }
  const placeholders = segments.flatMap(s => s.nodes.flatMap(n => n.k === 'ph' ? [n.ph] : []));
  if (placeholders.length > MAX_PLACEHOLDERS) return fail('templ_size', `Text has more than ${MAX_PLACEHOLDERS} placeholders.`);
  return ok({ mode, segments, placeholders });
}

// ---------- closed-list prose rules ----------
const NUMERAL = /\p{N}/u;
interface ProseLists {
  numberWords: ReadonlySet<string>; viewWords: ReadonlySet<string>; viewPhrases: readonly (readonly string[])[];
  /** The script prose letters must be in, so look-alike letters from another script cannot spell a listed word. */
  script: RegExp;
}
/**
 * Per-language closed lists. Number words: cardinals of two or more, multiplicative and fraction
 * words ("one" and "a" stay legal: they are also articles and pronouns; "second" and "first" are
 * ordinary words). View words: nouns that name a figure, which must come from `{{s.view}}` so the
 * prose cannot name a shape the figure does not draw. "square" is not one: it is also a unit word.
 */
export const PROSE_LISTS: Readonly<Record<string, ProseLists>> = {
  en: {
    numberWords: new Set([
      'zero', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen',
      'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty',
      'ninety', 'hundred', 'hundreds', 'thousand', 'thousands', 'million', 'millions', 'billion', 'billions', 'dozen', 'dozens',
      'pair', 'pairs', 'twice', 'thrice', 'double', 'doubled', 'doubles', 'triple', 'tripled', 'triples',
      'half', 'halves', 'third', 'thirds', 'fourth', 'fourths', 'quarter', 'quarters', 'fifth', 'fifths', 'sixth', 'sixths',
      'seventh', 'sevenths', 'eighth', 'eighths', 'ninth', 'ninths', 'tenth', 'tenths', 'eleventh', 'elevenths', 'twelfth',
      'twelfths', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'sixteenths', 'twentieth', 'twentieths',
      'hundredth', 'hundredths', 'thousandth', 'thousandths', 'tens',
    ]),
    viewWords: new Set([
      'picture', 'pictures', 'diagram', 'diagrams', 'rectangle', 'rectangles', 'circle', 'circles', 'triangle', 'triangles',
      'shape', 'shapes', 'array', 'arrays', 'strip', 'strips', 'grid', 'grids', 'graph', 'graphs', 'chart', 'charts',
      'pie', 'pies', 'pictograph', 'pictographs',
    ]),
    viewPhrases: [['number', 'line'], ['number', 'lines'], ['bar', 'graph'], ['bar', 'chart'], ['line', 'plot'], ['dot', 'plot'],
      ['tape', 'diagram'], ['area', 'model'], ['fraction', 'model'], ['fraction', 'bar']].flatMap(p => [p, [p[0]!, `${p[1]}s`]]),
    script: /^\p{Script=Latin}+$/u,
  },
};
const listsFor = (locale: string) => { const lang = locale.toLowerCase().split('-')[0]!; return Object.hasOwn(PROSE_LISTS, lang) ? PROSE_LISTS[lang]! : PROSE_LISTS.en!; };

/** Commands whose argument KaTeX typesets as words. */
const TEXT_GROUP = /\\(?:text|textrm|textsf|texttt|textbf|textit|textup|textnormal|mathrm|mathit|mathbf|mathsf|mathtt|operatorname|mbox)\s*\{([^{}]*)\}/g;
/**
 * The words a learner sees in literal prose. In TeX this follows what KaTeX draws, not how the
 * source is spelled: adjacent text groups are joined ("\text{tw}\text{elve}" reads "twelve"), and
 * bare letters outside text groups are joined too, since math ignores spaces ("t w o" draws "two").
 */
function words(text: string, math: boolean): string[] {
  const split = (s: string) => s.toLowerCase().match(/\p{L}+(?:['’]\p{L}+)*/gu) ?? [];
  if (!math) return split(text);
  const groups: string[] = [];
  let last = -1, rest = '';
  for (const m of text.matchAll(TEXT_GROUP)) {
    const gap = text.slice(last < 0 ? 0 : last, m.index);
    if (last >= 0 && /^[\s{}]*$/.test(gap)) groups[groups.length - 1] += m[1]!;
    else { groups.push(m[1]!); rest += gap; }
    last = m.index + m[0].length;
  }
  rest += text.slice(last < 0 ? 0 : last);
  const bare = rest.replace(/\\[A-Za-z]+/g, ' ').replace(/[^\p{L}]/gu, '');
  return [...groups.flatMap(split), ...split(bare)];
}
/** Invisible format characters (zero-width joiners, soft hyphen, bidi marks) and combining marks left after NFC. */
const INVISIBLE = /[\p{Cf}\p{M}]/u;
/** An all-caps run that is a Roman numeral of two or more letters ("XII", "III"); "I" alone is a pronoun. */
const ROMAN = /\b(?=[MDCLXVI]{2,}\b)M{0,3}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})\b/u;

/**
 * The closed-list rules over a template's literal prose (placeholders excluded). `viewWords: false`
 * skips the view-word rule, for strings that are not about the figure (noun forms).
 */
export function proseIssues(t: Templ, { locale = 'en', viewWords = true }: { locale?: string; viewWords?: boolean } = {}): Issue[] {
  const lists = listsFor(locale);
  const issues: Issue[] = [];
  const seen = new Set<string>();
  const report = (code: string, message: string) => { if (!seen.has(code + message)) { seen.add(code + message); issues.push({ code, message }); } };
  for (const seg of t.segments) {
    // Words are read per literal run, so a placeholder between two words never joins them into a phrase.
    for (const node of seg.nodes) {
      if (node.k !== 'lit') continue;
      const text = node.text.normalize('NFC');
      if (INVISIBLE.test(text)) report('prose_invisible', 'Prose contains an invisible or combining character.');
      if (seg.kind === 'text' && text.includes('\\')) report('prose_backslash', 'Prose text may not contain a backslash outside math.');
      const roman = seg.kind === 'text' ? ROMAN.exec(text) : null;
      if (roman) report('numeral', `Write numbers only through placeholders: "${roman[0]}" is a Roman numeral.`);
      const numeral = NUMERAL.exec(text);
      if (numeral) report('numeral', `Write numbers only through placeholders: "${numeral[0]}" appears in the prose.`);
      const ws = words(text, seg.kind === 'math');
      const foreign = ws.find(w => !lists.script.test(w.replace(/['’]/g, '')));
      if (foreign) report('prose_script', `"${foreign}" mixes in letters from another script.`);
      for (const w of ws) if (lists.numberWords.has(w)) report('number_word', `Write numbers only through placeholders: "${w}" is a number word.`);
      if (!viewWords) continue;
      // Phrases first; a word inside a matched phrase ("graph" in "bar graph") is not reported again.
      const covered = new Set<number>();
      for (const phrase of lists.viewPhrases) {
        for (let i = 0; i + phrase.length <= ws.length; i++) {
          if (!phrase.every((p, k) => ws[i + k] === p)) continue;
          phrase.forEach((_, k) => covered.add(i + k));
          report('view_word', `Name the figure with {{<structure>.view}}, not "${phrase.join(' ')}".`);
        }
      }
      ws.forEach((w, i) => { if (!covered.has(i) && lists.viewWords.has(w)) report('view_word', `Name the figure with {{<structure>.view}}, not "${w}".`); });
    }
  }
  return issues;
}

/** Noun forms: letters with inner spaces, hyphens or apostrophes; never numerals or number words. */
export const NOUN_FORM = /^\p{L}+(?:[ '’-]\p{L}+)*$/u;
// \p{L} excludes format characters and combining marks, so a noun form can hide nothing between its letters.
export function nounFormIssues(form: string, locale = 'en'): Issue[] {
  if (typeof form !== 'string' || form.length < 1 || form.length > 24 || !NOUN_FORM.test(form)) return [{ code: 'noun_form', message: 'A noun form is 1–24 letters, with only spaces, hyphens or apostrophes between words.' }];
  const parsed = parseTempl(form, 'text');
  return parsed.ok ? proseIssues(parsed.value, { locale, viewWords: false }) : [parsed.error];
}

// ---------- rendering ----------
/**
 * Resolves one placeholder to rich pieces, or to 'mask': the unknown, which renders as a blank box
 * inside math and is an error in text (the answer is never written into a sentence).
 */
export type PlaceholderResolver = (ph: Placeholder) => Result<Rich | 'mask'>;

/** Rendered rich text is capped like v1 text blocks; rendered TeX is capped by v1's checkTex (300). */
export const MAX_RENDERED_TEXT = 600;
const NUMERIC_TEXT = /^[-\u2212]?[\d.,]+$/u;
/** A text piece inside TeX: a bare ASCII number stays TeX (its grouping comma braced), anything else is \\text{…}. */
const texOfText = (text: string) => NUMERIC_TEXT.test(text) ? text.replace(/,/g, '{,}') : `\\text{${text}}`;
/** Re-escape a literal dollar sign for v1 rich text. */
const escapeText = (text: string) => text.replace(/\$/g, '\\$');

/**
 * Render a template. A text block becomes v1 rich text (math pieces as `$…$`); a math block becomes
 * TeX. The result is then held to v1's text or TeX rules and the length limits.
 */
export function renderTempl(t: Templ, resolve: PlaceholderResolver): Result<string> {
  let out = '';
  for (const seg of t.segments) {
    let tex = '';
    for (const node of seg.nodes) {
      if (node.k === 'lit') { if (seg.kind === 'math') tex += node.text; else out += escapeText(node.text); continue; }
      const r = resolve(node.ph);
      if (!r.ok) return r;
      if (r.value === 'mask') {
        if (seg.kind === 'text') return fail('answer_in_text', `{{${node.ph.path.join('.')}}} is the answer; it cannot appear in a sentence (inside math it shows as a blank box).`);
        tex += '\\square ';
        continue;
      }
      for (const piece of r.value) {
        if (seg.kind === 'math') tex += piece.kind === 'math' ? piece.tex : texOfText(piece.text);
        else out += piece.kind === 'math' ? `$${piece.tex}$` : escapeText(piece.text);
      }
    }
    if (seg.kind === 'math') out += t.mode === 'math' ? tex : `$${tex}$`;
  }
  if (t.mode === 'math') {
    const problem = checkTex(out);
    return problem ? fail('render_unsafe', problem) : ok(out);
  }
  if (out.length > MAX_RENDERED_TEXT) return fail('render_long', `Rendered text is longer than ${MAX_RENDERED_TEXT} characters.`);
  const problem = checkRichText(out);
  return problem ? fail('render_unsafe', problem) : ok(out);
}
