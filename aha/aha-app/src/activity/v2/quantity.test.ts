import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { rational } from '../../learning/rational';
import {
  KIND_POWER, LENGTH_UNITS, QUANTITY_KINDS, UNIT_IDS, declaredDim, evaluate, exactDecimal, formatAsked, formatNumber, formatPlain, formatValue,
  isLiteral, isUnitId, kindTakesUnit, numberWords, parseExpr, pluralCategory, quantityValue, refsOf, unitName, unitSymbol,
  type Expr, type QuantityDecl, type Resolver, type Result, type Value,
} from './quantity';

const parsed = (s: string): Expr => { const r = parseExpr(s); assert.ok(r.ok, `${s}: ${!r.ok && r.error.message}`); return r.value; };
const parseError = (s: string): string => { const r = parseExpr(s); assert.ok(!r.ok, `${s} should not parse`); return r.error.code; };
const v = (q: string, power = 0, unit: Value['unit'] = null): Value => {
  const e = parsed(q); assert.equal(e.t, 'num');
  return { q: (e as Extract<Expr, { t: 'num' }>).q, power, unit };
};
/** A resolver over a fixed table of values; unknown paths fail like the model resolver will. */
const table = (entries: Record<string, Value>): Resolver => path => {
  const k = path.join('.');
  return Object.hasOwn(entries, k) ? { ok: true, value: entries[k]! } : { ok: false, error: { code: 'ref_unknown', message: `unknown ${k}` } };
};
const evalOk = (s: string, entries: Record<string, Value> = {}): Value => { const r = evaluate(parsed(s), table(entries)); assert.ok(r.ok, `${s}: ${!r.ok && r.error.message}`); return r.value; };
const evalError = (s: string, entries: Record<string, Value> = {}): string => { const r = evaluate(parsed(s), table(entries)); assert.ok(!r.ok, `${s} should fail`); return r.error.code; };
const plain = (r: Result<Value>) => { assert.ok(r.ok, !r.ok ? r.error.message : ''); return formatPlain(r.value.q); };

describe('kinds and units', () => {
  it('maps every kind to a power of length', () => {
    assert.deepEqual(QUANTITY_KINDS.map(k => KIND_POWER[k]), [0, 0, 0, 1, 2]);
    assert.deepEqual(QUANTITY_KINDS.filter(kindTakesUnit), ['length', 'area']);
  });
  it('has a closed unit registry that never reaches Object.prototype', () => {
    assert.ok(UNIT_IDS.includes('cm') && UNIT_IDS.includes('unit') && UNIT_IDS.includes('ft'));
    for (const bad of ['constructor', '__proto__', 'toString', 'CM', 'kg', 'sq_cm']) assert.equal(isUnitId(bad), false, bad);
    for (const u of UNIT_IDS) assert.ok(LENGTH_UNITS[u].one && LENGTH_UNITS[u].other && LENGTH_UNITS[u].symbol);
  });
  it('declares dimensions and rejects missing, extra and unknown units', () => {
    assert.deepEqual(declaredDim({ kind: 'length', unit: 'cm' }), { ok: true, value: { power: 1, unit: 'cm' } });
    assert.deepEqual(declaredDim({ kind: 'area', unit: 'unit' }), { ok: true, value: { power: 2, unit: 'unit' } });
    assert.deepEqual(declaredDim({ kind: 'count', unit: null }), { ok: true, value: { power: 0, unit: null } });
    const code = (r: ReturnType<typeof declaredDim>) => r.ok ? 'ok' : r.error.code;
    assert.equal(code(declaredDim({ kind: 'length', unit: null })), 'unit_missing');
    assert.equal(code(declaredDim({ kind: 'count', unit: 'cm' })), 'unit_unexpected');
    assert.equal(code(declaredDim({ kind: 'area', unit: 'acre' })), 'unit_unknown');
    assert.equal(code(declaredDim({ kind: 'length', unit: 'constructor' })), 'unit_unknown');
  });
});

