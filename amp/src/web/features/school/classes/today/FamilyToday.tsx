import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import type { SignedInMe } from "../../../../../account/contracts";
import type {
  TodayResponse,
  TodayStudentResource,
  TodayTodo,
} from "../../../../../schools/teacher-contracts";
import type { AuthSession } from "../../../../auth";
import { Button, buttonClass } from "../../../../ui/Button";
import { EmptyState } from "../../../../ui/EmptyState";
import { Toast } from "../../../../ui/Toast";
import { rememberContinuation } from "../../../continue/memory";
import { SecondParentInviteSheet } from "../../../second-parent/SecondParent";
import { ChildRow, PracticeHere } from "./ChildRow";
import { Feed, type FeedEntry } from "./Feed";
import { todoEntries, useChecks } from "./todo-entries";
import styles from "./Today.module.css";
import { useHandOver } from "./use-hand-over";
import { WeekFacts } from "./WeekFacts";

type Learner = SignedInMe["learners"][number];
/** Fewer free problems than this and Today says so. */
const FEW_FREE = 20;
const SECOND_PARENT_KEY = (accountId: string) =>
  `amp.today.second-parent.${accountId}`;

const names = (list: readonly string[]) =>
  list.length < 2
    ? (list[0] ?? "")
    : `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`;
const gradeWords = (grade: number | null) =>
  grade === null
    ? "their grade"
    : grade === 0
      ? "kindergarten"
      : `grade ${grade}`;

function dismissedSecondParent(accountId: string) {
  try {
    return localStorage.getItem(SECOND_PARENT_KEY(accountId)) === "dismissed";
  } catch (error) {
    console.warn("The second-parent offer’s state couldn’t be read", error);
    return false;
  }
}

/** A family's Today (docs/design/ia.md): each child on one line, then the
 * same feed as a teacher's, in a parent's words. Before there's any work the
 * feed holds the first steps: a first practice here, sign-in cards for their
 * own devices and, low in the list, a second parent. */
