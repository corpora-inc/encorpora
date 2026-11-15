import { FeaturedVideo } from "./video-page.js";
import React from "../react.js";
import type { SiteConfig } from "../config.js";
import { ProductShot } from "../library/page.js";
import { areas, areaOf } from "../../../amp/src/curriculum/areas.js";
import {
  gradePath,
  levels,
  sampleFor,
  skillsFor,
  standardsFor,
  workbookPath,
  type Resource,
} from "./catalog.js";
import {
  appEntry,
  Breadcrumbs,
  LibraryCTA,
  LevelPicker,
  ProblemExample,
  ResourceHero,
  ResourceLinks,
} from "./shared.js";

export function GradePage({
  page,
  config,
}: {
  page: Extract<Resource, { kind: "grade" }>;
  config: SiteConfig;
}) {
  const { level, schoolGrade } = page;
  const prealgebra = page.path === "/courses/pre-algebra/";
  const introduction = schoolGrade
    ? `Grade ${schoolGrade} can include different mathematics courses depending on the learner's previous work. AMP gives each area its own starting level, so the course choice follows understanding. Explore the pathways below and try a real ${level.label.toLowerCase()} example.`
    : prealgebra
      ? "Pre-algebra brings arithmetic into a connected system: rational numbers, ratios, percentages, expressions and equations. AMP helps learners use those ideas flexibly while building the foundations for algebra."
      : level.introduction;
  return (
    <article className="resource-page">
      <Breadcrumbs
        items={[
          { label: "Math by grade", path: "/grades/" },
          { label: page.label },
        ]}
      />
      <ResourceHero
        meta={page}
        visual={<ProblemExample problem={sampleFor(level)} />}
        actions={
          <>
            <a className="button" href={appEntry(config)}>
              Try this level in AMP <span aria-hidden="true">↗</span>
            </a>
            <a className="text-link" href={workbookPath(level)}>
              Get a free workbook ↓
            </a>
          </>
        }
      >
        <p>{introduction}</p>
      </ResourceHero>
      <LevelPicker current={schoolGrade ? undefined : level.slug} />
      {schoolGrade && (
        <section className="resource-section">
          <p className="eyebrow">A course follows preparation</p>
          <h2>Choose the mathematics that comes next.</h2>
          <p className="section-deck">
            Algebra, geometry and functions build on one another. Use the course
            descriptions and examples to find a useful entry point; AMP’s
            continuing practice refines the path.
          </p>
          <div className="level-cards">
            {levels.slice(9).map((course) => (
              <a href={gradePath(course)} key={course.slug}>
                <span className="eyebrow">{course.label}</span>
                <h3>{course.headline}</h3>
                <p>{course.themes.join(" · ")}</p>
                <span className="text-link">Explore the course ↗</span>
              </a>
            ))}
          </div>
        </section>
      )}
      <section className="resource-section split-story">
        <div>
          <p className="eyebrow">The mathematical connection</p>
          <h2>
            {schoolGrade
              ? `${level.label} in focus.`
              : prealgebra
                ? "Give each new symbol a meaning."
                : "Understand how the ideas fit."}
          </h2>
          <p>{level.connection}</p>
          <p>{level.teaching}</p>
        </div>
        <div className="theme-list">
          {level.themes.map((theme, i) => (
            <div key={theme}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <h3>{theme}</h3>
            </div>
          ))}
        </div>
      </section>
      <FeaturedVideo level={level} />
      <section className="resource-section">
        <p className="eyebrow">From the AMP curriculum</p>
        <h2>Explore the skills.</h2>
        <div className="curriculum-areas">
          {areas.map((area) => {
            const list = skillsFor(level).filter(
              (skill) => areaOf(skill) === area.id,
            );
            return list.length ? (
              <details key={area.id}>
                <summary>
                  {area.title}
                  <span>{list.length} skills</span>
                </summary>
                <ul>
                  {list.map((skill) => (
                    <li key={skill.id}>
                      <a href={`https://amp.corpora.inc/pathways/${skill.id}`}>
                        {skill.title}
                      </a>
                      <p>{skill.description}</p>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null;
          })}
        </div>
        <details className="standards-list">
          <summary>Standards and curriculum connections</summary>
          <p>
            These standards are linked to skills in AMP’s curriculum catalog.
            Open a skill above to explore its mathematical connections and
            practice.
          </p>
          <ul>
            {standardsFor(level).map((standard) => (
              <li key={standard.id}>
                <a href={standard.sourceUrl}>{standard.id}</a>
                <span>{standard.description}</span>
              </li>
            ))}
          </ul>
        </details>
      </section>
      <section className="resource-section split-story">
        <div>
          <p className="eyebrow">A path for this learner</p>
          <h2>Keep strengths moving. Build the foundations.</h2>
          <p>
            A grade is a starting point. AMP can move ahead in one area and
            return to an earlier idea in another. Independent answers, hints and
            review help the system choose the next useful work.
          </p>
          <p>
            <a href="/philosophy/adaptive-learning/">
              Explore adaptive learning
            </a>{" "}
            or see how <a href="/philosophy/mastery/">mastery</a> and{" "}
            <a href="/philosophy/spiraling/">spiral review</a> work together.
          </p>
        </div>
        <ProductShot name="progress" />
      </section>
      <section className="resource-section">
        <p className="eyebrow">Start with real mathematics</p>
        <h2>Read it. Print it. Try it.</h2>
        <ResourceLinks level={level} />
      </section>
      <section className="resource-section compact-callout">
        <h2>Make the whole routine work.</h2>
        <p>
          Explore <a href="/personalized-workbooks/">personalized workbooks</a>,{" "}
          <a href="/compare/">compare math programs</a>, or see{" "}
          <a href="/esa/">education-fund purchase routes</a>. Families, tutors
          and independent learners use the same connected curriculum.
        </p>
      </section>
      <LibraryCTA config={config} />
    </article>
  );
}
