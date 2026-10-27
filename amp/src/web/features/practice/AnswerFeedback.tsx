import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import type { Outcome } from "../../../server/repository";
import type { ProgressSnapshot } from "../../../server/progress";
import { FocusDialog } from "../../PracticeWorkspace";
import {
  answerPathways,
  answersToStrength,
  type AnswerSkill,
} from "./answer-pathways";
import { answerProgressSchema } from "./answer-progress";
import styles from "./AnswerFeedback.module.css";

export function AnswerFeedback({
  outcome,
  skills,
  templates,
  identity,
  loadProgress,
  choose,
  busy,
}: {
  outcome: Outcome;
  skills: readonly AnswerSkill[];
  templates: readonly { id: string; skillId: string }[];
  /** Account/trial and learner scope; never a credential. */
  identity: readonly string[];
  loadProgress: () => Promise<ProgressSnapshot>;
  choose?: (templateId: string) => void;
  busy: boolean;
}) {
  const paths = answerPathways(outcome.skillId, skills, templates);
  const progress = useQuery({
    queryKey: [...identity, "answer-feedback", outcome.id],
    queryFn: async ({ signal }) => {
      const progress = await loadProgress();
      signal.throwIfAborted();
      return answerProgressSchema.parse(progress);
    },
    staleTime: Infinity,
    gcTime: 60_000,
    retry: false,
    enabled: outcome.correct && !outcome.skipped,
  });
  const evidence = progress.data?.skills.find(
    (s) => s.skillId === outcome.skillId,
  );
  const [direction, setDirection] = useState<"buildsOn" | "leadsTo" | null>(
    null,
  );
  const trigger = useRef<HTMLButtonElement | null>(null);
  if (!paths.skill?.title) return null;
  return (
    <div className={styles.feedback} data-answer-feedback>
      <div className={styles.skillLine}>
        <strong>{paths.skill.title}</strong>
        {outcome.correct && !outcome.assisted && !outcome.skipped && (
          <span className={styles.xp}>+1 XP</span>
        )}
      </div>
      {outcome.correct && !outcome.skipped && (
        <div
          className={styles.strength}
          aria-live="polite"
          aria-busy={progress.isPending}
        >
          {progress.isError ? (
            <span>
              Progress unavailable.{" "}
              <button onClick={() => void progress.refetch()}>Retry</button>
            </span>
          ) : evidence ? (
            <>
              <span className={styles.recent} aria-hidden="true">
                {Array.from({ length: 5 }, (_, i) => {
                  const answer = evidence.recent?.[i];
                  return (
                    <i
                      key={i}
                      data-state={
                        !answer
                          ? "empty"
                          : answer.correct && !answer.assisted
                            ? "independent"
                            : "practiced"
                      }
                    />
                  );
                })}
              </span>
              <span>
                <strong>
                  {evidence.status === "review-ready" ? "Strong" : "Building"}
                </strong>
                <small>
                  {evidence.status === "review-ready"
                    ? `${evidence.recentIndependentCorrect} of 5 recent answers without help`
                    : `${answersToStrength(evidence.recent)} more correct without help for Strong`}
                </small>
              </span>
            </>
          ) : (
            <span>
              {progress.isPending
                ? "Updating skill strength…"
                : "Skill practiced"}
            </span>
          )}
        </div>
      )}
      {choose &&
        (paths.buildsOn.length > 0 ||
          (outcome.correct && paths.leadsTo.length > 0)) && (
          <div
            className={styles.connections}
            aria-label="Explore connected skills"
          >
            {(["buildsOn", "leadsTo"] as const).map((which) =>
              paths[which].length > 0 &&
              (which === "buildsOn" || outcome.correct) ? (
                <button
                  key={which}
                  disabled={busy}
                  onClick={(event) => {
                    trigger.current = event.currentTarget;
                    setDirection(which);
                  }}
                >
                  <span aria-hidden="true">
                    {which === "buildsOn" ? "↙" : "↗"}
                  </span>
                  {which === "buildsOn" ? "Builds on" : "Leads to"}
                </button>
              ) : null,
            )}
          </div>
        )}
      {direction && choose && (
        <FocusDialog
          title={direction === "buildsOn" ? "Builds on" : "Leads to"}
          close={() => setDirection(null)}
          returnFocus={trigger.current}
        >
          <p className={styles.intro}>
            Try one problem from a connected skill. Next returns to adaptive
            practice.
          </p>
          <ul className={styles.choices}>
            {paths[direction].map((skill) => (
              <li key={skill.id}>
                <button
                  disabled={busy}
                  onClick={() => {
                    setDirection(null);
                    choose(skill.templateId);
                  }}
                >
                  <span>
                    <strong>{skill.title}</strong>
                    {skill.connected ? (
                      <small>
                        {skill.connected.label} · {skill.connected.explanation}
                      </small>
                    ) : (
                      skill.description && <small>{skill.description}</small>
                    )}
                  </span>
                  <span aria-hidden="true">→</span>
                </button>
              </li>
            ))}
          </ul>
        </FocusDialog>
      )}
    </div>
  );
}
