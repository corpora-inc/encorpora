import { areaVolumeWorksheet } from "./area-volume-worksheets";
import { areaVolumeTemplates } from "../math/area-volume-practice";
import { transformationWorksheet } from "./transformation-worksheets";
import { transformationTemplates } from "../math/transformation-practice";
import { completingSquareTemplates } from "../math/completing-square-practice";
import { completingSquareWorksheet } from "./completing-square-worksheets";
import { angleTriangleWorksheet } from "./angle-triangle-worksheets";
import { angleTriangleTemplates } from "../math/angle-triangle-practice";
import { factoringWorksheet } from "./factoring-worksheets";
import { factoringTemplates } from "../math/factoring-practice";
import { realNumberWorksheet } from "./real-number-worksheets";
import { realNumberTemplates } from "../math/real-number-practice";
import { numberSystemWorksheet } from "./number-system-worksheets";
import { numberSystemTemplates } from "../math/number-system-practice";
import { earlyOperationsTemplates } from "../math/early-operations-practice";
import { ratioRateWorksheet } from "./ratio-rate-worksheets";
import { ratioRateTemplates } from "../math/ratio-rate-practice";
import { factArrayTemplates } from "../math/fact-arrays-practice";
import { patternFunctionWorksheet } from "./pattern-function-worksheets";
import { linearFunctionWorksheet } from "./linear-function-worksheets";
import { quadraticStructureWorksheet } from "./quadratic-structure-worksheets";
import { quadraticStructureTemplates } from "../math/quadratic-structure-practice";
import { functionToolkitWorksheet } from "./function-toolkit-worksheets";
import { functionToolkitTemplates } from "../math/function-toolkit-practice";
import { twoVariableWorksheet } from "./two-variable-worksheets";
import { algebraStatisticsWorksheet } from "./algebra-statistics-worksheets";
import { algebraStatisticsTemplates } from "../math/algebra-statistics-practice";
import { twoVariableTemplates } from "../math/two-variable-practice";
import { linearFunctionTemplates } from "../math/linear-function-practice";
import { patternFunctionTemplates } from "../math/pattern-function-practice";
import { equationWorksheet } from "./equation-worksheets";
import { equationTemplates } from "../math/equation-practice";
import { distinctWorksheet } from "./distinct-worksheet";
import { powerTemplates } from "../math/power-practice";
import { partWholeTemplates } from "../math/part-whole-practice";
import { decimalTemplates } from "../math/decimal-practice";
import { timeMoneyTemplates } from "../math/time-money-practice";
import { attributeTemplates } from "../math/attribute-practice";
import { combinatoricsWorksheet } from "./combinatorics-worksheets";
import { combinatoricsTemplates } from "../math/combinatorics-practice";
import { radicalWorksheet } from "./radical-worksheets";
import { radicalTemplates } from "../math/radical-practice";
import { rationalWorksheet } from "./rational-worksheets";
import { rationalTemplates } from "../math/rational-practice";
import { circleMeasurementWorksheet } from "./circle-measurement-worksheets";
import { circleMeasurementTemplates } from "../math/circle-measurement-practice";
import { integerExponentWorksheet } from "./integer-exponent-worksheets";
import { integerExponentTemplates } from "../math/integer-exponent-practice";
import { descriptiveStatisticsWorksheet } from "./descriptive-statistics-worksheets";
import { descriptiveStatisticsTemplates } from "../math/descriptive-statistics-practice";
import { percentChangeWorksheet } from "./percent-change-worksheets";
import { percentChangeTemplates } from "../math/percent-change-practice";
import { inequalityWorksheet } from "./inequality-worksheets";
import { linearSystemWorksheet } from "./linear-system-worksheets";
import { linearSystemTemplates } from "../math/linear-system-practice";
import { inequalityTemplates } from "../math/inequality-practice";
import { rightTriangleWorksheetProblems } from "./right-triangle-worksheets";
import { absoluteValueWorksheet } from "./absolute-value-worksheets";
import { absoluteValueTemplates } from "../math/absolute-value-practice";
import { ReferenceLesson } from "./ReferenceLesson";
import { brand } from "../brand";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Figure } from "../web/Figure";
import { generateProblem } from "../math/engine";
import { withLegacySurfaces } from "../math/number-domain-axes";
import type { Lesson } from "./lessons";
import { PrintMathText } from "./PrintMathText";
import {
  PrintExerciseBody,
  printTokens,
  publicationCss,
} from "./print-exercise";
import { printMathCss } from "./print-fonts";
export type PublicationKind = "lesson" | "workbook" | "solutions";
/** Families whose printed sheets are twelve distinct ordinary problems. */
const distinctWorksheetTemplates = [
  ...powerTemplates,
  ...partWholeTemplates,
  ...factArrayTemplates,
  ...earlyOperationsTemplates,
  ...decimalTemplates,
  ...timeMoneyTemplates,
  ...attributeTemplates,
];
/** Printed editions keep the surfaces they had before number-domain axes, so
 * an existing edition reprints byte for byte. */
