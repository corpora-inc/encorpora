import { act, graph, scene, step, triangle } from "../math/scene/author";
import type { Point, Scene } from "../math/scene/spec";

/** Lesson models for dilations, similarity and right-triangle trigonometry,
 * registered in `sceneIllustrations`. */
const ray = (deg: number, r: number): Point => [
  Math.cos((deg * Math.PI) / 180) * r,
  Math.sin((deg * Math.PI) / 180) * r,
];

/** A right triangle with its right angle at C = (4k, 0) and A at the origin. */
const nested = (k: number, id: string) =>
  triangle([
    [0, 0],
    [4 * k, 0],
    [4 * k, 3 * k],
  ])
    .side(1, { label: String(3 * k) })
    .side(2, { label: String(5 * k) })
    .angle(1, { mark: "right" })
    .angle(0, { mark: "arc" })
    .id(id);

/** The same angle at A, hypotenuse fixed: one triangle per angle. */
const swept = (deg: number, id: string) => {
  const [x, y] = ray(deg, 5);
  return triangle([
    [0, 0],
    [x, 0],
    [x, y],
  ])
    .side(1, {
      label: `≈ ${Math.sin((deg * Math.PI) / 180).toFixed(2)}`,
      color: "accent",
    })
    .side(2, { label: "1", color: "warm" })
    .angle(1, { mark: "right" })
    .angle(0, { mark: "arc", label: `${deg}°` })
    .id(id);
};

export const similarityTrigScenes = {
  "similarity-dilation": graph({ x: [-1, 11], y: [-1, 7], tick: 2 })
    .id("g")
    .point(0, 0, "O")
    .point(3, 1, "A")
    .point(5, 1, "B")
    .point(4, 3, "C")
    .point(6, 2, "A′")
    .point(10, 2, "B′")
    .point(8, 6, "C′")
    .segment([3, 1], [5, 1])
    .segment([5, 1], [4, 3])
    .segment([4, 3], [3, 1])
    .segment([0, 0], [6, 2], { dash: "dash" })
    .segment([0, 0], [10, 2], { dash: "dash" })
    .segment([0, 0], [8, 6], { dash: "dash" })
    .segment([6, 2], [10, 2])
    .segment([10, 2], [8, 6])
    .segment([8, 6], [6, 2])
    .scene({
      title: "A dilation with center O and scale factor 2",
      steps: [
        step(
          "Each image point is on the ray from O through its point, twice as far from O.",
          act.trace("g.segment.3"),
          act.trace("g.segment.4"),
          act.trace("g.segment.5"),
          act.appear("g.point.4"),
          act.appear("g.point.5"),
          act.appear("g.point.6"),
        ),
        step(
          "Every side is twice as long, each angle keeps its measure, and each side stays parallel to its image.",
          act.trace("g.segment.6"),
          act.trace("g.segment.7"),
          act.trace("g.segment.8"),
        ),
      ],
    }),
  "similarity-pair": scene(
    triangle([
      [0, 0],
      [3, 0],
      [1, 2],
    ])
      .names("A", "B", "C")
      .side(0, { label: 6 })
      .side(1, { label: 5 })
      .side(2, { label: 4 })
      .angle(0, { mark: "arc" })
      .angle(1, { mark: "arc", arcs: 2 })
      .id("t1"),
    triangle([
      [4.5, 0],
      [9, 0],
      [6, 3],
    ])
      .names("D", "E", "F")
      .side(0, { label: 9 })
      .side(1, { label: 7.5 })
      .side(2, { label: 6 })
      .angle(0, { mark: "arc" })
      .angle(1, { mark: "arc", arcs: 2 })
      .id("t2"),
  ).build({
    title: "Similar triangles ABC and DEF",
    steps: [
      step(
        "Two pairs of equal angles (the matching arcs) make the triangles similar.",
        act.highlight("t1.angle"),
        act.highlight("t2.angle"),
      ),
      step(
        "Matching sides: DE ÷ AB = 9 ÷ 6 = 3/2.",
        { do: "fill", target: "t1.side.0", ink: "accent" },
        { do: "fill", target: "t2.side.0", ink: "accent" },
      ),
      step(
        "Every pair has the same ratio: 7.5 ÷ 5 = 6 ÷ 4 = 3/2.",
        { do: "fill", target: "t1.side.1", ink: "warm" },
        { do: "fill", target: "t2.side.1", ink: "warm" },
        { do: "fill", target: "t1.side.2", ink: "gold" },
        { do: "fill", target: "t2.side.2", ink: "gold" },
      ),
    ],
  }),
  // A triangle scaling while its side ratios stay fixed: this is what sine is.
  "trig-similar-scaling": scene(
    nested(1, "t1"),
    nested(2, "t2"),
    nested(3, "t3"),
  ).build({
    title: "Three right triangles with the same angle at A",
    steps: [
      step("Opposite ÷ hypotenuse = 3 ÷ 5.", act.appear("t1")),
      step("Twice the size: 6 ÷ 10, still 3/5.", act.appear("t2")),
      step(
        "Three times the size: 9 ÷ 15, still 3/5. The angle alone fixes the ratio; that ratio is sin A.",
        act.appear("t3"),
      ),
    ],
  }),
  // An angle rotating while opposite ÷ hypotenuse changes.
  "trig-angle-sweep": scene(
    swept(20, "a20"),
    swept(40, "a40"),
    swept(60, "a60"),
    swept(75, "a75"),
  ).build({
    title: "Hypotenuse 1, the angle growing",
    steps: [
      step(
        "At 20°, the opposite side is about 0.34 of the hypotenuse: sin 20° ≈ 0.34.",
        act.appear("a20"),
      ),
      step("At 40°: sin 40° ≈ 0.64.", act.disappear("a20"), act.appear("a40")),
      step("At 60°: sin 60° ≈ 0.87.", act.disappear("a40"), act.appear("a60")),
      step(
        "At 75°: sin 75° ≈ 0.97. As the angle grows toward 90°, the opposite side grows toward the hypotenuse.",
        act.disappear("a60"),
        act.appear("a75"),
      ),
    ],
  }),
  "trig-sides-named": triangle([
    [0, 0],
    [4, 0],
    [4, 3],
  ])
    .names("A", "C", "B")
    .side(0, { label: "adjacent", color: "warm" })
    .side(1, { label: "opposite", color: "accent" })
    .side(2, { label: "hypotenuse", color: "gold" })
    .angle(0, { mark: "arc" })
    .angle(1, { mark: "right" })
    .scene({ title: "The sides named from angle A" }),
  "trig-special-triangles": scene(
    triangle([
      [0, 3],
      [3, 3],
      [0, 6],
    ])
      .side(0, { label: "s" })
      .side(1, { label: "s√2" })
      .side(2, { label: "s" })
      .angle(0, { mark: "right" })
      .angle(1, { mark: "arc", label: "45°" })
      .angle(2, { mark: "arc", label: "45°" })
      .id("t45"),
    triangle([
      [0, 0],
      [2 * Math.sqrt(3), 0],
      [0, 2],
    ])
      .side(0, { label: "s√3" })
      .side(1, { label: "2s" })
      .side(2, { label: "s" })
      .angle(0, { mark: "right" })
      .angle(1, { mark: "arc", label: "30°" })
      .angle(2, { mark: "arc", arcs: 2, label: "60°" })
      .id("t30"),
  ).build({ title: "The 45°-45°-90° and 30°-60°-90° triangles" }),
} satisfies Record<string, Scene>;
