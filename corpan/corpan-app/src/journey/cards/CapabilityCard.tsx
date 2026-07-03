// src/journey/cards/CapabilityCard.tsx — Journey's renderer for capability
// activity types (capability-modules.md §6.1): mounts through the registry
// and maps the handle to the feed lifecycle — pre-mount with startPaused
// (D7), resume() on card-active, pause() on scroll-away, result → engine.

import { useEffect, useRef } from "react"
import type { ActivityResult } from "../../contentPacks/activityContract"
import type { CapabilityHandle } from "@shared/capabilities/core"
import { isCapabilityId, loadCapability } from "../capabilities/registry.ts"
import { popInCapabilityHost } from "../popin/popinBus.ts"
import type { FeedCard } from "../types.ts"

export function CapabilityCard(props: {
  card: Extract<FeedCard, { kind: "capability" }>
  active: boolean
  onResult: (r: ActivityResult) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const handleRef = useRef<CapabilityHandle | null>(null)
  const settledRef = useRef(false)

  useEffect(() => {
    const host = popInCapabilityHost()
    const container = containerRef.current
    const capId = props.card.capabilityId
    if (!host || !container || !isCapabilityId(capId)) return
    let disposed = false
    void loadCapability(capId).then((mod) => {
      if (disposed) return
      const handle = mod.mount(container, host, {
        ...props.card.spec,
        params: { ...(props.card.spec.params ?? {}), startPaused: true },
      })
      handleRef.current = handle
      if (props.active) handle.resume()
      void handle.result.then((result) => {
        if (settledRef.current || disposed) return
        settledRef.current = true
        props.onResult(result)
      })
    })
    return () => {
      disposed = true
      handleRef.current?.dispose()
      handleRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.card.cardId])

  useEffect(() => {
    if (props.active) handleRef.current?.resume()
    else handleRef.current?.pause()
  }, [props.active])

  return <div ref={containerRef} className="min-h-64 w-full" data-testid="journey-capability-card" />
}