export const publicationHtml = (
  lesson: Lesson,
  kind: PublicationKind,
  edition = "1",
) => withLegacySurfaces(() => buildPublicationHtml(lesson, kind, edition));
/** A shown-work exercise (figure, table, word bank and workspace) can be taller
 * than a page, so it may break between its parts; each part stays whole. */
const workbookTallExerciseCss =
  ".exercise:has(>.print-work,>.print-work-order){break-inside:auto}" +
  ".exercise>h2,.exercise>.figure,.exercise>.print-work,.exercise>.print-work-order,.exercise>.print-work-start,.exercise>.print-work-bank,.exercise>.print-work-order-line,.exercise>.writing{break-inside:avoid}" +
  ".exercise>h2,.exercise>.figure,.exercise>.print-work-start{break-after:avoid}";
function buildPublicationHtml(
  lesson: Lesson,
  kind: PublicationKind,
  edition: string,
) {
  const problems = lesson.templateIds.flatMap((id) =>
    areaVolumeTemplates.some((t) => t.id === id)
      ? areaVolumeWorksheet(id, lesson.id, edition)
      : transformationTemplates.some((t) => t.id === id)
        ? transformationWorksheet(id, lesson.id, edition)
        : completingSquareTemplates.some((t) => t.id === id)
          ? completingSquareWorksheet(id, lesson.id, edition)
          : angleTriangleTemplates.some((t) => t.id === id)
            ? angleTriangleWorksheet(id, lesson.id, edition)
            : factoringTemplates.some((t) => t.id === id)
              ? factoringWorksheet(id, lesson.id, edition)
              : realNumberTemplates.some((t) => t.id === id)
                ? realNumberWorksheet(id, lesson.id, edition)
                : numberSystemTemplates.some((t) => t.id === id)
                  ? numberSystemWorksheet(id, lesson.id, edition)
                  : ratioRateTemplates.some((t) => t.id === id)
                    ? ratioRateWorksheet(id, lesson.id, edition)
                    : algebraStatisticsTemplates.some((t) => t.id === id)
                      ? algebraStatisticsWorksheet(id, lesson.id, edition)
                      : twoVariableTemplates.some((t) => t.id === id)
                        ? twoVariableWorksheet(id, lesson.id, edition)
                        : linearFunctionTemplates.some((t) => t.id === id)
                          ? linearFunctionWorksheet(id, lesson.id, edition)
                          : quadraticStructureTemplates.some((t) => t.id === id)
                            ? quadraticStructureWorksheet(
                                id,
                                lesson.id,
                                edition,
                              )
                            : functionToolkitTemplates.some((t) => t.id === id)
                              ? functionToolkitWorksheet(id, lesson.id, edition)
                              : patternFunctionTemplates.some(
                                    (t) => t.id === id,
                                  )
                                ? patternFunctionWorksheet(
                                    id,
                                    lesson.id,
                                    edition,
                                  )
                                : equationTemplates.some((t) => t.id === id)
                                  ? equationWorksheet(id, lesson.id, edition)
                                  : distinctWorksheetTemplates.some(
                                        (t) => t.id === id,
                                      )
                                    ? distinctWorksheet(id, lesson.id, edition)
                                    : combinatoricsTemplates.some(
                                          (t) => t.id === id,
                                        )
                                      ? combinatoricsWorksheet(
                                          id,
                                          lesson.id,
                                          edition,
                                        )
                                      : radicalTemplates.some(
                                            (t) => t.id === id,
                                          )
                                        ? radicalWorksheet(
                                            id,
                                            lesson.id,
                                            edition,
                                          )
                                        : rationalTemplates.some(
                                              (t) => t.id === id,
                                            )
                                          ? rationalWorksheet(
                                              id,
                                              lesson.id,
                                              edition,
                                            )
                                          : circleMeasurementTemplates.some(
                                                (t) => t.id === id,
                                              )
                                            ? circleMeasurementWorksheet(
                                                id,
                                                lesson.id,
                                                edition,
                                              )
                                            : integerExponentTemplates.some(
                                                  (t) => t.id === id,
                                                )
                                              ? integerExponentWorksheet(
                                                  id,
                                                  lesson.id,
                                                  edition,
                                                )
                                              : descriptiveStatisticsTemplates.some(
                                                    (t) => t.id === id,
                                                  )
                                                ? descriptiveStatisticsWorksheet(
                                                    id,
                                                    lesson.id,
                                                    edition,
                                                  )
                                                : percentChangeTemplates.some(
                                                      (t) => t.id === id,
                                                    )
                                                  ? percentChangeWorksheet(
                                                      id,
                                                      lesson.id,
                                                      edition,
                                                    )
                                                  : linearSystemTemplates.some(
                                                        (t) => t.id === id,
                                                      )
                                                    ? linearSystemWorksheet(
                                                        id,
                                                        lesson.id,
                                                        edition,
                                                      )
                                                    : linearSystemTemplates.some(
                                                          (t) => t.id === id,
                                                        )
                                                      ? linearSystemWorksheet(
                                                          id,
                                                          lesson.id,
                                                          edition,
                                                        )
                                                      : inequalityTemplates.some(
                                                            (t) => t.id === id,
                                                          )
                                                        ? inequalityWorksheet(
                                                            id,
                                                            lesson.id,
                                                            edition,
                                                          )
                                                        : absoluteValueTemplates.some(
                                                              (t) =>
                                                                t.id === id,
                                                            )
                                                          ? absoluteValueWorksheet(
                                                              id,
                                                              lesson.id,
                                                              edition,
                                                            )
                                                          : (rightTriangleWorksheetProblems(
                                                              id,
                                                              lesson.id,
                                                              edition,
                                                            ) ??
                                                            (id ===
                                                            "linear-initial-value-meaning"
                                                              ? distinctWorksheet(
                                                                  id,
                                                                  lesson.id,
                                                                  edition,
                                                                )
                                                              : Array.from(
                                                                  {
                                                                    length: 12,
                                                                  },
                                                                  (_, i) =>
                                                                    generateProblem(
                                                                      id,
                                                                      `print:${lesson.id}:${edition}:${i}`,
                                                                    ),
                                                                ))),
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
        <span>{brand.name} / MATHEMATICS</span>
        <span>Edition {edition}</span>
      </header>
      <h1>{lesson.title}</h1>
      <p className="publication-kind">{kindLabel}</p>
      {kind === "lesson" ? (
        <ReferenceLesson
          lesson={lesson}
          print
          representation={
            lesson.includeGeneratedRepresentation !== false &&
            problems[0]?.public.figure ? (
              <section className="representation">
                <h3>Explore the representation</h3>
                <p>
                  <PrintMathText text={problems[0].public.prompt} />
                </p>
                <Figure figure={problems[0].public.figure} />
                <p>
                  <PrintMathText text={problems[0].explanation.join(" ")} />
                </p>
              </section>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="summary">
            <PrintMathText text={lesson.summary} />
          </p>
          <p>
            {kind === "workbook"
              ? "Write your answer and show your thinking. Use the matching worked solutions to review."
              : "These solutions match the workbook with the same lesson and edition."}
          </p>
          {problems.map((p, i) => (
            <section
              className={
                kind === "solutions"
                  ? "exercise exercise--solutions"
                  : "exercise"
              }
              key={p.public.id}
            >
              <PrintExerciseBody
                number={i + 1}
                problem={p}
                solutions={kind === "solutions"}
              />
            </section>
          ))}
        </>
      )}
      <footer>
        {brand.company} · {brand.name} · {lesson.id} · Edition {edition}
      </footer>
    </article>
  );
  const bodyMarkup = renderToStaticMarkup(body);
  return (
    "<!doctype html>" +
    renderToStaticMarkup(
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <title>{title}</title>
          <style>{printMathCss()}</style>
          <style>{printTokens()}</style>
          <style>{publicationCss}</style>
          {kind !== "solutions" && /class="print-work/.test(bodyMarkup) ? (
            <style>{workbookTallExerciseCss}</style>
          ) : null}
        </head>
        <body dangerouslySetInnerHTML={{ __html: bodyMarkup }} />
      </html>,
    )
  );
}
