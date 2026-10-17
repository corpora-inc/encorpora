import { useMemo, useState } from "react";
import type { TemplateMetadata } from "../math/contracts";
import type { ProblemLessonView } from "../content/problem-lessons";
import { gradeOrder, strandNames } from "./BirthYearPrompt";
import { ProblemLesson } from "./ProblemLesson";

type Props = {
  templates: readonly TemplateMetadata[];
  skills: readonly { id: string; gradeBand: string; strand: string }[];
  busy: boolean;
  loadLesson: (templateId: string) => Promise<ProblemLessonView>;
  practice: (templateId: string) => void;
};

/** Every problem type, grouped by strand, each with its own short lesson. */
export function LessonIndex(props: Props) {
  const [strand, setStrand] = useState<string>("number");
  const [open, setOpen] = useState<ProblemLessonView | null>(null);
  const [error, setError] = useState("");
  const groups = useMemo(() => {
    const skills = new Map(props.skills.map((skill) => [skill.id, skill]));
    const byStrand = new Map<
      string,
      { template: TemplateMetadata; rank: number }[]
    >();
    for (const template of props.templates) {
      const skill = skills.get(template.skillId);
      const key = skill?.strand ?? "number";
      const list = byStrand.get(key) ?? [];
      list.push({ template, rank: gradeOrder.indexOf(skill?.gradeBand ?? "") });
      byStrand.set(key, list);
    }
    return Object.keys(strandNames)
      .filter((key) => byStrand.has(key))
      .map((key) => ({
        key,
        topics: byStrand
          .get(key)!
          .sort(
            (a, b) =>
              a.rank - b.rank ||
              a.template.title.localeCompare(b.template.title),
          )
          .map((entry) => entry.template),
      }));
  }, [props.templates, props.skills]);

  if (open)
    return (
      <section className="lesson-sheet" aria-label={open.title}>
        <div className="lesson-sheet-bar">
          <button className="text-button" onClick={() => setOpen(null)}>
            ← All lessons
          </button>
        </div>
        <h2>{open.title}</h2>
        <ProblemLesson lesson={open} />
        <button
          className="lesson-practice"
          disabled={props.busy}
          onClick={() => props.practice(open.templateId)}
        >
          Practice this
        </button>
      </section>
    );
  return (
    <section className="lesson-index" aria-label="Lessons by problem type">
      <div className="strand-row" role="tablist">
        {groups.map((group) => (
          <button
            key={group.key}
            role="tab"
            aria-selected={group.key === strand}
            data-strand={group.key}
            className="strand-chip"
            onClick={() => setStrand(group.key)}
          >
            {strandNames[group.key]}
          </button>
        ))}
      </div>
      {groups.map((group) => (
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
                onClick={async () => {
                  setError("");
                  try {
                    setOpen(await props.loadLesson(template.id));
                  } catch (failure) {
                    console.error("Lesson failed to load", failure);
                    setError("The lesson could not be opened. Try again.");
                  }
                }}
              >
                {template.title}
              </button>
            </li>
          ))}
        </ul>
      ))}
      {error && (
        <p className="workspace-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
