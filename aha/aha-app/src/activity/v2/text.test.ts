import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { nounFormIssues, parseTempl, proseIssues, renderTempl, type PlaceholderResolver, type Templ, type TemplMode } from './text';
import type { Rich } from './quantity';

const templ = (s: string, mode: TemplMode = 'text'): Templ => { const r = parseTempl(s, mode); assert.ok(r.ok, `${s}: ${!r.ok && r.error.message}`); return r.value; };
const parseCode = (s: string, mode: TemplMode = 'text') => { const r = parseTempl(s, mode); assert.ok(!r.ok, `${s} should not parse`); return r.error.code; };
const codes = (s: string, mode: TemplMode = 'text', opts?: Parameters<typeof proseIssues>[1]) => proseIssues(templ(s, mode), opts).map(i => i.code);
const paths = (t: Templ) => t.placeholders.map(p => `${p.path.join('.')}${p.math ? '@math' : ''}`);

/** A resolver over a table: values as rich pieces, 'mask' for the answer, anything else unknown. */
const resolver = (entries: Record<string, Rich | 'mask'>): PlaceholderResolver => ph => {
  const k = ph.path.join('.');
  return Object.hasOwn(entries, k) ? { ok: true, value: entries[k]! } : { ok: false, error: { code: 'ref_unknown', message: `unknown ${k}` } };
};
const t = (text: string): Rich => [{ kind: 'text', text }];
const m = (tex: string): Rich => [{ kind: 'math', tex }];
const render = (s: string, entries: Record<string, Rich | 'mask'>, mode: TemplMode = 'text') => {
  const r = renderTempl(templ(s, mode), resolver(entries)); assert.ok(r.ok, `${s}: ${!r.ok && r.error.message}`); return r.value;
};
const renderCode = (s: string, entries: Record<string, Rich | 'mask'>, mode: TemplMode = 'text') => {
  const r = renderTempl(templ(s, mode), resolver(entries)); assert.ok(!r.ok, `${s} should not render`); return r.error.code;
};

describe('template parsing', () => {
  it('finds placeholders in text, inline math and math blocks', () => {
    assert.deepEqual(paths(templ('Ana fills {{s.groups}} with {{s.size}} each.')), ['s.groups', 's.size']);
    assert.deepEqual(paths(templ('So ${{s.groups.n}} \\times {{s.size.n}} = {{s.total.n}}$ in all.')), ['s.groups.n@math', 's.size.n@math', 's.total.n@math']);
    assert.deepEqual(paths(templ('{{a.n}} + {{b.n}} = {{c}}', 'math')), ['a.n@math', 'b.n@math', 'c@math']);
    assert.deepEqual(paths(templ('No numbers at all.')), []);
    assert.deepEqual(paths(templ('{{w2}} and {{s.total.other}}')), ['w2', 's.total.other']);
  });
  it('reads a TeX group around a placeholder', () => {
    const tp = templ('\\frac{{{s.selected.n}}}{{{s.parts.n}}}', 'math');
    assert.deepEqual(paths(tp), ['s.selected.n@math', 's.parts.n@math']);
    assert.equal(render('\\frac{{{a}}}{{{b}}}', { a: t('3'), b: t('4') }, 'math'), '\\frac{3}{4}');
  });
  it('rejects broken placeholders and broken math', () => {
    assert.equal(parseCode(''), 'templ_empty');
    assert.equal(parseCode('  '), 'templ_empty');
    assert.equal(parseCode('Ana has {{g apples.'), 'placeholder_syntax');
    assert.equal(parseCode('Ana has g}} apples.'), 'placeholder_syntax');
    assert.equal(parseCode('Ana has {{ g }} apples.'), 'placeholder_syntax');
    assert.equal(parseCode('{{G}}'), 'placeholder_syntax');
    assert.equal(parseCode('{{s.total.other.n}}'), 'placeholder_syntax');
    assert.equal(parseCode('{{s.t2}}'), 'placeholder_syntax');
    assert.equal(parseCode('{{toolongid9}}'), 'placeholder_syntax');
    assert.equal(parseCode('{{a$}}'), 'templ_math');
    assert.equal(parseCode('An open $\\frac{a}{b} span'), 'templ_math');
    assert.equal(parseCode(Array.from({ length: 25 }, () => '{{a}}').join(' ')), 'templ_size');
  });
  it('lets TeX close nested groups with }} inside math', () => {
    assert.deepEqual(paths(templ('$\\frac{1}{\\sqrt{x}}$ is fine')), []);
  });
});

