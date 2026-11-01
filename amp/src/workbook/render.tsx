import React, { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import QRCode from "qrcode";
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
import { glossaryEntry } from "../glossary/index";
import { termsIn } from "../glossary/link";
import type { GlossaryEntry } from "../glossary/types";
import { workbookFontCss } from "./fonts";
import { workbookLayoutScript } from "./layout-script";
import { workbookResultsUrl } from "./links";
import { resultLabel } from "./result-labels";

export type PaperSize = "letter" | "a4";

/** Print scale by working level: larger type and more room for young
 * learners, a calmer page for older ones. Never printed as a grade. */
export type WorkbookBand = "early" | "elementary" | "middle" | "high";
export const workbookBand = (level: number): WorkbookBand =>
  level <= 2
    ? "early"
    : level <= 5
      ? "elementary"
      : level <= 8
        ? "middle"
        : "high";

/** One sheet of paper. Each composed page is the whole sheet with the
 * margins as padding and @page margins of zero, so a browser's own print
 * header and footer have no room and stay off. The sheet is a hair shorter
 * than the paper so rounding never spills a blank page. */
export const pageGeometry: Record<
  PaperSize,
  {
    size: string;
    width: string;
    height: string;
    padding: string;
    /** Width inside the side margins, where blocks are measured. */
    content: string;
  }
> = {
  letter: {
    size: "letter",
    content: "7.3in",
    width: "8.5in",
    height: "10.98in",
    padding: "0.5in 0.6in 0.42in",
  },
  a4: {
    size: "A4",
    content: "182mm",
    width: "210mm",
    height: "296.5mm",
    padding: "12mm 14mm 10.5mm",
  },
};

const sectionCopy: Record<SectionKind, { title: string; note: string }> = {
  "warm-up": { title: "Warm-up", note: "Quick problems to start." },
  lesson: { title: "Today's idea", note: "Read the card, then try these." },
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
    (problem.public.response.layout === "table" ||
      problem.public.response.blanks.length >= 4)) ||
  longestFormula(problem) > 20;

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

/** How much spare page height a row may take as extra workspace, in inches. */
const growCap: Record<WorkbookItem["space"], number> = {
  answer: 1.1,
  standard: 1.6,
  roomy: 4.5,
};

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
      <div className="wb-work-grid" />
      {boxed(problem) && (
        <span className="wb-answer">
          <span className="wb-answer-label">Answer</span>
          <span className="wb-answer-box" />
        </span>
      )}
    </div>
  );
}

type Section = Lesson["sections"][number];
/** The card's one explanation: an illustrated method section if there is
 * one, otherwise the plain-words introduction, otherwise the first method. */
function cardSection(lesson: Lesson): Section | undefined {
  const all = [...lesson.sections, ...(lesson.closingSections ?? [])];
  const stage = (s: Section) => s.stage ?? "method";
  return (
    all.find((s) => s.illustration && stage(s) === "method") ??
    all.find((s) => s.illustration && stage(s) === "intuition") ??
    all.find((s) => s.illustration) ??
    all.find((s) => stage(s) === "intuition") ??
    all.find((s) => stage(s) === "method") ??
    all[0]
  );
}
/** Paragraphs that fit a card: at least one, then more while short. */
function cardParagraphs(section: Section): string[] {
  const out: string[] = [];
  let length = 0;
  for (const p of section.paragraphs) {
    if (out.length && (length + p.length > 560 || out.length >= 3)) break;
    out.push(p);
    length += p.length;
  }
  return out;
}

/** Glossary words the card's own text uses, in first-use order, at most
 * six: the lesson's senses decide ambiguous words. */
export function cardWords(lesson: Lesson): GlossaryEntry[] {
  const section = cardSection(lesson);
  const example = lesson.workedExample;
  const texts = [
    lesson.title,
    lesson.summary,
    ...(section ? cardParagraphs(section) : []),
    example.prompt,
    ...example.steps,
    example.answer,
    lesson.pitfalls[0] ?? "",
  ];
  const context = { senses: lesson.senses, noLink: lesson.noLink };
  const ids: string[] = [];
  for (const text of texts)
    for (const id of termsIn(text, context))
      if (!ids.includes(id)) ids.push(id);
  return ids.slice(0, 6).map(glossaryEntry);
}

