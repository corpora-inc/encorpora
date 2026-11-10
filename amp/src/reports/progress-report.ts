import { levelRange } from "../learning/level-check";
import type { AdultStart } from "../learning/starting-point";
import type {
  ProgressRecord,
  StudentRecordResponse,
  StudentTimeResponse,
} from "../schools/teacher-contracts";
import {
  count,
  dayWords,
  esc,
  gradeScale,
  gradeTick,
  masthead,
  pageFooter,
  plural,
  printDocument,
  strandInk,
  type Paper,
} from "./print";

/** One learner's progress on paper: where they are on every strand, with
 * how sure that is; their time; their grades (a school's student); and the
 * objectives they gained. The same facts the record screen reads. */
export type ProgressReportInput = {
  paper: Paper;
  name: string;
  first: string;
  /** Under the name: their classes, or where an adult began. */
  subtitle: string;
  /** Beside the name: "School" and the like. */
  facts: { label: string; value: string }[];
  /** The learner's own day, YYYY-MM-DD. */
  today: string;
  record: ProgressRecord;
  /** Days and skills over the last weeks (an adult's own record). */
  time?: Pick<StudentTimeResponse, "range" | "days" | "skills">;
  grades?: StudentRecordResponse["grades"];
};

/** Where an adult chose to begin, in words. */
export const adultStartNames: Record<AdultStart, string> = {
  counting: "Counting",
  elementary: "Elementary",
  "middle-school": "Middle school",
  "algebra-1": "Algebra",
  geometry: "Geometry",
  "algebra-2": "Algebra 2",
  precalculus: "Precalculus",
};

type Estimate = { level: number; sd: number };
const fixed = (value: number) => value.toFixed(1);

function levels(input: ProgressReportInput) {
  const { level, reference, strands } = input.record;
  if (!level)
    return `<p class="quiet">Levels appear here once ${esc(input.first)} has some work to read.</p>`;
  const center = reference
    ? (reference.from + reference.to) / 2
    : level.overall.level;
  const { at, grades } = gradeScale(
    center,
    [level.overall, ...Object.values(level.strands)].map((e) => levelRange(e)),
  );
  const lines = grades
    .map((g) => `<span class="gridLine" style="left:${at(g)}"></span>`)
    .join("");
  const course = reference
    ? `<span class="course" style="left:${at(reference.from)};width:calc(${at(reference.to)} - ${at(reference.from)})"></span>`
    : "";
  const row = (
    label: string,
    estimate: Estimate,
    ink: string,
    lead = false,
  ) => {
    const [from, to] = levelRange(estimate);
    return `<li class="levelRow${lead ? " lead" : ""}" style="--ink-strand:${ink}"><span class="levelName">${esc(label)}</span><span class="track">${lines}${course}<span class="band" style="left:${at(from)};width:calc(${at(to)} - ${at(from)})"></span><span class="dot" style="left:${at(estimate.level)}"></span></span><span class="levelNumbers">${fixed(from)}–${fixed(to)}</span></li>`;
  };
  const [from, to] = levelRange(level.overall);
  const axis = grades
    .map((g) => `<span style="left:${at(g)}">${gradeTick(g)}</span>`)
    .join("");
  return `<div class="readout"><div><span class="label">Likely grade level, overall</span><p class="big display">${fixed(from)}<span class="dash">–</span>${fixed(to)}</p></div><dl class="facts"><div><dt class="label">Best estimate</dt><dd>Grade ${fixed(level.overall.level)}</dd></div>${reference ? `<div><dt class="label">Course</dt><dd>Grade ${fixed(reference.from)}–${fixed(reference.to)}</dd></div>` : ""}<div><dt class="label">Strands read</dt><dd>${strands.length}</dd></div></dl></div>
<div class="chart"><div class="axisRow"><span></span><span class="axis">${axis}</span><span class="levelNumbers label">Grade</span></div><ul>${row("Overall", level.overall, "var(--accent)", true)}${strands
    .filter((s) => level.strands[s.id])
    .map((s) => row(s.label, level.strands[s.id]!, strandInk(s.id)))
    .join("")}</ul></div>
<p class="note legend"><span class="key"><span class="keyBand"></span>Likely range</span><span class="key"><span class="keyDot"></span>Best estimate</span>${reference ? `<span class="key"><span class="keyCourse"></span>This course</span>` : ""}<span>Ranges narrow as more work is read.</span></p>`;
}

