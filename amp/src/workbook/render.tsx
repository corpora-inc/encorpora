import React, { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { brand } from "../brand";
import { LessonIllustration } from "../content/LessonIllustration";
import { PrintMathText } from "../content/PrintMathText";
import { printMathCss } from "../content/print-fonts";
import {
  PrintExerciseBody,
  printFigureCss,
  printTokens,
  publicationCss,
} from "../content/print-exercise";
import type { Lesson } from "../content/lessons";
import type { GeneratedProblem } from "../math/contracts";
import { figureChoiceName } from "../math/figure-choice";
import { answerText } from "../math/selection-response";
import { Figure } from "../web/Figure";
import {
  workbookCode,
  workbookMinutes,
  workbookProblems,
  type SectionKind,
  type WorkbookItem,
  type WorkbookSpec,
} from "./compose";

export type PaperSize = "letter" | "a4";

const sectionCopy: Record<SectionKind, { title: string; note: string }> = {
  "warm-up": { title: "Warm-up", note: "Quick problems to start." },
  lesson: { title: "Today's idea", note: "" },
  practice: { title: "Practice", note: "Show your work in the space." },
  review: { title: "Review", note: "Ideas from earlier." },
  challenge: {
    title: "Challenge",
    note: "Take your time. A picture, a table or a simpler case can help.",
  },
};

/** Responses answered in a box; the others are marked on the problem. */
const boxed = (problem: GeneratedProblem) =>
  problem.public.response.kind === "number" ||
  problem.public.response.kind === "fraction" ||
  problem.public.response.kind === "choice";

/** Typeset math never wraps, so a long formula needs the full width. */
const visibleLength = (tex: string) =>
  tex
    .replace(/\\(frac|dfrac)\{([^}]*)\}\{([^}]*)\}/g, "$2/$3")
    .replace(/\\[a-zA-Z]+|[{}$^_]/g, "").length;
function longestFormula(problem: GeneratedProblem): number {
  const r = problem.public.response;
  const texts = [
    problem.public.prompt,
    ...("options" in r ? r.options.map((o) => o.label) : []),
  ];
  return Math.max(
    0,
    ...texts.flatMap((t) =>
      [...t.matchAll(/\$([^$]+)\$/g)].map((m) => visibleLength(m[1]!)),
    ),
  );
}
/** Worked steps, tables and long formulas need the full width of the page. */
const fullWidth = (problem: GeneratedProblem) =>
  problem.public.response.kind === "structured-work" ||
  (problem.public.response.kind === "multi-part-choice" &&
    problem.public.response.layout === "table") ||
  longestFormula(problem) > 22;

/** Two problems to a row, row by row; a wide problem takes its own row. Each
 * row is one block a page break can fall before but never inside. */
function rows<T extends { problem: GeneratedProblem }>(
  single: boolean,
  entries: T[],
): T[][] {
  const out: T[][] = [];
  for (const entry of entries) {
    const last = out.at(-1);
    if (
      !single &&
      !fullWidth(entry.problem) &&
      last?.length === 1 &&
      !fullWidth(last[0]!.problem)
    )
      last.push(entry);
    else out.push([entry]);
  }
  return out;
}

/** Short options sit two across; longer ones take a line each. */
function shortChoices(problem: GeneratedProblem): boolean {
  const r = problem.public.response;
  if (r.kind !== "choice" && r.kind !== "multi-select") return false;
  return r.options.every((o) => visibleLength(o.label) <= 14);
}

const letters = "ABCDEFGHIJ";
/** The key names a printed option by its letter as well as its text. */
function keyAnswer(problem: GeneratedProblem): string {
  const r = problem.public.response;
  const text = answerText(r, problem.answer);
  if (r.kind === "choice") {
    const i = r.options.findIndex((o) => o.id === problem.answer);
    return `${letters[i]}. ${text}`;
  }
  if (r.kind === "multi-select") {
    const picked: string[] = JSON.parse(problem.answer);
    const named = r.options
      .map((o, i) => (picked.includes(o.id) ? letters[i] : null))
      .filter(Boolean);
    return `${named.join(", ")}. ${text}`;
  }
  if (r.kind === "figure-choice")
    return `${figureChoiceName(r, problem.answer)}. ${text}`;
  return text;
}

