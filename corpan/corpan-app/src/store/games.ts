import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export type InstalledGame = {
  id: string
  name: string
  manifestUrl: string
  version?: string
  source?: "catalog" | "manual" | "platform" | "download"
  installedAt: number
}

type GamesState = {
  games: Record<string, InstalledGame>
  addGame: (game: Omit<InstalledGame, "installedAt">) => void
  removeGame: (id: string) => void
  getGame: (id: string) => InstalledGame | undefined
  listGames: () => InstalledGame[]
}

const devGames: InstalledGame[] = import.meta.env.DEV
  ? [
      {
        id: "hover_runner",
        name: "Hover Runner (local)",
        manifestUrl: "/games/hover-runner/manifest.json",
        version: "0.1.0",
        installedAt: Date.now(),
      },
      {
        id: "hanzi_atelier",
        name: "Hanzi Atelier (local)",
        manifestUrl: "/games/hanzi-atelier/manifest.json",
        version: "0.1.0",
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
