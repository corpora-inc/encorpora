/**
 * The v1 consistency-lint corpus (origin/add-aha-semantic-checks, fixtures/inconsistent.ts: real
 * gpt-4o failures and hand-made contradictions that v1's schema and validator ACCEPT), translated to
 * v2 (README §12.1). Each case is one of:
 *
 * - `inexpressible`: the v2 strict schema cannot state it (an L0 rejection);
 * - `rejected`: a v2 activity attempting the same mistake, rejected with the stated code;
 * - `out_of_slice`: the intent it needs (charts, money, place value, time, shapes) arrives in a
 *   later step of the plan (README §15); the note says which.
 *
 * Attempts are built from gold specs by changing exactly what the v1 failure got wrong.
 */
import { gold } from './index';
import type { WireActivity } from '../wire';

const base = (id: string): WireActivity => structuredClone(gold.find(g => g.id === id)!.activity);
const tweak = (id: string, f: (a: WireActivity) => void) => { const a = base(id); f(a); return a as unknown; };

export interface TranslatedCase {
  /** The v1 fixture id and the lint rule it exercised. */
  v1: string; rule: 'structure' | 'total' | 'chart' | 'leak' | 'figure' | 'ambiguous' | 'kind';
  why: string;
  outcome: 'inexpressible' | 'rejected' | 'out_of_slice';
  /** For inexpressible and rejected: the v2 attempt and the code that rejects it. */
  attempt?: unknown; code?: string;
  /** For out_of_slice: the plan step that adds the intent. */
  step?: number;
}

