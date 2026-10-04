/**
 * Rich text for Activity Spec v1: a plain string with inline TeX between single dollar signs.
 *   "Maya has $\frac{3}{4}$ of a pizza and buys a slice for \$2."
 * A literal dollar sign is written `\$`. Everything outside math is plain text, rendered
 * as React text nodes: no Markdown, no HTML, no links. Math is rendered by KaTeX with
 * trust:false, strict errors, bounded expansion, and an explicit command denylist.
 */
import katex from 'katex';

export type RichSegment = { kind: 'text'; text: string } | { kind: 'math'; tex: string };

/** Split rich text into text and math segments. Throws on an unbalanced `$`. */
export function splitRichText(source: string): RichSegment[] {
  const segments: RichSegment[] = [];
  let buffer = '', inMath = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i]!;
    if (c === '\\' && source[i + 1] === '$') { buffer += inMath ? '\\$' : '$'; i++; continue; }
    if (c === '$') {
      if (inMath) {
        if (!buffer.trim()) throw new Error('Empty math between dollar signs.');
        segments.push({ kind: 'math', tex: buffer });
      } else if (buffer) segments.push({ kind: 'text', text: buffer });
      buffer = ''; inMath = !inMath; continue;
    }
    buffer += c;
  }
  if (inMath) throw new Error('Unbalanced $: close every math span, and write a literal dollar sign as \\$.');
  if (buffer) segments.push({ kind: 'text', text: buffer });
  return segments;
}

/** Commands that could link, embed, style with raw values, or redefine macros. */
const FORBIDDEN_TEX = /\\(href|url|html[A-Za-z]*|includegraphics|def|gdef|edef|xdef|let|futurelet|newcommand|renewcommand|providecommand|DeclareMathOperator|csname|endcsname|expandafter|afterassignment|global|long|outer|char|mathchoice|class|id|data|style|raisebox|vcenter|rule|kern|mkern|hskip|mskip|hspace|vspace|phantom|hphantom|vphantom|color|textcolor|colorbox|fcolorbox|definecolor)(?![A-Za-z])/;
// The above is intentionally broad: K–8 math needs fractions, roots, operators, relations,
// arrows, \text, \circ, \overline, \angle, \triangle, \pi, \cdot, \times, \div, \le, \ge, etc.
const TEX_MARKUP = /<\s*\/?\s*(script|style|iframe|img|svg|object|embed|link|meta|html|body|div|span|math|input|form)\b/i;
/** The one sanctioned use of \phantom: an empty answer box sized like a digit, \boxed{\phantom{00}}. */
const BLANK_BOX = /\\boxed\{\\phantom\{[0-9]{1,3}\}\}/g;
const screen = (tex: string) => tex.replace(BLANK_BOX, '\\square');
const KATEX_OPTIONS = { trust: false, strict: 'error' as const, throwOnError: true, maxExpand: 50, maxSize: 8, output: 'htmlAndMathml' as const };

export function checkTex(tex: string): string | null {
  if (tex.length > 300) return 'Math span is too long (300 characters max).';
  if (FORBIDDEN_TEX.test(screen(tex))) return 'Math uses a command that is not allowed.';
  if (TEX_MARKUP.test(tex)) return 'Math contains markup.';
  // Catches an unescaped currency sign ("costs $3 and $5") and prose typed as italic math.
  // Environment names and column specs (column arithmetic: \begin{array}{r} … \end{array}) are not words.
  const bare = tex.replace(/\\(begin|end)\{(array|aligned)\}(\{[lcr|]{1,8}\})?/g, '').replace(/\\(text|mathrm|textbf|textit|operatorname|mbox)\s*\{[^{}]*\}/g, '').replace(/\\[A-Za-z]+/g, '');
  if (/[A-Za-z]{3,}/.test(bare)) return 'Words inside math: wrap them in \\text{} or write a literal dollar sign as \\$.';
  try { katex.renderToString(tex, KATEX_OPTIONS); return null; }
  catch (e) { return `Math could not be typeset: ${e instanceof Error ? e.message.slice(0, 120) : 'error'}`; }
}

/** Renders only TeX that passes the same denylist as validation (defense in depth for unvalidated input). */
export function renderTex(tex: string, displayMode = false): string {
  try {
    if (tex.length > 300 || FORBIDDEN_TEX.test(screen(tex)) || TEX_MARKUP.test(tex)) throw new Error('unsafe');
    return katex.renderToString(tex, { ...KATEX_OPTIONS, displayMode });
  }
  catch { return katex.renderToString('\\text{?}', { ...KATEX_OPTIONS, displayMode }); }
}

// A real tag shape (<b>, </div>, <img src=…, <!--) or an HTML entity used as markup (&lt; &#60;).
const MARKUP = /<\s*\/?\s*[a-z][a-z0-9-]*(?=[\s>/]|$)|<!|&(#\d+|#x[0-9a-f]+|lt|gt|amp|quot|apos|nbsp);/i;
const URL_LIKE = /\b(https?|ftp|javascript|vbscript|tauri|ipc):|\bwww\.|\b[a-z0-9-]+\.(com|net|org|io|app|cash|dev|ly|co)\b/i;
// Bidi overrides/isolates and other invisible format controls can disguise content.
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f‪-‮⁦-⁩‎‏؜﻿]/;

/** Plain text (figure labels, table cells): no math, markup, links or control characters. */
export function checkPlainText(text: string): string | null {
  if (CONTROL.test(text)) return 'Text contains control characters.';
  if (MARKUP.test(text)) return 'Text must not contain HTML or markup.';
  if (URL_LIKE.test(text)) return 'Text must not contain links or web addresses.';
  return null;
}

/** Rich text: plain text segments plus safe inline math. */
export function checkRichText(text: string): string | null {
  if (CONTROL.test(text)) return 'Text contains control characters.';
  let segments: RichSegment[];
  try { segments = splitRichText(text); } catch (e) { return (e as Error).message; }
  if (segments.filter(s => s.kind === 'math').length > 24) return 'Too many math spans.';
  for (const s of segments) {
    const problem = s.kind === 'text' ? checkPlainText(s.text) : checkTex(s.tex);
    if (problem) return problem;
  }
  return null;
}

/** Plain-language rendering for screen-reader summaries, alt text checks and logs. */
export function richTextToPlain(text: string): string {
  try { return splitRichText(text).map(s => s.kind === 'text' ? s.text : s.tex).join(''); }
  catch { return text; }
}
