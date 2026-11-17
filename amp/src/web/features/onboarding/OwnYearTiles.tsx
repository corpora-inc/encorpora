import { birthYears } from "../../lib/birth-years";
import { TileChoice } from "../../ui/TileChoice";

/** The years the grid offers, "Adult" for anyone older, then oldest first:
 * the old free trial's picker, starting at age 7. */
const OWN_YEARS = 16;
const OWN_YOUNGEST = 7;
const ADULT_AGE = 25;

/** "What year were you born?" for someone's own practice: one tile per year
 * and "Adult", the shared radio tiles (ui/TileChoice): choosing is not the
 * commit here (a Start button is), so the arrows, Home and End choose. The year is all AMP needs
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
  // Oldest first: "Adult" leads, then the years in reading order.
  const options = [
    { year: thisYear - ADULT_AGE, label: "Adult" },
    ...birthYears(OWN_YEARS, OWN_YOUNGEST).map((year) => ({
      year,
      label: String(year),
    })),
  ];
  return (
    <TileChoice
      labelledBy={labelledBy}
      tiles={options.map((option) => ({
        value: option.year,
        label: option.label,
        span: option.label === "Adult" ? ("row" as const) : undefined,
      }))}
      value={value}
      onChange={(year) => {
        if (year !== null) onChange(year);
      }}
      columns={{ narrow: 4, wide: 8 }}
      disabled={disabled}
    />
  );
}