function Workspace({
  item,
  problem,
}: {
  item: WorkbookItem;
  problem: GeneratedProblem;
}) {
  return (
    <div
      className={`wb-work wb-work--${item.space}`}
      aria-label="Space to show your work"
    >
      {boxed(problem) && (
        <span className="wb-answer">
          <span>Answer</span>
          <span className="wb-answer-box" />
        </span>
      )}
    </div>
  );
}

function LessonCard({ lesson }: { lesson: Lesson }) {
  // One method section carries the idea: the first with a diagram, else the first.
  const method = lesson.sections.filter(
    (s) => (s.stage ?? "method") === "method",
  );
  const idea = method.find((s) => s.illustration) ?? method[0];
  const example = lesson.workedExample;
  return (
    <div className="wb-lesson">
      <h3 className="wb-lesson-title">
        <PrintMathText text={lesson.title} />
      </h3>
      <p className="wb-lesson-summary">
        <PrintMathText text={lesson.summary} />
      </p>
      {idea && (
        <div className="wb-lesson-idea">
          <div>
            {idea.paragraphs.slice(0, 3).map((p, i) => (
              <p key={i}>
                <PrintMathText text={p} />
              </p>
            ))}
          </div>
          {idea.illustration && (
            <LessonIllustration kind={idea.illustration} print />
          )}
        </div>
      )}
      <div className="wb-example">
        <h4>Worked example</h4>
        <p>
          <PrintMathText text={example.prompt} />
        </p>
        {example.figure && <Figure figure={example.figure} />}
        {example.choices && (
          <ol type="A" className="print-choices">
            {example.choices.map((c, i) => (
              <li key={i}>
                <PrintMathText text={c} />
              </li>
            ))}
          </ol>
        )}
        <ol className="wb-example-steps">
          {example.steps.map((s, i) => (
            <li key={i}>
              <PrintMathText text={s} />
            </li>
          ))}
        </ol>
        <p className="wb-example-answer">
          <strong>Answer:</strong>{" "}
          <PrintMathText
            text={[example.answer, example.answerUnit]
              .filter(Boolean)
              .join(" ")}
          />
        </p>
      </div>
      {lesson.pitfalls[0] && (
        <p className="wb-watch">
          <strong>Watch for:</strong>{" "}
          <PrintMathText text={lesson.pitfalls[0]} />
        </p>
      )}
    </div>
  );
}

function SectionHead({
  index,
  kind,
  subtitle,
}: {
  index: number;
  kind: SectionKind;
  subtitle?: ReactNode;
}) {
  const copy = sectionCopy[kind];
  return (
    <div className="wb-section-head">
      <span className="wb-section-number">{index}</span>
      <h2 className="wb-section-title">{copy.title}</h2>
      {(subtitle || copy.note) && (
        <span className="wb-section-note">{subtitle ?? copy.note}</span>
      )}
    </div>
  );
}

const dateLabel = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

/** The printable workbook: student pages, then a detachable answer key and
 * results page. Every problem is regenerated from the spec. */
