import { lazy, Suspense } from "react";
import { AnimationBoundary } from "./lesson-animation/AnimationBoundary";
import { animationModel } from "./lesson-animation/model";
import type { ProblemLessonView } from "../content/problem-lessons";
import { Figure } from "./Figure";
import { MathText, withSeparators } from "./MathText";
import { ScenePlayer } from "./scene/ScenePlayer";
import { dataWalkthrough } from "../math/scene/data-walkthroughs";

const LessonAnimation = lazy(
  () => import("./lesson-animation/LessonAnimation"),
);

/** Build from a plain explanation and example to the general rule. */
export function ProblemLesson({ lesson }: { lesson: ProblemLessonView }) {
  const figure = lesson.example.figure;
  // A scene with a walkthrough plays it, revealed, on the example's numbers.
  // Data displays still travel as legacy kinds; their walkthroughs are
  // built from the example's data.
  const walkthrough =
    figure?.kind === "scene" && figure.scene.steps?.length
      ? figure.scene
      : dataWalkthrough(lesson.templateId, figure);
  const animation = walkthrough ? null : animationModel(lesson);
  return (
    <article className="problem-lesson">
      <p className="lesson-goal">
        <MathText text={lesson.intuition ?? lesson.goal} />
      </p>
      <section className="lesson-example">
        <h3>Example</h3>
        <p className="lesson-example-prompt">
          <MathText text={lesson.example.prompt} />
        </p>
        {lesson.example.choices && (
          <ol type="A" aria-label="Example choices">
            {lesson.example.choices.map((choice) => (
              <li key={choice}>
                <MathText text={choice} />
              </li>
            ))}
          </ol>
        )}
        {animation?.kind === "exchange" && lesson.example.figure && (
          <Figure figure={lesson.example.figure} />
        )}
        {walkthrough ? (
          <ScenePlayer scene={walkthrough} mode="lesson" />
        ) : animation ? (
          <AnimationBoundary
            key={JSON.stringify(animation)}
            fallback={
              animation.kind === "exchange" || !lesson.example.figure ? null : (
                <Figure figure={lesson.example.figure} />
              )
            }
          >
            <Suspense
              fallback={
                <div
                  style={{ height: 460, margin: "12px 0" }}
                  role="status"
                  aria-label="Loading example model"
                />
              }
            >
              <LessonAnimation
                key={JSON.stringify(animation)}
                model={animation}
              />
            </Suspense>
          </AnimationBoundary>
        ) : (
          lesson.example.figure && <Figure figure={lesson.example.figure} />
        )}
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
            <MathText text={withSeparators(lesson.example.answer)} />
          </strong>
        </p>
      </section>
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
      {lesson.watch && (
        <p className="lesson-watch">
          <strong>Watch for</strong>
          <MathText text={lesson.watch} />
        </p>
      )}
      {(lesson.principle || lesson.terms.length > 0) && (
        <section className="lesson-formal">
          <h3>Principle and definitions</h3>
          {lesson.principle && (
            <p className="lesson-principle">
              <MathText text={lesson.principle} />
            </p>
          )}
          {lesson.terms.length > 0 && (
            <dl className="lesson-terms">
              {lesson.terms.map(({ term, meaning }) => (
                <div key={term}>
                  <dt>
                    <MathText text={term} />
                  </dt>
                  <dd>
                    <MathText text={meaning} />
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      )}
    </article>
  );
}
