// The bridge between the stores and the surface model.
//
// Everything the screens read is gathered here, once, and handed to
// `surfaceOf` as a plain snapshot. Components below never reach for a store:
// there is one subscription list for the whole shell, so what a screen renders
// is a pure function of what this hook returned, which is exactly what makes
// the surface model testable without a DOM.

import { useEffect, useMemo, useState } from "react"

import { appVersion, BUILD_VERSION, isNative } from "../app/platform.ts"
import { storageBreakdown, storageBytes } from "../app/profile.ts"
import { recordFor, worldFor } from "../app/stores.ts"
import { eraseEverything } from "../app/erase.ts"
import { useThemeStore } from "../app/theme.ts"
import { useLibrary } from "../packs/libraryStore.ts"
import { usePacks, type InstalledPack } from "../packs/registry.ts"
import { useLaunch } from "../packs/Stage.tsx"
import { billing, grantingBilling, productFor } from "../pass/billing.ts"
import { dayKey, passIsOpen, EMPTY_LEDGER } from "../pass/model.ts"
import { usePass } from "../pass/store.ts"
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

/**
 * The instant these screens are describing.
 *
 * Held in state and refreshed on the events that actually move a family across
 * midnight — the app coming back to the foreground, the window regaining focus,
 * and a game closing — rather than read fresh on every render, which is not a
 * pure render and which React's rules forbid for exactly the reason that bites
 * here: two renders in one frame would disagree about the day.
 *
 * **There is no interval.** Nothing in this app counts. The authoritative
 * question — "may this game open right now" — is asked by the stage against the
 * real clock at the moment a child presses a game, so the worst this can be is
 * a stale word on a row for as long as an app sits untouched in the foreground.
 */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  // The game on the stage, or nothing. Leaving one is the most likely moment
  // for the day to have turned over while the app was busy.
  const staged = useLaunch((state) => state.packId)

  useEffect(() => {
    const check = () => setNow(Date.now())
    check()
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", check)
    if (typeof window !== "undefined") window.addEventListener("focus", check)
    return () => {
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", check)
      if (typeof window !== "undefined") window.removeEventListener("focus", check)
    }
  }, [staged])

  return now
}

/**
 * The installed record, with the live manifest laid over it.
 *
 * Two sources, on purpose, and the order matters. `usePacks` is the persisted
 * record — present on the very first frame, including before the native pack
 * root has been read — so the catalogue draws named, described cards
 * immediately on a cold launch. `useLibrary.entries` is the live truth read
 * from disk this session, so a pack updated underneath the app describes
 * itself with the manifest that is actually there.
 *
 * No new fetching: both are already loaded and already subscribed to by this
 * shell. This only decides which of the two wins per field.
 */
function useDescribedPacks(): readonly InstalledPack[] {
  const packs = usePacks((state) => state.installed)
  const entries = useLibrary((state) => state.entries)

  return useMemo(() => {
    if (entries.length === 0) return packs
    const live = new Map(entries.map((entry) => [entry.manifest.id, entry]))
    return packs.map((pack) => {
      const entry = live.get(pack.id)
      if (!entry) return pack
      return {
        ...pack,
        description: entry.description,
        skills: entry.manifest.covers.skills,
        grades: entry.manifest.covers.grades,
      }
    })
  }, [packs, entries])
}

export function useHostView(armed: boolean): HostView {
  const profiles = useProfiles((state) => state.profiles)
  const currentId = useProfiles((state) => state.currentId)
  const settings = useSettings((state) => state)
  const theme = useThemeStore((state) => state.mode)
  const packs = useDescribedPacks()
  const placed = worldFor(currentId)((state) => state.placed)
  const answered = recordFor(currentId)((state) => state.answered)
  const correct = recordFor(currentId)((state) => state.correct)
  const version = useVersion()
  const pass = usePass((state) => state.pass)
  const ledger = usePass((state) => state.ledger)

  // The row's word and the stage's decision are the same function of the same
  // ledger: a screen that says a game is resting and a stage that lets it open
  // would be two answers to one question, and the second is the one a child
  // finds.
  //
  // `billing().wired` is the third way the list comes back empty, and it is the
  // one that has to be read here rather than inferred from an empty ledger: the
  // ledger is durable and outlives the build that wrote it, so a device updated
  // from a gating version arrives with yesterday's entries still in storage. The
  // stage opens those games — `canOpen` short-circuits on the same flag — and a
  // row that called them resting would be the disagreement this block exists to
  // prevent, pointing the wrong way.
  const now = useNow()
  const open = passIsOpen(pass, now)
  const resting =
    open || !billing().wired || ledger.day !== dayKey(now) ? [] : ledger.resting

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
    pass: pass === null ? "none" : pass.kind,
    resting,
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

    // Developer mode only. `grantingBilling` produces exactly the record a
    // confirmed store purchase would, so what these exercise is the
    // entitlement path rather than a shortcut around it.
    grantTestPass: (kind) => {
      void grantingBilling()
        .buy(productFor(kind).productId)
        .then((outcome) => {
          if (outcome.status === "granted") usePass.getState().grant(outcome.pass)
        })
    },
    clearTestPass: () => usePass.getState().forget(),
    clearRestLedger: () => usePass.setState({ ledger: EMPTY_LEDGER }),
  }
}
