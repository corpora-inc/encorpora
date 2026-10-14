import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { checkBirthYear, type AccountExit } from "../application/aiConsent";

/**
 * The adult step before every account exit, in Settings only (never in the learning loop). Addressed to the Free2Z
 * account holder: a neutral birth-year screen with nothing pre-filled or suggested, plus, when this device has not
 * given it yet, what AI lessons send and to whom. The host decides the outcome; this only checks the year is readable.
 */
export function AiConsent({ busy, exit, needsConsent, locked, onPass, onCancel }: {
  busy?: boolean;
  exit: AccountExit;
  /** This device has not allowed AI lessons yet: the step also discloses and asks. */
  needsConsent: boolean;
  locked: boolean;
  onPass: (birthYear: string) => void;
  onCancel: () => void;
}) {
  const [year, setYear] = useState("");
  const [invalid, setInvalid] = useState(false);
  const headingId = useId(), yearId = useId(), noteId = useId();
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!locked) field.current?.focus({ preventScroll: true }); }, [locked]);
  if (locked)
    return (
      <div className="consent-step" role="status">
        <p>This is for the Free2Z account holder.</p>
        <button type="button" className="text-button" onClick={onCancel}>OK</button>
      </div>
    );
  const opensFree2z = exit !== "allow";
  const label = exit === "allow" ? "Allow" : needsConsent ? "Allow and connect" : "Continue";
  return (
    <form className="consent-step" aria-labelledby={headingId} onSubmit={(e) => {
      e.preventDefault();
      if (busy) return;
      if (checkBirthYear(year, new Date()) === "invalid") { setInvalid(true); return; }
      onPass(year);
    }}>
      <h4 id={headingId}>For the Free2Z account holder</h4>
      {needsConsent && <p>AI lessons come from Free2Z, using OpenAI models. AHA sends math problems and progress, never a name.</p>}
      <label htmlFor={yearId}>Your birth year</label>
      <input id={yearId} ref={field} className="consent-year" value={year} inputMode="numeric" pattern="[0-9]*" maxLength={4}
        autoComplete="bday-year" enterKeyHint="done" disabled={busy} aria-invalid={invalid || undefined} aria-describedby={invalid ? noteId : undefined}
        onChange={(e) => { setYear(e.target.value.replace(/\D/g, "").slice(0, 4)); setInvalid(false); }} />
      {invalid && <p id={noteId} className="consent-note">Enter a four-digit year.</p>}
      <div className="settings-buttons">
        <button type="submit" className="primary-button" disabled={busy || year.length !== 4}>
          {label}{opensFree2z && <ArrowUpRight size={17} aria-hidden="true" />}
        </button>
        <button type="button" className="text-button" onClick={onCancel}>Not now</button>
      </div>
    </form>
  );
}
