import { createHash } from "node:crypto";
import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import { random } from "./distribution-practice";
import {
  gradePegBoard,
  loopSticks,
  normalizePegBoard,
  pegPoint,
  type PegBoardResponse,
} from "./peg-board";
import { pegBoardScene } from "./peg-board-scene";

export const pegBoardTemplates: readonly TemplateMetadata[] = [
  {
    id: "build-shape-sticks-balls",
    title: "Build a shape with sticks",
    description: "Build a named shape, or finish one from a placed side.",
  },
  {
    id: "build-shape-by-count",
    title: "Build sides and corners",
    description:
      "Build any closed shape with a given number of sides or corners.",
  },
  {
    id: "copy-peg-shape",
    title: "Copy a shape on pegs",
    description:
      "Copy a shape at the same size, moving it and turning it when allowed.",
  },
].map((m) => ({
  ...m,
  version: 1,
  skillId: "build-and-draw-shapes",
  gradeBand: "K–2",
  requiredResponseCapability: "peg-board-v1",
  glossarySenses: { square: "square-shape", sides: "side", side: "side" },
}));

const recipes: Record<number, number[][]> = {
  3: [
    [0, 3, 15],
    [0, 4, 12],
    [1, 8, 16],
  ],
  4: [
    [0, 3, 18, 15],
    [2, 14, 22, 10],
  ],
  5: [
    [1, 3, 14, 22, 10],
    [0, 3, 14, 23, 15],
  ],
  6: [
    [1, 3, 9, 19, 23, 21],
    [1, 3, 14, 23, 21, 10],
  ],
};
// A deterministic, public-information-only estimate. The model chooses 3–8
// different pegs uniformly in order and closes the walk, without knowing the
// name or how to avoid crossings. Count-only/triangle tasks have a substantial
// chance of success; square/copy tasks do not. Do not pretend all construction
// tasks have zero chance. Add-one smoothing avoids a zero from finite sampling.
const chances = new Map<string, number>();
export function estimatePegGuessChance(response: PegBoardResponse): number {
  const key = JSON.stringify([response.check, response.copy, response.given]);
  const cached = chances.get(key);
  if (cached !== undefined) return cached;
  const r = random("peg-guess-v1", key),
    samples = 2048;
  let accepted = 0;
  for (let i = 0; i < samples; i++) {
    // All other side counts fail, so integrate their probability exactly.
    const n = response.check.sides,
      ids: number[] = response.given.length ? [...response.given[0]!] : [];
    while (ids.length < n) {
      const id = r(0, 24);
      if (!ids.includes(id)) ids.push(id);
    }
    if (gradePegBoard(response, JSON.stringify({ sticks: loopSticks(ids) })))
      accepted++;
  }
  const chance = (accepted + 1) / ((samples + 2) * 6);
  chances.set(key, chance);
  return chance;
}
function move(ids: number[], turns: number, dx: number, dy: number): number[] {
  return ids.map((id) => {
    let [x, y] = pegPoint(id);
    for (let i = 0; i < turns; i++) [x, y] = [4 - y, x];
    return (y + dy) * 5 + x + dx;
  });
}
export function generatePegBoard(id: string, seed: string): GeneratedProblem {
  const meta = pegBoardTemplates.find((t) => t.id === id)!;
  const r = random(id, seed),
    countTask = id === "build-shape-by-count",
    copyTask = id === "copy-peg-shape";
  const draw = r(0, 99) < 35,
    finish = !countTask && !copyTask && r(0, 3) === 0;
  const roll = r(0, 99);
  const name =
    roll < 30
      ? "triangle"
      : roll < 60
        ? "square"
        : roll < (finish ? 100 : 85)
          ? "rectangle"
          : "hexagon";
  const sides =
    countTask || copyTask
      ? r(3, 6)
      : name === "triangle"
        ? 3
        : name === "hexagon"
          ? 6
          : 4;
  let ids: number[];
  if (!countTask && !copyTask && name === "rectangle")
    ids = r(0, 1) ? [0, 3, 13, 10] : [2, 8, 16, 10];
  else ids = [...recipes[sides]![r(0, recipes[sides]!.length - 1)]!];
  ids = move(ids, r(0, 3), 0, 0);
  const xs = ids.map((i) => i % 5),
    ys = ids.map((i) => Math.floor(i / 5));
  ids = move(
    ids,
    0,
    r(-Math.min(...xs), 4 - Math.max(...xs)),
    r(-Math.min(...ys), 4 - Math.max(...ys)),
  );
  const allowRotation = r(0, 1) === 1,
    countWord = r(0, 1) ? "sides" : "corners";
  const verb = draw ? "Draw" : "Build";
  const prompt = copyTask
    ? `Copy this shape.${allowRotation ? " You may turn it." : " Keep it the same way up."}`
    : countTask
      ? `${verb} a shape with ${sides} ${countWord}.`
      : finish
        ? `One ${draw ? "side" : "stick"} is placed. Finish the ${name}.`
        : `${verb} a ${name}.`;
  const response: PegBoardResponse = {
    kind: "peg-board",
    label: prompt,
    grid: { cols: 5, rows: 5 },
    skin: draw ? "draw" : "build",
    maxSticks: 8,
    given: finish ? [[ids[0]!, ids[1]!]] : [],
    check: {
      sides,
      ...(!countTask && !copyTask
        ? {
            name,
            ...(name === "square" || name === "rectangle"
              ? { rightCorners: true }
              : {}),
            ...(name === "square" ? { equalSides: true } : {}),
          }
        : {}),
    },
    ...(copyTask ? { copy: { pegs: ids, allowRotation } } : {}),
    guessChance: 1,
  };
  response.guessChance = estimatePegGuessChance(response);
  const answer = normalizePegBoard(
    response,
    JSON.stringify({ sticks: loopSticks(ids) }),
  )!;
  const walk = ids.map((i) => {
    const [x, y] = pegPoint(i);
    return `row ${y + 1}, peg ${x + 1}`;
  });
  const first = pegPoint(ids[0]!),
    second = pegPoint(ids[1]!);
  const dx = second[0] - first[0],
    dy = second[1] - first[1];
  const firstMove = [
    dx
      ? `${Math.abs(dx)} ${Math.abs(dx) === 1 ? "space" : "spaces"} ${dx > 0 ? "right" : "left"}`
      : "",
    dy
      ? `${Math.abs(dy)} ${Math.abs(dy) === 1 ? "space" : "spaces"} ${dy > 0 ? "down" : "up"}`
      : "",
  ]
    .filter(Boolean)
    .join(" and ");
  const shapeDefinition =
    name === "triangle"
      ? "A triangle is a closed shape with 3 straight sides."
      : name === "hexagon"
        ? "A hexagon is a closed shape with 6 straight sides."
        : name === "square"
          ? "A square is a closed shape with 4 straight sides, all equally long, and 4 square corners."
          : "A rectangle is a closed shape with 4 straight sides and 4 square corners.";
  return {
    public: {
      id: createHash("sha256").update(`${id}:1:${seed}`).digest("hex"),
      templateId: id,
      templateVersion: 1,
      seed,
      skillId: meta.skillId,
      prompt,
      response,
    },
    answer,
    variant: {
      id: copyTask
        ? `copy-${allowRotation ? "turn" : "same"}`
        : countTask
          ? `count-${sides}-${countWord}`
          : `${finish ? "finish" : "named"}-${name}-${response.skin}`,
    },
    hint: countTask
      ? `Use ${sides} corners. A corner is where two sides turn. Join the last corner to the first.`
      : copyTask
        ? `The shown shape has ${sides} sides. Start by counting peg spaces across and down along one side.`
        : `Start with ${finish ? "the placed stick" : "one side"}. ${name === "square" ? "Make each side the same length and each corner like the corner of a page." : name === "rectangle" ? "Make each corner like the corner of a page." : "Join the sides into one closed shape."}`,
    explanation: [
      "A side is a straight part of the shape. A corner is where two sides meet and turn.",
      ...(response.check.rightCorners
        ? ["A square corner fits the corner of a page."]
        : []),
      ...(!copyTask && !countTask ? [shapeDefinition] : []),
      "Count rows from the top. In each row, count pegs from the left.",
      `One way starts at ${walk[0]}.`,
      `Count ${firstMove}. Join the starting and ending pegs with one straight side.`,
      ...walk.slice(2).map((where) => `Join the last peg to ${where}.`),
      "Join back to the first peg to close the shape.",
      `There are ${sides} sides and ${sides} corners. The sides meet without crossing and close the shape.`,
      ...(response.check.rightCorners
        ? ["Each corner fits the corner of a page. These are square corners."]
        : []),
      ...(response.check.equalSides
        ? [
            "Length means how long a side is. Mark one side's length on paper and turn it to check the others.",
            "All 4 sides match and all 4 corners fit a page corner. This is a square.",
          ]
        : []),
      ...(!copyTask && name === "rectangle" && !countTask
        ? ["A square is a rectangle too: it has four square corners."]
        : []),
      copyTask
        ? `Compare each side with the shown shape. The same counts across and down put the ends on matching pegs.${allowRotation ? " You may also turn the whole shape." : " Move it without turning it."}`
        : "Moving or turning the shape does not change its name.",
      "Try this with toothpicks and dough at home.",
    ],
    walkthrough: pegBoardScene(response, answer),
  };
}
