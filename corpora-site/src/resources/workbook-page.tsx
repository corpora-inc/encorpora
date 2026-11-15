import React from "../react.js";
import type { SiteConfig } from "../config.js";
import type { Resource, Workbook } from "./catalog.js";
import {
  Breadcrumbs,
  ResourceHero,
  LevelPicker,
  ResourceLinks,
  LibraryCTA,
  appEntry,
} from "./shared.js";

export function DownloadButtons({ workbook }: { workbook: Workbook }) {
  return (
    <div className="download-options">
      {workbook.files.map((file) => (
        <a
          className="button"
          href={file.url}
          download
          data-resource-action="workbook_download"
          data-resource-level={workbook.grade}
          data-resource-format={file.paper}
          key={file.paper}
        >
          Download {file.paper === "a4" ? "A4" : "US Letter"}
          <span className="download-detail">PDF · {file.pages} pages</span>
        </a>
      ))}
    </div>
  );
}
export function WorkbookPage({
  page,
  config,
}: {
  page: Extract<Resource, { kind: "workbook" }>;
  config: SiteConfig;
}) {
  const { workbook, level } = page;
  const date = new Date(`${workbook.date}T12:00:00Z`).toLocaleDateString(
    "en-US",
    { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" },
  );
  return (
    <article className="resource-page">
      <Breadcrumbs
        items={[
          { label: "Free workbooks", path: "/workbooks/" },
          { label: level.label },
        ]}
      />
      <ResourceHero
        meta={page}
        visual={
          <figure className="paper-preview">
            <img
              src={workbook.preview}
              alt={`${level.label} workbook page showing actual questions and working space`}
              width="850"
              height="1100"
              fetchPriority="high"
            />
            <figcaption>
              Actual page from this edition. The download includes a worked
              answer key.
            </figcaption>
          </figure>
        }
        actions={<DownloadButtons workbook={workbook} />}
      >
        <p>
          Print a thoughtful mix of {level.label.toLowerCase()} mathematics,
          with clear diagrams, room to work and complete worked answers. No
          account or email required.
        </p>
        <p className="edition-date">
          Edition: <time dateTime={workbook.date}>{date}</time> · About 45
          minutes
        </p>
      </ResourceHero>
      <LevelPicker current={level.slug} purpose="workbook" />
      <section className="resource-section split-story">
        <div>
          <p className="eyebrow">Inside this workbook</p>
          <h2>A useful mix, with reasons behind the answers.</h2>
          <p>
            This edition contains {workbook.problems} problems across{" "}
            {workbook.areas.length} mathematical strands. It uses AMP’s own
            problem generators and paper layout, with a blank name line and
            worked solutions.
          </p>
          <p>
            Choose US Letter for 8½ × 11 inch paper, or A4 for 210 × 297 mm.
            Print at actual size. Keep the answer-key pages separate until the
            learner has tried the questions.
          </p>
        </div>
        <ul className="topic-list">
          {workbook.topics.map((topic) => (
            <li key={topic}>{topic}</li>
          ))}
        </ul>
      </section>
      <section className="resource-section split-story">
        <figure className="paper-preview workbook-cover">
          <img
            src={workbook.cover}
            alt={`${level.label} workbook cover with blank name line and edition date`}
            width="850"
            height="1100"
            loading="lazy"
          />
          <figcaption>
            Prepared for paper, from the first page to the worked solutions.
          </figcaption>
        </figure>
        <div>
          <p className="eyebrow">Make the session count</p>
          <h2>Try the reasoning before checking the key.</h2>
          <ol className="reading-steps">
            <li>
              Read each question and use the picture, table or equation to
              identify what is known.
            </li>
            <li>
              Write the calculation or reasoning in the space provided. A sketch
              can make the relationship easier to see.
            </li>
            <li>
              Compare with the worked answer. Discuss a different valid method
              and revisit any uncertain idea.
            </li>
          </ol>
          <DownloadButtons workbook={workbook} />
        </div>
      </section>
      <section className="resource-section feature-band">
        <p className="eyebrow">
          This is one sample. AMP makes the next one for you.
        </p>
        <h2>Infinite fresh workbooks. A personal starting point.</h2>
        <p>
          In AMP, choose a learner or practice profile, the session length and
          the areas to include. Generate a fresh workbook from those levels.
          Record its paper results to inform later practice.
        </p>
        <div className="actions">
          <a className="button" href={appEntry(config)}>
            Make a workbook for my learner ↗
          </a>
          <a href="/personalized-workbooks/">See personalized workbooks</a>
        </div>
        <p className="feature-note">
          Free AMP access includes five personalized workbooks. Paid access
          includes unlimited fresh workbooks.
        </p>
      </section>
      <section className="resource-section">
        <h2>Keep the ideas connected.</h2>
        <ResourceLinks level={level} />
      </section>
      <LibraryCTA config={config} />
    </article>
  );
}
