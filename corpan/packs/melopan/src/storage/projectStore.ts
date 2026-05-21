import { create } from "zustand"
import { openDB, type IDBPDatabase } from "idb"
import type { Project, DrumTrackId, SkinId } from "../model/project"
import { createDefaultProject } from "../model/project"

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
  /** Mutate one step on a track */
  toggleStep: (trackId: DrumTrackId, step: number) => void
  /** Track-level volume */
  setTrackVolume: (trackId: DrumTrackId, v: number) => void
  toggleMute: (trackId: DrumTrackId) => void
  /** Top-bar controls */
  setBpm: (bpm: number) => void
  setMasterVolume: (v: number) => void
  setTimeSignature: (top: number, bottom: number) => void
  /** Voice pad */
  setVoicePadWord: (word: string | null) => void
  setVoicePadVoice: (voice: string) => void
  setVoicePadPitch: (semis: number) => void
  /** Synth (piano roll) */
  setSynthNote: (step: number, midi: number | null) => void
  clearSynthNotes: () => void
  setSynthVolume: (v: number) => void
  toggleSynthMute: () => void
  /** Skin */
  setSkin: (skin: SkinId) => void
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

export const useProjectStore = create<State>((set) => ({
  project: createDefaultProject(),
  ready: false,

  toggleStep: (trackId, step) => set((s) => {
    const next = bumpUpdate({
      ...s.project,
      tracks: s.project.tracks.map((t) =>
        t.id === trackId
          ? { ...t, steps: t.steps.map((on, i) => (i === step ? !on : on)) }
          : t
      ),
    })
    persistDebounced(next)
    return { project: next }
  }),

  setTrackVolume: (trackId, v) => set((s) => {
    const next = bumpUpdate({
      ...s.project,
      tracks: s.project.tracks.map((t) =>
        t.id === trackId ? { ...t, volume: Math.max(0, Math.min(1, v)) } : t
      ),
    })
    persistDebounced(next)
    return { project: next }
  }),

  toggleMute: (trackId) => set((s) => {
    const next = bumpUpdate({
      ...s.project,
      tracks: s.project.tracks.map((t) =>
        t.id === trackId ? { ...t, mute: !t.mute } : t
      ),
    })
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
    const next = bumpUpdate({ ...s.project, timeSignature: [top, bottom] as [number, number] })
    persistDebounced(next)
    return { project: next }
  }),

  setVoicePadWord: (word) => set((s) => {
    const next = bumpUpdate({
      ...s.project,
      voicePad: { ...s.project.voicePad, word },
    })
    persistDebounced(next)
    return { project: next }
  }),

  setVoicePadVoice: (voice) => set((s) => {
    const next = bumpUpdate({
      ...s.project,
      voicePad: { ...s.project.voicePad, voice },
    })
    persistDebounced(next)
    return { project: next }
  }),

  setVoicePadPitch: (semis) => set((s) => {
    const next = bumpUpdate({
      ...s.project,
      voicePad: { ...s.project.voicePad, pitchSemis: Math.max(-24, Math.min(24, semis)) },
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

  setSkin: (skin) => set((s) => {
    try { window.localStorage.setItem("melopan:skin", skin) } catch {}
    const next = bumpUpdate({ ...s.project, skin })
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
    const saved = await db.get(STORE, ACTIVE_KEY) as Project | undefined
    if (saved && saved.schema === 1) {
      // Honor any skin preference cached in localStorage as a tiebreaker
      let skin = saved.skin
      try {
        const ls = window.localStorage.getItem("melopan:skin")
        if (ls === "earthgate" || ls === "stargate" || ls === "hover-runner") {
          skin = ls
        }
      } catch {}
      useProjectStore.setState({ project: { ...saved, skin }, ready: true })
      return
    }
  } catch (err) {
    console.warn("[melopan] hydrateProject failed:", err)
  }
  // No saved project — keep the default already in the store.
  useProjectStore.setState({ ready: true })
}
