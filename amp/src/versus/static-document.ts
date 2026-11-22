/** `/versus` and `/versus/<slug>` as plain HTML, from the same words as the
 * screens, for readers that never run the app: search engines and other
 * crawlers. The build puts it in each page's document, hidden, as
 * `/research` does (scripts/build-public-documents.ts). */
import { researchComponent, researchPage } from "../research/report";
import { versusContact, versusHub, versusRows } from "./amp";
import { relatedComparisons, versusGroups, versusPath } from "./catalog";
import { citedParts, sourceAnchor } from "./citations";
import { checkedLabel, researchLink } from "./head";
import type { VersusCatalogEntry, VersusPage } from "./types";

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

/** Prose with its citations as links to the page's sources. */
const cited = (text: string) =>
  citedParts(text)
    .map((part) =>
      "cite" in part
        ? `<sup>${part.after ? "," : ""}<a href="#${sourceAnchor(part.cite)}">${part.cite}</a></sup>`
        : escape(part.text),
    )
    .join("");
const paragraphs = (texts: readonly string[]) =>
  texts.map((text) => `<p>${cited(text)}</p>`).join("");
const items = (texts: readonly string[]) =>
  `<ul>${texts.map((text) => `<li>${cited(text)}</li>`).join("")}</ul>`;

/** The class the build's noscript rule shows. */
export const versusStaticClass = "versus-static";
export const versusStaticStyles = `.versus-static{max-width:780px;margin:0 auto;padding:clamp(20px,5vw,56px);font:16px/1.6 system-ui,sans-serif;color:#183e3a}
.versus-static h1{font-size:clamp(28px,5vw,42px);line-height:1.15}
.versus-static h2{font-size:20px;margin-top:32px}
.versus-static h3{font-size:16px;margin:20px 0 4px}
.versus-static a{color:#086d78}
.versus-static small{color:#45615b}
.versus-static table{border-collapse:collapse;width:100%}
.versus-static th,.versus-static td{padding:8px 12px 8px 0;text-align:left;vertical-align:top;border-top:1px solid #c9d6d2}
@media(prefers-color-scheme:dark){.versus-static{color:#e9f0e8}.versus-static a{color:#7ddbe2}.versus-static small{color:#abc8bf}.versus-static th,.versus-static td{border-color:#3a524d}}`;

export function versusHubStaticHtml(catalog: readonly VersusCatalogEntry[]) {
  return `<main class="${versusStaticClass}">
<h1>${escape(versusHub.title)}</h1>
<p>${escape(versusHub.lede)}</p>
<h2>${escape(versusHub.why.heading)}</h2>
<ul>${versusHub.why.reasons
    .map(
      (reason) =>
        `<li><a href="/research#${reason.research}">${escape(reason.title)}</a>: ${escape(reason.text)}</li>`,
    )
    .join("")}</ul>
<p><a href="/research">${escape(researchPage.title)}</a></p>
${versusGroups(catalog)
  .map(
    ({ category, entries }) => `<h2>${escape(category.title)}</h2>
<p>${escape(category.blurb)}</p>
<ul>${entries
      .map(
        (entry) =>
          `<li><a href="${versusPath(entry.slug)}">AMP vs ${escape(entry.name)}</a>: ${escape(entry.line)}</li>`,
      )
      .join("")}</ul>`,
  )
  .join("\n")}
<p><a href="/">AMP</a> · <a href="/research">Research</a> · <a href="/schools">For schools</a></p>
</main>`;
}

export function versusPageStaticHtml(
  page: VersusPage,
  catalog: readonly VersusCatalogEntry[],
) {
  const name = escape(page.name);
  const rows = versusRows.filter((row) => page.rows[row.id] !== undefined);
  const related = relatedComparisons(page.slug, catalog);
  return `<main class="${versusStaticClass}">
<h1>AMP vs ${name}</h1>
<p>${cited(page.verdict)}</p>
<p><a href="/sign-up">Try it free</a></p>
<h2>Why AMP</h2>
${page.reasons
  .map(
    (reason) =>
      `<h3>${cited(reason.title)}</h3><p>${cited(reason.body)}</p>${
        reason.research?.length
          ? `<p>${reason.research
              .map((id) => {
                const link = researchLink(id);
                return `<a href="${link.href}">${escape(link.label)}</a>`;
              })
              .join(" · ")}</p>`
          : ""
      }`,
  )
  .join("\n")}
<h2>Side by side</h2>
<table>
<thead><tr><td></td><th scope="col">AMP</th><th scope="col">${name}</th></tr></thead>
<tbody>${rows
    .map(
      (row) =>
        `<tr><th scope="row">${escape(row.label)}</th><td>${escape(row.amp)}</td><td>${cited(page.rows[row.id]!)}</td></tr>`,
    )
    .join("")}</tbody>
</table>
<h2>What ${name} is</h2>
${page.maker ? `<p><small>From ${escape(page.maker)}</small></p>` : ""}
${paragraphs(page.theirs)}
<h2>What ${name} does well</h2>
${items(page.credit)}
<h2>The evidence</h2>
<h3>${name}</h3>
${paragraphs(page.evidence.theirs)}
<h3>AMP</h3>
${paragraphs(page.evidence.ours)}
<p><a href="/research">${escape(researchPage.title)}</a></p>
<h2>Choose ${name} if</h2>
${items(page.fit.them)}
<h2>Choose AMP if</h2>
${items(page.fit.amp)}
<h2>Questions</h2>
${page.questions
  .map(
    ({ question, answer }) =>
      `<h3>${escape(question)}</h3><p>${cited(answer)}</p>`,
  )
  .join("\n")}
<h2>Sources</h2>
<ol>${page.sources
    .map(
      (source, index) =>
        `<li id="${sourceAnchor(index + 1)}"><a href="${escape(source.url)}">${escape(source.title)}</a></li>`,
    )
    .join("")}</ol>
<p><small>Checked ${escape(checkedLabel(page.checked))}.</small></p>
<p><small>${name} is a trademark of its owner. AMP is not affiliated with it. Found an error? Write to <a href="mailto:${versusContact}">${versusContact}</a>.</small></p>
<h2>More comparisons</h2>
${
  related.length
    ? `<ul>${related
        .map(
          (entry) =>
            `<li><a href="${versusPath(entry.slug)}">AMP vs ${escape(entry.name)}</a>: ${escape(entry.line)}</li>`,
        )
        .join("")}</ul>`
    : ""
}
<p><a href="/versus">All comparisons</a> · <a href="/">AMP</a> · <a href="/research">Research</a></p>
</main>`;
}