describe('expression grammar', () => {
  it('reads literals exactly and keeps how they were written', () => {
    assert.deepEqual(parsed('12'), { t: 'num', q: rational(12n) });
    assert.deepEqual(parsed('2.5'), { t: 'num', q: rational(5n, 2n), form: { kind: 'decimal', places: 1 } });
    assert.deepEqual(parsed('0.50'), { t: 'num', q: rational(1n, 2n), form: { kind: 'decimal', places: 2 } });
    assert.deepEqual(parsed('3/4'), { t: 'num', q: rational(3n, 4n), form: { kind: 'fraction', n: 3n, d: 4n } });
    assert.deepEqual(parsed('2/4'), { t: 'num', q: rational(1n, 2n), form: { kind: 'fraction', n: 2n, d: 4n } });
    assert.deepEqual(parsed('-3/4'), { t: 'num', q: rational(-3n, 4n), form: { kind: 'fraction', n: -3n, d: 4n } });
    assert.deepEqual(parsed('−7'), { t: 'num', q: rational(-7n) });
    assert.deepEqual(parsed('-2.5'), { t: 'num', q: rational(-5n, 2n), form: { kind: 'decimal', places: 1 } });
    assert.deepEqual(parsed('-(3/4)'), { t: 'num', q: rational(-3n, 4n), form: { kind: 'fraction', n: -3n, d: 4n } });
    assert.equal(parsed('3/0').t, 'op', 'a zero denominator is not a literal; evaluation rejects it');
    assert.equal(parsed('1.5/2').t, 'op', 'a decimal over a whole number is arithmetic, not a written fraction');
    assert.equal(isLiteral(parsed('3/4')), true);
    assert.equal(isLiteral(parsed('3/4+1')), false);
    assert.equal(isLiteral(parsed('g')), false);
  });
  it('parses references with members', () => {
    assert.deepEqual(parsed('g'), { t: 'ref', path: ['g'] });
    assert.deepEqual(parsed('s.total'), { t: 'ref', path: ['s', 'total'] });
    assert.deepEqual(parsed('s2.groups'), { t: 'ref', path: ['s2', 'groups'] });
    assert.deepEqual(refsOf(parsed('2*(w+h) - w + s.area')), [['w'], ['h'], ['s', 'area']]);
    assert.deepEqual(refsOf(parsed('12')), []);
  });
  it('applies precedence, associativity, unary minus and implicit multiplication', () => {
    const value = (s: string, entries: Record<string, Value> = {}) => formatPlain(evalOk(s, entries).q);
    assert.equal(value('2+3*4'), '14');
    assert.equal(value('(2+3)*4'), '20');
    assert.equal(value('8/2/2'), '2');
    assert.equal(value('10-3-2'), '5');
    assert.equal(value('-2*-3'), '6');
    assert.equal(value('+4'), '4');
    const w = v('5', 1, 'cm'), h = v('3', 1, 'cm');
    assert.equal(value('2(w+h)', { w, h }), '16');
    assert.equal(value('(w)(h)', { w, h }), '15');
    assert.equal(value('3×4−2÷2'), '11');
    assert.equal(value('min(3, 5) + max(3, 5)'), '8');
  });
  it('rejects malformed, oversized and unsafe input', () => {
    assert.equal(parseError(''), 'expr_empty');
    assert.equal(parseError('   '), 'expr_empty');
    assert.equal(parseError('1+'.repeat(70) + '1'), 'expr_long');
    assert.equal(parseError('3^2'), 'expr_syntax');
    assert.equal(parseError('(1+2'), 'expr_syntax');
    assert.equal(parseError('1+2)'), 'expr_syntax');
    assert.equal(parseError('3 4'), 'expr_syntax');
    assert.equal(parseError('g h'), 'expr_syntax');
    assert.equal(parseError('max(1)'), 'expr_syntax');
    assert.equal(parseError('max(1, 2'), 'expr_syntax');
    assert.equal(parseError('Math.pow(2,3)'), 'expr_syntax');
    assert.equal(parseError('alert(1)'), 'expr_syntax');
    assert.equal(parseError('a_name_far_too_long'), 'expr_id');
    assert.equal(parseError('a.b.c.d'), 'expr_id');
    assert.equal(parseError('s.Total'), 'expr_syntax');
    assert.equal(parseError('s.t2'), 'expr_id');
    assert.deepEqual(parsed('target_frac'), { t: 'ref', path: ['target_frac'] }, 'snake_case ids');
    assert.equal(parseError('1234567890123'), 'expr_number');
    assert.equal(parseError('.5'), 'expr_syntax');
    assert.equal(parseError('1e3'), 'expr_syntax');
    assert.equal(parseError('2w'), 'expr_syntax');
    assert.equal(parseError('('.repeat(14) + '1' + ')'.repeat(14)), 'expr_size');
    assert.ok(parseExpr('min(a, max(b, (c+d)/2))').ok, 'ordinary nesting fits the depth limit');
    assert.equal(parseError(Array.from({ length: 30 }, () => '1').join('+')), 'expr_size');
  });
});

