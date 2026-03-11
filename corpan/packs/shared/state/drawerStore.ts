import type { LanguageInfo } from "../ui/commandDrawer"

export type DrawerState = {
  currentLanguage: string
  languages: LanguageInfo[]
  nowPlaying: { bookTitle: string; narrator?: string }
}

type Listener = (state: DrawerState, prev: DrawerState) => void

const LS_KEY = "drawerStore:currentLanguage"

function loadPersistedLanguage(): string {
  try {
    return localStorage.getItem(LS_KEY) || ""
  } catch {
    return ""
  }
}

let state: DrawerState = {
  currentLanguage: loadPersistedLanguage(),
  languages: [],
  nowPlaying: { bookTitle: "" },
}

const listeners = new Set<Listener>()

function getState(): DrawerState {
  return state
}

function setState(partial: Partial<DrawerState>): void {
  const prev = state
  state = { ...state, ...partial }

  if (partial.currentLanguage !== undefined && partial.currentLanguage !== prev.currentLanguage) {
    try {
      localStorage.setItem(LS_KEY, partial.currentLanguage)
    } catch {
      // Storage unavailable
    }
  }

  for (const cb of listeners) {
    cb(state, prev)
  }
}

function subscribe(cb: Listener): () => void {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

export const drawerStore = { getState, setState, subscribe }
