import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Link,
  useNavigate,
  useRouter,
  useSearch,
} from "@tanstack/react-router";
import { useEffect, useMemo, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { PublicProblem } from "../../../../math/contracts";
import type { Outcome } from "../../../../server/repository";
import type { WorkReplayResponse } from "../../../../schools/teacher-contracts";
import { AppError } from "../../../lib/AppError";
import { MathText } from "../../../MathText";
import {
  PracticeWorkspace,
  usePracticeViewport,
} from "../../../PracticeWorkspace";
import { Badge } from "../../../ui/Badge";
import { Loading } from "../../../ui/Loading";
import { useStaffSession } from "./api";
import { workReplayOptions } from "./teacher-api";
import { clockTime, resultLabel, resultTone, shortDay } from "./teacher-shared";
import styles from "./WorkReplay.module.css";
import { closeTo } from "../../../lib/return-to";
import {
  OPEN_KEY,
  popLayer,
  readStack,
  replaceTop,
  work,
} from "../../../nav/entities";
import { EntityLink } from "../../../nav/links";

const HELP_WORDS: Record<string, string> = {
  hint: "Hint",
  lesson: "Lesson",
  video: "Video",
  example: "Worked example",
  person: "With someone",
};

/** The answer as the practice screen's own outcome, so the problem draws
 * marked exactly as it was after Check. */
export function replayOutcome(replay: WorkReplayResponse): Outcome {
  return {
    id: replay.item.id,
    problemId: String(replay.problem?.id ?? replay.item.id),
    requestId: replay.item.id,
    skillId: replay.skillId,
    templateId: replay.origin?.templateId ?? "",
    correct: replay.outcome.correct,
    assisted: replay.outcome.assisted,
    response: replay.outcome.response,
    answer: replay.outcome.answer,
    explanation: replay.outcome.explanation,
    createdAt: replay.item.at,
    ...(replay.outcome.parts ? { parts: replay.outcome.parts } : {}),
  };
}

/** How long, in a few characters: "48 s", "2 min 5 s". */
export function duration(seconds: number) {
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes} min ${rest} s` : `${minutes} min`;
}

/** The help an answer had, in words. An answer stores the kinds it had
 * since they were recorded, and none when it had none; one stored before
 * that says only whether a hint or lesson helped. */
export function helpWords(help: WorkReplayResponse["help"], assisted: boolean) {
  if (help === null || help.length === 0)
    return assisted ? "Hint or lesson" : "None";
  return help.map((kind) => HELP_WORDS[kind] ?? kind).join(", ");
}

/** The head's "with a hint", from the kinds recorded; undefined to keep the
 * practice screen's own general words. */
export function supportWords(help: WorkReplayResponse["help"]) {
  const hint = help?.includes("hint");
  const lesson = help?.includes("lesson");
  if (hint && lesson) return "with a hint and the lesson";
  if (hint) return "with a hint";
  if (lesson) return "with the lesson";
  return undefined;
}

/**
 * One of a student's answers, replayed full screen as they saw it after
 * Check: the practice screen itself in review (`PracticeWorkspace`), the
 * answer marked per part, the correct answer and the explanation, and beside
 * them the help it had, the time, other tries and the skill's lesson.
 * Previous and Next step through their work without closing; each answer
 * has its own address, so Back, refresh and a shared link all hold.
 */
export function WorkReplay({
  student,
  attempt,
  skill,
  workPath,
  closePath,
  layer,
}: {
  student: string;
  attempt: string;
  /** Narrows Previous and Next to one skill (from Today). */
  skill?: string;
  /** Where another answer's replay lives, without the leading slash (an
   * answer with its own route). */
  workPath?: (attempt: string) => string;
  /** Where closing goes: the record this opened from (its own route). */
  closePath?: string;
  /** A layer over a page (nav/LayerHost): closing pops it, stepping swaps
   * it, and while another layer covers it, its keys rest. */
  layer?: { close: () => void; covered: boolean };
}) {
  const session = useStaffSession();
  const client = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();
  // The skill's lesson opens over the answer as a layer: closing it, and
  // its film, comes back to this answer in its class (lib/return-to.ts).
  const raw = useSearch({ strict: false }) as Record<string, unknown>;
  const covered = layer ? layer.covered : readStack(raw[OPEN_KEY]).length > 0;
  const query = useQuery(workReplayOptions(session, student, attempt, skill));
  const replay = query.data;
  usePracticeViewport(true);
  // The neighbours are fetched as this one shows, so stepping is instant.
  useEffect(() => {
    for (const id of [replay?.previous, replay?.next])
      if (id)
        void client
          .prefetchQuery(workReplayOptions(session, student, id, skill))
          .catch(() => undefined);
  }, [replay?.previous, replay?.next]);
  const search: Record<string, string> = skill ? { skill } : {};
  // Back to where it was opened: the record, Today, a gradebook's evidence.
  const close = () =>
    layer ? layer.close() : closeTo(router, `/${closePath ?? ""}`);
  /** Swaps this answer for another (Previous, Next, a try): the replay is
   * one layer, so Back and X both close it. */
  const step = (to: string) =>
    layer
      ? void navigate({
          to: ".",
          search: ((current: Record<string, unknown>) => ({
            ...current,
            [OPEN_KEY]: replaceTop(current[OPEN_KEY], work(student, to)),
          })) as never,
          replace: true,
          resetScroll: false,
        })
      : void navigate({
          to: "/$",
          params: { _splat: workPath!(to) },
          search: search as never,
          replace: true,
        });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.target instanceof HTMLInputElement)
        return;
      // A layer over it handles its own keys: Escape closes only that.
      if (covered) return;
      if (event.key === "Escape" && !document.querySelector("dialog[open]"))
        close();
      const to =
        event.key === "ArrowLeft"
          ? replay?.previous
          : event.key === "ArrowRight"
            ? replay?.next
            : null;
      if (to) step(to);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });
  /** A link to another of their answers, swapping this one. */
  const Answer: AnswerLink = ({ to, children, ...rest }) =>
    layer ? (
      <EntityLink entity={work(student, to)} replace {...rest}>
        {children}
      </EntityLink>
    ) : (
      <Link
        to="/$"
        params={{ _splat: workPath!(to) }}
        search={search as never}
        replace
        {...rest}
      >
        {children}
      </Link>
    );
  const who = replay?.student.first ?? "";
  const closeLink = (
    <Link
      {...((layer
        ? {
            to: ".",
            search: (current: Record<string, unknown>) => ({
              ...current,
              [OPEN_KEY]: popLayer(current[OPEN_KEY]),
            }),
          }
        : { to: "/$", params: { _splat: closePath } }) as unknown as {
        to: ".";
      })}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        close();
      }}
      className="workspace-level"
      aria-label={who ? `Close, back to ${who}` : "Close"}
      data-replay-close=""
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
      <span className="workspace-level-label" aria-hidden="true">
        Close
      </span>
    </Link>
  );
  const steps = (
    <div className={styles.steps} role="group" aria-label="Their work">
      <Step to={replay?.previous} Answer={Answer} label="Previous" />
      <Step to={replay?.next} Answer={Answer} label="Next" />
    </div>
  );
  const problem = useMemo(
    () =>
      replay?.problem ? (replay.problem as unknown as PublicProblem) : null,
    [replay?.item.id],
  );
  const missing = query.error instanceof AppError && query.error.status === 404;
  let body: ReactNode;
  if (!replay)
    body = (
      <Frame close={closeLink} topic="Work">
        {query.isError ? (
          <div className={styles.fallback}>
            <h2>
              {missing
                ? "This answer isn’t available to your account"
                : "This answer didn’t load"}
            </h2>
            <p>
              {missing
                ? "It may belong to a student you can’t see, or the link may be wrong."
                : "Check your connection, then try again."}
            </p>
            {!missing && (
              <button
                className={styles.retry}
                onClick={() => void query.refetch()}
              >
                Try again
              </button>
            )}
          </div>
        ) : (
          <div className={styles.wait}>
            <Loading />
          </div>
        )}
      </Frame>
    );
  else if (!problem)
    body = (
      <Frame
        close={closeLink}
        topic={replay.item.skill}
        status={<When replay={replay} />}
      >
        <div className={styles.fallback} data-replay-unavailable="">
          <h2>This problem’s original form isn’t available</h2>
          <p className={styles.fallbackNote}>
            What was stored with the answer is below.
          </p>
          {replay.item.prompt ? (
            <p className={styles.storedPrompt}>
              <MathText text={replay.item.prompt} />
            </p>
          ) : (
            <p className={styles.fallbackNote}>
              The problem text wasn’t stored.
            </p>
          )}
          <Facts replay={replay} Answer={Answer} answers />
          {steps}
        </div>
      </Frame>
    );
  else
    body = (
      <div
        className="shell app-shell practice-shell immersive"
        data-work-replay={replay.item.id}
      >
        <PracticeWorkspace
          key={replay.item.id}
          problem={problem}
          skillTitle={replay.item.skill}
          strand={replay.item.strand}
          lesson={null}
          response={replay.outcome.response}
          setResponse={() => undefined}
          outcome={replayOutcome(replay)}
          hint=""
          pending={false}
          busy={false}
          submit={() => undefined}
          next={() => undefined}
          requestHint={() => undefined}
          requestLesson={() =>
            Promise.reject(new Error("A replay opens the skill's lesson."))
          }
          exit={close}
          exitHref={`/${closePath}`}
          navigation={closeLink}
          status={<When replay={replay} />}
          review={{
            who,
            actions: steps,
            facts: <Facts replay={replay} Answer={Answer} />,
            support: supportWords(replay.help),
          }}
        />
      </div>
    );
  return createPortal(
    <div
      className={styles.layer}
      role="dialog"
      aria-modal="true"
      aria-label={
        replay ? `${who}’s answer: ${replay.item.skill}` : "An answer"
      }
    >
      {body}
    </div>,
    document.body,
  );
}

/** The replay's frame when the practice screen can't draw it: the same bar,
 * a centred column under it. */
function Frame({
  close,
  topic,
  status,
  children,
}: {
  close: ReactNode;
  topic: string;
  status?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={styles.frame}>
      <div className={styles.bar}>
        {close}
        <span className={styles.topic}>{topic}</span>
        {status && <span className={styles.barStatus}>{status}</span>}
      </div>
      <div className={styles.column}>{children}</div>
    </div>
  );
}

/** Who, when and how it counted, in the bar: "Ana · Nov 10, 2:42 PM"
 * and the result. */
function When({ replay }: { replay: WorkReplayResponse }) {
  return (
    <span className={styles.status}>
      <span className={styles.when}>
        {replay.student.first} · {shortDay(replay.item.day)}
        {replay.item.at ? `, ${clockTime(replay.item.at)}` : ""}
        {replay.item.review ? " · Spaced review" : ""}
      </span>
      <Badge tone={resultTone(replay.item.result)}>
        {resultLabel(replay.item.result)}
      </Badge>
    </span>
  );
}

type AnswerLink = (props: {
  to: string;
  children: ReactNode;
  className?: string;
  "data-step"?: string;
  "aria-label"?: string;
}) => ReactNode;

function Step({
  to,
  Answer,
  label,
}: {
  to: string | null | undefined;
  Answer: AnswerLink;
  label: "Previous" | "Next";
}) {
  const content =
    label === "Previous" ? (
      <>
        <span aria-hidden="true">←</span> Previous
      </>
    ) : (
      <>
        Next <span aria-hidden="true">→</span>
      </>
    );
  // The first and last keep their place, quietly: nothing there to open.
  if (!to)
    return (
      <span className={styles.step} aria-disabled="true" data-step={label}>
        {content}
      </span>
    );
  return (
    <Answer
      to={to}
      className={styles.step}
      data-step={label}
      aria-label={`${label} answer`}
    >
      {content}
    </Answer>
  );
}

/** Answer forms whose head after Check marks the work rather than state the
 * answer ("Each number is marked"): a missed one names it in the facts. */
const STATED = new Set(["number", "fraction", "choice", "multi-select"]);
const answerOnlyInSteps = (replay: WorkReplayResponse) => {
  const kind = (replay.problem?.response as { kind?: string } | undefined)
    ?.kind;
  return !replay.outcome.correct && !!kind && !STATED.has(kind);
};

/** Around the answer, dense: how it counted, the help it had, its time,
 * other tries at the same problem and the skill's lesson. `answers` adds
 * the stored answer lines, for when the problem can't be drawn. */
function Facts({
  replay,
  Answer,
  answers = false,
}: {
  replay: WorkReplayResponse;
  Answer: AnswerLink;
  answers?: boolean;
}) {
  const { item } = replay;
  const help = helpWords(replay.help, replay.outcome.assisted);
  return (
    <dl className={styles.facts} data-replay-facts="">
      {answers && (
        <>
          <div>
            <dt>Answered</dt>
            <dd>
              {item.response !== null ? (
                <MathText text={item.response} />
              ) : replay.outcome.response ? (
                replay.outcome.response
              ) : (
                "Not stored"
              )}
            </dd>
          </div>
          <div>
            <dt>Correct answer</dt>
            <dd>
              {item.answer !== null ? (
                <MathText text={item.answer} />
              ) : replay.outcome.answer ? (
                replay.outcome.answer
              ) : (
                "Not stored"
              )}
            </dd>
          </div>
        </>
      )}
      {!answers && answerOnlyInSteps(replay) && item.answer !== null && (
        <div>
          <dt>Correct answer</dt>
          <dd className={styles.answerText}>
            <MathText text={item.answer} />
          </dd>
        </div>
      )}
      <div>
        <dt>Help</dt>
        <dd>{help}</dd>
      </div>
      {replay.seconds !== null && (
        <div>
          <dt>Time</dt>
          <dd>{duration(replay.seconds)} after the answer before</dd>
        </div>
      )}
      {replay.tries.length > 1 && (
        <div>
          <dt>Tries</dt>
          <dd>
            <ol className={styles.tries}>
              {replay.tries.map((entry) => {
                const label = `${entry.at ? `${shortDay(entry.at.slice(0, 10))}, ${clockTime(entry.at)}` : "Earlier"}: ${resultLabel(entry.result)}`;
                return (
                  <li key={entry.id}>
                    {entry.id === item.id ? (
                      <span aria-current="true">{label}</span>
                    ) : (
                      <Answer to={entry.id}>{label}</Answer>
                    )}
                  </li>
                );
              })}
            </ol>
          </dd>
        </div>
      )}
      {replay.outcome.paper && (
        <div>
          <dt>Source</dt>
          <dd>Marked on paper by an adult</dd>
        </div>
      )}
      {replay.source === "rebuilt" && (
        <div>
          <dt>Drawn</dt>
          <dd>
            Again from its template
            {replay.origin?.version
              ? ` (version ${replay.origin.version})`
              : ""}{" "}
            and seed
          </dd>
        </div>
      )}
      <div>
        <dt>Lesson</dt>
        <dd>
          {replay.lesson.templateId ? (
            // Over this answer, so closing it comes back here.
            <EntityLink
              className={styles.lesson}
              entity={{ kind: "lesson", id: replay.lesson.templateId }}
              data-replay-lesson=""
            >
              {item.skill}
            </EntityLink>
          ) : (
            <EntityLink
              className={styles.lesson}
              entity={{ kind: "skill", id: replay.lesson.skillId }}
            >
              {item.skill}
            </EntityLink>
          )}
        </dd>
      </div>
    </dl>
  );
}
