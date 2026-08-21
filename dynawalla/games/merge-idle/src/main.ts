/**
 * Standalone dev entry. `npm run dev` and play.
 *
 *   ?seed=<text>   reproducible question stream
 *   ?debug=1       fps / particle count / answer-path latency in the corner
 *   ?tier=low|mid|ultra   force a quality tier
 *   ?rm=1          force prefers-reduced-motion on
 *   ?wipe=1        clear the save before starting
 */

import { mount } from './index.ts'
import { makeStubHost } from './stubHost.ts'
import { hashSeed } from './core/rng.ts'
import { SAVE_KEY } from './core/save.ts'

const params = new URLSearchParams(location.search)
if (params.get('wipe') === '1') {
  try {
    localStorage.removeItem(SAVE_KEY)
  } catch (e) {
    console.warn('[abyssal-bloom] could not wipe the save', e)
  }
}

const seedText = params.get('seed')
const host = makeStubHost({
  seed: seedText ? hashSeed(seedText) : 0x5eed1e,
  forceReducedMotion: params.get('rm') === '1',
  onReport: (r) => {
    console.log(
      `[report] ${r.questionId} ${r.correct ? 'CORRECT' : 'wrong'} answered=${r.answered} ${r.ms}ms`,
    )
  },
})

const root = document.getElementById('app')
if (!root) throw new Error('merge-idle: #app is missing from index.html')
const handle = mount(root, host)

// QA hook: the shot harness drives the game with a synthetic clock and pulls
// the canvases out. Never present in a pack build — `main.ts` is dev-only.
;(window as unknown as { __abyssalBloom?: unknown }).__abyssalBloom = { handle, host }
