/**
 * REGRESSION FIXTURES for the semantic consistency lint (semantics.ts): activities that pass the
 * schema and the validator but whose figure contradicts the text or the key. They must be REJECTED.
 * Kept out of `fixtures` (which must all pass and render in the gallery).
 *
 * `live-apple-groups` is real gpt-4o output (Free2Z, strict json_schema structured output) shown to
 * a learner on a phone on 2026-10-05; only `version` and `id` were added. Everything else here is
 * hand-authored to cover the other figure types.
 */
import type { ActivitySpec } from '../spec';

export interface InconsistentFixture { spec: ActivitySpec; rule: 'structure' | 'total' | 'chart' | 'leak' | 'figure'; why: string }

const base = { version: 1 as const, difficulty: 3, explanation: 'Worked solution.' };

export const liveAppleGroups: ActivitySpec = {
  version: 1, id: 'live-apple-groups',
  prompt: [{ type: 'text', text: 'There are 3 groups of 4 apples each. How many apples are there in total?' }, { type: 'figure', figureId: 'apple-groups' }],
  figures: [{ id: 'apple-groups', type: 'picture', layout: 'column', alt: 'Two groups with 4 apples each; shaded and circled, no individual apples shown.',
    groups: [{ icon: 'apple', count: 4, arrangement: 'grid', color: 'teal', crossedOut: 0 }, { icon: 'apple', count: 4, arrangement: 'grid', color: 'teal', crossedOut: 0 }] }],
  response: { type: 'numeric', answer: 12, label: 'Apples' }, keyCheck: { value: '3*4' },
  hints: ['Think of the number of apples in each group.', 'Use multiplication to find the total.'],
  explanation: '$3 \\times 4 = 12$, so there are 12 apples in total.', skillIds: ['3.OA.A.1'], difficulty: 3,
};

