/** Gold specs for grades 6–8 (HAND-AUTHORED; see types.ts). The first slice has only labeled rectangles here. */
import { q } from './build';
import type { GoldSpec } from './types';

export const g68Gold: GoldSpec[] = [
  {
    id: 'g6-rect-labeled-decimal', note: 'area of a rectangle with a decimal side (6.G.A.1 groundwork)',
    activity: {
      aim: { skills: ['6.G.A.1'], theme: 'building', why: 'Area with non-whole side lengths.' },
      level: 4,
      model: {
        quantities: [q('w', 'length', '7.5', null, 'm'), q('h', 'length', '4', null, 'm')],
        structures: [{ id: 'r', kind: 'rect_area', roles: { h: 'h', w: 'w' }, show: 'labeled' }],
      },
      prompt: [{ text: 'A patio is a {{r.view}}.', type: 'text' }, { of: 'r', type: 'view' }, { text: 'What is its area?', type: 'text' }],
      response: { ask: 'r.area', distractors: [{ expr: 'r.perimeter', tag: 'perimeter_for_area' }], form: 'number' },
      support: { explanation: '{{r.w.n}} × {{r.h.n}} = {{r.area}}.', hints: ['Multiply the width by the height.'] },
    },
    expect: { key: '30', prompt: ['A patio is a rectangle.', 'What is its area?'], alt: 'A rectangle, labeled 7.5 meters wide and 4 meters tall.' },
  },
];
