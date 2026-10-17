import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { graphicalTemplates, generateGraphicalProblem } from '../src/math/graphical.js';
import { GraphicalFigure, type GraphicalFigureData } from '../src/web/GraphicalFigure.js';
import { graphicalLessons } from '../src/content/graphical-lessons.js';
import { skills } from '../src/curriculum/catalog.js';
function number(answer: string) { const [n, d = '1'] = answer.split('/'); return Number(n) / Number(d); }
function attributes(html: string, marker: string) {
  const tag = html.match(new RegExp(`<[^>]+${marker}[^>]*>`))?.[0];
  assert.ok(tag, marker);
  return Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(match => [match[1]!, match[2]!]));
}
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test('graphical families have valid catalog and lesson associations', () => {
  assert.equal(graphicalTemplates.length, 6);
  for (const template of graphicalTemplates) {
    assert.ok(skills.some(skill => skill.id === template.skillId));
    assert.equal(graphicalLessons.filter(lesson => lesson.templateIds.includes(template.id)).length, 1);
  }
});

test('independent answers follow displayed givens over varied deterministic seeds', () => {
  for (const template of graphicalTemplates) for (let seed = 0; seed < 150; seed++) {
    const problem = generateGraphicalProblem(template.id, `visual-${seed}`);
    assert.deepEqual(problem, generateGraphicalProblem(template.id, `visual-${seed}`));
    const figure = problem.public.figure!;
    let expected: number;
    switch (figure.kind) {
      case 'coordinate-plane': {
        assert.ok(figure.points.every(p => p.x >= figure.xMin && p.x <= figure.xMax && p.y >= figure.yMin && p.y <= figure.yMax));
        if (template.id === 'coordinate-point-reading') expected = problem.public.prompt.includes('x-coordinate') ? figure.points[0]!.x : figure.points[0]!.y;
        else {
          const [a, b] = figure.points;
          expected = (b!.y - a!.y) / (b!.x - a!.x);
          for (const point of figure.points) near(figure.lines![0]!.m * point.x + figure.lines![0]!.b, point.y);
        } break;
      }
      case 'bar-chart': {
        assert.equal(figure.categories.length, figure.values.length);
        if (template.id === 'bar-chart-total') expected = figure.values.reduce((sum, value) => sum + value, 0);
        else {
          const names = /more (\w+) trees than (\w+) trees/.exec(problem.public.prompt)!;
          expected = figure.values[figure.categories.indexOf(names[1]!)]! - figure.values[figure.categories.indexOf(names[2]!)]!;
          assert.ok(expected > 0);
        } break;
      }
      case 'clock': {
        const end = /ends at (\d+):(\d+)/.exec(problem.public.prompt)!;
        expected = Number(end[1]) * 60 + Number(end[2]) - (figure.hour * 60 + figure.minute);
        assert.ok(expected >= 15 && expected <= 120);
        assert.ok(Number(end[1]) < 12);
        assert.ok(problem.public.prompt.includes('same morning')); break;
      }
      case 'number-line': expected = Math.abs(figure.points[1]! - figure.points[0]!); break;
      default: assert.fail(`Unexpected graphical figure: ${figure.kind}`);
    }
    near(number(problem.answer), expected);
    assert.ok(problem.explanation.length >= 2);
  }
});

test('SVG coordinates and heights preserve mathematical positions and scales', () => {
  for (const template of graphicalTemplates) for (let seed = 0; seed < 20; seed++) {
    const figure = generateGraphicalProblem(template.id, `render-${seed}`).public.figure as GraphicalFigureData;
    const html = renderToStaticMarkup(React.createElement(GraphicalFigure, { figure }));
    assert.ok(html.includes('role="img"'));
    assert.ok(html.includes('aria-label='));
    assert.ok(!html.includes('NaN') && !html.includes('Infinity'));
    if (figure.kind === 'coordinate-plane') {
      for (const point of figure.points) {
        const attr = attributes(html, `data-point="${point.label}"`);
        near(Number(attr.cx), 45 + (point.x - figure.xMin) * 300 / (figure.xMax - figure.xMin));
        near(Number(attr.cy), 325 - (point.y - figure.yMin) * 300 / (figure.yMax - figure.yMin));
      }
      if (figure.lines?.length) {
        const line = attributes(html, 'data-line="graph"');
        for (const suffix of ['1', '2']) {
          const x = (Number(line[`x${suffix}`]) - 45) / 300 * (figure.xMax - figure.xMin) + figure.xMin;
          const y = (325 - Number(line[`y${suffix}`])) / 300 * (figure.yMax - figure.yMin) + figure.yMin;
          near(y, figure.lines[0]!.m * x + figure.lines[0]!.b);
          assert.ok(x >= figure.xMin - 1e-9 && x <= figure.xMax + 1e-9 && y >= figure.yMin - 1e-9 && y <= figure.yMax + 1e-9);
        }
      }
    } else if (figure.kind === 'bar-chart') {
      const ceiling = Math.max(5, Math.ceil(Math.max(...figure.values) / 5) * 5);
      for (let i = 0; i < figure.values.length; i++) {
        const attr = attributes(html, `data-category="${figure.categories[i]}"`);
        near(Number(attr.height), 210 * figure.values[i]! / ceiling);
        near(Number(attr.y) + Number(attr.height), 250);
      }
    } else if (figure.kind === 'clock') {
      for (const hand of ['hour', 'minute']) {
        const attr = attributes(html, `data-hand="${hand}"`);
        const dx = Number(attr.x2) - 160, dy = 145 - Number(attr.y2);
        const angle = hand === 'hour' ? (figure.hour % 12) * 30 + figure.minute / 2 : figure.minute * 6;
        const length = hand === 'hour' ? 58 : 88;
        near(dx, Math.sin(angle * Math.PI / 180) * length);
        near(dy, Math.cos(angle * Math.PI / 180) * length);
      }
    } else {
      for (const value of figure.points) {
        const attr = attributes(html, `data-mark="${value}"`);
        near(Number(attr.cx), 30 + (value - figure.min) * 480 / (figure.max - figure.min));
      }
    }
  }
});

test('unknown templates and invalid seeds are rejected', () => {
  assert.throws(() => generateGraphicalProblem('not-a-template', 'seed'));
  for (const seed of ['', 'x'.repeat(129)]) assert.throws(() => generateGraphicalProblem(graphicalTemplates[0]!.id, seed));
});
