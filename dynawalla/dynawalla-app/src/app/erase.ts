// "Erase everything", done completely.
//
// The parent's control, and the one operation in this app that must not be
// half-performed. Clearing the keys alone leaves every store in memory holding
// the numbers it had a second ago, so the screen keeps showing a construction
// that is no longer on disk — the worst possible answer to a parent asking
// whether it is gone. Resetting the stores alone leaves the keys, which is
// worse: it looks erased and is not.
//
// So: disk first, then every singleton back to its initial state, then the
// per-learner cache dropped so the next read builds them empty. The store
// resets also re-write their own keys with the default values, which is
// correct — that is genuinely the state of the app afterwards.

import { DEFAULT_PROFILE_ID, forgetEverything } from "./profile.ts"
import { forgetCachedStores } from "./stores.ts"
import { useThemeStore } from "./theme.ts"
import { useProfiles } from "../profiles/store.ts"
import { useSettings, DEFAULT_SETTINGS } from "../settings/store.ts"
import { usePacks } from "../packs/registry.ts"

export function eraseEverything(): void {
  forgetEverything()
  useProfiles.setState({
    profiles: [{ id: DEFAULT_PROFILE_ID, name: "" }],
    currentId: DEFAULT_PROFILE_ID,
  })
  useSettings.setState({ ...DEFAULT_SETTINGS })
  // The theme is a device preference rather than a child's data, so it is the
  // one that looks skippable — and skipping it leaves the app painted in a
  // theme whose key has just been deleted, which reverts by itself at the next
  // launch. Erased means erased, and the screen has to agree with the disk.
  useThemeStore.setState({ mode: "system" })
  usePacks.setState({ installed: [] })
  forgetCachedStores()
}
