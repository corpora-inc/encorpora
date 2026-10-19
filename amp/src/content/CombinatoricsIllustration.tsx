import React from "react";

export type CombinatoricsIllustrationKind =
  | "counting-tree"
  | "permutation-slots"
  | "combination-orders"
  | "independent-grid"
  | "expected-spinner";

const label = { fontSize: 22, fill: "currentColor" } as const;
const small = { fontSize: 20, fill: "currentColor" } as const;
const figureStyle = { margin: "24px 0", breakInside: "avoid" as const };
const svgStyle = {
  width: "100%",
  maxWidth: 440,
  display: "block",
  margin: "0 auto",
} as const;
const captionStyle = { marginTop: 12, lineHeight: 1.6 };

/** Fixed teaching models; data attributes let an independent reviewer recount them. */
export function CombinatoricsIllustration({
  kind,
}: {
  kind: CombinatoricsIllustrationKind;
}) {
  if (kind === "counting-tree") return <CountingTree />;
  if (kind === "permutation-slots") return <PermutationSlots />;
  if (kind === "combination-orders") return <CombinationOrders />;
  if (kind === "independent-grid") return <IndependentGrid />;
  return <ExpectedSpinner />;
}

function CountingTree() {
  const shirts = ["A", "B", "C"],
    pants = ["1", "2"];
  const shirtY = [70, 170, 270];
  return (
    <figure className="lesson-illustration" style={figureStyle}>
      <svg
        data-lesson-illustration="counting-tree"
        viewBox="0 0 400 360"
        role="img"
        aria-label="A tree diagram. Three branches lead to shirts A, B and C. Each shirt branches to pants 1 and 2, giving six outfits: A1, A2, B1, B2, C1 and C2."
        style={svgStyle}
      >
        <title>Every shirt pairs with every pair of pants</title>
        {(
          [
            ["Shirt", 110],
            ["Pants", 200],
            ["Outfit", 312],
          ] as const
        ).map(([heading, x]) => (
          <text
            key={heading}
            x={x}
            y="28"
            textAnchor="middle"
            style={{ ...label, fontWeight: 700 }}
          >
            {heading}
          </text>
        ))}
        <circle cx="30" cy="170" r="6" fill="currentColor" />
        {shirts.map((shirt, i) => (
          <g key={shirt}>
            <line
              x1="30"
              y1="170"
              x2="96"
              y2={shirtY[i]}
              stroke="currentColor"
              strokeWidth="2"
            />
            <text
              x="110"
              y={shirtY[i]! + 8}
              textAnchor="middle"
              style={label}
              data-stage="shirt"
            >
              {shirt}
            </text>
            {pants.map((pant, j) => {
              const y = shirtY[i]! + (j ? 26 : -26);
              return (
                <g key={pant}>
                  <line
                    x1="124"
                    y1={shirtY[i]}
                    x2="186"
                    y2={y}
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <text x="200" y={y + 8} textAnchor="middle" style={label}>
                    {pant}
                  </text>
                  <line
                    x1="216"
                    y1={y}
                    x2="282"
                    y2={y}
                    stroke="currentColor"
                    strokeDasharray="4 5"
                  />
                  <text
                    x="296"
                    y={y + 8}
                    style={label}
                    data-outcome={`${shirt},${pant}`}
                  >
                    {shirt}
                    {pant}
                  </text>
                </g>
              );
            })}
          </g>
        ))}
        <text x="200" y="350" textAnchor="middle" style={label}>
          3 × 2 = 6 outfits
        </text>
      </svg>
      <figcaption style={captionStyle}>
        Each of the 3 shirts has its own 2 branches for pants. Every path from
        the starting point to the right is one outfit, and no outfit appears
        twice: 3 groups of 2 make 3 × 2 = 6 outfits.
      </figcaption>
    </figure>
  );
}