describe('exact evaluation with dimensions', () => {
  it('is exact where floats are not', () => {
    assert.equal(formatPlain(evalOk('0.1+0.2').q), '3/10');
    assert.equal(formatPlain(evalOk('1/3+1/6').q), '1/2');
    assert.equal(formatPlain(evalOk('1/3*3').q), '1');
  });
  it('tracks powers of length and their unit', () => {
    const w = v('5', 1, 'cm'), h = v('4', 1, 'cm'), a = v('24', 2, 'cm'), n = v('3');
    assert.deepEqual(evalOk('w+h', { w, h }), { q: rational(9n), power: 1, unit: 'cm' });
    assert.deepEqual(evalOk('w*h', { w, h }), { q: rational(20n), power: 2, unit: 'cm' });
    assert.deepEqual(evalOk('a/w', { a, w }), { q: rational(24n, 5n), power: 1, unit: 'cm' });
    assert.deepEqual(evalOk('2*(w+h)', { w, h }), { q: rational(18n), power: 1, unit: 'cm' });
    assert.deepEqual(evalOk('n*w', { n, w }), { q: rational(15n), power: 1, unit: 'cm' });
    assert.deepEqual(evalOk('w/h', { w, h }), { q: rational(5n, 4n), power: 0, unit: null });
    assert.deepEqual(evalOk('max(w, h)', { w, h }), { q: rational(5n), power: 1, unit: 'cm' });
  });
  it('rejects dimension errors, unit mixes, negative powers and division by zero', () => {
    const w = v('5', 1, 'cm'), m = v('2', 1, 'm'), a = v('24', 2, 'cm'), n = v('3');
    assert.equal(evalError('w+a', { w, a }), 'dimension_mismatch');
    assert.equal(evalError('w+2', { w }), 'dimension_mismatch');
    assert.equal(evalError('w+m', { w, m }), 'dimension_mismatch');
    assert.equal(evalError('w*m', { w, m }), 'dimension_mismatch');
    assert.equal(evalError('min(w, n)', { w, n }), 'dimension_mismatch');
    assert.equal(evalError('n/w', { n, w }), 'dimension_unsupported');
    assert.equal(evalError('n/(n-3)', { n }), 'division_by_zero');
    assert.equal(evalError('x'), 'ref_unknown');
    assert.equal(evalError('999999999999*999999999999*999999999999'), 'expr_magnitude');
    assert.equal(evalError('w*w*w*w', { w }), 'dimension_unsupported', 'no power of length above area');
  });
});

