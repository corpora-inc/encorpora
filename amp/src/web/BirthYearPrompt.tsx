export const strandNames: Record<string, string> = {
  number: "Numbers",
  operations: "Operations",
  fractions: "Fractions",
  decimals: "Decimals",
  ratio: "Ratio & percent",
  algebra: "Algebra",
  functions: "Functions",
  geometry: "Geometry",
  measurement: "Measurement",
  data: "Data",
  probability: "Probability",
  modeling: "Word problems",
};
export const gradeOrder = [
  "K",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "algebra-1",
  "geometry",
  "algebra-2",
  "precalculus",
];

type Props = {
  name: string;
  birthYear: number | null;
  busy: boolean;
  saveBirthYear: (year: number) => void;
  cancel?: () => void;
  /** Replaces "What year was {name} born?". */
  title?: string;
};

/** The only question before practice: it sets where placement begins. */
export function BirthYearPrompt(props: Props) {
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 16 }, (_, i) => thisYear - 4 - i);
  return (
    <main className="practice-start">
      <section className="start-card birth-year">
        <h1>{props.title ?? `What year was ${props.name} born?`}</h1>
        <p>
          The first problems check skills expected by that age. Practice then
          moves up or down until each problem is just within reach.
        </p>
        <div className="year-grid" role="group" aria-label="Birth year">
          {years.map((year) => (
            <button
              key={year}
              className={year === props.birthYear ? "selected" : ""}
              disabled={props.busy}
              onClick={() => props.saveBirthYear(year)}
            >
              {year}
            </button>
          ))}
          <button
            className="adult"
            disabled={props.busy}
            onClick={() => props.saveBirthYear(thisYear - 25)}
          >
            Adult
          </button>
        </div>
        {props.cancel && (
          <button className="text-button" onClick={props.cancel}>
            Cancel
          </button>
        )}
      </section>
    </main>
  );
}
