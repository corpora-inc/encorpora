import { StateIdentity, stateNames } from "./state-identity.js";
import React from "./react.js";
import { formatPrice, type SiteConfig } from "./config.js";

export type FundingRoute = SiteConfig["funding"][number];
export const fundingLabels: Record<FundingRoute["kind"], string> = {
  marketplace: "Marketplace or direct payment",
  "classwallet-direct-pay": "ClassWallet DirectPay",
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
  appUrl,
  plans = [],
}: {
  funding: FundingRoute;
  supportEmail?: string;
  appUrl?: string;
  plans?: SiteConfig["plans"];
}) {
  const page = funding.page;
  if (!page) throw new Error("Funding page content is missing");
  const presentation = page.presentation;
  const directPay = !!presentation && funding.kind === "classwallet-direct-pay";
  const requestBody = directPay
    ? [
        "Hello Corpora,",
        "",
        `Please prepare an AMP Math invoice for ${funding.program}.`,
        `Plan: ${plans.map((plan) => `${plan.interval === "year" ? "12 months" : "1 month"} (${formatPrice(plan)})`).join(" or ") || "please send available options"}`,
        "Preferred start date: ",
        "Email for AMP access (if different from this email): ",
        "I have an AMP account: yes / no",
        "",
        "Please confirm the details needed for my invoice.",
      ].join("\n")
    : undefined;
  const actionHref =
    supportEmail && presentation
      ? `mailto:${supportEmail}?subject=${encodeURIComponent(presentation.actionSubject)}${requestBody ? `&body=${encodeURIComponent(requestBody)}` : ""}`
      : "/support/";
  return (
    <div
      className={presentation ? `funding-guided${directPay ? " funding-directpay" : ""}` : undefined}
      data-campaign-program={presentation ? page.slug : undefined}
    >
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
            <p className="funding-approved-label">
              <span aria-hidden="true">✓ </span>
              {presentation.statusLabel}
            </p>
          )}
          <h1>{presentation?.headline ?? funding.program}</h1>
          {!directPay && <p className="lead">{page.summary}</p>}
          {directPay && plans.length > 0 && (
            <div className="funding-plan-summary" aria-label="License prices">
              <ul>
                {plans.map((plan) => (
                  <li key={plan.interval}>
                    <strong>{formatPrice(plan)}</strong> / {plan.interval === "year" ? "12 months" : "1 month"}
                  </li>
                ))}
              </ul>
              <p className="fine">Per learner. Fixed access dates. No automatic renewal.</p>
            </div>
          )}
          {presentation && (
            <div className="funding-actions">
              <a
                className="button"
                href={actionHref}
                data-campaign-action="invoice"
              >
                {presentation.actionLabel} <span aria-hidden="true">↗</span>
              </a>
              <a
                className="funding-explore"
                data-campaign-action={appUrl ? "try" : undefined}
                href={appUrl ? new URL(page.slug === "arkansas-efa" ? "/try?program=ar-efa" : "/try", appUrl).href : "/amp/"}
              >
                {appUrl ? "Try AMP Math" : "Explore AMP Math"}{" "}
                <span aria-hidden="true">→</span>
              </a>
            </div>
          )}
          {directPay && supportEmail && (
            <p className="funding-email fine">
              Or email <a href={actionHref} data-campaign-action="invoice">{supportEmail}</a> with your plan and preferred start date. No AMP account required to request an invoice.
            </p>
          )}
          {directPay && <p className="lead funding-purchase-summary">{page.summary}</p>}
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
          <a href={presentation ? actionHref : "/support/"} data-campaign-action={presentation ? "invoice" : undefined}>
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
            <h2 id="program-eligibility">{presentation ? "Who qualifies" : "Who can use it"}</h2>
            <p>{page.eligibility}</p>
          </section>
          <section aria-labelledby="program-steps">
            <h2 id="program-steps">{directPay ? "How to pay with program funds" : "How to use this route"}</h2>
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
