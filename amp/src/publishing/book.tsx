import { RatioCover } from "./RatioCover.js";
import { UnitRegionCover } from "./UnitRegionCover.js";
import { earlyNumberPrintCss } from "./early-number-print.js";
import { MathText } from "./MathText.js";
export { MathText } from "./MathText.js";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { BookBlock, MathBook } from "./schema.js";
import { ArrayCover } from "./ArrayCover.js";
import { CoverFigure } from "./CoverFigure.js";
import { BookDiagram } from "./diagrams.js";
import { validateBook } from "./validate.js";
export const bookCss = `
.ratio-cover{margin:20px 0}.ratio-cover svg{display:block;width:100%;max-height:none!important}.ratio-cover figcaption{margin-top:9px}

.ratio-model-art{width:100%;max-width:4.6in;margin:auto}.ratio-tape-row{margin:5pt 0}.ratio-row-label{display:flex;flex-wrap:wrap;justify-content:space-between;gap:3pt 14pt;font:11pt Arial,sans-serif;margin:0 0 2pt}.ratio-row-label strong{white-space:normal}.ratio-tape-row svg{width:100%;display:block}.ratio-whole-label{font:11pt Arial,sans-serif;font-weight:bold;margin:4pt 0}.ratio-model-key{font:10pt/1.3 Arial,sans-serif;margin:5pt 0}.percent-grid-figure .ratio-model-art{max-width:3.5in}

.unit-region-art{max-width:4.3in;margin:auto}.unit-region-art svg{width:100%;display:block}.unit-region-key{font:10pt Arial,sans-serif;line-height:1.3;margin:4pt 0}
.early-number-art{max-width:4.2in;margin:auto}.early-number-art svg{width:100%;display:block}.early-collection-panels{display:grid;gap:8pt}.early-panel-label,.early-unit,.early-emphasis{font:11pt Arial,sans-serif;margin:4pt 0}.early-panel-label{font-weight:bold}

.cover-composition{margin:25px 0}.cover-composition svg{display:block;width:100%;font-family:Arial,sans-serif}.cover-number{font-size:68px;font-weight:700;fill:#16483f}.cover-kicker{font-size:13px;letter-spacing:2px;font-weight:700;fill:#16483f}.cover-caption{font-size:13px;fill:#16483f}.inline-fraction{display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;line-height:1.05;font-size:.83em;margin:0 .12em;min-width:.6em;white-space:nowrap}.inline-fraction>span:first-child{border-bottom:1px solid currentColor;padding:0 .13em .07em}.inline-fraction>span:last-child{padding:.07em .13em 0}*{box-sizing:border-box}html{background:#e7ebe6;color:#182723}body{margin:0;font-family:Georgia,'Times New Roman',serif;font-size:12pt;line-height:1.45}a{color:inherit} .book-page{position:relative;width:8.5in;height:11in;padding:.55in .62in .55in .68in;background:#fff;margin:24px auto;box-shadow:0 5px 30px #173f3020;break-after:page;overflow:visible}.page-content{height:9.55in}.page-header{border-top:4px solid #16483f;padding-top:12px;margin-bottom:20px}.eyebrow,.book-footer,.task-label,.callout-label{font-family:Arial,sans-serif;font-weight:700;letter-spacing:.06em;font-size:9pt;text-transform:uppercase;color:#16483f}h1{font-family:Arial,sans-serif;font-size:25pt;line-height:1.12;letter-spacing:-.035em;margin:9px 0 8px;color:#16483f}h2{font-family:Arial,sans-serif;font-size:13pt;line-height:1.2;margin:0 0 8px;color:#16483f}.subtitle{font-size:12pt;color:#466258;line-height:1.35;max-width:90%;margin:0}.book-footer{position:absolute;bottom:.35in;left:.68in;right:.62in;border-top:1px solid #9aaea4;padding-top:7px;display:flex;justify-content:space-between;font-size:8pt;letter-spacing:.015em}.text-block{margin:0 0 13px}.callout{border-left:4px solid #348879;background:#eff6f2;padding:10px 14px;margin:14px 0}.callout p{margin:4px 0 0}.tone-predict{border-color:#b56a1d;background:#fff7e9}.tone-misconception{border-color:#a14b39;background:#fbf0ed}.tone-connect{background:#f0f2f8;border-color:#5a6481}.book-figure{margin:15px 0 17px;border-bottom:1px solid #b6c8be;padding-bottom:8px}.algebra-figure .algebra-art svg{max-height:2.5in;width:100%}.algebra-key{font-size:10pt;line-height:1.3;margin:4pt 0}.algebra-key p{margin:2pt 0}.algebra-table{border-collapse:collapse;width:100%;font-size:12pt;text-align:center}.algebra-table th,.algebra-table td{border:1px solid #aac4b7;padding:5pt 8pt}.algebra-table th{background:#e4f0eb}
.book-figure svg{display:block;width:100%;max-height:2.5in;overflow:visible;font-family:Arial,sans-serif;font-size:15px}.diagram-label{font-size:14px}figcaption{font-family:Arial,sans-serif;font-size:10pt;color:#43584e;margin-top:7px;line-height:1.35}.worked{margin:16px 0;padding:15px 17px;background:#f5f5ef;border:1px solid #c7cfc5}.worked p{margin:5px 0 8px}.worked ol{padding-left:24px;margin:8px 0}.worked li{margin:5px 0;padding-left:4px}.conclusion{border-top:1px solid #c7cfc5;padding-top:8px;font-weight:700}.task{margin:16px 0;break-inside:avoid}.task-header{display:flex;align-items:baseline;gap:10px}.task-label{font-size:9pt;white-space:nowrap}.task p{margin:0 0 8px}.workspace{margin-top:9px;border-bottom:1px solid #a3b5a9;height:.45in}.workspace.medium{height:1in}.workspace.large{height:1.6in}.workspace.extended{height:2.4in}.workspace svg{display:block;width:100%;height:100%}.workspace.grid{border:1px solid #b7c5bc}.solution{border-bottom:1px solid #c5d0c9;padding:0 0 12px;margin:0 0 14px}.solution p{margin:5px 0}.solution a{text-decoration:none}.solution .answer{font-weight:700}.check{font-size:10.5pt;color:#425b4e}.opening .page-header{margin-top:.15in;border-top:8px solid #16483f;padding-top:25px}.opening h1{font-size:38pt;max-width:95%;margin-top:18px}.opening .subtitle{font-size:15pt}.opening .book-figure{border:0;margin:28px 0}.opening .book-figure svg{max-height:3in}.workshop .page-header{border-color:#b56a1d}.reflection .page-header{border-color:#5a6481}.solutions .page-header{border-color:#435c4c}.screen-controls{max-width:8.5in;margin:20px auto;font:14px Arial,sans-serif}.screen-controls p{margin:8px 0}@page{size:Letter;margin:0}@media print{html{background:white}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.book-page{margin:0;box-shadow:none}.book-page:last-child{break-after:auto}.screen-controls{display:none}}@media screen and (max-width:850px){.book-page{margin:12px 0}.screen-controls{padding:12px}}`;
function Workspace({
  response,
}: {
  response: Extract<BookBlock, { kind: "task" }>["response"];
}) {
  const height =
      response.size === "short"
        ? 43.2
        : response.size === "medium"
          ? 96
          : response.size === "extended"
            ? 230.4
            : 153.6,
    step = response.kind === "grid" ? 19.2 : 28.8;
  return (
    <div
      className={`workspace ${response.kind} ${response.size}`}
      aria-label={`Space for ${response.kind === "lines" ? "a written explanation" : response.kind === "grid" ? "a drawing on a grid" : "your work"}`}
    >
      {response.kind !== "blank" && (
        <svg
          viewBox={`0 0 691.2 ${height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {Array.from({ length: Math.floor(height / step) }, (_, i) => (
            <line
              key={`h${i}`}
              x1={0}
              x2={691.2}
              y1={(i + 1) * step}
              y2={(i + 1) * step}
              stroke="#b7c5bc"
              strokeWidth={0.7}
            />
          ))}
          {response.kind === "grid" &&
            Array.from({ length: 36 }, (_, i) => (
              <line
                key={`v${i}`}
                x1={i * step}
                x2={i * step}
                y1={0}
                y2={height}
                stroke="#c4d0c8"
                strokeWidth={0.7}
              />
            ))}
        </svg>
      )}
    </div>
  );
}
function Block({
  block: b,
  opening = false,
  taskNumbers,
}: {
  block: BookBlock;
  opening?: boolean;
  taskNumbers: Map<string, number>;
}) {
  switch (b.kind) {
    case "text":
      return (
        <p className="text-block">
          <MathText text={b.text} />
        </p>
      );
    case "callout":
      return (
        <aside className={`callout tone-${b.tone}`}>
          <h2>{b.title}</h2>
          <p>
            <MathText text={b.text} />
          </p>
        </aside>
      );
    case "diagram":
      if (
        opening &&
        b.diagram.kind === "ratio-tape" &&
        b.diagram.rows.length === 2 &&
        b.diagram.rows.every((r) => r.parts <= 6)
      )
        return <RatioCover diagram={b.diagram} />;
      if (opening && b.diagram.kind === "unit-region")
        return <UnitRegionCover diagram={b.diagram} />;
      if (opening && b.diagram.kind === "array")
        return <ArrayCover diagram={b.diagram} />;
      return opening &&
        b.diagram.kind === "strips" &&
        b.diagram.rows.length === 1 &&
        (b.diagram.rows[0]!.wholes ?? 1) === 1 ? (
        <CoverFigure diagram={b.diagram} />
      ) : (
        <BookDiagram diagram={b.diagram} />
      );
    case "worked":
      return (
        <section className="worked">
          <h2>{b.title}</h2>
          <p>
            <MathText text={b.prompt} />
          </p>
          <ol>
            {b.steps.map((step, i) => (
              <li key={i}>
                <MathText text={step} />
              </li>
            ))}
          </ol>
          <p className="conclusion">
            <MathText text={b.conclusion} />
          </p>
        </section>
      );
    case "task":
      return (
        <section className="task" id={b.id}>
          <div className="task-header">
            <a className="task-label" href={`#solution-${b.id}`}>
              Try {taskNumbers.get(b.id)}
            </a>
            <p>
              <MathText text={b.prompt} />
            </p>
          </div>
          <Workspace response={b.response} />
        </section>
      );
    case "solution":
      return (
        <section className="solution" id={`solution-${b.taskId}`}>
          <h2>
            <a href={`#${b.taskId}`}>Task {taskNumbers.get(b.taskId)}</a>
          </h2>
          <p className="answer">
            <MathText text={b.answer} />
          </p>
          <p>
            <MathText text={b.reasoning} />
          </p>
          {b.check && (
            <p className="check">
              Check your thinking: <MathText text={b.check} />
            </p>
          )}
        </section>
      );
  }
}
export function renderBook(book: MathBook): string {
  validateBook(book);
  const taskNumbers = new Map<string, number>();
  for (const page of book.pages)
    for (const b of page.blocks)
      if (b.kind === "task") taskNumbers.set(b.id, taskNumbers.size + 1);
  return (
    "<!doctype html>" +
    renderToStaticMarkup(
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{book.title}</title>
          <style>
            {bookCss +
              (book.presentation === "early-number" ? earlyNumberPrintCss : "")}
          </style>
        </head>
        <body>
          <nav className="screen-controls" aria-label="Book information">
            <strong>{book.title}</strong>
            <p>
              {book.audience} · {book.pages.length} pages · version{" "}
              {book.version}
            </p>
            <p>
              Print at actual size on Letter paper. Task labels link to
              solutions; solution labels return to the task.
            </p>
          </nav>
          <main>
            {book.pages.map((page, index) => (
              <article
                key={page.id}
                id={page.id}
                className={`book-page ${page.kind}${book.presentation === "early-number" ? " early-number-page" : ""}`}
                aria-labelledby={`heading-${page.id}`}
              >
                <div className="page-content">
                  <header className="page-header">
                    <div className="eyebrow">{page.eyebrow}</div>
                    <h1 id={`heading-${page.id}`}>{page.title}</h1>
                    {page.subtitle && (
                      <p className="subtitle">{page.subtitle}</p>
                    )}
                  </header>
                  {page.blocks.map((block, i) => {
                    const paired =
                      book.presentation === "early-number" &&
                      page.blocks[0]?.kind === "diagram" &&
                      page.blocks[1]?.kind === "diagram";
                    if (paired && i === 1) return null;
                    if (paired && i === 0)
                      return (
                        <div className="early-model-pair" key={i}>
                          <Block
                            block={block}
                            opening={false}
                            taskNumbers={taskNumbers}
                          />
                          <Block
                            block={page.blocks[1]!}
                            opening={false}
                            taskNumbers={taskNumbers}
                          />
                        </div>
                      );
                    return (
                      <Block
                        key={i}
                        block={block}
                        opening={page.kind === "opening"}
                        taskNumbers={taskNumbers}
                      />
                    );
                  })}
                </div>
                <footer className="book-footer">
                  <span>{book.title}</span>
                  <span>
                    {index + 1} / {book.pages.length}
                  </span>
                </footer>
              </article>
            ))}
          </main>
        </body>
      </html>,
    )
  );
}
