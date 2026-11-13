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
import { Sheet } from "../../../../ui/Sheet";
import { Toast } from "../../../../ui/Toast";
import { rememberContinuation } from "../../../continue/memory";
import { SecondParentInviteSheet } from "../../../second-parent/SecondParent";
import { JoinClass } from "../../join/JoinClass";
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
  code,
  session,
  me,
  secondParent,
}: {
  data: TodayResponse;
  place: { org: string; class: string };
  /** The class code, for the one Join element. */
  code: string | null;
  session: AuthSession;
  me: SignedInMe | undefined;
  /** The family's second parent; undefined unless this is its holder. */
  secondParent: unknown;
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
  const [joining, setJoining] = useState(false);
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
      />
    ) : null;

  const fresh = data.students.filter((student) => !student.lastActive);
  // A first practice is each child's own row action ("Let … practice
  // here"); the feed doesn't repeat it.
  const firstSteps: FeedEntry[] = [];
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
  // The real task is getting each child signed in on a device of their
  // own; printing cards is one way, inside the Join element. Gone once
  // they've practiced.
  const signIn: FeedEntry[] =
    fresh.length > 0 && code
      ? [
          {
            id: "sign-in",
            title: `Sign ${names(fresh.map((student) => student.name))} in on ${fresh.length === 1 ? "their own device" : "their own devices"}`,
            detail:
              "Scan the class’s code or open its link, then tap a name and three pictures.",
            mark: "check",
            actions: (
              <Button variant="secondary" onClick={() => setJoining(true)}>
                Sign in
              </Button>
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
  const entries = [...firstSteps, ...todos, ...allowance, ...signIn, ...second];

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
      {code && (
        <Sheet
          open={joining}
          onOpenChange={setJoining}
          title="Sign in on their own device"
        >
          <JoinClass code={code} place={place} family />
        </Sheet>
      )}
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
