import { useState } from "react";
import { strandNames } from "./BirthYearPrompt";

type Estimate = {
  level: number;
  sd: number;
  answered: number;
  independent: number;
};
export type FrontierMap = {
  expected: number;
  overall: Estimate;
  strands: Record<string, Estimate>;
};

const COLLEGE = 13;
export function gradeName(level: number) {
  const g = Math.round(level);
  if (g <= 0) return "K";
  if (g <= 8) return `Grade ${g}`;
  return (
    ["Algebra 1", "Geometry", "Algebra 2", "Precalculus"][g - 9] ?? "College"
  );
}
/** A 90% range: the estimate ± 1.64 standard deviations. */
const range = (e: Estimate) => [e.level - 1.64 * e.sd, e.level + 1.64 * e.sd];

type Props = {
  name: string;
  resuming: boolean;
  frontier: FrontierMap | null;
  strands: readonly string[];
  busy: boolean;
  go: () => void;
  changeBirthYear: () => void;
};

/** Home: one action, and each strand's estimated grade level relative to the
 * grade typical for the learner's age, with its uncertainty. */
export function Home(props: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const f = props.frontier;
  // Six grades centred on the grade typical for this age.
  const center = f?.expected ?? 4;
  const lo = Math.max(0, Math.min(center - 3, COLLEGE - 6)),
    hi = lo + 6;
  const at = (v: number) =>
    `${((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * 100}%`;
  return (
    <main className="home">
      <section className="home-hero">
        <div>
          <h1>{props.name}</h1>
          {f && f.overall.answered > 0 && (
            <p className="home-level">
              Estimated level: {gradeName(f.overall.level)}
            </p>
          )}
        </div>
        <button className="go-button" disabled={props.busy} onClick={props.go}>
          {props.resuming ? "Continue" : "Go"}
        </button>
      </section>
      <section className="frontier-map" aria-label="Where you are">
        <div className="frontier-heading">
          <h2>Where you are</h2>
          <p>
            Estimated grade level in each area. The centre line is typical for{" "}
            {props.name}’s age; bars narrow with each answer.
          </p>
        </div>
        <ul>
          {props.strands.map((strand) => {
            const measured = f?.strands[strand];
            const estimate: Estimate = measured ?? {
              level: f?.overall.level ?? center,
              sd: Math.max(1.75, f?.overall.sd ?? 2.5),
              answered: 0,
              independent: 0,
            };
            const [from, to] = range(estimate) as [number, number];
            const expanded = open === strand;
            return (
              <li key={strand} data-strand={strand}>
                <button
                  className="frontier-row"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : strand)}
                >
                  <span className="frontier-name">{strandNames[strand]}</span>
                  <span
                    className={`frontier-track ${measured ? "" : "estimated"}`}
                    aria-hidden="true"
                  >
                    <span className="frontier-center" />
                    <span
                      className="frontier-range"
                      style={{
                        left: at(from),
                        width: `calc(${at(to)} - ${at(from)})`,
                      }}
                    />
                    <span
                      className="frontier-dot"
                      style={{ left: at(estimate.level) }}
                    />
                  </span>
                </button>
                {expanded && (
                  <p className="frontier-detail">
                    {measured
                      ? `${gradeName(estimate.level)}, likely ${gradeName(from)} to ${gradeName(to)}. ${measured.answered} answered, ${measured.independent} correct without help.`
                      : `Not practiced yet. Estimated from other areas: ${gradeName(estimate.level)}, likely ${gradeName(from)} to ${gradeName(to)}.`}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        <div className="frontier-axis" aria-hidden="true">
          <span>{gradeName(lo)}</span>
          <span>{gradeName(center)}</span>
          <span>
            {gradeName(hi)}
            {hi < COLLEGE ? "+" : ""}
          </span>
        </div>
      </section>
      <button
        className="text-button home-birth-year"
        onClick={props.changeBirthYear}
      >
        Change birth year
      </button>
    </main>
  );
}
