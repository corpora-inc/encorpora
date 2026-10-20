import { useRef, useState, type FormEvent } from "react";
import {
  FLAG_NOTE_MAX,
  flagReasonLabels,
  flagReasons,
  type FlagReason,
} from "../feedback/problem-flags";
import { Chips } from "./ui/Chips";
import { TextArea } from "./ui/TextField";
import type { ProblemReport } from "./problem-flag";
import type { ReportResult } from "./ProblemFlag";
export { Toast } from "./ui/Toast";

/** Reasons (one tap each), an optional note where allowed, and Send. A
 * failed send keeps the choices and explains itself in reserved space. */
export function ReportProblemForm({
  allowNote,
  send,
  done,
}: {
  allowNote: boolean;
  send: (report: ProblemReport, requestId: string) => Promise<ReportResult>;
  done: (result: ReportResult) => void;
}) {
  const [reasons, setReasons] = useState<FlagReason[]>([]);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  // One identifier per report, so a retry after a lost response is not a
  // second report.
  const requestId = useRef(crypto.randomUUID());
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!reasons.length || sending) return;
    setSending(true);
    setError("");
    try {
      done(
        await send(
          { reasons, ...(allowNote && note.trim() ? { note } : {}) },
          requestId.current,
        ),
      );
    } catch (failure) {
      console.error(
        "AMP problem report failed:",
        failure instanceof Error ? failure.message : failure,
      );
      setError("Your report wasn’t sent. Try again in a moment.");
      setSending(false);
    }
  }
  return (
    <form className="report-form" onSubmit={submit}>
      <Chips
        label="What’s wrong?"
        options={flagReasons.map((value) => ({
          value,
          label: flagReasonLabels[value],
        }))}
        value={reasons}
        onChange={(next) => {
          setReasons(next);
          setError("");
        }}
        disabled={sending}
      />
      {allowNote && (
        <TextArea
          label="Note (optional)"
          maxLength={FLAG_NOTE_MAX}
          rows={3}
          value={note}
          disabled={sending}
          onChange={(event) => setNote(event.target.value)}
        />
      )}
      <p className="report-error" role="alert">
        {error}
      </p>
      <button
        type="submit"
        className="report-send"
        disabled={!reasons.length || sending}
        aria-busy={sending}
      >
        Send
      </button>
    </form>
  );
}
