// The one world the app has, for the one profile it has.
//
// A module-level instance beside the factory rather than inside it, the same
// shape `src/work/` uses for progress: the factory is what `Q-12` needs to
// build three of, and this is what the app reads. The M9 profile switcher
// replaces this line and nothing else.

import { DEFAULT_PROFILE_ID, storageKey } from "../app/profile.ts"
import { createWorldStore } from "./store.ts"

export const worldStore = createWorldStore(storageKey(DEFAULT_PROFILE_ID, "world"))
