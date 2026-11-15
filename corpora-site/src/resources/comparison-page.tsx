import React from "../react.js";
import type { SiteConfig } from "../config.js";
import { ProductShot } from "../library/page.js";
import { comparisons, comparisonPath, type Resource } from "./catalog.js";
import { Breadcrumbs, ResourceHero, LibraryCTA, appEntry } from "./shared.js";

// Research records retain complete comparison prose. The table's competitor
// column uses the competitor statement; AMP's maintained offer supplies its own.
const competitorStatement = (text: string) =>
  text.split(/\. AMP\b|; AMP\b| AMP:/)[0]!.replace(/\.$/, "") + ".";
export function ComparisonPage({
  page,
  config,
}: {
  page: Extract<Resource, { kind: "comparison" }>;
  config: SiteConfig;
}) {
  const c = page.comparison;
  const rows = [
    [
      "Teaching approach",
      "Start with a meaningful problem. Hints, concise lessons and worked explanations support the reasoning.",
      competitorStatement(c.approach),
    ],
    [
      "Daily practice",
      "Answers guide mixed practice across areas, with progression, prerequisite work and scheduled review.",
      competitorStatement(c.practice),
    ],
    [
      "Mathematical range",
      "One connected curriculum from counting through precalculus.",
      competitorStatement(c.range),
    ],
  ];
  const nearby = comparisons
    .filter((other) => other.slug !== c.slug)
    .sort(
      (a, b) =>
        Number(b.category === c.category) - Number(a.category === c.category),
    )
    .slice(0, 3);
  return (
    <article className="resource-page comparison-page">
      <Breadcrumbs
        items={[
          { label: "Compare programs", path: "/compare/" },
          { label: `AMP vs ${c.name}` },
        ]}
      />
      <ResourceHero
        meta={page}
        visual={
          <div className="comparison-position">
            <p className="eyebrow">Why choose AMP</p>
            <h2>Built around the next useful problem.</h2>
            <ul>
              <li>Practice selected from the learner’s answers</li>
              <li>Explanations beside the mathematics</li>
              <li>Fresh, personalized workbooks for paper</li>
            </ul>
          </div>
        }
        actions={
          <>
            <a className="button" href={appEntry(config)}>
              Experience AMP free ↗
            </a>
            <a className="text-link" href="#comparison">
              Compare the approaches ↓
            </a>
          </>
        }
      >
        <p>{c.summary}</p>
        <p>{c.ampAngle}</p>
      </ResourceHero>
      <section className="resource-section" id="comparison">
        <p className="eyebrow">The daily experience</p>
        <h2>What changes for the learner?</h2>
        <div
          className="comparison-scroll"
          role="region"
          aria-label={`${c.name} and AMP comparison`}
          tabIndex={0}
        >
          <table className="comparison-table" role="table">
            <caption>
              AMP and {c.name}: teaching, practice and curriculum
            </caption>
            <thead role="rowgroup">
              <tr role="row">
                <th scope="col">Consider</th>
                <th scope="col">AMP</th>
                <th scope="col">{c.name}</th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {rows.map(([heading, amp, other]) => (
                <tr role="row" key={heading}>
                  <th scope="row">{heading}</th>
                  <td role="cell" data-label="AMP">{amp}</td>
                  <td role="cell" data-label={c.name}>{other}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="comparison-source">
          Competitor details checked{" "}
          <time dateTime={c.checkedDate}>{c.checkedDate}</time> against{" "}
          <a href="#sources">official product information</a>.
        </p>
      </section>
      <section className="resource-section split-story">
        <div>
          <p className="eyebrow">A useful test</p>
          <h2>Think about the next week of math.</h2>
          <p className="scenario">{c.scenario}</p>
          <p>
            AMP handles the continuing choice of practice. A learner can make
            progress in a strong area, revisit a weaker foundation and retrieve
            earlier mathematics in the same routine. Help sits beside the
            question, so an explanation can immediately lead to another attempt.
          </p>
          <p>
            <a href="/how-it-works/">See how the practice routine works</a>.
          </p>
        </div>
        <ProductShot name="practice" />
      </section>
      <section className="resource-section comparison-reading">
        <p className="eyebrow">A closer look</p>
        <h2>Where AMP earns its place.</h2>
        {c.paragraphs.map((text, i) => (
          <p key={i}>{text}</p>
        ))}
      </section>
      <section className="resource-section split-story">
        <div>
          <p className="eyebrow">Keep understanding available</p>
          <h2>Mastery, review and discovery belong together.</h2>
          <p>
            A good explanation makes the mathematics visible. Independent
            practice asks the learner to use it. Spaced returns help keep it
            available, and mixed problems require choosing the method as well as
            carrying it out.
          </p>
          <p>
            AMP joins these ideas in a precise practice system. Separate working
            levels let strengths grow while another strand gets attention. The
            parent or tutor can spend more time discussing mathematics and less
            time assembling the next assignment.
          </p>
          <p>
            <a href="/science/">Read the science and implementation</a> ·{" "}
            <a href="/philosophy/spiraling/">Spiraling and mastery</a> ·{" "}
            <a href="/philosophy/guided-discovery/">Guided discovery</a>
          </p>
        </div>
        <ProductShot name="progress" />
      </section>
      <section className="resource-section feature-band">
        <p className="eyebrow">A strong screen-and-paper routine</p>
        <h2>Make the workbook fit the learner.</h2>
        <p>{c.print}</p>
        <p>
          In AMP, choose the learner or a simulated practice profile, the areas
          and the length. Generate fresh problems, print the worked key, and
          record paper results to inform future practice.
        </p>
        <div className="actions">
          <a className="button" href="/workbooks/">
            Print a free workbook ↗
          </a>
          <a href="/personalized-workbooks/">
            Explore unlimited personalized workbooks
          </a>
        </div>
      </section>
      <section className="resource-section article-faq">
        <h2>Questions about AMP and {c.name}</h2>
        {c.questions.map((q) => (
          <details key={q.question}>
            <summary>{q.question}</summary>
            <p>{q.answer}</p>
          </details>
        ))}
      </section>
      <section className="resource-section source-notes" id="sources">
        <h2>Official product sources</h2>
        <ul>
          {c.officialSources.map((source) => (
            <li key={source.url}>
              <a href={source.url}>{source.title} ↗</a>
            </li>
          ))}
        </ul>
      </section>
      <section className="resource-section">
        <h2>Explore another comparison.</h2>
        <div className="resource-links">
          {nearby.map((other) => (
            <a href={comparisonPath(other.slug)} key={other.slug}>
              <span>{other.category}</span>
              <strong>AMP vs {other.name}</strong>
              <span aria-hidden="true">↗</span>
            </a>
          ))}
          <a href="/compare/">
            <span>See the full library</span>
            <strong>All math program comparisons</strong>
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      </section>
      <LibraryCTA config={config} />
    </article>
  );
}
