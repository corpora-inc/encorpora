import React from "./react.js";
import { Figure } from "../../amp/src/web/Figure.js";
import { MathText } from "../../amp/src/web/MathText.js";
import { generateProblem, templates } from "../../amp/src/math/engine.js";
import { lessons } from "../../amp/src/content/lessons.js";
import { buildCoverageManifest } from "../../amp/src/content/coverage.js";
import { auditCurriculum } from "../../amp/src/curriculum/audit.js";
import { skills } from "../../amp/src/curriculum/catalog.js";

export const samples = [
  "fraction-model",
  "rectangle-area",
  "linear-equation",
].map((id, index) => ({
  ...generateProblem(id, `corpora-site-example-${index}`),
  title: templates.find((t) => t.id === id)!.title,
}));
export const sampleLesson = lessons.find((l) =>
  l.templateIds.includes("fraction-model"),
)!;
export function Math({ text }: { text: string }) {
  return <MathText text={text} />;
}
export function Sample({
  index = 0,
  heading = "h3",
}: {
  index?: number;
  heading?: "h2" | "h3";
}) {
  const Heading = heading;
  const sample = samples[index]!;
  return (
    <article className="problem">
      <div className="problem-label">
        <span>AMP / {sample.title}</span>
        <span>Sample</span>
      </div>
      <Heading>
        <Math text={sample.public.prompt} />
      </Heading>
      {sample.public.figure && <Figure figure={sample.public.figure} />}
      <details className="solution">
        <summary>
          See the reasoning <span aria-hidden="true">↗</span>
        </summary>
        <div className="solution-body">
          <ol>
            {sample.explanation.map((step, i) => (
              <li key={i}>
                <Math text={step} />
              </li>
            ))}
          </ol>
          <p>
            <strong>Answer: </strong>
            <Math text={sample.answer} />
          </p>
        </div>
      </details>
    </article>
  );
}
export function coverage() {
  const curriculum = auditCurriculum(),
    content = buildCoverageManifest();
  if (!curriculum.valid || !content.valid)
    throw new Error("AMP coverage audit failed");
  const active = new Set(templates.map((t) => t.skillId));
  return {
    summary: content.summary,
    curriculum: curriculum.counts,
    bands: ["K–2", "3–5", "6–8", "9–12"].map((band) => ({
      band,
      templates: templates.filter((t) => t.gradeBand === band),
    })),
    skillsWithProblems: skills.filter((s) => active.has(s.id)).length,
  };
}
export const product = coverage();

export function SampleFigure({ index }: { index: number }) {
  const figure = samples[index]!.public.figure;
  return figure ? <Figure figure={figure} /> : null;
}