function PermutationSlots() {
  const slots = [
    ["1st place", 5],
    ["2nd place", 4],
    ["3rd place", 3],
  ] as const;
  return (
    <figure className="lesson-illustration" style={figureStyle}>
      <svg
        data-lesson-illustration="permutation-slots"
        data-pool="5"
        viewBox="0 0 400 230"
        role="img"
        aria-label="Three places are filled in order from 5 runners. First place has 5 options, second place 4 and third place 3, so there are 5 times 4 times 3, which is 60, ways."
        style={svgStyle}
      >
        <title>Each filled place leaves one fewer runner</title>
        <text
          x="200"
          y="30"
          textAnchor="middle"
          style={{ ...label, fontWeight: 700 }}
        >
          5 runners, 3 places
        </text>
        {slots.map(([name, options], i) => {
          const x = 20 + i * 130;
          return (
            <g key={name}>
              <rect
                x={x}
                y="60"
                width="100"
                height="84"
                rx="8"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
              <text
                x={x + 50}
                y="116"
                textAnchor="middle"
                style={{ fontSize: 34, fill: "currentColor", fontWeight: 700 }}
                data-options={options}
              >
                {options}
              </text>
              <text x={x + 50} y="176" textAnchor="middle" style={small}>
                {name}
              </text>
              {i < 2 && (
                <text x={x + 115} y="112" textAnchor="middle" style={label}>
                  ×
                </text>
              )}
            </g>
          );
        })}
        <text x="200" y="218" textAnchor="middle" style={label} data-total="60">
          5 × 4 × 3 = 60 ways
        </text>
      </svg>
      <figcaption style={captionStyle}>
        The number in each box counts the runners still available for that
        place. A runner who has already placed cannot place again, so each box
        holds one fewer option than the box before it.
      </figcaption>
    </figure>
  );
}

function CombinationOrders() {
  const pairs = ["AB", "AC", "AD", "BC", "BD", "CD"];
  return (
    <figure className="lesson-illustration" style={figureStyle}>
      <svg
        data-lesson-illustration="combination-orders"
        viewBox="0 0 400 260"
        role="img"
        aria-label="Twelve ordered pairs of the people A, B, C and D are arranged in six columns. Each column holds one pair in both orders, such as AB and BA, so the twelve ordered pairs form six committees of two."
        style={svgStyle}
      >
        <title>Two orders of each pair make one committee</title>
        <text x="20" y="30" style={{ ...label, fontWeight: 700 }}>
          Ordered pairs from A, B, C, D
        </text>
        {pairs.map((pair, i) => {
          const x = 24 + i * 60;
          return (
            <g key={pair}>
              <rect
                x={x}
                y="50"
                width="52"
                height="104"
                rx="6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
              {[pair, pair[1]! + pair[0]!].map((order, j) => (
                <text
                  key={order}
                  x={x + 26}
                  y={88 + j * 42}
                  textAnchor="middle"
                  style={label}
                  data-order={order}
                  data-group={pair}
                >
                  {order}
                </text>
              ))}
              <text x={x + 26} y="186" textAnchor="middle" style={small}>
                {pair[0]}, {pair[1]}
              </text>
            </g>
          );
        })}
        <text x="200" y="244" textAnchor="middle" style={label}>
          12 ÷ 2 = 6 committees
        </text>
      </svg>
      <figcaption style={captionStyle}>
        There are 4 × 3 = 12 ordered pairs. Each column holds the 2 orders of
        the same two people, and below it is the one committee they form.
        Dividing by the 2 orders of each pair counts each committee once.
      </figcaption>
    </figure>
  );
}

