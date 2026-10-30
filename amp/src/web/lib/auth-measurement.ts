import { track } from "./analytics";
import { errorDetails } from "../../analytics/error-details";
import type { FunnelProps } from "../../analytics/events";

/** First-party diagnostics, not an ad conversion. No auth values are recorded. */
export async function measureAuth<T>(
  stage: FunnelProps<"auth_request">["stage"],
  work: () => Promise<T>,
  provider?: FunnelProps<"auth_request">["provider"],
): Promise<T> {
  const props = {
    attemptId: crypto.randomUUID(),
    stage,
    ...(provider ? { provider } : {}),
  };
  track("auth_request", { ...props, outcome: "started" });
  try {
    const result = await work();
    track("auth_request", { ...props, outcome: "succeeded" });
    return result;
  } catch (error) {
    track("auth_request", {
      ...props,
      outcome: "failed",
      ...errorDetails(error),
    });
    throw error;
  }
}
