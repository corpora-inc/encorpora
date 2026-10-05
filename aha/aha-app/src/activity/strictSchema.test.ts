/**
 * Property test: the strict wire schema (sent as response_format) and the app validator must agree.
 * json-schema-faker draws random instances of the strict schema; after normalizeActivity, every
 * activity must pass the validator's shape rules (zod + where keyCheck is required, forbidden, and
 * its form). A failure here is schema/validator drift: fix the drift, not the test.
 *
 * The schema cannot express string lengths or the text rules (safe text, TeX, expressions), which the
 * validator alone enforces, so the generator writes short numerals for free text. Every other keyword
 * (types, enums, patterns, numeric bounds, item counts, required, nullability, variants) is the
 * schema's own.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSync, type JsonSchema } from 'json-schema-faker';
import { activityBatchStrictJsonSchema } from './schema';
import { KEY_CHECK_FORM, normalizeActivity, shapeErrors, validateActivityBatch } from './spec';

type Node = Record<string, any>;
const FREE_TEXT = '^[1-9][0-9]{0,2}$';
/** Free text (no pattern or enum) becomes a short numeral: valid plain text, rich text, TeX and arithmetic. */
function numeralText(node: any): any {
  if (Array.isArray(node)) return node.map(numeralText);
  if (!node || typeof node !== 'object') return node;
  const out: Node = Object.fromEntries(Object.entries(node).map(([k, v]) => [k, k === 'properties'
    ? Object.fromEntries(Object.entries(v as Node).map(([pk, pv]) => [pk, numeralText(pv)])) : numeralText(v)]));
  const types = Array.isArray(out.type) ? out.type : [out.type];
  if (types.includes('string') && !out.pattern && !out.enum) out.pattern = FREE_TEXT;
  return out;
}
const generatorSchema = numeralText(activityBatchStrictJsonSchema) as JsonSchema;
const SAMPLES = 400;
// json-schema-faker stops honouring the schema below maxDepth (default 5) and fills placeholders; activities nest deeper.
const batches = Array.from({ length: SAMPLES }, (_, i) => generateSync(generatorSchema, { seed: i + 1, maxDepth: 32 }) as Node);
const activities = batches.flatMap(b => b.activities as Node[]);

test(`generated strict-schema instances (${SAMPLES} batches) pass the validator's shape rules after normalization`, () => {
  const failures = activities.map(a => ({ a, errors: shapeErrors(a) })).filter(f => f.errors.length);
  const rate = 1 - failures.length / activities.length;
  const reasons = new Map<string, number>();
  for (const f of failures) for (const e of f.errors) reasons.set(e.replace(/\[\d+\]/g, '[]'), (reasons.get(e.replace(/\[\d+\]/g, '[]')) ?? 0) + 1);
  console.log(`strict-schema property test: ${activities.length - failures.length}/${activities.length} activities shape-valid (${(rate * 100).toFixed(2)}%)`);
  assert.ok(activities.length >= SAMPLES, 'every batch carries at least one activity');
  assert.ok(rate >= 0.99, `schema/validator drift (${(rate * 100).toFixed(2)}%): ${JSON.stringify([...reasons].sort((x, y) => y[1] - x[1]).slice(0, 8))}`);
});

test('the generator exercises every response type, every figure type and both keyCheck forms', () => {
  const responses = new Set(activities.map(a => a.response.type));
  assert.deepEqual([...responses].sort(), Object.keys(KEY_CHECK_FORM).sort());
  const figures = new Set(activities.flatMap(a => (a.figures ?? []).map((f: Node) => f.type)));
  assert.equal(figures.size, 15, [...figures].join(','));
  // Strict instances carry every key: unused optional fields arrive as null, and keyCheck rides in the response.
  assert.ok(activities.every(a => !('keyCheck' in a)), 'no activity-level keyCheck on the wire');
  for (const a of activities) {
    const form = KEY_CHECK_FORM[a.response.type as keyof typeof KEY_CHECK_FORM];
    assert.equal('keyCheck' in a.response, form !== null, a.response.type);
    if (form) assert.ok(a.response.keyCheck && typeof a.response.keyCheck === 'object', `${a.response.type}: keyCheck is required, never null`);
    if (form === 'value') assert.deepEqual(Object.keys(a.response.keyCheck), ['value']);
    if (form === 'point') assert.deepEqual(Object.keys(a.response.keyCheck).sort(), ['x', 'y']);
    const n = normalizeActivity(a) as Node;
    assert.equal('keyCheck' in n.response, false, 'normalization lifts keyCheck out of the response');
    assert.equal('keyCheck' in n, form !== null);
  }
});

test('every figure variant requires a non-null alt, and numeric fields are never booleans, in the strict schema', () => {
  const item = (activityBatchStrictJsonSchema as Node).properties.activities.items;
  const figures: Node[] = item.properties.figures.items.anyOf;
  assert.equal(figures.length, 15);
  for (const f of figures) {
    assert.ok(f.required.includes('alt'), f.properties.type.enum[0]);
    assert.equal(f.properties.alt.type, 'string', `${f.properties.type.enum[0]}: alt is a required string, not nullable`);
  }
  const fraction = figures.find(f => f.properties.type.enum[0] === 'fraction_model')!;
  assert.equal(fraction.properties.shaded.type, 'integer');
  const grid = figures.find(f => f.properties.type.enum[0] === 'array_grid')!;
  assert.deepEqual(grid.properties.shaded.type, ['integer', 'null']);
  assert.equal(item.additionalProperties, false);
  assert.ok(!('keyCheck' in item.properties), 'keyCheck lives in the response variants');
  assert.deepEqual((activityBatchStrictJsonSchema as Node).required.sort(), ['activities', 'rationale'], 'the root is the batch envelope, never a bare activity');
});

