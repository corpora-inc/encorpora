import type { FlagReason, ProblemFlagInput } from "../feedback/problem-flags";

/** What the learner chose in the report sheet. */
export type ProblemReport = {
  reasons: FlagReason[];
  note?: string;
};

let webCommit: Promise<string | null> | null = null;
/** The web build's source commit from `/version.json` (written by the image
 * build), or null in a local build or when it cannot be read. */
export function webBuildCommit(): Promise<string | null> {
  webCommit ??= fetch("/version.json", { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : null))
    .then((body: unknown) => {
      const commit = (body as { commit?: unknown } | null)?.commit;
      return typeof commit === "string" && /^[0-9a-f]{40}$/.test(commit)
        ? commit
        : null;
    })
    .catch(() => null);
  return webCommit;
}

/** The request body for `POST /learners/:id/problem-flags`. The server reads
 * the problem, answer and outcome from its own records. */
export async function problemFlagBody(
  problemId: string,
  requestId: string,
  report: ProblemReport,
  skipped = false,
): Promise<ProblemFlagInput> {
  const note = report.note?.trim();
  return {
    problemId,
    requestId,
    reasons: report.reasons,
    ...(note ? { note } : {}),
    ...(skipped ? { skipped: true } : {}),
    webCommit: await webBuildCommit(),
    client: {
      kind: "web",
      viewport: {
        width: Math.max(1, Math.round(innerWidth)),
        height: Math.max(1, Math.round(innerHeight)),
      },
    },
  };
}
