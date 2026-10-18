import { useEffect, useState } from "react";
import { useAppRoute } from "./app-routes";
import { BirthYearPrompt } from "./BirthYearPrompt";
import { ParentConsentCenter } from "./ParentConsentCenter";
import { useLearnerStore } from "./learner-store";
import "./guided-start.css";
/** Consent capability is server-owned. Purchase-backed enrollment plugs into
 * this step before any child profile is submitted. */
export function GuidedStart({
  token,
  identity,
  busy,
  refresh,
  create,
  onClose,
}: {
  token: string;
  identity: string;
  busy: boolean;
  refresh: () => void;
  create: (name: string, birthYear: number) => void;
  onClose: () => void;
}) {
  const { parts, navigate } = useAppRoute();
  const family = useLearnerStore((s) => s.family);
  const [name, setName] = useState("");
  useEffect(() => {
    if (parts[1] === "birth-year" && !name.trim())
      navigate("/start/name", { replace: true });
  }, [parts[1]]);
  const allowed =
    family && ["active", "development"].includes(family.consent.status);
  if (!allowed)
    return (
      <ParentConsentCenter
        token={token}
        identity={identity}
        onChanged={refresh}
        onClose={onClose}
      />
    );
  if (parts[1] === "birth-year" && name.trim())
    return (
      <div className="guided-start">
        <BirthYearPrompt
          name={name.trim()}
          birthYear={null}
          busy={busy}
          cancel={() => navigate("/start/name")}
          saveBirthYear={(year) => create(name.trim(), year)}
        />
      </div>
    );
  return (
    <main className="guided-start">
      <section className="start-card">
        <div className="setup-progress" aria-label="Step 1 of 2">
          Learner <span>1 / 2</span>
        </div>
        <h1>Who’s learning?</h1>
        <p>
          A first name or nickname helps you keep each learner’s practice
          separate.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim()) navigate("/start/birth-year");
          }}
        >
          <label htmlFor="first-learner-name">Learner name</label>
          <input
            id="first-learner-name"
            autoComplete="off"
            value={name}
            maxLength={60}
            required
            onChange={(e) => setName(e.target.value)}
          />
          <button className="go-button" disabled={busy || !name.trim()}>
            Continue
          </button>
          <button type="button" className="text-button" onClick={onClose}>
            Back to family
          </button>
        </form>
      </section>
    </main>
  );
}
