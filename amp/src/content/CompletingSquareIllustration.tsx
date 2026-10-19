import React from "react";
import { PrintMathText } from "./PrintMathText";
type Kind =
  "complete-square-area" | "complete-square-balance" | "complete-square-scaled";
export function CompletingSquareIllustration({ kind }: { kind: Kind }) {
  if (kind === "complete-square-area")
    return (
      <figure style={{ margin: "24px 0", breakInside: "avoid" }}>
        <svg
          data-lesson-illustration={kind}
          viewBox="0 0 340 330"
          role="img"
          aria-label="A square of side x and two rectangles of sides x and 3 leave a missing 3 by 3 corner. Adding its area 9 completes a square of side x plus 3. The drawing uses x equals 4 and one unit equals 26 drawing units."
          style={{
            display: "block",
            width: "100%",
            maxWidth: 400,
            margin: "0 auto",
          }}
        >
          <g stroke="currentColor" strokeWidth="1.5">
            <rect
              data-region="square"
              x="60"
              y="70"
              width="104"
              height="104"
              fill="#dce9df"
            />
            <rect
              data-region="right"
              x="164"
              y="70"
              width="78"
              height="104"
              fill="#f5e9c9"
            />
            <rect
              data-region="bottom"
              x="60"
              y="174"
              width="104"
              height="78"
              fill="#f5e9c9"
            />
            <rect
              data-region="corner"
              x="164"
              y="174"
              width="78"
              height="78"
              fill="#b7d5c7"
            />
            <path
              d="M190 174V252 M216 174V252 M164 200H242 M164 226H242"
              opacity=".45"
            />
          </g>
          <g
            fill="#18332f"
            fontFamily="inherit"
            textAnchor="middle"
            style={{ fontSize: 26 }}
          >
            <text style={{ fontSize: 24 }} x="112" y="130">
              x²
            </text>
            <text style={{ fontSize: 24 }} x="203" y="130">
              3x
            </text>
            <text style={{ fontSize: 24 }} x="112" y="222">
              3x
            </text>
          </g>
          <g
            fill="currentColor"
            fontFamily="inherit"
            textAnchor="middle"
            style={{ fontSize: 24 }}
          >
            <text style={{ fontSize: 24 }} x="112" y="51">
              x
            </text>
            <text style={{ fontSize: 24 }} x="203" y="51">
              3
            </text>
            <text style={{ fontSize: 24 }} x="38" y="130">
              x
            </text>
            <text style={{ fontSize: 24 }} x="38" y="222">
              3
            </text>
            <text style={{ fontSize: 22 }} x="170" y="295">
              16 + 12 + 12 + 9 = 49
            </text>
          </g>
        </svg>
        <figcaption style={{ marginTop: 12, lineHeight: 1.65 }}>
          <PrintMathText text="The drawing uses x = 4. The missing corner contains nine unit squares. For any positive x, its side is still 3: $x^2 + 6x + 9 = (x + 3)^2$." />
        </figcaption>
      </figure>
    );
  const scaled = kind === "complete-square-scaled";
  const rows = scaled
    ? [
        ["Inside the square", "$(x + 1)^2$", "1"],
        ["Multiply by 2", "$2(x + 1)^2$", "2"],
        ["Original expression", "$2x^2 + 4x + 5$", "5"],
        ["Required remainder", "5 − 2", "3"],
      ]
    : [
        ["Original expression", "$x^2 + 6x + 5$", "5"],
        ["Completed square", "$(x + 3)^2$", "9"],
        ["Required remainder", "5 − 9", "−4"],
      ];
  return (
    <figure style={{ margin: "16px 0", breakInside: "avoid" }}>
      <table
        data-lesson-illustration={kind}
        style={{ width: "100%", borderCollapse: "collapse", fontSize: "1em" }}
      >
        <caption
          style={{ textAlign: "left", fontWeight: 700, paddingBottom: 8 }}
        >
          Track the constant term
        </caption>
        <thead>
          <tr>
            <th
              scope="col"
              style={{
                textAlign: "left",
                padding: "8px 8px",
                borderBottom: "2px solid currentColor",
              }}
            >
              Expression
            </th>
            <th
              scope="col"
              style={{
                textAlign: "right",
                padding: "8px 8px",
                borderBottom: "2px solid currentColor",
              }}
            >
              Constant
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, expression, value], i) => (
            <tr key={label} data-constant-row={i}>
              <td
                style={{
                  padding: "8px 8px",
                  borderBottom: "1px solid #a9bbb5",
                }}
              >
                <div style={{ fontSize: ".85em", marginBottom: 4 }}>
                  {label}
                </div>
                <PrintMathText text={expression!} />
              </td>
              <td
                style={{
                  padding: "8px 8px",
                  textAlign: "right",
                  borderBottom: "1px solid #a9bbb5",
                }}
              >
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <figcaption style={{ marginTop: 12, lineHeight: 1.65 }}>
        <PrintMathText
          text={
            scaled
              ? "Multiplying the square by 2 also multiplies its constant by 2. Keep the original constant 5 by adding 3: $2x^2 + 4x + 5 = 2(x + 1)^2 + 3$."
              : "The square contributes 9, but the original constant is 5. Subtract 4 to preserve the expression: $x^2 + 6x + 5 = (x + 3)^2 - 4$."
          }
        />
      </figcaption>
    </figure>
  );
}
