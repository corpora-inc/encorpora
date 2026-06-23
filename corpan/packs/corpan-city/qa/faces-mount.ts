/**
 * Faces gallery harness — the CONTENT_SCALE §1 face-kit contact sheet.
 *
 * Three panels, all rendered straight to 2D canvases via `characterDraw` (no 3D
 * engine), so the FACE work can be inspected + counted:
 *
 *   1. CONTACT SHEET — a big grid of generated faces across the parametric
 *      ranges (eye/nose/face-shape/age/freckles/skin/expression). Reads warm,
 *      distinct, wholesome — never murderous/creepy/samey.
 *   2. EMOTION ROW — the SAME face under each of the 8 MOOD_BEATS (mapped to a
 *      transient emotion) + its resting baseline, proving the mood→emotion
 *      channel modulates warmth WITHOUT changing identity.
 *   3. AXIS STRIPS — one axis swept at a time (eye shapes, face shapes, ages,
 *      nose styles) so the parametric range is legible at a glance.
 *
 * Plus ONE talking NPC whose mouth is driven by a live loop (frames differ).
 *
 * Exercised by qa/faces.mjs. Exposes `window.__wpFaces` with the expression
 * tally (smirk-ratio), a per-axis distinct-render count, and a talk-mouth sampler.
 */

import { generateCharacter, ANTIGUA_1770 } from "../src/character/characterGen"
import { characterDraw, moodToEmotion } from "../src/character/characterArt"
import { MOOD_BEATS } from "../src/npc/promptProgram"
import type { CharacterSpec } from "../src/character/characterSpec"
import type { Expression } from "../src/character/characterSpec"

const ROLES = [
  "crowd", "crowd", "crowd", "crowd", "crowd", "crowd",
  "vendor", "vendor", "vendor",
  "cafe_counter", "cafe_counter",
  "tailor", "tailor",
  "traveler", "traveler",
  "npc_station", "npc_station",
  "dock", "dock",
  "smuggler", // the one sly outlier
]

document.body.style.margin = "0"
document.body.style.background = "#cfe6ec"
document.body.style.font = "11px system-ui"

const section = (title: string): HTMLDivElement => {
  const h = document.createElement("div")
  h.textContent = title
  h.style.cssText = "font:600 13px system-ui;color:#234;padding:10px 8px 2px;"
  document.body.appendChild(h)
  const grid = document.createElement("div")
  document.body.appendChild(grid)
  return grid
}

const cell = (
  grid: HTMLElement, spec: CharacterSpec, label: string, size = 120,
  pose?: Parameters<typeof characterDraw>[1],
) => {
  const c = document.createElement("div")
  c.style.cssText = "display:inline-block;vertical-align:top;background:#fff;border-radius:6px;text-align:center;padding:2px;margin:2px;"
  const canvas = document.createElement("canvas")
  const dpr = 2
  const H = size * 1.3
  canvas.width = size * dpr
  canvas.height = H * dpr
  canvas.style.width = size + "px"
  canvas.style.height = H + "px"
  const ctx = canvas.getContext("2d")!
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, size, H)
  characterDraw(spec, pose)(ctx, size, H)
  const lab = document.createElement("div")
  lab.textContent = label
  lab.style.cssText = "font-size:9px;color:#555;max-width:" + size + "px;"
  c.appendChild(canvas)
  c.appendChild(lab)
  grid.appendChild(c)
}

/* ── 1. CONTACT SHEET — 64 faces across the parametric ranges ───────────── */

const sheet = section("Contact sheet — 64 generated faces (mixed roles, full kit)")
sheet.style.cssText = "padding:0 6px;"
const SHEET_N = 64
const sheetSpecs: CharacterSpec[] = []
for (let i = 0; i < SHEET_N; i++) {
  const role = ROLES[i % ROLES.length]
  const spec = generateCharacter(role, `sheet:${i}`, ANTIGUA_1770)
  sheetSpecs.push(spec)
  cell(sheet, spec, `${spec.face.ageBand}·${spec.face.eyeShape}·${spec.face.expression}`, 110)
}

/* ── 2. EMOTION ROW — one face under every MOOD_BEAT ────────────────────── */

const moodGrid = section("Same face, every mood beat (identity preserved, emotion modulated)")
moodGrid.style.cssText = "padding:0 6px;"
const moodFace = generateCharacter("vendor", "moodface:7", ANTIGUA_1770)
// resting baseline first
cell(moodGrid, moodFace, "resting (" + moodFace.face.expression + ")", 130)
const moodEmotions: { beat: string; emotion: Expression }[] = []
for (const beat of MOOD_BEATS) {
  const emotion = moodToEmotion(beat) as Expression
  moodEmotions.push({ beat, emotion })
  cell(moodGrid, moodFace, `${beat.slice(0, 22)}… → ${emotion}`, 130, { emotion, emotionAmt: 1 })
}

