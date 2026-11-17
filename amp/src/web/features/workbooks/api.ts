import {
  workbookFilename,
  attachmentFilename,
} from "../../../workbook/filename";
import { queryOptions } from "@tanstack/react-query";
import type { AuthSession } from "../../auth";
import { request } from "../../lib/api";
import { qk } from "../../lib/keys";
import { AppError } from "../../lib/AppError";
import { jsonOrNull } from "../../lib/report-error";
import {
  workbookAreasSchema,
  type WorkbookDraft,
  workbookResultsSchema,
  type WorkbookResultEntry,
  workbookHistorySchema,
  workbookSummarySchema,
  type WorkbookPaper,
  type WorkbookSummary,
} from "../../../workbook/contracts";

export type WorkbookMinutes = 30 | 45 | 60;
export const workbookPath = (learnerId: string) =>
  `/learners/${encodeURIComponent(learnerId)}/workbooks`;

/* Keys sit under the account (`qk.account(id, "workbooks", learner, …)`),
 * so every account invalidation refreshes them. */

/** A history read that is only slow waits, as the skeleton: a failure the
 * server or network may recover from is asked again quietly, and only a
 * read still failing after that, or one that has not answered in this long,
 * is said (calmly) in the list's place. */
export const HISTORY_PATIENCE_MS = 15_000;
const HISTORY_RETRIES = 2;
export const historyTooSlow = () =>
  new AppError(
    "unavailable",
    "Your workbooks are taking longer than usual. Try again in a moment.",
    true,
    null,
    "history_slow",
  );
export const historyRetry = (failures: number, error: Error) =>
  failures < HISTORY_RETRIES &&
  error instanceof AppError &&
  error.retry &&
  error.code !== "history_slow";

export const workbookHistoryOptions = (
  session: AuthSession,
  learnerId: string,
  date?: string,
) =>
  queryOptions({
    queryKey: qk.account(
      session.accountId,
      "workbooks",
      learnerId,
      "history",
      date ?? null,
    ),
    queryFn: async ({ signal }) => {
      const patience = AbortSignal.timeout(HISTORY_PATIENCE_MS);
      try {
        return await request(
          `${workbookPath(learnerId)}${date ? `?date=${date}` : ""}`,
          workbookHistorySchema,
          { token: session.token, signal: AbortSignal.any([signal, patience]) },
        );
      } catch (error) {
        if (!signal.aborted && patience.aborted) {
          const slow = historyTooSlow();
          slow.log();
          throw slow;
        }
        throw error;
      }
    },
    retry: historyRetry,
    retryDelay: (failures) => 800 * 2 ** failures,
  });

/** Whether any stored workbook still has results to enter from paper. A
 * server that does not say counts every workbook as waiting. */
export const awaitingResults = (workbooks: readonly WorkbookSummary[]) =>
  workbooks.some((workbook) => (workbook.entered ?? 0) < workbook.problems);

/** The areas a parent can choose for this learner. */
export const workbookAreasOptions = (session: AuthSession, learnerId: string) =>
  queryOptions({
    queryKey: qk.account(session.accountId, "workbooks", learnerId, "areas"),
    queryFn: ({ signal }) =>
      request(`${workbookPath(learnerId)}/areas`, workbookAreasSchema, {
        token: session.token,
        signal,
      }),
    staleTime: 5 * 60_000,
  });

/** Preparing or changing a draft never issues a workbook or spends allowance. */
export const workbookPreviewOptions = (
  session: AuthSession,
  learnerId: string,
  input: WorkbookDraft,
) =>
  queryOptions({
    queryKey: qk.account(
      session.accountId,
      "workbooks",
      learnerId,
      "preview",
      input,
    ),
    queryFn: ({ signal }) =>
      request(`${workbookPath(learnerId)}/preview`, workbookSummarySchema, {
        token: session.token,
        signal,
        body: input,
      }),
  });