function weeks(record: ProgressRecord) {
  const largest = Math.max(1, ...record.weeks.map((w) => w.minutes));
  const total = record.weeks.reduce((sum, w) => sum + w.minutes, 0);
  const active = record.weeks.filter((w) => w.minutes > 0).length;
  const bars = record.weeks
    .map(
      (w) =>
        `<span class="weekCol"><span class="weekValue">${w.minutes ? count(w.minutes) : ""}</span><span class="weekBar" style="height:${w.minutes ? Math.max(4, (w.minutes / largest) * 100).toFixed(1) : 0}%"></span><span class="weekDay">${dayWords(w.week, "month")}</span></span>`,
    )
    .join("");
  return `<dl class="stats"><div><dd class="display">${count(total)}</dd><dt class="label">Active minutes</dt></div><div><dd class="display">${active}<span class="of"> of ${record.weeks.length}</span></dd><dt class="label">Weeks with practice</dt></div><div><dd class="display">${active ? count(total / active) : "0"}</dd><dt class="label">Minutes per active week</dt></div></dl>
<div class="weeks" role="img" aria-label="${count(total)} active minutes over ${record.weeks.length} weeks">${bars}</div>`;
}

function skills(time: NonNullable<ProgressReportInput["time"]>) {
  const list = time.skills.filter((s) => s.minutes > 0);
  if (!list.length) return "";
  const largest = Math.max(1, ...list.map((s) => s.minutes));
  return `<h3 class="subhead">Where the time went, ${dayWords(time.range.from, "month")} to ${dayWords(time.range.to, "month")}</h3><ul class="skills">${list
    .map(
      (s) =>
        `<li style="--ink-strand:${strandInk(s.strand)}"><span class="skillTitle">${esc(s.title)}</span><span class="skillBar"><span style="width:${((s.minutes / largest) * 100).toFixed(1)}%"></span></span><span class="skillMinutes">${plural(s.minutes, "min", "min")}</span></li>`,
    )
    .join("")}</ul>`;
}

function grades(list: NonNullable<ProgressReportInput["grades"]>) {
  if (!list.length) return "";
  return `<section class="section"><div class="sectionHead"><h2>Grades</h2><p>Final grades are the teacher’s</p></div><table class="grades"><thead><tr><th>Class</th><th>Term</th><th>AMP suggests</th><th>Final</th></tr></thead><tbody>${list
    .map(
      (g) =>
        `<tr><td>${esc(g.className)}</td><td>${esc(g.termName)}${g.state === "closed" ? ' <span class="quiet">(closed)</span>' : ""}</td><td>${g.suggestion.letters ? esc(g.suggestion.letters) : '<span class="quiet">Not enough work yet</span>'}</td><td class="final">${g.final ? esc(g.final) : '<span class="quiet">—</span>'}</td></tr>`,
    )
    .join("")}</tbody></table></section>`;
}

const OBJECTIVES_SHOWN = 36;
function objectives(record: ProgressRecord) {
  if (!record.objectives.length)
    return `<p class="quiet">None yet this year.</p>`;
  const shown = record.objectives.slice(0, OBJECTIVES_SHOWN);
  const more = record.objectives.length - shown.length;
  return `<ul class="objectives">${shown
    .map(
      (o) =>
        `<li style="--ink-strand:${strandInk(o.strand)}"><span class="when">${dayWords(o.day, "month")}</span><span class="strandDot"></span><span>${esc(o.title)}</span></li>`,
    )
    .join(
      "",
    )}</ul>${more > 0 ? `<p class="note more">And ${plural(more, "earlier objective")}.</p>` : ""}`;
}

