import { useEffect } from "react"
import ContentPackHost from "@/contentPacks/ContentPackHost"
import { useSettingsStore } from "@/store/settings"
import {
  trackPackEntered,
  trackPackHeartbeat,
  trackPackExited,
  trackPackEnter,
  trackPackExit,
  getSessionSegmentCount,
} from "@/util/analytics"

export function ContentPackOverlay({
  id,
  manifestUrl,
  entry,
}: {
  id: string
  manifestUrl?: string
  entry?: { entryId?: number; source?: string; route?: string }
}) {
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
    if (!meta) return
    const original = meta.getAttribute("content") || ""
    // Force zoom reset by temporarily constraining scale
    meta.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover")
    const timer = requestAnimationFrame(() => {
      meta.setAttribute("content", original)
    })
    return () => cancelAnimationFrame(timer)
  }, [])

  // Pack lifecycle analytics: entered → heartbeat (30s) → exited.
  // `language` is sampled at mount and each heartbeat tick from the primary
  // language in the active stack — not subscribed, so a mid-session language
  // change does not restart the interval.
  useEffect(() => {
    const mountedAt = Date.now()
    const initialSegments = getSessionSegmentCount()
    let lastHeartbeatSegments = initialSegments
    const enterLang = useSettingsStore.getState().languages[0] || ""

    trackPackEntered(id, enterLang)
    // Funnel: pack_enter (top of the monetization funnel).
    trackPackEnter(id)

    const interval = window.setInterval(() => {
      const currentSegments = getSessionSegmentCount()
      const segmentsDelta = currentSegments - lastHeartbeatSegments
      const currentLang = useSettingsStore.getState().languages[0] || ""
      trackPackHeartbeat(id, currentLang, segmentsDelta)
      lastHeartbeatSegments = currentSegments
    }, 30_000)

    return () => {
      window.clearInterval(interval)
      const durationMs = Date.now() - mountedAt
      const segmentsInPack = getSessionSegmentCount() - initialSegments
      const exitLang = useSettingsStore.getState().languages[0] || ""
      trackPackExited(id, exitLang, durationMs, segmentsInPack)
      // Funnel: pack_exit with dwell time.
      trackPackExit(id, durationMs)
    }
  }, [id])

  return (
    <div className="fixed inset-0 z-[1100]">
      <ContentPackHost id={id} manifestUrl={manifestUrl} entry={entry} />
    </div>
  )
}