describe('declared quantities', () => {
  const decl = (over: Partial<QuantityDecl>): QuantityDecl => ({ id: 'q', kind: 'count', noun: null, unit: null, value: '3', ...over });
  const valueOf = (d: QuantityDecl, entries: Record<string, Value> = {}) => quantityValue(d, parsed(d.value), table(entries));
  const errorOf = (d: QuantityDecl, entries: Record<string, Value> = {}) => { const r = valueOf(d, entries); assert.ok(!r.ok, `${d.value} should fail`); return r.error.code; };
  it('gives a literal its declared dimension', () => {
    assert.deepEqual(valueOf(decl({ kind: 'length', unit: 'cm', value: '5' })), { ok: true, value: { q: rational(5n), power: 1, unit: 'cm' } });
    assert.deepEqual(valueOf(decl({ kind: 'fraction', value: '2/4' })), { ok: true, value: { q: rational(1n, 2n), power: 0, unit: null, form: { kind: 'fraction', n: 2n, d: 4n } } });
  });
  it('checks a derived value against its declaration', () => {
    const a = v('24', 2, 'cm'), w = v('4', 1, 'cm'), t = v('12'), g = v('3');
    assert.equal(plain(valueOf(decl({ kind: 'length', unit: 'cm', value: 'a/w' }), { a, w })), '6');
    assert.equal(plain(valueOf(decl({ kind: 'count', value: 't/g' }), { t, g })), '4');
    assert.equal(errorOf(decl({ kind: 'length', unit: 'cm', value: 'a*w' }), { a, w }), 'dimension_unsupported', 'length³: no kind measures it');
    assert.equal(errorOf(decl({ kind: 'length', unit: 'cm', value: 'w*w' }), { w }), 'dimension_mismatch');
    assert.equal(errorOf(decl({ kind: 'length', unit: 'm', value: 'a/w' }), { a, w }), 'dimension_mismatch');
    assert.equal(errorOf(decl({ kind: 'count', value: 'a/w' }), { a, w }), 'dimension_mismatch');
  });
  it('holds every kind to its domain', () => {
    assert.equal(errorOf(decl({ value: '3/2' })), 'count_not_whole');
    assert.equal(errorOf(decl({ value: '2.5' })), 'count_not_whole');
    assert.equal(errorOf(decl({ value: '-1' })), 'count_not_whole');
    assert.equal(errorOf(decl({ kind: 'length', unit: 'cm', value: '-2' })), 'measure_negative');
    assert.equal(errorOf(decl({ kind: 'area', unit: 'cm', value: '-2' })), 'measure_negative');
    assert.equal(errorOf(decl({ kind: 'length', unit: null })), 'unit_missing');
    assert.equal(errorOf(decl({ kind: 'number', unit: 'cm' })), 'unit_unexpected');
    assert.ok(valueOf(decl({ kind: 'number', value: '-2.5' })).ok, 'a number may be negative');
    assert.ok(valueOf(decl({ value: '0' })).ok, 'a count may be zero');
    const four = valueOf(decl({ value: '4/2' }));
    assert.ok(four.ok && four.value.form === undefined, 'a count written 4/2 displays as 2, never as a fraction');
  });
});

