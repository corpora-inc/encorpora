import type { ReportCardsResponse } from "../schools/teacher-contracts";
import {
  count,
  dayWords,
  esc,
  gradeScale,
  gradeTick,
  masthead,
  pageFooter,
  printDocument,
  type Paper,
} from "./print";

/** A term's report cards, one page per student, in the order given. */
export type ReportCardsInput = {
  paper: Paper;
  data: ReportCardsResponse;
  students: ReportCardsResponse["students"];
  /** The day it was printed, YYYY-MM-DD. */
  today: string;
};

const levelWords = (level: number) =>
  level < 1 ? "Kindergarten" : `Grade ${level.toFixed(1)}`;
/** The working level on a strip of grades around it. */
function levelStrip(from: number, to: number) {
  const { at, grades } = gradeScale((from + to) / 2, [[from, to]]);
  const ticks = grades
    .map(
      (g) =>
        `<span class="tick" style="left:${at(g)}"><span>${gradeTick(g)}</span></span>`,
    )
    .join("");
  return `<span class="strip">${ticks}<span class="range" style="left:${at(from)};width:calc(${at(to)} - ${at(from)})"></span></span>`;
}

const CSS = `
.card { display: flex; flex-direction: column; min-height: 9.6in; break-after: page; }
.card:last-child { break-after: auto; }
.paper-A4 .card { min-height: 10.3in; }
.head { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.3in; padding: 0.28in 0 0.2in; }
.school { font-size: 11pt; font-weight: 700; }
.head h1 { margin-top: 4px; font-size: 32pt; line-height: 1.05; }
.term { flex: none; text-align: right; white-space: nowrap; }
.term p { font-size: 10.5pt; font-weight: 700; }
.term .quiet { font-weight: 400; font-size: 9.5pt; }
.people { display: flex; flex-wrap: wrap; gap: 0.1in 0.4in; padding: 0.14in 0; border-top: 0.6pt solid var(--grid); border-bottom: 0.6pt solid var(--grid); }
.people div { display: flex; flex-direction: column; }
.people dd { font-size: 11pt; }
.result { display: grid; grid-template-columns: 2.2in 1fr; gap: 0.4in; margin-top: 0.4in; align-items: stretch; }
.grade { min-height: 2.2in; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 4px; padding: 0.24in 0.2in; border: 1.5pt solid var(--accent); border-radius: 10px; text-align: center; }
.gradeValue { font-family: "WB Display", Georgia, serif; font-variation-settings: "SOFT" 50, "WONK" 0; font-weight: 600; font-size: 56pt; line-height: 1; color: var(--accent); }
.gradeBlank { font-size: 11pt; color: var(--muted); padding: 0.2in 0; }
.measures { display: flex; flex-direction: column; justify-content: space-between; gap: 0.16in; }
.measure { display: grid; grid-template-columns: 1.95in 1fr; align-items: baseline; gap: 0.2in; padding-bottom: 0.12in; border-bottom: 0.6pt solid var(--grid); }
.measure:last-child { border-bottom: 0; padding-bottom: 0; }
.measure dd { font-family: "WB Display", Georgia, serif; font-variation-settings: "SOFT" 50, "WONK" 0; font-weight: 560; font-size: 20pt; line-height: 1.1; }
.measure dd small { font-family: "WB Reading", system-ui, sans-serif; font-size: 9.5pt; font-weight: 400; color: var(--muted); }
.strip { position: relative; display: block; height: 0.34in; margin: 8px 0.1in 0 0.04in; }
.strip::before { content: ""; position: absolute; left: 0; right: 0; top: 0.08in; border-top: 0.8pt solid var(--rule-strong); }
.tick { position: absolute; top: 0.04in; height: 0.08in; border-left: 0.8pt solid var(--rule-strong); }
.tick span { position: absolute; top: 0.11in; transform: translateX(-50%); font-family: "WB Reading", system-ui, sans-serif; font-size: 7pt; font-weight: 700; color: var(--muted); }
.range { position: absolute; top: 0.025in; height: 0.11in; border-radius: 0.055in; background: color-mix(in srgb, var(--accent) 38%, #fff); box-shadow: inset 0 0 0 0.8pt var(--accent); min-width: 0.11in; }
.comments { margin-top: 0.42in; }
.comments .line { height: 0.38in; border-bottom: 0.6pt solid var(--rule-strong); }
.foot { margin-top: auto; padding-top: 0.2in; border-top: 0.6pt solid var(--grid); }
.signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5in; margin-top: 0.5in; }
.signatures span { display: block; padding-top: 4px; border-top: 0.8pt solid var(--ink); font-size: 8pt; color: var(--muted); }
`;

