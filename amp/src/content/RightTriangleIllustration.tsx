import React from "react";
/** Exact Euclidean constructions; labels use lengths, while regions show areas. */
export function RightTriangleOrientation() {
  const panels = [
    {
      id: "original",
      viewBox: "0 40 400 220",
      description:
        "A right triangle has horizontal leg 8 cm and vertical leg 6 cm. Its unknown hypotenuse is opposite the marked right angle.",
      diagram: (
        <g data-triangle="original">
          <polygon
            points="90,190 250,190 90,70"
            fill="#edf4f1"
            stroke="#173b37"
            strokeWidth="2"
          />
          <path
            d="M90 174 H106 V190"
            fill="none"
            stroke="#173b37"
            strokeWidth="2"
          />
          <text x="170" y="222" textAnchor="middle">
            leg: 8 cm
          </text>
          <text x="74" y="125" textAnchor="end">
            leg
          </text>
          <text x="74" y="151" textAnchor="end">
            6 cm
          </text>
          <text x="214" y="104" textAnchor="middle">
            hypotenuse
          </text>
          <text x="226" y="139" textAnchor="middle">
            ? cm
          </text>
        </g>
      ),
    },
    {
      id: "rotated",
      viewBox: "0 260 400 250",
      description:
        "The same right triangle after half a turn has legs 8 cm and 6 cm. The unknown hypotenuse remains opposite the marked right angle.",
      diagram: (
        <g data-triangle="rotated">
          <polygon
            points="270,310 110,310 270,430"
            fill="#edf4f1"
            stroke="#173b37"
            strokeWidth="2"
          />
          <path
            d="M254 310 V326 H270"
            fill="none"
            stroke="#173b37"
            strokeWidth="2"
          />
          <text x="190" y="290" textAnchor="middle">
            leg: 8 cm
          </text>
          <text x="288" y="366">
            leg
          </text>
          <text x="288" y="392">
            6 cm
          </text>
          <text x="162" y="416" textAnchor="middle">
            hypotenuse
          </text>
          <text x="162" y="443" textAnchor="middle">
            ? cm
          </text>
          <text x="200" y="490" textAnchor="middle">
            Same triangle, half a turn
          </text>
        </g>
      ),
    },
  ];
  return (
    <figure
      className="lesson-illustration"
      style={{ margin: "24px 0", breakInside: "avoid" }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 12,
        }}
      >
        {panels.map((panel) => (
          <svg
            key={panel.id}
            data-lesson-illustration={`right-triangle-orientation-${panel.id}`}
            viewBox={panel.viewBox}
            role="img"
            aria-label={panel.description}
            style={{
              flex: "1 1 240px",
              width: "100%",
              maxWidth: 400,
              fontFamily: "Arial, sans-serif",
              fontSize: 24,
              fill: "#173b37",
            }}
          >
            <title>The hypotenuse stays opposite the right angle</title>
            {panel.diagram}
          </svg>
        ))}
      </div>
      <figcaption>
        The small square marks the 90° angle. The two triangle sides meeting at
        that corner are the legs. The hypotenuse joins their other endpoints and
        never touches the marked corner. The second drawing is the first
        triangle turned halfway around.
      </figcaption>
    </figure>
  );
}

type Point = readonly [number, number];
const arrangements = [
  {
    name: "One uncovered square",
    key: "hypotenuse",
    triangles: [
      [
        [0, 0],
        [4, 0],
        [0, 3],
      ],
      [
        [4, 0],
        [7, 0],
        [7, 4],
      ],
      [
        [7, 4],
        [7, 7],
        [3, 7],
      ],
      [
        [3, 7],
        [0, 7],
        [0, 3],
      ],
    ],
    squares: [
      [
        [4, 0],
        [7, 4],
        [3, 7],
        [0, 3],
      ],
    ],
    labels: [{ x: 3.5, y: 3.5, value: "c² = 25" }],
    caption: "Side c = 5",
  },
  {
    name: "Two uncovered squares",
    key: "legs",
    triangles: [
      [
        [3, 0],
        [7, 0],
        [7, 3],
      ],
      [
        [3, 0],
        [7, 3],
        [3, 3],
      ],
      [
        [0, 3],
        [3, 3],
        [3, 7],
      ],
      [
        [0, 3],
        [3, 7],
        [0, 7],
      ],
    ],
    squares: [
      [
        [0, 0],
        [3, 0],
        [3, 3],
        [0, 3],
      ],
      [
        [3, 3],
        [7, 3],
        [7, 7],
        [3, 7],
      ],
    ],
    labels: [
      { x: 1.5, y: 1.5, value: "a² = 9" },
      { x: 5, y: 5, value: "b² = 16" },
    ],
    caption: "Sides a = 3 and b = 4",
  },
] as const;
const points = (vertices: readonly Point[]) =>
  vertices.map(([x, y]) => `${24 + x * 40},${66 + y * 40}`).join(" ");
export function PythagoreanRearrangement() {
  return (
    <figure
      className="lesson-illustration"
      style={{ margin: "24px 0", breakInside: "avoid" }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 12,
        }}
      >
        {arrangements.map((arrangement) => (
          <svg
            key={arrangement.key}
            data-lesson-illustration={`pythagorean-${arrangement.key}`}
            viewBox="0 0 328 418"
            role="img"
            aria-label={`${arrangement.name}. An outer square of side 7 contains four 3–4–5 right triangles. The remaining area is ${arrangement.key === "hypotenuse" ? "one square of side 5 and area 25" : "a square of side 3 and area 9, and a square of side 4 and area 16"}.`}
            style={{
              flex: "1 1 240px",
              width: "100%",
              maxWidth: 328,
              fontFamily: "Arial, sans-serif",
              fontSize: 21,
              fill: "#173b37",
            }}
          >
            <title>{arrangement.name}</title>
            <text x="164" y="26" textAnchor="middle">
              {arrangement.name}
            </text>
            <text x="164" y="53" textAnchor="middle">
              Outer side: 7 cm (a + b)
            </text>
            {arrangement.squares.map((vertices, i) => (
              <polygon
                key={`square-${i}`}
                data-square={i}
                points={points(vertices)}
                fill="#fff"
                stroke="#173b37"
                strokeWidth="2"
              />
            ))}
            {arrangement.triangles.map((vertices, i) => (
              <polygon
                key={`triangle-${i}`}
                data-proof-triangle={i}
                points={points(vertices)}
                fill="#c9ded7"
                stroke="#173b37"
                strokeWidth="2"
              />
            ))}
            {arrangement.labels.map(({ x, y, value }) => (
              <text
                key={value}
                x={24 + x * 40}
                y={74 + y * 40}
                textAnchor="middle"
              >
                {value}
              </text>
            ))}
            <text x="164" y="378" textAnchor="middle">
              {arrangement.caption}
            </text>
            <text x="164" y="407" textAnchor="middle">
              Uncovered area: 25 cm²
            </text>
          </svg>
        ))}
      </div>
      <figcaption>
        All numerical lengths use centimeters; all numerical areas use square
        centimeters. Both outer squares have side 7 cm. Each contains the same
        four shaded triangles, with legs 3 and 4. The white area is 25 in either
        arrangement: 5² = 3² + 4². Moving the four triangles does not change how
        much area they cover.
      </figcaption>
    </figure>
  );
}