function IndependentGrid() {
  const cubes = [1, 2, 3, 4, 5, 6],
    spins = [5, 4, 3, 2, 1];
  const left = 80,
    top = 52,
    w = 48,
    h = 40;
  return (
    <figure className="lesson-illustration" style={figureStyle}>
      <svg
        data-lesson-illustration="independent-grid"
        viewBox="0 0 400 340"
        role="img"
        aria-label="A grid of 30 equally likely pairs: 6 cube results across and 5 spinner results down. Six hatched cells have an even cube result and a spinner result of 4 or 5."
        style={svgStyle}
      >
        <title>Favorable pairs form a rectangle of cells</title>
        <defs>
          <pattern
            id="independent-grid-hatch"
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="8"
              stroke="currentColor"
              strokeWidth="3"
            />
          </pattern>
        </defs>
        <text
          x={left + 3 * w}
          y="28"
          textAnchor="middle"
          style={{ ...label, fontWeight: 700 }}
        >
          Cube result
        </text>
        <text
          x="22"
          y={top + 2.5 * h}
          textAnchor="middle"
          transform={`rotate(-90 22 ${top + 2.5 * h})`}
          style={{ ...label, fontWeight: 700 }}
        >
          Spinner
        </text>
        {cubes.map((c, i) => (
          <text
            key={c}
            x={left + i * w + w / 2}
            y={top + 5 * h + 28}
            textAnchor="middle"
            style={label}
          >
            {c}
          </text>
        ))}
        {spins.map((s, j) => (
          <text
            key={s}
            x={left - 14}
            y={top + j * h + 28}
            textAnchor="middle"
            style={label}
          >
            {s}
          </text>
        ))}
        {spins.map((s, j) =>
          cubes.map((c, i) => {
            const favorable = c % 2 === 0 && s > 3;
            return (
              <rect
                key={`${c},${s}`}
                data-cell={`${c},${s}`}
                data-favorable={favorable ? "true" : "false"}
                x={left + i * w}
                y={top + j * h}
                width={w}
                height={h}
                fill={favorable ? "url(#independent-grid-hatch)" : "none"}
                stroke="currentColor"
                strokeWidth="1.5"
              />
            );
          }),
        )}
        <text x="200" y="326" textAnchor="middle" style={label}>
          6 of 30 pairs: 3/6 × 2/5 = 6/30
        </text>
      </svg>
      <figcaption style={captionStyle}>
        Each cell is one equally likely pair of results. The hatched cells have
        an even cube result (2, 4 or 6) and a spinner result greater than 3 (4
        or 5). They fill 3 columns of 2 cells, so 6 of the 30 pairs are
        favorable.
      </figcaption>
    </figure>
  );
}

function ExpectedSpinner() {
  const payoffs = [12, 4, 4, 4, 0, 0, 0, 0];
  const cx = 200,
    cy = 160,
    radius = 120;
  const point = (angle: number, r: number) => {
    const a = ((angle - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  };
  return (
    <figure className="lesson-illustration" style={figureStyle}>
      <svg
        data-lesson-illustration="expected-spinner"
        data-expected="3"
        viewBox="0 0 400 340"
        role="img"
        aria-label="A spinner with 8 equal sections. One section shows 12 points, three show 4 points and four show 0 points. The expected value is 3 points."
        style={svgStyle}
      >
        <title>Eight equal sections and their payoffs</title>
        {payoffs.map((payoff, i) => {
          const [x1, y1] = point(i * 45, radius),
            [x2, y2] = point((i + 1) * 45, radius),
            [lx, ly] = point(i * 45 + 22.5, radius * 0.66);
          return (
            <g key={i}>
              <path
                data-section={i}
                data-payoff={payoff}
                d={`M${cx} ${cy} L${x1.toFixed(2)} ${y1.toFixed(2)} A${radius} ${radius} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`}
                fill={payoff === 12 ? "url(#expected-spinner-hatch)" : "none"}
                stroke="currentColor"
                strokeWidth="2"
              />
              <text
                x={lx.toFixed(2)}
                y={(ly + 8).toFixed(2)}
                textAnchor="middle"
                style={{ ...label, fontWeight: payoff ? 700 : 400 }}
              >
                {payoff}
              </text>
            </g>
          );
        })}
        <defs>
          <pattern
            id="expected-spinner-hatch"
            width="10"
            height="10"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="10"
              stroke="currentColor"
              strokeWidth="1.5"
              opacity="0.5"
            />
          </pattern>
        </defs>
        <text x="200" y="320" textAnchor="middle" style={label}>
          12 × 1/8 + 4 × 3/8 + 0 × 4/8 = 3
        </text>
      </svg>
      <figcaption style={captionStyle}>
        All 8 sections are the same size, so each has probability 1/8. The
        12-point section is hatched. Three sections show 4 points and four show
        0 points. Weighting each payoff by its probability gives 3 points per
        spin on average.
      </figcaption>
    </figure>
  );
}
