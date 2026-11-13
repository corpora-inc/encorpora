import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link, Navigate, useNavigate, useParams } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { create } from "zustand";
import type { AuthSession } from "../../auth";
import { AppError } from "../../lib/AppError";
import { track } from "../../lib/analytics";
import { ownPracticeAllowed } from "../../../learning/starting-point";
import { sessionOptions } from "../../lib/query";
import { chosenPlan } from "../../lib/pending-trial";
import { Button, buttonClass } from "../../ui/Button";
import { Toast } from "../../ui/Toast";
import { loadCurriculum } from "../schools/api";
import { TalkToUs } from "../schools/TalkToUs";
import { isStarterChoice, type StarterChoice } from "./guard";
import {
  deviceTimeZone,
  useStartDemo,
  useStartPlace,
  type OwnStart,
  type StarterAnswer,
} from "./starter-api";
import { FamilySetup, type SetupKind } from "./setup/FamilySetup";
import { OwnYearTiles } from "./OwnYearTiles";
import { StepFrame } from "./setup/StepFrame";
import styles from "./Starter.module.css";

/** Unsent answers live only in this tab's memory, per account. */
type StarterDraft = {
  /** "I'm learning for myself": the year they were born. */
  ownYear: number | null;
};
const emptyDraft: StarterDraft = { ownYear: null };
const useStarterDraft = create<
  StarterDraft & {
    owner: string | null;
    set: (owner: string, change: Partial<StarterDraft>) => void;
  }
>((set) => ({
  owner: null,
  ...emptyDraft,
  set: (owner, change) =>
    set((state) =>
      state.owner === owner ? change : { owner, ...emptyDraft, ...change },
    ),
}));

const choices: {
  id: StarterChoice;
  label: string;
  detail: string;
  icon: ReactNode;
}[] = [
  {
    id: "myself",
    label: "I’m learning for myself",
    detail: "Practice for you, at your level",
    icon: (
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0" />
    ),
  },
  {
    id: "parent",
    label: "I’m a parent",
    detail: "Your children practice, and you see their progress",
    icon: (
      <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20a6.5 6.5 0 0 1 13 0M17 13a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM16 15.2a5 5 0 0 1 5.5 4.8" />
    ),
  },
  {
    id: "tutor",
    label: "I tutor or run a co-op",
    detail: "A class for children from several families",
    icon: (
      <path d="M4 18h16M6 18v-5a6 6 0 0 1 12 0v5M12 4v3M8.5 9.5l-1.5-1.5M15.5 9.5 17 8" />
    ),
  },
  {
    id: "teacher",
    label: "I’m a teacher",
    detail: "Set up your class and bring your students",
    icon: <path d="M3.5 5h17v11h-17zM8 20l2-4M16 20l-2-4M7 9h6M7 12h4" />,
  },
  {
    id: "school",
    label: "I run a school",
    detail: "Classes and teachers across your school",
    icon: <path d="M3 20h18M5 20V9l7-5 7 5v11M10 20v-5h4v5M12 9.5h.01" />,
  },
];

/** `/start`: "What brings you to AMP?". The answer decides what is created
 * and the words used. Each answer opens its own steps at its own URL
 * (`/start/<choice>`), the way a parent's setup does. A teacher opens classroom setup. */
export function Starter() {
  const { data: session } = useSuspenseQuery(sessionOptions);
  const params = useParams({ strict: false }) as { choice?: string };
  if (!session) return <Navigate to="/sign-in" replace />;
  // A parent or a tutor is walked through setting up their class.
  if (isSetup(params.choice))
    return <FamilySetup session={session} kind={params.choice} step="" />;
  // Learning for yourself, or a school: a step page of its own.
  if (params.choice === "myself") return <MyselfStep session={session} />;
  if (params.choice === "school") return <SchoolStep session={session} />;
  if (params.choice === "teacher")
    return <Navigate to="/$" params={{ _splat: "school/start" }} replace />;
  return <StarterScreen session={session} />;
}

const isSetup = (choice: unknown): choice is SetupKind =>
  choice === "parent" || choice === "tutor";

