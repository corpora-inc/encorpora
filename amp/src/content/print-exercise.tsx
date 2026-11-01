import { readFileSync } from "node:fs";
import React, { type ReactNode } from "react";
import { Figure } from "../web/Figure";
import type { GeneratedProblem } from "../math/contracts";
import { answerText } from "../math/selection-response";
import { plotPoints, pointPlotScene } from "../math/point-plot";
import {
  cardRows,
  draftChoices,
  type MultiPartChoiceResponse,
} from "../math/multi-part-choice";
import {
  figureChoiceName,
  figureOptionLetters,
  type FigureChoiceResponse,
} from "../math/figure-choice";
import {
  draftRows,
  fieldText,
  numberTex,
  powerBase,
  powerTex,
  rowShape,
  rowText,
  type StructuredWorkResponse,
} from "../math/structured-work";
import { SceneFigure } from "../web/scene/SceneFigure";
import { PrintMathText, printMathStyles } from "./PrintMathText";

/** One printed exercise, shared by lesson workbooks and daily workbooks: the
 * prompt, its figure and the paper form of its response. Solutions show the
 * worked steps and answer; otherwise `workspace` (ruled lines by default)
 * gives room to work. Lesson editions depend on this markup byte for byte. */

/** Figure options on paper: lettered small figures, two across. The
 * solutions ring the correct figure and tick its letter. */
function PrintFigureChoice({
  response,
  answer,
}: {
  response: FigureChoiceResponse;
  answer?: string;
}) {
  return (
    <div className="print-figures">
      {response.options.map((option, i) => (
        <div
          key={option.id}
          className={
            option.id === answer
              ? "print-figure print-figure--answer"
              : "print-figure"
          }
        >
          <span className="print-figure-letter">
            {option.id === answer ? "☑ " : ""}
            {figureOptionLetters[i]}
          </span>
          <SceneFigure medium="print" scene={option.scene} />
        </div>
      ))}
    </div>
  );
}
/** A worked list can replace repeated choices only when it quotes every label in order. */
const printBox = {
  display: "inline-block",
  minWidth: "40px",
  minHeight: "1.5em",
  margin: "0 4px",
  padding: "0 6px",
  border: "1.5px solid #18332f",
  borderRadius: "6px",
  textAlign: "center",
  verticalAlign: "middle",
  lineHeight: 1.5,
} as const;
const printCard = {
  display: "inline-block",
  margin: "2px 4px",
  padding: "0 10px",
  border: "1px solid #6f8a85",
  borderRadius: "6px",
  lineHeight: 1.6,
} as const;
/** A multi-part item on paper: the sentence, table or slots with a box per
 * option, or an equation with empty boxes over its cards. Solutions tick the
 * correct box in each part, or write each card in its box. */
