import { act, circleDiagram, graph, scene, step } from "../math/scene/author";
import type { Scene } from "../math/scene/spec";

/** Lesson models for coordinate geometry and circles, registered in
 * `sceneIllustrations`. */
const inscribed = (c: number, id: string) =>
  circleDiagram({
    points: [
      { name: "A", at: 210 },
      { name: "B", at: 280 },
      { name: "C", at: c },
    ],
    center: true,
    segments: [
      { from: "C", to: "A" },
      { from: "C", to: "B" },
      { from: "O", to: "A", dash: true },
      { from: "O", to: "B", dash: true },
    ],
    angles: [
      { at: "C", from: "A", to: "B", label: "35°" },
      { at: "O", from: "A", to: "B", label: "70°", color: "accent" },
    ],
    arcs: [{ from: "A", to: "B" }],
  }).id(id);

export const coordinateCircleScenes = {
  // The inscribed angle's vertex slides along the arc; the angle stays 35°.
  "circle-inscribed-slide": scene(
    inscribed(40, "c1"),
    inscribed(90, "c2"),
    inscribed(140, "c3"),
  ).build({
    title: "An inscribed angle on arc AB, from three points of the circle",
    steps: [
      step(
        "Central angle AOB is 70°; inscribed angle ACB on the same arc is half of it, 35°.",
        act.appear("c1"),
      ),
      step(
        "Slide C along the circle: the angle is still 35°.",
        act.disappear("c1"),
        act.appear("c2"),
      ),
      step(
        "Anywhere on that side of chord AB, ACB is 35°: every inscribed angle on arc AB is half of 70°.",
        act.disappear("c2"),
        act.appear("c3"),
      ),
    ],
  }),
  "circle-tangent-radius": circleDiagram({
    points: [{ name: "T", at: 90 }],
    outside: [
      { name: "P", at: 90 - (Math.acos(5 / 13) * 180) / Math.PI, dist: 13 / 5 },
    ],
    center: true,
    segments: [
      { from: "O", to: "T", label: "5" },
      { from: "T", to: "P", label: "12", color: "accent" },
      { from: "O", to: "P", label: "13", dash: true },
    ],
    angles: [{ at: "T", from: "O", to: "P", mark: "right" }],
  }).scene({ title: "A tangent meets the radius at a right angle" }),
  // A slope triangle turns a quarter turn into the perpendicular direction.
  "slope-perpendicular-turn": graph({ x: [-4, 5], y: [-1, 6], tick: 1 })
    .id("g")
    .point(0, 1, "A")
    .point(3, 3, "B")
    .segment([0, 1], [3, 3])
    .slope([0, 1], [3, 3], "shown")
    .segment([0, 1], [-2, 4], { dash: "dash" })
    .slope([0, 1], [-2, 4], "shown")
    .scene({
      title: "Slope 2/3 and the perpendicular slope −3/2",
      steps: [
        step("AB runs 3 and rises 2: slope 2/3.", act.highlight("g.slope.0")),
        step(
          "Turn the slope triangle a quarter turn about A: the run 3 becomes a rise of 3, and the rise 2 becomes a run of −2.",
          act.appear("g.slope.1"),
          act.trace("g.segment.1"),
        ),
        step(
          "The turned line has slope 3 ÷ (−2) = −3/2: flip and change the sign. The product (2/3)(−3/2) is −1.",
        ),
      ],
    }),
  "circle-equation-distance": graph({ x: [-4, 8], y: [-5, 7], tick: 2 })
    .id("g")
    .circle([2, 1], 5, { showCenter: true })
    .point(2, 1, "C")
    .point(5, 5, "P")
    .segment([2, 1], [5, 5])
    .slope([2, 1], [5, 5], "shown")
    .scene({
      title: "The circle with center (2, 1) through (5, 5)",
      steps: [
        step(
          "Every point of the circle is the radius away from C(2, 1).",
          act.trace("g.segment.0"),
        ),
        step(
          "From C to P(5, 5): 3 across and 4 up, so r² = 3² + 4² = 25, and the circle is (x − 2)² + (y − 1)² = 25.",
          act.highlight("g.slope.0"),
        ),
      ],
    }),
  "segment-partition": graph({ x: [-4, 7], y: [-3, 5], tick: 1 })
    .id("g")
    .point(-3, -2, "A")
    .point(6, 4, "B")
    .point(0, 0, "P")
    .segment([-3, -2], [6, 4])
    .slope([-3, -2], [0, 0], "shown")
    .slope([0, 0], [6, 4], "shown")
    .scene({
      title: "P divides AB in the ratio 1 : 2",
      steps: [
        step("A to B runs 9 and rises 6.", act.highlight("g.segment.0")),
        step(
          "AP : PB = 1 : 2 makes 3 equal parts; P is 1 part from A: 1/3 of 9 is 3 across, 1/3 of 6 is 2 up.",
          act.appear("g.slope.0"),
          act.appear("g.point.2"),
        ),
        step(
          "The rest, 6 across and 4 up, is twice as long.",
          act.appear("g.slope.1"),
        ),
      ],
    }),
} satisfies Record<string, Scene>;
