import React from "react";

export type AddSubtractIllustrationKind =
  | "column-addition"
  | "base-ten-trade"
  | "column-subtraction-zero"
  | "column-multidigit";

const figureStyle = { margin: "24px 0", breakInside: "avoid" as const };
const captionStyle = { marginTop: 10, lineHeight: 1.6 };
const svgStyle = { display: "block", width: "100%", maxWidth: 480 };
const highlight = { fill: "currentColor", fillOpacity: 0.14 };

/** Carry digits for a + b, or the regrouped top digits for a − b, by place. */
function marks(a: number, b: number, op: "+" | "−") {
  const top = String(a).split("").reverse().map(Number),
    bottom = String(b).split("").reverse().map(Number);
  const above: (string | null)[] = [];
  if (op === "+") {
    let carry = 0;
    for (let p = 0; p < Math.max(top.length, bottom.length); p++) {
      if (carry) above[p] = "1";
      carry = (top[p] ?? 0) + (bottom[p] ?? 0) + carry >= 10 ? 1 : 0;
    }
    if (carry) above[Math.max(top.length, bottom.length)] = "1";
    return { above, changed: [] as boolean[] };
  }
  const now = [...top];
  for (let p = 0; p < now.length; p++)
    if (now[p]! < (bottom[p] ?? 0)) {
      let q = p + 1;
      while (now[q] === 0) now[q++] = 9;
      now[q]!--;
      now[p]! += 10;
    }
  const changed = now.map((d, p) => d !== top[p]);
  now.forEach((d, p) => (above[p] = changed[p] ? String(d) : null));
  return { above, changed };
}

/** Right-aligned columns: marks, top number, operator and bottom number, rule,
 * result. A gap separates the thousands from the hundreds. */
function Columns({
  a,
  b,
  op,
  focus,
}: {
  a: number;
  b: number;
  op: "+" | "−";
  focus: number;
}) {
  const result = op === "+" ? a + b : a - b;
  const n = Math.max(String(a).length, String(b).length, String(result).length);
  const col = 34,
    right = (320 + (n + 1) * col + (n > 3 ? 12 : 0)) / 2;
  const x = (p: number) => right - col / 2 - p * col - (p >= 3 ? 12 : 0);
  const { above, changed } = marks(a, b, op);
  const row = (value: number, y: number, struck = false) =>
    String(value)
      .split("")
      .reverse()
      .map((d, p) => (
        <g key={`${y}-${p}`}>
          <text
            x={x(p)}
            y={y}
            textAnchor="middle"
            fontSize="28"
            fill="currentColor"
          >
            {d}
          </text>
          {struck && changed[p] && (
            <line
              x1={x(p) - 10}
              x2={x(p) + 10}
              y1={y - 6}
              y2={y - 16}
              stroke="currentColor"
              strokeWidth="2"
            />
          )}
        </g>
      ));
  return (
    <>
      <rect
        x={x(focus) - col / 2 + 2}
        y={8}
        width={col - 4}
        height={152}
        rx={8}
        {...highlight}
      />
      {above.map((m, p) =>
        m ? (
          <text
            key={p}
            x={x(p)}
            y={30}
            textAnchor="middle"
            fontSize="16"
            fontWeight="700"
            fill="currentColor"
          >
            {m}
          </text>
        ) : null,
      )}
      {row(a, 66, op === "−")}
      {row(b, 104)}
      <text
        x={x(n - 1) - col}
        y={104}
        textAnchor="middle"
        fontSize="28"
        fill="currentColor"
      >
        {op}
      </text>
      <line
        x1={x(n - 1) - col - 12}
        x2={right}
        y1={118}
        y2={118}
        stroke="currentColor"
        strokeWidth="2"
      />
      {row(result, 152)}
    </>
  );
}

function Frame({
  kind,
  label,
  caption,
  viewBox = "0 0 320 168",
  children,
}: {
  kind: AddSubtractIllustrationKind;
  label: string;
  caption: string;
  viewBox?: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="lesson-illustration" style={figureStyle}>
      <svg
        data-lesson-illustration={kind}
        viewBox={viewBox}
        role="img"
        aria-label={label}
        style={svgStyle}
        fontFamily="inherit"
      >
        {children}
      </svg>
      <figcaption style={captionStyle}>{caption}</figcaption>
    </figure>
  );
}

