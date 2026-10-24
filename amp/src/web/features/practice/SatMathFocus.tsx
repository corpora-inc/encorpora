import { useRef, useState, useEffect } from "react";
import { z } from "zod";
import type { FamilyLearner } from "../../../family/contracts";
import { request } from "../../lib/api";
import { Toast } from "../../ui/Toast";
import { Checkbox } from "../../ui/Checkbox";
import { useLoggedError } from "../../feedback";

export function SatMathFocus({
  learner,
  token,
  identity,
  onSaved,
}: {
  learner: FamilyLearner;
  token: string;
  identity: string;
  onSaved: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useLoggedError(error);
  const current = useRef(true);
  useEffect(() => {
    current.current = true;
    return () => {
      current.current = false;
    };
  }, [identity, learner.id]);
  async function change(enabled: boolean) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request(
        `/learners/${encodeURIComponent(learner.id)}/practice-settings`,
        z.object({ satMathFocus: z.boolean() }),
        { token, body: { satMathFocus: enabled } },
      );
      if (!current.current) return;
      await onSaved();
      if (current.current)
        setNotice("Practice setting saved. It applies to the next problem.");
    } catch {
      if (current.current)
        setError(
          "Could not confirm the practice setting. Refresh your family details and try again.",
        );
    } finally {
      if (current.current) setBusy(false);
    }
  }
  return (
    <section aria-label="Practice settings" className="sat-focus-setting">
      <Checkbox
        checked={!!learner.satMathFocus}
        disabled={busy}
        onChange={(enabled) => void change(enabled)}
      >
        SAT Math focus
      </Checkbox>
      <p>
        Practice SAT Math and its foundations. Excludes topics beyond the SAT.
      </p>
      <Toast
        tone={error ? "alert" : "status"}
        message={error || notice || (busy ? "Saving…" : "")}
        onDismiss={() => {
          setError("");
          setNotice("");
        }}
      />
    </section>
  );
}
