/**
 * The demo. Also the reference for how a prototype wires audio to visuals.
 *
 * The pattern to copy is `audio.onCue`: EVERY sound emits a cue carrying an
 * intensity, a weight and a haptic hint, and the visuals are driven from that
 * — not from the call site. Turn audio off with the checkbox and watch the
 * screen keep working, because the cues keep coming. That is the whole
 * accessibility story in one subscription.
 */

import { createAudio, type Cue } from "../src/index.ts"

const kit = createAudio()

// ---------------------------------------------------------------------------
// Background: a lattice of tile that lights up when sounds fire. Canvas, one
// rAF, no libraries. It is here because a silent demo of an audio kit is a
// terrible demo of an audio kit.
// ---------------------------------------------------------------------------

interface Bloom {
  x: number
  y: number
  born: number
  life: number
  power: number
  hue: string
}

const canvas = document.getElementById("bg") as HTMLCanvasElement
const g = canvas.getContext("2d")!
const blooms: Bloom[] = []
let dpr = 1

const resize = (): void => {
  dpr = Math.min(2, window.devicePixelRatio || 1)
  canvas.width = Math.floor(innerWidth * dpr)
  canvas.height = Math.floor(innerHeight * dpr)
}
resize()
addEventListener("resize", resize)

const HUES: Record<string, string> = {
  ui: "46,143,143",
  impact: "201,162,39",
  reward: "240,210,103",
  fail: "184,68,106",
  motion: "111,123,214",
  pluck: "208,138,60",
  combo: "240,210,103",
}

const famOf = (id: string): string => id.split(".")[0]

let frameMs = 0
const draw = (t: number): void => {
  const w = canvas.width
  const h = canvas.height
  g.setTransform(1, 0, 0, 1, 0, 0)
  g.fillStyle = "#0b0912"
  g.fillRect(0, 0, w, h)

  // The lattice: an 8-point star grid, the flattest possible nod to zellij.
  const cell = 78 * dpr
  g.strokeStyle = "rgba(120,100,160,0.055)"
  g.lineWidth = 1 * dpr
  g.beginPath()
  for (let x = 0; x <= w + cell; x += cell) {
    g.moveTo(x, 0)
    g.lineTo(x, h)
  }
  for (let y = 0; y <= h + cell; y += cell) {
    g.moveTo(0, y)
    g.lineTo(w, y)
  }
  for (let y = -cell; y <= h + cell; y += cell) {
    for (let x = -cell; x <= w + cell; x += cell) {
      g.moveTo(x + cell * 0.5, y)
      g.lineTo(x + cell, y + cell * 0.5)
      g.lineTo(x + cell * 0.5, y + cell)
      g.lineTo(x, y + cell * 0.5)
      g.lineTo(x + cell * 0.5, y)
    }
  }
  g.stroke()

  for (let i = blooms.length - 1; i >= 0; i--) {
    const b = blooms[i]
    const age = (t - b.born) / b.life
    if (age >= 1) {
      blooms.splice(i, 1)
      continue
    }
    // Fast attack, slow release — the same envelope as the sound it came from.
    const env = age < 0.08 ? age / 0.08 : Math.pow(1 - (age - 0.08) / 0.92, 2.2)
    const r = (60 + b.power * 320) * dpr * (0.35 + age * 1.5)
    const grad = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, r)
    grad.addColorStop(0, `rgba(${b.hue},${0.3 * env * b.power})`)
    grad.addColorStop(0.5, `rgba(${b.hue},${0.09 * env * b.power})`)
    grad.addColorStop(1, `rgba(${b.hue},0)`)
    g.fillStyle = grad
    g.beginPath()
    g.arc(b.x, b.y, r, 0, Math.PI * 2)
    g.fill()
  }
  requestAnimationFrame(draw)
}
requestAnimationFrame(draw)

/** Frame-time readout, so the perf claim is visible rather than asserted. */
let lastFrame = performance.now()
const frameTick = (): void => {
  const now = performance.now()
  frameMs = frameMs * 0.9 + (now - lastFrame) * 0.1
  lastFrame = now
  requestAnimationFrame(frameTick)
}
requestAnimationFrame(frameTick)

// ---------------------------------------------------------------------------
// The one integration point: cues in, light out.
// ---------------------------------------------------------------------------

let lastPointer = { x: innerWidth / 2, y: innerHeight * 0.45 }
addEventListener("pointerdown", (e) => (lastPointer = { x: e.clientX, y: e.clientY }))

kit.onCue((c: Cue) => {
  const el = document.querySelector<HTMLElement>(`[data-id="${CSS.escape(c.id)}"] .flash`)
  if (el) {
    el.animate([{ opacity: 0.85 }, { opacity: 0 }], {
      duration: 220 + c.weight * 600,
      easing: "cubic-bezier(.15,.7,.3,1)",
    })
  }
  blooms.push({
    x: lastPointer.x * dpr,
    y: lastPointer.y * dpr,
    born: performance.now(),
    life: 380 + c.weight * 1400,
    power: 0.25 + c.weight,
    hue: HUES[famOf(c.id)] ?? "201,162,39",
  })
  // A real build maps `c.haptic` onto tauri-plugin-haptics here. The browser
  // Vibration API is the stand-in so the mapping is exercised.
  const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }
  if (nav.vibrate) {
    const ms = { none: 0, light: 8, medium: 16, heavy: 28, success: 20, warning: 24 }[c.haptic]
    if (ms) nav.vibrate(ms)
  }
})

