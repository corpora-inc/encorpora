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
import { useClassSearch } from "../teacher-shared";
import { RowButton, RowList } from "../../../../ui/RowList";
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
  manage,
  locked,
  session,
  me,
  secondParent,
}: {
  data: TodayResponse;
  place: { org: string; class: string };
  /** The class code, for the one Join element. */
  code: string | null;
  /** This reader can make a new code. */
  manage: boolean;
  /** Sign-in is paused by guessing: New code is the way on. */
  locked: boolean;
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
  // The children's own devices, by address (`?devices=1`): Back closes it.
  const [search, setSearch, closeSearch] = useClassSearch();
  const joining = search.devices === 1 || search.devices === "1";
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
  const entries = [...firstSteps, ...todos, ...allowance, ...second];

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
        {/* Their own devices: an option, under the children, for a family
            whose children sign in with the code or a printed card. */}
        {code && (
          <RowList label="Other ways to practice">
            <RowButton
              title="Their own devices"
              meta="Sign in with a code or a printed card"
              data-own-devices=""
              onClick={() => setSearch({ devices: 1 })}
            />
          </RowList>
        )}
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
          onOpenChange={(open) => {
            if (!open) closeSearch("devices");
          }}
          title="Their own devices"
        >
          <JoinClass
            code={code}
            place={place}
            family
            heading={false}
            manage={manage}
            locked={locked}
          />
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
