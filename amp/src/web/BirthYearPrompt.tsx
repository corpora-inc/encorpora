import type { ReactNode } from "react";
import { birthYears } from "./lib/birth-years";
import { useTileListbox } from "./ui/tile-listbox";
export const strandNames: Record<string, string> = {
  number: "Numbers",
  operations: "Operations",
  fractions: "Fractions",
  decimals: "Decimals",
  ratio: "Ratio & percent",
  algebra: "Algebra",
  reasoning: "Reasoning",
  functions: "Functions",
  geometry: "Geometry",
  trigonometry: "Trigonometry",
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
  /** Offer "Adult" before the school years (the default). */
  adult?: boolean;
  busy: boolean;
  saveBirthYear: (year: number) => void;
  cancel?: () => void;
  /** Replaces "What year was {name} born?". */
  title?: string;
  description?: string;
  /** Inside a page that already has its main landmark, with this card class. */
  embedded?: {
    className: string;
    header?: ReactNode;
    footer?: ReactNode;
    containerClassName?: string;
  };
};

/** The only question before practice: it sets where placement begins.
 * Choosing a year saves it, so the years are a listbox (ui/tile-listbox):
 * one tab stop, arrows and typing move, Enter or Space chooses. */
export function BirthYearPrompt(props: Props) {
  const thisYear = new Date().getFullYear();
  const choices = [
    ...(props.adult !== false
      ? [{ year: thisYear - 25, label: "Adult", adult: true }]
      : []),
    ...birthYears(16, 4).map((year) => ({
      year,
      label: String(year),
      adult: false,
    })),
  ];
  const { listProps, optionProps } = useTileListbox({
    labels: choices.map((choice) => choice.label),
    selected: choices.findIndex(
      (choice) => !choice.adult && choice.year === props.birthYear,
    ),
    onChoose: (index) => props.saveBirthYear(choices[index]!.year),
    spans: choices.map((choice) => (choice.adult ? "row" : undefined)),
    columns: () => 4,
    disabled: props.busy,
  });
  const Root = props.embedded ? "div" : "main";
  return (
    <Root
      className={
        props.embedded ? props.embedded.containerClassName : "practice-start"
      }
    >
      <section
        className={`start-card birth-year ${props.embedded?.className ?? ""}`}
      >
        {props.embedded?.header}
        <h1>{props.title ?? `What year was ${props.name} born?`}</h1>
        <p>
          {props.description ??
            "We’ll use the birth year to find a starting point, then adapt as the learner progresses."}
        </p>
        <div className="year-grid" {...listProps} aria-label="Birth year">
          {choices.map((choice, index) => (
            <button
              key={choice.label}
              type="button"
              {...optionProps(index)}
              className={
                choice.adult
                  ? "adult"
                  : choice.year === props.birthYear
                    ? "selected"
                    : ""
              }
            >
              {choice.label}
            </button>
          ))}
        </div>
        {props.embedded?.footer}
        {props.cancel && (
          <button className="text-button" onClick={props.cancel}>
            Cancel
          </button>
        )}
      </section>
    </Root>
  );
}
