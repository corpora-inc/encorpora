import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { checkBirthYear } from "../application/aiConsent";

/**
 * The one-time step before Free2Z sign-in, in Settings only (never in the learning loop). Addressed to the Free2Z
 * account holder: what is sent and to whom, a neutral birth-year screen, and an explicit Allow. The host decides
 * the outcome; this only checks that the year is readable.
 */
export function AiConsent({ busy, connected, locked, onAllow, onCancel }: {
  busy?: boolean;
  /** Already signed in (AI paused until allowed): Allow resumes it instead of opening sign-in. */
  connected: boolean;
  locked: boolean;
  onAllow: (birthYear: string) => void;
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
        <p>Connecting is for the Free2Z account holder.</p>
        <button type="button" className="text-button" onClick={onCancel}>OK</button>
      </div>
    );
  return (
    <form className="consent-step" aria-labelledby={headingId} onSubmit={(e) => {
      e.preventDefault();
      if (busy) return;
      if (checkBirthYear(year, new Date()) === "invalid") { setInvalid(true); return; }
      onAllow(year);
    }}>
      <h4 id={headingId}>For the Free2Z account holder</h4>
      <p>AI lessons come from Free2Z, using OpenAI models. AHA sends math problems and progress, never a name.</p>
      <label htmlFor={yearId}>Your birth year</label>
      <input id={yearId} ref={field} className="consent-year" value={year} inputMode="numeric" pattern="[0-9]*" maxLength={4}
        autoComplete="bday-year" enterKeyHint="done" disabled={busy} aria-invalid={invalid || undefined} aria-describedby={invalid ? noteId : undefined}
        onChange={(e) => { setYear(e.target.value.replace(/\D/g, "").slice(0, 4)); setInvalid(false); }} />
      {invalid && <p id={noteId} className="consent-note">Enter a four-digit year.</p>}
      <div className="settings-buttons">
        <button type="submit" className="primary-button" disabled={busy || year.length !== 4}>
          {connected ? "Allow" : <>Allow and connect <ArrowUpRight size={17} aria-hidden="true" /></>}
        </button>
        <button type="button" className="text-button" onClick={onCancel}>Not now</button>
      </div>
    </form>
  );
}
