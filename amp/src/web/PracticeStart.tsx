import { useMemo, useState } from "react";
import type { TemplateMetadata } from "../math/contracts";

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
const gradeOrder = [
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
  templates: readonly TemplateMetadata[];
  skills: readonly { id: string; gradeBand: string; strand: string }[];
  busy: boolean;
  saveBirthYear: (year: number) => void;
  start: (templateId?: string) => void;
};

export function PracticeStart(props: Props) {
  const thisYear = new Date().getFullYear();
  const [changing, setChanging] = useState(false);
  const [strand, setStrand] = useState<string | null>(null);
  const topics = useMemo(() => {
    const skills = new Map(props.skills.map((skill) => [skill.id, skill]));
    const groups = new Map<
      string,
      { template: TemplateMetadata; rank: number }[]
    >();
    for (const template of props.templates) {
      const skill = skills.get(template.skillId);
      const key = skill?.strand ?? "number";
      const list = groups.get(key) ?? [];
      list.push({ template, rank: gradeOrder.indexOf(skill?.gradeBand ?? "") });
      groups.set(key, list);
    }
    return Object.keys(strandNames)
      .filter((key) => groups.has(key))
      .map((key) => ({
        key,
        topics: groups
          .get(key)!
          .sort(
            (a, b) =>
              a.rank - b.rank ||
              a.template.title.localeCompare(b.template.title),
          )
          .map((entry) => entry.template),
      }));
  }, [props.templates, props.skills]);

  if (props.birthYear === null || changing) {
    const years = Array.from({ length: 16 }, (_, i) => thisYear - 4 - i);
    return (
      <main className="practice-start">
        <section className="start-card birth-year">
          <h1>What year was {props.name} born?</h1>
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
                onClick={() => {
                  setChanging(false);
                  props.saveBirthYear(year);
                }}
              >
                {year}
              </button>
            ))}
            <button
              className="adult"
              disabled={props.busy}
              onClick={() => {
                setChanging(false);
                props.saveBirthYear(thisYear - 25);
              }}
            >
              Adult
            </button>
          </div>
          {changing && (
            <button className="text-button" onClick={() => setChanging(false)}>
              Cancel
            </button>
          )}
        </section>
      </main>
    );
  }
  return (
    <main className="practice-start">
      <section className="start-card">
        <button
          className="start-practice"
          disabled={props.busy}
          onClick={() => props.start()}
        >
          Start practice <span aria-hidden="true">→</span>
        </button>
        <p className="start-note">
          Mixed problems at {props.name}’s level in every area.{" "}
          <button
            className="text-button inline"
            onClick={() => setChanging(true)}
          >
            Born{" "}
            {props.birthYear >= thisYear - 20 ? props.birthYear : "earlier"} ·
            change
          </button>
        </p>
      </section>
      <section className="topic-browser" aria-label="Practice one topic">
        <h2>Or practice one topic</h2>
        <div className="strand-row" role="tablist">
          {topics.map((group) => (
            <button
              key={group.key}
              role="tab"
              aria-selected={group.key === strand}
              data-strand={group.key}
              className="strand-chip"
              onClick={() => setStrand(group.key === strand ? null : group.key)}
            >
              {strandNames[group.key]}
            </button>
          ))}
        </div>
        {topics.map((group) => (
          <ul
            key={group.key}
            className="topic-list"
            data-strand={group.key}
            role="tabpanel"
            hidden={group.key !== strand}
          >
            {group.topics.map((template) => (
              <li key={template.id}>
                <button
                  data-template={template.id}
                  disabled={props.busy}
                  onClick={() => props.start(template.id)}
                >
                  {template.title}
                </button>
              </li>
            ))}
          </ul>
        ))}
      </section>
    </main>
  );
}