export const translatedInconsistent: TranslatedCase[] = [
  { v1: 'live-quarter-pie', rule: 'ambiguous', why: 'live: every slice is 1/4 but one is keyed; v2 computes the regions of the view and finds four that satisfy the ask',
    outcome: 'rejected', code: 'tap_ambiguous', attempt: tweak('g3-fraction-rect-shade', a => { a.model.structures[0]!.show = 'circle'; a.prompt[0] = { text: 'Which section of the {{f.view}} is {{u}}?', type: 'text' }; a.response = { ask: 'u', form: 'tap', on: 'f' }; }) },
  { v1: 'live-quarter-pie', rule: 'kind', why: 'live: the prose says rectangle over a circle; v2 prose cannot name a figure except through {{f.view}}',
    outcome: 'rejected', code: 'view_word', attempt: tweak('g3-fraction-rect-shade', a => { a.model.structures[0]!.show = 'circle'; a.prompt[0] = { text: 'Shade {{u}} of the rectangle.', type: 'text' }; }) },
  { v1: 'live-square-units-pie', rule: 'kind', why: 'live: square units drawn as a pie; rect_area has no chart view',
    outcome: 'inexpressible', code: 'schema', attempt: tweak('g3-rect-unit-squares', a => { (a.model.structures[0] as { show: string }).show = 'pie'; }) },
  { v1: 'bad-equal-options', rule: 'ambiguous', why: '0.5 marked wrong beside 1/2; a v2 distractor rule equal to the key is dropped by value, leaving too few options here',
    outcome: 'rejected', code: 'choose_options', attempt: tweak('g3-fraction-circle-read', a => { a.model.quantities[0]!.value = '8'; a.model.quantities[1]!.value = '4'; a.response = { ask: 'f.fraction', candidates: null, distractors: [{ expr: 'f.selected/f.parts', tag: 'whole_number_bias' }], form: 'choose' }; }) },
  { v1: 'bad-equal-bars', rule: 'ambiguous', why: 'two bars of 6, one keyed; bar charts arrive with the dataset intent, whose regions get the same computed uniqueness', outcome: 'out_of_slice', step: 9 },
  { v1: 'bad-kind-line', rule: 'kind', why: 'prose points at a number line over a bar chart; prose cannot name a figure',
    outcome: 'rejected', code: 'view_word', attempt: tweak('g3-equal-groups-orchard', a => { a.prompt[0] = { text: 'Look at the number line. Ana fills {{s.groups}} with {{s.size}} each.', type: 'text' }; }) },
  { v1: 'live-apple-groups', rule: 'structure', why: 'live: the text says 3 groups, the picture draws 2; v2 prose states no number of its own',
    outcome: 'rejected', code: 'numeral', attempt: tweak('g3-equal-groups-orchard', a => { a.model.quantities[0]!.value = '2'; a.prompt[0] = { text: 'There are 3 groups of {{s.size}} each.', type: 'text' }; }) },
  { v1: 'bad-picture-total', rule: 'total', why: 'the picture totals 8 but the key is 12; a v2 key is computed, so asserting 12 is not expressible as an ask',
    outcome: 'rejected', code: 'ask_not_ref', attempt: tweak('g3-equal-groups-orchard', a => { a.response = { ask: '12', distractors: [], form: 'number' }; }) },
  { v1: 'bad-single-group', rule: 'structure', why: '"3 bags of 5" drawn as one group of 8; the prose cannot state the bags or their size',
    outcome: 'rejected', code: 'numeral', attempt: tweak('g3-equal-groups-orchard', a => { a.prompt[0] = { text: 'Ravi has 3 bags of 5 marbles.', type: 'text' }; }) },
  { v1: 'bad-each-sentence', rule: 'structure', why: '"each plate has 4" across sentences, 3 drawn; the size comes only from the structure',
    outcome: 'rejected', code: 'number_word', attempt: tweak('g3-equal-groups-orchard', a => { a.prompt[0] = { text: 'There are some plates. Each plate has four cookies.', type: 'text' }; }) },
  { v1: 'bad-array-rows', rule: 'structure', why: '"4 rows of 6 tiles" drawn 4 by 5',
    outcome: 'rejected', code: 'numeral', attempt: tweak('g3-array-chairs', a => { a.prompt[0] = { text: 'A patio has 4 rows of 6 tiles.', type: 'text' }; }) },
  { v1: 'bad-array-key', rule: 'structure', why: 'the key multiplies 3 × 7 over a 3 × 6 array; v2 asks the array\'s total',
    outcome: 'rejected', code: 'ask_not_ref', attempt: tweak('g3-array-chairs', a => { a.response = { ask: '3*7', distractors: [], form: 'number' }; }) },
  { v1: 'bad-fraction-parts', rule: 'structure', why: 'the text uses eighths over a model cut into 6; a fraction in prose is a placeholder',
    outcome: 'rejected', code: 'numeral', attempt: tweak('g3-fraction-circle-read', a => { a.prompt[0] = { text: 'Lena ate $\\frac{3}{8}$ of a pizza.', type: 'text' }; }) },
  { v1: 'bad-fraction-count', rule: 'structure', why: '"cut into 8 equal parts" drawn with 6',
    outcome: 'rejected', code: 'numeral', attempt: tweak('g3-fraction-circle-read', a => { a.prompt[0] = { text: 'A pizza is cut into 8 equal slices.', type: 'text' }; }) },
  { v1: 'bad-fraction-key', rule: 'total', why: '3/8 shown, 3/6 keyed; the key is the model\'s fraction',
    outcome: 'rejected', code: 'ask_not_ref', attempt: tweak('g3-fraction-circle-read', a => { a.response = { ask: '3/6', distractors: [], exactness: 'any', form: 'fraction' }; }) },
  { v1: 'bad-money', rule: 'total', why: 'coins total 68¢, the key is 73', outcome: 'out_of_slice', step: 8 },
  { v1: 'bad-place-value', rule: 'total', why: 'the blocks show 47, the key is 57', outcome: 'out_of_slice', step: 8 },
  { v1: 'bad-chart-value', rule: 'chart', why: '"Maria read 7" but her bar is 5', outcome: 'out_of_slice', step: 9 },
  { v1: 'bad-chart-which', rule: 'chart', why: 'no bar is 12', outcome: 'out_of_slice', step: 9 },
  { v1: 'bad-chart-total', rule: 'chart', why: '"12 students" on a chart totalling 11', outcome: 'out_of_slice', step: 9 },
  { v1: 'bad-pie', rule: 'chart', why: 'a slice quoted at the wrong percent', outcome: 'out_of_slice', step: 9 },
  { v1: 'bad-leak-label', rule: 'leak', why: 'a side labeled with the answer; for a rectangle the asked side is drawn "?", so asking a labeled given is asserted',
    outcome: 'rejected', code: 'ask_asserted', attempt: tweak('g3-rect-labeled-area', a => { a.prompt[2] = { text: 'How wide is it?', type: 'text' }; a.response = { ask: 'r.w', distractors: [], form: 'number' }; a.support.hints = []; }) },
  { v1: 'bad-leak-text', rule: 'leak', why: 'the prose writes the answer; in v2 the answer is masked in math and refused in text',
    outcome: 'rejected', code: 'answer_in_text', attempt: tweak('g3-equal-groups-orchard', a => { a.prompt[2] = { text: 'So there are {{s.total}}. How many in all?', type: 'text' }; }) },
  { v1: 'bad-leak-jump', rule: 'leak', why: 'the jump line prints the landing number that is asked; v2 computes what each view shows',
    outcome: 'rejected', code: 'answer_shown', attempt: tweak('g3-equal-groups-orchard', a => { a.model.structures[0]!.show = 'jumps'; }) },
  { v1: 'bad-leak-clock', rule: 'leak', why: 'the digital readout shows the answer', outcome: 'out_of_slice', step: 8 },
];
