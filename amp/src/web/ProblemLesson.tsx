import type { ProblemLessonView } from "../content/problem-lessons";
import { Figure } from "./Figure";
import { MathText } from "./MathText";

/** The lesson for one problem type: goal, terms, method, worked example. */
export function ProblemLesson({ lesson }: { lesson: ProblemLessonView }) {
  return (
    <article className="problem-lesson">
      <p className="lesson-goal">
        <MathText text={lesson.goal} />
      </p>
      {lesson.principle && (
        <p className="lesson-principle">
          <strong>Principle</strong>
          <MathText text={lesson.principle} />
        </p>
      )}
      {lesson.terms.length > 0 && (
        <dl className="lesson-terms">
          {lesson.terms.map(({ term, meaning }) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>
                <MathText text={meaning} />
              </dd>
            </div>
          ))}
        </dl>
      )}
      <section>
        <h3>Method</h3>
        <ol className="lesson-method">
          {lesson.method.map((step) => (
            <li key={step}>
              <MathText text={step} />
            </li>
          ))}
        </ol>
      </section>
      <section className="lesson-example">
        <h3>Example</h3>
        <p className="lesson-example-prompt">
          <MathText text={lesson.example.prompt} />
        </p>
        {lesson.example.figure && <Figure figure={lesson.example.figure} />}
        <ol>
          {lesson.example.steps.map((step) => (
            <li key={step}>
              <MathText text={step} />
            </li>
          ))}
        </ol>
        <p className="lesson-example-answer">
          Answer:{" "}
          <strong>
            <MathText text={lesson.example.answer} />
          </strong>
        </p>
      </section>
      {lesson.watch && (
        <p className="lesson-watch">
          <strong>Watch for</strong>
          <MathText text={lesson.watch} />
        </p>
      )}
    </article>
  );
}
