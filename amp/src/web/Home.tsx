import { strandNames } from "./BirthYearPrompt";

export type FrontierMap = { overall: number; strands: Record<string, number> };
const MAX = 12;

type Props = {
  name: string;
  resuming: boolean;
  frontier: FrontierMap | null;
  strands: readonly string[];
  busy: boolean;
  go: () => void;
  changeBirthYear: () => void;
};

/** Home: one action, and a map of where the learner stands in each strand. */
export function Home(props: Props) {
  return (
    <main className="home">
      <section className="home-hero">
        <h1>{props.name}</h1>
        <button className="go-button" disabled={props.busy} onClick={props.go}>
          {props.resuming ? "Continue" : "Go"}
        </button>
      </section>
      <section className="frontier-map" aria-label="Where you are">
        <div className="frontier-scale" aria-hidden="true">
          {(
            [
              ["Counting", 0],
              ["Fractions", 4],
              ["Algebra", 9],
              ["SAT", MAX],
            ] as const
          ).map(([label, grade]) => (
            <span key={label} style={{ left: `${(grade / MAX) * 100}%` }}>
              {label}
            </span>
          ))}
        </div>
        <ul>
          {props.strands.map((strand) => {
            const measured = props.frontier?.strands[strand];
            const level = measured ?? props.frontier?.overall ?? 0;
            const at = `${(Math.min(MAX, Math.max(0, level)) / MAX) * 100}%`;
            return (
              <li key={strand} data-strand={strand}>
                <span className="frontier-name">{strandNames[strand]}</span>
                <span
                  className={`frontier-track ${measured === undefined ? "estimated" : ""}`}
                  role="img"
                  aria-label={`${strandNames[strand]}: ${
                    measured === undefined ? "not yet practiced" : "frontier"
                  } at ${Math.round((level / MAX) * 100)}% of the way to SAT`}
                >
                  <span className="frontier-fill" style={{ width: at }} />
                  <span className="frontier-dot" style={{ left: at }} />
                </span>
              </li>
            );
          })}
        </ul>
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
