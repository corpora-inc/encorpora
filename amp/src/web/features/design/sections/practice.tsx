import { useState } from "react";
import {
  PracticeWorkspace,
  usePracticeViewport,
} from "../../../PracticeWorkspace";
import { AnswerFeedback } from "../../practice/AnswerFeedback";
import {
  answerProgress,
  answerSkills,
  answerTemplates,
  practiceFixtures,
  practiceOutcome,
  type PracticeFixture,
  type PracticeFixtureId,
} from "../fixtures";
import { Section, SpecimenFrame } from "../Gallery";

/** One practice problem filling the screen, as the app's immersive practice
 * draws it, from a fixture: Check grades against the fixture's answer, Next
 * and Skip go back to the start. */
export function PracticeSpecimen({ id }: { id: PracticeFixtureId }) {
  const fixture: PracticeFixture = practiceFixtures[id];
  usePracticeViewport(true);
  const [response, setResponse] = useState(fixture.response);
  const [outcome, setOutcome] = useState(() =>
    fixture.outcome
      ? practiceOutcome(fixture, fixture.response, fixture.outcome)
      : null,
  );
  const [hint, setHint] = useState("");
  const [error, setError] = useState(fixture.error ?? "");
  const reset = () => {
    setResponse("");
    setOutcome(null);
    setHint("");
  };
  return (
    <div className="shell app-shell practice-shell immersive">
      <PracticeWorkspace
        problem={fixture.problem}
        lesson={null}
        response={response}
        setResponse={setResponse}
        outcome={outcome}
        hint={hint}
        pending={false}
        busy={false}
        error={error}
        clearError={() => setError("")}
        submit={() =>
          setOutcome(
            practiceOutcome(
              fixture,
              response,
              response === fixture.answer ? "correct" : "wrong",
            ),
          )
        }
        next={reset}
        skip={() => setOutcome(practiceOutcome(fixture, "", "skipped"))}
        requestHint={() =>
          setHint(
            "Each tray holds the same number. What operation joins equal groups?",
          )
        }
        exit={reset}
        exitHref="/design"
        mastered={outcome ? fixture.mastered : null}
        requestLesson={() =>
          Promise.reject(
            new Error("Lessons come from the server; the gallery has none."),
          )
        }
        answerFeedback={
          outcome && (
            <AnswerFeedback
              key={outcome.id}
              outcome={outcome}
              skills={answerSkills}
              templates={answerTemplates}
              identity={["design"]}
              loadProgress={async () => answerProgress}
              busy={false}
              choose={reset}
            />
          )
        }
      />
    </div>
  );
}

const states: [PracticeFixtureId, string][] = [
  ["typed", "Typed answer, before Check (the keypad dock)"],
  ["choice", "Choice, one selected"],
  ["correct", "Correct: feedback with skill strength"],
  ["mastered", "Correct, a skill just mastered"],
  ["wrong", "Wrong: the worked explanation"],
  ["long-explanation", "Wrong, a long explanation"],
  ["choice-wrong", "Choice, wrong"],
  ["skipped", "Skipped: the answer shown without credit"],
  ["error", "The answer didn't send: the error at the answer"],
];

export function PracticeSection() {
  return (
    <Section
      id="practice"
      title="Problem stage and feedback"
      source={[
        "PracticeWorkspace.tsx",
        "features/practice/AnswerFeedback.tsx",
        "practice.css",
        "feedback-sheet.css",
        "practice-tablet.css",
      ]}
      note="Each state is a whole practice screen in its own frame at this width. The toolbar is drawn in the card, as in the native app; on the web the app bar carries it. Check, Skip and Next work against the fixture."
    >
      {states.map(([id, label]) => (
        <SpecimenFrame key={id} specimen={`practice-${id}`} label={label} />
      ))}
    </Section>
  );
}
