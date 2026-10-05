/**
 * Semantic consistency for AI-authored activities: does the figure say what the text and the key say?
 *
 * A strict schema guarantees an activity's SHAPE, not its MEANING. A live gpt-4o activity passed
 * the schema and the validator while its text said "3 groups of 4 apples" and its key said 3×4 = 12,
 * but its picture showed 2 groups of 4. A learner who counts the picture gets 8 and is marked wrong.
 * This module catches that class of failure deterministically, with no knowledge of nouns, phrasings
 * or problem templates. It has two halves:
 *
 * 1. **Quantities.** One adapter per figure type, `FIGURE_MODELS[type](figure)`, derives what the
 *    figure shows from its data: its group or grid structure, the named quantities a question can ask
 *    for (named with the figure's OWN words: its icon, its labels, its field names), the numbers it
 *    contains, its labelled data values, the text printed on it, and a spoken description. Adding a
 *    figure type means adding one adapter; TypeScript rejects a missing one.
 * 2. **Relations.** A few type-agnostic rules compare those quantities with numbers read generically
 *    from the prompt text (digits, number words, fractions, "N <word> of M" structure), the keyCheck's
 *    operands and the answer. See `consistencyErrors` for the rules.
 *
 * Every rule is precise rather than eager: it fires only on a contradiction it can name, and stays
 * silent when the text introduces a quantity the figure does not show. The hand-authored fixtures and
 * the cached spec-eval corpus pin both sides (semantics.test.ts).
 *
 * The same quantities write each figure's accessible description (`figureAlt`), so the model's `alt`
 * is no longer shown to anyone. A description that would state the answer falls back to a value-free
 * (or countable) form.
 */
import type { ActivitySpec, Figure, FigureOf, FigureType } from './spec';
import { MONEY_KINDS } from './money';
import { splitRichText } from './text';
import { ExprError, parseExpr, type Expr } from './expr';

// ====================================================================================================
// Text → tokens. Generic: digits, number words, fractions, words, marks. No vocabulary of nouns.
// ====================================================================================================
export type Token =
  | { k: 'num'; v: number; int: boolean; word?: true }
  | { k: 'time'; v: string }
  | { k: 'frac'; v: number; n: number; d: number }
  | { k: 'word'; v: string }
  | { k: 'mark'; v: string };

const UNITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const TENS: Record<string, number> = { thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
/** "seven" → 7, "twenty-four" → 24; anything else → null. */
function numberWord(w: string): number | null {
  const unit = UNITS.indexOf(w);
  if (unit >= 0) return unit;
  if (w in TENS) return TENS[w]!;
  const m = /^(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)-(one|two|three|four|five|six|seven|eight|nine)$/.exec(w);
  return m ? (m[1] === 'twenty' ? 20 : TENS[m[1]!]!) + UNITS.indexOf(m[2]!) : null;
}

/** TeX → plain words and symbols: fractions become a/b, products ×, every other command a space. */
function texToPlain(tex: string): string {
  return tex
    .replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, ' $1/$2 ')
    .replace(/\\text\s*\{([^{}]*)\}/g, ' $1 ')
    .replace(/\\(times|cdot)(?![A-Za-z])/g, ' × ').replace(/\\div(?![A-Za-z])/g, ' ÷ ')
    .replace(/\\%/g, '%').replace(/\\\$/g, '$').replace(/\\[,;!: ]/g, ' ')
    .replace(/\\[A-Za-z]+/g, ' ').replace(/[{}]/g, ' ');
}
/** Rich text (plain text with inline $TeX$) as plain text. Unbalanced input degrades to the raw string. */
export function richToPlain(rt: string): string {
  try { return splitRichText(rt).map(s => s.kind === 'text' ? s.text : texToPlain(s.tex)).join(' '); }
  catch { return rt; }
}

