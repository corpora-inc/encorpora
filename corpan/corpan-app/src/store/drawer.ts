// src/store/drawer.ts
//
// App-level drawer state. Today there's a single drawer — the phrase-
// pack manager — but the store is shaped to grow: each drawer gets its
// own boolean + open/close pair. Lives at the app root so triggers in
// Stacks, Packs, the main experience (future), and anywhere else can
// all open the same instance without prop drilling.
//
// Session-scoped on purpose — no zustand `persist`. A drawer is a
// transient surface, not a remembered preference.

import { create } from "zustand"

type DrawerState = {
    /** Phrase-pack manager drawer. Hosted in App.tsx by
     *  `<PhrasePackDrawer />`; triggers in Stacks + Packs (today) and
     *  the main experience (0.16+) just call `openPhrasePacks()`. */
    phrasePackOpen: boolean
    openPhrasePacks: () => void
    closePhrasePacks: () => void
    setPhrasePackOpen: (open: boolean) => void

    /** Quick Settings sheet — reachable from inside ANY pack (a gear in the
     *  pack chrome) and from the host API. Compact subset of Settings
     *  (speed / languages / levels / active phrase packs) applied live. */
    quickSettingsOpen: boolean
    openQuickSettings: () => void
    closeQuickSettings: () => void
    setQuickSettingsOpen: (open: boolean) => void
}

export const useDrawerStore = create<DrawerState>()((set) => ({
    phrasePackOpen: false,
    openPhrasePacks: () => set({ phrasePackOpen: true }),
    closePhrasePacks: () => set({ phrasePackOpen: false }),
    setPhrasePackOpen: (open) => set({ phrasePackOpen: open }),

    quickSettingsOpen: false,
    openQuickSettings: () => set({ quickSettingsOpen: true }),
    closeQuickSettings: () => set({ quickSettingsOpen: false }),
    setQuickSettingsOpen: (open) => set({ quickSettingsOpen: open }),
}))
