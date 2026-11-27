import {
  flagReasonLabels,
  flagReasons,
  type FlagReason,
} from "../feedback/problem-flags";
import type { ProblemReport } from "./problem-flag";
import type { ReportResult } from "./ProblemFlag";
import { ReportForm } from "./ReportForm";
export { Toast } from "./ui/Toast";

const reasons = flagReasons.map((value) => ({
  value,
  label: flagReasonLabels[value],
}));

/** "Report a problem": the shared report form (ReportForm.tsx) with a
 * problem's reasons. A sent report closes the sheet at once; practice
 * confirms it with a toast. */
export function ReportProblemForm({
  allowNote,
  send,
  done,
}: {
  allowNote: boolean;
  send: (report: ProblemReport, requestId: string) => Promise<ReportResult>;
  done: (result: ReportResult) => void;
}) {
  return (
    <ReportForm<FlagReason, ReportResult>
      label="What’s wrong?"
      reasons={reasons}
      allowNote={allowNote}
      send={send}
      done={done}
      what="problem"
    />
  );
}