/** Rods (ten units) and cubes for a number, from x; ones stack in fives. */
function Blocks({
  tens,
  ones,
  x,
  y,
  taken = [0, 0],
}: {
  tens: number;
  ones: number;
  x: number;
  y: number;
  taken?: [number, number];
}) {
  const u = 9,
    step = 13,
    onesX = x + tens * step + 10;
  return (
    <>
      {Array.from({ length: tens }, (_, i) => (
        <rect
          key={`t${i}`}
          x={x + i * step}
          y={y}
          width={u}
          height={10 * u}
          rx={1}
          fill="currentColor"
          fillOpacity={i >= tens - taken[0] ? 0.15 : 0.75}
          stroke="currentColor"
        />
      ))}
      {Array.from({ length: ones }, (_, i) => (
        <rect
          key={`o${i}`}
          x={onesX + Math.floor(i / 5) * step}
          y={y + 10 * u - ((i % 5) + 1) * step + 4}
          width={u}
          height={u}
          rx={1}
          fill="currentColor"
          fillOpacity={i >= ones - taken[1] ? 0.15 : 0.75}
          stroke="currentColor"
        />
      ))}
    </>
  );
}

/** Fixed teaching models with exact values; colors inherit the text color. */
export function AddSubtractIllustration({
  kind,
}: {
  kind: AddSubtractIllustrationKind;
}) {
  if (kind === "column-addition")
    return (
      <Frame
        kind={kind}
        label="47 plus 38 in columns. The ones make 15, so 1 ten is carried above the tens. The sum is 85."
        caption="Ones: 7 + 8 = 15 ones, which is 1 ten and 5 ones. Write 5 and carry the ten: 4 + 3 + 1 = 8 tens. 47 + 38 = 85."
      >
        <Columns a={47} b={38} op="+" focus={0} />
      </Frame>
    );
  if (kind === "column-subtraction-zero")
    return (
      <Frame
        kind={kind}
        label="503 minus 268 in columns. The 5 hundreds become 4, the 0 tens become 9 and the 3 ones become 13. The difference is 235."
        caption="There are no tens to regroup, so regroup 1 hundred as 10 tens, then 1 ten as 10 ones: 503 is 4 hundreds, 9 tens and 13 ones. 503 − 268 = 235."
      >
        <Columns a={503} b={268} op="−" focus={1} />
      </Frame>
    );
  if (kind === "column-multidigit")
    return (
      <Frame
        kind={kind}
        label="45,072 plus 18,396 in columns with carries above the hundreds and the ten thousands. The sum is 63,468."
        caption="The same column steps work for any number of places: 7 + 9 tens = 16 tens and 5 + 8 thousands = 13 thousands each carry one. 45,072 + 18,396 = 63,468."
      >
        <Columns a={45072} b={18396} op="+" focus={1} />
      </Frame>
    );
  return (
    <Frame
      kind={kind}
      viewBox="0 0 320 172"
      label="Base-ten blocks for 82. One ten rod is traded for 10 ones, making 7 tens and 12 ones. Then 4 tens and 7 ones are taken away, leaving 3 tens and 5 ones."
      caption="82 has only 2 ones, so trade 1 ten for 10 ones: 7 tens and 12 ones. Take away 4 tens and 7 ones (faded). 3 tens and 5 ones are left: 82 − 47 = 35."
    >
      <text x={6} y={16} fontSize="13" fill="currentColor">
        82
      </text>
      <Blocks tens={8} ones={2} x={6} y={24} />
      <path
        d="M136 70 h22 m-7 -6 l7 6 l-7 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <text x={166} y={16} fontSize="13" fill="currentColor">
        7 tens, 12 ones
      </text>
      <Blocks tens={7} ones={12} x={166} y={24} taken={[4, 7]} />
      <text x={166} y={140} fontSize="13" fill="currentColor">
        take away 47 (faded)
      </text>
      <text x={166} y={162} fontSize="15" fontWeight="700" fill="currentColor">
        35 left
      </text>
    </Frame>
  );
}
