import { act, step, table, tree, venn } from "../math/scene/author";
import type { Scene } from "../math/scene/spec";
import type { Action } from "../math/scene/timeline";

/** Probability lesson models, registered in `sceneIllustrations`. */
const fill = act.fill;
const ink = (target: string): Action => ({ do: "fill", target, ink: "accent" });
const survey = (
  highlight: Parameters<ReturnType<typeof table>["highlight"]>[0],
) =>
  table({
    columns: ["Online", "In person", "Total"],
    rows: [
      { label: "Grade 9", cells: [18, 12, 30] },
      { label: "Grade 10", cells: [14, 26, 40] },
      { label: "Total", cells: [32, 38, 70] },
    ],
    sums: true,
  })
    .id("t")
    .highlight(highlight);

export const lessonScenes = {
  "probability-venn-regions": venn("Art (A)", "Music (M)", {
    universe: "40 students",
  })
    .regions({ a: 12, ab: 6, b: 9, none: 13 })
    .scene({ title: "Art and music among 40 students" }),
  "probability-venn-complement": venn("Art (A)", "Music (M)", {
    universe: "40 students",
  })
    .regions({ a: 12, ab: 6, b: 9, none: 13 })
    .shade("b", "none")
    .scene({ title: "The complement A′ shaded" }),
  // The overlap counted twice, then subtracted once.
  "probability-venn-union": venn("Art (A)", "Music (M)", {
    universe: "40 students",
  })
    .id("v")
    .totals(18, 15)
    .regions({ a: 12, ab: 6, b: 9 })
    .scene({
      title: "A ∪ M: the overlap belongs to both totals",
      steps: [
        step(
          "Art: all 18 students in the Art circle.",
          fill("v.region.a", "accent-fill"),
          fill("v.region.ab", "accent-fill"),
          act.highlight("v.set.0"),
        ),
        step(
          "Music adds its 15, and the 6 in the overlap are counted a second time: 18 + 15 = 33.",
          fill("v.region.b", "warm-fill"),
          fill("v.region.ab", "gold-strong"),
          act.highlight("v.count.ab"),
        ),
        step(
          "Subtract the overlap once: 18 + 15 − 6 = 27.",
          fill("v.region.a", "gold-fill"),
          fill("v.region.ab", "gold-fill"),
          fill("v.region.b", "gold-fill"),
        ),
        step(
          "Check region by region: 12 + 6 + 9 = 27.",
          act.highlight("v.count.a"),
          act.highlight("v.count.ab"),
          act.highlight("v.count.b"),
        ),
      ],
    }),
  // Conditioning shrinks the sample space to one row.
  "probability-table-given": survey({ rows: [1], cells: [[1, 0]] }).scene({
    title: "Given grade 10: one row is the sample space",
    steps: [
      step(
        "Given grade 10: only that row, 40 students, is possible.",
        act.appear("t.band.row.1"),
        act.highlight("t.cell.1.2"),
      ),
      step("Of those 40, 14 prefer online classes.", act.appear("t.mark.1.0")),
      step(
        "$P(\\text{online} \\mid \\text{grade 10}) = \\frac{14}{40} = \\frac{7}{20}$.",
      ),
    ],
  }),
  "probability-table-reverse": survey({ columns: [0], cells: [[1, 0]] }).scene({
    title: "Given online: one column is the sample space",
    steps: [
      step(
        "Given online: only that column, 32 students, is possible.",
        act.appear("t.band.column.0"),
        act.highlight("t.cell.2.0"),
      ),
      step("Of those 32, 14 are in grade 10.", act.appear("t.mark.1.0")),
      step(
        "$P(\\text{grade 10} \\mid \\text{online}) = \\frac{14}{32} = \\frac{7}{16}$.",
      ),
    ],
  }),
  // The tree grows one stage at a time, each path's product at its end.
  "probability-tree-draws": tree([
    {
      label: "R",
      p: "3/5",
      children: [
        { label: "R", p: "2/4" },
        { label: "B", p: "2/4" },
      ],
    },
    {
      label: "B",
      p: "2/5",
      children: [
        { label: "R", p: "3/4" },
        { label: "B", p: "1/4" },
      ],
    },
  ])
    .id("tr")
    .products("shown")
    .scene({
      title: "Two draws from 3 red and 2 blue marbles",
      steps: [
        step(
          "First draw: 3 of 5 marbles are red, 2 are blue.",
          act.appear("tr.b1", true),
          act.appear("tr.p1", true),
          act.appear("tr.node1", true),
        ),
        step(
          "Second draw: one marble is gone, so 4 remain. After a red, 2 red and 2 blue are left; after a blue, 3 red and 1 blue.",
          act.appear("tr.b2", true),
          act.appear("tr.p2", true),
          act.appear("tr.node2", true),
        ),
        step(
          "Multiply along each path: red then red is 3/5 × 2/4 = 6/20.",
          act.appear("tr.leaf", true),
        ),
        step(
          "One of each color is two paths: 6/20 + 6/20 = 12/20 = 3/5.",
          ink("tr.b1.0"),
          ink("tr.b2.0.1"),
          ink("tr.b1.1"),
          ink("tr.b2.1.0"),
          act.highlight("tr.leaf.0.1"),
          act.highlight("tr.leaf.1.0"),
        ),
      ],
    }),
} satisfies Record<string, Scene>;
