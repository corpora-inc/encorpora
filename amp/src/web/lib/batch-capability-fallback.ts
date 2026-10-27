type ValidationPath = readonly (string | number)[];

/** Keep only Zod's issue paths; response messages can contain request data. */
export function validationPaths(details: unknown): ValidationPath[] | null {
  if (!Array.isArray(details) || details.length === 0) return null;
  const paths: ValidationPath[] = [];
  for (const issue of details) {
    if (!issue || typeof issue !== "object" || !Array.isArray(issue.path))
      return null;
    if (
      !issue.path.every(
        (part: unknown) => typeof part === "string" || typeof part === "number",
      )
    )
      return null;
    paths.push(issue.path);
  }
  return paths;
}

function rejectedOnlyNewCapability(
  error: unknown,
  field: "responseCapabilities" | "figureCapabilities" = "responseCapabilities",
): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    status?: unknown;
    code?: unknown;
    validationPaths?: unknown;
  };
  return (
    candidate.status === 400 &&
    candidate.code === "Invalid request" &&
    Array.isArray(candidate.validationPaths) &&
    candidate.validationPaths.length > 0 &&
    candidate.validationPaths.every(
      (path: unknown) =>
        Array.isArray(path) &&
        path[0] === field &&
        path.slice(1).every((part) => typeof part === "number"),
    )
  );
}

/** The response formats this web client draws, oldest first. */
export const clientResponseCapabilities = [
  "single-choice-v1",
  "multi-select-v1",
  "point-plot-v1",
  "multi-part-choice-v1",
  "figure-choice-v1",
  "structured-work-v1",
];
/** Figure capabilities an API may predate. An older API rejects the value;
 * the client then asks without it and receives the legacy figure surfaces. */
const newerFigureCapabilities = ["scenes-v2"];
/** An API older than a response format rejects its enum value and the longer
 * array. Retry without the newest format, one at a time, down to single
 * choice; any other failure is final. Capabilities are listed oldest first.
 * A newer figure capability rejected the same way is dropped too. */
export async function batchWithCapabilityFallback<
  Body extends { responseCapabilities: string[]; figureCapabilities?: string[] },
  Result,
>(
  body: Body,
  send: (body: Body) => Promise<Result>,
  canRetry: () => boolean = () => true,
): Promise<Result> {
  let current = body;
  for (;;) {
    try {
      return await send(current);
    } catch (error) {
      const figures = current.figureCapabilities ?? [];
      const newest = figures.at(-1);
      if (
        newest !== undefined &&
        newerFigureCapabilities.includes(newest) &&
        rejectedOnlyNewCapability(error, "figureCapabilities") &&
        canRetry()
      ) {
        current = { ...current, figureCapabilities: figures.slice(0, -1) };
        continue;
      }
      if (
        current.responseCapabilities.length < 2 ||
        current.responseCapabilities[0] !== "single-choice-v1" ||
        !rejectedOnlyNewCapability(error) ||
        !canRetry()
      )
        throw error;
    }
    current = {
      ...current,
      responseCapabilities: current.responseCapabilities.slice(0, -1),
    };
  }
}
