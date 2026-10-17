import { product } from "../product";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Figure } from "../web/Figure";
import { generateProblem } from "../math/engine";
import type { Lesson } from "./lessons";
export type PublicationKind = "lesson" | "workbook" | "solutions";
export function publicationHtml(
  lesson: Lesson,
  kind: PublicationKind,
  edition = "1",
) {
  const problems = lesson.templateIds.flatMap((id) =>
    Array.from({ length: 12 }, (_, i) =>
      generateProblem(id, `print:${lesson.id}:${edition}:${i}`),
    ),
  );
  const title = `${lesson.title} · ${kind === "lesson" ? "Mini-textbook" : kind === "workbook" ? "Practice workbook" : "Worked solutions"}`;
  const body = (
    <article>
      <header>
        <span>{product.name} / MATHEMATICS</span>
        <span>Edition {edition}</span>
      </header>
      <h1>{title}</h1>
      <p className="summary">{lesson.summary}</p>
      {kind === "lesson" ? (
        <>
          <h2>What you will learn</h2>
          <ul>
            {lesson.objectives.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
          {lesson.sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              {section.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </section>
          ))}
          <section className="example">
            <h2>A worked example</h2>
            <p>{lesson.workedExample.prompt}</p>
            <ol>
              {lesson.workedExample.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <strong>{lesson.workedExample.answer}</strong>
          </section>
          {problems[0]?.public.figure && (
            <section>
              <h2>Explore the representation</h2>
              <p>{problems[0].public.prompt}</p>
              <Figure figure={problems[0].public.figure} />
              <p>{problems[0].explanation.join(" ")}</p>
            </section>
          )}
          <h2>Common stumbling blocks</h2>
          <ul>
            {lesson.pitfalls.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <h2>For a parent or learning partner</h2>
          <p>{lesson.parentGuide}</p>
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
                {i + 1}. {p.public.prompt}
              </h2>
              {p.public.figure && <Figure figure={p.public.figure} />}{" "}
              {kind === "solutions" ? (
                <>
                  <ol>
                    {p.explanation.map((s, j) => (
                      <li key={j}>{s}</li>
                    ))}
                  </ol>
                  <p>
                    <strong>Answer: {p.answer}</strong>
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
        <br />
        This publication teaches the listed objectives; it is one part of a
        developing curriculum.
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
          <style>{`@page{margin:18mm}body{font-family:Arial,sans-serif;color:#183e3a;line-height:1.6;font-size:11pt}header{display:flex;justify-content:space-between;font-size:9pt;letter-spacing:2px;border-bottom:1px solid #abc;padding-bottom:10px}h1{font-family:Georgia,serif;font-size:28pt;line-height:1.2}h2{font-size:14pt;break-after:avoid}p,li{orphans:3;widows:3}section{margin:20px 0}.example{padding:18px;border:1px solid #9ab}.exercise{break-inside:avoid;border-bottom:1px solid #ccd;padding-bottom:18px}.figure{display:block;width:480px;max-width:100%;max-height:400px;margin:15px auto}svg text{fill:#183e3a;font:18px Arial}.dataset{display:flex;gap:20px;justify-content:center;font-size:18pt}.writing{height:75px;background:repeating-linear-gradient(white,white 24px,#ddd 25px)}footer{font-size:8pt;margin-top:30px;color:#567;border-top:1px solid #ccd;padding-top:10px}`}</style>
        </head>
        <body>{body}</body>
      </html>,
    )
  );
}
