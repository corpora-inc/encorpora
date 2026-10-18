import { useState } from "react";
import { createPortal } from "react-dom";
import type { ProblemLessonView } from "../content/problem-lessons";
import type { TrialProgress } from "../server/trial-progress";
import type { TemplateMetadata } from "../math/contracts";
import { ProblemLesson } from "./ProblemLesson";
import { MathText } from "./MathText";
import { Figure } from "./Figure";
import { gradeName, type FrontierMap } from "./Home";
import { strandNames } from "./BirthYearPrompt";
import "./trial-teaching.css";

export type TrialView = TrialProgress & {
  lesson: ProblemLessonView | null;
  recommendations: {
    templateId: string;
    title: string;
    strand: string;
    reason: string;
  }[];
};
export type TrialCatalog = {
  templates: TemplateMetadata[];
  skills: {
    id: string;
    title?: string;
    gradeBand: string;
    strand: string;
    status?: string;
  }[];
  coverage?: {
    counts: {
      plannedSkills: number;
      implementedSkills: number;
      verifiedSkills: number;
    };
    limitations: string[];
  };
};

export function TrialTeaching(props: {
  progress: TrialView;
  frontier: FrontierMap;
  catalog: TrialCatalog | null;
  busy: boolean;
  begin: () => void;
  signIn: () => void;
  printable: () => Promise<{ examples: ProblemLessonView["example"][] }>;
}) {
  const { progress, catalog } = props;
  const [printExamples, setPrintExamples] = useState<
    ProblemLessonView["example"][]
  >([]);
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState("");
  const lesson = progress.lesson;
  if (!lesson) return null;
  const complete = progress.phase === "complete";
  const count = catalog?.coverage?.counts;
  const available = new Set(catalog?.templates.map((t) => t.skillId));
  const availableStrands = [
    ...new Set(
      catalog?.skills
        .filter((skill) => available.has(skill.id))
        .map((skill) => skill.strand),
    ),
  ];
  const recommended = progress.recommendations
    .filter((choice) => choice.templateId !== progress.templateId)
    .slice(0, 2);
  const focusSkill = catalog?.skills.find(
    (skill) =>
      skill.id ===
      catalog.templates.find((template) => template.id === progress.templateId)
        ?.skillId,
  );
  const previewStrands = [
    ...new Set([
      ...(focusSkill ? [focusSkill.strand] : []),
      ...recommended.map((choice) => choice.strand),
    ]),
  ].map((strand) => ({ strand, evidence: props.frontier.strands[strand] }));
  const strandName = (strand: string) => strandNames[strand] ?? strand;
  const independentAfter = progress.after.answered - progress.after.assisted;
  return (
    <>
      <section
        className="trial-teaching"
        aria-labelledby="trial-teaching-title"
      >
        <p className="trial-step">
          {complete ? "Teaching result" : "Try a short lesson"}
        </p>
        <h2 id="trial-teaching-title">{lesson.title}</h2>
        {!complete && (
          <p>
            {progress.before.answered === 0
              ? "Study this topic near the placement estimate, then try four new problems."
              : progress.before.correct < progress.before.answered
                ? "A placement answer on this topic needs another look. Study the method, then try four new problems."
                : "Build on this topic from placement: study the method, then try four new problems."}
          </p>
        )}
        {complete ? (
          <>
            <dl className="trial-scores">
              <div>
                <dt>Before · independent answers</dt>
                <dd>
                  {progress.before.answered
                    ? `${progress.before.correct} of ${progress.before.answered} correct`
                    : "No independent answer recorded for this topic"}
                </dd>
              </div>
              <div>
                <dt>After · independent answers</dt>
                <dd>
                  {independentAfter
                    ? `${progress.after.independentCorrect} of ${independentAfter} correct`
                    : "All four answers used support"}
                </dd>
              </div>
            </dl>
            <p className="trial-note">
              {progress.after.assisted
                ? `With a hint or lesson: ${progress.after.correct - progress.after.independentCorrect} of ${progress.after.assisted} correct. `
                : "All four practice answers were independent. "}
              Different questions from the same topic give a first comparison;
              more practice is needed to check retention.
            </p>
            <details>
              <summary>Review the lesson</summary>
              <ProblemLesson lesson={lesson} />
            </details>
          </>
        ) : (
          <>
            <button
              className="go-button"
              disabled={props.busy}
              onClick={props.begin}
            >
              {progress.phase === "teaching"
                ? "Continue focused practice"
                : "Try four problems"}
            </button>
            <ProblemLesson lesson={lesson} />
          </>
        )}
        <button
          className="secondary"
          disabled={printing}
          onClick={async () => {
            setPrinting(true);
            setPrintError("");
            try {
              const data = await props.printable();
              setPrintExamples(data.examples);
              await document.fonts.ready;
              // React must commit the printable before the browser takes its snapshot.
              await new Promise<void>((resolve) =>
                requestAnimationFrame(() =>
                  requestAnimationFrame(() => resolve()),
                ),
              );
              window.print();
            } catch {
              setPrintError("The printable could not open. Try again.");
            } finally {
              setPrinting(false);
            }
          }}
        >
          Print lesson and worked examples
        </button>
        {printError && <p role="alert">{printError}</p>}
      </section>
      {complete && (
        <>
          <section
            className="trial-teaching"
            aria-labelledby="trial-plan-title"
          >
            <h2 id="trial-plan-title">Next practice sessions</h2>
            <ol className="trial-plan">
              <li>
                <strong>{lesson.title}.</strong>{" "}
                {progress.after.correct < progress.after.answered
                  ? `Review the worked examples for this method: ${progress.after.answered - progress.after.correct} of the four practice questions were missed.`
                  : "Return to fresh questions in a later session to check retention."}
              </li>
              {recommended.length === 0 && (
                <li>
                  <strong>Check recall later.</strong> Return to{" "}
                  {lesson.title.toLowerCase()} in another session and try the
                  method before opening the worked example.
                </li>
              )}
              {recommended.map((choice) => (
                <li key={choice.templateId}>
                  <strong>{choice.title}.</strong>{" "}
                  {
                    {
                      review: "Review a skill due for another check.",
                      revisit: "Revisit a topic that needs more practice.",
                      prerequisite:
                        "Strengthen an earlier skill that supports this work.",
                      frontier:
                        "Try a question near the current level estimate.",
                      explore:
                        "Gather more evidence near the current level estimate.",
                    }[choice.reason]
                  }
                </li>
              ))}
            </ol>
            <p className="trial-note">
              A starting plan for the coming week. Mixed practice adjusts the
              next question after each answer.
            </p>
          </section>
          <section
            className="trial-teaching"
            aria-labelledby="trial-parent-title"
          >
            <h2 id="trial-parent-title">Parent progress preview</h2>
            <p>
              Across this trial: {progress.totals.independent} independent
              answers and {progress.totals.assisted} answers with support.
            </p>
            <dl className="trial-evidence">
              {previewStrands.map(({ strand, evidence }) => (
                <div key={strand}>
                  <dt>{strandName(strand)}</dt>
                  <dd>
                    {evidence?.answered
                      ? `${gradeName(evidence.level)} estimate · ${evidence.answered} answers, ${evidence.independent} correct without support`
                      : "Not yet sampled"}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
          <section
            className="trial-teaching"
            aria-labelledby="trial-coverage-title"
          >
            <h2 id="trial-coverage-title">What you can practice</h2>
            <p>
              {catalog?.templates.length ?? 0} problem types, each with a short
              lesson. Available topics include{" "}
              {availableStrands.map(strandName).join(", ")}.
            </p>
            <p>
              Coverage is selective within each grade and topic. Browse the list
              below to see exactly which problems are available.
            </p>
            <details>
              <summary>Browse available problem types</summary>
              <ul className="trial-coverage-list">
                {catalog?.templates.map((t) => (
                  <li key={t.id}>{t.title}</li>
                ))}
              </ul>
            </details>
            {count && (
              <details>
                <summary>How coverage is checked</summary>
                <p>
                  The curriculum audit distinguishes {count.implementedSkills}{" "}
                  implemented skills, {count.verifiedSkills} verified skills and{" "}
                  {count.plannedSkills} planned skills. The list above shows
                  available problem types; a problem type may cover only part of
                  a skill or standard.
                </p>
              </details>
            )}
          </section>
          <section className="paywall">
            <h2>Continue with AMP</h2>
            <p>
              Adaptive mixed practice, short lessons and printable materials.
              Create a parent account to save these answers and see the
              available payment options.
            </p>
            <button className="go-button" onClick={props.signIn}>
              Create a parent account
            </button>
            <p className="paywall-note">
              An account does not start a paid subscription.
            </p>
          </section>
        </>
      )}
      {printExamples.length > 0 &&
        createPortal(
          <main className="trial-print-sheet">
            <header>
              <p>AMP Mathematics · Printable lesson</p>
              <h1>{lesson.title}</h1>
            </header>
            <ProblemLesson lesson={lesson} />
            <section className="trial-print-examples">
              <h2>Worked practice</h2>
              {printExamples.map((example, i) => (
                <article key={i}>
                  <h3>Example {i + 1}</h3>
                  <p>
                    <MathText text={example.prompt} />
                  </p>
                  {example.figure && <Figure figure={example.figure} />}
                  <ol>
                    {example.steps.map((step, j) => (
                      <li key={j}>
                        <MathText text={step} />
                      </li>
                    ))}
                  </ol>
                  <p>
                    Answer: <MathText text={example.answer} />
                  </p>
                </article>
              ))}
            </section>
          </main>,
          document.body,
        )}
    </>
  );
}
