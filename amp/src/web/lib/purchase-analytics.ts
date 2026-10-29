import {
  purchaseStage,
  type PurchaseAttempt,
  type PurchaseAction,
} from "../../analytics/purchase-attempt";
import { analyticsAllowed, captureAnalyticsTracker } from "./analytics";

/** Analytics failure must never change the purchase request or its result. */
export function observePurchaseRequest(path: string, method: string) {
  const track = captureAnalyticsTracker();
  const noop = (
    _outcome: PurchaseAttempt["outcome"],
    _failure?: PurchaseAttempt["failure"],
  ) => {};
  try {
    const stage = purchaseStage(path, method);
    if (!stage || !analyticsAllowed()) return noop;
    const attemptId = crypto.randomUUID();
    track("purchase_attempt", { attemptId, stage, outcome: "started" });
    let complete = false;
    return (
      outcome: PurchaseAttempt["outcome"],
      failure?: PurchaseAttempt["failure"],
    ) => {
      if (complete) return;
      complete = true;
      try {
        track("purchase_attempt", {
          attemptId,
          stage,
          outcome,
          ...(failure ? { failure } : {}),
        });
      } catch {
        /* Optional measurement. */
      }
    };
  } catch {
    return noop;
  }
}

/** Legacy purchase screens retain their own response parsing and error UI. */
export async function purchaseFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const path = url.startsWith("/api/v1/") ? url.slice("/api/v1".length) : "";
  const observe = observePurchaseRequest(path, options.method ?? "GET");
  try {
    const response = await fetch(url, options);
    if (options.signal?.aborted) observe("cancelled");
    else if (response.ok) observe("succeeded");
    else
      observe(
        "failed",
        response.status === 401
          ? "authentication"
          : response.status === 403
            ? "permission"
            : response.status < 500
              ? "validation"
              : "unavailable",
      );
    return response;
  } catch (error) {
    if (options.signal?.aborted) observe("cancelled");
    else observe("failed", "network");
    throw error;
  }
}

export function recordPurchaseAction(action: PurchaseAction["action"]) {
  try {
    if (analyticsAllowed())
      captureAnalyticsTracker()("purchase_action", {
        actionId: crypto.randomUUID(),
        action,
      });
  } catch {
    /* A measurement failure must not interrupt a download or navigation. */
  }
}