function card(
  data: ReportCardsResponse,
  student: ReportCardsInput["students"][number],
  today: string,
) {
  const place = data.family
    ? (data.family.displayName ?? "Your family")
    : data.school;
  const decider = data.family
    ? (data.family.parentName ?? "the parent")
    : "the teacher";
  const role = data.family ? "Parent" : "Teacher";
  const course = data.family
    ? (data.family.displayName ?? "Your family")
    : data.class.name.includes(data.class.course)
      ? data.class.name
      : `${data.class.name}, ${data.class.course}`;
  const people = [
    { label: data.family ? "Family" : "Course", value: course },
    ...(data.family
      ? data.family.parentName
        ? [{ label: "Parent", value: data.family.parentName }]
        : []
      : data.teachers.length
        ? [
            {
              label: data.teachers.length === 1 ? "Teacher" : "Teachers",
              value: data.teachers.join(", "),
            },
          ]
        : []),
    ...(student.identifier
      ? [{ label: "Student ID", value: student.identifier }]
      : []),
  ]
    .map(
      (p) =>
        `<div><dt class="label">${esc(p.label)}</dt><dd>${esc(p.value)}</dd></div>`,
    )
    .join("");
  const level =
    student.levelFrom === null || student.levelTo === null
      ? `<dd><small>Not enough work yet</small></dd>`
      : `<dd>${esc(levelWords(student.levelFrom))} <small>to</small> ${student.levelTo.toFixed(1)}${levelStrip(student.levelFrom, student.levelTo)}</dd>`;
  return `<article class="card">${masthead("Report card", dayWords(today))}
<div class="head"><div><p class="school">${esc(place)}</p><h1>${esc(student.name)}</h1></div><div class="term"><p>${esc(data.term.name)}</p><p class="quiet">${dayWords(data.term.startsOn, "short")} to ${dayWords(data.term.endsOn, "short")}</p></div></div>
<dl class="people">${people}</dl>
<div class="result"><div class="grade"><span class="label">Final grade</span>${student.final ? `<span class="gradeValue">${esc(student.final)}</span>` : `<span class="gradeBlank">Not entered yet</span>`}</div>
<dl class="measures"><div class="measure"><dt class="label">Active minutes</dt><dd>${count(student.minutes)}</dd></div><div class="measure"><dt class="label">Skills shown on their own</dt><dd>${count(student.objectivesGained)}</dd></div><div class="measure"><dt class="label">Working level at term end</dt>${level}</div></dl></div>
<div class="comments"><span class="label">${role}’s comments</span>${'<div class="line"></div>'.repeat(4)}</div>
<div class="foot"><p class="note">Final grades are decided by ${esc(decider)}. AMP measures growth and time on task, and its evidence is available from ${esc(decider)} on request.</p><div class="signatures"><span>${role}</span><span>Parent or guardian</span></div></div></article>`;
}

export function reportCardsHtml(input: ReportCardsInput) {
  const html = printDocument({
    title: `${input.data.family ? (input.data.family.displayName ?? "Your family") : input.data.class.name}: report cards, ${input.data.term.name}`,
    paper: input.paper,
    css: CSS,
    body: `<div class="paper-${input.paper}">${input.students.map((s) => card(input.data, s, input.today)).join("")}</div>`,
  });
  return {
    html,
    footer: pageFooter(
      `AMP · Report card · ${input.data.family ? (input.data.family.displayName ?? "Your family") : input.data.school} · ${input.data.term.name}`,
    ),
  };
}
