// The stage a pack is played on: the whole window, and one way out.
//
// A launched pack takes the screen. Not a card, not a panel inside the shell's
// two-column measure — a game that is worth playing is worth the device, and a
// child holding a tablet sideways should see the game and the game only.
//
// The one piece of host chrome over it is the way back, and it is drawn on top
// of the frame rather than above it, because a bar above the frame is a bar
// that resizes the game every time the safe area changes. It is a real button
// with a real accessible name at a real target size; everything else here is
// the frame.
//
// An overlay rather than a route: the shell's five destinations are the whole
// route table (ADR-0005) and a sixth with a parameter would be a screen in the
// navigation that nothing navigates to. What is launched is app state, and
// leaving it is one action.

import { useEffect, useMemo, useState } from "react"
import { create } from "zustand"

import type { Settings } from "../../../packs/sdk/src/index.ts"
import { BUILD_VERSION } from "../app/platform.ts"
import { strings } from "../app/strings.ts"
import { useThemeStore } from "../app/theme.ts"
import { PassSheet } from "../pass/PassSheet.tsx"
import { usePass } from "../pass/store.ts"
import { useProfiles } from "../profiles/store.ts"
import { useSettings } from "../settings/store.ts"
import { entryOf, useLibrary } from "./libraryStore.ts"
import { tauriNative } from "./native.ts"
import { PackFrame } from "./PackFrame.tsx"
import { createServices, packSettings } from "./services.ts"

export interface LaunchState {
  /** The pack on the stage, or nothing. */
  readonly packId: string | null
  play: (packId: string) => void
  leave: () => void
}

export const useLaunch = create<LaunchState>()((set) => ({
  packId: null,
  play: (packId) => set({ packId }),
  leave: () => set({ packId: null }),
}))

/** `prefers-color-scheme`, live, because a pack is told the scheme it must draw in. */
function useSystemDark(): boolean {
  const [dark, setDark] = useState(
    () => typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches,
  )
  useEffect(() => {
    if (typeof matchMedia !== "function") return
    const query = matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => setDark(query.matches)
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }, [])
  return dark
}

/**
 * One pack, mounted.
 *
 * Split out so the services, the ledger and the ladder are made once per
 * launch: this component's identity IS the session, and React unmounting it is
 * what ends one.
 */