/** `/start/<parent|tutor>/<step>`: a later step of that setup. */
export function StarterStep() {
  const { data: session } = useSuspenseQuery(sessionOptions);
  const params = useParams({ strict: false }) as {
    choice?: string;
    step?: string;
  };
  if (!session) return <Navigate to="/sign-in" replace />;
  if (!isSetup(params.choice)) return <Navigate to="/start" replace />;
  return (
    <FamilySetup
      session={session}
      kind={params.choice}
      step={params.step ?? ""}
    />
  );
}

function StarterScreen({ session }: { session: AuthSession }) {
  const params = useParams({ strict: false }) as { choice?: string };
  const choice = isStarterChoice(params.choice) ? params.choice : null;
  const busy = false;
  return (
    <main className={styles.page} data-starter={choice ?? ""}>
      <h1 className={styles.title}>What brings you to AMP?</h1>
      <ul className={styles.choices}>
        {choices.map((entry) => {
          const content = (
            <>
              <svg
                viewBox="0 0 24 24"
                className={styles.icon}
                aria-hidden="true"
              >
                {entry.icon}
              </svg>
              <span className={styles.words}>
                <span className={styles.label}>{entry.label}</span>
                <span className={styles.detail}>{entry.detail}</span>
              </span>
            </>
          );
          return (
            <li key={entry.id}>
              {entry.id === "teacher" ? (
                <Link
                  to="/$"
                  params={{ _splat: "school/start" }}
                  className={styles.choice}
                  data-choice={entry.id}
                  onClick={() => track("starter_choice", { answer: entry.id })}
                >
                  {content}
                </Link>
              ) : (
                <Link
                  to="/start/$choice"
                  params={{ choice: entry.id }}
                  className={styles.choice}
                  data-choice={entry.id}
                  disabled={busy}
                  onClick={() => track("starter_choice", { answer: entry.id })}
                >
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}

/** A teacher or a school can explore a separate place with sample students. */
function useExplore(session: AuthSession) {
  const navigate = useNavigate();
  const demo = useStartDemo(session);
  const [error, setError] = useState("");
  const explore = (kind: "class" | "school") => {
    if (demo.isPending) return;
    setError("");
    demo.mutate(kind, {
      onSuccess: (home) => void navigate({ href: `/${home}` }),
      onError: (failure) => {
        console.error("The demo didn’t open", failure);
        setError(
          failure instanceof AppError &&
            (failure.status === 404 || failure.status === 405)
            ? "The demo isn’t open yet. Try again soon."
            : failure instanceof AppError
              ? failure.message
              : "That didn’t go through. Check your connection and try again.",
        );
      },
    });
  };
  return { explore, demo, error, setError };
}

/** One step, the whole of it: what starting means for each answer that
 * needs no more than one question. */
const ONE_STEP = {
  myself: [{ id: "", label: "Your practice" }],
  school: [{ id: "", label: "Your school" }],
} as const;

/** `/start/myself`: the year they were born, then straight into practice. */
function MyselfStep({ session }: { session: AuthSession }) {
  const navigate = useNavigate();
  const start = useStartPlace(session);
  const [error, setError] = useState("");
  const begin = (own: OwnStart) => {
    if (start.isPending) return;
    setError("");
    const answer: StarterAnswer = {
      as: "myself",
      timezone: deviceTimeZone(),
      ...own,
    };
    start.mutate(answer, {
      onSuccess: (result) => {
        // A plan chosen on the pitch before signing up opens for the learner
        // just made; otherwise their practice opens on its first problem,
        // and `/me` is where they come back to.
        const plan = chosenPlan();
        if (plan && result.learnerId)
          void navigate({
            to: "/continue/$learnerId",
            params: { learnerId: result.learnerId },
            search: { interval: plan },
          });
        else
          void navigate({
            to: "/$",
            params: { _splat: "practice" },
            replace: true,
          });
      },
      onError: (failure) => {
        console.error("The starter didn’t finish", failure);
        setError(
          failure instanceof AppError
            ? failure.message
            : "That didn’t go through. Check your connection and try again.",
        );
      },
    });
  };
  return (
    <>
      <Myself
        session={session}
        busy={start.isPending}
        onParent={() =>
          void navigate({ to: "/start/$choice", params: { choice: "parent" } })
        }
        onStart={begin}
      />
      <Toast message={error} onDismiss={() => setError("")} />
    </>
  );
}

/** `/start/school`: the school pitch, a demo to explore and a person to set
 * up the real one with. */
function SchoolStep({ session }: { session: AuthSession }) {
  const { explore, demo, error, setError } = useExplore(session);
  return (
    <>
      <School
        exploring={demo.isPending && demo.variables === "school"}
        onExplore={() => explore("school")}
      />
      <Toast message={error} onDismiss={() => setError("")} />
    </>
  );
}

/** "What year were you born?" for their own practice, and nothing else: the
 * year is always enough. A school-age year sets where it starts (the server
 * turns it into the nearest starting point); an adult's starts mid-scale, and
 * practice finds their level within a few problems (Reset and Try easier
 * cover the rest). Under 13, a parent sets AMP up, and that way in is one
 * tap away. */
function Myself({
  session,
  busy,
  onParent,
  onStart,
}: {
  session: AuthSession;
  busy: boolean;
  onParent: () => void;
  onStart: (start: OwnStart) => void;
}) {
  const draft = useStarterDraft();
  const mine = draft.owner === session.accountId;
  const picked = mine ? draft.ownYear : null;
  const young =
    picked !== null && !ownPracticeAllowed(picked, new Date().getFullYear());
  return (
    <StepFrame
      steps={ONE_STEP.myself}
      index={0}
      back="/start"
      title="What year were you born?"
      titleId="starter-myself"
      hintLines={2}
      lede="Practice starts at the level for your age, then adjusts with every answer."
      hint={
        young
          ? "Under 13, a parent sets up AMP for you. Ask yours to choose “I’m a parent”."
          : ""
      }
      next={
        young ? (
          <Button variant="primary" onClick={onParent}>
            Set up as a parent
          </Button>
        ) : (
          <Button
            variant="primary"
            aria-busy={busy || undefined}
            data-waiting={(picked === null && !busy) || undefined}
            disabled={busy || picked === null}
            onClick={() => {
              if (picked !== null) onStart({ birthYear: picked });
            }}
          >
            Start practicing
          </Button>
        )
      }
    >
      <OwnYearTiles
        value={picked}
        onChange={(year) => draft.set(session.accountId, { ownYear: year })}
        labelledBy="starter-myself"
        disabled={busy}
      />
    </StepFrame>
  );
}

/** The school pitch: a demo school to explore now, and a person to set up
 * the real one with. */
function School({
  exploring,
  onExplore,
}: {
  exploring: boolean;
  onExplore: () => void;
}) {
  const summary = useQuery({
    queryKey: ["schools", "curriculum"],
    queryFn: loadCurriculum,
    staleTime: Infinity,
  });
  const count = (value: number) => value.toLocaleString("en-US");
  return (
    <StepFrame
      steps={ONE_STEP.school}
      index={0}
      back="/start"
      title="AMP for your school"
      lede="Every student works at their own level in every area of math, from counting to precalculus, with unlimited problems and personalized workbooks. Teachers see who needs them today, and they decide every grade."
      next={
        <div className={styles.actions}>
          <Link
            to="/$"
            params={{ _splat: "school/connect" }}
            className={buttonClass("primary")}
          >
            Connect your school
          </Link>
          <Button
            variant="secondary"
            aria-busy={exploring || undefined}
            disabled={exploring}
            onClick={onExplore}
          >
            Explore a demo school
          </Button>
        </div>
      }
    >
      <ul className={styles.facts} aria-busy={summary.isPending || undefined}>
        {summary.data ? (
          <>
            <li>
              <strong>{count(summary.data.objectives)}</strong>
              <span>objectives mapped to Common Core standards</span>
            </li>
            <li>
              <strong>{count(summary.data.problemTypes)}</strong>
              <span>problem types that write new problems</span>
            </li>
            <li>
              <strong>{count(summary.data.lessons)}</strong>
              <span>
                lessons, with a hint and an explanation for every problem
              </span>
            </li>
          </>
        ) : (
          [0, 1, 2].map((index) => (
            <li key={index} className="amp-skeleton" aria-hidden="true" />
          ))
        )}
      </ul>
      <section className={styles.talk} aria-labelledby="starter-talk">
        <h2 id="starter-talk">Talk to us</h2>
        <p className={styles.note}>
          Tell us about your school, and we’ll set AMP up with you.
        </p>
        <TalkToUs />
      </section>
    </StepFrame>
  );
}
