import type { TemplateMetadata } from "./contracts";
import type { PartitionedShape } from "./part-whole-models";
import { defineAxis } from "./variation/axes";
import { chainFamily, dispatch, pick } from "./chain-kit";
import {
  draw,
  letters,
  orderedChoiceSurface,
  shuffled,
} from "./elementary-gap-kit";

export const congruentFourthsTemplate: TemplateMetadata = {
  id: "congruent-fourths-pair",
  version: 1,
  requiredResponseCapability: "single-choice-v1",
  title: "Two figures that each show one fourth",
  skillId: "unit-fractions",
  gradeBand: "3–5",
  difficultyOffset: 0.2,
  description:
    "Among three same-size squares or rectangles cut in different ways, pick the two whose shaded part is one fourth of the whole, against thirds, two fourths and parts that are not equal.",
};

type Cut = PartitionedShape["cut"];
type Kind = "square" | "rectangle";
const fourthCuts = (shape: Kind): Cut[] =>
  shape === "square"
    ? ["columns", "rows", "grid", "diagonals"]
    : ["columns", "rows", "grid"];

type Role = "fourth-a" | "fourth-b" | "odd";
type Odd = "thirds" | "two-fourths" | "unequal";
const axes = {
  shape: defineAxis("shape", ["square", "rectangle"] as const),
  odd: defineAxis("odd", ["thirds", "two-fourths", "unequal"] as const),
};
interface Model {
  shape: Kind;
  odd: Odd;
  /** The three figures in the order A, B, C. */
  figures: PartitionedShape[];
  roles: Role[];
}
function model(
  r: (lo: number, hi: number) => number,
  a: { shape: Kind; odd: Odd },
): Model {
  const [c1, c2] = draw(r, fourthCuts(a.shape), 2) as [Cut, Cut];
  const unit = (cut: Cut, n: number, shaded: number[]): PartitionedShape => ({
    shape: a.shape,
    cut,
    sizes: Array<number>(n).fill(1),
    shaded,
  });
  const made: Record<Role, PartitionedShape> = {
    "fourth-a": unit(c1, 4, [r(0, 3)]),
    "fourth-b": unit(c2, 4, [r(0, 3)]),
    odd:
      a.odd === "thirds"
        ? unit(pick(r, ["columns", "rows"] as const), 3, [r(0, 2)])
        : a.odd === "two-fourths"
          ? unit(pick(r, ["columns", "rows"] as const), 4, [0, 1 + r(0, 2)])
          : {
              shape: a.shape,
              cut: pick(r, ["columns", "rows"] as const),
              sizes: pick(r, [
                [1, 2, 1, 2],
                [2, 1, 1, 2],
                [1, 1, 3, 1],
              ]),
              shaded: [0],
            },
  };
  const roles = shuffled(r, ["fourth-a", "fourth-b", "odd"] as Role[]);
  return {
    shape: a.shape,
    odd: a.odd,
    roles,
    figures: roles.map((role, i) => ({
      ...made[role],
      label: letters[i] as "A" | "B" | "C",
    })),
  };
}

const cutWords: Record<Cut, string> = {
  columns: "columns",
  rows: "rows",
  grid: "a grid",
  diagonal: "two triangles",
  diagonals: "four triangles",
  sectors: "sectors",
};
const pair = (i: number, j: number) =>
  `${letters[Math.min(i, j)]} and ${letters[Math.max(i, j)]}`;
export const congruentFourths = chainFamily({
  template: congruentFourthsTemplate,
  axes,
  model,
  variant: (m) => `${m.shape}-${m.odd}`,
  render: (m, _a, r) => {
    const at = (role: Role) => m.roles.indexOf(role);
    const oddWhy: Record<Odd, string> = {
      thirds:
        "is cut into 3 equal parts, so one shaded part is one third, not one fourth",
      "two-fourths":
        "has 2 of its 4 equal parts shaded, which is two fourths, not one fourth",
      unequal:
        "is cut into 4 parts that are not all the same size, so a shaded part is not one fourth of the whole",
    };
    const oddLetter = letters[at("odd")]!;
    const oddPick: Record<Odd, string> = {
      thirds: `Figure ${oddLetter} has 1 part shaded, but it is cut into only 3 equal parts. 1 of 3 equal parts is one third, not one fourth.`,
      "two-fourths": `Figure ${oddLetter} is cut into 4 equal parts, but 2 of them are shaded. That is two fourths, not one fourth.`,
      unequal: `Figure ${oddLetter} has 4 parts with 1 shaded, but the parts are not the same size. Fourths must be 4 equal parts.`,
    };
    const key = pair(at("fourth-a"), at("fourth-b"));
    const options = [
      { label: key, correct: true as const },
      {
        label: pair(at("fourth-a"), at("odd")),
        feedback: oddPick[m.odd],
      },
      {
        label: pair(at("fourth-b"), at("odd")),
        feedback: oddPick[m.odd],
      },
      {
        label: "None of the pairs",
        feedback: `Equal parts can have different shapes, such as strips or triangles, and still be fourths. Two of the ${m.shape}s are each cut into 4 equal parts with 1 shaded.`,
      },
    ];
    const ordered = [
      ...options.slice(0, 3).sort((x, y) => x.label.localeCompare(y.label)),
      options[3]!,
    ];
    const surface = orderedChoiceSurface({
      prompt: `The three ${m.shape === "square" ? "squares" : "rectangles"} are the same size and the same shape. Which two figures each show one fourth shaded?`,
      options: ordered,
      hint: `One fourth means the whole is cut into 4 parts that are the same size, with 1 of them shaded. ${m.figures.map((f, i) => `${letters[i]} is cut into ${cutWords[f.cut]}`).join(", ")}. Check each ${m.shape}: count its parts, see whether they are the same size, and count the shaded parts.`,
      explanation: [
        `One fourth is 1 of 4 equal parts of the whole. Equal parts can be cut in different ways and still be fourths of same-size ${m.shape}s.`,
        `Figures ${key} are each cut into 4 equal parts with 1 shaded.`,
        `Figure ${oddLetter} ${oddWhy[m.odd]}.`,
        `So figures ${key} each show one fourth shaded.`,
      ],
    });
    return (
      surface && {
        ...surface,
        figure: { kind: "partitioned-shapes" as const, shapes: m.figures },
      }
    );
  },
});

export const congruentPartsTemplates = [congruentFourthsTemplate] as const;
export const congruentPartsGenerate = dispatch(congruentPartsTemplates, {
  "congruent-fourths-pair": (seed) => congruentFourths.generate(seed).problem,
});
