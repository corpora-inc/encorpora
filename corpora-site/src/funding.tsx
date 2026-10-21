import { StateIdentity, stateNames } from "./state-identity.js";
import React from "./react.js";
import type { SiteConfig } from "./config.js";

export type FundingRoute = SiteConfig["funding"][number];
export const fundingLabels: Record<FundingRoute["kind"], string> = {
  marketplace: "Marketplace or direct payment",
  reimbursement: "Reimbursement",
  "tax-benefit": "Tax credit or deduction",
  "school-purchase": "School or provider purchase",
  information: "Program information",
};
export const fundingPath = (slug: string) => `/esa/${slug}/`;
export function fundingForPath(route: string, config: SiteConfig) {
  return config.funding.find(
    (r) => r.page && fundingPath(r.page.slug) === route,
  );
}
export function fundingStructuredData(
  funding: FundingRoute,
  config: SiteConfig,
) {
  if (!funding.page || !config.siteUrl) return undefined;
  const url = new URL(fundingPath(funding.page.slug), config.siteUrl).href;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": url,
        url,
        name: `${funding.program} and AMP Mathematics`,
        description: funding.page.summary,
        dateModified: funding.page.reviewedOn,
        inLanguage: "en-US",
        citation: funding.page.sources.map((s) => s.url),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Corpora",
            item: config.siteUrl,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Education funds",
            item: new URL("/esa/", config.siteUrl).href,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: funding.program,
            item: url,
          },
        ],
      },
    ],
  };
}
export function FundingPage({
  funding,
  supportEmail,
}: {
  funding: FundingRoute;
  supportEmail?: string;
}) {
  const page = funding.page;
  if (!page) throw new Error("Funding page content is missing");
  const presentation = page.presentation;
  const actionHref =
    supportEmail && presentation
      ? `mailto:${supportEmail}?subject=${encodeURIComponent(presentation.actionSubject)}`
      : "/support/";
  return (
    <div className={presentation ? "funding-guided" : undefined}>
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <ol>
          <li>
            <a href="/">Corpora</a>
          </li>
          <li>
            <a href="/esa/">Education funds</a>
          </li>
          <li>
            <span aria-current="page">{funding.program}</span>
          </li>
        </ol>
      </nav>
      <div className="page-intro funding-intro">
        <StateIdentity state={funding.state} />
        <div className="funding-intro-copy">
          <p className="eyebrow">
            {stateNames[funding.state] ?? funding.state} ·{" "}
            {fundingLabels[funding.kind]}
          </p>
          {presentation && (
            <p className="funding-approved-label">{presentation.statusLabel}</p>
          )}
          <h1>{presentation?.headline ?? funding.program}</h1>
          <p className="lead">{page.summary}</p>
          {presentation && (
            <div className="funding-actions">
              <a className="button" href={actionHref}>
                {presentation.actionLabel} <span aria-hidden="true">↗</span>
              </a>
              <a className="funding-explore" href="/amp/">
                Explore AMP Math <span aria-hidden="true">→</span>
              </a>
            </div>
          )}
          <p className="fine">
            Reviewed <time dateTime={page.reviewedOn}>{page.reviewedOn}</time>
          </p>
        </div>
      </div>
      <div className="funding-layout">
        <aside className="funding-status" aria-labelledby="amp-program-status">
          <p className="eyebrow">Before you buy</p>
          <h2 id="amp-program-status">AMP and this program</h2>
          <p>{page.ampStatus}</p>
          <a href={presentation ? actionHref : "/support/"}>
            {presentation?.actionLabel ?? "Ask about your purchase"} ↗
          </a>
          <div className="funding-product-links">
            <a href="/amp/#examples">Explore the mathematics</a>
            <a href="/amp/#coverage">See current coverage</a>
            <a href="/legal/refund/">Read the refund policy</a>
          </div>
        </aside>
        <div className="funding-article">
          <section aria-labelledby="program-eligibility">
            <h2 id="program-eligibility">Who can use it</h2>
            <p>{page.eligibility}</p>
          </section>
          <section aria-labelledby="program-steps">
            <h2 id="program-steps">How to use this route</h2>
            <p>{funding.instructions}</p>
            <ol className="funding-steps">
              {page.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </section>
          <section aria-labelledby="program-documents">
            <h2 id="program-documents">Documents to keep</h2>
            <ul className="funding-checklist">
              {page.receiptChecklist.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
            <p className="fine">
              Use the program’s secure submission process for personal
              documents. Do not send account credentials or full payment details
              to Corpora.
            </p>
          </section>
          {!!page.restrictions.length && (
            <section aria-labelledby="program-limits">
              <h2 id="program-limits">Limits to check</h2>
              <ul>
                {page.restrictions.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </section>
          )}
          {!!page.questions.length && (
            <section
              className="faq funding-faq"
              aria-labelledby="program-questions"
            >
              <h2 id="program-questions">Questions from families</h2>
              {page.questions.map(({ question, answer }, i) => (
                <details key={i}>
                  <summary>{question}</summary>
                  <p>{answer}</p>
                </details>
              ))}
            </section>
          )}
          <section
            className="funding-sources"
            aria-labelledby="program-sources"
          >
            <h2 id="program-sources">Official sources</h2>
            <ul>
              {page.sources.map((source, i) => (
                <li key={i}>
                  <a href={source.url}>{source.title} ↗</a>
                </li>
              ))}
            </ul>
            <p className="fine">
              Program administrators decide purchase eligibility. Check their
              current rules before paying. This guide’s next review is due by{" "}
              <time dateTime={funding.reviewedUntil}>
                {funding.reviewedUntil}
              </time>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