describe('formatting', () => {
  const text = (r: ReturnType<typeof formatNumber>) => r.map(p => p.kind === 'text' ? p.text : `$${p.tex}$`).join('');
  it('formats integers and terminating decimals per locale, exactly', () => {
    assert.equal(text(formatNumber({ q: rational(1234n) })), '1,234');
    assert.equal(text(formatNumber({ q: rational(1234n) }, 'de-DE')), '1.234');
    assert.equal(text(formatNumber({ q: rational(5n, 2n) })), '2.5');
    assert.equal(text(formatNumber({ q: rational(5n, 2n) }, 'de-DE')), '2,5');
    assert.equal(text(formatNumber({ q: rational(1n, 2n), form: { kind: 'decimal', places: 2 } })), '0.50');
    assert.equal(text(formatNumber({ q: rational(-1234567n, 100n) })), '-12,345.67');
    assert.equal(text(formatNumber({ q: rational(123456789012345678n, 1n) })), '123,456,789,012,345,678');
  });
  it('writes fractions as TeX and keeps their written terms', () => {
    assert.equal(text(formatNumber({ q: rational(3n, 4n), form: { kind: 'fraction', n: 3n, d: 4n } })), '$\\frac{3}{4}$');
    assert.equal(text(formatNumber({ q: rational(1n, 2n), form: { kind: 'fraction', n: 2n, d: 4n } })), '$\\frac{2}{4}$');
    assert.equal(text(formatNumber({ q: rational(1n, 3n) })), '$\\frac{1}{3}$');
    assert.equal(text(formatNumber({ q: rational(-1n, 3n) })), '$-\\frac{1}{3}$');
    assert.equal(text(formatNumber({ q: rational(2n), form: { kind: 'fraction', n: 4n, d: 2n } }, 'en-US', true)), '$\\frac{4}{2}$');
    assert.equal(text(formatNumber({ q: rational(3n, 4n) }, 'en-US', true)), '$\\frac{3}{4}$');
    assert.equal(text(formatNumber({ q: rational(2n) }, 'en-US', true)), '2');
  });
  it('finds exact decimals', () => {
    assert.deepEqual(exactDecimal(rational(3n, 8n)), { int: 0n, frac: '375', negative: false });
    assert.deepEqual(exactDecimal(rational(-5n, 4n)), { int: 1n, frac: '25', negative: true });
    assert.deepEqual(exactDecimal(rational(7n), 2), { int: 7n, frac: '00', negative: false });
    assert.equal(exactDecimal(rational(1n, 3n)), null);
    assert.equal(exactDecimal(rational(1n, 6n)), null);
  });
  it('chooses CLDR plural categories, honouring written decimals', () => {
    assert.equal(pluralCategory({ q: rational(1n) }), 'one');
    assert.equal(pluralCategory({ q: rational(2n) }), 'other');
    assert.equal(pluralCategory({ q: rational(0n) }), 'other');
    assert.equal(pluralCategory({ q: rational(1n), form: { kind: 'decimal', places: 1 } }), 'other');
    assert.equal(pluralCategory({ q: rational(1n, 2n) }), 'other');
    assert.equal(pluralCategory({ q: rational(1n, 3n) }), 'other');
    assert.equal(pluralCategory({ q: rational(1n) }, 'fr-FR'), 'one');
    assert.equal(pluralCategory({ q: rational(3n) }, 'ru-RU'), 'few');
    assert.equal(pluralCategory({ q: rational(10001n, 10000n) }), 'other', 'every printed decimal place counts');
  });
  it('names units and their squares', () => {
    assert.equal(unitName('cm', 1, 'one'), 'centimeter');
    assert.equal(unitName('ft', 1, 'other'), 'feet');
    assert.equal(unitName('cm', 2, 'other'), 'square centimeters');
    assert.equal(unitName('unit', 2, 'one'), 'square unit');
    assert.equal(unitName('ft', 2, 'few'), 'square feet');
    assert.equal(unitSymbol('cm', 1), 'cm');
    assert.equal(unitSymbol('cm', 2), 'cm²');
    assert.equal(unitSymbol('unit', 2), 'square units');
    assert.equal(unitSymbol('unit', 1), 'units');
  });
  it('writes whole numbers in English words', () => {
    const words = (n: bigint) => numberWords(rational(n));
    assert.equal(words(0n), 'zero');
    assert.equal(words(7n), 'seven');
    assert.equal(words(13n), 'thirteen');
    assert.equal(words(20n), 'twenty');
    assert.equal(words(21n), 'twenty-one');
    assert.equal(words(100n), 'one hundred');
    assert.equal(words(105n), 'one hundred five');
    assert.equal(words(120n), 'one hundred twenty');
    assert.equal(words(1000n), 'one thousand');
    assert.equal(words(999_999n), 'nine hundred ninety-nine thousand nine hundred ninety-nine');
    assert.equal(words(1_000_000n), null);
    assert.equal(words(-1n), null);
    assert.equal(numberWords(rational(1n, 2n)), null);
    assert.equal(numberWords(rational(3n), 'es-ES'), null);
  });
});