/* ── 3. AXIS STRIPS — sweep one axis at a time ──────────────────────────── */

const axisGrid = section("Axis sweeps — eye shape · face shape · age · nose")
axisGrid.style.cssText = "padding:0 6px;"
const baseSpec = generateCharacter("crowd", "axisbase:1", ANTIGUA_1770)
const variant = (over: Partial<CharacterSpec["face"]>): CharacterSpec =>
  ({ ...baseSpec, face: { ...baseSpec.face, ...over } })

const eyeShapes = ["round", "almond", "wide", "soft", "upturned", "downturned"] as const
for (const s of eyeShapes) cell(axisGrid, variant({ eyeShape: s }), "eye:" + s, 96)
const faceShapes = ["round", "oval", "soft-square", "heart", "long"] as const
for (const s of faceShapes) cell(axisGrid, variant({ faceShape: s }), "face:" + s, 96)
const ages = ["child", "young", "adult", "elder"] as const
for (const s of ages) cell(axisGrid, variant({ ageBand: s, beard: s === "elder" ? "full" : "none" }), "age:" + s, 96)
const noses = ["button", "straight", "soft", "broad", "petite"] as const
for (const s of noses) cell(axisGrid, variant({ noseStyle: s }), "nose:" + s, 96)

/* ── a big TALKING npc, mouth driven over time so frames differ ─────────── */

const talkGrid = section("Live talking NPC (mouth driven)")
const talkSpec = generateCharacter("vendor", "talker:0", ANTIGUA_1770)
const talkCanvas = document.createElement("canvas")
talkCanvas.style.margin = "4px"
talkGrid.appendChild(talkCanvas)

let tPhase = 0
let sPhase = 0
const repaintTalk = (mouth: number) => {
  const W = 260, H = 340, dpr = 2
  talkCanvas.width = W * dpr
  talkCanvas.height = H * dpr
  talkCanvas.style.width = W + "px"
  talkCanvas.style.height = H + "px"
  const ctx = talkCanvas.getContext("2d")!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, W, H)
  characterDraw(talkSpec, { mouth })(ctx, W, H)
}
let lastMouth = -1
const tick = () => {
  tPhase += 0.2
  sPhase += 0.09
  const flap = 0.5 + 0.5 * Math.sin(tPhase)
  const gate = Math.max(0, Math.sin(sPhase)) ** 0.6
  const mouth = Math.max(0, Math.min(1, (0.18 + flap * 0.7) * (0.35 + gate * 0.8)))
  lastMouth = mouth
  repaintTalk(mouth)
  requestAnimationFrame(tick)
}
tick()

/* ── expression tally + distinctness for the QA assertions ──────────────── */

// large statistical sample (mixed roles weighted like a real plaza) for a
// stable smirk-ratio + an axis-coverage count, independent of the 64 shown.
const bigTally: Record<string, number> = {}
let bigAsym = 0
const N = 800
const eyeSet = new Set<string>()
const faceSet = new Set<string>()
const ageSet = new Set<string>()
const noseSet = new Set<string>()
const comboSet = new Set<string>() // distinct (eye×face×age×nose×expr) fingerprints
for (let i = 0; i < N; i++) {
  const role = ROLES[i % ROLES.length]
  const s = generateCharacter(role, `sample:${i}`, ANTIGUA_1770)
  const e = s.face.expression
  bigTally[e] = (bigTally[e] ?? 0) + 1
  if (e === "smirk" || e === "sneer") bigAsym++
  const f = s.face
  eyeSet.add(f.eyeShape ?? "")
  faceSet.add(f.faceShape ?? "")
  ageSet.add(f.ageBand ?? "")
  noseSet.add(f.noseStyle ?? "")
  comboSet.add(`${f.eyeShape}|${f.faceShape}|${f.ageBand}|${f.noseStyle}|${e}|${f.freckles}|${f.dimples}`)
}

const tally: Record<string, number> = {}
for (const s of sheetSpecs) tally[s.face.expression] = (tally[s.face.expression] ?? 0) + 1
const shownAsym = sheetSpecs.filter(
  (s) => s.face.expression === "smirk" || s.face.expression === "sneer",
).length

;(window as unknown as { __wpFaces?: unknown }).__wpFaces = {
  count: sheetSpecs.length,
  tally,
  asymmetric: shownAsym,
  asymmetricRatio: shownAsym / sheetSpecs.length,
  bigSample: N,
  bigTally,
  bigAsymmetric: bigAsym,
  bigAsymmetricRatio: bigAsym / N,
  // axis coverage proving the parametric ranges are actually exercised
  axes: {
    eyeShapes: eyeSet.size,
    faceShapes: faceSet.size,
    ageBands: ageSet.size,
    noseStyles: noseSet.size,
    distinctCombos: comboSet.size,
  },
  moods: moodEmotions,
  talkMouth: () => lastMouth,
}
