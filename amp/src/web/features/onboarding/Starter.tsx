import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link, Navigate, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { create } from "zustand";
import type { AuthSession } from "../../auth";
import { AppError } from "../../lib/AppError";
import { sessionOptions } from "../../lib/query";
import { chosenPlan } from "../../lib/pending-trial";
import { Button, buttonClass } from "../../ui/Button";
import { BirthYearPicker } from "../../ui/Select";
import { Stepper } from "../../ui/Stepper";
import { Toast } from "../../ui/Toast";
import { loadCurriculum } from "../schools/api";
import { TalkToUs } from "../schools/TalkToUs";
import { isStarterChoice, type StarterChoice } from "./guard";
import {
  deviceTimeZone,
  useStartDemo,
  useStartPlace,
  type StarterAnswer,
} from "./starter-api";
import styles from "./Starter.module.css";

const ORDINALS = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth"];
const MAX_CHILDREN = 6;
const MAX_STUDENTS = 30;

/** Unsent answers live only in this tab's memory, per account. */
type StarterDraft = {
  children: number;
  childYears: string[];
  students: number;
  studentYears: string[];
};
const emptyDraft: StarterDraft = {
  children: 1,
  childYears: [],
  students: 1,
  studentYears: [],
};
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
    detail: "Your own practice, at your own level",
    icon: (
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0" />
    ),
  },
  {
    id: "parent",
    label: "I’m a parent",
    detail: "Your children practice, and you see their work",
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
    detail: "A demo class, alive with students’ work",
    icon: <path d="M3.5 5h17v11h-17zM8 20l2-4M16 20l-2-4M7 9h6M7 12h4" />,
  },
  {
    id: "school",
    label: "I run a school",
    detail: "Every class, set up with you",
    icon: <path d="M3 20h18M5 20V9l7-5 7 5v11M10 20v-5h4v5M12 9.5h.01" />,
  },
];

/** Set when a choice is tapped on this screen, so its question scrolls into
 * view once the answer's URL is open. */
let chosenHere = false;

/** `/start` and `/start/<choice>`: "What brings you to AMP?". The answer
 * decides what is created and the words used; the next question shows on
 * the same screen, under the five choices, which never move. */
export function Starter() {
  const { data: session } = useSuspenseQuery(sessionOptions);
  if (!session) return <Navigate to="/sign-in" replace />;
  return <StarterScreen session={session} />;
}

