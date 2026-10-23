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

/** A pre-multiselect API rejects the new enum value and array length. */
export async function batchWithCapabilityFallback<
  Body extends { responseCapabilities: string[] },
  Result,
>(
  body: Body,
  send: (body: Body) => Promise<Result>,
  canRetry: () => boolean = () => true,
): Promise<Result> {
  try {
    return await send(body);
  } catch (error) {
    if (
      !body.responseCapabilities.includes("multi-select-v1") ||
      !rejectedOnlyNewCapability(error) ||
      !canRetry()
    )
      throw error;
  }
  return send({ ...body, responseCapabilities: ["single-choice-v1"] });
}
