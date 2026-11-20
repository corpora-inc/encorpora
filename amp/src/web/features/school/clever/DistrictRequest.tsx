import { useRef, useState } from "react";
import { Button, buttonClass } from "../../../ui/Button";
import styles from "./DistrictRequest.module.css";

/** What a teacher's district does for AMP in Clever: `add` it (the district
 * hasn't), or `connect` it (it's in Clever; a district admin's one sign-in
 * finishes setup). */
export type DistrictStep = "add" | "connect";

const subjects: Record<DistrictStep, string> = {
  add: "Please add AMP to our Clever account",
  connect: "Please finish AMP setup in Clever",
};

/** The note a teacher forwards. Its link is the one thing the admin opens:
 * Clever's page for adding AMP, or AMP's setup page. */
export function districtMessage(step: DistrictStep, link: string) {
  return [
    step === "add"
      ? `I’d like to use AMP (Adaptive Math Pathways) with my classes. Please add it to our Clever account so rosters sync and students log in with Clever: ${link}`
      : `AMP (Adaptive Math Pathways) is in our Clever account. A district admin finishes setup with one Clever sign-in: ${link}`,
    "I’m starting a free pilot now. My classes move into the district roster when it’s connected.",
  ].join("\n\n");
}

/** A district's yes is never what a teacher waits on: the ready-to-forward
 * request, sent from their own mail (no recipient filled in) or copied, and
 * the promise that the pilot's work moves over. Shown beside the pilot. */
export function DistrictRequest({
  step,
  signupUrl,
}: {
  step: DistrictStep;
  /** Clever's page where a district adds AMP (AMP_CLEVER_DISTRICT_SIGNUP_URL). */
  signupUrl?: string;
}) {
  const link =
    step === "add"
      ? (signupUrl ?? `${location.origin}/schools`)
      : `${location.origin}/school/connect`;
  const message = districtMessage(step, link);
  const [copied, setCopied] = useState<"copied" | "select" | null>(null);
  const text = useRef<HTMLParagraphElement>(null);
  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied("copied");
    } catch (failure) {
      // Never silent: say so, and leave the message selected to copy by hand.
      console.warn("The clipboard refused the district message", failure);
      if (text.current) getSelection()?.selectAllChildren(text.current);
      setCopied("select");
    }
  }
  const headingId = `district-request-${step}`;
  return (
    <section className={styles.request} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>
        {step === "add"
          ? "Ask your district to add AMP"
          : "Send this to your district admin"}
      </h2>
      <p ref={text} className={styles.message} data-district-message="">
        {message}
      </p>
      <div className={styles.actions}>
        <a
          className={buttonClass("secondary")}
          href={`mailto:?subject=${encodeURIComponent(subjects[step])}&body=${encodeURIComponent(message)}`}
        >
          Email it
        </a>
        <Button variant="quiet" onClick={() => void copy()}>
          {/* Every label in one cell: the widest holds the button's size, so
              the button never moves when its label changes. */}
          <span className={styles.labels} aria-live="polite">
            {(
              [
                [null, "Copy message"],
                ["copied", "Copied"],
                ["select", "Selected"],
              ] as const
            ).map(([state, label]) => (
              <span
                key={label}
                data-shown={copied === state || undefined}
                aria-hidden={copied !== state || undefined}
              >
                {label}
              </span>
            ))}
          </span>
        </Button>
      </div>
      <p className={styles.note}>
        Your pilot classes move into the district roster later. No work is lost.
      </p>
      {step === "add" && signupUrl && (
        <a
          href={signupUrl}
          rel="noreferrer"
          className={buttonClass("quiet", "", "start")}
        >
          District admin? Add AMP in Clever
        </a>
      )}
    </section>
  );
}
