import { lazy, Suspense, useEffect } from "react";
import type { HelpSource } from "../schools/help-contracts";
import { noteHelp } from "./lib/help-events";
import { useHelpSurface } from "./lib/use-help";
import { AnimationBoundary } from "./lesson-animation/AnimationBoundary";
import { animationModel } from "./lesson-animation/model";
import type { ProblemLessonView } from "../content/problem-lessons";
import { examplePartsTexts, type ExampleParts } from "../content/example-parts";
import { Figure } from "./Figure";
import { MathText, withSeparators } from "./MathText";
import { ScenePlayer } from "./scene/ScenePlayer";
import { dataWalkthrough } from "../math/scene/data-walkthroughs";
import { LessonVideo } from "./LessonVideo";
import { GlossaryBlock, GlossaryProvider } from "./ui/Glossary";
import { KeyWords } from "./ui/KeyWords";
import { FilmLink } from "./features/films/FilmLink";

const LessonAnimation = lazy(
  () => import("./lesson-animation/LessonAnimation"),
);

/** The texts of each glossary block the lesson renders, in page order. A
 * block links the first use of each term among its texts, and the lesson's
 * lexicon must name every form they contain (tests/glossary-rendered). */
export function lessonGlossaryBlocks(lesson: ProblemLessonView) {
  return {
    opening: [lesson.intuition ?? lesson.goal],
    // The worked example is one block, read top to bottom: its question,
    // choices or sentence and blanks, steps and answer.
    example: [
      lesson.example.prompt,
      ...(lesson.example.choices ?? []),
      ...examplePartsTexts(lesson.example.parts),
      ...lesson.example.steps,
      withSeparators(lesson.example.answer),
    ],
    method: lesson.method,
    watch: lesson.watch ? [lesson.watch] : [],
    formal: [
      ...(lesson.principle ? [lesson.principle] : []),
      ...lesson.terms.map((t) => t.meaning),
    ],
  };
}

/** A read-only numbered box standing for one blank. */
function Blank({ n }: { n: number }) {
  return (
    <span className="lesson-blank" role="img" aria-label={`blank ${n}`}>
      {n}
    </span>
  );
}

function OptionList({ options }: { options: readonly string[] }) {
  return (
    <span className="lesson-example-options">
      {options.map((option, i) => (
        <span key={`${i}:${option}`}>
          {i > 0 && <span aria-hidden="true"> · </span>}
          <MathText text={option} />
        </span>
      ))}
    </span>
  );
}

/** A multi-part example's sentence with numbered blanks, then what each
 * blank asks for and what it offers. Nothing here is a control. */
function ExamplePartsView({ parts }: { parts: ExampleParts }) {
  return (
    <div className="lesson-example-parts">
      {parts.sentence && (
        <p className="lesson-example-sentence">
          {parts.sentence.map((part, i) =>
            "text" in part ? (
              <MathText key={i} text={part.text} />
            ) : (
              <Blank key={i} n={part.blank} />
            ),
          )}
        </p>
      )}
      <ul className="lesson-example-blanks" aria-label="Example blanks">
        {parts.blanks.map((blank, i) => (
          <li key={i}>
            <Blank n={i + 1} />
            <span>
              <MathText text={blank.label} />
              {blank.options && <OptionList options={blank.options} />}
            </span>
          </li>
        ))}
      </ul>
      {parts.options && (
        <p className="lesson-example-shared">
          <span className="lesson-example-shared-label">Choices</span>
          <OptionList options={parts.options} />
        </p>
      )}
    </div>
  );
}

/** Build from a plain explanation and example to the general rule. */
/** Where a lesson was opened, recorded with it (`help-events.ts`). */
export type LessonHelp = { source: HelpSource; problemId?: string };
export function ProblemLesson({
  lesson,
  onWatchFilm,
  help,
  film = true,
}: {
  lesson: ProblemLessonView;
  onWatchFilm?: () => void;
  /** Offer its film at its top; false where the page offers it already
   * (Pathways' lesson layer, beside Try). */
  film?: boolean;
  /** Records the lesson as opened, and its time as lesson time. */
  help?: LessonHelp;
}) {
  useEffect(() => {
    if (help)
      noteHelp({
        kind: "lesson",
        source: help.source,
        ref: lesson.templateId,
        problemId: help.problemId,
      });
  }, [lesson.templateId, help?.source, help?.problemId]);
  useHelpSurface(!!help, "lesson", help?.problemId);
  const figure = lesson.example.figure;
  // A scene with a walkthrough plays it, revealed, on the example's numbers.
  // Data displays still travel as legacy kinds; their walkthroughs are
  // built from the example's data.
  const walkthrough =
    figure?.kind === "scene" && figure.scene.steps?.length
      ? figure.scene
      : dataWalkthrough(lesson.templateId, figure);
  const animation = walkthrough ? null : animationModel(lesson);
  const blocks = lessonGlossaryBlocks(lesson);
  const opening = blocks.opening[0]!;
  const answer = blocks.example.at(-1)!;
  return (
    <GlossaryProvider payload={lesson}>
      <article className="problem-lesson">
        {film && lesson.film && (
          <FilmLink
            templateId={lesson.templateId}
            film={lesson.film}
            onOpen={onWatchFilm}
            problemId={help?.problemId}
          />
        )}
        <KeyWords key={lesson.templateId} ids={lesson.keyWords ?? []} />
        <GlossaryBlock texts={blocks.opening}>
          <p className="lesson-goal">
            <MathText text={opening} />
          </p>
        </GlossaryBlock>
        {lesson.video && (
          <LessonVideo
            key={`${lesson.video.id}:${lesson.video.version}`}
            video={lesson.video}
            templateId={lesson.templateId}
            help={help}
          />
        )}
        <section className="lesson-example" data-template={lesson.templateId}>
          <h3>Example</h3>
          <GlossaryBlock texts={blocks.example}>
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
            {lesson.example.parts && (
              <ExamplePartsView parts={lesson.example.parts} />
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
                  animation.kind === "exchange" ||
                  !lesson.example.figure ? null : (
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
              {lesson.example.steps.map((step, index) => (
                <li key={`${index}:${step}`}>
                  <MathText text={step} />
                </li>
              ))}
            </ol>
            <p className="lesson-example-answer">
              Answer:{" "}
              <strong>
                <MathText text={answer} />
              </strong>
            </p>
          </GlossaryBlock>
        </section>
        <section>
          <h3>Method</h3>
          <GlossaryBlock texts={blocks.method}>
            <ol className="lesson-method">
              {lesson.method.map((step, index) => (
                <li key={`${index}:${step}`}>
                  <MathText text={step} />
                </li>
              ))}
            </ol>
          </GlossaryBlock>
        </section>
        {lesson.watch && (
          <GlossaryBlock texts={blocks.watch}>
            <p className="lesson-watch">
              <strong>Watch for</strong>
              <MathText text={lesson.watch} />
            </p>
          </GlossaryBlock>
        )}
        {(lesson.principle || lesson.terms.length > 0) && (
          <GlossaryBlock texts={blocks.formal}>
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
          </GlossaryBlock>
        )}
      </article>
    </GlossaryProvider>
  );
}