describe('closed-list prose rules', () => {
  it('passes prose whose numbers all come from placeholders', () => {
    assert.deepEqual(codes('Ana fills {{s.groups}} with {{s.size}} each. How many {{s.total.other}} are there in all?'), []);
    assert.deepEqual(codes('{{a.n}} \\times {{b.n}} = {{c}}', 'math'), []);
    assert.deepEqual(codes('Shade {{u}} of the {{f.view}}.'), []);
    assert.deepEqual(codes('One basket is full. A cat sat first, then second.'), []);
    assert.deepEqual(codes('How many square units cover the {{r.view}}?'), [], '"square" is a unit word');
  });
  it('rejects numerals of every script, in text and in math', () => {
    for (const s of ['There are 3 baskets.', 'There are ٣ baskets.', 'Eat ½ of it.', 'Area in cm²', 'Chapter Ⅻ', '${\\frac{1}{2}}$ of it']) assert.deepEqual(codes(s), ['numeral'], s);
    assert.deepEqual(codes('\\frac{1}{2}', 'math'), ['numeral']);
  });
  it('rejects number words of two or more, but not "one" or ordinary ordinals', () => {
    assert.deepEqual(codes('There are two baskets.'), ['number_word']);
    assert.deepEqual(codes('Twenty-four apples.'), ['number_word', 'number_word']);
    assert.deepEqual(codes('She ate half of it.'), ['number_word']);
    assert.deepEqual(codes('A dozen eggs and a pair of socks.'), ['number_word', 'number_word']);
    assert.deepEqual(codes('Shade one fourth.'), ['number_word']);
    assert.deepEqual(codes('It doubled.'), ['number_word']);
    assert.deepEqual(codes('\\text{twelve}', 'math'), ['number_word']);
    assert.deepEqual(codes('one apple, the first one, a second try'), []);
  });
  it('rejects view words and phrases outside {{s.view}}', () => {
    assert.deepEqual(codes('Which section of the rectangle is {{u}}?'), ['view_word']);
    assert.deepEqual(codes('Look at the Number Line.'), ['view_word']);
    assert.deepEqual(proseIssues(templ('Read the bar graph.')).map(i => i.message), ['Name the figure with {{<structure>.view}}, not "bar graph".']);
    assert.deepEqual(codes('Graphs, a bar chart and number lines.'), ['view_word', 'view_word', 'view_word']);
    assert.deepEqual(codes('Count the pie pieces.'), ['view_word']);
    assert.deepEqual(codes('Look at the pictures.'), ['view_word']);
    assert.deepEqual(codes('A barn and a line of ducks.'), [], 'only whole words and whole phrases');
    assert.deepEqual(codes('number {{x}} line'), [], 'a placeholder separates words');
    assert.deepEqual(codes('the rectangle', 'text', { viewWords: false }), []);
  });
  it('reports each problem once and falls back to English lists for other locales', () => {
    assert.deepEqual(codes('two and two and 2 and 2'), ['numeral', 'number_word']);
    assert.deepEqual(codes('There are two baskets.', 'text', { locale: 'fr-FR' }), ['number_word']);
  });
  it('holds noun forms to letters and the number-word rule', () => {
    assert.deepEqual(nounFormIssues('apple'), []);
    assert.deepEqual(nounFormIssues('ice cream'), []);
    assert.deepEqual(nounFormIssues('jack-o-lantern'), []);
    assert.deepEqual(nounFormIssues('farmer’s hat'), []);
    assert.deepEqual(nounFormIssues('circle'), [], 'a count of drawn circles is fine; nouns skip the view-word rule');
    for (const bad of ['', 'apple2', 'apples!', '<b>apple</b>', 'a'.repeat(25), ' apple', 'apple  pie', '{{g}}', 'pie$']) assert.deepEqual(nounFormIssues(bad).map(i => i.code), ['noun_form'], bad);
    assert.deepEqual(nounFormIssues('two-wheeler').map(i => i.code), ['number_word']);
  });
});

