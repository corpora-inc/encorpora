import { useQuery } from "@tanstack/react-query";
import {
  Link,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  divisionLabels,
  formatDay,
  yearName,
  type DivisionKind,
} from "../../../../schools/calendar";
import type {
  RolloverInput,
  RolloverOptions,
  RolloverResult,
} from "../../../../schools/org-contracts";
import { AppError } from "../../../lib/AppError";
import { useLoggedError } from "../../../feedback";
import { Button, buttonClass } from "../../../ui/Button";
import { CheckboxControl } from "../../../ui/Checkbox";
import { DatePicker } from "../../../ui/DatePicker";
import { EmptyState } from "../../../ui/EmptyState";
import { Loading } from "../../../ui/Loading";
import { LoadingScreen } from "../../../ui/LoadingScreen";
import { Segmented } from "../../../ui/Segmented";
import { Select } from "../../../ui/Select";
import { currentSession, refreshSchool } from "../api";
import { number } from "../classes/teacher-shared";
import { OrgFrame } from "../OrgFrame";
import { FormNote, gradeLabel, PageHead } from "../parts";
import { orgPath } from "../paths";
import { YearRibbon } from "../YearRibbon";
import { applyRollover, rolloverOptions, rolloverPlanOptions } from "./org-api";
import styles from "./Org.module.css";

const STEPS = [
  { id: "dates", label: "Dates" },
  { id: "classes", label: "Classes" },
  { id: "grades", label: "Grades" },
  { id: "review", label: "Review" },
] as const;
type StepId = (typeof STEPS)[number]["id"];
const isStep = (value: unknown): value is StepId =>
  STEPS.some((step) => step.id === value);

type Draft = {
  startsOn: string;
  endsOn: string;
  division: DivisionKind | null;
  /** Classes left behind: everything carries over unless someone says not. */
  skipped: string[];
  keepStudents: boolean;
  graduating: Record<string, number | null>;
};
const draftKey = (orgId: string) => `amp.school.rollover.${orgId}`;
function readDraft(orgId: string): Draft | null {
  try {
    return JSON.parse(sessionStorage.getItem(draftKey(orgId)) ?? "null");
  } catch (error) {
    console.warn("The new year’s draft couldn’t be read", error);
    return null;
  }
}
function saveDraft(orgId: string, draft: Draft | null) {
  try {
    if (draft) sessionStorage.setItem(draftKey(orgId), JSON.stringify(draft));
    else sessionStorage.removeItem(draftKey(orgId));
  } catch (error) {
    console.warn("The new year’s draft couldn’t be saved", error);
  }
}
const startingDraft = (options: RolloverOptions): Draft => ({
  startsOn: options.suggested.startsOn,
  endsOn: options.suggested.endsOn,
  division: options.suggested.division,
  skipped: [],
  keepStudents: false,
  graduating: Object.fromEntries(
    options.schools.map((school) => [school.id, school.graduating]),
  ),
});
const toInput = (draft: Draft, options: RolloverOptions): RolloverInput => ({
  startsOn: draft.startsOn,
  endsOn: draft.endsOn,
  division: draft.division,
  classIds: options.classes
    .filter((klass) => !draft.skipped.includes(klass.id))
    .map((klass) => klass.id),
  keepStudents: draft.keepStudents,
  graduating: draft.graduating as RolloverInput["graduating"],
});

function DatesStep({
  draft,
  onChange,
}: {
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
}) {
  const days =
    (Date.parse(`${draft.endsOn}T00:00:00Z`) -
      Date.parse(`${draft.startsOn}T00:00:00Z`)) /
    86_400_000;
  const valid = days >= 30 && days <= 400;
  return (
    <div className={styles.stepBody}>
      <h2>When does the new year run?</h2>
      <div className={styles.dateRow}>
        <DatePicker
          label="First day"
          value={draft.startsOn}
          onChange={(startsOn) => onChange({ startsOn })}
        />
        <DatePicker
          label="Last day"
          value={draft.endsOn}
          min={draft.startsOn}
          onChange={(endsOn) => onChange({ endsOn })}
          error={valid ? undefined : "A school year runs 30 to 400 days."}
        />
      </div>
      <div className={styles.fieldGroup}>
        <span className={styles.groupLabel}>Terms</span>
        <Segmented
          label="Terms"
          compact
          value={draft.division ?? "none"}
          onChange={(value) =>
            onChange({
              division: value === "none" ? null : (value as DivisionKind),
            })
          }
          options={[
            { value: "none", label: "None" },
            { value: "semester", label: divisionLabels.semester.plural },
            { value: "trimester", label: divisionLabels.trimester.plural },
            { value: "quarter", label: divisionLabels.quarter.plural },
          ]}
        />
      </div>
      {valid && (
        <YearRibbon
          startsOn={draft.startsOn}
          endsOn={draft.endsOn}
          division={draft.division}
        />
      )}
    </div>
  );
}

