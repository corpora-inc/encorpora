/** Cross-tab notifications are optional. Restricted storage/browser contexts
 * must not turn a successful sign-in into a failed screen or submit action. */
export function accountChannel(): BroadcastChannel | null {
  try {
    return typeof BroadcastChannel === "function"
      ? new BroadcastChannel("amp-account-session")
      : null;
  } catch (error) {
    console.warn("Cross-tab sign-in notices are off in this browser", error);
    return null;
  }
}
export function broadcastAccountChange() {
  const channel = accountChannel();
  try {
    channel?.postMessage("changed");
  } catch (error) {
    // The same-tab event already notified the application.
    console.warn("Other tabs weren’t told about the sign-in change", error);
  } finally {
    try {
      channel?.close();
    } catch (error) {
      console.warn("The cross-tab sign-in channel didn’t close", error);
    }
  }
}
