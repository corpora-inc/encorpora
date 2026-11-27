import { useEffect, useRef, useState, type FormEvent } from "react";
import { FLAG_NOTE_MAX } from "../feedback/problem-flags";
import { Chips } from "./ui/Chips";
import { TextArea } from "./ui/TextField";
import { Form } from "./ui/Form";

/** What the person chose in a report sheet. */
export type Report<Reason extends string> = {
  reasons: Reason[];
  note?: string;
};
/** How long a sent report's thanks shows before the sheet closes. */
export const REPORT_THANKS_MS = 1400;

/** A report sheet's form, shared by "Report a problem" and "Report this
 * film": reasons (one tap each), an optional note where allowed, and Send.
 * A failed send keeps the choices and explains itself in reserved space;
 * with `thanks`, a sent report says so in that same space, then `done`. */
export function ReportForm<Reason extends string, Result>({
  label,
  reasons: options,
  allowNote,
  send,
  done,
  thanks,
  what,
}: {
  /** The reasons' group label ("What’s wrong?"). */
  label: string;
  reasons: readonly { value: Reason; label: string }[];
  allowNote: boolean;
  send: (report: Report<Reason>, requestId: string) => Promise<Result>;
  done: (result: Result) => void;
  /** Shown in place once sent, before `done`; without it, `done` at once. */
  thanks?: string;
  /** What was being reported, for the log ("problem", "film"). */
  what: string;
}) {
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  // One identifier per report, so a retry after a lost response is not a
  // second report.
  const requestId = useRef(crypto.randomUUID());
  const closing = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(closing.current), []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!reasons.length || sending || sent) return;
    setSending(true);
    setError("");
    try {
      const result = await send(
        { reasons, ...(allowNote && note.trim() ? { note } : {}) },
        requestId.current,
      );
      if (thanks === undefined) return done(result);
      setSending(false);
      setSent(true);
      closing.current = setTimeout(() => done(result), REPORT_THANKS_MS);
    } catch (failure) {
      console.error(
        `AMP ${what} report failed:`,
        failure instanceof Error ? failure.message : failure,
      );
      setError("Your report wasn’t sent. Try again in a moment.");
      setSending(false);
    }
  }
  const locked = sending || sent;
  return (
    <Form className="report-form" onSubmit={submit}>
      <Chips
        label={label}
        options={options.map(({ value, label }) => ({ value, label }))}
        value={reasons}
        onChange={(next) => {
          setReasons(next);
          setError("");
        }}
        disabled={locked}
      />
      {allowNote && (
        <TextArea
          label="Note (optional)"
          maxLength={FLAG_NOTE_MAX}
          rows={3}
          value={note}
          disabled={locked}
          onChange={(event) => setNote(event.target.value)}
        />
      )}
      {sent ? (
        <p className="report-error report-sent" role="status">
          {thanks}
        </p>
      ) : (
        <p className="report-error" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        className="report-send"
        disabled={!reasons.length || locked}
        aria-busy={sending}
      >
        Send
      </button>
    </Form>
  );
}