// ---- Regression fixtures: the five error shapes from the live gpt-4o run of 2026-10-05 (prompt-only replies) ----
const skillIds = new Set(['3.NF.A.1', '2.MD.C.8', '3.OA.A.1', '4.NBT.A.3']);
const numeric = (extra: Node = {}) => ({ version: 1, id: 'a-coins', skillIds: ['2.MD.C.8'], difficulty: 3,
  prompt: [{ type: 'text', text: 'Mia has 3 dimes and 2 nickels. How many cents is that?' }],
  response: { type: 'numeric', answer: 40, unit: 'cents' }, keyCheck: { value: '3*10+2*5' }, explanation: '$30+10=40$ cents.', ...extra });

test('live error shape 1: a numeric answer without keyCheck is rejected; with keyCheck in the response (strict wire shape) it passes', () => {
  const { keyCheck, ...missing } = numeric();
  assert.deepEqual(validateActivityBatch({ rationale: 'r', activities: [missing] }, { skillIds }).rejected[0]?.errors, ['keyCheck: required for this answer type.']);
  const wire = { ...missing, response: { ...missing.response, keyCheck } };
  assert.equal(validateActivityBatch({ rationale: 'r', activities: [wire] }, { skillIds }).accepted.length, 1);
  const both = { ...numeric(), response: { ...missing.response, keyCheck } };
  assert.match(validateActivityBatch({ rationale: 'r', activities: [both] }, { skillIds }).rejected[0]!.errors[0]!, /response: unknown field\(s\) keyCheck/, 'never both');
});

test('live error shape 2: an unknown response member is named (not redacted as "key: …") and rejected', () => {
  const r = validateActivityBatch({ rationale: 'r', activities: [numeric({ response: { type: 'numeric', answer: 40, correctAnswer: 40 } })] }, { skillIds });
  assert.deepEqual(r.rejected[0]?.errors, ['response: unknown field(s) correctAnswer']);
  // Nulls for unused optional members (strict output) are absent, never unknown.
  const nulls = numeric({ response: { type: 'numeric', answer: 40, tolerance: null, unit: null, label: null, misconceptionAnswers: null } });
  assert.equal(validateActivityBatch({ rationale: 'r', activities: [nulls] }, { skillIds }).accepted.length, 1);
});

test('live error shapes 3 and 4: a figure without alt, or with a boolean shaded, is rejected; the strict schema forbids both', () => {
  const figure = { type: 'fraction_model', id: 'f', alt: 'A bar cut into 4 equal parts, 1 shaded.', model: 'bar', parts: 4, shaded: 1 };
  const base = { version: 1, id: 'a-frac', skillIds: ['3.NF.A.1'], difficulty: 2, prompt: [{ type: 'text', text: 'What fraction is shaded?' }, { type: 'figure', figureId: 'f' }],
    response: { type: 'fraction', numerator: 1, denominator: 4 }, keyCheck: { value: '1/4' }, explanation: 'One of 4 equal parts: $\\frac{1}{4}$.' };
  assert.equal(validateActivityBatch({ rationale: 'r', activities: [{ ...base, figures: [figure] }] }, { skillIds }).accepted.length, 1);
  const { alt, ...noAlt } = figure;
  assert.match(validateActivityBatch({ rationale: 'r', activities: [{ ...base, figures: [noAlt] }] }, { skillIds }).rejected[0]!.errors[0]!, /figures\[0\]\.alt: Invalid input: expected string, received undefined/);
  assert.match(validateActivityBatch({ rationale: 'r', activities: [{ ...base, figures: [{ ...figure, shaded: true }] }] }, { skillIds }).rejected[0]!.errors[0]!, /figures\[0\]\.shaded: Invalid input: expected number, received boolean/);
  assert.ok(alt);
});

test('live error shape 5: keyCheck round(x, 2) now evaluates; round with three inputs is still rejected', () => {
  const r = validateActivityBatch({ rationale: 'r', activities: [numeric({ id: 'a-avg', response: { type: 'numeric', answer: 3.33 }, keyCheck: { value: 'round(10/3, 2)' } })] }, { skillIds });
  assert.equal(r.accepted.length, 1, JSON.stringify(r.rejected));
  const bad = validateActivityBatch({ rationale: 'r', activities: [numeric({ keyCheck: { value: 'round(40, 0, 1)' } })] }, { skillIds });
  assert.match(bad.rejected[0]!.errors.join(' '), /round takes 1 or 2 input\(s\)/);
});

test('live error shape 6: a bare activity at the top level is a batch of one (prompt-only path)', () => {
  for (const reply of [numeric(), JSON.stringify(numeric()), 'Here it is:\n```json\n' + JSON.stringify(numeric()) + '\n```']) {
    const r = validateActivityBatch(reply, { skillIds });
    assert.equal(r.accepted.length, 1, JSON.stringify(r));
    assert.equal(r.accepted[0]!.id, 'a-coins');
    assert.equal(r.rationale, '');
    assert.match(r.errors.join(' '), /single activity/);
  }
  // An invalid bare activity is rejected at index 0, with its own reasons, never as an envelope error.
  const r = validateActivityBatch(JSON.stringify(numeric({ difficulty: 99 })), { skillIds });
  assert.equal(r.rejected[0]?.index, 0);
  // A damaged envelope that names "activities" still goes through per-item recovery, not the single-activity path.
  const damaged = `{"rationale":"r","activities":[${JSON.stringify(numeric())},${JSON.stringify(numeric({ id: 'a-two' })).slice(0, -1)}`;
  const recovered = validateActivityBatch(damaged, { skillIds });
  assert.equal(recovered.accepted.length, 1);
  assert.doesNotMatch(recovered.errors.join(' '), /single activity/);
});
