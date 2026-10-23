import {
  act,
  circleDiagram,
  graph,
  numberLine,
  step,
  scene,
} from "../math/scene/author";
export const assessmentGapIllustrations = {
  "assessment-function-repair": graph({
    id: "repair",
    x: [-5, 5],
    y: [-5, 5],
    grid: 1,
  })
    .point(-3, 2, "A")
    .point(1, -2, "B")
    .point(1, 3, "C")
    .point(4, 0, "D")
    .scene({
      title:
        "A at (-3, 2), B at (1, -2), C at (1, 3), and D at (4, 0). B and C have the same input and different outputs.",
      steps: [
        step(
          "At $x=1$, point $B$ has output $-2$ and point $C$ has output $3$.",
          act.highlight("repair.point.1"),
          act.highlight("repair.point.2"),
        ),
        step(
          "Removing either $B$ or $C$ leaves one output at $x=1$.",
          act.highlight("repair.point.1"),
          act.highlight("repair.point.2"),
        ),
      ],
    }),
  "assessment-measurement-interval": numberLine({
    id: "bounds",
    min: 74,
    max: 86,
    labels: [78, 80, 82],
  })
    .mark(80, { label: "80 g" })
    .interval(78, 82)
    .hop(80, -2, { landing: "shown", label: "−2 g" })
    .hop(80, 2, { landing: "shown", label: "+2 g" })
    .scene({
      title:
        "A reading of 80 grams with error at most 2 grams allows every value from 78 through 82 grams.",
      steps: [
        step("Start at the reported 80 g.", act.highlight("bounds")),
        step(
          "Move 2 g in either direction: the endpoints are 78 g and 82 g.",
          act.trace("bounds.hop.0"),
          act.trace("bounds.hop.1"),
        ),
      ],
    }),
  "assessment-sampling-interval": numberLine({
    id: "sample",
    min: 50,
    max: 70,
    step: 2,
    labels: [56, 60, 64],
  })
    .mark(60, { label: "60%" })
    .interval(56, 64)
    .hop(60, -4, { landing: "shown", label: "−4 points" })
    .hop(60, 4, { landing: "shown", label: "+4 points" })
    .scene({
      title:
        "The interval around a 60 percent estimate extends four percentage points in each direction, from 56 to 64 percent.",
      steps: [
        step(
          "The sample estimate, 60%, is the center.",
          act.highlight("sample"),
        ),
        step(
          "A margin of 4 points reaches from 56% to 64%.",
          act.trace("sample.hop.0"),
          act.trace("sample.hop.1"),
        ),
      ],
    }),
  "assessment-radian-arc": scene(
    circleDiagram({
      id: "circle",
      points: [
        { name: "A", at: 0 },
        { name: "B", at: (1.5 * 180) / Math.PI },
      ],
      center: true,
      segments: [
        { from: "O", to: "A", label: "4 cm" },
        { from: "O", to: "B" },
      ],
      arcs: [{ from: "A", to: "B", label: "6 cm" }],
    }),
  ).build({
    title:
      "The counterclockwise arc from A to B is 6 centimeters; the radius is 4 centimeters. The angle sweeps one and a half radius-lengths.",
    steps: [
      step(
        "Compare the 6 cm arc with the 4 cm radius.",
        act.highlight("circle"),
      ),
      step(
        "Six divided by four is three halves: the angle is 3/2 radians.",
        act.trace("circle.arc.0"),
      ),
    ],
  }),
};
