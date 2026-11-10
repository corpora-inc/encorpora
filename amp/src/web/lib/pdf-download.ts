import { defaultPaper } from "../features/workbooks/model";
import { AppError } from "./AppError";

/** The person's paper, Letter or A4, from their locale (the workbook
 * screen's default). */
export const paperFormat = (): "Letter" | "A4" =>
  defaultPaper() === "a4" ? "A4" : "Letter";

const words: Record<string, string> = {
  report_unavailable:
    "The PDF couldn’t be made just now. Try again in a minute.",
  card_replaced:
    "Newer cards replaced these, so they can’t be printed. Make the cards again.",
  not_found: "This isn’t available to your account anymore.",
  adult_practice_not_started:
    "Your progress report starts with your first problems.",
};

/** Downloads a PDF the server renders for this request (a report, report
 * cards, sign-in cards). Every failure is logged and thrown as an AppError
 * whose message says what happened and what to do. */
export async function downloadPdf({
  path,
  token,
  body,
  name,
}: {
  /** Under /api/v1, with its query. */
  path: string;
  token: string;
  /** Sent as JSON with a POST; a GET without it. */
  body?: unknown;
  /** The file name when the server doesn't give one. */
  name: string;
}) {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    const error = new AppError(
      "network",
      "The PDF didn’t download. Check your connection and try again.",
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
    const error = new AppError(
      response.status === 401
        ? "authentication"
        : response.status >= 500
          ? "unavailable"
          : "validation",
      response.status === 401
        ? "Your session ended. Sign in again to continue."
        : (words[code] ?? "The PDF didn’t download. Try again."),
      response.status >= 500,
      response.headers.get("x-request-id"),
      code || null,
      response.status,
    );
    error.log();
    throw error;
  }
  const blob = await response.blob();
  const given = /filename="([^"]+)"/.exec(
    response.headers.get("content-disposition") ?? "",
  )?.[1];
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = given ?? name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