describe('rendering', () => {
  it('renders text placeholders as rich text', () => {
    assert.equal(render('Ana fills {{s.groups}} with {{s.size}} each.', { 's.groups': t('3 baskets'), 's.size': t('4 apples') }), 'Ana fills 3 baskets with 4 apples each.');
    assert.equal(render('Shade {{u}} of the {{f.view}}.', { u: m('\\frac{1}{4}'), 'f.view': t('rectangle') }), 'Shade $\\frac{1}{4}$ of the rectangle.');
    assert.equal(render('Each is {{w}} long.', { w: [{ kind: 'math', tex: '\\frac{3}{4}' }, { kind: 'text', text: ' meters' }] }), 'Each is $\\frac{3}{4}$ meters long.');
  });
  it('renders math placeholders as TeX, nouns in \\text{}', () => {
    assert.equal(render('{{a.n}} \\times {{b.n}}', { 'a.n': t('3'), 'b.n': t('4') }, 'math'), '3 \\times 4');
    assert.equal(render('{{a}} + {{b}}', { a: t('3 apples'), b: [{ kind: 'text', text: '4' }, { kind: 'text', text: ' apples' }] }, 'math'), '\\text{3 apples} + 4\\text{ apples}');
    assert.equal(render('{{n}}', { n: t('1,234') }, 'math'), '1{,}234');
    assert.equal(render('So ${{a.n}} \\times {{b.n}}$ in all.', { 'a.n': t('3'), 'b.n': t('4') }), 'So $3 \\times 4$ in all.');
  });
  it('masks the unknown inside math and refuses it in text', () => {
    assert.equal(render('{{a.n}} \\times {{b.n}} = {{s.total.n}}', { 'a.n': t('3'), 'b.n': t('4'), 's.total.n': 'mask' }, 'math'), '3 \\times 4 = \\square ');
    assert.equal(render('Find ${{a.n}} \\times {{b.n}} = {{s.total.n}}$.', { 'a.n': t('3'), 'b.n': t('4'), 's.total.n': 'mask' }), 'Find $3 \\times 4 = \\square $.');
    assert.equal(renderCode('There are {{s.total}} apples.', { 's.total': 'mask' }), 'answer_in_text');
  });
  it('keeps literal dollar signs escaped', () => {
    assert.equal(render('It costs \\$ to enter; {{a}} came.', { a: t('3 friends') }), 'It costs \\$ to enter; 3 friends came.');
  });
  it('propagates resolver errors and holds the result to v1 text and TeX rules', () => {
    assert.equal(renderCode('Hello {{x}}.', {}), 'ref_unknown');
    assert.equal(renderCode('Hello {{x}}.', { x: t('<b>bold</b>') }), 'render_unsafe');
    assert.equal(renderCode('Hello {{x}}.', { x: t('see https://example.com') }), 'render_unsafe');
    assert.equal(renderCode('{{x}}', { x: m('\\href{https://x.io}{y}') }, 'math'), 'render_unsafe');
    assert.equal(renderCode('Total: {{x}}', { x: m('\\color{red}{4}') }), 'render_unsafe');
    assert.equal(renderCode('Hello {{x}}.', { x: t('a'.repeat(601)) }), 'render_long');
    assert.equal(renderCode('{{x}}', { x: m('\\frac{1}{') }, 'math'), 'render_unsafe');
  });
});
