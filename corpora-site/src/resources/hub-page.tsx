import React from "../react.js";
import type { SiteConfig } from "../config.js";
import {
  videoFor,
  videoPath,
  levels,
  comparisons,
  comparisonPath,
  gradePath,
  workbookPath,
  lessonPath,
  lessonsFor,
  workbookFor,
  type Resource,
} from "./catalog.js";
import {
  Breadcrumbs,
  ResourceHero,
  LevelPicker,
  LibraryCTA,
} from "./shared.js";

export function HubPage({
  page,
  config,
}: {
  page: Extract<Resource, { kind: "hub" }>;
  config: SiteConfig;
}) {
  const compare = page.hub === "compare";
  return (
    <article className="resource-page">
      <Breadcrumbs items={[{ label: page.label }]} />
      <ResourceHero meta={page}>
        <p>{page.description}</p>
      </ResourceHero>
      {compare ? (
        <>
          <nav className="level-picker" aria-label="Featured comparisons">
            {comparisons.slice(0, 3).map((c) => (
              <a key={c.slug} href={comparisonPath(c.slug)}>
                AMP vs {c.name}
              </a>
            ))}
          </nav>
          <div className="comparison-directory">
            {comparisons.map((c) => (
              <a href={comparisonPath(c.slug)} key={c.slug}>
                <span className="eyebrow">{c.category}</span>
                <h2>AMP vs {c.name}</h2>
                <p>{c.summary}</p>
                <span className="text-link">Read the comparison ↗</span>
              </a>
            ))}
          </div>
        </>
      ) : (
        <>
          <LevelPicker
            purpose={
              page.hub === "workbooks"
                ? "workbook"
                : page.hub === "grades"
                  ? "grade"
                  : "lesson"
            }
          />
          {page.hub === "workbooks" && (
            <section className="feature-band">
              <h2>Download. Print. Start thinking.</h2>
              <p>
                A new free edition each day, with a blank name line, useful mixed practice and a
                complete worked answer key. Choose Letter or A4. The edition
                date appears beside each download.
              </p>
              <p>
                For work selected from an individual learner’s levels, explore{" "}
                <a href="/personalized-workbooks/">
                  AMP’s unlimited personalized workbooks
                </a>
                .
              </p>
            </section>
          )}
          <div
            className={`level-cards ${page.hub === "grades" ? "grade-directory" : "resource-directory"}`}
          >
            {levels.map((level) => (
              <section id={level.slug} key={level.slug} className="level-card">
                <p className="eyebrow">{level.label}</p>
                <h2>
                  <a href={gradePath(level)}>{level.headline}</a>
                </h2>
                {page.hub === "workbooks" ? (
                  <a href={workbookPath(level)} className="cover-link">
                    <img
                      src={workbookFor(level).preview}
                      alt={`Preview of ${level.label.toLowerCase()} practice`}
                      width="850"
                      height="1100"
                      loading="lazy"
                    />
                  </a>
                ) : (
                  <p>{level.themes.join(" · ")}</p>
                )}
                {["lessons", "resources"].includes(page.hub) && (
                  <a className="video-card" href={videoPath(videoFor(level))}>
                    <img
                      src={videoFor(level).posterUrl}
                      alt={`Watch: ${videoFor(level).title}`}
                      width="1920"
                      height="1080"
                      loading="lazy"
                    />
                    <strong>Watch: {videoFor(level).title} ↗</strong>
                  </a>
                )}
                <div className="level-card-actions">
                  <a href={gradePath(level)}>Explore {level.label} ↗</a>
                  <a href={workbookPath(level)}>Print a free workbook ↗</a>
                  {page.hub !== "grades" &&
                    lessonsFor(level).map((lesson) => (
                      <a href={lessonPath(lesson.id)} key={lesson.id}>
                        Read: {lesson.title} ↗
                      </a>
                    ))}
                </div>
              </section>
            ))}
          </div>
          <section className="resource-section">
            <p className="eyebrow">High school</p>
            <h2>A grade is an entry point. A course follows preparation.</h2>
            <p>
              High-school course order varies. Explore the grade guides to
              choose among Algebra 1, Geometry, Algebra 2 and Precalculus, with{" "}
              <a href="/courses/pre-algebra/">Pre-algebra</a> available for
              strengthening foundations.
            </p>
            <nav className="level-picker" aria-label="High-school grade guides">
              {[9, 10, 11, 12].map((grade) => (
                <a key={grade} href={`/grades/${grade}/`}>
                  Grade {grade}
                </a>
              ))}
            </nav>
          </section>
        </>
      )}
      <LibraryCTA config={config} />
    </article>
  );
}
