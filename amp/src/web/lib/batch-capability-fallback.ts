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

function rejectedOnlyNewCapability(error: unknown): boolean {
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
        path[0] === "responseCapabilities" &&
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
/** An API older than a response format rejects its enum value and the longer
 * array. Retry without the newest format, one at a time, down to single
 * choice; any other failure is final. Capabilities are listed oldest first. */
export async function batchWithCapabilityFallback<
  Body extends { responseCapabilities: string[] },
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