function Stage({ packId, onLeave }: { packId: string; onLeave: () => void }) {
  const entry = useLibrary((state) => state.entries.find((e) => e.manifest.id === packId))
  const profileId = useProfiles((state) => state.currentId)
  const settings = useSettings((state) => state)
  const themeMode = useThemeStore((state) => state.mode)
  const systemDark = useSystemDark()

  const [entryUrl, setEntryUrl] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  // The day pass, and the whole of its presence in this component.
  //
  // Two pieces of state, and keeping them apart is what makes the difference
  // between the two situations feel right:
  //
  //   `restedBefore`  read **once**, at mount, and never again. The game was
  //                   already finished today before the child pressed it, so
  //                   it is not mounted at all — no entry document is fetched,
  //                   no session begins, and there is no half-second of play
  //                   followed by a sheet.
  //   `offering`      the transition happened just now, in front of the child.
  //                   The frame stays mounted and pauses, so what is behind the
  //                   sheet is the thing they just finished rather than a
  //                   screen that vanished under them.
  //
  // `restedBefore` is `useState` with a lazy initialiser and no setter — a
  // value computed once, at mount, from the real clock, and then constant for
  // the life of the session. A ref would say the same thing and would be read
  // during render, which is the rule React actually enforces.
  const reachTransition = usePass((state) => state.reachTransition)
  const [restedBefore] = useState(() => !usePass.getState().mayOpen(packId))
  const [offering, setOffering] = useState(false)

  // Built by the one function that knows how a host setting becomes a pack
  // setting, so the mapping cannot drift between the launch and the push.
  const forPack: Settings = useMemo(
    () => packSettings({ settings, theme: themeMode, systemPrefersDark: systemDark }),
    [settings, themeMode, systemDark],
  )

  const launch = useMemo(
    () =>
      createServices({
        profileId,
        settings: forPack,
        onProgress: setProgress,
        onEnd: () => onLeave(),
        onMilestone: (name) => console.info(`[packs] ${packId} reached ${name}`),
        onTransition: (kind, label) => {
          console.info(`[packs] ${packId} reached a ${kind}${label ? ` (${label})` : ""}`)
          // The store decides and records in one call, so two transitions
          // arriving in the same frame cannot both be "the first one today".
          if (reachTransition(packId) === "rest") setOffering(true)
        },
      }),
    // One session per mount. `profileId` changing mid-game would be a different
    // child, which the profile switcher cannot do while the stage is up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [packId],
  )

  // Pushed to the live session rather than folded into the memo above, so a
  // setting changed while a game is running reaches the pack without restarting
  // the child's run.
  useEffect(() => {
    launch.push(forPack)
  }, [launch, forPack])

  const manifestEntry = entry?.manifest.entry
  useEffect(() => {
    if (manifestEntry === undefined) return
    // Nothing is fetched for a game that already ended today. The sheet is the
    // whole screen and there is no document behind it to load.
    if (restedBefore) return
    let live = true
    tauriNative
      .entryUrl(packId, manifestEntry)
      .then((url) => {
        if (live) setEntryUrl(url)
      })
      .catch((error: unknown) => {
        console.error(`[packs] ${packId} has no entry url`, error)
        if (live) setFailure(strings.packs.failed)
      })
    return () => {
      live = false
    }
  }, [packId, manifestEntry, restedBefore])

  if (!entry) return <Curtain message={strings.packs.missing} onLeave={onLeave} />
  if (failure !== null) return <Curtain message={failure} onLeave={onLeave} />

  // Opened again on a day it already ended. The sheet opens on the same first
  // stage it did the first time — a statement about a game, and no price.
  if (restedBefore) {
    return (
      <div className="bg-ground-deep fixed inset-0 z-50">
        <PassSheet packName={entry.name} onLeave={onLeave} />
      </div>
    )
  }

  return (
    <div className="bg-ground-deep fixed inset-0 z-50">
      {entryUrl === null ? null : (
        <PackFrame
          packId={packId}
          entryUrl={entryUrl}
          granted={entry.granted}
          services={launch.services}
          hostVersion={BUILD_VERSION}
          title={entry.name}
          settings={forPack}
          // The game stops its own loop while the sheet is up. Not unmounted:
          // what is behind the sheet is the thing the child just finished.
          paused={offering}
          onError={(reason) => setFailure(reason)}
        />
      )}

      {/* The host draws the progress, the pack does not — a hairline across the
          top edge, which is the one place no game puts anything.

          An SVG with a `width` *attribute* rather than a styled element: the
          app's CSP is `style-src 'self'`, so a `style` prop is thrown away
          silently in the shipped build while working perfectly in `vite dev`.
          A presentation attribute is not CSS and is not subject to it. */}
      <svg
        className="pointer-events-none absolute inset-x-0 top-0 h-[3px] w-full"
        viewBox="0 0 100 1"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <rect
          className="fill-index"
          x="0"
          y="0"
          height="1"
          width={Math.max(0, Math.min(1, progress)) * 100}
        />
      </svg>

      {/* Hidden while the sheet is up: two ways out of one screen, one of them
          unlabelled, is a child pressing the wrong one. */}
      {offering ? null : (
        <button
          type="button"
          onClick={onLeave}
          aria-label={strings.packs.leave}
          className="border-line-cut bg-ground/85 text-ink absolute top-[calc(max(var(--safe-top),0px)+13px)] left-[calc(max(var(--safe-left),0px)+10px)] flex h-11 w-11 items-center justify-center rounded-full border text-lg backdrop-blur"
        >
          {/* A chevron, not a word. Top-left back is what a child has already
              learned from every other app on the device, and an icon has no
              translated width — so a game can reserve one 44px square and know
              it is right in every language. The label lives in aria-label so
              the control is still announced. */}
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none">
            <path
              d="M15 4 L7 12 L15 20"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}

      {/* The stopping point, reached just now. Leaving is leaving the game:
          this one is finished for today, and the other games are not. */}
      {offering ? <PassSheet packName={entry.name} onLeave={onLeave} /> : null}
    </div>
  )
}

/** What is drawn when there is no pack to draw. Never a blank rectangle. */
function Curtain({ message, onLeave }: { message: string; onLeave: () => void }) {
  return (
    <div className="bg-ground fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 p-8">
      <p className="inscription text-ink max-w-sm text-center text-lg tracking-wide">{message}</p>
      <button
        type="button"
        onClick={onLeave}
        className="border-line-cut text-ink rounded-cut-sm min-h-11 border px-4 text-sm"
      >
        {strings.packs.leave}
      </button>
    </div>
  )
}

/** Mounted once, beside the shell. Renders nothing until a pack is launched. */
export function PackStage() {
  const packId = useLaunch((state) => state.packId)
  const leave = useLaunch((state) => state.leave)

  // Escape leaves, on every platform that has a keyboard. A game that takes the
  // whole window with no keyboard path out is a trap.
  useEffect(() => {
    if (packId === null) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") leave()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [packId, leave])

  if (packId === null) return null
  return <Stage key={packId} packId={packId} onLeave={leave} />
}

/** Whether a pack id names something installed. Used by the surface model. */
export function isLaunchable(packId: string): boolean {
  return entryOf(packId) !== undefined
}
