import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  PracticeWorkspace,
  usePracticeViewport,
} from "../../../src/web/PracticeWorkspace";
import { MathText } from "../../../src/web/MathText";
import {
  PrintMathText,
  printMathStyles,
} from "../../../src/content/PrintMathText";
import type { GeneratedProblem } from "../../../src/math/contracts";
import "../../../src/web/app/styles";

const data: { problem: GeneratedProblem; title: string; surface?: string } =
  await fetch("/__display-case" + location.search).then((r) => r.json());
function App() {
  const [response, setResponse] = useState("");
  usePracticeViewport(!data.surface);
  if (data.surface)
    return (
      <main style={{ maxWidth: 640, margin: "40px auto", padding: 24 }}>
        <style>{printMathStyles}</style>
        <h1>{data.title}</h1>
        <p className="lesson-example-prompt">
          {data.surface === "lesson" ? (
            <PrintMathText text={data.problem.public.prompt} />
          ) : (
            <MathText text={data.problem.public.prompt} />
          )}
        </p>
        <ol>
          {data.problem.explanation.map((text, i) => (
            <li key={i}>
              <MathText text={text} />
            </li>
          ))}
        </ol>
      </main>
    );
  return (
    <div className="shell app-shell">
      <PracticeWorkspace
        problem={data.problem.public}
        skillTitle={data.title}
        lesson={null}
        response={response}
        setResponse={setResponse}
        outcome={null}
        hint=""
        pending={false}
        busy={false}
        submit={() => {}}
        next={() => {}}
        requestHint={() => {}}
        exitHref="/"
        exit={() => {}}
        requestLesson={async () => {
          throw new Error("No lesson in this fixture");
        }}
      />
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
