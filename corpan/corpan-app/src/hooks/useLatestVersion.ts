import { useEffect } from "react"

import { getAppVersion } from "@/lib/appVersion"
import { fetchLatestVersion } from "@/lib/latestVersion"
import { useUpdatePromptStore } from "@/store/updatePrompt"
import { getNetworkStatus } from "@/utils/network"

// Refresh the latest-version probe at most once per ~6 hours per app session.
// We want to know about new releases promptly but never hammer the store APIs.
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000

export function useLatestVersion(): void {
  const lastCheckedAt = useUpdatePromptStore((s) => s.lastCheckedAt)
  const setLatest = useUpdatePromptStore((s) => s.setLatest)
  const setCurrentVersion = useUpdatePromptStore((s) => s.setCurrentVersion)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const current = await getAppVersion()
        if (cancelled) return
        setCurrentVersion(current)
      } catch {
        // appVersion module already falls back to the compile-time version.
      }

      if (!getNetworkStatus()) return

      const fresh =
        lastCheckedAt && Date.now() - lastCheckedAt < REFRESH_INTERVAL_MS
      if (fresh) return

      const latest = await fetchLatestVersion()
      if (cancelled || !latest) return
      setLatest({
        version: latest.version,
        storeUrl: latest.storeUrl,
        platform: latest.platform,
      })
    })()

    return () => {
      cancelled = true
    }
    // Intentionally only run on mount — store actions are stable refs and we
    // gate refresh on lastCheckedAt above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
