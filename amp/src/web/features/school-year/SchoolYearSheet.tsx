import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { formatDay, yearName } from "../../../schools/calendar";
import { reportError } from "../../lib/report-error";
import { useSession } from "../../lib/session";
import { Button } from "../../ui/Button";
import { DatePicker } from "../../ui/DatePicker";
import { Disclosure } from "../../ui/Disclosure";
import { Loading } from "../../ui/Loading";
import { Segmented } from "../../ui/Segmented";
import { Sheet } from "../../ui/Sheet";
import { YearRibbon } from "../school/YearRibbon";
import { saveSchoolYear, useSchoolYear, type YearPlace } from "./api";
import {
  choiceWords,
  draftPeriods,
  draftProblems,
  editPeriod,
  gradingChoices,
  isDivision,
  moveYear,
  planSave,
  startDraft,
  type Draft,
  type Period,
  type Saved,
} from "./model";
import styles from "./SchoolYear.module.css";

/**
 * Editing one school year: its first and last day, its grading periods
 * (None · Semesters · Trimesters · Quarters) and each period's days, with
 * the bar redrawn as they change. One Save saves it all (model.ts
 * `planSave`), then everything that shows the year refreshes. One sheet:
 * nothing opens over it, and it has no Back of its own.
 */
export function SchoolYearSheet({
  place,
  grading,
  open,
  onOpenChange,
}: {
  place: YearPlace;
  grading: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const year = useSchoolYear(place);
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="School year"
      tall={!year.saved}
    >
      {year.saved ? (
        // The sheet's body mounts as it opens: a fresh draft each time, from
        // what is saved then. After a failed save it keeps the draft, and the
        // next Save sends only what still differs.
        <YearForm
          place={place}
          saved={year.saved}
          grading={grading}
          canChooseKind={year.canChooseKind}
          today={year.today}
          onDone={() => onOpenChange(false)}
        />
      ) : (
        <Loading>Loading the school year…</Loading>
      )}
    </Sheet>
  );
}

function YearForm({
  place,
  saved,
  grading,
  canChooseKind,
  today,
  onDone,
}: {
  place: YearPlace;
  saved: Saved;
  grading: boolean;
  canChooseKind: boolean;
  today: string;
  onDone: () => void;
}) {
  const session = useSession();
  const [draft, setDraft] = useState<Draft>(() => startDraft(saved));
  const [opened, setOpened] = useState<number | null>(null);
  const [error, setError] = useState("");
  const save = useMutation({
    mutationFn: () =>
      saveSchoolYear(session, place, planSave(saved, draft, grading)),
    onSuccess: onDone,
    onError: (failure) =>
      setError(
        reportError(failure, {
          doing: "save the school year",
          fallback:
            "The school year didn’t save. Check the dates and try again.",
          details: { org: place.org, class: place.classId },
        }),
      ),
  });
  const division = grading && isDivision(draft.choice) ? draft.choice : null;
  const periods: Period[] = division
    ? draftPeriods(draft, saved, division)
    : [];
  const problems = draftProblems(draft, saved, grading);
  const invalid = !!problems.year || problems.periods.some(Boolean);
  const edit = (next: Draft) => {
    setDraft(next);
    setError("");
  };
  return (
    <div className={styles.formBody} data-school-year-form="">
      <p className={styles.fact} aria-live="polite">
        {yearName(draft.startsOn, draft.endsOn)}
      </p>
      <div className={styles.days}>
        <DatePicker
          label="First day"
          value={draft.startsOn}
          max={draft.endsOn}
          error={problems.year?.startsOn}
          onChange={(startsOn) =>
            edit(moveYear(draft, { startsOn, endsOn: draft.endsOn }))
          }
        />
        <DatePicker
          label="Last day"
          value={draft.endsOn}
          min={draft.startsOn}
          error={problems.year?.endsOn}
          onChange={(endsOn) =>
            edit(moveYear(draft, { startsOn: draft.startsOn, endsOn }))
          }
        />
      </div>
      {grading && (
        <div className={styles.field}>
          <span className={styles.fieldLabel} id="school-year-periods">
            Grading periods
          </span>
          {canChooseKind ? (
            <Segmented
              label="Grading periods"
              compact
              value={draft.choice}
              onChange={(choice) => {
                setOpened(null);
                edit({ ...draft, choice });
              }}
              options={gradingChoices.map((choice) => ({
                value: choice,
                label: choiceWords(choice),
              }))}
            />
          ) : (
            <p className={styles.fact}>{choiceWords(draft.choice)}</p>
          )}
        </div>
      )}
      <YearRibbon
        startsOn={draft.startsOn}
        endsOn={draft.endsOn}
        division={division}
        sessions={periods.length ? periods : undefined}
        list={false}
        labels
        today={today}
      />
      {grading && (
        <div
          className={styles.periods}
          role="group"
          aria-labelledby="school-year-periods"
          data-periods=""
        >
          {division ? (
            periods.map((period, index) => (
              <PeriodRow
                key={`${division}:${index}`}
                period={period}
                problem={problems.periods[index] ?? null}
                year={draft}
                open={opened === index}
                onOpenChange={(open) => setOpened(open ? index : null)}
                onChange={(change) =>
                  edit(editPeriod(draft, saved, division, index, change))
                }
              />
            ))
          ) : (
            <p className={styles.whole}>One report card for the whole year.</p>
          )}
        </div>
      )}
      <p className={styles.error} role="alert">
        {error}
      </p>
      <Button
        variant="primary"
        className={styles.save}
        aria-busy={save.isPending || undefined}
        disabled={save.isPending || invalid}
        onClick={() => {
          setError("");
          save.mutate();
        }}
      >
        Save
      </Button>
    </div>
  );
}

/** One period: its name and days, folding open to two pickers. A period a
 * district sets is shown, not changed. */
function PeriodRow({
  period,
  problem,
  year,
  open,
  onOpenChange,
  onChange,
}: {
  period: Period;
  problem: { startsOn?: string; endsOn?: string } | null;
  year: { startsOn: string; endsOn: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (change: { startsOn?: string; endsOn?: string }) => void;
}) {
  const summary = (
    <span className={styles.periodSummary}>
      <span className={styles.periodName}>{period.name}</span>
      <span className={styles.periodDates}>
        {formatDay(period.startsOn, false)} to {formatDay(period.endsOn, false)}
      </span>
    </span>
  );
  if (period.inherited)
    return (
      <div className={`${styles.period} ${styles.periodRow}`}>{summary}</div>
    );
  return (
    <Disclosure
      className={styles.period}
      summary={summary}
      open={open || !!problem}
      onOpenChange={onOpenChange}
    >
      <div className={styles.periodDays}>
        <DatePicker
          label={`${period.name} starts`}
          value={period.startsOn}
          min={year.startsOn}
          max={period.endsOn}
          error={problem?.startsOn}
          onChange={(startsOn) => onChange({ startsOn })}
        />
        <DatePicker
          label={`${period.name} ends`}
          value={period.endsOn}
          min={period.startsOn}
          max={year.endsOn}
          error={problem?.endsOn}
          onChange={(endsOn) => onChange({ endsOn })}
        />
      </div>
    </Disclosure>
  );
}
