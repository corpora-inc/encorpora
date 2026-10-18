import { absoluteValueWorksheet } from "./absolute-value-worksheets";
import { absoluteValueTemplates } from "../math/absolute-value-practice";
import { inequalityWorksheet } from "./inequality-worksheets";
import { linearSystemWorksheet } from "./linear-system-worksheets";
import { linearSystemTemplates } from "../math/linear-system-practice";
import { inequalityTemplates } from "../math/inequality-practice";
import { rightTriangleWorksheetProblems } from "./right-triangle-worksheets";
import { LessonIllustration } from "./LessonIllustration";
import { product } from "../product";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Figure } from "../web/Figure";
import { generateProblem } from "../math/engine";
import type { Lesson } from "./lessons";
import { PrintMathText, printMathStyles } from "./PrintMathText";
import { printMathCss } from "./print-fonts";
export type PublicationKind = "lesson" | "workbook" | "solutions";
export function publicationHtml(
  lesson: Lesson,
  kind: PublicationKind,
  edition = "1",
) {
  const problems = lesson.templateIds.flatMap((id) =>
    absoluteValueTemplates.some((t) => t.id === id)
      ? absoluteValueWorksheet(id, lesson.id, edition)
      : linearSystemTemplates.some((t) => t.id === id)
        ? linearSystemWorksheet(id, lesson.id, edition)
        : inequalityTemplates.some((t) => t.id === id)
          ? inequalityWorksheet(id, lesson.id, edition)
          : (rightTriangleWorksheetProblems(id, lesson.id, edition) ??
            Array.from({ length: 12 }, (_, i) =>
              generateProblem(id, `print:${lesson.id}:${edition}:${i}`),
            )),
  );
  const kindLabel =
    kind === "lesson"
      ? "Reference lesson"
      : kind === "workbook"
        ? "Practice workbook"
        : "Worked solutions";
  const title = `${lesson.title} · ${kindLabel}`;
  const body = (
    <article>
      <header>
        <span>{product.name} / MATHEMATICS</span>
        <span>Edition {edition}</span>
      </header>
      <h1>{lesson.title}</h1>
      <p className="publication-kind">{kindLabel}</p>
      <p className="summary">
        <PrintMathText text={lesson.summary} />
      </p>
      {kind === "lesson" ? (
        <>
          {lesson.sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              {section.paragraphs.map((p) => (
                <p key={p}>
                  <PrintMathText text={p} />
                </p>
              ))}
              {section.illustration && (
                <LessonIllustration kind={section.illustration} />
              )}
            </section>
          ))}
          <section className="example">
            <h2>A worked example</h2>
            <p>
              <PrintMathText text={lesson.workedExample.prompt} />
            </p>
            <ol>
              {lesson.workedExample.steps.map((s) => (
                <li key={s}>
                  <PrintMathText text={s} />
                </li>
              ))}
            </ol>
            <p className="worked-answer">
              <strong>Answer:</strong>{" "}
              <PrintMathText
                text={[
                  lesson.workedExample.answer,
                  lesson.workedExample.answerUnit,
                ]
                  .filter(Boolean)
                  .join(" ")}
              />
            </p>
          </section>
          {lesson.includeGeneratedRepresentation !== false &&
            problems[0]?.public.figure && (
              <section className="representation">
                <h2>Explore the representation</h2>
                <p>
                  <PrintMathText text={problems[0].public.prompt} />
                </p>
                <Figure figure={problems[0].public.figure} />
                <p>
                  <PrintMathText text={problems[0].explanation.join(" ")} />
                </p>
              </section>
            )}
          <h2>Common stumbling blocks</h2>
          <ul>
            {lesson.pitfalls.map((p) => (
              <li key={p}>
                <PrintMathText text={p} />
              </li>
            ))}
          </ul>
          <h2>For a parent or learning partner</h2>
          <p>
            <PrintMathText text={lesson.parentGuide} />
          </p>
        </>
      ) : (
        <>
          <p>
            {kind === "workbook"
              ? "Write your answer and show your thinking. Use the matching worked solutions to review."
              : "These solutions match the workbook with the same lesson and edition."}
          </p>
          {problems.map((p, i) => (
            <section className="exercise" key={p.public.id}>
              <h2>
                {i + 1}. <PrintMathText text={p.public.prompt} />
              </h2>
              {p.public.figure && <Figure figure={p.public.figure} />}
              {p.public.response.kind === "choice" && (
                <ol type="A" className="print-choices">
                  {p.public.response.options.map((option) => (
                    <li key={option.id}>
                      <PrintMathText text={option.label} />
                    </li>
                  ))}
                </ol>
              )}
              {kind === "solutions" ? (
                <>
                  <ol>
                    {p.explanation.map((s, j) => (
                      <li key={j}>
                        <PrintMathText text={s} />
                      </li>
                    ))}
                  </ol>
                  <p>
                    <strong>
                      Answer:{" "}
                      <PrintMathText
                        text={
                          p.public.response.kind === "choice"
                            ? p.public.response.options.find(
                                (option) => option.id === p.answer,
                              )!.label
                            : p.answer
                        }
                      />
                    </strong>
                  </p>
                </>
              ) : (
                <div className="writing" aria-label="Space to show your work" />
              )}
            </section>
          ))}
        </>
      )}
      <footer>
        {product.company} · {product.name} · {lesson.id} · Edition {edition}
      </footer>
    </article>
  );
  return (
    "<!doctype html>" +
    renderToStaticMarkup(
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <title>{title}</title>
          <style>{printMathCss()}</style>
          <style>{`@page{margin:18mm}body{font-family:Arial,sans-serif;color:#18332f;line-height:1.55;font-size:10.5pt}header{display:flex;justify-content:space-between;font-size:9pt;letter-spacing:1.3px;border-bottom:1px solid #abc;padding-bottom:10px}h1{font-family:Georgia,serif;font-size:27pt;line-height:1.2;margin:24px 0 8px}h2{font-size:12.5pt;line-height:1.5;break-after:avoid}p,li{orphans:3;widows:3}li{margin:3px 0}section{margin:20px 0}.publication-kind{font-size:10pt;letter-spacing:1px;margin:0 0 20px;color:#47635d}.example{padding:22px;border:1px solid #9ab;break-inside:avoid}.example>h2{margin-top:0}.example>ol>li,.exercise>ol:not(.print-choices)>li{margin:0;padding:5px 0;line-height:1.6}.worked-answer{border-top:1px solid #ccd;padding-top:14px;margin:16px 0 0}.representation{break-inside:avoid}.exercise{break-inside:avoid;border-bottom:1px solid #ccd;padding-top:1px;padding-bottom:15px}${printMathStyles}.figure{display:block;width:480px;max-width:100%;max-height:400px;margin:15px auto}.figure text{fill:#183e3a;font:18px Arial}.dataset{display:flex;gap:20px;justify-content:center;font-size:18pt}.print-choices{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:32px;padding-left:24px;line-height:1.8;row-gap:2px}.figure[data-kind="coordinate-plane"]{width:320px;height:300px;max-height:none}.writing{height:75px;background:repeating-linear-gradient(white,white 24px,#ddd 25px)}footer{break-before:avoid;break-inside:avoid;font-size:8pt;margin-top:18px;color:#567;border-top:1px solid #ccd;padding-top:10px}`}</style>
        </head>
        <body>{body}</body>
      </html>,
    )
  );
}
