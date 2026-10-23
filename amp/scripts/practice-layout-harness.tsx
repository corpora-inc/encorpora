/** Local synthetic-only preview; served by audit-practice-layout.ts. */
import { createRoot } from "react-dom/client";
import { useState } from "react";
import { skills } from "../src/curriculum/catalog";
import { gradeNumber } from "../src/learning/frontier";
import { calculatorAllowed } from "../src/math/calculator";
import { FreeMeter } from "../src/web/features/trial/FreeMeter";
import {
  PracticeWorkspace,
  usePracticeViewport,
} from "../src/web/PracticeWorkspace";
import "../src/web/app/styles";
import type { GeneratedProblem, TemplateMetadata } from "../src/math/contracts";

import type { Outcome } from "../src/server/repository";

type Case = { problem: GeneratedProblem; meta: TemplateMetadata; seed: string };
declare global {
  interface Window {
    layoutCase: (value: Case) => void;
    layoutReady: string;
    layoutFeedback: (correct: boolean, skipped?: boolean) => void;
  }
}
function App() {
  const [value, setValue] = useState<Case | null>(null);
  const [revision, setRevision] = useState(0);
  window.layoutCase = (value) => {
    setValue(value);
    setRevision((n) => n + 1);
  };
  usePracticeViewport(true);
  if (!value) return <p>Choose a template with ?template=…&amp;seed=…</p>;
  return (
    <div className="shell app-shell practice-shell immersive">
      <CaseView key={`${value.problem.public.id}:${revision}`} value={value} />
    </div>
  );
}
function CaseView({ value }: { value: Case }) {
  const [response, setResponse] = useState("");
  const [hint, setHint] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const { problem, meta, seed } = value;
  const skill = skills.find((skill) => skill.id === meta.skillId);
  window.layoutReady = problem.public.id;
  window.layoutFeedback = (correct, skipped = false) => {
    const format = problem.public.response;
    // Zero may be written as a decimal or a fraction in a generated answer.
    const zero = /^[+-]?0+(?:\.0+)?(?:\s*\/\s*[+-]?\d+)?$/.test(
      problem.answer.trim().replaceAll("−", "-"),
    );
    let wrong = zero ? "1" : "0";
    if (format.kind === "choice")
      wrong = format.options.find((o) => o.id !== problem.answer)!.id;
    if (format.kind === "multi-select") {
      const ids: string[] = JSON.parse(problem.answer);
      wrong = JSON.stringify(
        [
          ...ids.slice(1),
          format.options.find((o) => !ids.includes(o.id))!.id,
        ].sort(),
      );
    }
    const response = correct ? problem.answer : wrong;
    setResponse(response);
    setOutcome({
      id: `synthetic-${correct}-${skipped}`,
      ...(skipped ? { skipped: true as const } : {}),
      problemId: problem.public.id,
      requestId: "synthetic",
      skillId: meta.skillId,
      templateId: meta.id,
      correct,
      assisted: false,
      response,
      explanation: problem.explanation,
      answer: problem.answer,
      createdAt: new Date(0).toISOString(),
    });
  };
  return (
    <PracticeWorkspace
      problem={problem.public}
      meta={meta}
      strand={skill?.strand}
      calculator={calculatorAllowed(
        meta,
        skill?.strand,
        skill ? gradeNumber[skill.gradeBand] : 0,
      )}
      status={<FreeMeter answered={12} free={100} variant="pill" />}
      hintCue={
        problem.hintCue
          ? { problemId: problem.public.id, steps: problem.hintCue }
          : null
      }
      skip={() => window.layoutFeedback(false, true)}
      reportProblem={async () => "sent"}
      lesson={null}
      response={response}
      setResponse={setResponse}
      outcome={outcome}
      hint={hint}
      pending={false}
      busy={false}
      submit={() => {}}
      next={() => {}}
      requestHint={() => setHint(problem.hint)}
      exit={() => {}}
      exitHref="#"
      requestLesson={async () =>
        (
          await fetch(
            `/layout-lesson?template=${encodeURIComponent(meta.id)}&seed=${encodeURIComponent(seed)}`,
          )
        ).json()
      }
    />
  );
}
createRoot(document.getElementById("root")!).render(<App />);
const query = new URLSearchParams(location.search);
if (query.has("template")) {
  const value = await (await fetch(`/layout-case?${query}`)).json();
  const timer = setInterval(() => {
    if (window.layoutCase) {
      clearInterval(timer);
      window.layoutCase(value);
    }
  }, 10);
}
