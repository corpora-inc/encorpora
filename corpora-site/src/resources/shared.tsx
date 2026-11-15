import React from "../react.js";
import type { ReactNode } from "react";
import { Math } from "../product.js";
import { PrintExerciseBody } from "../../../amp/src/content/print-exercise.js";
import { answerText } from "../../../amp/src/math/selection-response.js";
import type { GeneratedProblem } from "../../../amp/src/math/contracts.js";
import type { SiteConfig } from "../config.js";
import {
  videoFor,
  videoPath,
  gradePath,
  workbookPath,
  lessonPath,
  lessonsFor,
  levels,
  type ResourceMeta,
} from "./catalog.js";
import type { Level } from "./levels.js";
import { describeScene } from "../../../amp/src/math/scene/index.js";
import { isPorted, legacyScene } from "../../../amp/src/math/scene/legacy.js";
import type { SemanticFigure } from "../../../amp/src/math/contracts.js";

/** Bare scene primitives need the question's givens as their accessible label. */
export function accessibleFigure(
  figure: SemanticFigure | undefined,
  prompt: string,
): SemanticFigure | undefined {
  if (!figure) return figure;
  const scene =
    figure.kind === "scene"
      ? figure.scene
      : isPorted(figure)
        ? legacyScene(figure)
        : undefined;
  return scene && !describeScene(scene).trim()
    ? { kind: "scene", scene: { ...scene, title: prompt } }
    : figure;
}

export const appEntry = (config: SiteConfig) => config.appUrl ?? "/try/";
export function Breadcrumbs({
  items,
}: {
  items: { label: string; path?: string }[];
}) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <a href="/">Home</a>
      {items.map((item, i) => (
        <React.Fragment key={i}>
          <span aria-hidden="true">/</span>
          {item.path ? (
            <a href={item.path}>{item.label}</a>
          ) : (
            <span>{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
export function ResourceHero({
  meta,
  children,
  visual,
  actions,
}: {
  meta: ResourceMeta;
  children: ReactNode;
  visual?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className={`resource-hero ${visual ? "with-visual" : ""}`}>
      <div>
        <p className="eyebrow">{meta.label}</p>
        <h1>{meta.title}</h1>
        <div className="article-deck">{children}</div>
        {actions && <div className="actions">{actions}</div>}
      </div>
      {visual && <div className="resource-hero-visual">{visual}</div>}
    </header>
  );
}
export function ProblemExample({
  problem,
}: {
  problem: GeneratedProblem & { title?: string };
}) {
  problem = {
    ...problem,
    public: {
      ...problem.public,
      figure: accessibleFigure(problem.public.figure, problem.public.prompt),
    },
  };
  return (
    <article className="problem public-problem">
      <p className="problem-label">
        {problem.title ?? "Try a real AMP problem"}
      </p>
      <PrintExerciseBody
        number={1}
        numberLabel={<></>}
        problem={problem}
        solutions={false}
        workspace={<></>}
      />
      <details className="solution">
        <summary>
          See the reasoning <span aria-hidden="true">↗</span>
        </summary>
        <div className="solution-body">
          <ol>
            {problem.explanation.map((step, i) => (
              <li key={i}>
                <Math text={step} />
              </li>
            ))}
          </ol>
          <p>
            <strong>Answer: </strong>
            <Math text={answerText(problem.public.response, problem.answer)} />
          </p>
        </div>
      </details>
    </article>
  );
}
export function LevelPicker({
  current,
  purpose = "grade",
}: {
  current?: string;
  purpose?: "grade" | "workbook" | "lesson";
}) {
  return (
    <nav className="level-picker" aria-label="Choose a math level">
      {levels.map((level) => (
        <a
          href={
            purpose === "workbook"
              ? workbookPath(level)
              : purpose === "lesson"
                ? `/lessons/#${level.slug}`
                : gradePath(level)
          }
          aria-current={current === level.slug ? "page" : undefined}
          key={level.slug}
        >
          {level.label}
        </a>
      ))}
    </nav>
  );
}
export function ResourceLinks({ level }: { level: Level }) {
  return (
    <div className="resource-links">
      <a href={videoPath(videoFor(level))}>
        <span>Watch a video lesson</span>
        <strong>{videoFor(level).title}</strong>
        <span aria-hidden="true">↗</span>
      </a>
      <a href={gradePath(level)}>
        <span>Explore the curriculum</span>
        <strong>{level.label} mathematics</strong>
        <span aria-hidden="true">↗</span>
      </a>
      <a href={workbookPath(level)}>
        <span>Print and work on paper</span>
        <strong>Free workbook + answer key</strong>
        <span aria-hidden="true">↗</span>
      </a>
      {lessonsFor(level).map((lesson) => (
        <a href={lessonPath(lesson.id)} key={lesson.id}>
          <span>Read a lesson</span>
          <strong>{lesson.title}</strong>
          <span aria-hidden="true">↗</span>
        </a>
      ))}
    </div>
  );
}
export function LibraryCTA({
  config,
  title = "Let the next problem fit the learner.",
  text = "AMP brings adaptive mixed practice, clear explanations and unlimited personalized workbooks into one mathematics curriculum.",
}: {
  config: SiteConfig;
  title?: string;
  text?: string;
}) {
  return (
    <section className="library-cta">
      <div>
        <p className="eyebrow">Adaptive Math Pathways</p>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
      <a className="button" href={appEntry(config)}>
        Try AMP free <span aria-hidden="true">↗</span>
      </a>
    </section>
  );
}