function PrintMultiPart({
  response,
  answer,
}: {
  response: MultiPartChoiceResponse;
  answer?: string;
}) {
  const key = answer ? draftChoices(response, answer) : {};
  const box = (blankId: string, optionId: string) =>
    key[blankId] === optionId ? "☑" : "☐";
  const number = (blankId: string) =>
    response.blanks.findIndex((b) => b.id === blankId) + 1;
  if (response.layout === "table") {
    const columns = response.blanks[0]!.options;
    return (
      <table className="print-match">
        <thead>
          <tr>
            <th scope="col">{response.rowHeader ?? ""}</th>
            {columns.map((c) => (
              <th scope="col" key={c.id}>
                <PrintMathText text={c.label} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {response.blanks.map((b) => (
            <tr key={b.id}>
              <th scope="row">
                <PrintMathText text={b.label} />
              </th>
              {columns.map((c) => (
                <td key={c.id}>{box(b.id, c.id)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (response.layout === "cards") {
    // Styled inline: the shared publication stylesheet stays unchanged.
    const rows = cardRows(response);
    return (
      <>
        <p
          className="print-sentence"
          style={{ textAlign: "center", fontSize: "13pt" }}
        >
          {(response.sentence ?? []).map((part, i) => {
            if ("text" in part)
              return part.text.split(/\s*\n\s*/).map((line, j) => (
                <span key={`${i}-${j}`}>
                  {j > 0 && <br />}
                  {line && <PrintMathText text={line} />}
                </span>
              ));
            const blank = response.blanks.find((b) => b.id === part.blank)!;
            const placed = blank.options.find((o) => o.id === key[blank.id]);
            return (
              <span key={i} className="print-box" style={printBox}>
                {placed ? <PrintMathText text={placed.label} /> : "\u00a0"}
              </span>
            );
          })}
        </p>
        {!answer && (
          <p className="print-tray" style={{ textAlign: "center" }}>
            {rows.map((row, r) => (
              <span
                key={r}
                style={{ display: "inline-block", margin: "0 8px" }}
              >
                {row.options.map((o) => (
                  <span key={o.id} className="print-card" style={printCard}>
                    <PrintMathText text={o.label} />
                  </span>
                ))}
              </span>
            ))}
            <br />
            {response.reuse
              ? "A card can fill more than one box."
              : "Each card fills one box."}
          </p>
        )}
      </>
    );
  }
  return (
    <>
      {response.layout === "inline" && response.sentence && (
        <p className="print-sentence">
          {response.sentence.map((part, i) =>
            "text" in part ? (
              <PrintMathText key={i} text={part.text} />
            ) : (
              <span key={i} className="print-blank">
                ({number(part.blank)})
              </span>
            ),
          )}
        </p>
      )}
      <ol className="print-parts print-choices">
        {response.blanks.map((b) => (
          <li key={b.id}>
            <PrintMathText
              text={b.label.charAt(0).toUpperCase() + b.label.slice(1)}
            />
            :{" "}
            {b.options.map((o) => (
              <span key={o.id} className="print-part-option">
                {box(b.id, o.id)} <PrintMathText text={o.label} />
              </span>
            ))}
          </li>
        ))}
      </ol>
    </>
  );
}
/** Structured work on paper. The workbook prints every step with blank
 * lines for the learner's fields (and the banks to choose from, lettered);
 * an ordering prints its steps lettered with blanks for the order. The
 * solutions print the worked steps from the answer key. */
function PrintStructuredWork({
  response: r,
  answer,
}: {
  response: StructuredWorkResponse;
  answer?: string;
}) {
  const head = (
    <>
      {r.start && (
        <p className="print-work-start">
          <strong>Start:</strong> <PrintMathText text={r.start} />
        </p>
      )}
    </>
  );
  const goal = r.goal ? (
    <p className="print-work-start">
      <strong>Prove:</strong> <PrintMathText text={r.goal} />
    </p>
  ) : null;
  if (r.mode === "order") {
    if (!answer)
      return (
        <>
          {head}
          <ol type="A" className="print-work-order">
            {r.rows.map((row) => (
              <li key={row.id}>
                <PrintMathText text={rowText(r, row, [])} />
              </li>
            ))}
          </ol>
          {goal}
          <p className="print-work-order-line">
            Order:{" "}
            {r.rows.map((row) => (
              <span
                key={row.id}
                className="print-work-blank print-work-blank--short"
              />
            ))}
          </p>
        </>
      );
    const order = JSON.parse(answer) as string[];
    return (
      <>
        {head}
        <ol className="print-work-order">
          {order.map((id) => {
            const row = r.rows.find((x) => x.id === id)!;
            return (
              <li key={id}>
                <PrintMathText text={rowText(r, row, [])} />
              </li>
            );
          })}
        </ol>
        {goal}
      </>
    );
  }
  const values = answer ? draftRows(r, answer) : null;
  const count = values ? values.length : r.open ? r.open.max : r.rows.length;
  const shapes = Array.from({ length: count }, (_, i) => rowShape(r, i));
  const labeled = shapes.some((row) => row.label);
  const columns = shapes[0]!.fields.map((f) => f.label);
  const banks = r.banks.filter((b) =>
    shapes.some((row) =>
      row.fields.some(
        (f) => f.kind === "choice" && f.bank === b.id && f.given === undefined,
      ),
    ),
  );
  return (
    <>
      {head}
      <table className="print-work">
        <thead>
          <tr>
            <th scope="col">{r.layout === "proof" ? "Line" : "Step"}</th>
            {labeled ? (
              <th scope="col">Find</th>
            ) : (
              columns.map((c) => (
                <th scope="col" key={c}>
                  {c}
                </th>
              ))
            )}
            {labeled && <th scope="col">Answer</th>}
          </tr>
        </thead>
        <tbody>
          {shapes.map((row, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              {labeled && (
                <td>
                  <PrintMathText text={row.label ?? ""} />
                </td>
              )}
              {row.fields.map((f, j) => {
                // A power's exponent prints inside its coefficient's cell.
                if (j > 0 && powerBase(row.fields[j - 1]!, f)) return null;
                const next = row.fields[j + 1];
                const base = powerBase(f, next);
                const shown = (field: typeof f, k: number) =>
                  field.given ?? values?.[i]?.[k] ?? "";
                if (base && next) {
                  const a = shown(f, j);
                  const n = shown(next, j + 1);
                  return (
                    <td key={j} colSpan={labeled ? undefined : 2}>
                      {a && n ? (
                        <PrintMathText text={powerTex(a, base, n)} />
                      ) : (
                        // Coefficient × base, with the exponent's blank
                        // raised where the exponent is written.
                        <span className="print-work-power">
                          {a ? (
                            <PrintMathText text={`$${numberTex(a)}$`} />
                          ) : (
                            <span className="print-work-blank print-work-blank--short" />
                          )}
                          {` × ${base}`}
                          <sup>
                            {n ? (
                              <PrintMathText text={`$${numberTex(n)}$`} />
                            ) : (
                              <span className="print-work-blank print-work-blank--power" />
                            )}
                          </sup>
                        </span>
                      )}
                    </td>
                  );
                }
                return (
                  <td key={j}>
                    {f.given !== undefined || values ? (
                      <PrintMathText
                        text={fieldText(r, f, values?.[i]?.[j] ?? "")}
                      />
                    ) : f.kind === "choice" ? (
                      <span className="print-work-blank print-work-blank--short" />
                    ) : (
                      <span className="print-work-blank" />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {goal}
      {!answer &&
        banks.map((b) => (
          <div key={b.id} className="print-work-bank">
            <strong>{b.label}s to choose from</strong>
            <ol type="a">
              {b.options.map((o) => (
                <li key={o.id}>
                  <PrintMathText text={o.label} />
                </li>
              ))}
            </ol>
          </div>
        ))}
    </>
  );
}
function explanationsQuoteEveryOption(problem: GeneratedProblem): boolean {
  const response = problem.public.response;
  return (
    response.kind === "multi-select" &&
    problem.explanation.length === response.options.length &&
    response.options.every((option, index) =>
      problem.explanation[index]?.startsWith(`“${option.label}” `),
    )
  );
}

export function PrintExerciseBody({
  number,
  problem,
  solutions,
  workspace,
}: {
  number: number;
  problem: GeneratedProblem;
  solutions: boolean;
  workspace?: ReactNode;
}) {
  return (
    <>
      <h2>
        {number}. <PrintMathText text={problem.public.prompt} />
      </h2>
      {problem.public.figure && <Figure figure={problem.public.figure} />}
      {problem.public.response.kind === "point-plot" && (
        // The workbook prints the empty grid to plot on by hand; the
        // solutions print the same grid with the answer drawn.
        <SceneFigure
          medium="print"
          reveal
          scene={pointPlotScene(problem.public.response, {
            answer: solutions ? plotPoints(problem.answer) : undefined,
          })}
        />
      )}
      {problem.public.response.kind === "multi-part-choice" && (
        <PrintMultiPart
          response={problem.public.response}
          answer={solutions ? problem.answer : undefined}
        />
      )}
      {problem.public.response.kind === "structured-work" && (
        <PrintStructuredWork
          response={problem.public.response}
          answer={solutions ? problem.answer : undefined}
        />
      )}
      {problem.public.response.kind === "figure-choice" && (
        <PrintFigureChoice
          response={problem.public.response}
          answer={solutions ? problem.answer : undefined}
        />
      )}
      {(problem.public.response.kind === "choice" ||
        problem.public.response.kind === "multi-select") &&
        !(solutions && explanationsQuoteEveryOption(problem)) && (
          <ol type="A" className="print-choices">
            {problem.public.response.options.map((option) => (
              <li key={option.id}>
                <PrintMathText text={option.label} />
              </li>
            ))}
          </ol>
        )}
      {solutions ? (
        <>
          <ol type={explanationsQuoteEveryOption(problem) ? "A" : undefined}>
            {problem.explanation.map((s, j) => (
              <li key={j}>
                <PrintMathText text={s} />
              </li>
            ))}
          </ol>
          <p>
            <strong>
              Answer:{" "}
              {problem.public.response.kind === "figure-choice" &&
                `${figureChoiceName(problem.public.response, problem.answer)}. `}
              <PrintMathText
                text={answerText(problem.public.response, problem.answer)}
              />
            </strong>
          </p>
        </>
      ) : (
        (workspace ?? (
          <div className="writing" aria-label="Space to show your work" />
        ))
      )}
    </>
  );
}

/** Print pages use the light color roles: figures paint with role tokens. */
let tokens: string | undefined;
export function printTokens() {
  tokens ??=
    /:root\s*\{[^}]*\}/.exec(
      readFileSync(new URL("../web/ui/tokens.css", import.meta.url), "utf8"),
    )?.[0] ?? "";
  return tokens;
}
/** The app theme's figure rules (fills, outlines, base-ten blocks, scale
 * labels): every top-level rule whose selectors all start with `.figure`.
 * Some figures paint by class rather than inline, so paper needs them too. */
let figureRules: string | undefined;
export function printFigureCss() {
  if (figureRules !== undefined) return figureRules;
  const css = readFileSync(
    new URL("../web/theme.css", import.meta.url),
    "utf8",
  ).replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    if (css[i] === "{") {
      if (depth === 0) start = css.lastIndexOf("}", i) + 1;
      depth++;
    } else if (css[i] === "}" && --depth === 0) {
      const rule = css.slice(start, i + 1).trim();
      const selectors = rule.slice(0, rule.indexOf("{")).split(",");
      if (selectors.every((s) => /^\.figure\b/.test(s.trim())))
        rules.push(rule);
    }
  }
  if (!rules.length) throw new Error("theme.css has no figure rules");
  figureRules = rules.join("\n");
  return figureRules;
}
/** Page styles of printed lessons and their exercises. */
export const publicationCss = `@page{margin:18mm}:root{--scene-sans:Arial,Helvetica,sans-serif}body{font-family:Arial,sans-serif;color:#18332f;line-height:1.55;font-size:10.5pt}header{display:flex;justify-content:space-between;font-size:9pt;letter-spacing:1.3px;border-bottom:1px solid #abc;padding-bottom:10px}h1{font-family:Georgia,serif;font-size:27pt;line-height:1.2;margin:24px 0 8px}h2{font-size:12.5pt;line-height:1.5}h2,h3{break-after:avoid}p,li{orphans:3;widows:3}li{margin:3px 0}section{margin:20px 0}.keep-together{break-inside:avoid}.reference-lesson [data-lesson-stage="watch"] ul,.reference-lesson [data-lesson-stage="watch"] li{break-inside:avoid}.publication-kind{font-size:10pt;letter-spacing:1px;margin:0 0 20px;color:#47635d}.example{padding:22px;border:1px solid #9ab;break-inside:avoid}.example>h2{margin-top:0}.example>ol>li,.exercise>ol:not(.print-choices)>li{margin:0;padding:5px 0;line-height:1.6}.worked-answer{border-top:1px solid #ccd;padding-top:14px;margin:16px 0 0}.representation{break-inside:avoid}.exercise{break-inside:avoid;border-bottom:1px solid #ccd;padding-top:1px;padding-bottom:15px}.exercise--solutions{break-inside:auto}.exercise--solutions>h2,.exercise--solutions>.figure,.exercise--solutions>.print-choices,.exercise--solutions>.print-sentence,.exercise--solutions>.print-match,.exercise--solutions>.print-figures,.exercise--solutions>.print-work,.exercise--solutions>.print-work-start,.exercise--solutions>.figure-text-cap{break-inside:avoid;break-after:avoid}.exercise--solutions>.figure-text-cap{display:block!important}.exercise--solutions>ol:not(.print-choices)>li,.exercise--solutions>p:last-child{break-inside:avoid}.exercise--solutions>ol:not(.print-choices)>li:last-child{break-after:avoid}.exercise--solutions>p:last-child{break-before:avoid}${printMathStyles}.figure{display:block;width:480px;max-width:100%;max-height:400px;margin:15px auto}.figure text{fill:#183e3a;font:18px Arial}.dataset{display:flex;gap:20px;justify-content:center;font-size:18pt}.print-choices{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:32px;padding-left:24px;line-height:1.8;row-gap:2px}.figure[data-kind="coordinate-plane"]{width:320px;height:300px;max-height:none}.print-match{border-collapse:collapse;margin:12px 0;break-inside:avoid}.print-match th,.print-match td{border:1px solid #9ab;padding:6px 12px;text-align:center}.print-match tbody th{text-align:left;font-weight:normal}.print-sentence{line-height:2}.print-blank{display:inline-block;min-width:64px;border-bottom:1px solid #18332f;text-align:center;margin:0 4px}.print-parts{display:block;padding-left:24px;line-height:1.9}.print-part-option{display:inline-block;margin-right:18px;white-space:nowrap}.print-figures{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px 18px;margin:12px 0;break-inside:avoid}.print-figure{border:1px solid #9ab;border-radius:8px;padding:6px 10px 8px;break-inside:avoid}.print-figure--answer{border:2.5px solid #18332f}.print-figure-letter{font-weight:bold;font-size:11pt}.print-figure .figure{width:100%;max-width:168px!important;max-height:none;margin:4px auto 0}.print-work{border-collapse:collapse;margin:10px 0;width:100%;break-inside:avoid}.print-work th,.print-work td{border:1px solid #9ab;padding:5px 8px;text-align:left;vertical-align:top}.print-work th{font-size:9pt}.print-work td:first-child{width:28px;text-align:center}.print-work-blank{display:inline-block;width:100%;min-width:120px;height:20px;border-bottom:1px solid #18332f}.print-work-blank--short{width:56px;min-width:56px;margin:0 6px}.print-work-power{white-space:nowrap}.print-work-power sup{font-size:.8em}.print-work-blank--power{width:32px;min-width:32px;height:14px;margin:0 2px}.print-work-start{margin:6px 0}.print-work-order{line-height:1.8}.print-work-order-line{margin-top:8px}.print-work-bank{font-size:9.5pt;margin:6px 0;break-inside:avoid}.print-work-bank ol{columns:2;column-gap:24px;margin:4px 0}.writing{height:75px;background:repeating-linear-gradient(white,white 24px,#ddd 25px)}footer{break-before:avoid;break-inside:avoid;font-size:8pt;margin-top:18px;color:#567;border-top:1px solid #ccd;padding-top:10px}`;
