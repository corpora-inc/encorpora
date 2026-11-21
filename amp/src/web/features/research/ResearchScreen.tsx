import { Link } from "@tanstack/react-router";
import {
  report,
  reportCitation,
  reportStatus,
  researchPage as page,
} from "../../../research/report";
import { buttonClass } from "../../ui/Button";
import { ResearchFrame } from "./ResearchFrame";
import styles from "./Research.module.css";

/** `/research`: the research behind AMP in plain words, for parents and
 * schools, with the report itself one tap away. The words live in
 * `src/research/report.ts`, which the static document repeats. The title
 * spans the page; on wide screens the report sits beside the summary, and
 * each section's heading stays in view while its section scrolls. */
export function ResearchScreen() {
  return (
    <ResearchFrame>
      <section className={styles.intro} aria-labelledby="research-title">
        <h1 id="research-title" className={styles.title}>
          {page.title}
        </h1>
        <p className={styles.lede}>{page.lede}</p>
        <ReportCard />
      </section>

      <section className={styles.topic} aria-labelledby="research-idea">
        <h2 id="research-idea">{page.idea.heading}</h2>
        <div className={styles.topicBody}>
          {page.idea.paragraphs.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </div>
      </section>

      <section className={styles.topic} aria-labelledby="research-components">
        <h2 id="research-components">{page.componentsHeading}</h2>
        <div className={styles.topicBody}>
          <ol className={styles.components}>
            {page.components.map((component) => (
              <li key={component.id} id={component.id}>
                <h3>{component.title}</h3>
                <p>{component.what}</p>
                <p className={styles.evidence}>
                  {component.research}{" "}
                  <span className={styles.sources}>({component.sources})</span>
                </p>
              </li>
            ))}
          </ol>
          <p>{page.combined}</p>
        </div>
      </section>

      <section className={styles.topic} aria-labelledby="research-testing">
        <h2 id="research-testing">{page.testing.heading}</h2>
        <div className={styles.topicBody}>
          <p>{page.testing.lead}</p>
          <ol className={styles.phases}>
            {page.testing.phases.map((phase) => (
              <li key={phase.name}>
                <strong>{phase.name}</strong>
                <span className={styles.when}>{phase.when}</span>
                <span>{phase.what}</span>
              </li>
            ))}
          </ol>
          <Link
            to="/research/pilot"
            className={buttonClass("primary", styles.join)}
          >
            Join the pilot list
          </Link>
        </div>
      </section>

      {[page.open, page.essa].map((topic) => (
        <section
          key={topic.heading}
          className={styles.topic}
          aria-label={topic.heading}
        >
          <h2>{topic.heading}</h2>
          <div className={styles.topicBody}>
            {topic.paragraphs.map((text) => (
              <p key={text}>{text}</p>
            ))}
          </div>
        </section>
      ))}

      <section className={styles.topic} aria-labelledby="research-cite">
        <h2 id="research-cite">Cite the report</h2>
        <div className={styles.topicBody}>
          <p className={styles.citation}>{reportCitation()}</p>
          <p>
            Researchers interested in working with us can write to the author at{" "}
            <a href={`mailto:${page.contact}`}>{page.contact}</a>.
          </p>
        </div>
      </section>
    </ResearchFrame>
  );
}

/** The report itself: its first page, what it is, where it stands, and the
 * PDF. */
function ReportCard() {
  return (
    <article className={styles.report} aria-labelledby="research-report">
      <a
        href={report.pdf}
        className={styles.cover}
        tabIndex={-1}
        aria-hidden="true"
      >
        <img
          src={report.cover.src}
          width={report.cover.width}
          height={report.cover.height}
          alt=""
          decoding="async"
        />
      </a>
      <div className={styles.about}>
        <p className={styles.kicker}>{report.series} · ESSA Tier 4 rationale</p>
        <h2 id="research-report" className={styles.reportTitle}>
          {report.title}
        </h2>
        <p className={styles.byline}>
          <a href={report.orcid}>{report.author}</a>, {report.affiliation} ·{" "}
          {report.publishedLabel} · {report.pages} pages
        </p>
        <p className={styles.status} data-report-status="">
          {report.doi ? (
            <a href={`https://doi.org/${report.doi}`}>{reportStatus()}</a>
          ) : (
            reportStatus()
          )}
        </p>
      </div>
      <a
        href={report.pdf}
        className={buttonClass("primary", styles.download)}
        data-report-pdf=""
      >
        Read the report (PDF)
      </a>
      <p className={styles.conflict}>{report.conflict}</p>
    </article>
  );
}