function LessonCard({ lesson }: { lesson: Lesson }) {
  const section = cardSection(lesson);
  const example = lesson.workedExample;
  const words = cardWords(lesson);
  const visual = section?.illustration;
  const idea = section && (
    <div className="wb-lesson-idea">
      <h4 className="wb-lesson-label">The idea</h4>
      {cardParagraphs(section).map((p, i) => (
        <p key={i} data-trim={i > 0 ? "1" : undefined}>
          <PrintMathText text={p} />
        </p>
      ))}
    </div>
  );
  const worked = (
    <div className="wb-example">
      <h4 className="wb-lesson-label">Worked example</h4>
      <p className="wb-example-prompt">
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
        <span className="wb-example-answer-label">Answer</span>{" "}
        <PrintMathText
          text={[example.answer, example.answerUnit].filter(Boolean).join(" ")}
        />
      </p>
    </div>
  );
  return (
    <div className={`wb-lesson${visual ? " wb-lesson--visual" : ""}`}>
      <h3 className="wb-lesson-title">
        <PrintMathText text={lesson.title} />
      </h3>
      <p className="wb-lesson-summary">
        <PrintMathText text={lesson.summary} />
      </p>
      {visual ? (
        <>
          <div className="wb-lesson-grid">
            {idea}
            <div className="wb-lesson-visual" data-trim="3">
              <LessonIllustration kind={visual} print />
            </div>
          </div>
          {worked}
        </>
      ) : (
        <div className="wb-lesson-grid">
          {idea}
          {worked}
        </div>
      )}
      {words.length > 0 && (
        <div className="wb-words" data-trim="4">
          <h4 className="wb-lesson-label">Words to know</h4>
          <dl>
            {words.map((w) => (
              <div key={w.id}>
                <dt>{w.term}</dt>
                <dd>
                  <PrintMathText text={w.plain} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {lesson.pitfalls[0] && (
        <p className="wb-watch" data-trim="2">
          <span className="wb-watch-label">Watch for</span>{" "}
          <PrintMathText text={lesson.pitfalls[0]} />
        </p>
      )}
    </div>
  );
}

const range = (numbers: number[]) =>
  numbers.length === 1
    ? `Problem ${numbers[0]}`
    : `Problems ${numbers[0]}–${numbers.at(-1)}`;
const aboutMinutes = (minutes: number) =>
  `about ${Math.max(1, Math.round(minutes))} min`;

function SectionHead({
  index,
  kind,
  numbers,
  minutes,
}: {
  index: number;
  kind: SectionKind;
  numbers: number[];
  minutes: number;
}) {
  const copy = sectionCopy[kind];
  return (
    <div className={`wb-section-head wb-sec--${kind}`} data-keep-next="">
      <span className="wb-section-number" aria-hidden="true">
        {index}
      </span>
      <div className="wb-section-text">
        <h2 className="wb-section-title">{copy.title}</h2>
        <p className="wb-section-note">{copy.note}</p>
      </div>
      <p className="wb-section-meta">
        {range(numbers)}
        <br />
        {aboutMinutes(minutes)}
      </p>
    </div>
  );
}

const dateLabel = (date: string, style: "long" | "short" = "long") =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: style === "long" ? "long" : "short",
    year: "numeric",
    month: style === "long" ? "long" : "short",
    day: "numeric",
    timeZone: "UTC",
  });

/** AMP's wave mark, from the app icon. */
function Mark() {
  return (
    <svg
      className="wb-mark"
      viewBox="40 100 432 312"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M56 256 C106 256 106 116 156 116 S206 396 256 396 S306 116 356 116 S406 256 456 256" />
    </svg>
  );
}

/** A QR code as one SVG path, drawn from the qrcode package's module matrix. */
function QrCode({ text }: { text: string }) {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const quiet = 4;
  let d = "";
  for (let row = 0; row < size; row++)
    for (let col = 0; col < size; col++)
      if (qr.modules.get(row, col))
        d += `M${col + quiet} ${row + quiet}h1v1h-1z`;
  const full = size + quiet * 2;
  return (
    <svg
      className="wb-qr"
      viewBox={`0 0 ${full} ${full}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label="QR code that opens this workbook's results in AMP"
    >
      <rect className="wb-qr-paper" width={full} height={full} />
      <path className="wb-qr-ink" d={d} />
    </svg>
  );
}

export interface WorkbookHtmlOptions {
  lessons: readonly Lesson[];
  skillTitle: (skillId: string) => string;
  learnerName?: string;
  paper?: PaperSize;
  /** Where results are entered; prints a QR code on the results page. */
  results?: { baseUrl: string; learnerId: string; workbookId: string };
}

/** The printable workbook: student pages, then a detachable answer key and
 * results page. Every problem is regenerated from the spec. The browser that
 * prints it composes the pages (`layout-script.ts`); print with
 * `printWorkbookPdf` (`pdf.ts`), which waits for that. */
export function workbookHtml(
  spec: WorkbookSpec,
  options: WorkbookHtmlOptions,
): string {
  const problems = workbookProblems(spec);
  const code = workbookCode(spec);
  const band = workbookBand(spec.level);
  const early = band === "early";
  const paper = pageGeometry[options.paper ?? "letter"];
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
  const lessonSection = spec.sections.find((s) => s.kind === "lesson");
  const lesson = lessonSection?.lessonId
    ? lessonById.get(lessonSection.lessonId)
    : undefined;
  const totalMinutes = Math.round(workbookMinutes(spec) / 5) * 5;
  const sectionMinutes = (kind: SectionKind) => {
    const s = spec.sections.find((x) => x.kind === kind)!;
    return (
      s.items.reduce((m, i) => m + i.minutes, 0) + (kind === "lesson" ? 5 : 0)
    );
  };

  const exercise = (entry: (typeof numbered)[number]) => (
    <section
      key={entry.n}
      className={`exercise wb-item wb-sec--${entry.kind}${
        shortChoices(entry.problem) ? " wb-item--short-choices" : ""
      }`}
    >
      <PrintExerciseBody
        number={entry.n}
        numberLabel={
          <span className="wb-num" aria-label={`Problem ${entry.n}`}>
            {entry.n}
          </span>
        }
        problem={entry.problem}
        solutions={false}
        drawnBoxes
        workspace={<Workspace item={entry.item} problem={entry.problem} />}
      />
    </section>
  );

  const masthead = (
    <header className="wb-masthead">
      <div className="wb-mast-top">
        <span className="wb-brand">
          <Mark />
          <span className="wb-brand-name">{brand.name}</span>
          <span className="wb-brand-kind">Daily workbook</span>
        </span>
        <span className="wb-mast-date">{dateLabel(spec.date)}</span>
      </div>
      <div className="wb-mast-main">
        <p className="wb-name">
          {options.learnerName ? (
            <span className="wb-name-text">{options.learnerName}</span>
          ) : (
            <>
              <span className="wb-name-label">Name</span>
              <span className="wb-name-line" />
            </>
          )}
        </p>
        <dl className="wb-facts">
          <div>
            <dt>Workbook</dt>
            <dd>No. {spec.number}</dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd>About {totalMinutes} min</dd>
          </div>
          <div>
            <dt>Problems</dt>
            <dd>{numbered.length}</dd>
          </div>
        </dl>
      </div>
      <ol className="wb-plan" aria-label="Today's plan">
        {spec.sections.map((s, i) => (
          <li key={s.kind} className={`wb-sec--${s.kind}`}>
            <span className="wb-plan-top">
              <span className="wb-plan-number" aria-hidden="true">
                {i + 1}
              </span>
              <span className="wb-plan-check" aria-hidden="true" />
            </span>
            <span className="wb-plan-text">
              <strong>{sectionCopy[s.kind].title}</strong>
              <span className="wb-plan-detail">
                {s.kind === "lesson" && lesson ? (
                  <PrintMathText text={lesson.title} />
                ) : s.items.length === 1 ? (
                  "1 problem"
                ) : (
                  `${s.items.length} problems`
                )}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </header>
  );

  const studentBlocks: ReactNode[] = [
    <div key="masthead" className="wb-block">
      {masthead}
    </div>,
  ];
  spec.sections.forEach((section, si) => {
    const entries = numbered.filter((e) => section.items.includes(e.item));
    const group = section.kind === "lesson" ? "lesson" : undefined;
    studentBlocks.push(
      <SectionHead
        key={`${section.kind}-head`}
        index={si + 1}
        kind={section.kind}
        numbers={entries.map((e) => e.n)}
        minutes={sectionMinutes(section.kind)}
      />,
    );
    if (section.kind === "lesson" && lesson)
      studentBlocks.push(
        <div
          key="lesson-card"
          className="wb-block wb-lesson-block"
          data-group={group}
          data-fit=""
        >
          <LessonCard lesson={lesson} />
        </div>,
        // Shown only when the card's page has room to spare (layout-script).
        <div
          key="lesson-try"
          className="wb-row wb-try"
          data-optional=""
          data-grow="7"
        >
          <div className="wb-try-inner">
            <p className="wb-try-label">
              <span className="wb-lesson-label">Your turn</span> Cover the
              worked example and solve it here. Then check each step.
            </p>
            <div
              className="wb-work wb-work--standard"
              aria-label="Space to work the example"
            />
          </div>
        </div>,
      );
    rows(section.kind === "challenge", entries).forEach((row, r) =>
      studentBlocks.push(
        <div
          key={`${section.kind}-${r}`}
          className="wb-row"
          data-group={group}
          data-grow={Math.max(...row.map((e) => growCap[e.item.space]))}
        >
          {row.map(exercise)}
        </div>,
      ),
    );
  });

  const keyBlocks: ReactNode[] = [
    <div key="key-head" className="wb-key-head" data-key-head="">
      <div className="wb-page-title">
        <h2>Answer key</h2>
        <p>
          {dateLabel(spec.date)} · No. {spec.number} · {code}
        </p>
      </div>
      <div className="wb-parent">
        <p className="wb-parent-label">For the grown-up</p>
        {lesson && (
          <p>
            <strong>
              Today's idea: <PrintMathText text={lesson.title} />.
            </strong>{" "}
            <PrintMathText text={lesson.parentGuide} />
          </p>
        )}
        <p>
          Check each answer with the steps below, then mark the results page. A
          problem marked "not yet" comes back in a later workbook.
        </p>
      </div>
    </div>,
  ];
  for (const section of spec.sections) {
    const entries = numbered.filter((e) => section.items.includes(e.item));
    entries.forEach((e, i) => {
      if (i === 0)
        keyBlocks.push(
          <p
            key={`${section.kind}-label`}
            className={`wb-key-section wb-sec--${section.kind}`}
            data-keep-next=""
          >
            {sectionCopy[section.kind].title}
          </p>,
        );
      keyBlocks.push(
        <div key={e.n} className={`wb-key-item wb-sec--${e.kind}`}>
          <p className="wb-key-answer">
            <span className="wb-key-num">{e.n}</span>
            <span className="wb-key-answer-text">
              <PrintMathText text={keyAnswer(e.problem)} />
            </span>
          </p>
          <ol className="wb-key-steps">
            {e.problem.explanation.map((step, j) => (
              <li key={j}>
                <PrintMathText text={step} />
              </li>
            ))}
          </ol>
        </div>,
      );
    });
  }

  const resultsUrl = options.results
    ? workbookResultsUrl(options.results)
    : undefined;
  const resultsBlocks: ReactNode[] = [
    <div key="results-head" className="wb-page-title">
      <h2>Results</h2>
      <p>
        {dateLabel(spec.date)} · No. {spec.number}
      </p>
    </div>,
    <div key="results-intro" className="wb-results-intro">
      <ol className="wb-results-steps">
        <li>Check each problem with the answer key.</li>
        <li>
          Tick <strong>Right</strong> or <strong>Not yet</strong> for each one.
        </li>
        <li>
          {resultsUrl
            ? "Scan the code to enter the marks in AMP."
            : "Enter the marks in AMP with the workbook code."}
        </li>
      </ol>
      <div className="wb-results-code">
        {resultsUrl && <QrCode text={resultsUrl} />}
        <p className="wb-code-label">Workbook code</p>
        <p className="wb-code">{code}</p>
      </div>
    </div>,
    <div
      key="results-grid"
      className={`wb-results-grid${numbered.length > 18 ? " wb-results-grid--dense" : ""}`}
    >
      {spec.sections.map((section) => {
        const entries = numbered.filter((e) => section.items.includes(e.item));
        return (
          <div
            key={section.kind}
            className={`wb-results-section wb-sec--${section.kind}`}
          >
            <p className="wb-results-section-title">
              {sectionCopy[section.kind].title}
            </p>
            <ul className="wb-tiles">
              {entries.map((e) => (
                <li key={e.n} className="wb-tile">
                  <span className="wb-tile-num">{e.n}</span>
                  <span className="wb-tile-skill">
                    {resultLabel(e.item.templateId)}
                  </span>
                  <span className="wb-tile-marks">
                    <span className="wb-tick">
                      <span className="wb-box" />
                      Right
                    </span>
                    <span className="wb-tick">
                      <span className="wb-box" />
                      Not yet
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>,
    <div key="results-total" className="wb-results-total">
      <span>
        Right <span className="wb-fill" /> of {numbered.length}
      </span>
      <span>
        Time spent <span className="wb-fill" /> min
      </span>
    </div>,
  ];

  const footBase = `${brand.name} · Daily workbook · ${dateLabel(spec.date, "short")} · No. ${spec.number} · ${code}`;
  const body = (
    <article
      className={`wb wb--${band}`}
      data-foot={footBase}
      data-foot-key={`Answer key · ${footBase}`}
      data-foot-results={`Results · ${footBase}`}
    >
      <div className="wb-flow" data-flow="student">
        {studentBlocks}
      </div>
      <div className="wb-flow wb-flow--key" data-flow="key">
        {keyBlocks}
      </div>
      <div className="wb-flow wb-flow--results" data-flow="results">
        {resultsBlocks}
      </div>
    </article>
  );
  return documentHtml({
    title: `${brand.name} daily workbook · ${spec.date} · No. ${spec.number}`,
    early,
    paper,
    body,
  });
}

/** The printable document around a workbook body: embedded fonts and
 * styles, the page geometry and the page composition script. */
function documentHtml(options: {
  title: string;
  early: boolean;
  paper: (typeof pageGeometry)[PaperSize];
  body: ReactNode;
}): string {
  const { paper, early } = options;
  const pageCss =
    `@page{size:${paper.size};margin:0}` +
    `@page wb-flow{size:${paper.size};margin:${paper.padding}}` +
    `:root{--sheet-w:${paper.width};--sheet-h:${paper.height};--sheet-pad:${paper.padding};--content-w:${paper.content}}`;
  return (
    "<!doctype html>" +
    renderToStaticMarkup(
      <html lang="en" data-compose="">
        <head>
          <meta charSet="utf-8" />
          <title>{options.title}</title>
          <style>{workbookFontCss(early)}</style>
          <style>{printMathCss()}</style>
          <style>{printTokens()}</style>
          <style>{publicationCss}</style>
          <style>{printFigureCss()}</style>
          <style>{pageCss + workbookCss}</style>
        </head>
        <body>
          <div
            dangerouslySetInnerHTML={{
              __html: renderToStaticMarkup(options.body),
            }}
          />
          <script dangerouslySetInnerHTML={{ __html: workbookLayoutScript }} />
        </body>
      </html>,
    )
  );
}

/** Every lesson card as it would print at one working level, each after its
 * section heading, composed by the same layout: the check that no card is
 * taller than a page (`verify-workbook-layout.ts`). */
export function lessonCardProofHtml(
  lessons: readonly Lesson[],
  options: { level: number; paper?: PaperSize },
): string {
  const band = workbookBand(options.level);
  const body = (
    <article
      className={`wb wb--${band}`}
      data-foot="Lesson card proof"
      data-foot-key="Lesson card proof"
      data-foot-results="Lesson card proof"
    >
      <div className="wb-flow" data-flow="student">
        {lessons.flatMap((lesson) => [
          <SectionHead
            key={`${lesson.id}-head`}
            index={2}
            kind="lesson"
            numbers={[1]}
            minutes={5}
          />,
          <div
            key={lesson.id}
            className="wb-block wb-lesson-block"
            data-fit=""
            data-lesson={lesson.id}
          >
            <LessonCard lesson={lesson} />
          </div>,
        ])}
      </div>
    </article>
  );
  return documentHtml({
    title: "Lesson card proof",
    early: band === "early",
    paper: pageGeometry[options.paper ?? "letter"],
    body,
  });
}

/** Footers are composed into each page by the layout; a browser footer
 * template would print a second one. Kept for callers that still pass it. */
export function workbookFooter(_spec: WorkbookSpec): string {
  return "";
}

const workbookCss = `
/* Tokens by band. Paper is plain white: figures and answer boxes never
   carry a cream tint. */
.wb{--color-figure-paper:var(--color-answer);--color-figure-empty:var(--color-answer);--ink:var(--color-on-surface);--muted:var(--color-muted-text);--rule:var(--color-border);--rule-strong:var(--color-border-strong);--accent:var(--color-primary);
--body:11pt;--prompt:11.5pt;--small:9pt;--h-section:17pt;--h-card:15pt;--num:0.27in;--gutter:0.4in;--gap:0.3in;--radius:7px;--soft:30;--display-weight:560;
--work-answer:0.48in;--work-standard:1.2in;--work-roomy:2.4in;--answer-w:1.15in;--answer-h:0.4in;
--grid:0.25in;--grid-line:color-mix(in srgb,var(--color-figure-grid) 80%,transparent);
font-family:"WB Reading",Arial,Helvetica,sans-serif;font-size:var(--body);line-height:1.45;color:var(--ink);font-variant-numeric:lining-nums}
.wb--early{--body:14pt;--prompt:15pt;--small:10.5pt;--h-section:23pt;--h-card:19pt;--num:0.38in;--gutter:0.52in;--gap:0.34in;--radius:14px;--soft:100;--display-weight:640;
--work-answer:0.66in;--work-standard:1.35in;--work-roomy:2.6in;--answer-w:1.35in;--answer-h:0.56in;font-family:"WB Early","WB Reading",Arial,sans-serif;line-height:1.4}
.wb--elementary{--body:12pt;--prompt:12.5pt;--small:9.5pt;--h-section:19pt;--h-card:16pt;--num:0.3in;--gutter:0.44in;--radius:10px;--soft:100;--display-weight:600;--work-answer:0.54in;--work-standard:1.25in}
.wb--middle{--soft:50}
.wb--high{--body:10.75pt;--prompt:11pt;--h-section:16pt;--h-card:14pt;--num:0.26in;--radius:4px;--soft:0;--display-weight:520;--work-standard:1.3in;--grid:0.2in}
.wb-sec--warm-up{--section:var(--color-info-accent)}
.wb-sec--lesson{--section:var(--color-primary)}
.wb-sec--practice{--section:var(--color-strand-operations)}
.wb-sec--review{--section:var(--color-warning-accent)}
.wb-sec--challenge{--section:var(--color-danger-accent)}
.wb--high .wb-sec--warm-up,.wb--high .wb-sec--practice,.wb--high .wb-sec--review,.wb--high .wb-sec--challenge{--section:var(--color-primary)}
body{margin:0}
.wb h2,.wb h3,.wb h4{letter-spacing:0}
.wb .wb-display,.wb-section-title,.wb-lesson-title,.wb-page-title h2,.wb-brand-name,.wb-name-text{font-family:"WB Display",Georgia,serif;font-variation-settings:"SOFT" var(--soft),"WONK" 0;font-weight:var(--display-weight);letter-spacing:0}

/* Pages. */
.wb-page{position:relative;width:var(--sheet-w);height:var(--sheet-h);padding:var(--sheet-pad);display:flex;flex-direction:column;break-after:page;break-inside:avoid;box-sizing:border-box}
.wb-page:last-child{break-after:auto}
.wb-page-body{flex:1 1 auto;min-height:0}
.wb-page-content{display:flow-root}
.wb-page-foot{flex:none;display:flex;justify-content:space-between;align-items:center;gap:16px;border-top:1px solid var(--rule);padding-top:5px;margin-top:4px;font-family:"WB Reading",Arial,sans-serif;font-size:8pt;line-height:1.3;color:var(--muted)}
.wb-foot-page{font-weight:700;color:var(--ink);white-space:nowrap}
@media screen{html{background:var(--color-surface-sunken)}.wb-pages{padding:24px 0}.wb-page{margin:0 auto 24px;background:var(--color-answer);box-shadow:0 1px 4px var(--color-border-strong)}}
/* Badges, grids and answer boxes print even with a browser's background
   graphics turned off. */
.wb,.wb *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
.wb-flow{page:wb-flow;width:var(--content-w)}
/* Unpaged fallback (no script): blocks flow with page-break rules. */
.wb-flow>*{break-inside:avoid}
.wb-flow--key,.wb-flow--results{break-before:page}
.wb-flow [data-keep-next]{break-after:avoid}

/* Masthead. */
.wb .wb-masthead{display:block;margin:0 0 0.16in;padding:0;border:none;letter-spacing:0;font-size:inherit}
.wb-mast-top{display:flex;justify-content:space-between;align-items:center;gap:16px;padding-bottom:6px;border-bottom:2.5px solid var(--accent)}
.wb-brand{display:inline-flex;align-items:center;gap:8px;color:var(--accent)}
.wb-mark{width:0.42in;height:0.3in;fill:none;stroke:currentColor;stroke-width:34;stroke-linecap:round}
.wb-brand-name{font-size:19pt;line-height:1;font-weight:700}
.wb-brand-kind{font-size:var(--small);font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--muted);padding-left:8px;border-left:1px solid var(--rule-strong)}
.wb-mast-date{font-size:var(--small);color:var(--muted);white-space:nowrap}
.wb-mast-main{display:flex;justify-content:space-between;align-items:flex-end;gap:0.3in;padding:0.14in 0 0.12in}
.wb-name{margin:0;display:flex;align-items:baseline;gap:10px;flex:1 1 auto;min-width:0}
.wb-name-label{font-size:var(--small);font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:var(--muted)}
.wb-name-line{flex:1 1 auto;max-width:3.6in;height:calc(var(--body) * 1.6);border-bottom:1.4px solid var(--ink)}
.wb-name-text{font-size:24pt;line-height:1.1}
.wb--early .wb-name-text{font-size:30pt}
.wb-facts{display:flex;gap:0.26in;margin:0}
.wb-facts div{display:flex;flex-direction:column}
.wb-facts dt{font-size:7.5pt;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--muted)}
.wb-facts dd{margin:0;font-size:calc(var(--body) * 1.02);font-weight:700;white-space:nowrap}
.wb-plan{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
.wb-plan li{margin:0;display:flex;flex-direction:column;gap:5px;padding:7px 9px 8px;border:1px solid var(--rule-strong);border-top:4px solid var(--section);border-radius:var(--radius);min-width:0}
.wb-plan-top{display:flex;justify-content:space-between;align-items:center}
.wb-plan-number{flex:none;display:inline-grid;place-items:center;width:0.22in;height:0.22in;border-radius:50%;background:var(--section);color:var(--color-on-primary);font-weight:700;font-size:8.5pt;line-height:1}
.wb-plan-text{display:flex;flex-direction:column;font-size:8.5pt;line-height:1.3}
.wb-plan-text strong{font-size:10pt;color:var(--ink);white-space:nowrap}
.wb-plan-detail{color:var(--muted)}
.wb-plan-check{flex:none;width:0.17in;height:0.17in;border:1.3px solid var(--rule-strong);border-radius:4px}
.wb--early .wb-plan-text{font-size:10pt}
.wb--early .wb-plan-text strong{font-size:12pt}
.wb--early .wb-plan-number{width:0.28in;height:0.28in;font-size:11pt}
.wb--early .wb-plan-check{width:0.24in;height:0.24in;border-radius:50%}
.wb--high .wb-plan li{border-top-width:2px}

/* Section openers. */
.wb-section-head{display:flex;align-items:center;gap:12px;margin:0.14in 0 0.06in;padding:0 0 6px;border-bottom:2px solid var(--section);break-after:avoid}
.wb-page-content>.wb-section-head:first-child{margin-top:0}
.wb-section-number{flex:none;display:inline-grid;place-items:center;width:calc(var(--h-section) * 1.55);height:calc(var(--h-section) * 1.55);border-radius:var(--radius);background:var(--section);color:var(--color-on-primary);font-family:"WB Display",Georgia,serif;font-variation-settings:"SOFT" var(--soft);font-weight:700;font-size:calc(var(--h-section) * 0.85);line-height:1}
.wb--early .wb-section-number{border-radius:50%}
.wb-section-text{flex:1 1 auto;min-width:0}
.wb-section-title{font-size:var(--h-section);line-height:1.1;margin:0;color:var(--ink)}
.wb-section-note{margin:2px 0 0;font-size:var(--small);color:var(--muted);line-height:1.35}
.wb-section-meta{flex:none;margin:0;text-align:right;font-size:var(--small);line-height:1.35;color:var(--muted);white-space:nowrap}

/* Problems. */
.wb-row{display:flex;gap:var(--gap);border-bottom:1px solid var(--rule);break-inside:avoid}
.wb .wb-item{position:relative;flex:1 1 0;min-width:0;display:flex;flex-direction:column;margin:0;padding:0.11in 0 0.12in var(--gutter);border-bottom:none;break-inside:avoid}
.wb .wb-item>h2{font-size:var(--prompt);font-weight:400;line-height:1.42;margin:0 0 4px;min-height:var(--num)}
.wb-num{position:absolute;left:0;top:0.1in;display:inline-grid;place-items:center;min-width:var(--num);height:var(--num);padding:0 3px;box-sizing:border-box;border-radius:calc(var(--radius) * 0.75);background:var(--section);color:var(--color-on-primary);font-family:"WB Reading",Arial,sans-serif;font-weight:800;font-size:calc(var(--num) * 0.5);line-height:1;font-variant-numeric:tabular-nums}
.wb--early .wb-num{border-radius:50%;font-size:calc(var(--num) * 0.48)}
.wb--high .wb-num{background:none;color:var(--accent);border:1.5px solid var(--accent)}
.wb-item .figure{max-height:2.6in;margin:8px auto}
/* Scene figures size themselves inline; paper caps them. Typeset math
   draws its own SVG (radicals, arrows) and must keep its sizes. */
.wb-item svg:not(.katex svg){max-width:100%!important;height:auto;max-height:2.4in!important}
.wb-row .wb-item svg:not(.katex svg){max-height:1.95in!important}
.wb-row .print-figure svg:not(.katex svg){max-height:0.9in!important}
.wb-row .wb-item .figure{max-height:1.45in;max-width:100%;margin:6px auto}
.wb-item .print-choices{grid-template-columns:minmax(0,1fr);column-gap:14px;row-gap:0;line-height:1.5;margin:4px 0;padding-left:24px}
.wb-item--short-choices .print-choices{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
.wb-item .print-choices li::marker{font-weight:700}
.wb-item .print-parts--grid{list-style:decimal;margin:6px 0 2px;padding-left:24px;line-height:1.4}
.wb-item .print-parts--grid>li{margin:0 0 7px}
.wb-item .print-parts--grid>li::marker{font-weight:700}
.print-part-label{display:block;margin:0 0 3px}
.print-part-options{display:grid;column-gap:14px;row-gap:5px}
.print-part-options--4{grid-template-columns:repeat(4,max-content)}
.print-part-options--2{grid-template-columns:repeat(2,minmax(0,1fr))}
.print-part-options--1{grid-template-columns:minmax(0,1fr)}
.wb-item .print-parts--grid .print-part-option{display:flex;align-items:baseline;gap:6px;margin:0;white-space:normal}
.wb-row .print-part-options--4{grid-template-columns:repeat(2,minmax(0,1fr))}
/* A full-width problem puts each blank's options beside its label. */
.wb-row>.wb-item:only-child .print-parts--grid>li{display:grid;grid-template-columns:fit-content(42%) minmax(0,1fr);column-gap:16px;align-items:baseline}
.wb-row>.wb-item:only-child .print-part-label{margin:0}
.wb-row>.wb-item:only-child .print-part-options--4{grid-template-columns:repeat(4,max-content)}
.wb-item:has(.print-work) .figure{max-height:1.8in}
/* Shown work is written in its table; extra room comes only from the page. */
.wb-item:has(.print-work,.print-work-order) .wb-work{min-height:var(--wb-grow,0px);margin-top:0}
.wb-item:has(.print-work) svg:not(.katex svg){max-height:1.8in!important}
.print-check{flex:none;display:inline-block;width:0.15in;height:0.15in;border:1.4px solid var(--ink);border-radius:3px;position:relative;top:0.02in;box-sizing:border-box}
.wb--early .print-check{width:0.2in;height:0.2in}
.print-part-text{min-width:0}
.wb-item .print-match td .print-check{top:0}
.wb--early .wb-item .print-choices{line-height:1.6}
.wb--early .wb-row .wb-item .figure{max-height:1.25in}
.wb--early .wb-row .wb-item svg:not(.katex svg){max-height:1.6in!important}

/* Workspace: a quiet grid sized to the work; spare page height is added by
   the layout (--wb-grow). Answer boxes sit at the bottom of the row. */
.wb-work{position:relative;flex:1 0 auto;display:flex;flex-direction:column;gap:6px;margin-top:6px;min-height:calc(var(--work-standard) + var(--wb-grow,0px))}
.wb-work-grid{flex:1 1 auto;min-height:0;border-radius:calc(var(--radius) * 0.6);
background-image:linear-gradient(var(--grid-line) 0.7px,transparent 0.7px),linear-gradient(90deg,var(--grid-line) 0.7px,transparent 0.7px);background-size:var(--grid) var(--grid);background-position:-0.35px -0.35px}
.wb-work--answer{min-height:calc(var(--work-answer) + var(--wb-grow,0px))}
.wb-work--roomy{min-height:calc(var(--work-roomy) + var(--wb-grow,0px))}
.wb--high .wb-work-grid{background-image:radial-gradient(circle,var(--color-border-strong) 0.6px,transparent 0.9px);background-size:var(--grid) var(--grid);background-position:center}
.wb--early .wb-work-grid{background-image:radial-gradient(circle,var(--grid-line) 1.3px,transparent 1.6px);background-size:0.36in 0.36in}
.wb .wb-row:not(.wb-row--roomy) .wb-work--answer .wb-work-grid{background:none}
.wb-answer{flex:none;align-self:flex-end;display:flex;align-items:center;gap:7px}
.wb-answer-label{font-size:var(--small);font-weight:700;color:var(--muted)}
.wb-answer-box{display:inline-block;width:var(--answer-w);height:var(--answer-h);border:1.5px solid var(--ink);border-radius:calc(var(--radius) * 0.6);background:var(--color-answer)}

/* Today's idea. */
.wb-lesson{border:1.5px solid var(--accent);border-radius:calc(var(--radius) * 1.3);padding:0.15in 0.18in 0.14in;margin:0.08in 0 0.04in;break-inside:avoid}
.wb-lesson-title{font-size:var(--h-card);line-height:1.2;margin:0;color:var(--accent)}
.wb-lesson-summary{margin:4px 0 0.1in;font-size:calc(var(--body) * 1.04);line-height:1.45}
.wb-lesson-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0.22in;align-items:start}
.wb-lesson--visual .wb-lesson-grid{align-items:center;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr)}
.wb-lesson-label{margin:0 0 3px;font-size:var(--small);font-weight:800;letter-spacing:0.07em;text-transform:uppercase;color:var(--accent)}
.wb-lesson-idea p{margin:0 0 5px}
.wb-lesson-visual{display:flex;justify-content:center;min-width:0}
.wb .wb-lesson [data-trimmed]{display:none}
.wb-lesson--stacked .wb-lesson-grid{grid-template-columns:minmax(0,1fr)!important}
.wb-lesson--stacked .wb-example{margin-top:0.08in}
.wb-lesson--visual:has(.wb-lesson-visual[data-trimmed]) .wb-lesson-grid{grid-template-columns:minmax(0,1fr)}
.wb-lesson-visual svg,.wb-lesson-visual .figure{max-width:100%;max-height:2.3in;margin:0 auto}
.wb-example{border:1px solid var(--rule-strong);border-radius:var(--radius);padding:0.1in 0.13in}
.wb-lesson--visual .wb-example{margin-top:0.1in}
.wb-example p{margin:0 0 4px}
.wb-example .figure{max-height:1.8in;margin:4px auto}
.wb-example-steps{list-style:none;counter-reset:step;margin:4px 0 6px;padding:0}
.wb-example-steps li{counter-increment:step;position:relative;margin:0 0 3px;padding-left:0.3in;line-height:1.42}
.wb-example-steps li::before{content:counter(step);position:absolute;left:0;top:0.02in;display:inline-grid;place-items:center;width:0.2in;height:0.2in;border-radius:50%;border:1.3px solid var(--accent);color:var(--accent);font-size:8pt;font-weight:800;line-height:1;box-sizing:border-box}
.wb--early .wb-example-steps li::before{width:0.26in;height:0.26in;font-size:10pt}
.wb--early .wb-example-steps li{padding-left:0.36in}
.wb-example-answer{margin:6px 0 0!important;font-weight:700}
.wb-example-answer-label,.wb-watch-label{display:inline-block;margin-right:6px;padding:1px 7px;border-radius:999px;font-size:var(--small);font-weight:800;letter-spacing:0.05em;text-transform:uppercase;line-height:1.5}
.wb-example-answer-label{background:var(--accent);color:var(--color-on-primary)}
.wb-words{margin:0.1in 0 0;padding:0.08in 0.12in 0.06in;border:1px solid var(--rule-strong);border-radius:var(--radius)}
.wb-words dl{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:0.22in;row-gap:3px;margin:2px 0 0}
.wb-words dl>div{display:block;min-width:0;font-size:calc(var(--body) * 0.9);line-height:1.38}
.wb-words dt{display:inline;font-weight:700;margin-right:5px}
.wb-words dd{display:inline;margin:0}
.wb--early .wb-words dl{grid-template-columns:minmax(0,1fr)}
.wb-watch{margin:0.1in 0 0;padding:0.06in 0 0.02in 0.12in;border-left:3px solid var(--color-danger-accent);font-size:calc(var(--body) * 0.96)}
.wb-watch-label{border:1.3px solid var(--color-danger-accent);color:var(--color-danger-accent)}

.wb-try{border-bottom:none}
.wb .wb-try .wb-work{min-height:calc(0.6in + var(--wb-grow,0px))}
.wb-try-inner{flex:1 1 auto;display:flex;flex-direction:column;padding:0.12in 0 0.04in}
.wb-try-label{margin:0 0 2px;font-size:var(--small);color:var(--muted)}
.wb-try-label .wb-lesson-label{display:inline;margin-right:6px}
.wb-flow>[data-optional]{display:none}

/* Answer key and results pages. */
.wb-page-title{display:flex;justify-content:space-between;align-items:baseline;gap:16px;padding-bottom:6px;margin:0 0 0.14in;border-bottom:2.5px solid var(--accent)}
.wb-page-title h2{margin:0;font-size:21pt;line-height:1.1;color:var(--accent);font-family:"WB Display",Georgia,serif}
.wb-page-title p{margin:0;font-size:9pt;color:var(--muted)}
.wb-flow--key,.wb-page--key,.wb-flow--results,.wb-page--results{font-family:"WB Reading",Arial,sans-serif}
.wb-parent{margin:0 0 0.16in;padding:0.1in 0.14in;border:1px solid var(--rule-strong);border-radius:var(--radius);font-size:9.5pt;line-height:1.45}
.wb-parent p{margin:0 0 3px}
.wb-parent p:last-child{margin:0}
.wb-parent-label{font-size:8pt!important;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:var(--accent)}
.wb-key-cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0.3in;align-items:start}
.wb-flow--key{font-size:9.5pt}
.wb-key-col,.wb-flow--key{font-size:9.5pt;line-height:1.42}
.wb-key-section{margin:0 0 6px;padding:2px 0 3px;border-bottom:1.5px solid var(--section);font-size:8pt;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:var(--section)}
.wb-key-item+.wb-key-section{margin-top:10px}
.wb-key-item{margin:0 0 9px;break-inside:avoid}
.wb-key-answer{display:flex;align-items:baseline;gap:8px;margin:0 0 2px;font-weight:700}
.wb-key-num{flex:none;display:inline-grid;place-items:center;min-width:0.22in;height:0.22in;padding:0 3px;box-sizing:border-box;border-radius:5px;background:var(--section);color:var(--color-on-primary);font-size:8.5pt;font-weight:800;line-height:1;position:relative;top:-1px}
.wb--high .wb-key-num{background:none;color:var(--accent);border:1.3px solid var(--accent)}
.wb-key-answer-text{min-width:0}
.wb-key-steps{margin:0;padding:0 0 0 calc(0.22in + 8px + 14px);color:var(--muted)}
.wb-key-steps li{margin:0 0 1px;padding:0}
.wb-key-item .figure{display:none}
.wb-results-intro{display:flex;justify-content:space-between;align-items:center;gap:0.3in;margin:0 0 0.16in}
.wb-results-steps{margin:0;padding-left:20px;font-size:11pt;line-height:1.6}
.wb-results-code{flex:none;display:flex;flex-direction:column;align-items:center;text-align:center;padding:0.1in 0.14in;border:1.5px solid var(--ink);border-radius:var(--radius)}
.wb-qr{width:1.25in;height:1.25in;display:block;margin:0 0 4px}
.wb-qr-paper{fill:var(--color-answer)}
.wb-qr-ink{fill:var(--ink)}
.wb-code-label{margin:0;font-size:7.5pt;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:var(--muted)}
.wb-code{margin:0;font-family:"WB Reading",Arial,sans-serif;font-size:15pt;font-weight:800;letter-spacing:0.08em;font-variant-numeric:tabular-nums}
.wb-results-grid{display:flex;flex-direction:column;gap:0.12in}
.wb-results-section-title{margin:0 0 4px;font-size:8pt;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:var(--section);border-bottom:1.5px solid var(--section);padding-bottom:2px}
.wb-tiles{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
.wb-tile{margin:0;display:grid;grid-template-columns:auto minmax(0,1fr);grid-template-rows:auto auto;column-gap:9px;row-gap:5px;align-items:center;padding:7px 9px;border:1px solid var(--rule-strong);border-radius:7px;break-inside:avoid}
.wb-tile-num{grid-row:1 / span 2;display:inline-grid;place-items:center;min-width:0.3in;height:0.3in;padding:0 3px;box-sizing:border-box;border-radius:5px;background:var(--section);color:var(--color-on-primary);font-weight:800;font-size:9.5pt;line-height:1}
.wb--high .wb-tile-num{background:none;color:var(--accent);border:1.3px solid var(--accent)}
.wb-tile-skill{font-size:8.5pt;line-height:1.25;color:var(--muted)}
.wb-tile-marks{display:flex;gap:12px;font-size:9pt;font-weight:700}
.wb-tick{display:inline-flex;align-items:center;gap:4px;white-space:nowrap}
.wb-box{display:inline-block;width:0.2in;height:0.2in;border:1.4px solid var(--ink);border-radius:4px}
.wb-results-grid--dense{gap:0.08in}
.wb-results-grid--dense .wb-tiles{grid-template-columns:repeat(4,minmax(0,1fr));gap:5px}
.wb-results-grid--dense .wb-tile{padding:5px 7px;row-gap:3px;column-gap:7px}
.wb-results-grid--dense .wb-tile-num{min-width:0.26in;height:0.26in;font-size:9pt}
.wb-results-grid--dense .wb-tile-marks{gap:8px;font-size:8.5pt}
.wb-results-grid--dense .wb-box{width:0.17in;height:0.17in}
.wb-results-total{display:flex;gap:0.5in;margin-top:0.2in;padding-top:0.12in;border-top:1px solid var(--rule-strong);font-size:11pt;font-weight:700}
.wb-fill{display:inline-block;width:0.8in;border-bottom:1.3px solid var(--ink);margin:0 4px}
footer{display:none}
`;
