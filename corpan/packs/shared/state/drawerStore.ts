import type { LanguageInfo } from "../ui/commandDrawer"

export type DrawerState = {
  currentLanguage: string
  currentNarrationId: string
  languages: LanguageInfo[]
  nowPlaying: { bookTitle: string; narrator?: string }
}

type Listener = (state: DrawerState, prev: DrawerState) => void

const LS_KEY = "drawerStore:currentLanguage"
const LS_NARR_KEY = "drawerStore:currentNarrationId"

function loadPersistedLanguage(): string {
  try {
    return localStorage.getItem(LS_KEY) || ""
  } catch {
    return ""
  }
}

function loadPersistedNarrationId(): string {
  try {
    return localStorage.getItem(LS_NARR_KEY) || ""
  } catch {
    return ""
  }
}

let state: DrawerState = {
  currentLanguage: loadPersistedLanguage(),
  currentNarrationId: loadPersistedNarrationId(),
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

  if (partial.currentNarrationId !== undefined && partial.currentNarrationId !== prev.currentNarrationId) {
    try {
      localStorage.setItem(LS_NARR_KEY, partial.currentNarrationId)
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
