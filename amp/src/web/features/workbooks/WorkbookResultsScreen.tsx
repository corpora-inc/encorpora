import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Link, Navigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import type { AuthSession } from "../../auth";
import { invalidateAccount, sessionOptions } from "../../lib/query";
import { MathText } from "../../MathText";
import { Button } from "../../ui/Button";
import { Toast } from "../../ui/Toast";
import type {
  WorkbookResultEntry,
  WorkbookResultRow,
} from "../../../workbook/contracts";
import { saveWorkbookResults, workbookResultsOptions } from "./api";
import { dateLabel, sectionNames, workbookMessage } from "./model";
import { WorkbookFrame, type WorkbookLearner } from "./WorkbookFrame";
import styles from "./Workbooks.module.css";

type Draft = { answer?: string; mark?: "right" | "not-yet" };

export function WorkbookResultsScreen() {
  const { data: session } = useSuspenseQuery(sessionOptions);
  const { learnerId, workbookId } = useParams({ strict: false }) as {
    learnerId: string;
    workbookId: string;
  };
  if (!session) return <Navigate to="/sign-in" replace />;
  return (
    <WorkbookFrame session={session} learnerId={learnerId}>
      {(learner) => (
        <Results session={session} learner={learner} workbookId={workbookId} />
      )}
    </WorkbookFrame>
  );
}

function Results({
  session,
  learner,
  workbookId,
}: {
  session: AuthSession;
  learner: WorkbookLearner;
  workbookId: string;
}) {
  const client = useQueryClient();
  const results = useQuery(
    workbookResultsOptions(session, learner.id, workbookId),
  );
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [message, setMessage] = useState("");
  const [rowError, setRowError] = useState<{ n: number; text: string } | null>(
    null,
  );
  const [saved, setSaved] = useState("");
  const entries = Object.entries(drafts).flatMap(
    ([key, draft]): WorkbookResultEntry[] => {
      const n = Number(key);
      if (draft.answer?.trim()) return [{ n, answer: draft.answer.trim() }];
      if (draft.mark) return [{ n, mark: draft.mark }];
      return [];
    },
  );
  const save = useMutation({
    mutationFn: () =>
      saveWorkbookResults(session, learner.id, workbookId, entries),
    onSuccess: (data) => {
      client.setQueryData(
        workbookResultsOptions(session, learner.id, workbookId).queryKey,
        data,
      );
      setDrafts({});
      setMessage("");
      setRowError(null);
      setSaved(
        data.recorded
          ? `${data.recorded} ${data.recorded === 1 ? "result" : "results"} saved. Progress is updated.`
          : "These results were already saved.",
      );
      // Progress, levels and practice read the same account store.
      void invalidateAccount(session.accountId);
    },
    onError: (error) => {
      const text = workbookMessage(
        error,
        "The results weren't saved. Try again.",
      );
      const n = Number(/problem (\d+)/i.exec(text)?.[1]);
      setRowError(Number.isFinite(n) && n > 0 ? { n, text } : null);
      setMessage(text);
    },
  });
  const set = (n: number, draft: Draft) => {
    setSaved("");
    setMessage("");
    if (rowError?.n === n) setRowError(null);
    setDrafts((current) => ({ ...current, [n]: draft }));
  };
  const data = results.data;
  const open = data?.rows.filter((row) => !row.recorded).length ?? 0;
  return (
    <>
      <div className={styles.head}>
        <p className={styles.eyebrow}>{learner.name} · Workbook results</p>
        <Link
          to="/learners/$learnerId/workbooks"
          params={{ learnerId: learner.id }}
          className={styles.textLink}
        >
          Past workbooks
        </Link>
      </div>
      <h1 className={styles.title}>
        {data
          ? `No. ${data.workbook.number} · ${dateLabel(data.workbook.date)}`
          : "Workbook results"}
      </h1>
      <p className={styles.lede}>
        Type {learner.name}'s answer to have it checked, or mark each problem
        right or not yet. Saved results update progress right away.
      </p>
      {results.error ? (
        <p className={styles.message} role="alert">
          {workbookMessage(
            results.error,
            "This workbook's results didn't load. Try again.",
          )}
          <button
            type="button"
            className={styles.retry}
            onClick={() => void results.refetch()}
          >
            Try again
          </button>
        </p>
      ) : !data ? (
        <div className={styles.skeleton} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      ) : (
        <>
          <p className={styles.summary} aria-live="polite">
            <span className={styles.code}>{data.workbook.code}</span> ·{" "}
            {data.rows.length - open} of {data.rows.length} recorded
          </p>
          <ol className={styles.resultRows} aria-label="Problems">
            {data.rows.map((row) => (
              <ResultRowView
                key={row.n}
                row={row}
                draft={drafts[row.n] ?? {}}
                error={rowError?.n === row.n ? rowError.text : ""}
                disabled={save.isPending}
                onChange={(draft) => set(row.n, draft)}
              />
            ))}
          </ol>
          {/* The save bar stays one button tall while pinned; a failed save
              says so in the shared toast, and a problem it names is also
              marked on that problem's row. */}
          <div className={styles.saveBar}>
            <Button
              variant="primary"
              className={styles.download}
              disabled={!entries.length || save.isPending}
              aria-busy={save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending
                ? "Saving…"
                : entries.length
                  ? `Save ${entries.length} ${entries.length === 1 ? "result" : "results"}`
                  : open
                    ? "Enter a result to save"
                    : "All results saved"}
            </Button>
          </div>
        </>
      )}
      <Toast message={saved} tone="status" onDismiss={() => setSaved("")} />
      {/* At the top: the pinned Save button below stays free for a retry. */}
      <Toast
        message={message}
        placement="top"
        onDismiss={() => setMessage("")}
      />
    </>
  );
}