function ClassesStep({
  draft,
  options,
  onChange,
}: {
  draft: Draft;
  options: RolloverOptions;
  onChange: (patch: Partial<Draft>) => void;
}) {
  const many = options.schools.length > 1;
  const chosen = options.classes.length - draft.skipped.length;
  const toggle = (id: string, on: boolean) =>
    onChange({
      skipped: on
        ? draft.skipped.filter((entry) => entry !== id)
        : [...draft.skipped, id],
    });
  return (
    <div className={styles.stepBody}>
      <h2>Which classes carry over?</h2>
      <p className={styles.stepLead}>
        Each copy gets a new join code and keeps its teachers, settings and
        course. Last year’s class stays as it was, with its grades.
      </p>
      <div className={styles.fieldGroup}>
        <span className={styles.groupLabel}>Who’s in the new classes</span>
        <Segmented
          label="Who’s in the new classes"
          compact
          value={draft.keepStudents ? "keep" : "empty"}
          onChange={(value) => onChange({ keepStudents: value === "keep" })}
          options={[
            { value: "empty", label: "New roster" },
            { value: "keep", label: "Same students" },
          ]}
        />
        <p className={styles.fieldNote}>
          {draft.keepStudents
            ? "Students stay together and move into the new copy on the first day."
            : "Classes start empty, ready for next year’s roster. Students stay at the school."}
        </p>
      </div>
      <div className={styles.listHead}>
        <span>
          {number(chosen)} of {number(options.classes.length)} classes
        </span>
        <Button
          variant="quiet"
          onClick={() =>
            onChange({
              skipped: chosen ? options.classes.map((klass) => klass.id) : [],
            })
          }
        >
          {chosen ? "Clear all" : "Choose all"}
        </Button>
      </div>
      <ul className={styles.classList}>
        {options.classes.map((klass) => (
          <li key={klass.id}>
            <label className={styles.classRow}>
              <CheckboxControl
                checked={!draft.skipped.includes(klass.id)}
                onChange={(event) => toggle(klass.id, event.target.checked)}
              />
              <span className={styles.classWords}>
                <strong>{klass.name}</strong>
                <span>
                  {[
                    many ? klass.school : "",
                    klass.teachers.join(", ") || "No teacher",
                    `${number(klass.students)} ${klass.students === 1 ? "student" : "students"}`,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GradesStep({
  draft,
  options,
  onChange,
}: {
  draft: Draft;
  options: RolloverOptions;
  onChange: (patch: Partial<Draft>) => void;
}) {
  const many = options.schools.length > 1;
  return (
    <div className={styles.stepBody}>
      <h2>Who moves up, and who finishes?</h2>
      <p className={styles.stepLead}>
        Everyone moves up one grade. Students in the grade that finishes leave
        the school: their access ends and their seat is freed, and their grades
        and history stay.
      </p>
      <ul className={styles.gradeSchools}>
        {options.schools.map((school) => {
          const finishing = draft.graduating[school.id] ?? null;
          const leaving = school.grades
            .filter(({ grade }) => finishing !== null && grade >= finishing)
            .reduce((sum, { students }) => sum + students, 0);
          const staying =
            school.grades.reduce((sum, { students }) => sum + students, 0) -
            leaving;
          return (
            <li key={school.id}>
              {many && <h3>{school.name}</h3>}
              <div className={styles.gradeBody}>
                <ol className={styles.gradeRun}>
                  {school.grades.map(({ grade, students }) => (
                    <li
                      key={grade}
                      data-leaving={
                        (finishing !== null && grade >= finishing) || undefined
                      }
                    >
                      <span>
                        {grade === 0 ? "K" : `Grade ${gradeLabel(grade)}`}
                      </span>
                      <strong>{number(students)}</strong>
                    </li>
                  ))}
                </ol>
                <div className={styles.gradePick}>
                  <span className={styles.groupLabel}>Finishes here</span>
                  <Select
                    aria-label={`Grade that finishes at ${school.name}`}
                    value={finishing === null ? "" : String(finishing)}
                    onValueChange={(value) =>
                      onChange({
                        graduating: {
                          ...draft.graduating,
                          [school.id]: value === "" ? null : Number(value),
                        },
                      })
                    }
                  >
                    <option value="">Nobody this year</option>
                    {school.grades.map(({ grade }) => (
                      <option key={grade} value={String(grade)}>
                        Grade {gradeLabel(grade)}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <p className={styles.gradeOutcome}>
                {number(staying)} {staying === 1 ? "moves" : "move"} up,{" "}
                {number(leaving)} {leaving === 1 ? "finishes" : "finish"}.
              </p>
            </li>
          );
        })}
        {options.schools.length === 0 && <li>No students to move up yet.</li>}
      </ul>
    </div>
  );
}

const GRADUATES_FIRST = 12;
function Summary({ result, done }: { result: RolloverResult; done: boolean }) {
  const [all, setAll] = useState(false);
  const shown = all
    ? result.graduates
    : result.graduates.slice(0, GRADUATES_FIRST);
  return (
    <dl className={styles.summary}>
      <div>
        <dt>{result.year.name}</dt>
        <dd>
          {formatDay(result.year.startsOn)} to {formatDay(result.year.endsOn)}
          {result.terms.length ? `, ${result.terms.length} terms` : ""}
        </dd>
      </div>
      <div>
        <dt>
          {number(result.classes)} {result.classes === 1 ? "class" : "classes"}{" "}
          carry over
        </dt>
        <dd>
          Each with a new join code, keeping {number(result.teachers)}{" "}
          {result.teachers === 1 ? "teacher" : "teachers"}.
          {result.moved
            ? ` ${number(result.moved)} ${result.moved === 1 ? "student moves" : "students move"} along on the first day.`
            : " They start empty, ready for next year’s roster."}
        </dd>
      </div>
      <div>
        <dt>
          {number(result.advanced)}{" "}
          {result.advanced === 1 ? "student moves" : "students move"} up a grade
        </dt>
        <dd>
          {result.advancing
            .map(
              (row) =>
                `${number(row.students)} from ${gradeLabel(row.from)} to ${gradeLabel(row.to)}`,
            )
            .join(", ") || "No students have a grade on file."}
        </dd>
      </div>
      <div>
        <dt>
          {number(result.graduated)}{" "}
          {result.graduated === 1 ? "student finishes" : "students finish"}
        </dt>
        <dd>
          {result.graduated === 0 ? (
            "Nobody leaves this year."
          ) : (
            <>
              <span>
                Access ends and seats are freed.{" "}
                {shown.map((row) => row.name).join(", ")}
                {shown.length < result.graduated && !all
                  ? ` and ${number(result.graduated - shown.length)} more.`
                  : "."}
              </span>
              {result.graduates.length > GRADUATES_FIRST && !all && (
                <Button
                  variant="quiet"
                  align="start"
                  onClick={() => setAll(true)}
                >
                  Show everyone
                </Button>
              )}
            </>
          )}
        </dd>
      </div>
      {!done && result.yearRunning && (
        <div>
          <dt>This year isn’t over yet</dt>
          <dd>
            Grades move up and graduating students lose access as soon as you
            confirm. It’s usually best to do this after the last day of school.
          </dd>
        </div>
      )}
      {!done && result.openClasses > 0 && (
        <div>
          <dt>
            {number(result.openClasses)}{" "}
            {result.openClasses === 1 ? "class hasn’t" : "classes haven’t"}{" "}
            closed a term
          </dt>
          <dd>
            Their grades stay open and can still be closed from last year’s
            gradebook. Closing first freezes them against this year’s levels.
          </dd>
        </div>
      )}
    </dl>
  );
}

function ReviewStep({
  orgId,
  input,
  onError,
}: {
  orgId: string;
  input: RolloverInput;
  onError: (message: string) => void;
}) {
  const session = currentSession();
  const plan = useQuery(rolloverPlanOptions(session, orgId, input));
  useEffect(() => {
    if (plan.error)
      onError(
        plan.error instanceof AppError
          ? plan.error.message
          : "The summary didn’t load. Try again.",
      );
  }, [plan.error, onError]);
  return (
    <div className={styles.stepBody}>
      <h2>Check this before anything changes</h2>
      <p className={styles.stepLead}>
        This is what confirming will do. Nothing has changed yet.
      </p>
      {plan.isPending ? (
        <Loading>Working out what will change</Loading>
      ) : plan.data ? (
        <Summary result={plan.data} done={false} />
      ) : (
        <Button variant="secondary" onClick={() => void plan.refetch()}>
          Try again
        </Button>
      )}
    </div>
  );
}

/** A new school year, as a short wizard with a real URL for each step. It ends in
 * a dry run of exactly what will happen, and one transaction when confirmed. */
export function RolloverScreen() {
  const { org: orgId } = useParams({ strict: false }) as { org: string };
  const search = useSearch({ strict: false }) as { step?: unknown };
  const navigate = useNavigate();
  const session = currentSession();
  const options = useQuery(rolloverOptions(session, orgId));
  const [draft, setDraft] = useState<Draft | null>(() => readDraft(orgId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<RolloverResult | null>(null);
  useLoggedError(error);
  const data = options.data;
  const step: StepId = isStep(search.step) ? search.step : "dates";
  const current = useMemo(
    () => draft ?? (data ? startingDraft(data) : null),
    [draft, data],
  );
  const go = (next: StepId) => {
    setError("");
    void navigate({
      to: ".",
      search: ((previous: Record<string, unknown>) => ({
        ...previous,
        step: next === "dates" ? undefined : next,
      })) as never,
    });
  };
  const change = (patch: Partial<Draft>) => {
    const next = { ...current!, ...patch };
    setDraft(next);
    saveDraft(orgId, next);
  };
  const index = STEPS.findIndex((entry) => entry.id === step);
  const confirm = async () => {
    if (!data || !current) return;
    setBusy(true);
    setError("");
    try {
      const applied = await applyRollover(
        session,
        orgId,
        toInput(current, data),
      );
      saveDraft(orgId, null);
      await refreshSchool(session);
      setResult(applied);
    } catch (failure) {
      setError(
        failure instanceof AppError
          ? failure.message
          : "The new year didn’t start, and nothing changed. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  const named = current ? yearName(current.startsOn, current.endsOn) : "";
  return (
    <OrgFrame
      orgId={orgId}
      nav="calendar"
      title="New school year"
      crumbs={[
        { label: "Calendar", path: orgPath(orgId, "calendar") },
        { label: "New school year" },
      ]}
    >
      <PageHead
        title={
          result ? `${result.year.name} is ready` : "Start the new school year"
        }
        detail={
          result
            ? result.alreadyDone
              ? "This year was already set up, so nothing changed."
              : "History stays: last year’s classes and grades are a click away."
            : data?.current
              ? `Carrying over from ${data.current.name}`
              : " "
        }
      />
      {options.isPending ? (
        <LoadingScreen overlay />
      ) : !data || !current ? (
        <EmptyState
          title="This didn’t load"
          action={
            <Button variant="primary" onClick={() => void options.refetch()}>
              Try again
            </Button>
          }
        >
          Check your connection, then try again.
        </EmptyState>
      ) : result ? (
        <div className={styles.wizard}>
          <Summary result={result} done />
          <div className={styles.stepActions}>
            <Link
              to="/$"
              params={{ _splat: orgPath(orgId, "classes") }}
              search={{ year: result.year.id } as never}
              className={buttonClass("primary")}
            >
              See {result.year.name} classes
            </Link>
            <Link
              to="/$"
              params={{ _splat: orgPath(orgId, "calendar") }}
              className={buttonClass("secondary")}
            >
              Open the calendar
            </Link>
          </div>
        </div>
      ) : (
        <div className={styles.wizard}>
          <ol className={styles.steps}>
            {STEPS.map((entry, place) => (
              <li
                key={entry.id}
                aria-current={entry.id === step ? "step" : undefined}
                data-done={place < index || undefined}
              >
                <button
                  type="button"
                  disabled={place > index}
                  onClick={() => go(entry.id)}
                >
                  <span aria-hidden="true">{place + 1}</span>
                  {entry.label}
                </button>
              </li>
            ))}
          </ol>
          {step === "dates" && <DatesStep draft={current} onChange={change} />}
          {step === "classes" && (
            <ClassesStep draft={current} options={data} onChange={change} />
          )}
          {step === "grades" && (
            <GradesStep draft={current} options={data} onChange={change} />
          )}
          {step === "review" && (
            <ReviewStep
              orgId={orgId}
              input={toInput(current, data)}
              onError={setError}
            />
          )}
          <FormNote error={error} />
          <div className={styles.stepActions}>
            {index > 0 && (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => go(STEPS[index - 1]!.id)}
              >
                Back
              </Button>
            )}
            {step === "review" ? (
              <Button
                variant="primary"
                aria-busy={busy}
                disabled={busy}
                onClick={() => void confirm()}
              >
                Start {named}
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={() => go(STEPS[index + 1]!.id)}
              >
                Continue
              </Button>
            )}
          </div>
        </div>
      )}
    </OrgFrame>
  );
}
