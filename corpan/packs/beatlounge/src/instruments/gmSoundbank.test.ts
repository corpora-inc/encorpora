/**
 * beatlounge — proof the GM soundfont actually MAKES SOUND.
 *
 * This is the crux. It:
 *   1. builds the procedural "beatlounge-gm" bank and serializes it to SF2 bytes,
 *   2. loads those bytes into the SAME synth core the runtime worklet uses,
 *   3. renders real audio for several distinct GM programs and asserts the
 *      output is non-silent AND that different families sound different,
 *   4. emits the committed asset to `public/soundfonts/beatlounge-gm.sf2`
 *      (so the build copies it and the runtime can fetch it).
 *
 * spessasynth_core renders offline in Node with no AudioWorklet — its
 * `process(left, right)` fills 128-sample stereo blocks, exactly the DSP that
 * runs inside the browser worklet. So a green test here == audible in the app.
 */

import { describe, it, expect } from "vitest"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { SpessaSynthProcessor, SoundBankLoader } from "spessasynth_core"
import {
  buildGmSoundBank,
  buildGmSoundFontBytes,
  GM_SOUNDFONT_ID,
} from "./gmSoundbank"
import { GM_PROGRAM_NAMES, GM_FAMILIES } from "./gmPrograms"

const SR = 22050
const BLOCK = 128

/** Render `seconds` of one note on one GM program; return the mono mixdown. */
const renderProgram = (bytes: ArrayBuffer, program: number, note: number, seconds: number) => {
  const proc = new SpessaSynthProcessor(SR)
  proc.soundBankManager.addSoundBank(SoundBankLoader.fromArrayBuffer(bytes), "main")
  proc.programChange(0, program)
  proc.noteOn(0, note, 120)

  const total = Math.floor(SR * seconds)
  const out = new Float32Array(total)
  const left = new Float32Array(BLOCK)
  const right = new Float32Array(BLOCK)
  let releasedAt = Math.floor(total * 0.6)
  for (let off = 0; off + BLOCK <= total; off += BLOCK) {
    if (off >= releasedAt) {
      proc.noteOff(0, note)
      releasedAt = Infinity
    }
    left.fill(0)
    right.fill(0)
    proc.process(left, right)
    out.set(left, off)
  }
  return out
}

const peakOf = (buf: Float32Array) => {
  let p = 0
  for (let i = 0; i < buf.length; i++) {
    const a = Math.abs(buf[i])
    if (a > p) p = a
  }
  return p
}

const rmsOf = (buf: Float32Array) => {
  let s = 0
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i]
  return Math.sqrt(s / buf.length)
}

/** Spectral-tilt proxy: ratio of high-frequency energy (first-difference, a
 *  one-pole high-pass) to total energy. Brighter timbres tilt higher. Loudness
 *  cancels in the ratio, so this compares pure timbre. */
const brightness = (buf: Float32Array) => {
  let hi = 1e-9
  let total = 1e-9
  for (let i = 1; i < buf.length; i++) {
    const d = buf[i] - buf[i - 1]
    hi += d * d
    total += buf[i] * buf[i]
  }
  return hi / total
}

describe("beatlounge-gm soundfont", () => {
  const bytes = buildGmSoundFontBytes()

  it("serializes to a non-trivial SF2 file", () => {
    expect(bytes.byteLength).toBeGreaterThan(2000)
    // RIFF header magic.
    const head = new TextDecoder().decode(new Uint8Array(bytes, 0, 4))
    expect(head).toBe("RIFF")
  })

  it("defines a preset for every GM program 0..127", () => {
    const bank = buildGmSoundBank()
    const programs = new Set(bank.presets.map((p) => p.program))
    for (let i = 0; i < 128; i++) expect(programs.has(i)).toBe(true)
  })

  it("PRODUCES SOUND for a grand piano (program 0)", () => {
    const audio = renderProgram(bytes, 0, 60, 1.0)
    expect(peakOf(audio)).toBeGreaterThan(0.02)
    expect(rmsOf(audio)).toBeGreaterThan(0.002)
  })

  it("PRODUCES SOUND across a spread of GM programs", () => {
    // One representative program per family — every one must be audible.
    for (const fam of GM_FAMILIES) {
      const program = fam.programs[0].program
      const audio = renderProgram(bytes, program, 60, 0.5)
      expect(peakOf(audio), `${fam.label} (program ${program}) was silent`).toBeGreaterThan(0.01)
    }
  })

  it("sustains a held note via the looped sample (pads/organ hold)", () => {
    // Organ family, no note-off until late — energy in the back half is real.
    const audio = renderProgram(bytes, 19, 57, 1.2) // Church Organ
    const half = Math.floor(audio.length / 2)
    const tail = audio.subarray(half, half + Math.floor(SR * 0.3))
    expect(rmsOf(tail)).toBeGreaterThan(0.002)
  })

  it("makes different families sound DIFFERENT (timbre actually varies)", () => {
    const piano = renderProgram(bytes, 0, 60, 0.5) // Piano family
    const bass = renderProgram(bytes, 32, 60, 0.5) // Bass family (darker)
    const lead = renderProgram(bytes, 80, 60, 0.5) // Synth Lead (brighter)
    const bP = brightness(piano)
    const bB = brightness(bass)
    const bL = brightness(lead)
    // Bass should be darker (fewer crossings) than the bright square lead.
    expect(bB).toBeLessThan(bL)
    // And the three are not identical waveforms.
    expect(Math.abs(bP - bB)).toBeGreaterThan(0)
    expect(Math.abs(bL - bB)).toBeGreaterThan(0)
  })

  it("the GM program-name list mirrors the soundbank preset names", () => {
    const bank = buildGmSoundBank()
    for (const p of bank.presets) {
      expect(p.name).toBe(GM_PROGRAM_NAMES[p.program])
    }
  })

  it("emits the committed asset to public/soundfonts (build copies it)", () => {
    const here = dirname(fileURLToPath(import.meta.url))
    const dest = resolve(here, "../../public/soundfonts", `${GM_SOUNDFONT_ID}.sf2`)
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, new Uint8Array(bytes))
    expect(bytes.byteLength).toBeGreaterThan(0)
  })
})
