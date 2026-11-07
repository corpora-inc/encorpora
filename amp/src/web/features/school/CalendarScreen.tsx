import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import {
  divisionKinds,
  divisionLabels,
  formatDay,
  type DivisionKind,
} from "../../../schools/calendar";
import type { SessionResource } from "../../../schools/setup-contracts";
import { AppError } from "../../lib/AppError";
import { useLoggedError } from "../../feedback";
import { Button } from "../../ui/Button";
import { DatePicker } from "../../ui/DatePicker";
import { EmptyState } from "../../ui/EmptyState";
import { Segmented } from "../../ui/Segmented";
import { Sheet } from "../../ui/Sheet";
import {
  calendarOptions,
  currentSession,
  orgOptions,
  refreshSchool,
  school,
} from "./api";
import { OrgFrame } from "./OrgFrame";
import { FormNote, PageHead } from "./parts";
import { YearRibbon } from "./YearRibbon";
import styles from "./School.module.css";

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

/** Terms, as the bar and as a list: a class picks which of them it grades by. */
export function CalendarScreen() {
  const { org: orgId } = useParams({ strict: false }) as { org: string };
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
  const shown: DivisionKind | null = asked ?? kinds[0] ?? null;
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
  return (
    <OrgFrame orgId={orgId} nav="calendar" title="Calendar">
      <PageHead
        title="Calendar"
        detail={
          year
            ? `${formatDay(year.startsOn)} to ${formatDay(year.endsOn)}`
            : " "
        }
        action={
          canEdit && year ? (
            <Button
              variant="secondary"
              onClick={() => setSearch({ edit: year.id })}
            >
              Change year dates
            </Button>
          ) : undefined
        }
      />
      {calendar.isError ? (
        <EmptyState
          title="The calendar didn’t load"
          action={
            <Button variant="secondary" onClick={() => void calendar.refetch()}>
              Try again
            </Button>
          }
        />
      ) : !year ? (
        <EmptyState title="No school year yet">
          A default year appears when the first class is added.
        </EmptyState>
      ) : (
        <div className={styles.calendarBody}>
          <div className={styles.calendarControl}>
            <Segmented
              label="Terms"
              compact
              disabled={busy}
              value={shown}
              onChange={pick}
              options={divisionKinds.map((kind) => ({
                value: kind,
                label: divisionLabels[kind].plural,
              }))}
            />
            <p className={styles.fieldHelp}>
              Each class chooses which of these it grades by.
            </p>
          </div>
          <YearRibbon
            startsOn={year.startsOn}
            endsOn={year.endsOn}
            division={shown}
            sessions={parts.length ? parts : undefined}
            list={!parts.length}
          />
          {parts.length > 0 && (
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
      )}
      {editing && (
        <EditSheet
          key={editing.id}
          orgId={orgId}
          session={editing}
          onClose={() => setSearch({ edit: undefined })}
        />
      )}
    </OrgFrame>
  );
}
