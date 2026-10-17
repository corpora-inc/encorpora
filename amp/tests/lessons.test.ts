import test from 'node:test';
import assert from 'node:assert/strict';
import { lessons } from '../src/content/lessons.js';
import { normalizeAnswer, templates } from '../src/math/engine.js';

test('each implemented family has one navigable lesson with teaching and practice support', () => {
  const ids = new Set<string>();
  const bindings = new Map<string, number>();
  for (const lesson of lessons) {
    assert.equal(ids.has(lesson.id), false); ids.add(lesson.id);
    for (const id of lesson.templateIds) {
      assert.ok(templates.some(t => t.id === id), `Unknown family ${id}`);
      bindings.set(id, (bindings.get(id) ?? 0) + 1);
    }
    assert.ok(lesson.objectives.length >= 2);
    assert.ok(lesson.sections.length >= 2);
    assert.ok(lesson.sections.every(s => s.paragraphs.length >= 2));
    assert.ok(lesson.workedExample.steps.length >= 2);
    assert.ok(lesson.pitfalls.length >= 2);
    assert.ok(lesson.parentGuide.length > 40);
  }
  for (const template of templates) assert.equal(bindings.get(template.id), 1);
});

test('worked examples have independently calculated exact answers', () => {
  // These independent computations pin the facts in the authored examples.
  // Changing a worked example requires reviewing its statement and this oracle.
  const answers: Record<string, string> = {
    counting: String(['●', '●', '●', '●', '●'].length),
    addition: String(8 + 5), subtraction: String(14 - 6), multiplication: String(7 * 6),
    fractions: '1/2', 'fraction-addition': `${1 * 4 + 1 * 3}/${3 * 4}`,
    area: String(6 * 4), 'linear-equations': String((-7 - 5) / 3),
    'statistics-mean': `${[3, 4, 4, 7, 8].reduce((a, b) => a + b, 0)}/5`,
    'pythagorean-theorem': String(Math.hypot(6, 8)),
    quadratics: String(Math.min(...Array.from({ length: 9 }, (_, x) => 2 * (x - 3) ** 2 + 5))),
    'geometric-sequences': String([1, 2, 3, 4].reduce(a => a * 2, 3)),
    logarithms: String([3, 9, 27, 81].indexOf(81) + 1),
  };
  for (const lesson of lessons) assert.equal(normalizeAnswer(lesson.workedExample.answer), normalizeAnswer(answers[lesson.id]!));
  const equation = lessons.find(l => l.id === 'linear-equations')!;
  assert.equal(3 * Number(equation.workedExample.answer) + 5, -7);
  const geometry = lessons.find(l => l.id === 'pythagorean-theorem')!;
  assert.equal(Number(geometry.workedExample.answer) ** 2, 6 ** 2 + 8 ** 2);
});

test('lessons distinguish the instructional conditions that otherwise cause false rules', () => {
  const prose = (id: string) => JSON.stringify(lessons.find(l => l.id === id));
  assert.match(prose('fractions'), /equal.*parts/);
  assert.match(prose('fraction-addition'), /same whole/);
  assert.match(prose('pythagorean-theorem'), /right triangles/);
  assert.match(prose('quadratics'), /positive/);
  assert.match(prose('quadratics'), /minimum value/);
  assert.match(prose('geometric-sequences'), /term 1/);
  assert.match(prose('logarithms'), /different from one/);
  assert.match(prose('statistics-mean'), /repeated/);
});
