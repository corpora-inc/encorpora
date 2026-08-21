// Frame-budget measurement. Open `/bench.html` on the dev server.
//
// It calls the REAL `drawScene` against a REAL mounted game, synchronously, in
// a tight loop — so the number is a render cost in milliseconds rather than an
// fps counter that a browser can quietly throttle behind your back. 60 fps
// means the whole frame fits in 16.67 ms, of which this game must own the
// drawing; the economy tick is measured separately because it is BigInt work
// that grows with the size of the numbers.

import { MICRO } from "../src/core/bigmath.ts"
import { addSparks, buy, newEconomy, step } from "../src/core/economy.ts"
import { mount } from "../src/mount.ts"
import { makeStubHost } from "../src/stub/host.ts"
import { drawScene } from "../src/scene/draw.ts"
import { KIND_EMBER, KIND_GOLD, KIND_SPARK } from "../src/render/particles.ts"
import type { Game } from "../src/game/types.ts"

const out = document.getElementById("out") as HTMLDivElement
const stage = document.getElementById("stage") as HTMLDivElement

const app = mount(stage, makeStubHost({ seed: 7 }))
const g = (globalThis as unknown as { __forge: Game }).__forge
const ctx = (stage.querySelector("canvas") as HTMLCanvasElement).getContext(
  "2d",
) as CanvasRenderingContext2D

function fill(n: number): void {
  g.particles.clear()
  while (g.particles.count() < n) {
    g.particles.burst({
      kind: [KIND_SPARK, KIND_EMBER, KIND_GOLD][g.particles.count() % 3] as number,
      x: 200 + Math.random() * 900,
      y: 200 + Math.random() * 600,
      n: 40,
      speed: 700,
      life: 9,
      size: 14,
    })
  }
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  return s[s.length >> 1] as number
}

function timeDraw(frames: number): { med: number; p95: number } {
  const samples: number[] = []
  for (let i = 0; i < frames; i++) {
    const t = performance.now()
    ctx.setTransform(2, 0, 0, 2, 0, 0)
    drawScene(ctx, g)
    samples.push(performance.now() - t)
  }
  samples.sort((a, b) => a - b)
  return { med: samples[samples.length >> 1] as number, p95: samples[Math.floor(samples.length * 0.95)] as number }
}

function richState(): void {
  const e = g.economy
  addSparks(e, 10n ** 15n * MICRO)
  for (let i = 0; i < 6; i++) {
    e.tiers[i].unlocked = true
    buy(e, i, [70, 48, 33, 24, 16, 9][i] as number)
    e.tiers[i].stock = BigInt([1_900_000, 32_000, 780, 64, 9, 1][i] as number) * MICRO
  }
  e.heat = 2400n * MICRO
  e.carbon = 14n
  e.marks = 9n
  g.revealed = 6
  for (let i = 0; i < 6; i++) g.rowIn[i] = 1
}

richState()

const lines: string[] = []
lines.push(`viewport ${g.layout.w}x${g.layout.h} @dpr2  ·  ${g.layout.portrait ? "portrait" : "landscape"}`)
lines.push("")

// Warm up: first frames pay for pattern and sprite generation.
fill(0)
timeDraw(30)

for (const n of [0, 300, 700, 1100]) {
  fill(n)
  const { med, p95 } = timeDraw(160)
  const pct = ((med / 16.67) * 100).toFixed(0)
  const bad = med > 16.67 ? ' class="bad"' : ""
  lines.push(
    `draw  ${String(g.particles.count()).padStart(4)} particles   median <b${bad}>${med.toFixed(2)} ms</b>   p95 ${p95.toFixed(2)} ms   (${pct}% of a 60fps frame)`,
  )
}

lines.push("")

// The economy is BigInt, so its cost depends on how big the numbers have got.
for (const mag of [6, 30, 120, 400]) {
  const e = newEconomy()
  addSparks(e, 10n ** BigInt(mag) * MICRO)
  for (let i = 0; i < 6; i++) {
    e.tiers[i].unlocked = true
    e.tiers[i].purchased = 40n
    e.tiers[i].stock = 10n ** BigInt(mag) * MICRO
  }
  const t = performance.now()
  const N = 6000
  for (let i = 0; i < N; i++) step(e, 60n)
  const per = ((performance.now() - t) / N) * 1000
  lines.push(`step  10^${String(mag).padEnd(3)} magnitude        <b>${per.toFixed(1)} µs</b> per tick`)
}

lines.push("")
lines.push(`particle pool capacity ${g.particles.capacity}, adaptive budget ${g.particles.budget}`)
out.innerHTML = lines.join("\n")
app.unmount()
