/**
 * Hover Runner settings drawer.
 *
 * Replaces the legacy right-side accordion popover with the canonical
 * bottom command drawer used by recent flagships (stargate-reader,
 * earthgate-reader). Builds three custom sections — Audio, Gameplay,
 * Advanced Gameplay — using the shared settings primitives. All
 * labels and help text flow through the pack's `t()` so the drawer
 * re-renders cleanly when the user's UI language changes.
 */

import {
  createAdvancedSection,
  createCommandDrawer,
  createToggleRow,
  type CommandDrawer,
  type DrawerSectionDef,
} from "@shared/ui"

import { t, onChange as onLangChange } from "../i18n"
import { getSfx } from "../audio"
import { tuningStore, type TuningSettings } from "../tuningStore"
import type { TiltState } from "../systems/input"

type Sfx = ReturnType<typeof getSfx>

export type MotionControl = {
  /** Try to enable motion; runs synchronously so the iOS permission prompt fires on the gesture tick. */
  request: () => void
  disable: () => void
  getState: () => TiltState
  /** Subscribe to state transitions; returns an unsubscribe function. */
  subscribe: (cb: (state: TiltState) => void) => () => void
}

export type SettingsDrawerOpts = {
  parent: HTMLElement
  isMobileDevice: boolean
  sfx: Sfx
  /**
   * If the device supports `DeviceOrientationEvent`, hand in the
   * motion-control hookup so the Gameplay section can render a single
   * cohesive Motion Controls row (toggle + live status). Pass
   * `undefined` on devices where tilt isn't available — the row will
   * simply be omitted.
   */
  motion?: MotionControl
  /** Sections prepended before Audio/Gameplay/Advanced (e.g. a pack's "Display" controls). */
  extraSections?: DrawerSectionDef[]
  onOpen?: () => void
  onClose?: () => void
  onExit?: () => void
  /**
   * Reset hook: extra side effects that the legacy popover did beyond
   * resetting `TuningSettings` — re-applying audio config, resetting
   * the active skin, and forcing the avatar progression to refresh.
   */
  onResetExtras?: () => void
}

export type SettingsDrawer = {
  drawer: CommandDrawer
  /** Rebuild every section's DOM after a language change. */
  rerender: () => void
  dispose: () => void
}

const DEFAULTS = {
  autoAdjustDifficulty: true,
  textScaleFactor: 0.6,
  motionControlsEnabled: true,
  musicEnabled: true,
  sfxEnabled: true,
  musicVolume: 0.3,
  sfxVolume: 0.5,
  baselineSpeed: 12,
  baselineCorrectProb: 0.5,
  baselineDistractors: 2,
  baselineMaxPhrases: 1,
  baselineMaxMisses: 1,
  maxSpeed: 22,
  maxDistractors: 6,
  maxSimultaneousPhrases: 3,
  maxMaxMisses: 4,
  minCorrectProb: 0.1,
} as const

const ADVANCED_KEYS = [
  "baselineSpeed",
  "baselineCorrectProb",
  "baselineDistractors",
  "baselineMaxPhrases",
  "baselineMaxMisses",
  "maxSpeed",
  "maxDistractors",
  "maxSimultaneousPhrases",
  "maxMaxMisses",
  "minCorrectProb",
] as const

function motionStatusKey(state: TiltState): string | null {
  switch (state) {
    case "off":
      return null
    case "active":
      return "settings.gameplay.motion_controls.status.active"
    case "waiting":
      return "settings.gameplay.motion_controls.status.waiting"
    case "pending":
      return "settings.gameplay.motion_controls.status.pending"
    case "denied":
      return "settings.gameplay.motion_controls.status.denied"
    case "error":
      return "settings.gameplay.motion_controls.status.error"
  }
}

function motionStatusVariant(state: TiltState): string {
  switch (state) {
    case "active":
      return "hr-motion-status--active"
    case "waiting":
    case "pending":
      return "hr-motion-status--info"
    case "denied":
    case "error":
      return "hr-motion-status--warn"
    case "off":
      return ""
  }
}

