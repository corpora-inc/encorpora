import type { ProblemLessonView } from "../content/problem-lessons";
import { Figure } from "./Figure";

/** The lesson for one problem type: goal, terms, method, worked example. */
export function ProblemLesson({ lesson }: { lesson: ProblemLessonView }) {
  return (
    <article className="problem-lesson">
      <p className="lesson-goal">{lesson.goal}</p>
      {lesson.principle && (
        <p className="lesson-principle">
          <strong>Principle</strong>
          {lesson.principle}
        </p>
      )}
      {lesson.terms.length > 0 && (
        <dl className="lesson-terms">
          {lesson.terms.map(({ term, meaning }) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{meaning}</dd>
            </div>
          ))}
        </dl>
      )}
      <section>
        <h3>Method</h3>
        <ol className="lesson-method">
          {lesson.method.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
      <section className="lesson-example">
        <h3>Example</h3>
        <p className="lesson-example-prompt">{lesson.example.prompt}</p>
        {lesson.example.figure && <Figure figure={lesson.example.figure} />}
        <ol>
          {lesson.example.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="lesson-example-answer">
          Answer: <strong>{lesson.example.answer}</strong>
        </p>
      </section>
      {lesson.watch && (
        <p className="lesson-watch">
          <strong>Watch for</strong>
          {lesson.watch}
        </p>
      )}
    </article>
  );
}
