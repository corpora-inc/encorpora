import React from "../react.js";
import { Math } from "../product.js";
import type { SiteConfig } from "../config.js";
import { Figure } from "../../../amp/src/web/Figure.js";
import { LessonIllustration } from "../../../amp/src/content/LessonIllustration.js";
import { sampleForLesson, type Resource } from "./catalog.js";
import {
  accessibleFigure,
  Breadcrumbs,
  ResourceHero,
  ResourceLinks,
  LibraryCTA,
  ProblemExample,
} from "./shared.js";

export function LessonPage({
  page,
  config,
}: {
  page: Extract<Resource, { kind: "lesson" }>;
  config: SiteConfig;
}) {
  const { lesson, level } = page;
  return (
    <article className="resource-page lesson-reader">
      <Breadcrumbs
        items={[
          { label: "Free lessons", path: "/lessons/" },
          { label: lesson.title },
        ]}
      />
      <ResourceHero meta={page}>
        <p>
          <Math text={lesson.summary} />
        </p>
      </ResourceHero>
      <div className="article-layout">
        <aside className="article-contents">
          <p className="eyebrow">In this lesson</p>
          <nav aria-label="On this page">
            {lesson.sections.map((section, i) => (
              <a key={i} href={`#section-${i}`}>
                {section.title}
              </a>
            ))}
            <a href="#worked-example">Worked example</a>
            <a href="#try-it">Try a problem</a>
          </nav>
        </aside>
        <div className="article-body">
          <section className="lesson-objectives">
            <h2>What you will learn</h2>
            <ul>
              {lesson.objectives.map((objective, i) => (
                <li key={i}>
                  <Math text={objective} />
                </li>
              ))}
            </ul>
          </section>
          {lesson.sections.map((section, i) => (
            <section className="article-section" id={`section-${i}`} key={i}>
              <h2>{section.title}</h2>
              {section.paragraphs.map((text, j) => (
                <p key={j}>
                  <Math text={text} />
                </p>
              ))}
              {section.illustration && (
                <div className="lesson-illustration">
                  <LessonIllustration kind={section.illustration} print />
                </div>
              )}
            </section>
          ))}
          <section
            className="article-section worked-lesson"
            id="worked-example"
          >
            <p className="eyebrow">Work through the reasoning</p>
            <h2>Worked example</h2>
            <p>
              <Math text={lesson.workedExample.prompt} />
            </p>
            {lesson.workedExample.figure && (
              <Figure
                figure={accessibleFigure(
                  lesson.workedExample.figure,
                  lesson.workedExample.prompt,
                )!}
              />
            )}
            {lesson.workedExample.choices && (
              <ul>
                {lesson.workedExample.choices.map((choice, i) => (
                  <li key={i}>
                    <Math text={choice} />
                  </li>
                ))}
              </ul>
            )}
            <ol>
              {lesson.workedExample.steps.map((step, i) => (
                <li key={i}>
                  <Math text={step} />
                </li>
              ))}
            </ol>
            <p>
              <strong>Answer: </strong>
              <Math text={lesson.workedExample.answer} />
              {lesson.workedExample.answerUnit && (
                <>
                  {" "}
                  <Math text={lesson.workedExample.answerUnit} />
                </>
              )}
            </p>
          </section>
          {lesson.closingSections?.map((section, i) => (
            <section className="article-section" key={i}>
              <h2>{section.title}</h2>
              {section.paragraphs.map((text, j) => (
                <p key={j}>
                  <Math text={text} />
                </p>
              ))}
              {section.illustration && (
                <div className="lesson-illustration">
                  <LessonIllustration kind={section.illustration} print />
                </div>
              )}
            </section>
          ))}
          {lesson.pitfalls.length > 0 && (
            <section className="article-section">
              <h2>What to watch for</h2>
              <ul>
                {lesson.pitfalls.map((text, i) => (
                  <li key={i}>
                    <Math text={text} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="article-section" id="try-it">
            <h2>Put the idea to work.</h2>
            <ProblemExample problem={sampleForLesson(lesson, level)} />
          </section>
        </div>
      </div>
      <section className="resource-section">
        <h2>More {level.label.toLowerCase()} mathematics.</h2>
        <ResourceLinks level={level} />
      </section>
      <LibraryCTA config={config} />
    </article>
  );
}