/**
 * Render the single canonical Motion Controls row inside the Gameplay
 * section. One toggle (the user's preference). One status line under
 * the label that reflects whatever the orientation listener is
 * currently doing — granted/denied/active. Tapping the toggle ON
 * synchronously calls `motion.request()` so the iOS permission prompt
 * fires on the user-gesture tick.
 *
 * Returns an unsubscribe function for the live state listener; the
 * drawer calls it before tearing the row down on language change.
 */
function renderMotionRow(container: HTMLElement, motion: MotionControl): () => void {
  const row = document.createElement("div")
  row.className = "stargate-settings-row hr-motion-row"

  // Vertical label stack: title + live status line
  const stack = document.createElement("div")
  stack.className = "hr-motion-stack"

  const label = document.createElement("span")
  label.className = "stargate-settings-label"
  label.textContent = t("settings.gameplay.motion_controls.label")

  const status = document.createElement("span")
  status.className = "hr-motion-status"

  stack.append(label, status)
  row.appendChild(stack)

  let enabled = tuningStore.getState().settings.motionControlsEnabled
  const toggle = document.createElement("button")
  toggle.className =
    "stargate-settings-toggle" + (enabled ? " stargate-settings-toggle--active" : "")
  toggle.textContent = enabled ? "ON" : "OFF"
  toggle.dataset.hrMotionPermissionTrigger = "true"
  toggle.addEventListener("pointerdown", (event) => {
    event.stopPropagation()
  })
  toggle.addEventListener("click", () => {
    enabled = !enabled
    toggle.classList.toggle("stargate-settings-toggle--active", enabled)
    toggle.textContent = enabled ? "ON" : "OFF"
    if (enabled) {
      // Synchronous so iOS gets its gesture-context permission prompt.
      motion.request()
    } else {
      motion.disable()
    }
    setSetting("motionControlsEnabled", enabled)
  })
  row.appendChild(toggle)

  container.appendChild(row)

  function paintStatus(state: TiltState) {
    const key = motionStatusKey(state)
    if (!key) {
      status.textContent = ""
      status.className = "hr-motion-status"
      return
    }
    status.textContent = t(key)
    status.className = `hr-motion-status ${motionStatusVariant(state)}`.trim()
  }

  paintStatus(motion.getState())
  return motion.subscribe(paintStatus)
}

function pluckNumbers(keys: readonly string[]): Record<string, number> {
  const state = tuningStore.getState().settings as unknown as Record<string, unknown>
  const out: Record<string, number> = {}
  for (const k of keys) {
    const v = state[k]
    if (typeof v === "number") out[k] = v
  }
  return out
}

function setSetting<K extends keyof TuningSettings>(key: K, value: TuningSettings[K]) {
  tuningStore.getState().setSetting(key, value)
}

