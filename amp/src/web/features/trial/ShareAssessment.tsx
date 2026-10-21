import { useRef, useState } from "react";
import { buttonClass } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import styles from "./Trial.module.css";

export function assessmentShare(level: string) {
  return {
    title: "Adaptive Math Pathways",
    text: `My current math estimate on AMP: ${level}. Think you’re good at math? Try the assessment and explore your pathways.`,
    url: "https://amp.corpora.inc/try",
  };
}

/** Share only the displayed estimate and a public link, never learner identity. */
export function ShareAssessment({ level }: { level: string }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const payload = assessmentShare(level);
  const text = `${payload.text}\n${payload.url}`;
  async function share() {
    setBusy(true);
    try {
      if (
        navigator.share &&
        (!navigator.canShare || navigator.canShare(payload))
      ) {
        try {
          await navigator.share(payload);
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError")
            return;
        }
      }
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
      } catch {
        setManual(true);
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className={styles.share}>
        <button
          ref={trigger}
          className={buttonClass("quiet")}
          disabled={busy}
          onClick={() => void share()}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path
              d="M12 16V3m-5 5 5-5 5 5M5 13v7h14v-7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Share your assessment
        </button>
        <span role="status">{copied ? "Copied. Ready to paste." : ""}</span>
      </div>
      <Dialog
        open={manual}
        onOpenChange={setManual}
        title="Share your assessment"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          trigger.current?.focus();
        }}
      >
        <p>
          Copy this text to share your estimate and invite someone to try AMP.
        </p>
        <label className={styles.shareText}>
          Assessment text
          <textarea
            readOnly
            value={text}
            rows={5}
            onFocus={(event) => event.currentTarget.select()}
          />
        </label>
      </Dialog>
    </>
  );
}
