import { test } from "node:test"
import assert from "node:assert/strict"
import { Rng } from "./rng.ts"
import { Grid } from "./grid.ts"
import { splitDigits, tidyValue, valueBuffer } from "./digits.ts"

test("rng is deterministic for a seed and diverges for neighbours", () => {
  const a = new Rng(1234)
  const b = new Rng(1234)
  const c = new Rng(1235)
  const as: number[] = []
  const bs: number[] = []
  const cs: number[] = []
  for (let i = 0; i < 64; i++) {
    as.push(a.u32())
    bs.push(b.u32())
    cs.push(c.u32())
  }
  assert.deepEqual(as, bs)
  assert.notDeepEqual(as, cs)
})

test("rng.int stays inside the closed interval", () => {
  const r = new Rng(7)
  for (let i = 0; i < 5000; i++) {
    const v = r.int(3, 9)
    assert.ok(v >= 3 && v <= 9, `int out of range: ${v}`)
    assert.ok(Number.isInteger(v))
  }
  assert.equal(r.int(5, 5), 5)
  assert.equal(r.int(5, 2), 5)
})

test("rng.shuffle is a permutation", () => {
  const r = new Rng(99)
  const src = [0, 1, 2, 3, 4, 5, 6, 7]
  const out = r.shuffle([...src])
  assert.deepEqual([...out].sort((x, y) => x - y), src)
})

/**
 * The grid must follow the field, not the origin.
 *
 * It used to be pinned to a fixed ±9,300 world box, and ARENA's arena radius
 * passes that at a player mass of about 680. Everything outside the box clamps
 * into one edge cell, so from the third depth onward the broad phase was
 * silently the O(n²) scan it exists to replace — correct, and useless. The
 * far-from-origin case below is the one that used to degenerate.
 */
test("grid finds every body inside the query radius, wherever the field is", () => {
  const n = 400
  const r = new Rng(5)

  // Near the origin, and then a cluster 120,000 units out — the deep-depth
  // case. Both must behave identically.
  for (const [cx, cy, extent] of [
    [0, 0, 4000],
    [120_000, -84_000, 26_000],
  ] as [number, number, number][]) {
    const xs = new Float32Array(n)
    const ys = new Float32Array(n)
    const alive = new Uint8Array(n).fill(1)
    for (let i = 0; i < n; i++) {
      xs[i] = cx + r.range(-extent, extent)
      ys[i] = cy + r.range(-extent, extent)
    }
    alive[7] = 0
    const g = new Grid(62, n)
    g.build(xs, ys, alive, n, cx, cy, extent * 2.4)

    const qx = cx + 120
    const qy = cy - 350
    const qr = extent * 0.22
    const expected = new Set<number>()
    for (let i = 0; i < n; i++) {
      if (!alive[i]) continue
      if (Math.hypot((xs[i] as number) - qx, (ys[i] as number) - qy) <= qr) expected.add(i)
    }
    const got = new Set<number>()
    g.query(qx, qy, qr, (i) => got.add(i))
    for (const i of expected) assert.ok(got.has(i), `grid missed body ${i} at centre ${cx},${cy}`)
    assert.ok(!got.has(7), "grid returned a dead body")
    // …and it is actually a broad phase: a small query must not hand back the
    // whole population. This is the assertion the fixed-box version failed.
    assert.ok(expected.size > 0, "the test query matched nothing, so it proves nothing")
    assert.ok(got.size < n * 0.5, `the grid degenerated: one query returned ${got.size} of ${n}`)
  }
})

test("splitDigits survives past 2^31 — a truncation here prints a different number", () => {
  const buf = new Int32Array(12)
  const read = (v: number): string => {
    const n = splitDigits(v, buf)
    let out = ""
    for (let i = n - 1; i >= 0; i--) out += String(buf[i])
    return out
  }
  assert.equal(read(0), "0")
  assert.equal(read(7), "7")
  assert.equal(read(1090), "1090")
  assert.equal(read(-4652), "4652")
  assert.equal(read(2147483647), "2147483647")
  assert.equal(read(8030000000), "8030000000")

  // Past the buffer it must SATURATE, not truncate. Returning the low N digits
  // prints a confidently different number, which is the one failure mode this
  // function exists to rule out.
  const small = new Int32Array(4)
  const n = splitDigits(1234567, small)
  assert.equal(n, 4)
  let out = ""
  for (let i = n - 1; i >= 0; i--) out += String(small[i])
  assert.equal(out, "9999", "an over-long value truncated instead of saturating")
})

/**
 * `splitDigits` being float-safe is worth nothing if the value is already
 * wrong by the time it gets there. The renderer parks every pending numeral in
 * a buffer before it lays them out, and that buffer was a `Float32Array`:
 * 8,030,000,000 came back out as 8,030,000,128, and *every* value past 2^24
 * came back rounded. The digit extraction then did its careful, correct job on
 * the wrong number, which is the worst possible way for this to fail — there is
 * no seam at which anything looks broken.
 */
test("a numeral's value survives its own storage, and prints as itself", () => {
  const buf = valueBuffer(4)
  const digits = new Int32Array(12)
  const print = (v: number): string => {
    const n = splitDigits(v, digits)
    let out = ""
    for (let i = n - 1; i >= 0; i--) out += String(digits[i])
    return out
  }
  for (const v of [7, 1090, 999999, 16777217, 20000001, 2147483647, 8030000000]) {
    buf[1] = v
    assert.equal(buf[1], v, `the value buffer rounded ${v} to ${buf[1]}`)
    assert.equal(print(buf[1] as number), String(v), `${v} would have been drawn as a different number`)
  }
})

test("tidyValue keeps three significant figures and never returns zero", () => {
  assert.equal(tidyValue(7), 7)
  assert.equal(tidyValue(999), 999)
  assert.equal(tidyValue(4817), 4820)
  assert.equal(tidyValue(48173), 48200)
  assert.equal(tidyValue(481734), 482000)
  assert.equal(tidyValue(-4817), -4820)
  assert.equal(tidyValue(0.2), 1)
  for (let v = 1; v < 20000; v += 7) {
    const t = tidyValue(v)
    assert.ok(Number.isInteger(t), `tidyValue produced a non-integer for ${v}`)
    assert.ok(t >= 1)
  }
})
