import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  lmsNames,
  type LmsAssignmentInput,
  type LmsAssignmentResource,
  type LmsResponse,
  type LmsSummary,
} from "../../../../schools/lms-contracts";
import { useSession } from "../../../lib/session";
import { Badge, type BadgeTone } from "../../../ui/Badge";
import { Button } from "../../../ui/Button";
import { DatePicker } from "../../../ui/DatePicker";
import { Form } from "../../../ui/Form";
import { Loading } from "../../../ui/Loading";
import { Segmented } from "../../../ui/Segmented";
import { SelectField } from "../../../ui/SelectField";
import { Sheet } from "../../../ui/Sheet";
import { TextField } from "../../../ui/TextField";
import { FormNote } from "../parts";
import {
  failureMessage,
  lmsOptions,
  useLmsChange,
  type Place,
} from "./teacher-api";
import styles from "./LmsSheet.module.css";

/** The LMS's own name, or "LMS" before Clever has said which it is. */
export const lmsLabel = (lms: LmsSummary) =>
  lms.type ? lmsNames[lms.type] : "LMS";

/** Why the district can't take writes now: Clever's own state, or its
 * refusal. Null when it can. Exported for its tests. */
export function districtProblem(lms: LmsSummary): string | null {
  if (
    lms.failureCode === "lms_unauthorized" ||
    lms.failureCode === "lms_forbidden"
  )
    return "Clever refused access to this district’s LMS. AMP keeps retrying.";
  if (lms.state === "disconnected")
    return "The district disconnected its LMS from Clever.";
  if (lms.state === "error")
    return "Clever reports a problem with this district’s LMS.";
  if (lms.state !== "success")
    return "Clever is still matching this district’s LMS.";
  if (!lms.type) return "Clever hasn’t said which LMS this district uses.";
  if (lms.failureCode) return "Clever couldn’t be reached. AMP keeps retrying.";
  return null;
}

const ISSUES: Record<string, (name: string) => string> = {
  lms_not_ready: () => "Clever is still matching this district’s LMS.",
  lms_type_unknown: () => "Clever hasn’t said which LMS this district uses.",
  lms_unauthorized: () => "Clever refused access.",
  lms_forbidden: () => "Clever refused access.",
  lms_section_not_synced: (name) => `This class isn’t matched in ${name} yet.`,
  lms_section_unshared: () => "The district no longer shares this class.",
  lms_term_required: (name) => `${name} needs a term for this class.`,
  lms_due_date_past: () => "The due date has passed. Choose a later one.",
  lms_assignment_unpublished: (name) => `Publish it in ${name} to send grades.`,
  lms_assignment_not_open: (name) => `Open it in ${name} to send grades.`,
  lms_create_outcome_unknown: (name) =>
    `Clever didn’t confirm it. Check ${name}, then publish again or delete.`,
  lms_no_valid_users: (name) => `${name} has no students in this class yet.`,
};
const issue = (code: string, name: string) =>
  ISSUES[code]?.(name) ?? "Sending failed. AMP retries automatically.";
const STUDENT_ISSUES: Record<string, (n: number, name: string) => string> = {
  lms_submission_update_failed: (n, name) =>
    `${n} must open AMP from ${name} once`,
  lms_user_not_in_lms: (n, name) => `${n} not in ${name}`,
  lms_user_not_found: (n, name) => `${n} not in ${name}`,
  lms_reclaim_unsupported: (n, name) => `${n} to change in ${name}`,
};

function status(
  row: LmsAssignmentResource,
  name: string,
): { label: string; tone: BadgeTone } {
  if (row.status === "missing")
    return { label: `Deleted in ${name}`, tone: "neutral" };
  if (row.status === "deleting") return { label: "Deleting", tone: "neutral" };
  if (row.status === "unknown")
    return { label: "Unconfirmed", tone: "warning" };
  if (row.failureCode) return { label: "Needs attention", tone: "warning" };
  if (row.status === "pending" || row.status === "creating")
    return { label: "Publishing", tone: "info" };
  return row.finalized
    ? { label: "Grades returned", tone: "success" }
    : { label: `In ${name}`, tone: "success" };
}

const shortDay = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
const addDays = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);

