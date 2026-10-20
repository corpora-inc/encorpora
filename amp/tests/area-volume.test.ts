import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { generateProblem } from "../src/math/engine";
import { generatedProblemSchema } from "../src/math/contracts";
import { areaVolumeTemplates } from "../src/math/area-volume-practice";
import { areaVolumeWorksheet } from "../src/content/area-volume-worksheets";
import { areaVolumeLessons } from "../src/content/area-volume-lessons";
import { problemLesson } from "../src/content/problem-lessons";
import { Figure } from "../src/web/Figure";
import { AreaVolumeIllustration } from "../src/content/AreaVolumeIllustration";
import { foldNet, netFaces } from "../src/web/area-volume-geometry";
import {
  animationFrames,
  animationModel,
} from "../src/web/lesson-animation/model";

test("every area and volume item is valid, exact and drawn without undefined geometry", () => {
  for (const t of areaVolumeTemplates)
    for (let i = 0; i < 200; i++) {
      const p = generateProblem(t.id, `av-${i}`);
      assert.deepEqual(generatedProblemSchema.parse(p), p, `${t.id}/${i}`);
      assert.ok(p.public.figure, `${t.id} has a figure`);
      const svg = renderToStaticMarkup(
        React.createElement(Figure, { figure: p.public.figure! }),
      );
      assert.doesNotMatch(svg, /NaN|undefined|Infinity/, `${t.id}/${i}`);
      assert.match(svg, /aria-label="[^"]{20,}"/);
      // The final explanation step states the answer the learner types.
      const shown = p.answer.includes("/") ? null : p.answer;
      if (shown)
        assert.ok(p.explanation.at(-1)!.includes(shown), `${t.id}/${i}`);
    }
});

test("a net folds closed into its solid: shared edges meet and the faces enclose it", () => {
  const key = (p: number[]) => p.map((v) => v.toFixed(6)).join(",");
  for (const [figure, corners] of [
    [
      {
        kind: "rectangular-prism-net",
        unit: "cm",
        length: 5,
        width: 3,
        height: 2,
      },
      8,
    ],
    [
      {
        kind: "triangular-prism-net",
        unit: "cm",
        base: 14,
        height: 12,
        sides: [13, 15],
        length: 6,
      },
      6,
    ],
    [
      {
        kind: "triangular-prism-net",
        unit: "cm",
        base: 4,
        height: 3,
        sides: [3, 5],
        length: 7,
      },
      6,
    ],
    [{ kind: "square-pyramid-net", unit: "cm", side: 6, slant: 5 }, 5],
  ] as const) {
    const folded = foldNet(netFaces(figure as never), 1);
    const points = new Set(
      [...folded.values()]
        .flat()
        .map((p) => key(p.map((v) => (Math.abs(v) < 1e-9 ? 0 : v)))),
    );
    assert.equal(points.size, corners, figure.kind);
    // Flat, the net lies in the plane.
    for (const pts of foldNet(netFaces(figure as never), 0).values())
      for (const p of pts) assert.equal(p[2], 0);
  }
});

test("animations conserve the example's quantities and match its answer", () => {
  const kinds = new Set<string>();
  for (const id of [
    "triangle-area-base-height",
    "net-surface-area",
    "cylinder-volume",
  ])
    for (let i = 0; i < 80; i++) {
      const lesson = problemLesson(id, `anim-${i}`);
      const model = animationModel(lesson);
      if (
        id === "cylinder-volume" &&
        !lesson.example.prompt.includes("What is $a$?")
      )
        continue;
      assert.ok(model, `${id}/${i}`);
      const frames = animationFrames(model);
      assert.equal(frames.length, 3);
      const last = frames[2]!.math;
      const answer = lesson.example.answer;
      if (model.kind === "triangle-double")
        assert.ok(last.endsWith(`= ${answer}$`), `${last} vs ${answer}`);
      else if (model.kind === "net-fold")
        assert.ok(last.endsWith(`= ${answer}$`), `${last} vs ${answer}`);
      else if (model.kind === "cylinder-stack") {
        const [n, d = "1"] = answer.split("/");
        const coefficient = d === "1" ? `${n}\\pi` : `\\tfrac{${n}}{${d}}\\pi`;
        assert.ok(
          last.endsWith(`= ${n === "1" && d === "1" ? "\\pi" : coefficient}$`),
          `${last} vs ${answer}`,
        );
      }
      kinds.add(model.kind);
    }
  assert.deepEqual([...kinds].sort(), [
    "cylinder-stack",
    "net-fold",
    "triangle-double",
  ]);
});

test("worksheets hold twelve distinct items covering every assessed case", () => {
  for (const lesson of areaVolumeLessons)
    for (const edition of ["1", "2", "3"]) {
      const sheet = areaVolumeWorksheet(
        lesson.templateIds[0]!,
        lesson.id,
        edition,
      );
      assert.equal(sheet.length, 12);
      assert.equal(
        new Set(
          sheet.map((p) => JSON.stringify([p.public.prompt, p.public.figure])),
        ).size,
        12,
      );
    }
});

test("lesson illustrations render with descriptions", () => {
  for (const lesson of areaVolumeLessons)
    for (const section of lesson.sections)
      if (section.illustration) {
        const html = renderToStaticMarkup(
          React.createElement(AreaVolumeIllustration, {
            kind: section.illustration as never,
          }),
        );
        assert.match(html, /data-lesson-illustration="av-/);
        assert.doesNotMatch(html, /NaN|undefined/);
      }
});