function StarterScreen({ session }: { session: AuthSession }) {
  const params = useParams({ strict: false }) as { choice?: string };
  const choice = isStarterChoice(params.choice) ? params.choice : null;
  const navigate = useNavigate();
  const start = useStartPlace(session);
  const demo = useStartDemo(session);
  const busy = start.isPending || demo.isPending;
  const [error, setError] = useState("");
  // Where the place opens, when an answer found everyone it named there.
  const [already, setAlready] = useState<string | null>(null);
  const openPlace = already
    ? () => void navigate({ href: `/${already}` })
    : null;
  // A changed answer is a new question.
  const answer = useStarterDraft((draft) =>
    JSON.stringify([
      draft.children,
      draft.childYears,
      draft.students,
      draft.studentYears,
    ]),
  );
  useEffect(() => setAlready(null), [answer, choice]);
  const followUp = useRef<HTMLDivElement>(null);
  // A choice made here brings its question into view; a choice the page
  // opened with (a refresh, a link, Back) leaves the page where it is.
  useEffect(() => {
    if (!choice || !chosenHere) return;
    chosenHere = false;
    followUp.current?.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "nearest",
    });
  }, [choice]);
  /** A teacher or a school explores a demo first: nothing real is made
   * until an agreement or a purchase. */
  const explore = (kind: "class" | "school") => {
    if (busy) return;
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
  const begin = (answer: StarterAnswer) => {
    if (busy) return;
    setError("");
    setAlready(null);
    start.mutate(answer, {
      onSuccess: (result) => {
        // A plan chosen on the pitch before signing up opens for the learner
        // just made; otherwise the new place opens.
        // The place already had everyone this answer named: say so here,
        // rather than carry on as if something was added.
        if (
          result.added === 0 &&
          (answer.as === "parent" || answer.as === "tutor")
        ) {
          setAlready(result.home);
          return;
        }
        const plan = chosenPlan();
        if (
          plan &&
          result.learnerId &&
          (answer.as === "parent" || answer.as === "myself")
        )
          void navigate({
            to: "/continue/$learnerId",
            params: { learnerId: result.learnerId },
            search: { interval: plan },
          });
        else void navigate({ href: `/${result.home}` });
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
    <main className={styles.page} data-starter={choice ?? ""}>
      <h1 className={styles.title}>What brings you to AMP?</h1>
      <ul className={styles.choices}>
        {choices.map((entry) => {
          const selected = entry.id === choice;
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
              {entry.id === "myself" || entry.id === "teacher" ? (
                // Nothing more to ask: one tap makes their own practice, or
                // opens a demo class.
                <button
                  type="button"
                  className={styles.choice}
                  data-choice={entry.id}
                  aria-busy={
                    (entry.id === "myself"
                      ? start.isPending && start.variables?.as === "myself"
                      : demo.isPending && demo.variables === "class") ||
                    undefined
                  }
                  disabled={busy}
                  onClick={() =>
                    entry.id === "myself"
                      ? begin({ as: "myself", timezone: deviceTimeZone() })
                      : explore("class")
                  }
                >
                  {content}
                </button>
              ) : (
                <Link
                  to="/start/$choice"
                  params={{ choice: entry.id }}
                  className={styles.choice}
                  data-choice={entry.id}
                  aria-current={selected ? "step" : undefined}
                  disabled={busy}
                  onClick={() => {
                    chosenHere = true;
                  }}
                >
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      <div ref={followUp} className={styles.followUp}>
        {choice === "parent" ? (
          <Children
            session={session}
            busy={busy}
            already={
              openPlace && {
                note: "These children are already in your class.",
                open: openPlace,
              }
            }
            onStart={(years) =>
              begin({
                as: "parent",
                children: years.map((birthYear) => ({ birthYear })),
              })
            }
          />
        ) : choice === "tutor" ? (
          <Students
            session={session}
            busy={busy}
            already={
              openPlace && {
                note: "These students are already in your class.",
                open: openPlace,
              }
            }
            onStart={(years) =>
              begin({
                as: "tutor",
                students: years.map((birthYear) => ({ birthYear })),
              })
            }
          />
        ) : choice === "school" ? (
          <School
            busy={busy}
            exploring={demo.isPending && demo.variables === "school"}
            onExplore={() => explore("school")}
          />
        ) : null}
      </div>
      <Toast message={error} onDismiss={() => setError("")} />
    </main>
  );
}

/** Birth years for `count` people, each with its own designed picker. */
function Years({
  count,
  years,
  name,
  onChange,
  disabled,
}: {
  count: number;
  years: string[];
  name: (index: number) => string;
  onChange: (years: string[]) => void;
  disabled: boolean;
}) {
  return (
    <ol className={styles.years}>
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className={styles.year}>
          <span className={styles.yearName}>{name(index)}</span>
          <BirthYearPicker
            label={`Birth year, ${name(index).toLowerCase()}`}
            adult={false}
            value={years[index] ?? ""}
            disabled={disabled}
            onChange={(value) => {
              const next = [...years];
              next[index] = value;
              onChange(next);
            }}
          />
        </li>
      ))}
    </ol>
  );
}

const chosenYears = (years: string[], count: number) => {
  const picked = years.slice(0, count).map(Number);
  return picked.length === count && picked.every((year) => year > 0)
    ? picked
    : null;
};

function Children({
  session,
  busy,
  already,
  onStart,
}: {
  session: AuthSession;
  busy: boolean;
  already: { note: string; open: () => void } | null;
  onStart: (years: number[]) => void;
}) {
  const draft = useStarterDraft();
  const mine = draft.owner === session.accountId;
  const count = mine ? draft.children : 1;
  const years = mine ? draft.childYears : [];
  const ready = chosenYears(years, count);
  return (
    <section className={styles.panel} aria-labelledby="starter-children">
      <h2 id="starter-children" className={styles.question}>
        How many children?
      </h2>
      <Stepper
        label="Children"
        hideLabel
        value={count}
        min={1}
        max={MAX_CHILDREN}
        onChange={(value) => draft.set(session.accountId, { children: value })}
      />
      <Years
        count={count}
        years={years}
        disabled={busy}
        name={(index) =>
          count === 1 ? "Your child" : `${ORDINALS[index]} child`
        }
        onChange={(next) => draft.set(session.accountId, { childYears: next })}
      />
      <p className={styles.note}>
        Each child starts as a picture, like Fox or Moon, until you add their
        name.
      </p>
      <Start
        busy={busy}
        ready={!!ready}
        missing="Choose a birth year for each child."
        already={already}
        onClick={() => ready && onStart(ready)}
      >
        Continue
      </Start>
    </section>
  );
}

function Students({
  session,
  busy,
  already,
  onStart,
}: {
  session: AuthSession;
  busy: boolean;
  already: { note: string; open: () => void } | null;
  onStart: (years: number[]) => void;
}) {
  const draft = useStarterDraft();
  const mine = draft.owner === session.accountId;
  const count = mine ? draft.students : 1;
  const years = mine ? draft.studentYears : [];
  const ready = count === 0 ? [] : chosenYears(years, count);
  return (
    <section className={styles.panel} aria-labelledby="starter-students">
      <h2 id="starter-students" className={styles.question}>
        How many students?
      </h2>
      <Stepper
        label="Students"
        hideLabel
        value={count}
        min={0}
        max={MAX_STUDENTS}
        onChange={(value) => draft.set(session.accountId, { students: value })}
      />
      {count > 0 && (
        <Years
          count={count}
          years={years}
          disabled={busy}
          name={(index) => `Student ${index + 1}`}
          onChange={(next) =>
            draft.set(session.accountId, { studentYears: next })
          }
        />
      )}
      <p className={styles.note}>
        Each student is a picture, like Fox or Moon. Their own parent adds their
        name through a link you send.
      </p>
      <Start
        busy={busy}
        ready={!!ready}
        missing="Choose a birth year for each student."
        already={already}
        onClick={() => ready && onStart(ready)}
      >
        Create my class
      </Start>
    </section>
  );
}

/** The school pitch, inline: a demo school to explore now, and a person to set
 * up the real one with. */
function School({
  busy,
  exploring,
  onExplore,
}: {
  busy: boolean;
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
    <section className={styles.panel} aria-labelledby="starter-school">
      <h2 id="starter-school" className={styles.question}>
        AMP for your school
      </h2>
      <p className={styles.lede}>
        Every student works at their own level in every area of math, from
        counting to precalculus, with unlimited problems and personalized
        workbooks. Teachers see who needs them today, and they decide every
        grade.
      </p>
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
      <div className={styles.actions}>
        <Button
          variant="primary"
          aria-busy={exploring || undefined}
          disabled={busy}
          onClick={onExplore}
        >
          Explore a demo school
        </Button>
        <a href="#starter-talk" className={buttonClass("secondary")}>
          Talk to us
        </a>
      </div>
      <div id="starter-talk" className={styles.talk}>
        <h3>Talk to us</h3>
        <p className={styles.note}>
          Tell us about your school, and we’ll set AMP up with you.
        </p>
        <TalkToUs />
      </div>
    </section>
  );
}

/** The one action under a question. Until it can succeed it waits, with the
 * reason beneath in space that is always kept. */
function Start({
  busy,
  ready,
  missing = "",
  already,
  onClick,
  children,
}: {
  busy: boolean;
  ready: boolean;
  missing?: string;
  /** Everyone named is already there: the place opens instead. */
  already?: { note: string; open: () => void } | null;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <div className={styles.go}>
      <Button
        variant="primary"
        className={styles.goButton}
        disabled={busy || (!ready && !already)}
        aria-busy={busy || undefined}
        onClick={already ? already.open : onClick}
      >
        {already ? "Open your class" : children}
      </Button>
      <p className={styles.hint} aria-live="polite">
        {already ? already.note : ready ? "" : missing}
      </p>
    </div>
  );
}