export function workbookHtml(
  spec: WorkbookSpec,
  options: {
    lessons: readonly Lesson[];
    skillTitle: (skillId: string) => string;
    learnerName?: string;
    paper?: PaperSize;
  },
): string {
  const problems = workbookProblems(spec);
  const code = workbookCode(spec);
  const lessonById = new Map(options.lessons.map((l) => [l.id, l]));
  const numbered: {
    n: number;
    kind: SectionKind;
    item: WorkbookItem;
    problem: GeneratedProblem;
  }[] = [];
  let n = 0;
  for (const section of spec.sections)
    for (const item of section.items)
      numbered.push({
        n: n + 1,
        kind: section.kind,
        item,
        problem: problems[n++]!,
      });
  const exercise = (entry: (typeof numbered)[number]) => (
    <section
      key={entry.n}
      className={`exercise wb-item wb-item--${entry.kind}${
        shortChoices(entry.problem) ? " wb-item--short-choices" : ""
      }`}
    >
      <PrintExerciseBody
        number={entry.n}
        problem={entry.problem}
        solutions={false}
        workspace={<Workspace item={entry.item} problem={entry.problem} />}
      />
    </section>
  );
  const early = spec.level <= 2;
  const lessonSection = spec.sections.find((s) => s.kind === "lesson");
  const lesson = lessonSection?.lessonId
    ? lessonById.get(lessonSection.lessonId)
    : undefined;
  const body = (
    <article className={early ? "wb wb--early" : "wb"}>
      <header className="wb-head">
        <div>
          <p className="wb-brand">{brand.name} · Daily workbook</p>
          <p className="wb-meta">
            {dateLabel(spec.date)} · No. {spec.number} · About{" "}
            {Math.round(workbookMinutes(spec) / 5) * 5} minutes
          </p>
        </div>
        <p className="wb-name">
          {options.learnerName ? (
            options.learnerName
          ) : (
            <>
              Name <span className="wb-name-line" />
            </>
          )}
        </p>
      </header>
      <ol className="wb-plan" aria-label="Today's plan">
        {spec.sections.map((s) => (
          <li key={s.kind}>
            <strong>{sectionCopy[s.kind].title}</strong>
            {s.kind !== "lesson" && s.kind !== "challenge" && (
              <span> · {s.items.length}</span>
            )}
          </li>
        ))}
      </ol>
      {spec.sections.map((section, si) => {
        const entries = numbered.filter((e) => section.items.includes(e.item));
        return (
          <section
            key={section.kind}
            className={`wb-section wb-section--${section.kind}`}
          >
            <SectionHead index={si + 1} kind={section.kind} />
            {section.kind === "lesson" && lesson && (
              <LessonCard lesson={lesson} />
            )}
            {rows(section.kind === "challenge", entries).map((row, r) => (
              <div key={r} className="wb-row">
                {row.map(exercise)}
              </div>
            ))}
          </section>
        );
      })}
      <section className="wb-key">
        <div className="wb-key-head">
          <h2>Answer key</h2>
          <p>
            {dateLabel(spec.date)} · No. {spec.number} · {code}
          </p>
        </div>
        {lesson && (
          <p className="wb-parent">
            <strong>For the parent ({lesson.title}):</strong>{" "}
            <PrintMathText text={lesson.parentGuide} />
          </p>
        )}
        <div className="wb-key-list">
          {numbered.map((e) => (
            <div key={e.n} className="wb-key-item">
              <p className="wb-key-answer">
                <strong>{e.n}.</strong>{" "}
                <PrintMathText text={keyAnswer(e.problem)} />
              </p>
              <ol>
                {e.problem.explanation.map((step, i) => (
                  <li key={i}>
                    <PrintMathText text={step} />
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>
      <section className="wb-results">
        <div className="wb-key-head">
          <h2>Results</h2>
          <p>Workbook code {code}</p>
        </div>
        <table className="wb-results-table">
          <thead>
            <tr>
              <th scope="col">No.</th>
              <th scope="col">Section</th>
              <th scope="col">Idea</th>
              <th scope="col">Right</th>
              <th scope="col">Not yet</th>
            </tr>
          </thead>
          <tbody>
            {numbered.map((e) => (
              <tr key={e.n}>
                <td>{e.n}</td>
                <td>{sectionCopy[e.kind].title}</td>
                <td>{options.skillTitle(e.item.skillId)}</td>
                <td className="wb-mark">☐</td>
                <td className="wb-mark">☐</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </article>
  );
  const page =
    options.paper === "a4"
      ? "@page{size:A4;margin:14mm 13mm 18mm}"
      : "@page{size:letter;margin:0.55in 0.55in 0.75in}";
  return (
    "<!doctype html>" +
    renderToStaticMarkup(
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <title>{`${brand.name} daily workbook · ${spec.date} · No. ${spec.number}`}</title>
          <style>{printMathCss()}</style>
          <style>{printTokens()}</style>
          <style>{publicationCss}</style>
          <style>{printFigureCss()}</style>
          <style>{page + workbookCss}</style>
        </head>
        <body
          dangerouslySetInnerHTML={{ __html: renderToStaticMarkup(body) }}
        />
      </html>,
    )
  );
}

/** Chromium footer on every page: the workbook it belongs to and the page. */
export function workbookFooter(spec: WorkbookSpec): string {
  return `<div style="width:100%;font:7.5pt Arial,sans-serif;color:#5d6b63;padding:0 0.55in;display:flex;justify-content:space-between"><span>${brand.name} · ${spec.date} · No. ${spec.number} · ${workbookCode(spec)}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`;
}

const workbookCss = `
body{font-size:11pt;line-height:1.5;color:var(--color-on-surface)}
.wb-head{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;border:none;padding:0 0 10px;margin:0 0 10px;border-bottom:2.5px solid var(--color-primary);letter-spacing:0;font-size:inherit}
.wb-head p{margin:0}
.wb-brand{font-family:Georgia,serif;font-size:21pt;font-weight:bold;color:var(--color-primary);line-height:1.2}
.wb-meta{font-size:9.5pt;color:var(--color-muted-text);margin-top:2px!important}
.wb-name{font-size:11pt;white-space:nowrap}
.wb-name-line{display:inline-block;width:2.3in;border-bottom:1px solid var(--color-on-surface);margin-left:6px}
.wb-plan{display:flex;flex-wrap:wrap;gap:6px;list-style:none;padding:0;margin:0 0 6px;counter-reset:plan;font-size:9pt}
.wb-plan li{counter-increment:plan;border:1px solid var(--color-border-strong);border-radius:999px;padding:2px 10px 2px 4px;margin:0;color:var(--color-muted-text)}
.wb-plan li::before{content:counter(plan);display:inline-block;width:16px;height:16px;line-height:16px;border-radius:50%;text-align:center;font-weight:bold;font-size:8pt;margin-right:5px;color:var(--color-on-primary);background:var(--color-primary)}
.wb-plan strong{color:var(--color-on-surface)}
.wb-section{margin:14px 0 0}
.wb-section-head{display:flex;align-items:baseline;gap:10px;border-bottom:1px solid var(--color-border-strong);padding:0 0 4px;margin:0 0 4px;break-after:avoid}
.wb-section-number{display:inline-block;align-self:center;width:24px;height:24px;line-height:24px;border-radius:50%;text-align:center;font-weight:bold;font-size:11pt;color:var(--section-on);background:var(--section)}
.wb-section-title{font-family:Georgia,serif;font-size:16pt;margin:0;line-height:1.3}
.wb-section-note{font-size:9.5pt;color:var(--color-muted-text)}
.wb-section--warm-up{--section:var(--color-info-accent);--section-on:var(--color-on-primary)}
.wb-section--lesson{--section:var(--color-primary);--section-on:var(--color-on-primary)}
.wb-section--practice{--section:var(--color-strand-operations);--section-on:var(--color-on-primary)}
.wb-section--review{--section:var(--color-warning-accent);--section-on:var(--color-on-primary)}
.wb-section--challenge{--section:var(--color-danger-accent);--section-on:var(--color-on-primary)}
.wb-row{display:flex;gap:0.35in;break-inside:avoid;border-bottom:1px solid var(--color-border)}
.wb-row>.wb-item{flex:1 1 0;min-width:0;border-bottom:none}
.wb-item{margin:0;padding:8px 0 10px;border-bottom:1px solid var(--color-border)}
.wb-item>h2{font-size:11pt;font-weight:normal;line-height:1.5;margin:0 0 4px}
.wb-item .figure{max-height:2.6in;margin:8px auto}
/* Scene figures size themselves inline; paper caps them. */
.wb-item svg{max-width:100%!important;height:auto;max-height:2.4in!important}
.wb-row .wb-item svg{max-height:1.95in!important}
.wb-row .print-figure svg{max-height:0.9in!important}
.wb-row .wb-item .figure{max-height:1.45in;max-width:100%;margin:6px auto}
.wb-item .print-choices{grid-template-columns:minmax(0,1fr);column-gap:14px;row-gap:0;line-height:1.45;margin:4px 0;padding-left:22px}\n.wb-item--short-choices .print-choices{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}\n.wb-item .print-part-option{white-space:normal}
.wb-row .wb-answer-box{width:1.05in}
.wb-work{position:relative;margin-top:6px;border-radius:6px;background-image:radial-gradient(circle,var(--color-figure-grid) 0.9px,transparent 1.1px);background-size:0.25in 0.25in;background-position:center}
.wb-work--answer{height:0.45in;background:none}
.wb-work--standard{height:1.1in}
.wb-work--roomy{height:2.8in}
.wb-answer{position:absolute;right:0;bottom:0;display:flex;align-items:center;gap:6px;font-size:9pt;color:var(--color-muted-text)}
.wb-answer-box{display:inline-block;width:1.25in;height:0.38in;border:1.4px solid var(--color-on-surface);border-radius:5px;background:var(--color-figure-paper)}
.wb-lesson{border:1.4px solid var(--color-primary);border-radius:10px;padding:12px 16px;margin:8px 0 6px;break-inside:avoid}
.wb-lesson-title{font-size:13pt;margin:0 0 2px}
.wb-lesson-summary{margin:0 0 6px;color:var(--color-muted-text)}
.wb-lesson-idea{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:14px;align-items:center}
.wb-lesson-idea p{margin:0 0 6px}
.wb-lesson-idea svg,.wb-lesson-idea .figure{max-width:100%;max-height:2.3in}
.wb-example{border-top:1px solid var(--color-border);margin-top:8px;padding-top:6px}
.wb-example h4{margin:0 0 2px;font-size:10.5pt}
.wb-example p{margin:0 0 4px}
.wb-example-steps{margin:2px 0;padding-left:22px}
.wb-example-steps li{margin:1px 0}
.wb-example-answer{margin:4px 0 0!important}
.wb-watch{margin:8px 0 0;font-size:10pt}
.wb-key{break-before:page}
.wb-key-head{display:flex;justify-content:space-between;align-items:baseline;border-bottom:2.5px solid var(--color-primary);margin:0 0 10px}
.wb-key-head h2{font-family:Georgia,serif;font-size:18pt;margin:0}
.wb-key-head p{margin:0;font-size:9pt;color:var(--color-muted-text)}
.wb-parent{font-size:9.5pt;margin:0 0 10px}
.wb-key-list{columns:2;column-gap:0.35in;font-size:9pt;line-height:1.4}
.wb-key-item{break-inside:avoid;margin:0 0 8px}
.wb-key-answer{margin:0 0 2px}
.wb-key-item ol{margin:0;padding-left:18px;color:var(--color-muted-text)}
.wb-key-item li{margin:0}
.wb-key-item .figure{display:none}
.wb-results{break-before:page}
.wb-results-table{width:100%;border-collapse:collapse;font-size:9.5pt}
.wb-results-table th,.wb-results-table td{border:1px solid var(--color-border-strong);padding:5px 8px;text-align:left}
.wb-results-table th{background:var(--color-surface-sunken)}
.wb-mark{text-align:center!important;font-size:13pt;width:0.7in}
.wb--early{font-size:12.5pt}
.wb--early .wb-item>h2{font-size:13pt}
.wb--early .wb-work--answer{height:0.55in}
.wb--early .wb-work--standard{height:1.3in}
.wb--early .wb-answer-box{height:0.46in}
footer{display:none}
`;