export function createSettingsDrawer(opts: SettingsDrawerOpts): SettingsDrawer {
  const sectionContainers = new Map<string, HTMLElement>()
  // Subscriptions tied to specific renderings; cleared each time the
  // owning section re-renders so we don't leak listeners on language change.
  const subscriptionsBySection = new Map<string, (() => void)[]>()
  function trackSub(sectionId: string, unsub: () => void) {
    const list = subscriptionsBySection.get(sectionId) ?? []
    list.push(unsub)
    subscriptionsBySection.set(sectionId, list)
  }
  function clearSubs(sectionId: string) {
    const list = subscriptionsBySection.get(sectionId)
    if (!list) return
    for (const u of list) u()
    subscriptionsBySection.delete(sectionId)
  }

  function renderAudio(container: HTMLElement) {
    sectionContainers.set("hr-audio", container)

    const musicRow = createToggleRow({
      label: t("settings.audio.music.label"),
      initial: tuningStore.getState().settings.musicEnabled,
      onChange: (enabled) => {
        setSetting("musicEnabled", enabled)
        if (enabled) opts.sfx.playMusic()
        else opts.sfx.stopMusic()
      },
    })
    container.appendChild(musicRow.row)

    const sfxRow = createToggleRow({
      label: t("settings.audio.sfx.label"),
      initial: tuningStore.getState().settings.sfxEnabled,
      onChange: (enabled) => setSetting("sfxEnabled", enabled),
    })
    container.appendChild(sfxRow.row)

    createAdvancedSection(container, {
      toggleLabel: t("actions.advanced"),
      initiallyExpanded: true,
      sliders: [
        {
          key: "musicVolume",
          label: t("settings.audio.music_vol.label"),
          min: 0,
          max: 1,
          step: 0.05,
          initial: DEFAULTS.musicVolume,
        },
        {
          key: "sfxVolume",
          label: t("settings.audio.sfx_vol.label"),
          min: 0.01,
          max: 1.0,
          step: 0.01,
          initial: DEFAULTS.sfxVolume,
        },
      ],
      currentValues: pluckNumbers(["musicVolume", "sfxVolume"]),
      onChange: (key, value) => {
        setSetting(key as keyof TuningSettings, value as never)
      },
      resetLabel: null,
    })
  }

  function renderGameplay(container: HTMLElement) {
    sectionContainers.set("hr-gameplay", container)

    const autoAdjustRow = createToggleRow({
      label: t("settings.gameplay.auto_adjust.label"),
      initial: tuningStore.getState().settings.autoAdjustDifficulty,
      onChange: (enabled) => setSetting("autoAdjustDifficulty", enabled),
    })
    container.appendChild(autoAdjustRow.row)

    if (opts.motion) {
      const unsubMotion = renderMotionRow(container, opts.motion)
      trackSub("hr-gameplay", unsubMotion)
    }

    createAdvancedSection(container, {
      toggleLabel: t("actions.advanced"),
      initiallyExpanded: true,
      sliders: [
        {
          key: "textScaleFactor",
          label: t("settings.gameplay.text_scale.label"),
          min: 0.1,
          max: 1,
          step: 0.05,
          initial: DEFAULTS.textScaleFactor,
        },
      ],
      currentValues: pluckNumbers(["textScaleFactor"]),
      onChange: (key, value) => {
        setSetting(key as keyof TuningSettings, value as never)
      },
      resetLabel: null,
    })
  }

  function renderAdvanced(container: HTMLElement) {
    sectionContainers.set("hr-advanced", container)

    createAdvancedSection(container, {
      toggleLabel: t("actions.advanced"),
      initiallyExpanded: false,
      sliders: [
        {
          key: "baselineSpeed",
          label: t("settings.advanced.baseline_speed.label"),
          min: 8,
          max: 22,
          step: 0.5,
          initial: DEFAULTS.baselineSpeed,
        },
        {
          key: "baselineCorrectProb",
          label: t("settings.advanced.baseline_correct.label"),
          min: 0.1,
          max: 1,
          step: 0.05,
          initial: DEFAULTS.baselineCorrectProb,
        },
        {
          key: "baselineDistractors",
          label: t("settings.advanced.baseline_distractors.label"),
          min: 1,
          max: 4,
          step: 1,
          initial: DEFAULTS.baselineDistractors,
        },
        {
          key: "baselineMaxPhrases",
          label: t("settings.advanced.baseline_max_phrases.label"),
          min: 1,
          max: 3,
          step: 1,
          initial: DEFAULTS.baselineMaxPhrases,
        },
        {
          key: "baselineMaxMisses",
          label: t("settings.advanced.baseline_max_misses.label"),
          min: 1,
          max: 3,
          step: 1,
          initial: DEFAULTS.baselineMaxMisses,
        },
        {
          key: "maxSpeed",
          label: t("settings.advanced.max_speed.label"),
          min: 10,
          max: 30,
          step: 0.5,
          initial: DEFAULTS.maxSpeed,
        },
        {
          key: "maxDistractors",
          label: t("settings.advanced.max_distractors.label"),
          min: 2,
          max: 8,
          step: 1,
          initial: DEFAULTS.maxDistractors,
        },
        {
          key: "maxSimultaneousPhrases",
          label: t("settings.advanced.max_phrases.label"),
          min: 1,
          max: 5,
          step: 1,
          initial: DEFAULTS.maxSimultaneousPhrases,
        },
        {
          key: "maxMaxMisses",
          label: t("settings.advanced.max_max_misses.label"),
          min: 2,
          max: 6,
          step: 1,
          initial: DEFAULTS.maxMaxMisses,
        },
        {
          key: "minCorrectProb",
          label: t("settings.advanced.min_correct.label"),
          min: 0.05,
          max: 0.5,
          step: 0.05,
          initial: DEFAULTS.minCorrectProb,
        },
      ],
      currentValues: pluckNumbers(ADVANCED_KEYS),
      onChange: (key, value) => {
        setSetting(key as keyof TuningSettings, value as never)
      },
      resetLabel: null,
    })

    // Reset-all button sits at the bottom of Advanced
    const resetBtn = document.createElement("button")
    resetBtn.className = "stargate-settings-reset-btn"
    resetBtn.style.marginTop = "12px"
    resetBtn.textContent = t("actions.reset_defaults")
    resetBtn.addEventListener("click", () => {
      for (const [k, v] of Object.entries(DEFAULTS)) {
        setSetting(k as keyof TuningSettings, v as never)
      }
      tuningStore.getState().resetNetCorrect()
      opts.sfx.setMusicVolume(DEFAULTS.musicVolume)
      opts.sfx.setSfxVolume(DEFAULTS.sfxVolume)
      const musicPlaying = opts.sfx.isMusicPlaying()
      if (DEFAULTS.musicEnabled && !musicPlaying) opts.sfx.playMusic()
      else if (!DEFAULTS.musicEnabled && musicPlaying) opts.sfx.stopMusic()
      opts.onResetExtras?.()
      rerender()
    })
    container.appendChild(resetBtn)
  }

  const sections: DrawerSectionDef[] = [
    ...(opts.extraSections ?? []),
    {
      id: "hr-audio",
      title: t("settings.audio.title"),
      priority: 10,
      render: renderAudio,
    },
    {
      id: "hr-gameplay",
      title: t("settings.gameplay.title"),
      priority: 20,
      render: renderGameplay,
    },
    {
      id: "hr-advanced",
      title: t("settings.advanced.title"),
      priority: 30,
      render: renderAdvanced,
    },
  ]

  const drawer = createCommandDrawer(opts.parent, {
    customSections: sections,
    screens: ["now-playing"],
    exitLabel: t("hud.exit"),
    triggerTitle: t("menu.open"),
    onOpen: opts.onOpen,
    onClose: opts.onClose,
    onExit: opts.onExit,
  })

  function sectionTitle(id: string): string {
    if (id === "hr-audio") return t("settings.audio.title")
    if (id === "hr-gameplay") return t("settings.gameplay.title")
    if (id === "hr-advanced") return t("settings.advanced.title")
    // Fall back to the title the section was constructed with — keeps
    // extraSections (e.g. "Display") readable through Reset Defaults
    // rerenders. Re-translating an extra-section's title across a UI
    // language change is the owner's responsibility (see game.ts).
    const found = sections.find((s) => s.id === id)
    return found?.title ?? ""
  }

  function rerender() {
    for (const def of sections) {
      const container = sectionContainers.get(def.id)
      if (!container) continue
      // Tear down any live subscriptions tied to this section's
      // previous render (e.g. motion-state subscriber).
      clearSubs(def.id)
      container.innerHTML = ""
      def.render(container)
      // Section title lives in the parent element rendered by the drawer.
      const sectionEl = container.parentElement
      const titleEl = sectionEl?.querySelector(".command-drawer-section-title")
      if (titleEl) titleEl.textContent = sectionTitle(def.id)
    }
    drawer.getTrigger().title = t("menu.open")
  }

  const unsubLang = onLangChange(() => rerender())

  return {
    drawer,
    rerender,
    dispose: () => {
      unsubLang()
      for (const id of [...subscriptionsBySection.keys()]) clearSubs(id)
      drawer.dispose()
    },
  }
}
