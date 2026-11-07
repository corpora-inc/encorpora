import { createHash } from "node:crypto";
import { lessons } from "../content/lessons.js";
import { printTokens } from "../content/print-exercise.js";
import { hasProblemLesson } from "../content/problem-lessons.js";
import { skills, skillTitle } from "../curriculum/catalog.js";
import { templates } from "../math/engine.js";
import { workbookFontCss } from "../workbook/fonts.js";
import { csvCell } from "./exports.js";
import type {
  CurriculumSummary,
  ScopeAndSequence,
  ScopeLevel,
} from "./share-contracts.js";
import { strandLabel } from "./teacher-reads.js";

/** The published curriculum document. Everything here is computed from the live
 * catalog, so the web page, the PDF and the CSV can't disagree or go stale. */
const LEVELS: readonly (readonly [string, string])[] = [
  ["K", "Kindergarten"],
  ...Array.from({ length: 8 }, (_, index): [string, string] => [
    String(index + 1),
    `Grade ${index + 1}`,
  ]),
  ["algebra-1", "Algebra 1"],
  ["geometry", "Geometry"],
  ["algebra-2", "Algebra 2"],
  ["precalculus", "Precalculus"],
];
/** The order a page reads a level's strands in. */
const STRAND_ORDER = [
  "number",
  "operations",
  "fractions",
  "decimals",
  "ratio",
  "algebra",
  "reasoning",
  "functions",
  "geometry",
  "trigonometry",
  "measurement",
  "data",
  "probability",
  "modeling",
];
const strandRank = (strand: string) => {
  const at = STRAND_ORDER.indexOf(strand);
  return at < 0 ? STRAND_ORDER.length : at;
};

/** What a standard reads as on the page. A K-8 or high school standard keeps
 * the code schools already use; a category or an SAT domain gets its name. */
const NAMED_STANDARDS: Readonly<Record<string, string>> = {
  HSN: "HS Number and Quantity",
  HSA: "HS Algebra",
  HSF: "HS Functions",
  HSG: "HS Geometry",
  HSS: "HS Statistics and Probability",
  HSM: "HS Modeling",
  "SAT.algebra": "SAT Algebra",
  "SAT.advanced-math": "SAT Advanced Math",
  "SAT.data": "SAT Problem-Solving and Data Analysis",
  "SAT.geometry": "SAT Geometry and Trigonometry",
};
export const standardLabel = (id: string) => NAMED_STANDARDS[id] ?? id;

const TITLE = "AMP scope and sequence";
const LEAD =
  "A complete math curriculum, from counting through precalculus, with unlimited problems and unlimited personalized workbooks.";
const POINTS = [
  "One continuous program a student can stay in from their first counting problem through precalculus.",
  "Problem types generate new problems, so practice never runs out.",
  "Each printable workbook is made for one student, with a warm-up, a taught lesson, practice, spaced review, a challenge and an answer key with worked steps.",
  "Objectives are mapped to K-8 Common Core standards, high school Common Core categories and SAT Math domains.",
  "Students work at their own level in each skill, and earlier skills return for review.",
];

const problemTypes = new Map<string, number>();
for (const { skillId } of templates)
  problemTypes.set(skillId, (problemTypes.get(skillId) ?? 0) + 1);

function buildLevel([id, label]: readonly [string, string]): ScopeLevel {
  const own = skills
    .map((skill, index) => ({ skill, index }))
    .filter(({ skill }) => skill.gradeBand === id)
    .sort(
      (a, b) =>
        strandRank(a.skill.strand) - strandRank(b.skill.strand) ||
        a.index - b.index,
    )
    .map(({ skill }) => skill);
  const strands: ScopeLevel["strands"] = [];
  for (const { strand } of own) {
    const last = strands.at(-1);
    if (last?.strand === strand) last.objectives += 1;
    else strands.push({ strand, objectives: 1 });
  }
  return {
    id,
    label,
    objectives: own.length,
    problemTypes: own.reduce(
      (sum, skill) => sum + (problemTypes.get(skill.id) ?? 0),
      0,
    ),
    strands,
    rows: own.map((skill) => ({
      id: skill.id,
      strand: skill.strand,
      strandLabel: strandLabel(skill.strand),
      title: skill.title,
      standards: [
        ...new Set(
          skill.alignments.map(({ standardId }) => standardLabel(standardId)),
        ),
      ],
      prerequisites: skill.prerequisites.map(skillTitle),
    })),
  };
}

