import { create } from "zustand"
import { openDB, type IDBPDatabase } from "idb"
import type {
  Project,
  TrackId,
  VoiceTrackId,
  SkinId,
  LayoutHeights,
  VoiceTrack,
  DrumTrack,
  DelayConfig,
  DelayChannelId,
  ChannelSend,
  ReverbConfig,
} from "../model/project"
import {
  createDefaultProject,
  migrateSchema1To2,
  stepsForTimeSignature,
  availableStepCounts,
  resizeBoolSteps,
  resizeNoteSteps,
  DEFAULT_DELAY,
  DEFAULT_DELAY_ROUTING,
  DEFAULT_REVERB,
  DEFAULT_REVERB_ROUTING,
} from "../model/project"

const DB_NAME = "melopan"
const STORE = "projects"
const ACTIVE_KEY = "active"

let dbPromise: Promise<IDBPDatabase> | null = null
const getDb = () => {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE)
        }
      },
    })
  }
  return dbPromise
}

type State = {
  project: Project
  ready: boolean
  /** Mutate one step on a track (drum or voice). */
  toggleStep: (trackId: TrackId, step: number) => void
  setTrackVolume: (trackId: TrackId, v: number) => void
  toggleMute: (trackId: TrackId) => void
  /** Top-bar controls */
  setBpm: (bpm: number) => void
  setMasterVolume: (v: number) => void
  setTimeSignature: (top: number, bottom: number) => void
  /** Override the pattern length directly (STEPS picker). */
  setLengthSteps: (n: number) => void
  /** Voice pad — apply to a specific voice track */
  setVoicePadVoice: (trackId: VoiceTrackId, voice: string) => void
  setVoicePadWord: (trackId: VoiceTrackId, word: string | null) => void
  setVoicePadPitch: (trackId: VoiceTrackId, semis: number) => void
  /** Clear all step patterns across drum + voice tracks (keeps volumes/mutes). */
  clearAllSteps: () => void
  /** Synth (piano roll) */
  setSynthNote: (step: number, midi: number | null) => void
  clearSynthNotes: () => void
  setSynthVolume: (v: number) => void
  toggleSynthMute: () => void
  setAccidental: (rowIdx: number, value: number) => void
  /** Skin */
  setSkin: (skin: SkinId) => void
  /** Master delay — patch any subset of the config in one call. */
  setDelay: (patch: Partial<Omit<DelayConfig, "routing">> & {
    routing?: Partial<Record<DelayChannelId, Partial<ChannelSend>>>
  }) => void
  /** Master reverb — patch any subset of the config in one call. */
  setReverb: (patch: Partial<Omit<ReverbConfig, "routing">> & {
    routing?: Partial<Record<DelayChannelId, Partial<ChannelSend>>>
  }) => void
  /** Layout heights (px) for resizable panels */
  setLayout: (next: Partial<LayoutHeights>) => void
  /** Replace the whole project (e.g. on load) */
  setProject: (next: Project) => void
  /** Reset to first-open defaults, preserving the user's chosen skin. */
  resetProject: () => void
}

const persist = async (project: Project) => {
  try {
    const db = await getDb()
    await db.put(STORE, project, ACTIVE_KEY)
  } catch (err) {
    console.warn("[melopan] Failed to persist project:", err)
  }
}