/** One LMS column: what it is, where it stands, and its actions. */
function AssignmentRow({
  row,
  name,
  canEdit,
  busy,
  onEdit,
  onChange,
}: {
  row: LmsAssignmentResource;
  name: string;
  canEdit: boolean;
  busy: boolean;
  onEdit: () => void;
  onChange: (kind: "delete" | "sync" | "republish") => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const badge = status(row, name);
  const live = row.status === "pending" || row.status === "published";
  const detail =
    row.kind === "practice"
      ? `${row.targetMinutes} min, ${shortDay(row.opensOn!)} to ${shortDay(row.dueOn)}`
      : `${row.termName ?? "Term"} final grades, due ${shortDay(row.dueOn)}`;
  const blockers = Object.entries(row.blockedBy)
    .map(([code, n]) => STUDENT_ISSUES[code]?.(n, name) ?? `${n} not sent yet`)
    .join(" · ");
  return (
    <li className={styles.row}>
      <div className={styles.rowHead}>
        <span className={styles.title}>{row.title}</span>
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </div>
      <span className={styles.detail}>
        {detail} · {row.pointsPossible} points
        {row.status === "published" ? ` · ${row.graded} graded` : ""}
      </span>
      <span className={styles.issue} data-empty={!row.failureCode && !blockers}>
        {row.failureCode ? issue(row.failureCode, name) : blockers}
      </span>
      {canEdit && row.status !== "deleting" && (
        <div className={styles.actions}>
          {confirming ? (
            <>
              <Button
                variant="secondary"
                disabled={busy}
                aria-busy={busy || undefined}
                onClick={() => onChange("delete")}
              >
                {row.status === "published" ? `Delete from ${name}` : "Delete"}
              </Button>
              <Button variant="quiet" onClick={() => setConfirming(false)}>
                Keep
              </Button>
            </>
          ) : (
            <>
              {live && (
                <Button
                  variant="quiet"
                  disabled={busy || row.syncRequested}
                  onClick={() => onChange("sync")}
                >
                  {row.syncRequested ? "Sending" : "Send now"}
                </Button>
              )}
              {row.status === "unknown" && (
                <Button
                  variant="quiet"
                  disabled={busy}
                  onClick={() => onChange("republish")}
                >
                  Publish again
                </Button>
              )}
              {live && (
                <Button variant="quiet" disabled={busy} onClick={onEdit}>
                  Edit
                </Button>
              )}
              <Button
                variant="quiet"
                disabled={busy}
                onClick={() => setConfirming(true)}
              >
                Delete
              </Button>
            </>
          )}
        </div>
      )}
    </li>
  );
}

type Draft = {
  kind: LmsAssignmentInput["kind"];
  title: string;
  points: string;
  minutes: string;
  opensOn: string;
  dueOn: string;
  termId: string;
};
function draftFor(
  data: LmsResponse,
  weeklyTargetMinutes: number | null,
  row: LmsAssignmentResource | null,
): Draft {
  if (row)
    return {
      kind: row.kind,
      title: row.title,
      points: String(row.pointsPossible),
      minutes: String(row.targetMinutes ?? ""),
      opensOn: row.opensOn ?? data.today,
      dueOn: row.dueOn,
      termId: row.termId ?? "",
    };
  const term =
    data.terms.find(
      (entry) => entry.startsOn <= data.today && entry.endsOn >= data.today,
    ) ??
    data.terms.find((entry) => entry.state !== "closed") ??
    null;
  return {
    kind: "practice",
    title: "",
    points: "100",
    minutes: String(weeklyTargetMinutes ?? 60),
    opensOn: data.today,
    dueOn: addDays(data.today, 6),
    termId: term?.id ?? "",
  };
}

/** A new assignment, or an edit of one. Its kind and term are fixed once made. */
function AssignmentForm({
  data,
  row,
  weeklyTargetMinutes,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  data: LmsResponse;
  row: LmsAssignmentResource | null;
  weeklyTargetMinutes: number | null;
  busy: boolean;
  error: string | null;
  onSubmit: (input: LmsAssignmentInput) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(() =>
    draftFor(data, weeklyTargetMinutes, row),
  );
  const set = (patch: Partial<Draft>) =>
    setDraft((current) => ({ ...current, ...patch }));
  const term = data.terms.find((entry) => entry.id === draft.termId) ?? null;
  const title =
    draft.title.trim() ||
    (draft.kind === "practice"
      ? `Practice ${draft.minutes || "…"} minutes`
      : `${term?.name ?? "Term"} grade`);
  const backwards = draft.kind === "practice" && draft.dueOn < draft.opensOn;
  return (
    <Form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (backwards) return;
        const common = {
          title,
          pointsPossible: Number(draft.points),
          dueOn: draft.dueOn,
        };
        onSubmit(
          draft.kind === "practice"
            ? {
                kind: "practice",
                ...common,
                targetMinutes: Number(draft.minutes),
                opensOn: draft.opensOn,
              }
            : { kind: "term_grade", ...common, termId: draft.termId },
        );
      }}
    >
      {!row && (
        <Segmented
          label="Grade from"
          value={draft.kind}
          onChange={(kind) => set({ kind })}
          options={[
            { value: "practice", label: "Practice minutes" },
            { value: "term_grade", label: "Term grade" },
          ]}
        />
      )}
      <TextField
        label="Title"
        value={draft.title}
        placeholder={title}
        maxLength={120}
        onChange={(event) => set({ title: event.target.value })}
      />
      <div className={styles.pair}>
        <TextField
          label="Points"
          inputMode="decimal"
          type="number"
          min={1}
          max={1000}
          step="any"
          required
          value={draft.points}
          onChange={(event) => set({ points: event.target.value })}
        />
        {draft.kind === "practice" && (
          <TextField
            label="Minutes"
            inputMode="numeric"
            type="number"
            min={1}
            max={6000}
            step={1}
            required
            value={draft.minutes}
            onChange={(event) => set({ minutes: event.target.value })}
          />
        )}
      </div>
      {draft.kind === "practice" ? (
        <div className={styles.pair}>
          <DatePicker
            label="First day"
            value={draft.opensOn}
            onChange={(opensOn) => set({ opensOn })}
          />
          <DatePicker
            label="Due"
            value={draft.dueOn}
            min={data.today}
            onChange={(dueOn) => set({ dueOn })}
            error={
              backwards
                ? "The due date has to be on or after the first day."
                : ""
            }
          />
        </div>
      ) : (
        // One field a row: a picker and a date field have different label
        // metrics, so side by side their boxes wouldn't line up.
        <>
          {row ? (
            <TextField label="Term" value={row.termName ?? ""} readOnly />
          ) : (
            <SelectField
              label="Term"
              value={draft.termId}
              onValueChange={(termId) => set({ termId })}
            >
              {data.terms.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </SelectField>
          )}
          <DatePicker
            label="Due"
            value={draft.dueOn}
            min={data.today}
            onChange={(dueOn) => set({ dueOn })}
          />
        </>
      )}
      <FormNote error={error} />
      <div className={styles.actions}>
        <Button
          variant="primary"
          type="submit"
          aria-busy={busy || undefined}
          disabled={busy || (draft.kind === "term_grade" && !draft.termId)}
        >
          {row ? "Save" : "Publish"}
        </Button>
        <Button variant="quiet" type="button" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Form>
  );
}

/**
 * The class's LMS through Clever LMS Connect: its assignments, where each
 * stands, and a new one. Grades come only from AMP's records: measured
 * practice minutes in the window, or the teacher's numeric final grades.
 */
export function LmsSheet({
  open,
  onOpenChange,
  place,
  lms,
  weeklyTargetMinutes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  place: Place;
  lms: LmsSummary;
  weeklyTargetMinutes: number | null;
}) {
  const session = useSession();
  const query = useQuery({
    ...lmsOptions(session, place),
    enabled: open && !!session,
  });
  const change = useLmsChange(session, place);
  const [editing, setEditing] = useState<"new" | LmsAssignmentResource | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const name = lmsLabel(query.data?.lms ?? lms);
  const problem = districtProblem(query.data?.lms ?? lms);
  const run = (
    input: Parameters<typeof change.mutate>[0],
    after?: () => void,
  ) => {
    setError(null);
    change.mutate(input, {
      onSuccess: () => after?.(),
      onError: (failure) =>
        setError(
          failureMessage(failure, `That didn’t reach ${name}. Try again.`),
        ),
    });
  };
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setEditing(null);
          setError(null);
        }
        onOpenChange(next);
      }}
      title={name}
      tall
    >
      <div className={styles.sheet}>
        <p className={styles.district} data-empty={!problem}>
          {problem ?? ""}
        </p>
        {!query.data ? (
          query.isError ? (
            <FormNote
              error={failureMessage(
                query.error,
                "The assignments didn’t load. Try again.",
              )}
            />
          ) : (
            <Loading />
          )
        ) : editing ? (
          <AssignmentForm
            data={query.data}
            row={editing === "new" ? null : editing}
            weeklyTargetMinutes={weeklyTargetMinutes}
            busy={change.isPending}
            error={error}
            onCancel={() => {
              setEditing(null);
              setError(null);
            }}
            onSubmit={(input) =>
              run(
                editing === "new"
                  ? { kind: "create", input }
                  : { kind: "update", id: editing.id, input },
                () => setEditing(null),
              )
            }
          />
        ) : (
          <>
            {/* A new assignment only while the district can take one. */}
            {query.data.canEdit && !problem && (
              <Button
                variant="primary"
                className={styles.new}
                onClick={() => {
                  setError(null);
                  setEditing("new");
                }}
              >
                New assignment
              </Button>
            )}
            <FormNote error={error} />
            {query.data.assignments.length > 0 && (
              <ul className={styles.list}>
                {query.data.assignments.map((row) => (
                  <AssignmentRow
                    key={row.id}
                    row={row}
                    name={name}
                    canEdit={query.data.canEdit}
                    busy={change.isPending}
                    onEdit={() => {
                      setError(null);
                      setEditing(row);
                    }}
                    onChange={(kind) => run({ kind, id: row.id })}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}
