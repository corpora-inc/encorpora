import { useEffect, useRef, useState } from "react";
import { useAppRoute } from "./app-routes";
import { useLoggedError } from "./feedback";
import type { TemplateMetadata } from "../math/contracts";
import type { ProblemLessonView } from "../content/problem-lessons";
import type { Lesson } from "../content/lessons";
import { ProblemLesson } from "./ProblemLesson";
import { LessonLibrary, type LibrarySkillRow } from "./LessonLibrary";

type Props = {
  templates: readonly TemplateMetadata[];
  skills: readonly LibrarySkillRow[];
  references: readonly Lesson[];
  openReference: (lesson: Lesson, trigger: HTMLElement) => void;
  busy: boolean;
  loadLesson: (templateId: string) => Promise<ProblemLessonView>;
  practice: (templateId: string) => void;
};

/** The lesson library, and one problem type's short lesson (`?topic=`). */
export function LessonIndex(props: Props) {
  const { location, navigate } = useAppRoute();
  const params = new URLSearchParams(location.search);
  const topic = params.get("topic");
  const select = (key: "strand" | "topic", value: string | null) => {
    const next = new URLSearchParams(location.search);
    if (value) next.set(key, value);
    else next.delete(key);
    navigate({ pathname: "/lessons", search: next.toString() });
  };
  const load = useRef(props.loadLesson);
  load.current = props.loadLesson;
  const [open, setOpen] = useState<ProblemLessonView | null>(null);
  const [error, setError] = useState("");
  useLoggedError(error);
  useEffect(() => {
    let current = true;
    setError("");
    if (topic)
      void load
        .current(topic)
        .then((lesson) => {
          if (current) setOpen(lesson);
        })
        .catch(() => {
          if (current)
            setError(
              "The lesson could not be opened. Return to all lessons and try again.",
            );
        });
    return () => {
      current = false;
    };
  }, [topic]);

  if (topic)
    return (
      <section
        className="lesson-sheet"
        aria-label={open?.templateId === topic ? open.title : "Lesson"}
      >
        <div className="lesson-sheet-bar">
          <button className="text-button" onClick={() => select("topic", null)}>
            ← All lessons
          </button>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {open?.templateId !== topic ? (
          <p role="status">Opening lesson…</p>
        ) : (
          <>
            <h2>{open.title}</h2>
            <ProblemLesson lesson={open} />
            <button
              className="lesson-practice"
              disabled={props.busy}
              onClick={() => props.practice(open.templateId)}
            >
              Practice this
            </button>
          </>
        )}
      </section>
    );
  return (
    <LessonLibrary
      templates={props.templates}
      skills={props.skills}
      references={props.references}
      openReference={props.openReference}
      openTopic={(id) => select("topic", id)}
    />
  );
}
