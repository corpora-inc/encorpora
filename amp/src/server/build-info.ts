/** The release this process runs: the source commit and UTC build time the
 * deploy pipeline passes as Dockerfile build arguments SOURCE_COMMIT and
 * BUILT_AT, which the image sets as AMP_BUILD_COMMIT and AMP_BUILD_TIME.
 * Public by design: they identify the release and nothing else. A value that is not a
 * full commit or an ISO-8601 UTC time reads as null, so a local build reports
 * no commit rather than a guess. */
export type BuildInfo = { commit: string | null; builtAt: string | null };

export function buildInfo(env: NodeJS.ProcessEnv = process.env): BuildInfo {
  const commit = env.AMP_BUILD_COMMIT?.trim().toLowerCase() ?? "";
  const builtAt = env.AMP_BUILD_TIME?.trim() ?? "";
  return {
    commit: /^[0-9a-f]{40}$/.test(commit) ? commit : null,
    builtAt:
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(builtAt) &&
      !Number.isNaN(Date.parse(builtAt))
        ? builtAt
        : null,
  };
}
