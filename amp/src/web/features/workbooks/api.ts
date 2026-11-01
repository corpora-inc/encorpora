import { queryOptions } from "@tanstack/react-query";
import type { AuthSession } from "../../auth";
import { request } from "../../lib/api";
import { AppError } from "../../lib/AppError";
import {
  workbookHistorySchema,
  workbookSummarySchema,
  type WorkbookPaper,
  type WorkbookSummary,
} from "../../../workbook/contracts";

export type WorkbookMinutes = 30 | 45 | 60;
export const workbookPath = (learnerId: string) =>
  `/learners/${encodeURIComponent(learnerId)}/workbooks`;

/** Under the account key, so every account invalidation refreshes it. */
export const workbooksKey = (session: AuthSession, learnerId: string) =>
  ["account", session.accountId, "workbooks", learnerId] as const;

export const workbookHistoryOptions = (
  session: AuthSession,
  learnerId: string,
  date?: string,
) =>
  queryOptions({
    queryKey: [...workbooksKey(session, learnerId), "history", date ?? null],
    queryFn: ({ signal }) =>
      request(
        `${workbookPath(learnerId)}${date ? `?date=${date}` : ""}`,
        workbookHistorySchema,
        { token: session.token, signal },
      ),
  });

/** Same date, number and length return the stored workbook, so this is safe
 * to repeat: it reads the workbook, making it the first time. */
export const workbookOptions = (
  session: AuthSession,
  learnerId: string,
  input: {
    date: string;
    number: number;
    minutes: WorkbookMinutes;
    paper: WorkbookPaper;
  },
) =>
  queryOptions({
    queryKey: [...workbooksKey(session, learnerId), "workbook", input],
    queryFn: ({ signal }) =>
      request(workbookPath(learnerId), workbookSummarySchema, {
        token: session.token,
        signal,
        body: input,
      }),
  });

export function anotherWorkbook(
  session: AuthSession,
  learnerId: string,
  input: { date: string; minutes: WorkbookMinutes; paper: WorkbookPaper },
) {
  return request(workbookPath(learnerId), workbookSummarySchema, {
    token: session.token,
    body: input,
  });
}

/** Saves the workbook PDF in the chosen paper size. */
export async function downloadWorkbook(
  session: AuthSession,
  learnerId: string,
  workbook: WorkbookSummary,
  paper: WorkbookPaper,
) {
  let response: Response;
  try {
    response = await fetch(
      `/api/v1${workbookPath(learnerId)}/${encodeURIComponent(workbook.id)}/pdf?format=${paper === "a4" ? "A4" : "Letter"}`,
      { headers: { Authorization: `Bearer ${session.token}` } },
    );
  } catch {
    const error = new AppError(
      "network",
      "The workbook didn't download. Check your connection and try again.",
      true,
    );
    error.log();
    throw error;
  }
  if (!response.ok) {
    const data: unknown = await response.json().catch(() => null);
    const message =
      data && typeof data === "object" && "error" in data
        ? String(data.error)
        : "";
    const error = new AppError(
      response.status >= 500 ? "unavailable" : "validation",
      [404, 410, 503].includes(response.status) && message
        ? message
        : "The workbook didn't download. Try again in a moment.",
      response.status >= 500,
      response.headers.get("x-request-id"),
      message || null,
      response.status,
    );
    error.log();
    throw error;
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `amp-workbook-${workbook.date}-${workbook.number}.pdf`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