export function FamilyToday({
  data,
  place,
  session,
  me,
  secondParent,
  onLesson,
}: {
  data: TodayResponse;
  place: { org: string; class: string };
  session: AuthSession;
  me: SignedInMe | undefined;
  /** The family's second parent; undefined unless this is its holder. */
  secondParent: unknown;
  onLesson: (templateId: string) => void;
}) {
  const here = useRouterState({
    select: (state) => state.location.pathname + state.location.searchStr,
  });
  const { starting, error, clearError, handOver } = useHandOver(session);
  const [done, setDone] = useChecks(place.class, data.today);
  const [secondGone, setSecondGone] = useState(() =>
    dismissedSecondParent(session.accountId),
  );
  const [inviting, setInviting] = useState(false);
  const holder = me?.familyClass?.classId === place.class;
  const learners: readonly Learner[] = holder
    ? me!.learners
    : (me?.secondParentOf?.find((entry) => entry.classId === place.class)
        ?.learners ?? []);
  const byLearner = new Map(learners.map((learner) => [learner.id, learner]));
  const learnerOf = (student: TodayStudentResource) =>
    student.learnerId ? byLearner.get(student.learnerId) : undefined;
  const byPerson = new Map(
    data.students.map((student) => [student.id, student]),
  );
  const practice = (student: TodayStudentResource, primary = false) => {
    const learner = learnerOf(student);
    return learner?.entitlement.active ? (
      <PracticeHere
        learnerId={learner.id}
        name={student.name}
        starting={starting}
        primary={primary}
        onPracticeHere={(id) => void handOver(id)}
      />
    ) : null;
  };
  const remember = (learnerId: string) =>
    rememberContinuation({
      accountId: session.accountId,
      learnerId,
      returnTo: here,
    });

  if (!data.students.length)
    return holder ? (
      <EmptyState
        title="Add your children"
        action={
          <Link
            to="/$"
            params={{ _splat: "family/learners" }}
            className={buttonClass("primary")}
          >
            Add a child
          </Link>
        }
      >
        Each child gets a line here with their week and a way to practice on
        this device.
      </EmptyState>
    ) : null;

  const fresh = data.students.filter((student) => !student.lastActive);
  const firstSteps: FeedEntry[] = fresh.flatMap((student, index) => {
    const action = practice(student, index === 0);
    return action
      ? [
          {
            id: `first:${student.id}`,
            title: `Let ${student.name} do a first practice here`,
            detail: `${student.name} starts near ${gradeWords(student.gradeLevel)}, and AMP finds their level from the first answers.`,
            mark: "plain" as const,
            actions: action,
          },
        ]
      : [];
  });
  // On a single child's item, the way to practice it now.
  const extra = (todo: TodayTodo) => {
    if (todo.kind === "good-day" || todo.students.length !== 1) return null;
    const student = byPerson.get(todo.students[0]!.id);
    return student ? practice(student) : null;
  };
  const todos = todoEntries({
    todos: data.todos,
    place,
    canPrint: data.canPrint,
    onLesson,
    extra,
    people: false,
    // A first practice, when there is one, is the screen's primary action.
    lead: firstSteps.length === 0,
  });
  const allowance: FeedEntry[] = holder
    ? data.students.flatMap((student) => {
        const learner = learnerOf(student);
        const left = learner?.freeAllowance?.problems.remaining;
        if (!learner || learner.entitlement.licensed || left === undefined)
          return [];
        if (left > FEW_FREE) return [];
        return [
          {
            id: `free:${student.id}:${left === 0 ? "used" : "few"}`,
            title:
              left === 0
                ? `${student.name} has used the 100 free problems`
                : `${student.name} has ${left} free ${left === 1 ? "problem" : "problems"} left`,
            detail:
              left === 0
                ? `Continue with AMP and ${student.name} picks up where they left off.`
                : `After those, continue with AMP to keep ${student.name} practicing.`,
            mark: left === 0 ? ("plain" as const) : ("check" as const),
            actions: (
              <Link
                to="/continue/$learnerId"
                params={{ learnerId: learner.id }}
                className={buttonClass(left === 0 ? "primary" : "secondary")}
                onClick={() => remember(learner.id)}
              >
                Continue with AMP
              </Link>
            ),
          },
        ];
      })
    : [];
  const cards: FeedEntry[] =
    fresh.length > 0 && data.canPrint
      ? [
          {
            id: "cards",
            title: `Print sign-in cards so ${names(fresh.map((student) => student.name))} can practice on their own ${fresh.length === 1 ? "device" : "devices"}`,
            detail:
              "A card signs a child in with one scan. The class code and three pictures work too.",
            mark: "check",
            actions: (
              <Link
                to="/school/$org/classes/$class/cards"
                params={place}
                search={{}}
                className={buttonClass("secondary")}
              >
                Print cards
              </Link>
            ),
          },
        ]
      : [];
  const second: FeedEntry[] =
    holder && secondParent === null && !secondGone
      ? [
          {
            id: "second-parent",
            title: "Add a second parent",
            detail: "Both parents’ own practice is included.",
            mark: "dismiss",
            actions: (
              <Button variant="secondary" onClick={() => setInviting(true)}>
                Add a second parent
              </Button>
            ),
          },
        ]
      : [];
  const entries = [...firstSteps, ...todos, ...allowance, ...cards, ...second];

  return (
    <>
      <section aria-labelledby="today-children">
        <h2 id="today-children" className={styles.sectionTitle}>
          Children
        </h2>
        <ul className={styles.children}>
          {data.students.map((student) => (
            <ChildRow
              key={student.id}
              student={student}
              today={data.today}
              learner={learnerOf(student)}
              holder={holder}
              starting={starting}
              onPracticeHere={(id) => void handOver(id)}
              onContinue={remember}
            />
          ))}
        </ul>
      </section>
      {entries.length > 0 && (
        <section aria-labelledby="today-feed">
          <h2 id="today-feed" className={styles.sectionTitle}>
            {fresh.length === data.students.length
              ? "First steps"
              : "For today"}
          </h2>
          <Feed
            entries={entries}
            done={done}
            onDone={setDone}
            onDismiss={(id) => {
              if (id !== "second-parent") return;
              try {
                localStorage.setItem(
                  SECOND_PARENT_KEY(session.accountId),
                  "dismissed",
                );
              } catch (failure) {
                console.warn("The offer stays dismissed until reload", failure);
              }
              setSecondGone(true);
            }}
          />
        </section>
      )}
      <WeekFacts week={data.week} family target={data.weeklyTargetMinutes} />
      {inviting && (
        <SecondParentInviteSheet
          session={session}
          onClose={() => setInviting(false)}
        />
      )}
      <Toast message={error} onDismiss={clearError} />
    </>
  );
}