// ---------------------------------------------------------------------------
// Pads
// ---------------------------------------------------------------------------

interface PadSpec {
  id: string
  name: string
  desc: string
  opts?: Parameters<typeof kit.play>[1]
}

const buildPads = (host: HTMLElement, specs: PadSpec[]): void => {
  for (const s of specs) {
    const b = document.createElement("button")
    b.className = "pad"
    b.dataset.id = s.id
    b.dataset.fam = famOf(s.id)
    b.innerHTML = `<span class="flash"></span><span class="n"></span><span class="d"></span>`
    b.querySelector(".n")!.textContent = s.name
    b.querySelector(".d")!.textContent = s.desc
    const fire = (e: PointerEvent): void => {
      lastPointer = { x: e.clientX, y: e.clientY }
      // Intensity from where in the pad you hit it: a tiny thing that makes a
      // demo feel like an instrument instead of a list.
      const r = b.getBoundingClientRect()
      const i = Math.max(0.15, Math.min(1, (e.clientX - r.left) / r.width))
      kit.play(s.id, { intensity: i, ...s.opts })
    }
    b.addEventListener("pointerdown", fire)
    b.addEventListener("pointerenter", (e) => {
      if (e.buttons === 1) fire(e)
    })
    host.appendChild(b)
  }
}

buildPads(document.getElementById("padsImpact")!, [
  { id: "impact.brass", name: "Brass", desc: "8 inharmonic modes, 2.6 s ring, beating" },
  { id: "impact.tile", name: "Glazed tile", desc: "bar modes 1 · 2.74 · 5.36 · 8.9" },
  { id: "impact.stone", name: "Stone", desc: "heavy damping, all weight" },
  { id: "impact.glass", name: "Glass", desc: "high Q, 1.9 s, fragile" },
  { id: "impact.drum", name: "Darbuka", desc: "circular membrane Bessel modes" },
  { id: "impact.pot", name: "Copper pot", desc: "hollow, faintly ridiculous" },
  { id: "pluck.string", name: "Santur", desc: "Karplus-Strong + pick comb" },
  { id: "pluck.harp", name: "Rolled chord", desc: "four strings, 22 ms apart" },
])

buildPads(document.getElementById("padsLoop")!, [
  { id: "ui.tap", name: "Tap", desc: "12 ms. Heard 500 times a session." },
  { id: "ui.chunk", name: "Chunk", desc: "the confirm: wood + tile + sub" },
  { id: "ui.select", name: "Select", desc: "steps up the scale" },
  { id: "ui.toggle", name: "Toggle", desc: "two-part latch" },
  { id: "reward.bead", name: "Bead", desc: "FM bell, 3.51 ratio" },
  { id: "reward.chime", name: "Chime", desc: "two struck bells" },
  { id: "reward.unlock", name: "Unlock", desc: "mechanism, then light" },
  { id: "reward.big", name: "Jackpot", desc: "sub + gong + harp + shimmer", opts: { intensity: 1 } },
  { id: "fail.soft", name: "Not that one", desc: "a bead on cloth. Never a buzzer." },
  { id: "fail.pot", name: "Wobble", desc: "five strikes, shrinking gaps" },
  { id: "fail.retry", name: "Go on, again", desc: "down, down, up — ends open" },
  { id: "fail.lampOut", name: "Lamp out", desc: "loss of warmth, not a penalty" },
  { id: "motion.whoosh", name: "Whoosh", desc: "swept bandpass, random direction" },
  { id: "motion.arrive", name: "Arrive", desc: "swell into a tile hit" },
  { id: "motion.pop", name: "Pop", desc: "tuned, so runs make a melody" },
])

buildPads(document.getElementById("padsStress")!, [
  { id: "__storm", name: "40 in a second", desc: "watch the budget steal voices" },
  { id: "__roll", name: "Drum roll", desc: "24 strikes, accelerating" },
  { id: "__chord", name: "Big chord", desc: "8 strings at once" },
])

// ---------------------------------------------------------------------------
// Ambience + music + combo
// ---------------------------------------------------------------------------

const ambHost = document.getElementById("padsAmb")!
const beds: { id: "bazaar" | "courtyard" | "night" | "workshop"; name: string; desc: string }[] = [
  { id: "bazaar", name: "Bazaar", desc: "brown air, distant brass" },
  { id: "courtyard", name: "Courtyard", desc: "enclosed, reflective" },
  { id: "night", name: "Night", desc: "cool, almost nothing happens" },
  { id: "workshop", name: "Workshop", desc: "a metalworker, close by" },
]
let currentBed: string | null = null
for (const b of beds) {
  const el = document.createElement("button")
  el.className = "pad"
  el.dataset.fam = "ui"
  el.innerHTML = `<span class="flash"></span><span class="n"></span><span class="d"></span>`
  el.querySelector(".n")!.textContent = b.name
  el.querySelector(".d")!.textContent = b.desc
  el.addEventListener("pointerdown", () => {
    currentBed = currentBed === b.id ? null : b.id
    kit.ambience(currentBed as never)
    for (const other of ambHost.querySelectorAll<HTMLElement>(".pad")) {
      other.style.borderColor = ""
    }
    if (currentBed) el.style.borderColor = "var(--brass)"
  })
  ambHost.appendChild(el)
}

