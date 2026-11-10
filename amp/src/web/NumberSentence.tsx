import { useEffect, useRef, type ReactNode } from "react";
import { counterObjectPaths, counterSvgPath } from "../math/counter-objects";
import type { CounterBuilderResponse } from "../math/counter-builder";

export function CounterObject({
  thing,
}: {
  thing: CounterBuilderResponse["thing"];
}) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="counter-object">
      {counterObjectPaths[thing].map((d, i) => (
        <path
          key={i}
          d={counterSvgPath(d)}
          fill={i ? "none" : "currentColor"}
        />
      ))}
    </svg>
  );
}
export function CounterSign({ sign }: { sign: "+" | "-" }) {
  return (
    <svg className="counter-sign" viewBox="0 0 24 24" aria-hidden="true">
      <path d={sign === "+" ? "M5 12h14M12 5v14" : "M5 12h14"} />
    </svg>
  );
}
export const spokenNumberTile = (value: number | "+" | "-" | null) =>
  value === "+" ? "plus" : value === "-" ? "minus" : (value ?? "blank");

/** Variable-length sentences share accessible slots, focus movement and signs. */
export function NumberSentence({
  slots,
  selected,
  onSelect,
  locked,
  resolved,
  onKeyDown,
}: {
  slots: {
    value: number | "+" | "-" | null;
    label: string;
    prefix?: "+" | "=";
  }[];
  selected: number;
  onSelect: (index: number) => void;
  locked: boolean;
  resolved: boolean;
  onKeyDown?: (key: string) => boolean;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    if (
      !locked &&
      buttons.current.some((node) => node === document.activeElement)
    )
      buttons.current[selected]?.focus({ preventScroll: true });
  }, [selected, locked]);
  return (
    <div
      className="counter-sentence"
      role="group"
      aria-label="Build the number sentence"
    >
      {slots.map(({ value, label, prefix }, i) => (
        <span className="counter-sentence-part" key={i}>
          {prefix && (
            <span
              className="counter-equals"
              aria-label={prefix === "=" ? "equals" : "plus"}
            >
              {prefix}
            </span>
          )}
          <button
            type="button"
            className="counter-slot"
            ref={(node) => {
              buttons.current[i] = node;
            }}
            aria-pressed={!resolved && selected === i}
            disabled={locked}
            aria-label={`${label}: ${spokenNumberTile(value)}`}
            onFocus={() => onSelect(i)}
            onClick={() => onSelect(i)}
            onKeyDown={(event) => {
              if (locked) return;
              if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                event.preventDefault();
                const next = Math.max(
                  0,
                  Math.min(
                    slots.length - 1,
                    i + (event.key === "ArrowRight" ? 1 : -1),
                  ),
                );
                onSelect(next);
                buttons.current[next]?.focus();
              } else if (onKeyDown?.(event.key)) event.preventDefault();
            }}
          >
            {value === "+" || value === "-" ? (
              <CounterSign sign={value} />
            ) : (
              (value ?? (
                <span className="counter-blank" aria-hidden="true">
                  ?
                </span>
              ))
            )}
          </button>
        </span>
      ))}
    </div>
  );
}
/** Operators have their own segmented pair, separate from the number pad. */
export function NumberTilePad({
  numbers,
  onNumber,
  locked,
  resolved,
  disabledNumber,
  operators,
  trailing,
}: {
  numbers: readonly number[];
  onNumber: (value: number) => void;
  locked: boolean;
  resolved: boolean;
  disabledNumber?: (value: number) => boolean;
  operators?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div
      className="counter-tiles"
      role="group"
      aria-label="Number and sign tiles"
      aria-hidden={resolved || undefined}
    >
      {operators && (
        <div className="counter-signs" role="group" aria-label="Signs">
          {operators}
        </div>
      )}
      <div className="counter-numbers" role="group" aria-label="Numbers">
        {numbers.map((n) => (
          <button
            type="button"
            className={n === 10 ? "counter-ten" : undefined}
            key={n}
            disabled={locked || disabledNumber?.(n)}
            onClick={() => onNumber(n)}
            aria-label={`Number ${n}`}
          >
            {n}
          </button>
        ))}
        {trailing}
      </div>
    </div>
  );
}
