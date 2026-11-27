/** `/research` as plain HTML, from the same words as the page, for readers
 * that never run the app: search engines and other crawlers. The app replaces
 * it when it mounts. Also the report's structured data. */
import { publicOrigin } from "../web/app/route-head";
import {
  report,
  reportCitation,
  reportStatus,
  researchPage as page,
} from "./report";

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (character) =>
    character === "&"
      ? "&amp;"
      : character === "<"
        ? "&lt;"
        : character === ">"
          ? "&gt;"
          : character === '"'
            ? "&quot;"
            : "&#39;",
  );
const paragraphs = (texts: readonly string[]) =>
  texts.map((text) => `<p>${escape(text)}</p>`).join("");

export const researchStaticStyles = `.research-static{max-width:780px;margin:0 auto;padding:clamp(20px,5vw,56px);font:16px/1.6 system-ui,sans-serif;color:#183e3a}
.research-static h1{font-size:clamp(28px,5vw,42px);line-height:1.15}
.research-static h2{font-size:20px;margin-top:32px}
.research-static h3{font-size:16px;margin:20px 0 4px}
.research-static a{color:#086d78}
.research-static small{color:#45615b}
@media(prefers-color-scheme:dark){.research-static{color:#e9f0e8}.research-static a{color:#7ddbe2}.research-static small{color:#abc8bf}}`;

export function researchStaticHtml() {
  const doiLink = report.doi
    ? `<a href="https://doi.org/${escape(report.doi)}">${escape(reportStatus())}</a>`
    : escape(reportStatus());
  return `<main class="research-static">
<h1>${escape(page.title)}</h1>
<p>${escape(page.lede)}</p>
<article>
<p><small>${escape(report.series)} · ESSA Tier 4 rationale</small></p>
<h2>${escape(report.title)}</h2>
<p><a href="${escape(report.orcid)}">${escape(report.author)}</a>, ${escape(report.affiliation)} · ${escape(report.publishedLabel)} · ${report.pages} pages · ${doiLink}</p>
<p>${escape(report.abstract)}</p>
<p><a href="${escape(report.pdf)}">Read the report (PDF)</a></p>
<p><small>${escape(report.conflict)}</small></p>
</article>
<h2>${escape(page.idea.heading)}</h2>
${paragraphs(page.idea.paragraphs)}
<h2>${escape(page.componentsHeading)}</h2>
<ol>${page.components
    .map(
      (component) =>
        `<li id="${escape(component.id)}"><h3>${escape(component.title)}</h3><p>${escape(component.what)}</p><p><em>${escape(component.research)}</em> <small>(${escape(component.sources)})</small></p></li>`,
    )
    .join("")}</ol>
<p>${escape(page.combined)}</p>
<h2>${escape(page.testing.heading)}</h2>
<p>${escape(page.testing.lead)}</p>
<ol>${page.testing.phases
    .map(
      (phase) =>
        `<li><strong>${escape(phase.name)}</strong> (${escape(phase.when)}): ${escape(phase.what)}</li>`,
    )
    .join("")}</ol>
<h2>${escape(page.open.heading)}</h2>
${paragraphs(page.open.paragraphs)}
<h2>${escape(page.essa.heading)}</h2>
${paragraphs(page.essa.paragraphs)}
<h2>Cite the report</h2>
<p>${escape(reportCitation())}</p>
<p>Researchers interested in working with us can write to the author at <a href="mailto:${escape(page.contact)}">${escape(page.contact)}</a>.</p>
<p><a href="/">AMP</a> · <a href="/schools">For schools</a></p>
</main>`;
}

/** schema.org `ScholarlyArticle` for the report. */
export function researchJsonLd() {
  const url = new URL("/research", publicOrigin).href;
  return {
    "@context": "https://schema.org",
    "@type": "ScholarlyArticle",
    headline: report.title,
    name: report.title,
    abstract: report.abstract,
    datePublished: report.published,
    inLanguage: "en",
    keywords: report.keywords.join(", "),
    license: report.license,
    url,
    mainEntityOfPage: url,
    ...(report.doi ? { sameAs: `https://doi.org/${report.doi}` } : {}),
    author: {
      "@type": "Person",
      name: report.author,
      sameAs: report.orcid,
      affiliation: { "@id": "https://corpora.inc/#organization" },
    },
    publisher: {
      "@type": "Organization",
      "@id": "https://corpora.inc/#organization",
      name: "Corpora Inc.",
      url: "https://corpora.inc",
    },
    encoding: {
      "@type": "MediaObject",
      contentUrl: new URL(report.pdf, publicOrigin).href,
      encodingFormat: "application/pdf",
    },
    about: {
      "@type": "SoftwareApplication",
      name: "AMP (Adaptive Math Pathways)",
      applicationCategory: "EducationalApplication",
    },
  };
}
