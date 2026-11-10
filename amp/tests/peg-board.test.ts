import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  generatedProblemSchema,
  clientCanDraw,
  responseCapabilities,
} from "../src/math/contracts";
import {
  generateProblem,
  gradeAnswer,
  isValidResponse,
  templates,
} from "../src/math/engine";
import {
  gradePegBoard,
  loopSticks,
  matchesPegCopy,
  normalizePegBoard,
  parsePegBoard,
  pegBoardFeedback,
  pegPoint,
  pegTopology,
  type PegBoardResponse,
} from "../src/math/peg-board";
import { pegBoardTemplates } from "../src/math/peg-board-practice";
import { problemGuessChance } from "../src/math/guess-chance";
import { answerText } from "../src/math/selection-response";
import { PrintExerciseBody } from "../src/content/print-exercise";
import { sceneSchema } from "../src/math/scene/spec";
import { pegBoardScene } from "../src/math/peg-board-scene";
import { problemLesson } from "../src/content/problem-lessons";

const base: PegBoardResponse = {
  kind: "peg-board",
  label: "Build a shape",
  grid: { cols: 5, rows: 5 },
  skin: "build",
  maxSticks: 8,
  given: [],
  check: { sides: 4 },
  guessChance: 0.01,
};
const raw = (ids: number[]) => JSON.stringify({ sticks: loopSticks(ids) });
test("exact integer grading exhausts every lattice triangle and rectangle, including turned squares", () => {
  let triangles = 0,
    rectangles = 0,
    squares = 0;
  const at = (x: number, y: number) => y * 5 + x;
  for (let a = 0; a < 25; a++)
    for (let b = 0; b < 25; b++)
      for (let c = 0; c < 25; c++) {
        if (a === b || a === c || b === c) continue;
        const [ax, ay] = pegPoint(a),
          [bx, by] = pegPoint(b),
          [cx, cy] = pegPoint(c);
        const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
        const triangle = { ...base, check: { sides: 3 } };
        assert.equal(gradePegBoard(triangle, raw([a, b, c])), area !== 0);
        if (area) triangles++;
        const ux = bx - ax,
          uy = by - ay,
          vx = cx - bx,
          vy = cy - by;
        if (!area || ux * vx + uy * vy !== 0) continue;
        const dx = ax + vx,
          dy = ay + vy;
        if (dx < 0 || dx > 4 || dy < 0 || dy > 4) continue;
        const answer = raw([a, b, c, at(dx, dy)]);
        assert.equal(
          gradePegBoard(
            { ...base, check: { sides: 4, rightCorners: true } },
            answer,
          ),
          true,
        );
        const square = ux * ux + uy * uy === vx * vx + vy * vy;
        assert.equal(
          gradePegBoard(
            {
              ...base,
              check: { sides: 4, rightCorners: true, equalSides: true },
            },
            answer,
          ),
          square,
        );
        rectangles++;
        if (square) squares++;
      }
  assert.ok(triangles > 10000 && rectangles > 1000 && squares > 200);
});
test("one closed non-crossing loop with real corners, and first-failure feedback", () => {
  const square = {
    ...base,
    check: {
      sides: 4,
      name: "square" as const,
      rightCorners: true,
      equalSides: true,
    },
  };
  for (const [answer, message] of [
    ['{"sticks":[[0,4],[4,24]]}', /not closed/],
    [raw([0, 2, 4, 24, 20]), /corner needs a turn/],
    [raw([0, 24, 4, 20]), /sticks cross/],
    [raw([0, 4, 20]), /3 sides; a square has 4/],
    [raw([0, 3, 14, 11]), /square corner/],
    [raw([0, 3, 13, 10]), /same length/],
    [
      JSON.stringify({
        sticks: [...loopSticks([0, 1, 5]), ...loopSticks([18, 19, 24])],
      }),
      /one shape/,
    ],
    [
      JSON.stringify({ sticks: [...loopSticks([0, 4, 24, 20]), [0, 6]] }),
      /just two sticks/,
    ],
  ] as const) {
    assert.notEqual(normalizePegBoard(square, answer), null);
    assert.equal(gradePegBoard(square, answer), false);
    assert.match(pegBoardFeedback(square, answer)!, message);
  }
  assert.equal(
    gradePegBoard(
      { ...base, check: { sides: 6 } },
      raw([1, 3, 14, 23, 21, 10]),
    ),
    true,
  );
  assert.equal(
    gradePegBoard({ ...base, check: { sides: 5 } }, raw([0, 4, 12, 24, 20])),
    true,
    "Concave shapes are valid",
  );
  assert.equal(pegTopology(loopSticks([0, 2, 4, 24, 20])).corners, 4);
});
test("copy matching preserves size, turning permission and handedness", () => {
  const t = [0, 2, 5];
  assert.ok(matchesPegCopy([6, 8, 11], t, false));
  assert.ok(matchesPegCopy([11, 8, 6], t, false));
  assert.equal(
    matchesPegCopy([0, 10, 1], t, true),
    false,
    "Reflection is not rotation",
  );
  assert.ok(matchesPegCopy([2, 12, 1], t, true));
  assert.equal(matchesPegCopy([2, 12, 1], t, false), false);
  assert.equal(matchesPegCopy([0, 4, 10], t, true), false);
});
test("malformed attempts fail closed; edge order normalizes; given sticks are enforced", () => {
  for (const v of [
    "",
    "null",
    "[]",
    '{"sticks":[[0,0]]}',
    '{"sticks":[[0,25]]}',
    '{"sticks":[[0,1.5]]}',
    '{"sticks":[[0,1],[1,0]]}',
    '{"sticks":[],"extra":true}',
    "x".repeat(201),
  ])
    assert.equal(parsePegBoard(base, v), null);
  assert.equal(
    normalizePegBoard(base, raw([0, 4, 24, 20])),
    normalizePegBoard(base, raw([24, 4, 0, 20])),
  );
  const locked = { ...base, given: [[0, 4] as [number, number]] };
  assert.equal(parsePegBoard(locked, raw([5, 9, 24, 20])), null);
  assert.equal(gradePegBoard(locked, raw([0, 4, 24, 20])), true);
});
test("deterministic generators, schemas, independent oracle and finite guessing estimates", () => {
  const seen = new Set<string>(),
    cases = [];
  for (const meta of pegBoardTemplates)
    for (let i = 0; i < 160; i++) {
      const p = generateProblem(meta.id, `peg-${i}`),
        r = p.public.response;
      assert.equal(r.kind, "peg-board");
      if (r.kind !== "peg-board") continue;
      generatedProblemSchema.parse(p);
      assert.deepEqual(generateProblem(meta.id, `peg-${i}`), p);
      assert.ok(gradeAnswer(p, p.answer));
      const broken = JSON.parse(p.answer);
      broken.sticks.pop();
      if (
        !r.given.some(
          (s) =>
            JSON.stringify(s) ===
            JSON.stringify(JSON.parse(p.answer).sticks.at(-1)),
        )
      ) {
        assert.equal(gradeAnswer(p, JSON.stringify(broken)), false);
      }
      assert.ok(isValidResponse(p.public, p.answer));
      assert.ok(problemGuessChance(p) > 0 && problemGuessChance(p) < 0.25);
      if (r.check.equalSides || r.copy) assert.ok(problemGuessChance(p) < 0.02);
      sceneSchema.parse(pegBoardScene(r));
      sceneSchema.parse(p.walkthrough);
      seen.add(p.variant!.id);
      cases.push(p);
    }
  for (const name of ["triangle", "square", "rectangle", "hexagon"])
    for (const skin of ["build", "draw"])
      assert.ok(seen.has(`named-${name}-${skin}`));
  for (let n = 3; n <= 6; n++)
    for (const word of ["sides", "corners"])
      assert.ok(seen.has(`count-${n}-${word}`));
  for (const name of ["triangle", "square", "rectangle"])
    assert.ok([...seen].some((v) => v.startsWith(`finish-${name}`)));
  assert.ok(seen.has("copy-turn") && seen.has("copy-same"));
  const out = execFileSync("python3", ["scripts/peg_board_math_oracle.py"], {
    input: cases.map((p) => JSON.stringify(p)).join("\n"),
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
  assert.match(out, /480/);
});
test("legacy clients retain drawing judgment; lessons and print render geometry rather than JSON", () => {
  const legacy = {
    responseCapabilities: ["single-choice-v1", "figure-choice-v1"],
    figureCapabilities: ["scenes-v1"],
  };
  assert.ok(responseCapabilities.includes("peg-board-v1"));
  for (const t of pegBoardTemplates) {
    assert.equal(clientCanDraw(t, legacy), false);
    assert.equal(
      clientCanDraw(t, {
        ...legacy,
        responseCapabilities: [...legacy.responseCapabilities, "peg-board-v1"],
      }),
      true,
    );
    const p = generateProblem(t.id, "print");
    assert.ok(
      problemLesson(t.id, "lesson", p.public.prompt, p.public.response, p),
    );
    assert.doesNotMatch(answerText(p.public.response, p.answer), /[{}\[\]]/);
    for (const solutions of [true, false])
      assert.match(
        renderToStaticMarkup(
          createElement(PrintExerciseBody, {
            number: 1,
            problem: p,
            solutions,
          }),
        ),
        /<svg/,
      );
  }
  assert.equal(
    clientCanDraw(
      templates.find((t) => t.id === "check-the-drawing")!,
      legacy,
    ),
    true,
  );
});
