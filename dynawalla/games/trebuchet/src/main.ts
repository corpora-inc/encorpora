/** Standalone dev entry: the game plus the local stub host. `npm run dev`. */

import { mount } from './index.ts'
import { createStubHost } from './stubHost.ts'
import { pickSoundscape, setHostSoundscape } from '../../../packs/shared/game-soundscape/index.ts'

// The soundscape, in the harness only.
//
// The real app publishes one, so inside it the collapse, the reward and the
// horns sit in the key the whole bazaar is in. `npm run dev` has no host, and
// with no soundscape the game plays its own fixed cues — which is a real path
// worth being able to hear, so it is A/B-able rather than hard-wired:
//
//     ?soundscape=off      the game's own cues, no key
//     ?seed=41             pin a mode and a root
const params = new URLSearchParams(window.location.search)
if (params.get('soundscape') !== 'off') {
  const seed = Number(params.get('seed'))
  setHostSoundscape(pickSoundscape(Number.isFinite(seed) && seed !== 0 ? seed : 1))
}

const el = document.getElementById('app')
if (!el) throw new Error('#app missing')

const host = createStubHost({ seed: 0xc0ffee })
const handle = mount(el, host)

declare global {
  interface Window {
    __trebHost?: ReturnType<typeof createStubHost>
    __trebUnmount?: () => void
  }
}
window.__trebHost = host
window.__trebUnmount = handle.unmount