let built: ScopeAndSequence | undefined;
export function scopeAndSequence(): ScopeAndSequence {
  if (built) return built;
  const levels = LEVELS.map(buildLevel);
  built = {
    title: TITLE,
    lead: LEAD,
    points: POINTS,
    objectives: levels.reduce((sum, level) => sum + level.objectives, 0),
    problemTypes: levels.reduce((sum, level) => sum + level.problemTypes, 0),
    // What a learner gets: the reference lessons plus each problem type's own.
    lessons:
      lessons.length +
      templates.filter((template) => hasProblemLesson(template.id)).length,
    levels,
  };
  return built;
}

/** The counts a page leads with, without every row. */
export function curriculumSummary(): CurriculumSummary {
  const { objectives, problemTypes, lessons, levels } = scopeAndSequence();
  return {
    objectives,
    problemTypes,
    lessons,
    levels: levels.map(({ rows: _rows, ...level }) => level),
  };
}

const JOIN = "; ";
const BOM = "﻿";
export const SCOPE_CSV_HEADERS = [
  "Level",
  "Strand",
  "Objective",
  "Standards",
  "Prerequisites",
] as const;
export function scopeCsv(): string {
  const lines = [SCOPE_CSV_HEADERS.map(csvCell).join(",")];
  for (const level of scopeAndSequence().levels)
    for (const row of level.rows)
      lines.push(
        [
          level.label,
          row.strandLabel,
          row.title,
          row.standards.join(JOIN),
          row.prerequisites.join(JOIN),
        ]
          .map(csvCell)
          .join(","),
      );
  return `${BOM}${lines.join("\r\n")}\r\n`;
}

const escape = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const plural = (count: number, one: string) =>
  `${count.toLocaleString("en-US")} ${one}${count === 1 ? "" : "s"}`;

/* Paper takes the theme's light values: print is always light. */
const PRINT_CSS = `
@page { size: letter landscape; margin: 0.5in 0.55in 0.62in; }
* { box-sizing: border-box; }
html { font-family: "WB Reading", system-ui, sans-serif; font-size: 9.6pt; line-height: 1.34; color: var(--color-on-surface); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; }
h1, h2 { font-family: "WB Display", Georgia, serif; font-weight: 420; margin: 0; }
.cover { display: flex; flex-direction: column; height: 7.26in; }
.coverTop { display: grid; grid-template-columns: 1fr 3.35in; column-gap: 0.5in; }
.cover h1 { font-size: 40pt; line-height: 1.04; letter-spacing: -0.014em; }
.lead { margin: 0.16in 0 0.2in; font-size: 14.5pt; line-height: 1.34; }
.points { margin: 0; padding: 0; list-style: none; }
.points li { position: relative; padding: 0.075in 0 0.075in 0.2in; font-size: 10.8pt; border-top: 0.6pt solid var(--color-figure-grid); }
.points li::before { content: ""; position: absolute; left: 0.02in; top: 0.17in; width: 0.07in; height: 0.07in; border-radius: 50%; background: var(--color-primary); }
.coverEnd { margin-top: auto; }
.ribbon { display: flex; gap: 2pt; }
.ribbon > div { min-width: 0; }
.ribbon svg { display: block; width: 100%; height: 0.24in; overflow: visible; }
.ribbon path { fill: none; stroke-width: 1.1; stroke-linecap: round; vector-effect: non-scaling-stroke; }
.ribbon span { display: block; margin-top: 0.05in; font-size: 8pt; color: var(--color-muted-text); white-space: nowrap; }
.ribbonNote { margin: 0.07in 0 0; font-size: 8.8pt; color: var(--color-muted-text); }
.summary { width: 100%; border-collapse: collapse; font-size: 10.2pt; font-variant-numeric: tabular-nums; }
.summary th { font-weight: 600; text-align: left; padding: 0 0 0.06in; border-bottom: 1pt solid var(--color-on-surface); }
.summary td { padding: 0.04in 0; border-bottom: 0.6pt solid var(--color-figure-grid); }
.summary th:not(:first-child), .summary td:not(:first-child) { text-align: right; }
.summary tfoot td { border-bottom: 0; border-top: 1pt solid var(--color-on-surface); font-weight: 600; }
.level { break-before: page; }
table.objectives { width: 100%; border-collapse: collapse; table-layout: fixed; }
.objectives thead { display: table-header-group; }
.objectives tr { break-inside: avoid; }
.objectives .levelRow th { padding: 0 0 0.09in; text-align: left; font-family: "WB Display", Georgia, serif; font-weight: 420; font-size: 19pt; line-height: 1.1; }
.objectives .levelRow small { margin-left: 0.1in; font-family: "WB Reading", system-ui, sans-serif; font-size: 9.6pt; font-weight: 400; color: var(--color-muted-text); }
.objectives .heads th { padding: 0 0.1in 0.05in 0; text-align: left; font-size: 8.8pt; font-weight: 600; border-bottom: 1pt solid var(--color-on-surface); }
.objectives td { padding: 0.052in 0.1in 0.052in 0; vertical-align: top; border-bottom: 0.6pt solid var(--color-figure-grid); }
.objectives td.objective { font-weight: 600; }
.objectives td.strand, .objectives td.prerequisites { color: var(--color-muted-text); }
.strandCol { width: 11%; }
.objectiveCol { width: 27%; }
.standardsCol { width: 25%; }
.prerequisitesCol { width: 37%; }
`;

