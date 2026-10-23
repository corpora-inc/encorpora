import type { ReactNode } from "react";
import type { Lesson } from "./lessons";
import { LessonIllustration } from "./LessonIllustration";
import { PrintMathText } from "./PrintMathText";

/** The library and printable lesson share the same teaching sequence. */
export function ReferenceLesson({
  lesson,
  print = false,
  representation,
}: {
  lesson: Lesson;
  print?: boolean;
  representation?: ReactNode;
}) {
  const Heading = print ? "h2" : "h3";
  const Subheading = print ? "h3" : "h4";
  const sections = [
    ...lesson.sections.map((section) => ({
      ...section,
      stage: section.stage ?? "method",
    })),
    ...(lesson.closingSections ?? []).map((section) => ({
      ...section,
      stage: section.stage ?? "formal",
    })),
  ];
  const layer = (stage: "intuition" | "method" | "formal") =>
    sections
      .filter((section) => section.stage === stage)
      .map((section, index) => (
        <section key={`${section.title}:${index}`}>
          <Subheading>{section.title}</Subheading>
          {section.paragraphs.map((paragraph, i) => (
            <p key={i}>
              <PrintMathText text={paragraph} />
            </p>
          ))}
          {section.illustration && (
            <LessonIllustration kind={section.illustration} print={print} />
          )}
        </section>
      ));
  const formal = layer("formal");
  return (
    <div className="reference-lesson">
      <div data-lesson-stage="intuition">
        <p className="summary">
          <PrintMathText text={lesson.summary} />
        </p>
        {layer("intuition")}
      </div>
      <section className="example worked-example" data-lesson-stage="example">
        <Heading>Example</Heading>
        <p>
          <PrintMathText text={lesson.workedExample.prompt} />
        </p>
        <ol>
          {lesson.workedExample.steps.map((step, i) => (
            <li key={i}>
              <PrintMathText text={step} />
            </li>
          ))}
        </ol>
        <p className="worked-answer">
          <strong>Answer:</strong>{" "}
          <PrintMathText
            text={[lesson.workedExample.answer, lesson.workedExample.answerUnit]
              .filter(Boolean)
              .join(" ")}
          />
        </p>
      </section>
      <section data-lesson-stage="method">
        <Heading>Method</Heading>
        {representation}
        {layer("method")}
      </section>
      <section data-lesson-stage="watch">
        <Heading>Watch for</Heading>
        <ul>
          {lesson.pitfalls.map((pitfall, i) => (
            <li key={i}>
              <PrintMathText text={pitfall} />
            </li>
          ))}
        </ul>
      </section>
      <aside className="lesson-partner">
        <Heading>For a parent or learning partner</Heading>
        <p>
          <PrintMathText text={lesson.parentGuide} />
        </p>
      </aside>
      {formal.length > 0 && (
        <section data-lesson-stage="formal">
          <Heading>Principle and definitions</Heading>
          {formal}
        </section>
      )}
    </div>
  );
}
