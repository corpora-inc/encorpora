import { useEffect, useState } from "react";
import {
  receiptFields,
  type ReimbursementProgram,
} from "../billing/evidence/reimbursement.js";
import { stateNames } from "./us-states";
import "./reimbursement.css";
export function useReimbursementPrograms(token: string) {
  const [programs, setPrograms] = useState<ReimbursementProgram[] | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setPrograms(null);
    void fetch("/api/v1/payments/reimbursement-programs", {
      headers: { authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("unavailable");
        const data = (await response.json()) as {
          programs: ReimbursementProgram[];
        };
        if (!controller.signal.aborted) setPrograms(data.programs);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          console.warn("Reimbursement guidance unavailable", error);
          setPrograms([]);
        }
      });
    return () => controller.abort();
  }, [token]);
  return programs;
}
export function ReimbursementGuide({
  token,
  onCard,
  cardAvailable,
}: {
  token: string;
  onCard: () => void;
  cardAvailable: boolean;
}) {
  const programs = useReimbursementPrograms(token);
  const [state, setState] = useState("");
  const states = [...new Set(programs?.map((p) => p.state) ?? [])].sort(
    (a, b) => (stateNames[a] ?? a).localeCompare(stateNames[b] ?? b),
  );
  return (
    <section
      className="reimbursement-guide"
      aria-labelledby="reimbursement-title"
    >
      <h3 id="reimbursement-title">Pay by card, request reimbursement</h3>
      <p>
        Your program decides whether this purchase qualifies. Check its rules
        before paying.
      </p>
      {programs === null ? (
        <p aria-busy="true">Loading reimbursement guidance…</p>
      ) : !states.length ? (
        <p>
          Ask your program about its reimbursement rules. Download your receipt
          from Family → Purchases &amp; records → Payment records after payment.
        </p>
      ) : (
        <>
          <label>
            Reimbursement state
            <select value={state} onChange={(e) => setState(e.target.value)}>
              <option value="">Choose your state</option>
              {states.map((code) => (
                <option key={code} value={code}>
                  {stateNames[code] ?? code}
                </option>
              ))}
            </select>
          </label>
          {programs!
            .filter((p) => p.state === state)
            .map((p) => (
              <article key={p.id}>
                <h4>{p.programName}</h4>
                <p>
                  Pay by card, then download your receipt from Family →
                  Purchases &amp; records → Payment records. Select your program
                  and enter the learner name if required. Submit the receipt and
                  any additional documents through your program.
                </p>
                <details>
                  <summary>Receipt requirements</summary>
                  <ul>
                    {p.requiredFields.map((field) => (
                      <li key={field}>{receiptFields[field]}</li>
                    ))}
                  </ul>
                </details>
                <a
                  href={p.officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Official {p.programName} reimbursement instructions
                </a>
              </article>
            ))}
          {state && cardAvailable && (
            <button type="button" className="go-button" onClick={onCard}>
              Continue to card payment
            </button>
          )}
        </>
      )}
    </section>
  );
}
