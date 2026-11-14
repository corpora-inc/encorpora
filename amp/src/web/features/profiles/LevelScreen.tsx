import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import type { FormEvent } from "react";
import {
  gradeCourse,
  gradeTitle,
  levelName,
  paceLevel,
  paceNames,
  profilePaces,
  type ProfilePace,
} from "../../../learning/practice-profiles";
import { AppError } from "../../lib/AppError";
import { meOptions } from "../../lib/query";
import { returnTarget } from "../../lib/return-to";
import { Button } from "../../ui/Button";
import { Segmented, type SegmentedOption } from "../../ui/Segmented";
import { Toast } from "../../ui/Toast";
import { currentSession } from "../school/api";
import { usePracticeAtLevel } from "./api";
import { GradePicker } from "./GradePicker";
import { practiceAs } from "./practice-mode";
import { newProfileSearch } from "./ProfileScreens";
import styles from "./LevelScreen.module.css";

const paceOptions: SegmentedOption<ProfilePace>[] = profilePaces.map(
  (pace) => ({
    value: pace,
    label: paceNames[pace],
    detail:
      pace === "behind"
        ? "A grade below"
        : pace === "ahead"
          ? "A grade above"
          : "At grade",
  }),
);

/** A level's name that never breaks across lines: "Grade 3". */
const level = (at: number) => levelName(at).replace(/ /g, " ");

/**
 * `/me/level`, "Practice at a level" (SPEC R5): a grade and a pace, then
 * straight into practice there. For anyone helping someone ("my niece, 4th
 * grade") or curious about a level: it asks nothing about anyone, saves
 * nothing about anyone, and each new choice starts fresh. It practices as
 * the account's one level profile; saving a named profile is optional. The
 * grade and pace live in the URL, so a refresh or Back keeps the choice.
 */
export function LevelScreen() {
  const session = currentSession();
  const navigate = useNavigate();
  const raw = useSearch({ strict: false }) as Record<string, unknown>;
  const search = newProfileSearch(raw);
  const from = returnTarget(raw.from);
  const me = useQuery(meOptions(session)).data;
  // The last choice, when the address names none: where they were.
  const last = me?.signedIn
    ? me.practiceProfiles?.find((profile) => profile.level)?.level
    : undefined;
  const grade = search.grade ?? last?.grade ?? null;
  const pace = search.pace ?? last?.pace ?? "on-level";
  const start = usePracticeAtLevel(session);
  const choose = (next: { grade: number | null; pace: ProfilePace }) => {
    start.reset();
    void navigate({
      to: ".",
      search: ((current: Record<string, unknown>) => ({
        ...current,
        ...(next.grade === null ? {} : { grade: next.grade }),
        pace: next.pace,
      })) as never,
      replace: true,
    });
  };
  const course = grade === null ? null : gradeCourse(grade);
  const busy = start.isPending || start.isSuccess;
  return (
    <main className={styles.page}>
      <Toast
        message={
          start.error
            ? start.error instanceof AppError &&
              start.error.code === "too_many_learners"
              ? "This account holds the most learners and profiles it can. Delete a profile, then try again."
              : start.error instanceof AppError &&
                  start.error.kind === "network"
                ? start.error.message
                : "Practice didn’t start. Try again in a moment."
            : ""
        }
        onDismiss={() => start.reset()}
        takeFocus
      />
      <form
        className={styles.form}
        noValidate
        data-level-practice
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          if (grade === null || busy) return;
          start.mutate(
            { grade, pace },
            {
              onSuccess: (profile) =>
                void navigate(practiceAs(profile, from ?? "/me/level")),
            },
          );
        }}
      >
        <header className={styles.head}>
          <h1>Practice at a level</h1>
          <p>
            Any grade, any pace: for someone you help, or just to see. Nothing
            about anyone is saved, and your own levels never change.
          </p>
        </header>
        <div className={styles.field}>
          <span className={styles.label} id="level-grade">
            Grade
          </span>
          <GradePicker
            value={grade}
            disabled={busy}
            onChange={(next) => choose({ grade: next, pace })}
          />
          {/* One line, always there: what the choice means. */}
          <p className={styles.caption} data-grade-caption>
            {grade === null
              ? "Choose a grade, from kindergarten to 12th."
              : `${gradeTitle(grade)}${course ? ` · ${course}` : ""} · starts at ${level(paceLevel(grade, pace))}`}
          </p>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Pace</span>
          <Segmented
            compact
            label="Pace"
            options={paceOptions}
            value={pace}
            disabled={busy}
            onChange={(next) => choose({ grade, pace: next })}
          />
        </div>
        <div className={styles.actions}>
          <Button
            variant="primary"
            className={styles.go}
            aria-busy={busy || undefined}
            // Until a grade is chosen the action waits faintly in its place.
            data-waiting={(grade === null && !busy) || undefined}
            disabled={busy || grade === null}
          >
            Start practicing
          </Button>
          <Link
            to="/$"
            params={{ _splat: "me/profiles/new" }}
            search={(grade === null ? {} : { grade, pace }) as never}
            className={styles.save}
          >
            Save as a profile
          </Link>
        </div>
      </form>
    </main>
  );
}