describe('formatValue', () => {
  const apple = { icon: 'apple', one: 'apple', other: 'apples' };
  const out = (r: ReturnType<typeof formatValue>) => { assert.ok(r.ok, !r.ok ? r.error.message : ''); return r.value.map(p => p.kind === 'text' ? p.text : `$${p.tex}$`).join(''); };
  const err = (r: ReturnType<typeof formatValue>) => { assert.ok(!r.ok); return r.error.code; };
  const count = (n: bigint) => ({ value: { q: rational(n), power: 0, unit: null }, noun: apple, kind: 'count' as const });
  it('writes the full form with an inflected noun or unit', () => {
    assert.equal(out(formatValue(count(4n), '')), '4 apples');
    assert.equal(out(formatValue(count(1n), '')), '1 apple');
    assert.equal(out(formatValue({ ...count(4n), noun: null }, '')), '4');
    assert.equal(out(formatValue({ value: { q: rational(6n), power: 1, unit: 'cm' }, noun: null, kind: 'length' }, '')), '6 centimeters');
    assert.equal(out(formatValue({ value: { q: rational(20n), power: 2, unit: 'unit' }, noun: null, kind: 'area' }, '')), '20 square units');
    assert.equal(out(formatValue({ value: { q: rational(3n, 4n), power: 1, unit: 'm' }, noun: null, kind: 'length' }, '')), '0.75 meters');
    assert.equal(out(formatValue({ value: { q: rational(3n, 4n), power: 1, unit: 'm', form: { kind: 'fraction', n: 3n, d: 4n } }, noun: null, kind: 'length' }, '')), '$\\frac{3}{4}$ meters');
    assert.equal(out(formatValue({ value: { q: rational(3n, 4n), power: 0, unit: null, form: { kind: 'fraction', n: 3n, d: 4n } }, noun: null, kind: 'fraction' }, '')), '$\\frac{3}{4}$');
  });
  it('writes the number, noun, forms, words and unit parts', () => {
    assert.equal(out(formatValue(count(12n), 'n')), '12');
    assert.equal(out(formatValue(count(12n), 'noun')), 'apples');
    assert.equal(out(formatValue(count(1n), 'noun')), 'apple');
    assert.equal(out(formatValue(count(12n), 'one')), 'apple');
    assert.equal(out(formatValue(count(1n), 'other')), 'apples');
    assert.equal(out(formatValue(count(12n), 'word')), 'twelve');
    const area = { value: { q: rational(20n), power: 2, unit: 'cm' as const }, noun: null, kind: 'area' as const };
    assert.equal(out(formatValue(area, 'other')), 'square centimeters');
    assert.equal(out(formatValue(area, 'unit')), 'square centimeters');
    assert.equal(err(formatValue(count(3n), 'unit')), 'placeholder_no_unit');
    assert.equal(err(formatValue({ ...count(3n), noun: null }, 'noun')), 'placeholder_no_noun');
    assert.equal(out(formatValue({ value: { q: rational(1n, 2n), power: 0, unit: null }, noun: null, kind: 'fraction' }, 'word')), 'one half');
    assert.equal(out(formatValue({ value: { q: rational(1n, 2n), power: 0, unit: null, form: { kind: 'fraction', n: 2n, d: 4n } }, noun: null, kind: 'fraction' }, 'word')), 'two fourths', 'a written fraction keeps its terms');
    assert.equal(out(formatValue({ value: { q: rational(3n, 4n), power: 0, unit: null }, noun: null, kind: 'fraction' }, 'word')), 'three fourths');
    assert.equal(err(formatValue({ value: { q: rational(1n, 13n), power: 0, unit: null }, noun: null, kind: 'fraction' }, 'word')), 'placeholder_no_words');
  });
});

describe('formatAsked', () => {
  it('names the asked value in the question form (plural), whatever the value', () => {
    const one: Value = { q: rational(1n, 1n), power: 2, unit: 'ft' };
    const text = (r: Result<{ kind: string; text?: string }[]>) => (r.ok ? r.value.map(x => x.text).join('') : r.error.code);
    assert.equal(text(formatAsked({ value: one, noun: null, kind: 'area' }, 'unit')), unitName('ft', 2, 'other'));
    assert.equal(text(formatAsked({ value: { q: rational(1n, 1n), power: 0, unit: null }, noun: { icon: null, one: 'apple', other: 'apples' }, kind: 'count' }, 'noun')), 'apples');
    assert.equal(text(formatAsked({ value: { q: rational(3n, 1n), power: 0, unit: null }, noun: null, kind: 'count' }, 'unit')), 'placeholder_no_unit');
  });
});