const TOKEN = /\d{1,2}:\d{2}|(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?|[a-z]+(?:[-'][a-z]+)*|[^\s\w]/gi;
export function tokenize(plain: string): Token[] {
  const out: Token[] = [];
  for (const m of plain.toLowerCase().matchAll(TOKEN)) {
    const s = m[0];
    // A clock time ("3:20") is one token, never two numbers.
    if (/^\d{1,2}:\d{2}$/.test(s)) { out.push({ k: 'time', v: s }); continue; }
    if (/^\d/.test(s)) {
      const v = Number(s.replace(/,/g, ''));
      const prev = out.at(-1), beforeSign = plain[m.index - 2];
      // "-3" written as a sign directly on the digits after a space or bracket, not "5-3", "5 - 3" or "4-by-6".
      if (prev?.k === 'mark' && (prev.v === '-' || prev.v === '−') && plain[m.index - 1] === prev.v && (beforeSign === undefined || /[\s(=,]/.test(beforeSign))) { out.pop(); out.push({ k: 'num', v: -v, int: Number.isInteger(v) }); }
      else out.push({ k: 'num', v, int: Number.isInteger(v) });
      // a/b (no spaces) is one fraction token.
      const a = out.at(-3), slash = out.at(-2), b = out.at(-1);
      if (a?.k === 'num' && slash?.k === 'mark' && slash.v === '/' && b?.k === 'num' && a.int && b.int && b.v !== 0 && plain[m.index - 1] === '/') {
        out.splice(-3, 3, { k: 'frac', n: a.v, d: b.v, v: a.v / b.v });
      }
      continue;
    }
    if (/^[a-z]/.test(s)) {
      const n = numberWord(s);
      out.push(n === null ? { k: 'word', v: s } : { k: 'num', v: n, int: true, word: true });
      continue;
    }
    out.push({ k: 'mark', v: s });
  }
  return out;
}
const SENTENCE_END = new Set(['.', '?', '!', ';']);
/** Tokens split into sentences; a sentence keeps its closing mark. */
export function sentences(tokens: Token[]): Token[][] {
  const out: Token[][] = [];
  let cur: Token[] = [];
  for (const t of tokens) { cur.push(t); if (t.k === 'mark' && SENTENCE_END.has(t.v)) { out.push(cur); cur = []; } }
  if (cur.length) out.push(cur);
  return out;
}
/** English singular, by spelling rules only (no word list): "berries" → "berry", "boxes" → "box". */
export function singular(w: string): string {
  if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.length > 3 && /(s|x|z|ch|sh)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 2 && w.endsWith('s') && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
  return w;
}
/** English plural by spelling rules, applied to the last word of a snake_case or spaced name. */
export function plural(name: string, n: number): string {
  const words = name.replace(/_/g, ' ').trim();
  if (n === 1) return words;
  return words.replace(/(\w+)$/, w => /[^aeiou]y$/.test(w) ? `${w.slice(0, -1)}ies` : /(s|x|z|ch|sh)$/.test(w) ? `${w}es` : `${w}s`);
}
const near = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const fmt = (n: number) => String(+n.toFixed(4));
const isInt = (t: Token | undefined): t is Extract<Token, { k: 'num' }> => t?.k === 'num' && t.int;
const isWord = (t: Token | undefined, ...ws: string[]): t is Extract<Token, { k: 'word' }> => t?.k === 'word' && (!ws.length || ws.includes(t.v));
const isMark = (t: Token | undefined, ...ms: string[]) => t?.k === 'mark' && ms.includes(t.v);
const numValue = (t: Token | undefined) => t?.k === 'num' || t?.k === 'frac' ? t.v : null;

/**
 * Words that turn a stated number into a change or a comparison rather than a description of what is
 * shown ("3 more rows", "2 fewer than"). Function words only, never nouns.
 */
const CHANGE_WORDS = new Set(['more', 'fewer', 'less', 'than', 'extra', 'another', 'other', 'additional', 'times', 'twice', 'half', 'double', 'away', 'remove', 'removed', 'add', 'added', 'adds', 'takes', 'take', 'took', 'gives', 'give', 'gave', 'if', 'would', 'could', 'instead', 'new', 'each', 'per', 'every']);
/** Question words that ask about a change, a part or a comparison, not the figure's own quantity. */
/** Words anywhere in the prompt that mean the figure is not the whole story: something changes, arrives or happened earlier. */
const STORY_CHANGE_WORDS = new Set([...[...CHANGE_WORDS].filter(w => w !== 'each' && w !== 'per' && w !== 'every'), 'gets', 'get', 'got', 'then', 'now', 'first', 'later', 'came', 'comes', 'joined', 'rest']);
const NOT_TOTAL_WORDS = new Set([...CHANGE_WORDS, 'need', 'needs', 'needed', 'change', 'difference', 'without', 'not', 'share', 'shared', 'split', 'divide', 'divided', 'equal', 'equally', 'after', 'before', 'left', 'remain', 'remaining', 'eat', 'ate', 'eaten']);

// ====================================================================================================
// Figure quantities: one adapter per figure type.
// ====================================================================================================
export interface FigureQuantities {
  /** k groups of n (a picture with two or more groups, as drawn), or rows × columns (an array). */
  structure?: { kind: 'groups'; sizes: number[]; categories: boolean } | { kind: 'grid'; rows: number; cols: number };
  /**
   * Quantities a question can ask for, keyed by a singular lowercase name taken from the figure's own
   * data (its icon, label or field names). '' is the figure's unnamed total ("in all", "what number").
   * Each holds every value a question naming it may legitimately mean (total, or what is left, …).
   */
  named: Record<string, number[]>;
  /** Counts the text may state about the figure as "N <name>" ("8 equal parts", "4 rows", "3 groups"). */
  counts: Record<string, number[]>;
  /** Every number the figure contains or directly implies: counts, values, totals, place values. */
  numbers: number[];
  /** Labelled data values (charts, tables, labelled picture groups). Each label may carry several readings. */
  series: { label: string; values: number[] }[];
  /** What the data values count, as the figure's own value-axis label names it ("Number of Students" → "student"). */
  seriesUnit?: string;
  /** Text printed on the figure as annotation (labels, keys, a digital time), for the answer-leak rule. */
  printed: string[];
  /** The fraction a fraction model shows. */
  fraction?: { shaded: number; parts: number; wholes: number };
  /** Contradictions inside the figure itself (a graph-paper dimension label that disagrees with its drawn length). */
  conflicts: string[];
  /** Spoken description: `full` gives the parts a learner needs; `brief` names no value (or only countable words). */
  say: { full: string; brief: string };
}
type Adapter<T extends FigureType> = (f: FigureOf<T>) => FigureQuantities;

const base = (): Omit<FigureQuantities, 'say'> => ({ named: {}, counts: {}, numbers: [], series: [], printed: [], conflicts: [] });
const add = (rec: Record<string, number[]>, name: string, ...values: number[]) => { const k = singular(name.toLowerCase().trim()); (rec[k] ??= []).push(...values); };
const nameOf = (s: string) => s.toLowerCase().replace(/_/g, ' ').trim();
const list = (xs: string[]) => xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`;
const labelText = (rt: string) => richToPlain(rt).replace(/\s+/g, ' ').trim();
const firstNumber = (s: string) => { const t = tokenize(richToPlain(s)).find(x => x.k === 'num' || x.k === 'frac'); return t ? numValue(t) : null; };

/** "Each star = 2 books" → scale 2, unit "book". */
function pictureKey(key?: string): { scale: number; unit?: string } {
  if (!key) return { scale: 1 };
  const toks = tokenize(key);
  const i = toks.findIndex(t => t.k === 'num' || t.k === 'frac');
  if (i < 0) return { scale: 1 };
  const unit = toks.slice(i + 1).find(t => t.k === 'word') as { v: string } | undefined;
  return { scale: toks[i]!.k === 'num' || toks[i]!.k === 'frac' ? numValue(toks[i])! : 1, unit: unit?.v };
}

const picture: Adapter<'picture'> = figure => {
  const q = base();
  // Groups as drawn: a group may stand for several identical groups (`repeat`, the structural form), or be listed one by one.
  const f = { ...figure, groups: figure.groups.flatMap(g => Array.from({ length: (g as { repeat?: number }).repeat ?? 1 }, () => g)) };
  const { scale, unit } = pictureKey(f.key);
  const counts = f.groups.map(g => g.count), crossed = f.groups.map(g => g.crossedOut ?? 0);
  const total = counts.reduce((a, b) => a + b, 0), gone = crossed.reduce((a, b) => a + b, 0);
  const labels = f.groups.map(g => g.label ? labelText(g.label) : '');
  const categories = new Set(labels.filter(Boolean)).size >= 2;
  if (f.groups.length >= 2 && !f.key) q.structure = { kind: 'groups', sizes: counts, categories };
  if (f.groups.length >= 2) add(q.counts, 'group', f.groups.length);
  // A question about one icon kind counts that kind; every value a reader might mean is accepted.
  const icons = [...new Set(f.groups.map(g => g.icon))];
  for (const icon of icons) {
    const of = f.groups.filter(g => g.icon === icon);
    const t = of.reduce((n, g) => n + g.count, 0), c = of.reduce((n, g) => n + (g.crossedOut ?? 0), 0);
    add(q.named, nameOf(icon), t, t - c, c, t * scale, (t - c) * scale, ...of.map(g => g.count), ...of.map(g => g.count * scale));
  }
  if (unit) add(q.named, unit, total * scale, (total - gone) * scale);
  add(q.named, '', total, total - gone, total * scale, (total - gone) * scale);
  if (f.groups.length >= 2) add(q.named, 'group', f.groups.length);
  f.groups.forEach((g, i) => {
    if (labels[i]) { q.series.push({ label: labels[i]!, values: [g.count * scale, g.count, g.count - (g.crossedOut ?? 0)] }); add(q.named, labels[i]!, g.count * scale, g.count); }
  });
  q.numbers.push(...counts, ...crossed, total, total - gone, gone, f.groups.length, scale, total * scale, ...counts.map(c => c * scale), ...counts.map((c, i) => c - crossed[i]!));
  q.printed.push(...labels.filter(Boolean));
  const equal = f.groups.length >= 2 && icons.length === 1 && counts.every(c => c === counts[0]) && crossed.every(c => c === crossed[0]) && !labels.some(Boolean);
  const where = (g: (typeof f.groups)[number]) => g.arrangement === 'ten_frame' ? ' in a ten frame' : '';
  const full = equal
    ? `${f.groups.length} groups of ${counts[0]} ${plural(icons[0]!, counts[0]!)}${crossed[0] ? `, ${crossed[0]} crossed out in each group` : ''}${where(f.groups[0]!)}.`
    : `${f.groups.map((g, i) => `${labels[i] ? `${labels[i]}: ` : ''}${g.count} ${plural(g.icon, g.count)}${g.crossedOut ? `, ${g.crossedOut} crossed out` : ''}${where(g)}`).join('; ')}.`;
  // Brief: the icons as countable words (a screen reader user counts them as a sighted child counts the picture), never a numeral.
  const brief = total <= 30
    ? f.groups.map((g, i) => `${labels[i] ? `${labels[i]}: ` : `Group: `}${Array.from({ length: g.count }, (_, k) => `${nameOf(g.icon)}${k >= g.count - (g.crossedOut ?? 0) ? ' (crossed out)' : ''}`).join(', ')}`).join('. ') + '.'
    : `Picture of ${list(icons.map(i => plural(i, 2)))}${f.groups.length > 1 ? ', in groups' : ''}.`;
  return { ...q, say: { full: `Picture: ${full}${f.key ? ` Key: ${labelText(f.key)}.` : ''}`, brief: `Picture: ${brief}${f.key ? ` Key: ${labelText(f.key)}.` : ''}` } };
};

const arrayGrid: Adapter<'array_grid'> = f => {
  const q = base();
  const total = f.rows * f.cols, shaded = f.shaded ?? 0;
  q.structure = { kind: 'grid', rows: f.rows, cols: f.cols };
  add(q.counts, 'row', f.rows); add(q.counts, 'column', f.cols);
  const thing = f.style === 'icons' && f.icon ? f.icon : f.style === 'dots' ? 'dot' : 'square';
  const all = shaded && shaded < total ? [total, shaded, total - shaded] : [total];
  add(q.named, nameOf(thing), ...all); add(q.named, '', ...all); add(q.named, 'area', total);
  add(q.named, 'row', f.rows); add(q.named, 'column', f.cols);
  q.numbers.push(f.rows, f.cols, total, shaded, total - shaded);
  const shade = shaded && shaded < total ? `, ${shaded} shaded` : '';
  return { ...q, say: { full: `Array: ${f.rows} rows of ${f.cols} ${plural(thing, f.cols)}${shade}.`, brief: `Array of ${plural(thing, 2)} in rows and columns.` } };
};

const fractionModel: Adapter<'fraction_model'> = f => {
  const q = base();
  const wholes = f.wholes ?? 1, all = f.parts * wholes;
  q.fraction = { shaded: f.shaded, parts: f.parts, wholes };
  add(q.counts, 'part', f.parts, all);
  add(q.named, '', f.shaded / f.parts, (all - f.shaded) / f.parts, f.shaded / all, (all - f.shaded) / all);
  add(q.named, 'part', f.parts, all, f.shaded, all - f.shaded);
  q.numbers.push(f.parts, f.shaded, wholes, all, all - f.shaded);
  const shape = f.model === 'circle' ? 'circle' : f.model === 'area' ? 'rectangle' : 'bar';
  const wholesText = wholes > 1 ? `${wholes} ${plural(shape, wholes)}, each` : `A ${shape}`;
  return { ...q, say: { full: `Fraction model: ${wholesText} cut into ${f.parts} equal parts; ${f.shaded} ${f.shaded === 1 ? 'part is' : 'parts are'} shaded in all.`, brief: `Fraction model: ${wholes > 1 ? plural(shape, 2) : `a ${shape}`} cut into equal parts, some shaded.` } };
};

const placeValue: Adapter<'place_value_blocks'> = f => {
  const q = base();
  const places = [['thousand', f.thousands ?? 0, 1000], ['hundred', f.hundreds, 100], ['ten', f.tens, 10], ['one', f.ones, 1]] as const;
  const value = places.reduce((n, [, c, v]) => n + c * v, 0);
  add(q.named, '', value); add(q.named, 'number', value); add(q.named, 'value', value);
  q.numbers.push(value, ...places.flatMap(([, c, v]) => [c, v, c * v]));
  if (f.showLabels) q.printed.push(...places.filter(([, c]) => c).map(([n, c]) => `${c} ${plural(n, c)}`));
  const shown = places.filter(([, c]) => c).map(([n, c]) => `${c} ${plural(n === 'one' ? 'single cube' : `${n} ${n === 'ten' ? 'rod' : n === 'hundred' ? 'flat' : 'cube'}`, c)}`);
  return { ...q, say: { full: `Base-ten blocks: ${list(shown)}.`, brief: 'Base-ten blocks.' } };
};

const money: Adapter<'money'> = f => {
  const q = base();
  const cents = f.items.reduce((n, i) => n + MONEY_KINDS[i.kind] * i.count, 0);
  add(q.named, '', cents, cents / 100); add(q.named, 'cent', cents); add(q.named, 'dollar', cents / 100); add(q.named, 'money', cents, cents / 100);
  for (const i of f.items) add(q.named, nameOf(i.kind), i.count);
  q.numbers.push(cents, cents / 100, ...f.items.flatMap(i => [i.count, MONEY_KINDS[i.kind], MONEY_KINDS[i.kind] / 100, i.count * MONEY_KINDS[i.kind]]));
  const word = (k: keyof typeof MONEY_KINDS, n: number) => k.startsWith('bill_') ? `${n} ${plural(`${MONEY_KINDS[k] / 100}-dollar bill`, n)}` : `${n} ${plural(nameOf(k), n)}`;
  return { ...q, say: { full: `Money: ${list(f.items.map(i => word(i.kind, i.count)))}.`, brief: `Money: ${list(f.items.map(i => plural(i.kind.startsWith('bill_') ? `${MONEY_KINDS[i.kind] / 100}-dollar bill` : nameOf(i.kind), 2)))}.` } };
};

const clock: Adapter<'clock'> = f => {
  const q = base();
  q.numbers.push(f.hour, f.minute);
  if (f.showDigital) q.printed.push(`${f.hour}:${String(f.minute).padStart(2, '0')}`);
  const next = f.hour % 12 + 1;
  const hourHand = f.minute === 0 ? `points to ${f.hour}` : `is between ${f.hour} and ${next}`;
  const minuteMark = f.minute % 5 === 0 ? `points to ${f.minute === 0 ? 12 : f.minute / 5}` : `is ${f.minute % 5} small marks past the ${Math.floor(f.minute / 5) || 12}`;
  return { ...q, say: { full: `Analog clock: the short hour hand ${hourHand}; the long minute hand ${minuteMark}.`, brief: 'An analog clock.' } };
};

const numberLine: Adapter<'number_line'> = f => {
  const q = base();
  const tick = f.denominator ? `1/${f.denominator}` : fmt(f.step);
  q.numbers.push(f.min, f.max, f.step, ...(f.marks ?? []).map(m => m.value), ...(f.jumps ?? []).flatMap(j => [j.from, j.to, j.to - j.from, Math.abs(j.to - j.from)]), ...(f.ranges ?? []).flatMap(r => [r.from, r.to]));
  q.printed.push(...(f.marks ?? []).flatMap(m => m.label ? [m.label] : []), ...(f.jumps ?? []).flatMap(j => j.label ? [j.label] : []));
  const ticksFrom = (v: number) => Math.round((v - f.min) / f.step);
  const at = (v: number) => f.denominator && !Number.isInteger(v) && Number.isInteger(+(v * f.denominator).toFixed(6)) ? `${+(v * f.denominator).toFixed(6)}/${f.denominator}` : fmt(v);
  const mark = (m: NonNullable<typeof f.marks>[number], where: string) => `${m.label ? `mark ${labelText(m.label)}` : 'a mark'}${m.open ? ' (open circle)' : ''} ${where}`;
  // Brief places marks by counting ticks, never by value (a mark's value is often the answer).
  const counted = (f.marks ?? []).map(m => mark(m, `${ticksFrom(m.value)} ticks right of ${fmt(f.min)}`));
  const marks = (f.marks ?? []).map(m => mark(m, `at ${at(m.value)}`));
  const jumps = (f.jumps ?? []).map(j => `a jump from ${fmt(j.from)}, ${j.to > j.from ? 'right' : 'left'} ${fmt(Math.abs(j.to - j.from))}${j.label ? ` (${j.label})` : ''}`);
  const ranges = (f.ranges ?? []).map(r => `shading from ${fmt(r.from)} (${r.includeFrom === false ? 'open' : 'closed'}) to ${fmt(r.to)}${r.extends && r.extends !== 'none' ? `, continuing ${r.extends}` : ''}`);
  const parts = [...marks, ...jumps, ...ranges];
  const line = `Number line from ${fmt(f.min)} to ${fmt(f.max)}, a tick every ${tick}`;
  return { ...q, say: { full: `${line}${parts.length ? `; ${parts.join('; ')}` : ''}.`, brief: `${line}${counted.length ? `; ${counted.join('; ')}` : ''}.` } };
};

const barChart: Adapter<'bar_chart'> = f => {
  const q = base();
  q.series = f.bars.map(b => ({ label: labelText(b.label), values: [b.value] }));
  const valueAxis = f.orientation === 'horizontal' ? f.xLabel : f.yLabel;
  const unit = valueAxis ? tokenize(labelText(valueAxis)).filter(t => t.k === 'word').at(-1) : undefined;
  if (unit?.k === 'word') q.seriesUnit = singular(unit.v);
  q.numbers.push(...f.bars.map(b => b.value), f.bars.length, f.bars.reduce((n, b) => n + b.value, 0));
  const title = f.title ? `${labelText(f.title)}. ` : '';
  const axis = f.yLabel ? ` (${labelText(f.yLabel)})` : '';
  return { ...q, say: { full: `Bar chart${axis}: ${title}${f.bars.map(b => `${labelText(b.label)} ${fmt(b.value)}`).join(', ')}.`, brief: `Bar chart${axis}: ${title}bars for ${list(f.bars.map(b => labelText(b.label)))}.` } };
};

const pieChart: Adapter<'pie_chart'> = f => {
  const q = base();
  const total = f.slices.reduce((n, s) => n + s.value, 0);
  q.series = f.slices.map(s => ({ label: labelText(s.label), values: [s.value, +(100 * s.value / total).toFixed(1), Math.round(100 * s.value / total)] }));
  q.numbers.push(...q.series.flatMap(s => s.values), total, f.slices.length);
  const title = f.title ? `${labelText(f.title)}. ` : '';
  const shown = f.show === 'percents' ? (s: { value: number }) => `${fmt(+(100 * s.value / total).toFixed(1))}%` : (s: { value: number }) => fmt(s.value);
  return { ...q, say: { full: `Circle graph: ${title}${f.slices.map(s => `${labelText(s.label)} ${shown(s)}`).join(', ')}.`, brief: `Circle graph: ${title}slices for ${list(f.slices.map(s => labelText(s.label)))}.` } };
};

const lineChart: Adapter<'line_chart'> = f => {
  const q = base();
  const pts = f.series.flatMap(s => s.points);
  q.numbers.push(...pts.flatMap(p => [p.x, p.y]));
  const tick = (x: number) => f.xTickLabels?.find(t => near(t.x, x))?.label;
  if (f.series.length === 1) for (const t of f.xTickLabels ?? []) { const p = f.series[0]!.points.find(p => near(p.x, t.x)); if (p) q.series.push({ label: labelText(t.label), values: [p.y] }); }
  const title = f.title ? `${labelText(f.title)}. ` : '';
  const say = (s: (typeof f.series)[number]) => `${f.series.length > 1 ? `${labelText(s.name)}: ` : ''}${s.points.map(p => `${tick(p.x) ? labelText(tick(p.x)!) : fmt(p.x)} ${fmt(p.y)}`).join(', ')}`;
  return { ...q, say: { full: `Line graph${f.yLabel ? ` (${labelText(f.yLabel)})` : ''}: ${title}${f.series.map(say).join('; ')}.`, brief: `Line graph: ${title}${f.series.map(s => labelText(s.name)).join(', ')}.` } };
};

const scatterPlot: Adapter<'scatter_plot'> = f => {
  const q = base();
  q.numbers.push(...f.points.flatMap(p => [p.x, p.y]), f.points.length);
  const axes = [f.xLabel && `x: ${labelText(f.xLabel)}`, f.yLabel && `y: ${labelText(f.yLabel)}`].filter(Boolean).join(', ');
  return { ...q, say: { full: `Scatter plot${axes ? ` (${axes})` : ''} of ${f.points.length} points: ${f.points.map(p => `(${fmt(p.x)}, ${fmt(p.y)})`).join(', ')}${f.trendLine ? `; trend line slope ${fmt(f.trendLine.slope)}` : ''}.`, brief: `Scatter plot${axes ? ` (${axes})` : ''}.` } };
};

const dataTable: Adapter<'data_table'> = f => {
  const q = base();
  const cols = f.columns.map(labelText), rows = f.rows.map(r => r.map(labelText));
  for (const r of rows) {
    const label = r[0]!;
    if (!label || /^[-\d.,/\s?]*$/.test(label)) continue;
    const values = r.slice(1).map(c => firstNumber(c)).filter((v): v is number => v !== null);
    if (values.length) q.series.push({ label, values });
  }
  q.numbers.push(...rows.flat().map(c => firstNumber(c)).filter((v): v is number => v !== null));
  const title = f.title ? `${labelText(f.title)}. ` : '';
  return { ...q, say: { full: `Table: ${title}columns ${cols.join(', ')}. ${rows.map((r, i) => `Row ${i + 1}: ${r.map(c => c === '?' ? 'unknown' : c).join(', ')}`).join('. ')}.`, brief: `Table: ${title}columns ${cols.join(', ')}.` } };
};

const coordinatePlane: Adapter<'coordinate_plane'> = f => {
  const q = base();
  q.numbers.push(...(f.points ?? []).flatMap(p => [p.x, p.y]), ...(f.segments ?? []).flatMap(s => [s.from.x, s.from.y, s.to.x, s.to.y]), ...(f.polygons ?? []).flatMap(p => p.points.flatMap(v => [v.x, v.y])));
  q.printed.push(...(f.points ?? []).flatMap(p => p.label ? [p.label] : []), ...(f.functions ?? []).flatMap(fn => fn.label ? [fn.label] : []), ...(f.polygons ?? []).flatMap(p => p.label ? [p.label] : []));
  const pt = (p: { x: number; y: number }) => `(${fmt(p.x)}, ${fmt(p.y)})`;
  const parts = [
    ...(f.points ?? []).map(p => { const l = p.label ? labelText(p.label) : ''; return `${l && l.replace(/\s/g, '') !== pt(p).replace(/\s/g, '') ? `point ${l} at` : 'a point at'} ${pt(p)}${p.open ? ' (open)' : ''}`; }),
    ...(f.segments ?? []).map(s => `a ${s.dashed ? 'dashed ' : ''}segment from ${pt(s.from)} to ${pt(s.to)}`),
    // A drawn graph is described by its label, never by its equation: the equation is often what the learner finds.
    ...(f.functions ?? []).map(fn => `${fn.dashed ? 'a dashed graph' : 'a graph'}${fn.label ? ` labelled ${labelText(fn.label)}` : ''}${fn.shade ? `, shaded ${fn.shade}` : ''}`),
    ...(f.polygons ?? []).map(p => `a polygon${p.label ? ` ${labelText(p.label)}` : ''} through ${p.points.map(pt).join(', ')}`),
  ];
  const plane = `Coordinate plane, x from ${fmt(f.x.min)} to ${fmt(f.x.max)}, y from ${fmt(f.y.min)} to ${fmt(f.y.max)}`;
  return { ...q, say: { full: `${plane}${parts.length ? `: ${parts.join('; ')}` : ''}.`, brief: `${plane}.` } };
};

type P = { x: number; y: number };
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);
const shoelace = (pts: P[]) => Math.abs(pts.reduce((s, p, i) => { const n = pts[(i + 1) % pts.length]!; return s + p.x * n.y - n.x * p.y; }, 0)) / 2;
const geometry: Adapter<'geometry'> = f => {
  const q = base();
  // Graph paper (`grid.unit`) makes lengths and areas countable, so drawn sizes become quantities.
  const unit = (f as { grid?: { unit?: number } }).grid?.unit;
  const texts: string[] = [];
  for (const s of f.shapes) {
    if ((s.kind === 'polygon' || s.kind === 'circle' || s.kind === 'angle' || s.kind === 'point') && s.label) texts.push(s.label);
    if (s.kind === 'dimension' || s.kind === 'label') texts.push(s.kind === 'dimension' ? s.label : s.text);
  }
  q.printed.push(...texts);
  q.numbers.push(...texts.map(firstNumber).filter((v): v is number => v !== null));
  const polygons = f.shapes.filter(s => s.kind === 'polygon');
  if (unit && !f.notToScale) {
    const axisAligned = (pts: P[]) => pts.every((p, i) => { const n = pts[(i + 1) % pts.length]!; return near(p.x, n.x) || near(p.y, n.y); });
    for (const poly of polygons) {
      const sides = poly.points.map((p, i) => dist(p, poly.points[(i + 1) % poly.points.length]!) / unit);
      q.numbers.push(...sides, sides.reduce((a, b) => a + b, 0));
      if (axisAligned(poly.points)) q.numbers.push(shoelace(poly.points) / unit ** 2);
    }
    if (polygons.length === 1 && axisAligned(polygons[0]!.points)) {
      const pts = polygons[0]!.points;
      add(q.named, 'area', shoelace(pts) / unit ** 2);
      add(q.named, 'perimeter', pts.reduce((n, p, i) => n + dist(p, pts[(i + 1) % pts.length]!), 0) / unit);
    }
    f.shapes.forEach((s, i) => {
      if (s.kind !== 'dimension') return;
      const stated = firstNumber(s.label), drawn = dist(s.from, s.to) / unit;
      if (stated !== null && stated > 0 && !near(stated, drawn)) q.conflicts.push(`shapes[${i}] is labelled ${labelText(s.label)} but spans ${fmt(drawn)} grid units on graph paper`);
    });
  }
  const parts = f.shapes.map(s => {
    switch (s.kind) {
      case 'polygon': {
        const sides = s.points.map((p, i) => dist(p, s.points[(i + 1) % s.points.length]!));
        const right = s.points.every((p, i) => { const a = s.points[(i + s.points.length - 1) % s.points.length]!, b = s.points[(i + 1) % s.points.length]!; return Math.abs((a.x - p.x) * (b.x - p.x) + (a.y - p.y) * (b.y - p.y)) < 1e-9; });
        const name = s.points.length === 3 ? 'triangle' : s.points.length === 4 && right ? (sides.every(x => near(x, sides[0]!)) ? 'square' : 'rectangle') : s.points.length === 4 ? 'four-sided shape' : `${s.points.length}-sided shape`;
        // On graph paper the sides are countable, so say them in grid units.
        const units = unit && !f.notToScale ? ` with sides ${sides.map(x => fmt(x / unit)).join(', ')} units` : '';
        return `a ${name}${s.label ? ` ${labelText(s.label)}` : ''}${units}`;
      }
      case 'circle': return `a circle${s.label ? ` ${labelText(s.label)}` : ''}`;
      case 'angle': return s.right ? 'a right-angle mark' : `an angle${s.label ? ` marked ${labelText(s.label)}` : ''}`;
      case 'dimension': return `a side labelled ${labelText(s.label)}`;
      case 'label': return `the label ${labelText(s.text)}`;
      case 'point': return s.label ? `point ${labelText(s.label)}` : '';
      default: return '';
    }
  }).filter(Boolean);
  const grid = unit ? ' on graph paper' : '', scale = f.notToScale ? ' (not to scale)' : '';
  return { ...q, say: { full: `Diagram${grid}${scale}: ${list(parts) || 'shapes'}.`, brief: `Diagram${grid}${scale} with ${list(f.shapes.filter(s => s.kind === 'polygon' || s.kind === 'circle').map(s => s.kind === 'circle' ? 'a circle' : 'a shape')) || 'lines'}.` } };
};

const ruler: Adapter<'ruler'> = f => {
  const q = base();
  q.numbers.push(f.length, f.subdivisions);
  if (f.object) { q.numbers.push(f.object.from, f.object.to, f.object.to - f.object.from); if (f.object.label) q.printed.push(f.object.label); }
  const unit = f.unit === 'cm' ? 'centimeter' : 'inch';
  const obj = f.object ? `; ${f.object.label ? labelText(f.object.label) : 'an object'} lies from ${fmt(f.object.from)} to ${fmt(f.object.to)}` : '';
  return { ...q, say: { full: `Ruler from 0 to ${f.length} ${plural(unit, f.length)}${f.subdivisions > 1 ? `, each ${unit} split into ${f.subdivisions}` : ''}${obj}.`, brief: `Ruler in ${plural(unit, 2)}${f.object ? ` with ${f.object.label ? labelText(f.object.label) : 'an object'} on it` : ''}.` } };
};

/** One adapter per figure type; TypeScript requires an entry for every type. */
export const FIGURE_MODELS: { [T in FigureType]: Adapter<T> } = {
  picture, array_grid: arrayGrid, fraction_model: fractionModel, place_value_blocks: placeValue, money, clock,
  number_line: numberLine, bar_chart: barChart, pie_chart: pieChart, line_chart: lineChart, scatter_plot: scatterPlot,
  data_table: dataTable, coordinate_plane: coordinatePlane, geometry, ruler,
};
export function figureQuantities(f: Figure): FigureQuantities {
  return (FIGURE_MODELS[f.type] as Adapter<typeof f.type>)(f as never);
}

// ====================================================================================================
// App-authored accessible descriptions.
// ====================================================================================================
/** The full description of a figure from its data (the model's alt is never used). */
export function describeFigure(f: Figure): string {
  return figureQuantities(f).say.full;
}
/** Would this text tell the learner the answer? Numbers and short numeric options only; never guesses at prose. */
export function statesAnswer(text: string, spec: Pick<ActivitySpec, 'response' | 'keyCheck'>): boolean {
  const toks = tokenize(richToPlain(text));
  const r = spec.response;
  // A number that is also one of the keyCheck's inputs ("24 - 12" = 12) is data the learner works from, not the answer.
  if (r.type === 'numeric') return !keyInputs(spec).some(v => near(v, r.answer)) && toks.some(t => (t.k === 'num' || t.k === 'frac') && near(t.v, r.answer));
  if (r.type === 'fraction') {
    const v = r.numerator / r.denominator;
    return toks.some(t => t.k === 'frac' && near(t.v, v)) || toks.some(t => t.k === 'num' && !t.int && near(t.v, v));
  }
  if (r.type === 'multiple_choice' || r.type === 'multi_select') {
    const flat = (s: string) => richToPlain(s).replace(/\s+/g, '').toLowerCase();
    const said = flat(text);
    return r.options.some(o => o.correct && /^[\d.,:/%¢$-]+$/.test(flat(o.text)) && new RegExp(`(^|[^\\d.])${flat(o.text).replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}($|[^\\d])`).test(said));
  }
  return false;
}
/**
 * The figure's accessible description for this activity: the full description, unless it would state
 * the answer; then the brief one, which names no value (pictures become countable words).
 */
export function figureAlt(f: Figure, spec: Pick<ActivitySpec, 'response' | 'keyCheck'>): string {
  const { say } = figureQuantities(f);
  return statesAnswer(say.full, spec) ? say.brief : say.full;
}

// ====================================================================================================
// Reading the prompt.
// ====================================================================================================
interface PromptText { tokens: Token[]; sentences: Token[][]; numbers: number[]; questions: Token[][] }
function readPrompt(spec: ActivitySpec): PromptText {
  const plain = spec.prompt.map(b => b.type === 'text' ? richToPlain(b.text) : b.type === 'math' ? texToPlain(b.tex) : '').filter(Boolean).join(' . ');
  const tokens = tokenize(plain);
  const ss = sentences(tokens).filter(s => s.some(t => t.k !== 'mark'));
  const numbers = tokens.flatMap(t => t.k === 'num' ? [t.v] : t.k === 'frac' ? [t.v, t.n, t.d] : []);
  const asked = ss.filter(s => s.some(t => isMark(t, '?')));
  return { tokens, sentences: ss, numbers, questions: asked.length ? asked : ss.slice(-1) };
}

/** A stated equal-groups structure: `groups` groups of `size`. `along` names what the groups are ("row", "bag"). */
export interface StructureClaim { groups?: number; size: number; along?: string; ordered: boolean; text: string }
const claimText = (toks: Token[]) => toks.map(t => t.k === 'frac' ? `${t.n}/${t.d}` : String(t.v)).join(' ');
const plainWord = (t: Token | undefined): t is Extract<Token, { k: 'word' }> => isWord(t) && !CHANGE_WORDS.has(t.v) && t.v !== 'of' && t.v !== 'out';
/**
 * Equal-groups structure stated in the text, by pattern only (never by noun):
 *   "N <w> [<w>] of M"            3 groups of 4 · 4 rows of 6 tiles · 5 bags of 3
 *   "N <w> [<w>] with M … each"   3 boxes with 4 crayons each · 3 rows with 5 dots in each row
 *   "M … in each of N <w>"        4 apples in each of 3 baskets
 *   "each <w> has M" + "N <w>s"   There are 3 plates. Each plate has 4 cookies.
 *   "N × M", "N-by-M"             $3 \times 4$ · a 4-by-6 array (unordered)
 */
export function structureClaims(tokens: Token[]): StructureClaim[] {
  const claims: StructureClaim[] = [];
  const t = tokens;
  const notFraction = (i: number) => !isMark(t[i + 1], '/', '%') && t[i]?.k !== 'frac';
  const precededByChange = (i: number) => [t[i - 1], t[i - 2]].some(x => isWord(x) && CHANGE_WORDS.has(x.v));
  for (let i = 0; i < t.length; i++) {
    const a = t[i];
    if (!isInt(a) || a.v <= 0 || !notFraction(i) || precededByChange(i)) continue;
    // N w [w] (of | with|holding|containing|having) M
    for (const span of [1, 2]) {
      const words = t.slice(i + 1, i + 1 + span);
      if (words.length !== span || !words.every(plainWord)) continue;
      const link = t[i + 1 + span], b = t[i + 2 + span];
      if (!isInt(b) || b.v <= 0 || !notFraction(i + 2 + span)) continue;
      const along = singular((words.at(-1) as { v: string }).v);
      if (isWord(link, 'of')) claims.push({ groups: a.v, size: b.v, along, ordered: true, text: claimText(t.slice(i, i + 3 + span)) });
      else if (isWord(link, 'with', 'holding', 'containing', 'having')) {
        const tail = t.slice(i + 3 + span, i + 7 + span);
        if (tail.some(x => isWord(x, 'each', 'apiece'))) claims.push({ groups: a.v, size: b.v, along, ordered: true, text: claimText(t.slice(i, i + 3 + span)) });
      }
    }
    // M … in each of N w
    for (let j = i + 1; j <= i + 4 && j + 4 < t.length; j++) {
      if (isWord(t[j], 'in', 'on') && isWord(t[j + 1], 'each') && isWord(t[j + 2], 'of')) {
        const k = isWord(t[j + 3], 'the') ? j + 4 : j + 3;
        const n = t[k], w = t[k + 1];
        if (isInt(n) && n.v > 0 && plainWord(w) && t.slice(i + 1, j).every(x => x.k === 'word')) claims.push({ groups: n.v, size: a.v, along: singular(w.v), ordered: true, text: claimText(t.slice(i, k + 2)) });
      }
    }
    // N × M, N-by-M
    const op = t[i + 1];
    if (isMark(op, '×') || (isWord(op, 'x') && isInt(t[i + 2]))) {
      const b = t[i + 2];
      if (isInt(b) && b.v > 0 && notFraction(i + 2)) claims.push({ groups: a.v, size: b.v, ordered: false, text: claimText([a, b]) });
    }
    if (isMark(op, '-') && isWord(t[i + 2], 'by') && isMark(t[i + 3], '-') && isInt(t[i + 4])) claims.push({ groups: a.v, size: (t[i + 4] as { v: number }).v, ordered: false, text: claimText([a, t[i + 4]!]) });
  }
  // each <w> (has|holds|contains|gets|with|is) M  ·  M <w> (in|on) each <w>; groups from an earlier "N <w>s"
  const countOf = (w: string) => {
    for (let k = 0; k + 1 < t.length; k++) {
      const n = t[k], next = t[k + 1], after = t[k + 2];
      if (!isInt(n) || n.v <= 1 || precededByChange(k)) continue;
      if (isWord(next) && singular(next.v) === w) return n.v;
      if (plainWord(next) && isWord(after) && singular(after.v) === w) return n.v;
    }
    return undefined;
  };
  for (let i = 0; i + 2 < t.length; i++) {
    if (!isWord(t[i], 'each') || !plainWord(t[i + 1])) continue;
    const along = singular((t[i + 1] as { v: string }).v);
    const verb = t[i + 2], m = isInt(t[i + 3]) ? t[i + 3] : isWord(t[i + 3], 'exactly') ? t[i + 4] : undefined;
    if (isWord(verb, 'has', 'holds', 'contains', 'gets', 'with', 'carries', 'had', 'held') && isInt(m) && m.v > 0) {
      claims.push({ groups: countOf(along), size: m.v, along, ordered: true, text: claimText(t.slice(i, i + 4)) });
    }
  }
  for (let i = 0; i + 3 < t.length; i++) {
    const m = t[i];
    if (!isInt(m) || m.v <= 0 || precededByChange(i)) continue;
    for (let j = i + 1; j <= i + 3 && j + 2 < t.length; j++) {
      if (!isWord(t[j], 'in', 'on') || !isWord(t[j + 1], 'each') || !plainWord(t[j + 2])) continue;
      if (!t.slice(i + 1, j).every(x => x.k === 'word')) break;
      const along = singular((t[j + 2] as { v: string }).v);
      claims.push({ groups: countOf(along), size: m.v, along, ordered: true, text: claimText(t.slice(i, j + 3)) });
      break;
    }
  }
  // "one group", "1 row at a time": a single group or a size of one states no structure.
  return claims.filter(c => c.size > 1 && (c.groups === undefined || c.groups > 1));
}

/** "N <name>" counts stated in the text, where <name> is one of the figure's own count names; one adjective may sit between. */
function statedCounts(tokens: Token[], names: string[]): { name: string; value: number }[] {
  const out: { name: string; value: number }[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const n = tokens[i];
    if (!isInt(n) || n.v <= 1 || isMark(tokens[i + 1], '/', '%') || [tokens[i - 1], tokens[i - 2]].some(x => isWord(x) && CHANGE_WORDS.has(x.v))) continue;
    for (const span of [1, 2]) {
      const words = tokens.slice(i + 1, i + 1 + span);
      if (words.length !== span || !words.every(plainWord)) continue;
      const name = singular((words.at(-1) as { v: string }).v);
      if (span === 2 && names.includes(singular((words[0] as { v: string }).v))) continue;
      const after = tokens[i + 1 + span];
      if (names.includes(name) && !(isWord(after) && CHANGE_WORDS.has(after.v))) { out.push({ name, value: n.v }); break; }
    }
  }
  return out;
}

/** The keyCheck's literal operands, and its shape when it is a plain product of two counts (a×b or a+a+…+a). */
function keyCheckShape(spec: ActivitySpec): { literals: number[]; product?: [number, number] } | null {
  if (!spec.keyCheck || !('value' in spec.keyCheck)) return null;
  let tree: Expr;
  try { tree = parseExpr(spec.keyCheck.value, []); } catch (e) { if (e instanceof ExprError) return null; throw e; }
  const literals: number[] = [];
  const walk = (e: Expr): void => { if (e.t === 'num') literals.push(e.v); else if (e.t === 'neg') walk(e.a); else if (e.t === 'bin') { walk(e.a); walk(e.b); } else if (e.t === 'call') e.args.forEach(walk); };
  walk(tree);
  const whole = (e: Expr): e is { t: 'num'; v: number } => e.t === 'num' && Number.isInteger(e.v) && e.v > 0;
  if (tree.t === 'bin' && tree.op === '*' && whole(tree.a) && whole(tree.b)) return { literals, product: [tree.a.v, tree.b.v] };
  const terms: Expr[] = [];
  const sum = (e: Expr): boolean => e.t === 'bin' && e.op === '+' ? sum(e.a) && sum(e.b) : (terms.push(e), true);
  if (tree.t === 'bin' && tree.op === '+' && sum(tree) && terms.length >= 2 && terms.every(whole) && terms.every(x => (x as { v: number }).v === (terms[0] as { v: number }).v)) {
    return { literals, product: [terms.length, (terms[0] as { v: number }).v] };
  }
  return { literals };
}
/** The keyCheck's literal inputs when it computes something (a bare "12" has none). */
function keyInputs(spec: Pick<ActivitySpec, 'keyCheck'>): number[] {
  const k = spec.keyCheck;
  if (!k || !('value' in k)) return [];
  let tree: Expr;
  try { tree = parseExpr(k.value, []); } catch { return []; }
  if (tree.t === 'num') return [];
  const out: number[] = [];
  const walk = (e: Expr): void => { if (e.t === 'num') out.push(e.v); else if (e.t === 'neg') walk(e.a); else if (e.t === 'bin') { walk(e.a); walk(e.b); } else if (e.t === 'call') e.args.forEach(walk); };
  walk(tree);
  return out;
}

// ====================================================================================================
// Relations.
// ====================================================================================================
const sameSet = (a: number[], b: number[]) => { const x = [...a].sort((p, q) => p - q), y = [...b].sort((p, q) => p - q); return x.length === y.length && x.every((v, i) => v === y[i]); };
const shows = (s: NonNullable<FigureQuantities['structure']>) => s.kind === 'grid' ? `${s.rows} rows of ${s.cols}` : s.sizes.every(n => n === s.sizes[0]) ? `${s.sizes.length} groups of ${s.sizes[0]}` : `${s.sizes.length} groups (${s.sizes.join(', ')})`;

/** Does a figure's structure agree with one stated claim? */
function structureAgrees(s: NonNullable<FigureQuantities['structure']>, c: StructureClaim, countNames: string[]): boolean {
  if (s.kind === 'groups') {
    // The stated groups must all be drawn; other groups may sit beside them ("3 bags of 10 and 5 more").
    const drawn = (size: number) => s.sizes.filter(n => n === size).length;
    if (c.groups === undefined) return s.sizes.every(n => n === c.size);
    return drawn(c.size) === c.groups || (!c.ordered && drawn(c.groups) === c.size);
  }
  // A grid: rows are the groups when the text calls its groups rows, columns when it calls them columns.
  const [rowName, colName] = countNames;
  if (c.groups === undefined) return c.along === colName ? s.rows === c.size : c.along === rowName ? s.cols === c.size : s.rows === c.size || s.cols === c.size;
  if (c.ordered && c.along === rowName) return s.rows === c.groups && s.cols === c.size;
  if (c.ordered && c.along === colName) return s.cols === c.groups && s.rows === c.size;
  return sameSet([s.rows, s.cols], [c.groups, c.size]);
}

export interface ConsistencyIssue { rule: 'structure' | 'total' | 'chart' | 'leak' | 'figure'; figure?: string; message: string }

/**
 * The consistency rules. Each fires only on a contradiction it can name:
 *
 * - **structure** (a): a picture's or array's groups, rows and columns must match the equal-groups
 *   structure the text states ("N <w> of M", "each <w> has M", "N × M"), and the counts it names with
 *   the figure's own words ("4 rows", "8 equal parts"). A keyCheck that is a plain product a×b must
 *   match the figure's structure when the text states nothing else. A fraction model must share a
 *   denominator (or an equivalent partition) with a fraction the text states.
 * - **total** (b): when the question asks for a quantity the figure names (its icon, "area", "cents",
 *   "what number", "in all") and the text adds no number the figure does not show, the key must be
 *   one of the figure's values for it.
 * - **chart** (c): a value the text attributes to a chart label ("Maria read 7", "5 votes for apples")
 *   must be that label's value, and "which … had N" must name a value the chart has.
 * - **leak** (d): the numeric answer must not be printed on the figure as an annotation, or written in
 *   the prompt as a result ("= 12", "12 in all"), unless it is also one of the keyCheck's inputs.
 * - **figure**: contradictions inside one figure (a graph-paper dimension label vs its drawn length).
 */
export function consistencyIssues(spec: ActivitySpec): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const figures = spec.figures ?? [];
  if (!figures.length && spec.response.type !== 'numeric') return issues;
  const text = readPrompt(spec);
  const facts = figures.map(f => ({ f, q: figureQuantities(f) }));
  const key = keyCheckShape(spec);
  const answer = spec.response.type === 'numeric' ? spec.response.answer : spec.response.type === 'fraction' ? spec.response.numerator / spec.response.denominator : null;
  const tag = (f: Figure) => `figure ${f.id} (${f.type})`;

  for (const { f, q } of facts) for (const c of q.conflicts) issues.push({ rule: 'figure', figure: f.id, message: `${tag(f)}: ${c}.` });

  // (a) structure
  const structural = facts.filter(x => x.q.structure || (x.f.type === 'picture' && x.f.groups.length === 1 && !x.f.key));
  if (structural.length === 1) {
    const { f, q } = structural[0]!;
    const countNames = Object.keys(q.counts);
    // "Each cherry has 2 seeds" describes the objects drawn, not groups of them.
    const claims = structureClaims(text.tokens).filter(c => !c.along || countNames.includes(c.along) || !(c.along in q.named));
    if (q.structure && !(q.structure.kind === 'groups' && q.structure.categories)) {
      if (claims.length && !claims.some(c => structureAgrees(q.structure!, c, countNames))) {
        issues.push({ rule: 'structure', figure: f.id, message: `${tag(f)}: the text says ${claims.map(c => c.groups === undefined ? `${c.size} in each ${c.along ?? 'group'}` : `${c.groups} ${c.along ? plural(c.along, c.groups) : 'groups'} of ${c.size}`).join(' / ')}, but the figure shows ${shows(q.structure)}.` });
      } else if (!claims.length && key?.product && text.numbers.every(n => n === 0 || n === 1)) {
        // The text states no numbers, so the key's factors can only come from the figure. One factor matching a
        // dimension and the other not is a contradiction; no factor matching means a different quantity (legs per spider).
        const s = q.structure;
        const dims = s.kind === 'grid' ? [s.rows, s.cols] : s.sizes.every(n => n === s.sizes[0]) ? [s.sizes.length, s.sizes[0]!] : null;
        if (dims && key.product.some(x => dims.includes(x)) && !sameSet(dims, key.product)) issues.push({ rule: 'structure', figure: f.id, message: `${tag(f)}: keyCheck ${spec.keyCheck && 'value' in spec.keyCheck ? spec.keyCheck.value : ''} multiplies ${key.product.join(' × ')}, but the figure shows ${shows(s)}.` });
      }
    } else if (f.type === 'picture' && f.groups.length === 1) {
      const count = f.groups[0]!.count;
      const full = claims.filter(c => c.groups !== undefined);
      if (full.length && !full.some(c => count === c.groups! * c.size || count === c.size || count === c.groups)) {
        issues.push({ rule: 'structure', figure: f.id, message: `${tag(f)}: the text says ${full.map(c => `${c.groups} ${c.along ? plural(c.along, c.groups!) : 'groups'} of ${c.size}`).join(' / ')}, but the figure shows one group of ${count}.` });
      }
    }
  }
  for (const { f, q } of facts) {
    const names = Object.keys(q.counts);
    if (!names.length || (q.structure?.kind === 'groups' && q.structure.categories)) continue;
    const stated = statedCounts(text.tokens, names);
    for (const name of names) {
      const said = stated.filter(s => s.name === name);
      if (said.length && !said.some(s => q.counts[name]!.includes(s.value))) issues.push({ rule: 'structure', figure: f.id, message: `${tag(f)}: the text says ${said.map(s => `${s.value} ${plural(name, s.value)}`).join(' / ')}, but the figure has ${q.counts[name]![0]}.` });
    }
    if (q.fraction) {
      const fr = text.tokens.filter((t): t is Extract<Token, { k: 'frac' }> => t.k === 'frac' && t.d > 1);
      const { parts, shaded, wholes } = q.fraction;
      if (fr.length && !fr.some(t => t.d === parts || parts % t.d === 0 || near(t.v, shaded / parts) || near(t.v, shaded / (parts * wholes)))) {
        issues.push({ rule: 'structure', figure: f.id, message: `${tag(f)}: the text uses ${[...new Set(fr.map(t => `${t.n}/${t.d}`))].join(', ')}, but the model is cut into ${parts} parts.` });
      }
    }
  }

  // (b) total: the question asks for a quantity the figure names, and the text adds nothing the figure does not show.
  if (answer !== null) {
    const shown = new Set(facts.flatMap(x => x.q.numbers).map(n => +n.toFixed(6)));
    const addsNothing = text.numbers.every(n => n === 1 || n === 0 || shown.has(+n.toFixed(6)));
    const story = text.tokens.some(t => t.k === 'word' && STORY_CHANGE_WORDS.has(t.v));
    for (const question of addsNothing && !story ? text.questions : []) {
      const asked = askedQuantity(question);
      if (asked === null) continue;
      const candidates = facts.filter(x => asked in x.q.named);
      if (candidates.length !== 1) continue;
      const { f, q } = candidates[0]!;
      // A question that names one of the figure's labels ("How many books did Mina read?") asks for that label's value.
      const labelled = q.series.filter(x => mentions(question, x.label));
      const values = labelled.length ? labelled.flatMap(x => x.values) : q.named[asked]!;
      if (spec.response.type === 'fraction' && f.type !== 'fraction_model') continue;
      if (!values.some(v => near(v, answer))) {
        const what = asked ? `the ${plural(asked, 2)}` : 'the total';
        issues.push({ rule: 'total', figure: f.id, message: `${tag(f)}: the question asks for ${what} the figure shows (${fmt(values[0]!)}), but the key is ${fmt(answer)}.` });
      }
      break;
    }
  }

  // (c) chart values referenced in the text
  for (const { f, q } of facts) {
    if (!q.series.length || f.type === 'picture') continue;
    for (const claim of chartReferences(text.sentences, q.series, q.seriesUnit)) {
      issues.push({ rule: 'chart', figure: f.id, message: `${tag(f)}: ${claim}` });
    }
  }

  // (d) answer leak
  if (spec.response.type === 'numeric') {
    const a = spec.response.answer;
    const isInput = keyInputs(spec).some(v => near(v, a));
    if (!isInput) {
      for (const { f, q } of facts) {
        const printed = q.printed.find(p => tokenize(richToPlain(p)).some(t => ((t.k === 'num' && !t.word) || t.k === 'frac') && near(t.v, a)));
        if (printed) issues.push({ rule: 'leak', figure: f.id, message: `${tag(f)}: the label "${labelText(printed).slice(0, 40)}" shows the answer ${fmt(a)}.` });
        if (f.caption && resultCue(tokenize(richToPlain(f.caption)), a)) issues.push({ rule: 'leak', figure: f.id, message: `${tag(f)}: the caption states the answer ${fmt(a)}.` });
      }
      if (resultCue(text.tokens, a)) issues.push({ rule: 'leak', message: `prompt: the text states the answer ${fmt(a)} as a result.` });
    }
  }
  if (spec.response.type === 'multiple_choice') {
    for (const { f, q } of facts) {
      if (q.printed.some(p => statesAnswer(p, spec)) && f.type === 'clock') issues.push({ rule: 'leak', figure: f.id, message: `${tag(f)}: the digital time shows the correct option.` });
    }
  }
  return issues;
}

/** Does a sentence contain a label, token for token (words compared in the singular)? */
function mentions(s: Token[], label: string): boolean {
  const l = tokenize(label);
  if (!l.some(t => t.k === 'word')) return false;
  const same = (a: Token, b: Token) => a.k === b.k && (a.k === 'word' ? singular(a.v) === singular((b as { v: string }).v) : a.k === 'num' || a.k === 'frac' ? near(a.v, (b as { v: number }).v) : a.v === (b as { v: string }).v);
  for (let i = 0; i + l.length <= s.length; i++) if (l.every((t, k) => same(s[i + k]!, t))) return true;
  return false;
}

/** What quantity does a question ask for? A figure name ("apple", "area", "cent"), '' for an unnamed total, or null. */
function askedQuantity(q: Token[]): string | null {
  const words = q.filter(t => t.k === 'word').map(t => (t as { v: string }).v);
  if (words.some(w => NOT_TOTAL_WORDS.has(w))) return null;
  const i = q.findIndex((t, k) => isWord(t, 'how') && isWord(q[k + 1], 'many', 'much'));
  if (i >= 0) {
    const after = q.slice(i + 2).filter(t => t.k !== 'mark');
    const nouns: string[] = [];
    for (const t of after) { if (!isWord(t) || ['are', 'is', 'were', 'was', 'do', 'does', 'did', 'can', 'will', 'in', 'on', 'at', 'there', 'does', 'have', 'has', 'altogether', 'total', 'all'].includes(t.v)) break; nouns.push(singular(t.v)); if (nouns.length === 3) break; }
    return nouns.length ? nouns.at(-1)! : '';
  }
  const w = (k: number) => words[k];
  for (let k = 0; k < words.length; k++) {
    if (w(k) === 'what' && (w(k + 1) === 'is' || w(k + 1) === 'was') && w(k + 2) === 'the' && ['total', 'sum', 'area', 'perimeter', 'value', 'number'].includes(w(k + 3) ?? '')) return w(k + 3) === 'total' || w(k + 3) === 'sum' ? '' : w(k + 3)!;
    if (w(k) === 'what' && (w(k + 1) === 'number' || w(k + 1) === 'fraction')) return w(k + 1) === 'number' ? 'number' : '';
  }
  return null;
}

/** "= 12", "equals 12", "makes 12", "a total of 12", "12 in all", "12 altogether": the answer written as a result. */
function resultCue(t: Token[], a: number): boolean {
  for (let i = 0; i < t.length; i++) {
    const n = t[i];
    if (!(n?.k === 'num' || n?.k === 'frac') || !near(n.v, a)) continue;
    const p1 = t[i - 1], p2 = t[i - 2];
    if (isMark(p1, '=') || isWord(p1, 'equals', 'makes', 'make') || (isWord(p2, 'total', 'answer', 'sum') && isWord(p1, 'of', 'is'))) return true;
    const n1 = t[i + 1], n2 = t[i + 2];
    if ((isWord(n1, 'in') && isWord(n2, 'all', 'total')) || isWord(n1, 'altogether')) return true;
  }
  return false;
}

/**
 * Values the text attributes to chart labels. "L <one word> N" and "N L" ("Maria read 7", "7 votes
 * for apples" is not matched) and "which … had N". A number followed by a change word ("3 more")
 * describes a difference, not a value, and is skipped.
 */
function chartReferences(ss: Token[][], series: FigureQuantities['series'], unit?: string): string[] {
  const out: string[] = [];
  const labelled = series.map(s => ({ ...s, toks: tokenize(s.label).map(t => t.k === 'word' ? { ...t, v: singular(t.v) } : t) })).filter(s => s.toks.length && s.toks.some(t => t.k === 'word'));
  const all = series.flatMap(s => s.values);
  const eq = (a: Token, b: Token) => a.k === b.k && (a.k === 'word' ? singular(a.v) === (b as { v: string }).v : a.k === 'num' || a.k === 'frac' ? near(a.v, (b as { v: number }).v) : a.v === (b as { v: string }).v);
  const followsChange = (s: Token[], i: number) => { const n = s[i + 1]; return isWord(n) && (CHANGE_WORDS.has(n.v) || n.v === 'of') || isMark(n, '/'); };
  for (const s of ss) {
    for (const l of labelled) {
      for (let i = 0; i + l.toks.length <= s.length; i++) {
        if (!l.toks.every((t, k) => eq(s[i + k]!, t))) continue;
        const end = i + l.toks.length;
        // L [word] N
        for (const j of [end, end + 1]) {
          const n = s[j];
          if (j === end + 1 && !(isWord(s[end]) && !CHANGE_WORDS.has((s[end] as { v: string }).v) && !labelled.some(o => o !== l && eq(s[end]!, o.toks[0]!)))) continue;
          if ((n?.k === 'num' || n?.k === 'frac') && !followsChange(s, j) && !isMark(s[j - 1], '/')) {
            if (!l.values.some(v => near(v, n.v))) out.push(`the text gives ${l.label} as ${fmt(n.v)}, but the chart shows ${fmt(l.values[0]!)}.`);
            break;
          }
          if (j === end && !isWord(s[end])) break;
        }
        // N L
        const p = s[i - 1];
        if ((p?.k === 'num' || p?.k === 'frac') && !isMark(s[i - 2], '/') && !l.values.some(v => near(v, p.v))) out.push(`the text gives ${l.label} as ${fmt(p.v)}, but the chart shows ${fmt(l.values[0]!)}.`);
      }
    }
    // "N <unit>" where <unit> is what the values count ("12 students" on a chart of Number of Students) must be a value or the total.
    // A scale statement ("Each square represents 2 books") is not a value.
    if (unit && !s.some(t => isWord(t, 'each', 'per', 'every', 'represents', 'stands'))) {
      const total = series.reduce((n, x) => n + x.values[0]!, 0);
      s.forEach((t, i) => {
        const w = s[i + 1];
        if (!isInt(t) || t.word || !isWord(w) || singular(w.v) !== unit || followsChange(s, i + 1) || [s[i - 1], s[i - 2]].some(x => isWord(x) && (CHANGE_WORDS.has(x.v) || x.v === 'than'))) return;
        if (!all.some(v => near(v, t.v)) && !near(total, t.v)) out.push(`the text says ${fmt(t.v)} ${plural(unit, t.v)}, but the chart's values are ${series.map(x => fmt(x.values[0]!)).join(', ')} (total ${fmt(total)}).`);
      });
    }
    // which/what … had N
    const words = s.filter(t => t.k === 'word').map(t => (t as { v: string }).v);
    if (words[0] === 'which' || words[0] === 'what') {
      for (let i = 0; i + 1 < s.length; i++) {
        if (!isWord(s[i], 'had', 'has', 'have', 'got', 'gets', 'scored', 'sold', 'received', 'collected', 'earned', 'shows', 'show')) continue;
        const n = isWord(s[i + 1], 'exactly') ? s[i + 2] : s[i + 1], at = isWord(s[i + 1], 'exactly') ? i + 2 : i + 1;
        if (n?.k === 'num' && !followsChange(s, at) && !all.some(v => near(v, n.v))) out.push(`the question asks which had ${fmt(n.v)}, but no value in the chart is ${fmt(n.v)}.`);
      }
    }
  }
  return [...new Set(out)];
}

/** The rejection reasons for an otherwise valid activity, prefixed "consistency:" for the ai-batch log and spec-eval. */
export function consistencyErrors(spec: ActivitySpec): string[] {
  return consistencyIssues(spec).map(i => `consistency: ${i.message}`);
}
