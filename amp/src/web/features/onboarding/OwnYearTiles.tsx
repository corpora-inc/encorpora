import { useRef, type CSSProperties } from "react";
import tiles from "../../ui/TileChoice.module.css";

/** The years the grid offers, newest first, then "Adult" for anyone older:
 * the old free trial's picker, starting at age 7. */
const OWN_YEARS = 16;
const OWN_YOUNGEST = 7;
const ADULT_AGE = 25;

/** "What year were you born?" for someone's own practice: one tile per year
 * and "Adult", arrow keys moving through them. The year is all AMP needs
 * (the starter's Myself step and `/me/start` alike); practice finds the
 * level from the first answers. */
export function OwnYearTiles({
  value,
  onChange,
  labelledBy,
  disabled = false,
}: {
  value: number | null;
  onChange: (year: number) => void;
  /** The heading that asks the question. */
  labelledBy: string;
  disabled?: boolean;
}) {
  const thisYear = new Date().getFullYear();
  const options = [
    ...Array.from({ length: OWN_YEARS }, (_, i) => {
      const year = thisYear - OWN_YOUNGEST - i;
      return { year, label: String(year) };
    }),
    { year: thisYear - ADULT_AGE, label: "Adult" },
  ];
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = Math.max(
    0,
    options.findIndex((option) => option.year === value),
  );
  const pick = (index: number) => {
    onChange(options[index]!.year);
    refs.current[index]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className={tiles.grid}
      style={{ "--tiles-narrow": 4, "--tiles-wide": 8 } as CSSProperties}
    >
      {options.map((option, index) => (
        <button
          key={option.label}
          ref={(node) => {
            refs.current[index] = node;
          }}
          type="button"
          role="radio"
          aria-checked={option.year === value}
          tabIndex={index === current ? 0 : -1}
          data-span={option.label === "Adult" ? "row" : undefined}
          className={tiles.tile}
          disabled={disabled}
          onClick={() => pick(index)}
          onKeyDown={(event) => {
            const step =
              event.key === "ArrowRight" || event.key === "ArrowDown"
                ? 1
                : event.key === "ArrowLeft" || event.key === "ArrowUp"
                  ? -1
                  : 0;
            if (!step) return;
            event.preventDefault();
            pick((index + step + options.length) % options.length);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