export const inconsistentFixtures: InconsistentFixture[] = [
  { rule: 'structure', why: 'live: text and key say 3 groups of 4; the picture draws 2', spec: liveAppleGroups },
  { rule: 'total', why: 'no numbers in the text; the picture totals 8 but the key is 12', spec: { ...base, id: 'bad-picture-total', skillIds: ['3.OA.A.1'],
    prompt: [{ type: 'figure', figureId: 'p' }, { type: 'text', text: 'How many stars are there in all?' }],
    figures: [{ type: 'picture', id: 'p', alt: 'x', groups: [{ icon: 'star', count: 4 }, { icon: 'star', count: 4 }] }],
    response: { type: 'numeric', answer: 12 }, keyCheck: { value: '3*4' } } },
  { rule: 'structure', why: 'one group of 8 for "3 bags of 5"', spec: { ...base, id: 'bad-single-group', skillIds: ['3.OA.A.1'],
    prompt: [{ type: 'text', text: 'Ravi has 3 bags of 5 marbles.' }, { type: 'figure', figureId: 'p' }, { type: 'text', text: 'How many marbles does he have?' }],
    figures: [{ type: 'picture', id: 'p', alt: 'x', groups: [{ icon: 'gem', count: 8, arrangement: 'grid' }] }],
    response: { type: 'numeric', answer: 15 }, keyCheck: { value: '3*5' } } },
  { rule: 'structure', why: '"each plate has 4" across sentences; the picture has 3 per plate', spec: { ...base, id: 'bad-each-sentence', skillIds: ['3.OA.A.1'],
    prompt: [{ type: 'text', text: 'There are 3 plates. Each plate has 4 cookies.' }, { type: 'figure', figureId: 'p' }, { type: 'text', text: 'How many cookies are there?' }],
    figures: [{ type: 'picture', id: 'p', alt: 'x', groups: [{ icon: 'cookie', count: 3 }, { icon: 'cookie', count: 3 }, { icon: 'cookie', count: 3 }] }],
    response: { type: 'numeric', answer: 12 }, keyCheck: { value: '3*4' } } },
  { rule: 'structure', why: '"4 rows of 6 tiles" drawn as 4 rows of 5', spec: { ...base, id: 'bad-array-rows', skillIds: ['3.MD.C.7'],
    prompt: [{ type: 'text', text: 'A patio has 4 rows of 6 tiles.' }, { type: 'figure', figureId: 'a' }, { type: 'text', text: 'How many tiles cover the patio?' }],
    figures: [{ type: 'array_grid', id: 'a', alt: 'x', rows: 4, cols: 5, style: 'squares' }],
    response: { type: 'numeric', answer: 24 }, keyCheck: { value: '4*6' } } },
  { rule: 'structure', why: 'keyCheck multiplies 3 × 7 with no numbers in the text; the array is 3 × 6', spec: { ...base, id: 'bad-array-key', skillIds: ['3.MD.C.7'],
    prompt: [{ type: 'figure', figureId: 'a' }, { type: 'text', text: 'Each square is one square unit. What is the area?' }],
    figures: [{ type: 'array_grid', id: 'a', alt: 'x', rows: 3, cols: 6, style: 'squares' }],
    response: { type: 'numeric', answer: 21 }, keyCheck: { value: '3*7' } } },
  { rule: 'structure', why: 'the text uses eighths; the model is cut into 6', spec: { ...base, id: 'bad-fraction-parts', skillIds: ['3.NF.A.1'],
    prompt: [{ type: 'text', text: 'Lena ate $\\frac{3}{8}$ of a pizza.' }, { type: 'figure', figureId: 'f' }, { type: 'text', text: 'How much of the pizza is left?' }],
    figures: [{ type: 'fraction_model', id: 'f', alt: 'x', model: 'circle', parts: 6, shaded: 3 }],
    response: { type: 'fraction', numerator: 5, denominator: 8 }, keyCheck: { value: '1 - 3/8' } } },
  { rule: 'structure', why: '"cut into 8 equal parts" drawn with 6 parts', spec: { ...base, id: 'bad-fraction-count', skillIds: ['3.NF.A.1'],
    prompt: [{ type: 'text', text: 'A bar is cut into 8 equal parts.' }, { type: 'figure', figureId: 'f' }, { type: 'text', text: 'Which fraction is shaded?' }],
    figures: [{ type: 'fraction_model', id: 'f', alt: 'x', model: 'bar', parts: 6, shaded: 3 }],
    response: { type: 'multiple_choice', options: [{ text: '$\\frac{3}{8}$', correct: true }, { text: '$\\frac{5}{8}$', correct: false }] } } },
  { rule: 'total', why: 'what fraction is shaded: 3/8 shown, 3/6 keyed', spec: { ...base, id: 'bad-fraction-key', skillIds: ['3.NF.A.1'],
    prompt: [{ type: 'figure', figureId: 'f' }, { type: 'text', text: 'What fraction of the bar is shaded?' }],
    figures: [{ type: 'fraction_model', id: 'f', alt: 'x', model: 'bar', parts: 8, shaded: 3 }],
    response: { type: 'fraction', numerator: 3, denominator: 6 }, keyCheck: { value: '3/6' } } },
  { rule: 'total', why: 'coins total 68¢; the key is 73', spec: { ...base, id: 'bad-money', skillIds: ['2.MD.C.8'],
    prompt: [{ type: 'text', text: 'Sam finds these coins.' }, { type: 'figure', figureId: 'm' }, { type: 'text', text: 'How many cents does Sam have?' }],
    figures: [{ type: 'money', id: 'm', alt: 'x', items: [{ kind: 'quarter', count: 2 }, { kind: 'dime', count: 1 }, { kind: 'nickel', count: 1 }, { kind: 'penny', count: 3 }] }],
    response: { type: 'numeric', answer: 73 }, keyCheck: { value: '2*25+10+10+3' } } },
  { rule: 'total', why: 'the blocks show 47; the key is 57', spec: { ...base, id: 'bad-place-value', skillIds: ['1.NBT.B.2'],
    prompt: [{ type: 'figure', figureId: 'b' }, { type: 'text', text: 'What number do the blocks show?' }],
    figures: [{ type: 'place_value_blocks', id: 'b', alt: 'x', hundreds: 0, tens: 4, ones: 7 }],
    response: { type: 'numeric', answer: 57 }, keyCheck: { value: '5*10+7' } } },
  { rule: 'chart', why: '"Maria read 7" but her bar is 5', spec: { ...base, id: 'bad-chart-value', skillIds: ['3.MD.B.3'],
    prompt: [{ type: 'text', text: 'Maria read 7 books.' }, { type: 'figure', figureId: 'c' }, { type: 'text', text: 'How many more books did Tom read than Maria?' }],
    figures: [{ type: 'bar_chart', id: 'c', alt: 'x', bars: [{ label: 'Maria', value: 5 }, { label: 'Tom', value: 9 }] }],
    response: { type: 'numeric', answer: 2 }, keyCheck: { value: '9-7' } } },
  { rule: 'chart', why: 'which day had 12 visitors: no bar is 12', spec: { ...base, id: 'bad-chart-which', skillIds: ['3.MD.B.3'],
    prompt: [{ type: 'figure', figureId: 'c' }, { type: 'text', text: 'Which day had 12 visitors?' }],
    figures: [{ type: 'bar_chart', id: 'c', alt: 'x', bars: [{ label: 'Mon', value: 10, id: 'mon' }, { label: 'Tue', value: 14, id: 'tue' }] }],
    response: { type: 'tap_region', figureId: 'c', region: 'tue' } } },
  { rule: 'chart', why: 'spec-eval Haiku: "12 students" on a chart of Number of Students that totals 11', spec: { ...base, id: 'bad-chart-total', skillIds: ['6.SP.B.4'],
    prompt: [{ type: 'text', text: 'The bar chart shows how many books 12 students read last week.' }, { type: 'figure', figureId: 'c' }, { type: 'text', text: 'How many students read more than 2 books?' }],
    figures: [{ type: 'bar_chart', id: 'c', alt: 'x', yLabel: 'Number of Students', bars: [{ label: '1', value: 2 }, { label: '2', value: 4 }, { label: '3', value: 3 }, { label: '4', value: 2 }] }],
    response: { type: 'numeric', answer: 5 }, keyCheck: { value: '3+2' } } },
  { rule: 'chart', why: 'a pie slice quoted at the wrong percent', spec: { ...base, id: 'bad-pie', skillIds: ['6.RP.A.3'],
    prompt: [{ type: 'text', text: 'In the survey, Walk was 40% of answers.' }, { type: 'figure', figureId: 'c' }, { type: 'text', text: 'How many of 200 students walk?' }],
    figures: [{ type: 'pie_chart', id: 'c', alt: 'x', show: 'percents', slices: [{ label: 'Walk', value: 30 }, { label: 'Bus', value: 70 }] }],
    response: { type: 'numeric', answer: 60 }, keyCheck: { value: '0.3*200' } } },
  { rule: 'leak', why: 'the hypotenuse is labelled with the answer', spec: { ...base, id: 'bad-leak-label', skillIds: ['8.G.B.7'],
    prompt: [{ type: 'text', text: 'How long is the ramp?' }, { type: 'figure', figureId: 'g' }],
    figures: [{ type: 'geometry', id: 'g', alt: 'x', width: 10, height: 8, shapes: [{ kind: 'polygon', points: [{ x: 1, y: 1 }, { x: 9, y: 1 }, { x: 9, y: 7 }] }, { kind: 'label', at: { x: 4, y: 5 }, text: '10 m' }] }],
    response: { type: 'numeric', answer: 10 }, keyCheck: { value: 'sqrt(6^2+8^2)' } } },
  { rule: 'leak', why: 'the prompt writes the answer as a result', spec: { ...base, id: 'bad-leak-text', skillIds: ['3.OA.A.1'],
    prompt: [{ type: 'text', text: 'There are 3 rows of 4 chairs, so $3 \\times 4 = 12$. How many chairs?' }],
    response: { type: 'numeric', answer: 12 }, keyCheck: { value: '3*4' } } },
  { rule: 'leak', why: 'the jump arrow is labelled with the landing number', spec: { ...base, id: 'bad-leak-jump', skillIds: ['1.OA.C.5'],
    prompt: [{ type: 'text', text: 'A frog starts at 8 and hops forward 5.' }, { type: 'figure', figureId: 'l' }, { type: 'text', text: 'Where does it land?' }],
    figures: [{ type: 'number_line', id: 'l', alt: 'x', min: 0, max: 20, step: 1, jumps: [{ from: 8, to: 13, label: '13' }] }],
    response: { type: 'numeric', answer: 13 }, keyCheck: { value: '8+5' } } },
  { rule: 'leak', why: 'the digital readout shows the correct option', spec: { ...base, id: 'bad-leak-clock', skillIds: ['1.MD.B.3'],
    prompt: [{ type: 'figure', figureId: 'c' }, { type: 'text', text: 'What time is it?' }],
    figures: [{ type: 'clock', id: 'c', alt: 'x', hour: 3, minute: 30, showDigital: true }],
    response: { type: 'multiple_choice', options: [{ text: '3:30', correct: true }, { text: '6:15', correct: false }] } } },
];
