import { Link } from "@tanstack/react-router";
import { brand } from "../../../brand";
import {
  report,
  reportCitation,
  reportStatus,
  researchPage as page,
} from "../../../research/report";
import { buttonClass } from "../../ui/Button";
import { WaveMark } from "../../ui/NavigationSheet";
import { RootLink } from "../../nav/root";
import { SiteFooter } from "../support/SiteFooter";
import frame from "../schools/PublicFrame.module.css";
import styles from "./Research.module.css";

/** `/research`: the research behind AMP in plain words, for parents and
 * schools, with the report itself one tap away. The words live in
 * `src/research/report.ts`, which the static document repeats. */
export function ResearchScreen() {
  return (
    <div className={frame.page} data-research="">
      <header className={frame.header}>
        <div className={frame.headerRow}>
          <RootLink
            className={frame.brand}
            aria-label={`${brand.name} ${brand.expansion}, home`}
          >
            <WaveMark />
            <span className={frame.wordmark}>{brand.name}</span>
          </RootLink>
          <div className={frame.headerLinks}>
            <Link to="/schools" className={buttonClass("quiet")}>
              For schools
            </Link>
          </div>
        </div>
      </header>
      <main className={styles.main}>
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
                <li key={component.title}>
                  <h3>{component.title}</h3>
                  <p>{component.what}</p>
                  <p className={styles.evidence}>
                    {component.research}{" "}
                    <span className={styles.sources}>
                      ({component.sources})
                    </span>
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
              Researchers interested in working with us can write to the author
              at <a href={`mailto:${page.contact}`}>{page.contact}</a>.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter className={frame.footer}>
        <Link to="/schools">For schools</Link>
        <Link to="/schools/trust">Student data</Link>
        <a href="https://corpora.inc/legal/privacy/">Privacy</a>
        <a href="https://corpora.inc/legal/terms/">Terms</a>
      </SiteFooter>
    </div>
  );
}

/** The report itself: what it is, where it stands, and the PDF. */
function ReportCard() {
  return (
    <article className={styles.card} aria-labelledby="research-report">
      <p className={styles.kicker}>
        {report.series} · ESSA Tier 4 rationale
      </p>
      <h2 id="research-report" className={styles.cardTitle}>
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
