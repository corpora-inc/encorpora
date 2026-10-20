// No stylesheet imports here: practice modules also load under Node. The
// sheet (ReportProblemSheet) uses the UI kit and is loaded on demand.

/** "sent" for a new report; "already" when this problem was reported before. */
export type ReportResult = "sent" | "already";

/** The small flag on a resolved problem's feedback sheet. It stays in place
 * (and focusable) after a report, marked as reported. */
export function ReportProblemButton({
  reported,
  open,
}: {
  reported: boolean;
  open: () => void;
}) {
  return (
    <button
      type="button"
      className="report-problem"
      aria-label={reported ? "Problem reported" : "Report a problem"}
      title={reported ? "Problem reported" : "Report a problem"}
      aria-disabled={reported || undefined}
      data-reported={reported || undefined}
      onClick={() => {
        if (!reported) open();
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path className="flag-pole" d="M6 21V3.5" />
        <path className="flag-cloth" d="M6 4.5h11l-2.6 4 2.6 4H6" />
      </svg>
    </button>
  );
}
