import { useQuery } from "@tanstack/react-query";
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import { useState } from "react";
import {
  divisionKinds,
  divisionLabels,
  formatDay,
  type DivisionKind,
} from "../../../schools/calendar";
import type { SessionResource } from "../../../schools/setup-contracts";
import type { GradingKind } from "../../../schools/contracts";
import { AppError } from "../../lib/AppError";
import { useLoggedError } from "../../feedback";
import { Button, buttonClass } from "../../ui/Button";
import { DatePicker } from "../../ui/DatePicker";
import { EmptyState } from "../../ui/EmptyState";
import { Segmented } from "../../ui/Segmented";
import { Sheet } from "../../ui/Sheet";
import {
  calendarOptions,
  classesOptions,
  currentSession,
  orgOptions,
  refreshSchool,
  school,
} from "./api";
import { FormNote, PageHead } from "./parts";
import { orgPath } from "./paths";
import { YearRibbon } from "./YearRibbon";
import styles from "./School.module.css";

/** The term choice of a small class: None is the whole year, no terms. */
const TERM_CHOICES: GradingKind[] = ["year", "semester", "trimester", "quarter"];

const message = (failure: unknown, fallback: string) =>
  failure instanceof AppError ? failure.message : fallback;

function EditSheet({
  orgId,
  session: entry,
  onClose,
}: {
  orgId: string;
  session: SessionResource;
  onClose: () => void;
}) {
  const session = currentSession();
  const [startsOn, setStartsOn] = useState(entry.startsOn);
  const [endsOn, setEndsOn] = useState(entry.endsOn);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useLoggedError(error);
  const backwards = endsOn < startsOn;
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={entry.name}
      description={entry.kind === "year" ? "The whole school year" : undefined}
    >
      <div className={styles.sheetForm}>
        <DatePicker label="First day" value={startsOn} onChange={setStartsOn} />
        <DatePicker
          label="Last day"
          value={endsOn}
          onChange={setEndsOn}
          error={backwards ? "The last day has to be after the first." : ""}
        />
        <FormNote error={error} />
        <Button
          variant="primary"
          className={styles.sheetAction}
          aria-busy={busy}
          disabled={busy || backwards}
          onClick={() => {
            setBusy(true);
            setError("");
            void school
              .updateSession(session, orgId, entry.id, { startsOn, endsOn })
              .then(() => refreshSchool(session))
              .then(onClose)
              .catch((failure) => {
                setError(
                  message(failure, "Those dates didn’t save. Try again."),
                );
                setBusy(false);
              });
          }}
        >
          Save dates
        </Button>
      </div>
    </Sheet>
  );
}

/** The school year and its terms: the dates, the kind of term, the year as a
 * bar, and each term's dates. The school's Calendar screen shows it whole;
 * a family's or a lone class's Settings shows it as one compact section
 * (docs/design/ia.md), so a small place never opens a school-level page. */
