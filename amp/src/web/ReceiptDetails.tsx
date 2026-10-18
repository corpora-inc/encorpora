import { receiptFields } from "../billing/evidence/reimbursement.js";
import { useReimbursementPrograms } from "./ReimbursementGuide.js";
export function ReceiptDetails({
  token,
  learnerName,
  programId,
  onName,
  onProgram,
}: {
  token: string;
  learnerName: string;
  programId: string;
  onName: (name: string) => void;
  onProgram: (id: string) => void;
}) {
  const programs = useReimbursementPrograms(token);
  const program = programs?.find((p) => p.id === programId);
  return (
    <section
      className="receipt-details"
      aria-labelledby="receipt-details-title"
    >
      <h2 id="receipt-details-title">Receipt details</h2>
      {!!programs?.length && (
        <label>
          Reimbursement program (optional)
          <select value={programId} onChange={(e) => onProgram(e.target.value)}>
            <option value="">Personal records</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.state} · {p.programName}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Learner name{" "}
        {program?.requiredFields.includes("learnerName")
          ? "(required by program)"
          : "(optional)"}
        <input
          value={learnerName}
          maxLength={120}
          autoComplete="off"
          onChange={(e) => onName(e.target.value)}
          aria-describedby="receipt-name-help"
        />
      </label>
      <p id="receipt-name-help">
        Added only to this download; not saved to the account. This PDF supports
        basic Latin letters and some accents. Contact purchase support if the
        font cannot print your name.
      </p>
      {program && (
        <details>
          <summary>Receipt requirements</summary>
          <p>{program.programName}</p>
          <ul>
            {program.requiredFields.map((field) => (
              <li key={field}>{receiptFields[field]}</li>
            ))}
          </ul>
          <p>Your program may require additional documents.</p>
        </details>
      )}
    </section>
  );
}