/** Download and Enter results issue the chosen draft once, including retries. */
export function issueWorkbook(
  session: AuthSession,
  learnerId: string,
  input: WorkbookDraft,
) {
  return request(`${workbookPath(learnerId)}/issue`, workbookSummarySchema, {
    token: session.token,
    body: input,
  });
}

/** Saves the workbook in the chosen paper size: the PDF when the server
 * renders them, otherwise (or when rendering is unavailable right now) the
 * printable document, which prints from the browser. */
export function downloadWorkbook(
  session: AuthSession,
  learnerId: string,
  workbook: Pick<WorkbookSummary, "id" | "date" | "number">,
  paper: WorkbookPaper,
  pdf: boolean,
) {
  return downloadWorkbookFile(
    `Bearer ${session.token}`,
    learnerId,
    workbook,
    paper,
    pdf,
  );
}

async function downloadWorkbookFile(
  authorization: string,
  learnerId: string,
  workbook: Pick<WorkbookSummary, "id" | "date" | "number">,
  paper: WorkbookPaper,
  pdf: boolean,
) {
  const base = `/api/v1${workbookPath(learnerId)}/${encodeURIComponent(workbook.id)}`;
  const fetchFile = async (path: string) => {
    try {
      return await fetch(`${base}/${path}`, {
        headers: { Authorization: authorization },
      });
    } catch (cause) {
      console.warn("Workbook download didn't connect", cause);
      const error = new AppError(
        "network",
        "The workbook didn't download. Check your connection and try again.",
        true,
      );
      error.log();
      throw error;
    }
  };
  let response = pdf
    ? await fetchFile(`pdf?format=${paper === "a4" ? "A4" : "Letter"}`)
    : null;
  let kind: "pdf" | "html" = "pdf";
  if (!response || response.status === 503) {
    if (response)
      console.warn("Workbook PDF unavailable; downloading the printable copy", {
        requestId: response.headers.get("x-request-id"),
      });
    response = await fetchFile(`document?paper=${paper}`);
    kind = "html";
  }
  if (!response.ok) {
    // The error page may not be JSON; its status still says what failed.
    const data = await jsonOrNull(response);
    const message =
      data && typeof data === "object" && "error" in data
        ? String(data.error)
        : "";
    const error = new AppError(
      response.status >= 500 ? "unavailable" : "validation",
      [404, 410].includes(response.status) && message
        ? message
        : "The workbook didn't download. Try again in a moment.",
      response.status >= 500,
      response.headers.get("x-request-id"),
      // Only a missing or outdated workbook has a server message worth
      // showing; anything else is a failed download.
      [404, 410].includes(response.status) ? message || null : null,
      response.status,
    );
    error.log();
    throw error;
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = attachmentFilename(
    response.headers.get("content-disposition"),
    workbookFilename(workbook, undefined, kind),
  );
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const workbookResultsOptions = (
  session: AuthSession,
  learnerId: string,
  workbookId: string,
) =>
  queryOptions({
    queryKey: qk.account(
      session.accountId,
      "workbooks",
      learnerId,
      "results",
      workbookId,
    ),
    queryFn: ({ signal }) =>
      request(
        `${workbookPath(learnerId)}/${encodeURIComponent(workbookId)}/results`,
        workbookResultsSchema,
        { token: session.token, signal },
      ),
  });

export function saveWorkbookResults(
  session: AuthSession,
  learnerId: string,
  workbookId: string,
  entries: WorkbookResultEntry[],
) {
  return request(
    `${workbookPath(learnerId)}/${encodeURIComponent(workbookId)}/results`,
    workbookResultsSchema,
    { token: session.token, body: { entries } },
  );
}

/** The stored workbook printed with this code, or null. */
export async function workbookByCode(
  session: AuthSession,
  learnerId: string,
  code: string,
) {
  const found = await request(
    `${workbookPath(learnerId)}?code=${encodeURIComponent(code)}`,
    workbookHistorySchema,
    { token: session.token },
  );
  return found.workbooks[0] ?? null;
}
