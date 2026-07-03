// src/journey/store.ts — the `corpan-journey-v1` zustand store (feed-ux §2.1).
//
// META ONLY. Engine per-item state (ItemCards, review log) is IndexedDB
// LARGE tier (D5) — never here. ~300 B per enrolled course + settings.
//
// NOTE for W10: house convention keeps stores in src/store/; this file is
// a 1:1 move candidate to src/store/journey.ts (W4's exclusive path set is
// src/journey/**, so it lands here first — no logic change needed to move).

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export type AdvanceMode = "swipe" | "auto"
export type JuiceIntensity = "full" | "reduced" | "minimal"

export type CourseKey = string // `${stackId}::${courseId}` e.g. "abc123::journey_en"
export const courseKeyOf = (stackId: string, courseId: string): CourseKey =>
  `${stackId}::${courseId}`

export interface JourneyCourseMeta {
  enrolledAt: string // ISO
  // Placement
  placementDone: boolean
  placementDeclined?: boolean
  /** How many times the placement offer was declined (2 ⇒ placementDeclined). */
  placementDeclines: number
  // Path position (display only — engine owns truth; this is the resume hint)
  arcId: string | null
  unitId: string | null
  // Session bookkeeping
  sessionCounter: number
  lastCardAt: string | null // ISO
  cardsToday: { day: string; count: number }
  checkpointCountToday: { day: string; count: number }
  // Streak v2 (journey-scoped economy)
  restDayTokens: number // 0..2
  restDaysGrantedAt: string[] // localDay of each grant (audit)
  restDaysUsed: string[] // localDays covered by a token
  repair: { offeredAt: string; deadlineDay: string; checkpointsDone: number; length: number } | null
  /** Streak length restored by a completed repair (merged into display). */
  repairedLength: number
  // Zeigarnik tease persisted across sessions
  nextTease: string | null
}

export const localDayOf = (d: Date): string => {
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${m}-${day}`
}

const emptyCourseMeta = (nowIso: string): JourneyCourseMeta => ({
  enrolledAt: nowIso,
  placementDone: false,
  placementDeclines: 0,
  arcId: null,
  unitId: null,
  sessionCounter: 0,
  lastCardAt: null,
  cardsToday: { day: "", count: 0 },
  checkpointCountToday: { day: "", count: 0 },
  restDayTokens: 0,
  restDaysGrantedAt: [],
  restDaysUsed: [],
  repair: null,
  repairedLength: 0,
  nextTease: null,
})

type JourneyState = {
  byCourse: Record<CourseKey, JourneyCourseMeta>
  /** "Showed up" days (localDay strings, ring-capped at 400). Global across
   *  courses — a streak measures the person, not the course. Feed-ux §1.8
   *  places this set in store/progress.ts (additive `learningDays`); until
   *  W10 lands that seam, this is the one source streakV2 reads. */
  learningDays: string[]
  // Surface settings (global, not per-course)
  advanceMode: AdvanceMode
  juiceIntensity: JuiceIntensity
  soundsEnabled: boolean
  streakPactAnswered: boolean

  // Actions
  enroll: (key: CourseKey) => void
  updateCourse: (key: CourseKey, patch: Partial<JourneyCourseMeta>) => void
  noteCardCompleted: (key: CourseKey, day?: string) => void
  noteCheckpoint: (key: CourseKey, day?: string) => void
  recordLearningDay: (day?: string) => void
  setAdvanceMode: (m: AdvanceMode) => void
  setJuiceIntensity: (j: JuiceIntensity) => void
  setSoundsEnabled: (on: boolean) => void
  setStreakPactAnswered: (b: boolean) => void
  grantRestDay: (key: CourseKey, day?: string) => void
  consumeRestDay: (key: CourseKey, day: string) => boolean
}

const LEARNING_DAY_CAP = 400

export const useJourneyStore = create<JourneyState>()(
  persist(
    (set, get) => ({
      byCourse: {},
      learningDays: [],
      advanceMode: "swipe",
      juiceIntensity: "full",
      soundsEnabled: true,
      streakPactAnswered: false,

      enroll: (key) =>
        set((s) =>
          s.byCourse[key]
            ? s
            : { byCourse: { ...s.byCourse, [key]: emptyCourseMeta(new Date().toISOString()) } },
        ),

      updateCourse: (key, patch) =>
        set((s) => {
          const prev = s.byCourse[key] ?? emptyCourseMeta(new Date().toISOString())
          return { byCourse: { ...s.byCourse, [key]: { ...prev, ...patch } } }
        }),

      noteCardCompleted: (key, day) => {
        const today = day ?? localDayOf(new Date())
        const prev = get().byCourse[key] ?? emptyCourseMeta(new Date().toISOString())
        const count = prev.cardsToday.day === today ? prev.cardsToday.count + 1 : 1
        get().updateCourse(key, {
          cardsToday: { day: today, count },
          lastCardAt: new Date().toISOString(),
        })
      },

      noteCheckpoint: (key, day) => {
        const today = day ?? localDayOf(new Date())
        const prev = get().byCourse[key] ?? emptyCourseMeta(new Date().toISOString())
        const count = prev.checkpointCountToday.day === today ? prev.checkpointCountToday.count + 1 : 1
        get().updateCourse(key, { checkpointCountToday: { day: today, count } })
      },

      recordLearningDay: (day) => {
        const today = day ?? localDayOf(new Date())
        set((s) => {
          if (s.learningDays.includes(today)) return s
          const next = [...s.learningDays, today]
          if (next.length > LEARNING_DAY_CAP) next.splice(0, next.length - LEARNING_DAY_CAP)
          return { learningDays: next }
        })
      },

      setAdvanceMode: (m) => set({ advanceMode: m }),
      setJuiceIntensity: (j) => set({ juiceIntensity: j }),
      setSoundsEnabled: (on) => set({ soundsEnabled: on }),
      setStreakPactAnswered: (b) => set({ streakPactAnswered: b }),

      grantRestDay: (key, day) => {
        const prev = get().byCourse[key]
        if (!prev || prev.restDayTokens >= 2) return
        get().updateCourse(key, {
          restDayTokens: prev.restDayTokens + 1,
          restDaysGrantedAt: [...prev.restDaysGrantedAt, day ?? localDayOf(new Date())],
        })
      },

      consumeRestDay: (key, day) => {
        const prev = get().byCourse[key]
        if (!prev || prev.restDayTokens <= 0) return false
        if (prev.restDaysUsed.includes(day)) return true
        get().updateCourse(key, {
          restDayTokens: prev.restDayTokens - 1,
          restDaysUsed: [...prev.restDaysUsed, day],
        })
        return true
      },
    }),
    {
      name: "corpan-journey-v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        byCourse: s.byCourse,
        learningDays: s.learningDays,
        advanceMode: s.advanceMode,
        juiceIntensity: s.juiceIntensity,
        soundsEnabled: s.soundsEnabled,
        streakPactAnswered: s.streakPactAnswered,
      }),
      migrate: (state: unknown, _version: number) => state as JourneyState, // v1 no-op
    },
  ),
)

/** Default juice intensity derivation (feed-ux §1.5): kid → full, adult
 *  learner → reduced. Called once at enroll by the surface. */
export function defaultJuiceIntensity(
  userClass: string | null,
  ageBand: string | null,
): JuiceIntensity {
  if (userClass === "learner" && (ageBand === "adult" || ageBand === "senior")) return "reduced"
  return "full"
}
