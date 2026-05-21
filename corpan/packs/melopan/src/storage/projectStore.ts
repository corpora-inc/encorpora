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
} from "../model/project"
import {
  createDefaultProject,
  migrateSchema1To2,
  stepsForTimeSignature,
  resizeBoolSteps,
  resizeNoteSteps,
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
  /** Voice pad — apply to a specific voice track */
  setVoicePadVoice: (trackId: VoiceTrackId, voice: string) => void
  setVoicePadWord: (trackId: VoiceTrackId, word: string | null) => void
  setVoicePadPitch: (trackId: VoiceTrackId, semis: number) => void
  /** Synth (piano roll) */
  setSynthNote: (step: number, midi: number | null) => void
  clearSynthNotes: () => void
  setSynthVolume: (v: number) => void
  toggleSynthMute: () => void
  setAccidental: (rowIdx: number, value: number) => void
  /** Skin */
  setSkin: (skin: SkinId) => void
  /** Layout heights (px) for resizable panels */
  setLayout: (next: Partial<LayoutHeights>) => void
  /** Replace the whole project (e.g. on load) */
  setProject: (next: Project) => void
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
    const newLen = stepsForTimeSignature(top, bottom)
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
    }

    if (project) {
      // Honor any skin preference cached in localStorage as a tiebreaker
      let skin = project.skin
      try {
        const ls = window.localStorage.getItem("melopan:skin")
        if (ls === "earthgate" || ls === "stargate" || ls === "hover-runner") {
          skin = ls
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