const debounce = <T extends (...args: any[]) => any>(fn: T, ms: number) => {
  let t: ReturnType<typeof setTimeout> | null = null
  return (...args: Parameters<T>) => {
    if (t) clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
}

const persistDebounced = debounce((p: Project) => persist(p), 300)

const bumpUpdate = (p: Project): Project => ({ ...p, updatedAt: Date.now() })

const updateTrack = (
  project: Project,
  trackId: TrackId,
  apply: (t: DrumTrack | VoiceTrack) => DrumTrack | VoiceTrack
): Project => ({
  ...project,
  tracks: project.tracks.map((t) => (t.id === trackId ? apply(t) : t)),
})

const updateVoiceTrack = (
  project: Project,
  trackId: VoiceTrackId,
  apply: (t: VoiceTrack) => VoiceTrack
): Project => ({
  ...project,
  tracks: project.tracks.map((t) =>
    t.kind === "voice" && t.id === trackId ? apply(t) : t
  ),
})

export const useProjectStore = create<State>((set) => ({
  project: createDefaultProject(),
  ready: false,

  toggleStep: (trackId, step) => set((s) => {
    const next = bumpUpdate(
      updateTrack(s.project, trackId, (t) => ({
        ...t,
        steps: t.steps.map((on, i) => (i === step ? !on : on)),
      }))
    )
    persistDebounced(next)
    return { project: next }
  }),

  setTrackVolume: (trackId, v) => set((s) => {
    const clamped = Math.max(0, Math.min(1, v))
    const next = bumpUpdate(
      updateTrack(s.project, trackId, (t) => ({ ...t, volume: clamped }))
    )
    persistDebounced(next)
    return { project: next }
  }),

  toggleMute: (trackId) => set((s) => {
    const next = bumpUpdate(
      updateTrack(s.project, trackId, (t) => ({ ...t, mute: !t.mute }))
    )
    persistDebounced(next)
    return { project: next }
  }),

  setBpm: (bpm) => set((s) => {
    const next = bumpUpdate({ ...s.project, bpm: Math.max(40, Math.min(240, bpm)) })
    persistDebounced(next)
    return { project: next }
  }),

  setMasterVolume: (v) => set((s) => {
    const next = bumpUpdate({ ...s.project, masterVolume: Math.max(0, Math.min(1, v)) })
    persistDebounced(next)
    return { project: next }
  }),

  setTimeSignature: (top, bottom) => set((s) => {
    // Preserve current resolution (×k on the top number) so the cell
    // feel stays the same when switching sigs: 4/4 @ 32 (×8) → 3/4 @ 24
    // (also ×8). Falls back to the sig's default if the multiplier is
    // out of the picker range.
    const [prevTop] = s.project.timeSignature
    const prevMultiplier = s.project.lengthSteps / prevTop
    const candidate = Math.round(top * prevMultiplier)
    const opts = availableStepCounts(top, bottom)
    const newLen = opts.includes(candidate)
      ? candidate
      : stepsForTimeSignature(top, bottom)
    const next = bumpUpdate({
      ...s.project,
      timeSignature: [top, bottom] as [number, number],
      lengthSteps: newLen,
      tracks: s.project.tracks.map((t) => ({
        ...t,
        steps: resizeBoolSteps(t.steps, newLen),
      })),
      synth: {
        ...s.project.synth,
        notes: resizeNoteSteps(s.project.synth.notes, newLen),
      },
    })
    persistDebounced(next)
    return { project: next }
  }),

  setLengthSteps: (n) => set((s) => {
    const clamped = Math.max(1, Math.min(256, Math.round(n)))
    if (clamped === s.project.lengthSteps) return s
    const next = bumpUpdate({
      ...s.project,
      lengthSteps: clamped,
      tracks: s.project.tracks.map((t) => ({
        ...t,
        steps: resizeBoolSteps(t.steps, clamped),
      })),
      synth: {
        ...s.project.synth,
        notes: resizeNoteSteps(s.project.synth.notes, clamped),
      },
    })
    persistDebounced(next)
    return { project: next }
  }),

  setVoicePadVoice: (trackId, voice) => set((s) => {
    const next = bumpUpdate(
      updateVoiceTrack(s.project, trackId, (t) => ({ ...t, voice }))
    )
    persistDebounced(next)
    return { project: next }
  }),

  setVoicePadWord: (trackId, word) => set((s) => {
    const next = bumpUpdate(
      updateVoiceTrack(s.project, trackId, (t) => ({ ...t, word }))
    )
    persistDebounced(next)
    return { project: next }
  }),

  setVoicePadPitch: (trackId, semis) => set((s) => {
    const clamped = Math.max(-24, Math.min(24, semis))
    const next = bumpUpdate(
      updateVoiceTrack(s.project, trackId, (t) => ({ ...t, pitchSemis: clamped }))
    )
    persistDebounced(next)
    return { project: next }
  }),

  clearAllSteps: () => set((s) => {
    const next = bumpUpdate({
      ...s.project,
      tracks: s.project.tracks.map((t) => ({
        ...t,
        steps: t.steps.map(() => false),
      })),
    })
    persistDebounced(next)
    return { project: next }
  }),

  setSynthNote: (step, midi) => set((s) => {
    const next = bumpUpdate({
      ...s.project,
      synth: {
        ...s.project.synth,
        notes: s.project.synth.notes.map((n, i) => (i === step ? midi : n)),
      },
    })
    persistDebounced(next)
    return { project: next }
  }),

  clearSynthNotes: () => set((s) => {
    const next = bumpUpdate({
      ...s.project,
      synth: {
        ...s.project.synth,
        notes: s.project.synth.notes.map(() => null),
      },
    })
    persistDebounced(next)
    return { project: next }
  }),

  setSynthVolume: (v) => set((s) => {
    const next = bumpUpdate({
      ...s.project,
      synth: { ...s.project.synth, volume: Math.max(0, Math.min(1, v)) },
    })
    persistDebounced(next)
    return { project: next }
  }),

  toggleSynthMute: () => set((s) => {
    const next = bumpUpdate({
      ...s.project,
      synth: { ...s.project.synth, mute: !s.project.synth.mute },
    })
    persistDebounced(next)
    return { project: next }
  }),

  setAccidental: (rowIdx, value) => set((s) => {
    const clamped = Math.max(-1, Math.min(1, Math.round(value)))
    const next = bumpUpdate({
      ...s.project,
      synth: {
        ...s.project.synth,
        accidentals: s.project.synth.accidentals.map((a, i) => (i === rowIdx ? clamped : a)),
      },
    })
    persistDebounced(next)
    return { project: next }
  }),

  setSkin: (skin) => set((s) => {
    try { window.localStorage.setItem("melopan:skin", skin) } catch {}
    const next = bumpUpdate({ ...s.project, skin })
    persistDebounced(next)
    return { project: next }
  }),

  setDelay: (patch) => set((s) => {
    const cur = s.project.delay ?? DEFAULT_DELAY
    const curRouting = cur.routing ?? DEFAULT_DELAY_ROUTING
    const mergedRouting = patch.routing
      ? (Object.fromEntries(
          (Object.keys(curRouting) as DelayChannelId[]).map((ch) => {
            const curCh = curRouting[ch] ?? DEFAULT_DELAY_ROUTING[ch]
            const patchCh = patch.routing?.[ch]
            const merged: ChannelSend = patchCh
              ? {
                  enabled: patchCh.enabled ?? curCh.enabled,
                  level: Math.max(0, Math.min(1, patchCh.level ?? curCh.level)),
                }
              : curCh
            return [ch, merged]
          })
        ) as Record<DelayChannelId, ChannelSend>)
      : curRouting
    const merged: DelayConfig = {
      enabled: patch.enabled ?? cur.enabled,
      time: patch.time ?? cur.time,
      feedback: Math.max(0, Math.min(0.9, patch.feedback ?? cur.feedback)),
      wet: Math.max(0, Math.min(1, patch.wet ?? cur.wet)),
      routing: mergedRouting,
    }
    const next = bumpUpdate({ ...s.project, delay: merged })
    persistDebounced(next)
    return { project: next }
  }),

  setReverb: (patch) => set((s) => {
    const cur = s.project.reverb ?? DEFAULT_REVERB
    const curRouting = cur.routing ?? DEFAULT_REVERB_ROUTING
    const mergedRouting = patch.routing
      ? (Object.fromEntries(
          (Object.keys(curRouting) as DelayChannelId[]).map((ch) => {
            const curCh = curRouting[ch] ?? DEFAULT_REVERB_ROUTING[ch]
            const patchCh = patch.routing?.[ch]
            const merged: ChannelSend = patchCh
              ? {
                  enabled: patchCh.enabled ?? curCh.enabled,
                  level: Math.max(0, Math.min(1, patchCh.level ?? curCh.level)),
                }
              : curCh
            return [ch, merged]
          })
        ) as Record<DelayChannelId, ChannelSend>)
      : curRouting
    const merged: ReverbConfig = {
      enabled: patch.enabled ?? cur.enabled,
      room: patch.room ?? cur.room,
      dampening: Math.max(0, Math.min(1, patch.dampening ?? cur.dampening)),
      wet: Math.max(0, Math.min(1, patch.wet ?? cur.wet)),
      routing: mergedRouting,
    }
    const next = bumpUpdate({ ...s.project, reverb: merged })
    persistDebounced(next)
    return { project: next }
  }),

  setLayout: (patch) => set((s) => {
    const next = bumpUpdate({
      ...s.project,
      layout: { ...(s.project.layout ?? {}), ...patch },
    })
    persistDebounced(next)
    return { project: next }
  }),

  setProject: (next) => {
    persistDebounced(next)
    set({ project: next })
  },

  resetProject: () => set((s) => {
    const fresh = createDefaultProject()
    const next = bumpUpdate({ ...fresh, skin: s.project.skin })
    persistDebounced(next)
    return { project: next }
  }),
}))

/** Load the persisted project from idb. Safe to call multiple times. */
export const hydrateProject = async () => {
  try {
    const db = await getDb()
    const saved = await db.get(STORE, ACTIVE_KEY) as unknown
    let project: Project | null = null

    if (saved && typeof saved === "object") {
      const schema = (saved as { schema?: unknown }).schema
      if (schema === 2) {
        project = saved as Project
      } else if (schema === 1) {
        project = migrateSchema1To2(saved)
        if (project) {
          // Persist the migrated shape so we don't re-migrate next load
          await db.put(STORE, project, ACTIVE_KEY).catch(() => {})
        }
      }
      // Backfill fields added after schema 2 was first cut.
      if (project && !project.delay) {
        project = { ...project, delay: { ...DEFAULT_DELAY } }
      }
      if (project && project.delay && !project.delay.routing) {
        project = {
          ...project,
          delay: { ...project.delay, routing: { ...DEFAULT_DELAY_ROUTING } },
        }
      }
      if (project && !project.reverb) {
        project = { ...project, reverb: { ...DEFAULT_REVERB } }
      }
      if (project && project.reverb && !project.reverb.routing) {
        project = {
          ...project,
          reverb: { ...project.reverb, routing: { ...DEFAULT_REVERB_ROUTING } },
        }
      }
    }

    if (project) {
      // Migrate the legacy 'hover-runner' skin id to its replacement.
      const migrateSkin = (s: unknown): Project["skin"] => {
        if (s === "earthgate" || s === "stargate" || s === "juice-squeeze") return s
        if (s === "hover-runner") return "juice-squeeze"
        return project!.skin
      }
      // Honor any skin preference cached in localStorage as a tiebreaker
      let skin = migrateSkin(project.skin)
      try {
        const ls = window.localStorage.getItem("melopan:skin")
        const migrated = migrateSkin(ls)
        if (
          migrated === "earthgate" ||
          migrated === "stargate" ||
          migrated === "juice-squeeze"
        ) {
          skin = migrated
        }
        // Rewrite localStorage if it held the legacy id.
        if (ls === "hover-runner") {
          window.localStorage.setItem("melopan:skin", "juice-squeeze")
        }
      } catch {}
      useProjectStore.setState({ project: { ...project, skin }, ready: true })
      return
    }
  } catch (err) {
    console.warn("[melopan] hydrateProject failed:", err)
  }
  // No saved project — keep the default already in the store.
  useProjectStore.setState({ ready: true })
}