let streak = 0
const streakEl = document.getElementById("streakN")!
document.getElementById("comboHit")!.addEventListener("pointerdown", (e) => {
  lastPointer = { x: (e as PointerEvent).clientX, y: (e as PointerEvent).clientY }
  streak++
  streakEl.textContent = String(streak)
  kit.combo(streak)
})
document.getElementById("comboReset")!.addEventListener("pointerdown", () => {
  streak = 0
  streakEl.textContent = "0"
  kit.resetCombo()
  kit.play("ui.back")
})

let musicOn = false
const musicBtn = document.getElementById("musicToggle") as HTMLButtonElement
musicBtn.addEventListener("pointerdown", () => {
  musicOn = !musicOn
  if (musicOn) kit.music.start()
  else kit.music.stop()
  musicBtn.textContent = musicOn ? "Stop score" : "Start score"
})
const intensity = document.getElementById("intensity") as HTMLInputElement
const intensityV = document.getElementById("intensityV")!
intensity.addEventListener("input", () => {
  const v = Number(intensity.value) / 100
  intensityV.textContent = v.toFixed(2)
  kit.music.setIntensity(v)
})

document.getElementById("enabled")!.addEventListener("change", (e) => {
  kit.setEnabled((e.target as HTMLInputElement).checked)
})

// ---------------------------------------------------------------------------
// Stress buttons (handled here, not as presets)
// ---------------------------------------------------------------------------

const storm = (): void => {
  const ids = ["ui.tap", "impact.tile", "reward.bead", "pluck.string", "impact.glass", "combo"]
  for (let i = 0; i < 40; i++) {
    kit.play(ids[i % ids.length], { delay: i * 0.025, intensity: 0.4 + (i % 6) * 0.1 })
  }
}
const roll = (): void => {
  for (let i = 0; i < 24; i++) {
    kit.play("impact.drum", { delay: Math.pow(i / 24, 1.6) * 1.6, intensity: 0.35 + i * 0.026 })
  }
}
const chord = (): void => {
  for (let i = 0; i < 8; i++) {
    kit.play("pluck.string", { delay: i * 0.006, semitones: [0, 4, 7, 12, 16, 19, 24, 28][i], intensity: 0.8 })
  }
}
document.querySelector('[data-id="__storm"]')!.addEventListener("pointerdown", storm)
document.querySelector('[data-id="__roll"]')!.addEventListener("pointerdown", roll)
document.querySelector('[data-id="__chord"]')!.addEventListener("pointerdown", chord)

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

const rTier = document.getElementById("rTier")!
const rVoices = document.getElementById("rVoices")!
const rLat = document.getElementById("rLat")!
const rFrame = document.getElementById("rFrame")!
const mpeak = document.getElementById("mpeak") as HTMLElement

document.getElementById("start")!.addEventListener("click", async () => {
  await kit.init()
  await kit.resume()
  document.getElementById("gate")!.setAttribute("hidden", "")
  document.getElementById("stage")!.removeAttribute("hidden")

  const s = kit.stats
  rTier.textContent = `${kit.tier}${s.worklets ? "" : " (no worklet)"}`
  rLat.textContent = `${Math.round((s.baseLatency + s.outputLatency) * 1000 + 4)} ms`

  // A real output meter, tapped off the master with the kit's own meter
  // processor. Nothing here is a fake animation of "audio is happening".
  try {
    const meter = new AudioWorkletNode(kit.ctx, "dw-meter", { numberOfInputs: 1, numberOfOutputs: 1 })
    const sink = kit.ctx.createGain()
    sink.gain.value = 0
    for (const b of ["sfx", "ui", "music", "ambience"] as const) kit.bus(b).connect(meter)
    meter.connect(sink)
    sink.connect(kit.ctx.destination)
    let held = 0
    meter.port.onmessage = (e: MessageEvent) => {
      const d = e.data as { peak: number }
      held = Math.max(d.peak, held * 0.82)
      mpeak.style.right = `${Math.max(0, 100 - Math.min(1, held) * 100)}%`
    }
  } catch {
    /* no worklet on this device; the meter is decoration, the sound is not */
  }

  setInterval(() => {
    rVoices.textContent = String(kit.stats.activeVoices)
    rFrame.textContent = `${frameMs.toFixed(1)} ms`
  }, 200)

  kit.play("reward.unlock", { intensity: 0.8 })
  kit.ambience("bazaar")
  currentBed = "bazaar"
  ;(ambHost.querySelector(".pad") as HTMLElement).style.borderColor = "var(--brass)"
})
