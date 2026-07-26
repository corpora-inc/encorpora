// The bridge between the stores and the surface model.
//
// Everything the screens read is gathered here, once, and handed to
// `surfaceOf` as a plain snapshot. Components below never reach for a store:
// there is one subscription list for the whole shell, so what a screen renders
// is a pure function of what this hook returned, which is exactly what makes
// the surface model testable without a DOM.

import { useEffect, useState } from "react"

import { appVersion, BUILD_VERSION, isNative } from "../app/platform.ts"
import { storageBreakdown, storageBytes } from "../app/profile.ts"
import { recordFor, worldFor } from "../app/stores.ts"
import { eraseEverything } from "../app/erase.ts"
import { useThemeStore } from "../app/theme.ts"
import { usePacks } from "../packs/registry.ts"
import { useLaunch } from "../packs/Stage.tsx"
import { useProfiles } from "../profiles/store.ts"
import { useSettings } from "../settings/store.ts"
import type { HostActions, HostView } from "./surfaces.ts"

/**
 * The running build.
 *
 * Native: asked of the Rust side, so it reflects the binary a parent actually
 * installed. A rejected bridge is what a wrong capability grant produces, so it
 * is caught, logged where a developer will find it, and degraded to the version
 * compiled into the bundle — a parent asking for the build number gets one
 * either way.
 */
function useVersion(): string {
  const [version, setVersion] = useState(BUILD_VERSION)

  useEffect(() => {
    let live = true
    void appVersion()
      .catch((error: unknown) => {
        console.error("dynawalla: the native bridge did not answer", error)
        return BUILD_VERSION
      })
      .then((value) => {
        if (live) setVersion(value)
      })
    return () => {
      live = false
    }
  }, [])

  return version
}

export function useHostView(armed: boolean): HostView {
  const profiles = useProfiles((state) => state.profiles)
  const currentId = useProfiles((state) => state.currentId)
  const settings = useSettings((state) => state)
  const theme = useThemeStore((state) => state.mode)
  const packs = usePacks((state) => state.installed)
  const placed = worldFor(currentId)((state) => state.placed)
  const answered = recordFor(currentId)((state) => state.answered)
  const correct = recordFor(currentId)((state) => state.correct)
  const version = useVersion()

  return {
    profiles,
    currentId,
    settings,
    theme,
    packs,
    placed,
    record: { answered, correct },
    // Read on render rather than held in state: these change only when
    // something else in this snapshot changed, so the render that shows the
    // new number is the render that recounts the bytes.
    storageBytes: storageBytes(),
    storage: storageBreakdown(),
    version,
    native: isNative,
    armed,
  }
}

export function useHostActions(arm: (armed: boolean) => void): HostActions {
  const setTheme = useThemeStore((state) => state.setMode)
  const setSettings = useSettings((state) => state.set)
  const add = useProfiles((state) => state.add)
  const select = useProfiles((state) => state.select)
  const rename = useProfiles((state) => state.rename)
  const remove = useProfiles((state) => state.remove)
  const play = useLaunch((state) => state.play)

  return {
    setTheme,
    setSettings,
    // A new learner is unnamed, not "Learner 2" written to disk: the field
    // below it is empty and ready, and a parent who types nothing still sees a
    // name, because the numbering is what the surface *draws* for a blank one.
    addProfile: () => add(""),
    selectProfile: select,
    renameProfile: rename,
    removeProfile: remove,
    armErase: () => arm(true),
    erase: () => {
      eraseEverything()
      arm(false)
    },
    launchPack: play,
  }
}
