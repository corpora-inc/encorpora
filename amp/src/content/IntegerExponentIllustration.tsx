import React from "react";

/** Exact table: each step divides a power of two by two. */
export function IntegerExponentIllustration() {
  const rows = [
    ["3", "8"],
    ["2", "4"],
    ["1", "2"],
    ["0", "1"],
    ["−1", "1/2"],
    ["−2", "1/4"],
  ];
  return (
    <figure data-lesson-illustration="integer-exponent-ladder">
      <svg
        data-lesson-illustration="integer-exponent-ladder"
        viewBox="0 0 360 456"
        role="img"
        aria-label="Powers of two: exponents 3, 2, 1, 0, negative 1, and negative 2 have values 8, 4, 2, 1, one half, and one fourth. Each step divides the value by two."
        style={{
          width: "100%",
          maxWidth: 400,
          display: "block",
          margin: "0 auto",
          color: "inherit",
        }}
      >
        <g fill="currentColor" fontFamily="inherit" fontSize="28">
          <text style={{ fontSize: 28 }} x="12" y="32">
            Exponent
          </text>
          <text style={{ fontSize: 28 }} x="208" y="32">
            Value
          </text>
          {rows.map(([exponent, value], i) => (
            <g key={exponent} data-exponent={exponent} data-value={value}>
              <text
                style={{ fontSize: 28 }}
                x="74"
                y={88 + i * 68}
                textAnchor="middle"
              >
                {exponent}
              </text>
              <text
                style={{ fontSize: 28 }}
                x="242"
                y={88 + i * 68}
                textAnchor="middle"
              >
                {value}
              </text>
              {i < 5 && (
                <g>
                  <path
                    d={`M 286 ${85 + i * 68} v 48 m -5 -7 l 5 7 l 5 -7`}
                    stroke="currentColor"
                    fill="none"
                    strokeWidth="2"
                  />
                  <text
                    style={{ fontSize: 26 }}
                    x="300"
                    y={119 + i * 68}
                    fontSize="26"
                  >
                    ÷2
                  </text>
                </g>
              )}
            </g>
          ))}
        </g>
        <path
          d="M 10 44 H 348 M 170 10 V 438"
          stroke="currentColor"
          opacity=".3"
        />
      </svg>
      <figcaption>
        The base is 2 in every row. Decreasing the exponent by 1 divides the
        value by 2.
      </figcaption>
    </figure>
  );
}
