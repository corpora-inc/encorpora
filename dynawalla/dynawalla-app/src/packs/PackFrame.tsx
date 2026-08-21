// The React surface of a mounted pack: an element to put it in, and a
// lifecycle that survives being mounted twice.
//
// It renders no text. Every string a pack surface needs — a name, a refusal, a
// consent sheet — belongs to the screen that owns the decision, because each
// one costs a full set of translations and this component is not in a position
// to know which of them is worth that.

import { useEffect, useRef } from "react"

import type { Capability, Settings } from "../../../packs/sdk/src/index.ts"
import type { HostServices } from "./bridge.ts"
import { mountPack } from "./frame.ts"
import type { MountedPack } from "./frame.ts"

import "./packs.css"

export type PackFrameProps = {
  readonly packId: string
  readonly entryUrl: string
  readonly granted: readonly Capability[]
  readonly services: HostServices
  readonly hostVersion: string
  /** The pack's localised name. The frame's accessible name, nothing more. */
  readonly title: string
  /** Pushed to the pack whenever it changes; the pack re-reads and re-renders. */
  readonly settings: Settings
  /** Paused packs stop their own loop. The host decides when, not the pack. */
  readonly paused?: boolean
  readonly onError?: (reason: string) => void
}

export function PackFrame(props: PackFrameProps) {
  const container = useRef<HTMLDivElement | null>(null)
  const mounted = useRef<MountedPack | null>(null)

  // The identity of a mount is the pack and the document it framed. Everything
  // else — settings, paused — is pushed to a live pack rather than remounting
  // it, because remounting a 3D world to change a text scale is not a change,
  // it is a restart.
  const { packId, entryUrl, granted, services, hostVersion, title, onError } = props
  useEffect(() => {
    const host = container.current
    if (!host) return
    const pack = mountPack({
      container: host,
      packId,
      entryUrl,
      granted,
      services,
      hostVersion,
      title,
      ...(onError ? { onError } : {}),
    })
    mounted.current = pack
    return () => {
      pack.dispose()
      mounted.current = null
    }
    // `granted` and `services` are stable for the life of a launch: both are
    // decided by `gateRun` before this component exists. Listing them would
    // remount the pack on every parent render that rebuilt an array literal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packId, entryUrl, hostVersion, title])

  useEffect(() => {
    mounted.current?.pushSettings(props.settings)
  }, [props.settings])

  useEffect(() => {
    mounted.current?.send(props.paused ? "pause" : "resume")
  }, [props.paused])

  return <div className="pack-frame-host" ref={container} />
}