function ResultRowView({
  row,
  draft,
  error,
  disabled,
  onChange,
}: {
  row: WorkbookResultRow;
  draft: Draft;
  error: string;
  disabled: boolean;
  onChange: (draft: Draft) => void;
}) {
  const id = `problem-${row.n}`;
  return (
    <li className={styles.resultRow} aria-labelledby={`${id}-label`}>
      <div className={styles.resultHead}>
        <span className={styles.number} id={`${id}-label`}>
          {row.n}
          <span className={styles.srOnly}> · problem {row.n}</span>
        </span>
        <span className={styles.resultSection}>
          {sectionNames[row.section]}
        </span>
      </div>
      {row.label && <p className={styles.resultLabel}>{row.label}</p>}
      <p className={styles.prompt}>
        <MathText text={row.prompt} />
      </p>
      {row.recorded ? (
        <p
          className={`${styles.recorded} ${row.recorded.correct ? styles.right : styles.notYet}`}
        >
          {row.recorded.correct ? "Right" : "Not yet"}
          {row.recorded.response
            ? ` · answer ${row.recorded.response}`
            : " · marked"}
        </p>
      ) : (
        <div className={styles.resultControls}>
          {row.entry === "number" && (
            <label className={styles.answerField}>
              <span>Answer</span>
              <input
                inputMode="text"
                autoComplete="off"
                maxLength={40}
                value={draft.answer ?? ""}
                disabled={disabled}
                aria-invalid={!!error}
                aria-describedby={`${id}-error`}
                onChange={(event) =>
                  onChange(
                    event.target.value ? { answer: event.target.value } : {},
                  )
                }
              />
            </label>
          )}
          {row.entry === "choice" && (
            <div className={styles.pickField}>
              <span aria-hidden="true">Answer</span>
              <Picker
                label={`Answer to problem ${row.n}`}
                options={(row.options ?? []).map((o) => ({
                  value: o.id,
                  label: o.letter,
                  title: o.label,
                }))}
                value={draft.answer ?? null}
                disabled={disabled}
                onChange={(value) => onChange({ answer: value })}
              />
            </div>
          )}
          <div className={styles.pickField}>
            <span aria-hidden="true">
              {row.entry === "mark" ? "Mark" : "Or mark"}
            </span>
            <Picker
              label={`Mark problem ${row.n}`}
              options={[
                { value: "right", label: "Right" },
                { value: "not-yet", label: "Not yet" },
              ]}
              value={draft.answer ? null : (draft.mark ?? null)}
              disabled={disabled}
              onChange={(value) =>
                onChange({ mark: value as "right" | "not-yet" })
              }
            />
          </div>
        </div>
      )}
      <p id={`${id}-error`} className={styles.rowError} aria-live="polite">
        {error}
      </p>
    </li>
  );
}

/** A compact single-choice row of 44 px segments. */
function Picker({
  label,
  options,
  value,
  disabled,
  onChange,
}: {
  label: string;
  options: { value: string; label: string; title?: string }[];
  value: string | null;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={styles.picker}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          aria-label={
            option.title ? `${option.label}: ${option.title}` : undefined
          }
          disabled={disabled}
          className={styles.pick}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
