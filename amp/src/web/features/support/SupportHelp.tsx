import { useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import type { parentFeedbackSchema } from "../../../feedback/parent-feedback";
import { request } from "../../lib/api";
import { Button } from "../../ui/Button";
import { Checkbox } from "../../ui/Checkbox";
import { Dialog } from "../../ui/Dialog";
import { TextArea } from "../../ui/TextField";
import styles from "./SupportHelp.module.css";
export const SUPPORT_EMAIL = "support@corpora.inc";
type Context = z.infer<typeof parentFeedbackSchema>["context"];
type Program = z.infer<typeof parentFeedbackSchema>["program"];
/** Voluntary adult feedback, shown only after a deliberate click. Never exit-blocking. */
export function ParentFeedbackForm({
  context,
  program,
  onClose,
}: {
  context: Context;
  program?: Program;
  onClose: () => void;
}) {
  const [message, setMessage] = useState("");
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const retry = useRef<{ payload: string; requestId: string } | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || sent) return;
    if (!adult || !message.trim()) {
      setError("Confirm you’re an adult and add your feedback.");
      return;
    }
    const payload = JSON.stringify({
      adult,
      context,
      program,
      message: message.trim(),
    });
    if (retry.current?.payload !== payload)
      retry.current = { payload, requestId: crypto.randomUUID() };
    setBusy(true);
    setError("");
    try {
      await request(
        "/parent-feedback",
        z.object({ accepted: z.literal(true) }),
        {
          body: { ...JSON.parse(payload), requestId: retry.current.requestId },
        },
      );
      setSent(true);
      setMessage("");
    } catch {
      setError(
        "Your feedback wasn’t confirmed. Try again, or email support@corpora.inc.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={(e) => void submit(e)} className={styles.form}>
      {sent ? (
        <p role="status">Thank you. Your feedback helps us improve AMP.</p>
      ) : (
        <>
          <p>How’s AMP working for you? Tell us what would make it better.</p>
          <TextArea
            label="Your feedback"
            value={message}
            maxLength={2000}
            rows={4}
            disabled={busy}
            onChange={(e) => setMessage(e.target.value)}
          />
          <Checkbox checked={adult} onChange={setAdult} disabled={busy}>
            I’m a parent or adult learner.
          </Checkbox>
          <p>
            Please leave out names and other private information. We keep
            feedback for 90 days to improve AMP. Need a reply?{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`}>Email support.</a>
          </p>
          <p role="alert" className={styles.status}>
            {error}
          </p>
        </>
      )}
      <div className={styles.actions}>
        {!sent && (
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Sending…" : "Send feedback"}
          </Button>
        )}
        <Button type="button" variant="quiet" onClick={onClose}>
          {sent ? "Done" : "Close"}
        </Button>
      </div>
    </form>
  );
}
export function SupportHelp({
  context = "general",
  program,
  feedback = true,
  contact = true,
}: {
  context?: Context;
  program?: Program;
  feedback?: boolean;
  /** Omit when the surrounding frame already provides the support contact. */
  contact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <aside
      aria-label={contact ? "Help and feedback" : "Parent feedback"}
      className={styles.help}
    >
      {contact && (
        <p>
          Need a hand? <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
      )}
      {feedback && (
        <>
          <Button type="button" variant="quiet" onClick={() => setOpen(true)}>
            Share parent feedback
          </Button>
          <Dialog
            open={open}
            onOpenChange={setOpen}
            title="Share your experience"
          >
            <ParentFeedbackForm
              context={context}
              program={program}
              onClose={() => setOpen(false)}
            />
          </Dialog>
        </>
      )}
    </aside>
  );
}
