import { captureAnalyticsTracker } from "./analytics";
import type { FunnelProps } from "../../analytics/events";
export function observeLearningRequest(path: string, method: string) {
  const sink = captureAnalyticsTracker();
  const track: typeof sink = ((...args: Parameters<typeof sink>) => {
    try {
      (sink as Function)(...args);
    } catch {
      /* Optional diagnostics. */
    }
  }) as typeof sink;
  path = path.split(/[?#]/)[0];
  let operation: FunnelProps<"learning_request">["operation"] | undefined;
  if (path === "/catalog") operation = "catalog";
  else if (/^\/learners\/[^/]+\/batches$/.test(path)) operation = "problem";
  else if (/^\/learners\/[^/]+\/attempts$/.test(path)) operation = "answer";
  else if (/^\/learners\/[^/]+\/skips$/.test(path)) operation = "skip";
  else if (/^\/learners\/[^/]+\/hints$/.test(path)) operation = "hint";
  else if (/^\/learners\/[^/]+\/progress$/.test(path)) operation = "progress";
  else if (path === "/trials" && method === "POST") operation = "trial";
  const attemptId = crypto.randomUUID();
  if (operation)
    track("learning_request", { attemptId, operation, outcome: "started" });
  let complete = false;
  return (
    outcome: "succeeded" | "failed" | "cancelled",
    failure?: FunnelProps<"learning_request">["failure"],
  ) => {
    if (!operation || complete) return;
    complete = true;
    track("learning_request", {
      attemptId,
      operation,
      outcome,
      ...(failure ? { failure } : {}),
    });
  };
}
