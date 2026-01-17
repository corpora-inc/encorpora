/**
 * Network status detection utilities for offline-first capabilities
 */

/**
 * Get current network status
 * @returns true if online, false if offline
 */
export function getNetworkStatus(): boolean {
  return navigator.onLine
}

/**
 * Listen to network status changes
 * @param callback Function to call when network status changes
 * @returns Cleanup function to remove event listeners
 */
export function listenToNetworkChanges(
  callback: (online: boolean) => void
): () => void {
  const handleOnline = () => callback(true)
  const handleOffline = () => callback(false)

  window.addEventListener("online", handleOnline)
  window.addEventListener("offline", handleOffline)

  return () => {
    window.removeEventListener("online", handleOnline)
    window.removeEventListener("offline", handleOffline)
  }
}
