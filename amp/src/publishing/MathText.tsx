import React from "react";

export function MathText({ text }: { text: string }) {
  const parts = text.split(/(-?\d+\/\d+)/g);
  return (
    <>
      {parts.map((part, index) => {
        const match = /^(-?\d+)\/(\d+)$/.exec(part);
        return match ? (
          <span
            key={index}
            className="inline-fraction"
            role="math"
            aria-label={`${match[1]} over ${match[2]}`}
          >
            <span aria-hidden="true">{match[1]}</span>
            <span aria-hidden="true">{match[2]}</span>
          </span>
        ) : (
          part
        );
      })}
    </>
  );
}
