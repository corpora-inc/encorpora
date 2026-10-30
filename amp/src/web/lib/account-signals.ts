/** Cross-tab notifications are optional. Restricted storage/browser contexts
 * must not turn a successful sign-in into a failed screen or submit action. */
export function accountChannel(): BroadcastChannel | null {
  try {
    return typeof BroadcastChannel === "function"
      ? new BroadcastChannel("amp-account-session")
      : null;
  } catch {
    return null;
  }
}
export function broadcastAccountChange() {
  const channel = accountChannel();
  try {
    channel?.postMessage("changed");
  } catch {
    /* The same-tab event already notified the application. */
  } finally {
    try {
      channel?.close();
    } catch {
      /* Optional transport. */
    }
  }
}