export function YearCalendar({
  orgId,
  compact = false,
  section = false,
  grading,
}: {
  orgId: string;
  compact?: boolean;
  /** In a small class's Settings, the class's own term choice drives the
   * picker: None (the whole year) · Semesters · Trimesters · Quarters. */
  grading?: {
    value: GradingKind;
    onChange: (kind: GradingKind) => void;
    disabled?: boolean;
  };
  /** A section of the school's Settings: the year and every set of terms its
   * classes grade by, with nothing to choose (a class chooses its own). */
  section?: boolean;
}) {
  const search = useSearch({ strict: false }) as {
    view?: unknown;
    edit?: unknown;
  };
  const navigate = useNavigate();
  const session = currentSession();
  const org = useQuery(orgOptions(session, orgId)).data;
  const calendar = useQuery(calendarOptions(session, orgId));
  const sessions = calendar.data ?? [];
  const year = sessions.find((entry) => entry.kind === "year");
  const kinds = divisionKinds.filter((kind) =>
    sessions.some(
      (entry) => entry.kind === kind && entry.parentId === year?.id,
    ),
  );
  const asked = divisionKinds.find((kind) => kind === search.view);
  const shown: DivisionKind | null = grading
    ? grading.value === "year"
      ? null
      : (grading.value as DivisionKind)
    : (asked ?? kinds[0] ?? null);
  const parts = sessions.filter(
    (entry) => entry.kind === shown && entry.parentId === year?.id,
  );
  const canEdit = org?.can?.includes("calendar.write") === true;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useLoggedError(error);
  const setSearch = (patch: Record<string, unknown>) =>
    void navigate({
      to: ".",
      search: ((previous: Record<string, unknown>) => ({
        ...previous,
        ...patch,
      })) as never,
      resetScroll: false,
    });
  const editing = sessions.find((entry) => entry.id === search.edit);
  const pick = (kind: DivisionKind) => {
    setSearch({ view: kind });
    if (kinds.includes(kind) || !canEdit) return;
    setBusy(true);
    setError("");
    void school
      .addDivision(session, orgId, kind)
      .then(() => refreshSchool(session))
      .catch((failure) =>
        setError(message(failure, "Those terms didn’t save. Try again.")),
      )
      .finally(() => setBusy(false));
  };
  const changeDates =
    canEdit && year ? (
      <Button
        variant={compact ? "quiet" : "secondary"}
        onClick={() => setSearch({ edit: year.id })}
      >
        Change year dates
      </Button>
    ) : null;
  const body = calendar.isError ? (
    <EmptyState
      title="The calendar didn’t load"
      action={
        <Button variant="secondary" onClick={() => void calendar.refetch()}>
          Try again
        </Button>
      }
    />
  ) : !year ? (
    calendar.isPending ? null : (
      <EmptyState title="No school year yet">
        A default year appears when the first class is added.
      </EmptyState>
    )
  ) : (
    <div className={styles.calendarBody} data-compact={compact || undefined}>
      <div className={styles.calendarControl}>
        {grading ? (
          <Segmented
            label="Terms"
            compact
            dense
            disabled={grading.disabled}
            value={grading.value}
            onChange={grading.onChange}
            options={TERM_CHOICES.map((kind) => ({
              value: kind,
              label: kind === "year" ? "None" : divisionLabels[kind].plural,
            }))}
          />
        ) : (
          <Segmented
            label="Terms"
            compact
            dense={compact}
            disabled={busy || (compact && !canEdit)}
            value={shown}
            onChange={pick}
            options={divisionKinds.map((kind) => ({
              value: kind,
              label: divisionLabels[kind].plural,
            }))}
          />
        )}
        {!compact && (
          <p className={styles.fieldHelp}>
            Each class chooses which of these it grades by.
          </p>
        )}
      </div>
      <YearRibbon
        startsOn={year.startsOn}
        endsOn={year.endsOn}
        division={shown}
        sessions={parts.length ? parts : undefined}
        list={!parts.length && !!shown}
      />
      {parts.length > 0 && !!shown && (
        <ul className={styles.sessionList}>
          {parts.map((part) => (
            <li key={part.id}>
              <span>
                <strong>{part.name}</strong>
                <span className={styles.quiet}>
                  {formatDay(part.startsOn, false)} to{" "}
                  {formatDay(part.endsOn, false)}
                </span>
              </span>
              {canEdit && !part.inherited && (
                <Button
                  variant="quiet"
                  onClick={() => setSearch({ edit: part.id })}
                >
                  Edit
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <FormNote error={error} />
    </div>
  );
  if (section)
    return (
      <section className={styles.settingsSection} aria-labelledby="school-year">
        <div className={styles.settingsHead}>
          <div>
            <h2 id="school-year">School year and terms</h2>
            <p className={styles.quiet}>
              {year
                ? `${formatDay(year.startsOn)} to ${formatDay(year.endsOn)}`
                : "\u00a0"}
            </p>
          </div>
          {canEdit && year && (
            <div className={styles.settingsActions}>
              {org?.can?.includes("year.rollover") && (
                <Link
                  to="/$"
                  params={{ _splat: orgPath(orgId, "year") }}
                  className={buttonClass("quiet")}
                >
                  Start next year
                </Link>
              )}
              {changeDates}
            </div>
          )}
        </div>
        {calendar.isError || !year ? (
          body
        ) : (
          <div className={styles.calendarBody}>
            {kinds.length === 0 ? (
              <>
                <YearRibbon
                  startsOn={year.startsOn}
                  endsOn={year.endsOn}
                  division={null}
                  list={false}
                />
                <p className={styles.quiet}>
                  No terms: classes grade the whole year. A class that grades
                  by semesters, trimesters or quarters adds them here.
                </p>
              </>
            ) : (
              kinds.map((kind) => {
                const terms = sessions.filter(
                  (entry) => entry.kind === kind && entry.parentId === year.id,
                );
                return (
                  <div key={kind} className={styles.termSet}>
                    <h3>{divisionLabels[kind].plural}</h3>
                    <YearRibbon
                      startsOn={year.startsOn}
                      endsOn={year.endsOn}
                      division={kind}
                      sessions={terms}
                      list={false}
                    />
                    <ul className={styles.sessionList}>
                      {terms.map((part) => (
                        <li key={part.id}>
                          <span>
                            <strong>{part.name}</strong>
                            <span className={styles.quiet}>
                              {formatDay(part.startsOn, false)} to{" "}
                              {formatDay(part.endsOn, false)}
                            </span>
                          </span>
                          {canEdit && !part.inherited && (
                            <Button
                              variant="quiet"
                              onClick={() => setSearch({ edit: part.id })}
                            >
                              Edit
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })
            )}
            <p className={styles.fieldHelp}>
              Each class picks its own grading periods in its Settings.
            </p>
          </div>
        )}
        {editing && (
          <EditSheet
            key={editing.id}
            orgId={orgId}
            session={editing}
            onClose={() => setSearch({ edit: undefined })}
          />
        )}
      </section>
    );
  const sheet = editing && (
    <EditSheet
      key={editing.id}
      orgId={orgId}
      session={editing}
      onClose={() => setSearch({ edit: undefined })}
    />
  );
  if (compact)
    return (
      <section className={styles.yearSection} aria-labelledby="school-year">
        <div className={styles.yearHead}>
          <div>
            <h2 id="school-year">School year</h2>
            <p className={styles.quiet}>
              {year
                ? `${formatDay(year.startsOn)} to ${formatDay(year.endsOn)}`
                : "\u00a0"}
            </p>
          </div>
          {changeDates}
        </div>
        {body}
        {sheet}
      </section>
    );
  return (
    <>
      <PageHead
        title="Calendar"
        detail={
          year
            ? `${formatDay(year.startsOn)} to ${formatDay(year.endsOn)}`
            : " "
        }
        action={
          canEdit && year ? (
            <>
              {org?.can?.includes("year.rollover") && (
                <Link
                  to="/$"
                  params={{ _splat: orgPath(orgId, "year") }}
                  className={buttonClass("secondary")}
                >
                  Start next year
                </Link>
              )}
              {changeDates}
            </>
          ) : undefined
        }
      />
      {body}
      {sheet}
    </>
  );
}

/** The old Calendar address: the year now lives in Settings, the school's or,
 * for a family or a lone class, the class's (docs/design/ia.md). */
export function CalendarScreen() {
  const { org: orgId } = useParams({ strict: false }) as { org: string };
  const session = currentSession();
  const org = useQuery(orgOptions(session, orgId)).data;
  const classes = useQuery({
    ...classesOptions(session, orgId),
    enabled: org?.kind === "family" || org?.solo === true,
  }).data;
  if (!org) return null;
  const small = org.kind === "family" || org.solo === true;
  if (small && !classes) return null;
  return (
    <Navigate
      to={"/$" as never}
      params={
        {
          _splat:
            small && classes?.[0]
              ? `school/${orgId}/classes/${classes[0].id}/settings`
              : `school/${orgId}/settings`,
        } as never
      }
      hash={small ? undefined : "school-year"}
      replace
    />
  );
}