const CSS = `
.who { display: flex; justify-content: space-between; align-items: flex-end; gap: 0.3in; padding: 0.16in 0 0.04in; }
.who h1 { font-size: 26pt; line-height: 1.08; }
.who .sub { margin-top: 3px; font-size: 10.5pt; color: var(--muted); }
.who .facts { justify-content: flex-end; text-align: right; }
.readout { display: flex; justify-content: space-between; align-items: flex-end; gap: 0.3in; margin-bottom: 0.14in; }
.big { font-size: 30pt; line-height: 1.05; color: var(--accent); }
.big .dash { margin: 0 0.04em; }
.chart { --name: 1.55in; --numbers: 0.72in; }
.axisRow, .levelRow { display: grid; grid-template-columns: var(--name) 1fr var(--numbers); align-items: center; column-gap: 0.14in; }
.axisRow { height: 0.2in; }
.axis { position: relative; height: 100%; }
.axis span { position: absolute; top: 0; transform: translateX(-50%); font-size: 7.5pt; font-weight: 700; color: var(--muted); }
.levelRow { min-height: 0.27in; border-top: 0.6pt solid var(--grid); break-inside: avoid; }
.levelRow.lead { min-height: 0.36in; border-top: 1pt solid var(--ink); }
.levelRow.lead .levelName, .levelRow.lead .levelNumbers { font-weight: 700; }
.levelRow:last-child { border-bottom: 0.6pt solid var(--grid); }
.levelName { font-size: 9.5pt; line-height: 1.2; }
.levelNumbers { font-size: 9pt; text-align: right; white-space: nowrap; }
.track { position: relative; align-self: stretch; }
.gridLine { position: absolute; top: 0; bottom: 0; width: 0; border-left: 0.6pt solid var(--grid); }
.course { position: absolute; top: 0; bottom: 0; background: color-mix(in srgb, var(--accent) 9%, transparent); }
.band { position: absolute; top: 50%; height: 0.11in; transform: translateY(-50%); border-radius: 0.055in; background: color-mix(in srgb, var(--ink-strand) 34%, #fff); box-shadow: inset 0 0 0 0.7pt var(--ink-strand); min-width: 0.11in; }
.lead .band { height: 0.15in; border-radius: 0.075in; }
.dot { position: absolute; top: 50%; width: 0.1in; height: 0.1in; transform: translate(-50%, -50%); border-radius: 50%; background: var(--ink-strand); box-shadow: 0 0 0 1.4pt #fff; }
.lead .dot { width: 0.13in; height: 0.13in; }
.legend { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 0.2in; margin-top: 0.08in; }
.key { display: inline-flex; align-items: center; gap: 6px; }
.keyBand { width: 0.3in; height: 0.09in; border-radius: 0.045in; background: color-mix(in srgb, var(--accent) 34%, #fff); box-shadow: inset 0 0 0 0.7pt var(--accent); }
.keyDot { width: 0.09in; height: 0.09in; border-radius: 50%; background: var(--accent); }
.keyCourse { width: 0.24in; height: 0.14in; background: color-mix(in srgb, var(--accent) 12%, transparent); }
.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.2in; margin-bottom: 0.12in; }
.stats div { display: flex; flex-direction: column-reverse; gap: 2px; }
.stats dd { font-size: 22pt; line-height: 1.05; color: var(--accent); }
.stats .of { font-size: 11pt; color: var(--muted); }
.weeks { display: flex; gap: 0; height: 1.2in; }
.weekCol { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 3px; }
.weekValue { font-size: 7pt; color: var(--muted); }
.weekBar { width: 58%; max-height: 0.82in; border-radius: 2.5px 2.5px 0 0; background: var(--accent); }
.weekDay { width: 100%; padding-top: 3px; border-top: 0.8pt solid var(--ink); font-size: 7pt; color: var(--muted); text-align: center; white-space: nowrap; }
.subhead { margin: 0.18in 0 0.06in; font-size: 9pt; font-weight: 700; }
.skills li { display: grid; grid-template-columns: 2.6in 1fr 0.6in; align-items: center; column-gap: 0.14in; padding: 3px 0; border-bottom: 0.6pt solid var(--grid); font-size: 9pt; }
.skillBar { height: 0.08in; border-radius: 0.04in; background: color-mix(in srgb, var(--ink-strand) 14%, #fff); overflow: hidden; }
.skillBar span { display: block; height: 100%; background: var(--ink-strand); }
.skillMinutes { text-align: right; color: var(--muted); }
table.grades { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
.grades th { padding: 0 0.1in 4px 0; text-align: left; font-size: 7.5pt; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); border-bottom: 1pt solid var(--ink); }
.grades td { padding: 5px 0.1in 5px 0; border-bottom: 0.6pt solid var(--grid); vertical-align: top; }
.grades td.final { font-family: "WB Display", Georgia, serif; font-weight: 600; font-size: 12pt; }
.objectives { columns: 2; column-gap: 0.32in; }
.objectives li { display: grid; grid-template-columns: 0.5in 0.1in 1fr; align-items: baseline; column-gap: 6px; padding: 3px 0; border-bottom: 0.6pt solid var(--grid); font-size: 9pt; line-height: 1.3; break-inside: avoid; }
.when { color: var(--muted); white-space: nowrap; }
.strandDot { width: 0.075in; height: 0.075in; border-radius: 50%; background: var(--ink-strand); transform: translateY(-0.01in); }
.more { margin-top: 0.06in; }
`;

export function progressReportHtml(input: ProgressReportInput) {
  const facts = input.facts
    .map(
      (f) =>
        `<div><dt class="label">${esc(f.label)}</dt><dd>${esc(f.value)}</dd></div>`,
    )
    .join("");
  const body = `${masthead("Progress report", dayWords(input.today))}
<div class="who"><div><h1>${esc(input.name)}</h1>${input.subtitle ? `<p class="sub">${esc(input.subtitle)}</p>` : ""}</div>${facts ? `<dl class="facts">${facts}</dl>` : ""}</div>
<section class="section"><div class="sectionHead"><h2>Where ${esc(input.first)} is</h2><p>Grade levels, kindergarten to college</p></div>${levels(input)}</section>
<section class="section"><div class="sectionHead"><h2>Time</h2><p>Active minutes, last ${input.record.weeks.length} weeks</p></div>${weeks(input.record)}${input.time ? skills(input.time) : ""}</section>
${input.grades ? grades(input.grades) : ""}
<section class="section objectivesSection"><div class="sectionHead"><h2>Objectives gained</h2><p>${input.record.objectives.length ? `${plural(input.record.objectives.length, "objective")} this year` : "This year"}</p></div>${objectives(input.record)}</section>`;
  return {
    html: printDocument({
      title: `${input.name}: progress report`,
      paper: input.paper,
      css: CSS,
      body,
    }),
    footer: pageFooter(
      `AMP · Progress report · ${input.name} · ${dayWords(input.today, "short")}`,
    ),
  };
}
