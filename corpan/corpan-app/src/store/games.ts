import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export type InstalledGame = {
  id: string
  name: string
  manifestUrl: string
  version?: string
  description?: string
  imageUrl?: string
  source?: "catalog" | "manual" | "platform" | "download"
  installedAt: number
  /** Unix-ms timestamp of the most recent launch. Drives the Recents row
   *  in the Packs settings panel. Undefined for packs the user has never
   *  opened — those fall back to installedAt for ordering. */
  lastLaunchedAt?: number
}

type GamesState = {
  games: Record<string, InstalledGame>
  addGame: (game: Omit<InstalledGame, "installedAt">) => void
  removeGame: (id: string) => void
  /** Record that the user just launched a pack. Updates lastLaunchedAt so
   *  Recents can sort by it. Safe to call for ids that aren't installed —
   *  it's a no-op then. */
  touchLaunch: (id: string) => void
  getGame: (id: string) => InstalledGame | undefined
  listGames: () => InstalledGame[]
}

const devGames: InstalledGame[] = import.meta.env.DEV
  ? [
      {
        id: "hover_runner",
        name: "Hover Runner (local)",
        manifestUrl: "/packs/hover-runner.zip",
        version: "0.1.0",
        installedAt: Date.now(),
      },
      {
        id: "hanzipan",
        name: "Hanzipan (local)",
        manifestUrl: "/packs/hanzipan.zip",
        version: "0.3.0",
        installedAt: Date.now(),
      },
    ]
  : []

const seedGames: Record<string, InstalledGame> = devGames.reduce(
  (acc, game) => ({ ...acc, [game.id]: game }),
  {}
)

export const useGamesStore = create<GamesState>()(
  persist(
    (set, get) => ({
      games: seedGames,
      addGame: (game) => {
        set((state) => ({
          games: {
            ...state.games,
            [game.id]: {
              ...game,
              installedAt: Date.now(),
            },
          },
        }))
      },
      removeGame: (id) => {
        set((state) => {
          const next = { ...state.games }
          delete next[id]
          return { games: next }
        })
      },
      touchLaunch: (id) => {
        set((state) => {
          const existing = state.games[id]
          if (!existing) return state
          return {
            games: {
              ...state.games,
              [id]: { ...existing, lastLaunchedAt: Date.now() },
            },
          }
        })
      },
      getGame: (id) => get().games[id],
      listGames: () =>
        Object.values(get().games).sort((a, b) =>
          a.name.localeCompare(b.name)
        ),
    }),
    {
      name: "corpan-packs-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ games: state.games }),
    }
  )
)
