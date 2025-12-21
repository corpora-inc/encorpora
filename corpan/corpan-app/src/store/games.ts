import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export type InstalledGame = {
  id: string
  name: string
  manifestUrl: string
  version?: string
  installedAt: number
}

type GamesState = {
  games: Record<string, InstalledGame>
  addGame: (game: Omit<InstalledGame, "installedAt">) => void
  removeGame: (id: string) => void
  getGame: (id: string) => InstalledGame | undefined
  listGames: () => InstalledGame[]
}

const devGame: InstalledGame | null = import.meta.env.DEV
  ? {
      id: "endless_learner",
      name: "Endless Learner (local)",
      manifestUrl: "/games/endless-learner/manifest.json",
      version: "0.1.0",
      installedAt: Date.now(),
    }
  : null

const seedGames: Record<string, InstalledGame> = devGame
  ? { [devGame.id]: devGame }
  : {}

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
      getGame: (id) => get().games[id],
      listGames: () =>
        Object.values(get().games).sort((a, b) =>
          a.name.localeCompare(b.name)
        ),
    }),
    {
      name: "corpan-games-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ games: state.games }),
    }
  )
)