function levelTable(level: ScopeLevel) {
  const rows = level.rows
    .map(
      (row) =>
        `<tr><td class="strand">${escape(row.strandLabel)}</td><td class="objective">${escape(row.title)}</td><td>${escape(row.standards.join(", "))}</td><td class="prerequisites">${escape(row.prerequisites.join(", "))}</td></tr>`,
    )
    .join("");
  return `<section class="level"><table class="objectives"><colgroup><col class="strandCol"><col class="objectiveCol"><col class="standardsCol"><col class="prerequisitesCol"></colgroup><thead><tr class="levelRow"><th colspan="4">${escape(level.label)}<small>${plural(level.objectives, "objective")}, ${plural(level.problemTypes, "problem type")}</small></th></tr><tr class="heads"><th>Strand</th><th>Objective</th><th>Standards</th><th>Prerequisites</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}

/** The strand colours the app's map uses, from the same tokens. */
const STRAND_INK: Readonly<Record<string, string>> = {
  reasoning: "algebra",
  trigonometry: "geometry",
};
/** The whole program as one line: a wave per objective, a colour per strand. */
function ribbon(levels: readonly ScopeLevel[]) {
  const CYCLE = 12;
  const MIDDLE = 12;
  const PEAK = 18;
  return levels
    .map((level) => {
      let x = 0;
      const paths = level.strands.map((run) => {
        let d = `M${x} ${MIDDLE}`;
        for (let cycle = 0; cycle < run.objectives; cycle++) {
          d += ` Q${x + CYCLE / 4} ${MIDDLE - PEAK} ${x + CYCLE / 2} ${MIDDLE} T${x + CYCLE} ${MIDDLE}`;
          x += CYCLE;
        }
        return `<path d="${d}" style="stroke:var(--color-strand-${STRAND_INK[run.strand] ?? run.strand})"/>`;
      });
      const short =
        /^\d$/.test(level.id) || level.id === "K" ? level.id : level.label;
      return `<div style="flex:${level.objectives} ${level.objectives} 0"><svg viewBox="0 0 ${level.objectives * CYCLE} 24" preserveAspectRatio="none">${paths.join("")}</svg><span>${escape(short)}</span></div>`;
    })
    .join("");
}

/** The PDF's page. It uses the workbook renderer's own contract: `data-compose`
 * makes it wait for the signal, here that the embedded type has loaded. */
export function scopeDocument(): string {
  const scope = scopeAndSequence();
  return `<!doctype html><html lang="en" data-compose><head><meta charset="utf-8"><title>${escape(scope.title)}</title><style>${printTokens()}${workbookFontCss(false)}${PRINT_CSS}</style></head><body>
<section class="cover"><div class="coverTop"><div><h1>${escape(scope.title)}</h1><p class="lead">${escape(scope.lead)}</p><ul class="points">${scope.points.map((point) => `<li>${escape(point)}</li>`).join("")}</ul></div>
<table class="summary"><thead><tr><th>Level</th><th>Objectives</th><th>Problem types</th></tr></thead><tbody>${scope.levels.map((level) => `<tr><td>${escape(level.label)}</td><td>${level.objectives}</td><td>${level.problemTypes}</td></tr>`).join("")}</tbody><tfoot><tr><td>All levels</td><td>${scope.objectives.toLocaleString("en-US")}</td><td>${scope.problemTypes.toLocaleString("en-US")}</td></tr></tfoot></table></div>
<div class="coverEnd"><div class="ribbon">${ribbon(scope.levels)}</div><p class="ribbonNote">One wave for each objective, colored by strand, in order from Kindergarten through Precalculus.</p></div></section>
${scope.levels.map(levelTable).join("")}
<script>document.fonts.ready.then(function(){document.documentElement.dataset.layout="ready"},function(){document.documentElement.dataset.layout="error"})</script></body></html>`;
}

/** Chromium's page footer: its own small document, with its own styles. */
export const SCOPE_FOOTER = `<div style="box-sizing:border-box;width:100%;padding:0 0.55in;display:flex;justify-content:space-between;font-family:system-ui,sans-serif;font-size:8pt;"><span>${TITLE}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`;

export const contentTag = (content: string | Buffer) =>
  `"${createHash("sha256").update(content).digest("hex").slice(0, 32)}"`;
