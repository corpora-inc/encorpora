import { AppError } from "../../lib/AppError";
import type { WorkbookPaper } from "../../../workbook/contracts";

/** A lesson's typeset PDFs (scripts/publications.ts): the lesson itself, a
 * workbook of practice problems and its worked solutions. */
export type PublicationKind = "lesson" | "workbook" | "solutions";

/** The learner's free problems are used: the lesson's PDFs wait with them. */
export const allowanceEnded = (error: unknown) =>
  error instanceof AppError &&
  error.status === 402 &&
  error.code === "free-allowance-complete";

const failed = "The PDF didn't download. Try again.";

function failure(status: number, code: string, requestId: string | null) {
  const message =
    status === 401
      ? "Your session ended. Sign in again to continue."
      : status === 503
        ? "This PDF is still being prepared. Try again in a few minutes."
        : // Consent and ownership refusals explain themselves.
          (status === 403 || status === 404) && code
          ? code
          : failed;
  return new AppError(
    status === 401
      ? "authentication"
      : status === 403
        ? "permission"
        : status >= 500
          ? "unavailable"
          : "validation",
    message,
    status >= 500,
    requestId,
    code || null,
    status,
  );
}

/** Downloads one of a lesson's PDFs on the person's paper. Every failure is
 * logged and thrown as an AppError whose message says what to do. */
export async function downloadPublication({
  token,
  learnerId,
  lessonId,
  kind,
  paper,
  keep = () => true,
}: {
  token: string;
  learnerId: string;
  lessonId: string;
  kind: PublicationKind;
  paper: WorkbookPaper;
  /** Checked before the file is saved: false when the person signed out. */
  keep?: () => boolean;
}) {
  const format = paper === "a4" ? "A4" : "Letter";
  let response: Response;
  try {
    response = await fetch(
      `/api/v1/learners/${encodeURIComponent(learnerId)}/publications/${encodeURIComponent(lessonId)}/${kind}?format=${format}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
  } catch {
    const error = new AppError(
      "network",
      "The PDF didn't download. Check your connection and try again.",
      true,
    );
    error.log();
    throw error;
  }
  if (!response.ok) {
    const data: unknown = await response.json().catch(() => null);
    const code =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : "";
    const error = failure(
      response.status,
      code,
      response.headers.get("x-request-id"),
    );
    error.log();
    throw error;
  }
  const blob = await response.blob();
  if (!keep()) return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${lessonId}-${kind}-${format}.pdf`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
