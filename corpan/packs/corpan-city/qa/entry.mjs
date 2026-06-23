/**
 * Entry harness — drives the ENTRY orchestration (stack adapter + premium
 * welcome + language chooser) against MOCK stacks, with NO Babylon world. Lets a
 * Playwright run prove:
 *   - a multi-target stack shows the chooser; picking a target sets the pair,
 *   - a single-target stack skips the chooser → correct pair, welcome reads goal,
 *   - a single-LANGUAGE stack → immersion pair (target === native), welcome reads
 *     "practice",
 *   - reactivity: bindStackReactivity fires the new default pair when the stack
 *     flips (e.g. EN-from-ES → ES-from-EN).
 *
 * The page exposes `window.__wpEntry` so the harness script can swap stacks +
 * read the resolved pair without UI scraping.
 */
import {
  resolveEntry,
  bindStackReactivity,
  samePair,
} from "/src/entry/index.ts"

const overlay = document.getElementById("wp-overlay")

/** A mock host whose stack is mutable + notifies subscribers (mirrors the real
 *  host's getStackConfig / onStackConfigChange surface). */
function mockHost(initial) {
  let stack = initial
  const listeners = new Set()
  return {
    getStackConfig: () => stack,
    onStackConfigChange: (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    __setStack: (next) => {
      stack = next
      listeners.forEach((fn) => fn(stack))
    },
  }
}

const mkStack = (languages) => ({
  activeStackId: "s-" + languages.join("-"),
  languages,
  domains: [],
  levels: [],
  rate: 1,
  textSize: "md",
  showRomanization: false,
  phrasePackIds: [],
  baseCorpusEnabled: true,
  scrollNavigationEnabled: true,
})

let lastPair = null
let reactiveFires = []

window.__wpEntry = {
  /** Run resolveEntry against a fresh mock host with the given stack. */
  async run(languages, opts = {}) {
    const host = mockHost(mkStack(languages))
    window.__wpHost = host
    const res = await resolveEntry({
      host,
      container: overlay,
      accent: "#e8b54a",
      playerName: opts.playerName ?? "Sunny Otter",
      place: "Corpan City",
      silent: opts.silent,
    })
    lastPair = res.learnerPair
    return res
  },
  /** Click the chooser tile for a given target code (drives the multi path). */
  pick(code) {
    const btns = [...overlay.querySelectorAll(".wp-entry-lang")]
    const btn = btns.find((b) => b.getAttribute("aria-label")?.toLowerCase().includes(code))
    return !!btn
  },
  /** Click the welcome CTA. */
  step() {
    const btn = overlay.querySelector(".wp-entry-btn")
    if (btn) btn.click()
    return !!btn
  },
  lastPair: () => lastPair,
  reactiveFires: () => reactiveFires,
  /** Arm reactivity against a host + initial pair, then flip the stack. */
  testReactivity(initialLangs, flippedLangs) {
    reactiveFires = []
    const host = mockHost(mkStack(initialLangs))
    let current = { target: initialLangs[1] ?? initialLangs[0], native: initialLangs[0] }
    const unsub = bindStackReactivity(
      host,
      () => current,
      (next) => {
        reactiveFires.push(next)
        current = next
      },
    )
    host.__setStack(mkStack(flippedLangs))
    unsub()
    return reactiveFires
  },
  samePair,
}

// Default: nothing runs until the harness calls __wpEntry.run(...). Signal ready.
window.__wpEntryReady = true
console.info("[wp/entry-harness] ready")
