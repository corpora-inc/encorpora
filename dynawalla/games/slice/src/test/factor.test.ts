import { test } from "node:test"
import assert from "node:assert/strict"
import { buildNumberPool, chooseSplit, factorPairs, isPrime, omega } from "../sim/factor.ts"
import { Rng } from "../core/rng.ts"

test("isPrime agrees with a sieve over the whole thrown range", () => {
  const N = 400
  const sieve = new Uint8Array(N + 1).fill(1)
  sieve[0] = 0
  sieve[1] = 0
  for (let i = 2; i * i <= N; i++) {
    if (!sieve[i]) continue
    for (let j = i * i; j <= N; j += i) sieve[j] = 0
  }
  for (let n = 0; n <= N; n++) {
    assert.equal(isPrime(n), sieve[n] === 1, `isPrime(${n})`)
  }
})

test("every split is exact: a * b === n, both factors > 1", () => {
  const rng = new Rng(1234)
  for (let n = 4; n <= 200; n++) {
    if (isPrime(n)) {
      assert.equal(chooseSplit(n, () => rng.next()), null, `prime ${n} must not split`)
      continue
    }
    for (let trial = 0; trial < 40; trial++) {
      const split = chooseSplit(n, () => rng.next())
      assert.ok(split, `composite ${n} must split`)
      const [a, b] = split
      assert.ok(Number.isInteger(a) && Number.isInteger(b), `${n} → ${a},${b} must be integers`)
      assert.ok(a > 1 && b > 1, `${n} → ${a},${b} must both exceed 1`)
      assert.equal(a * b, n, `${a} × ${b} must be exactly ${n}`)
    }
  }
})

test("a cascade always terminates in primes, and omega bounds its depth", () => {
  const rng = new Rng(99)
  for (let n = 4; n <= 144; n++) {
    if (isPrime(n)) continue
    // Walk the whole tree the way the game does and count the cuts.
    let cuts = 0
    const stack = [n]
    let guard = 0
    while (stack.length && guard++ < 500) {
      const v = stack.pop() as number
      if (isPrime(v)) continue
      const s = chooseSplit(v, () => rng.next())
      assert.ok(s, `no split for ${v}`)
      cuts++
      stack.push(s[0], s[1])
    }
    assert.ok(guard < 500, `cascade for ${n} did not terminate`)
    // A tree with Ω prime leaves takes exactly Ω − 1 internal cuts.
    assert.equal(cuts, omega(n) - 1, `cut count for ${n}`)
  }
})

test("splits are biased toward balanced pairs but never exclude a thin one", () => {
  const rng = new Rng(7)
  const counts = new Map<string, number>()
  for (let i = 0; i < 4000; i++) {
    const s = chooseSplit(24, () => rng.next())
    assert.ok(s)
    counts.set(`${s[0]}x${s[1]}`, (counts.get(`${s[0]}x${s[1]}`) ?? 0) + 1)
  }
  // 24 has (2,12) (3,8) (4,6)
  assert.equal(counts.size, 3, "every pair must remain reachable")
  const balanced = counts.get("4x6") ?? 0
  const thin = counts.get("2x12") ?? 0
  assert.ok(balanced > thin * 2, `balanced ${balanced} should dominate thin ${thin}`)
})

test("factorPairs is complete and ordered", () => {
  assert.deepEqual(factorPairs(36), [
    [2, 18],
    [3, 12],
    [4, 9],
    [6, 6],
  ])
  assert.deepEqual(factorPairs(13), [])
})

test("the number pool is bucketed by omega and every bucket is non-empty up to 4", () => {
  const pool = buildNumberPool(2, 144)
  for (let w = 1; w <= 4; w++) {
    assert.ok((pool.byOmega[w] ?? []).length > 0, `bucket ${w} empty`)
    for (const n of pool.byOmega[w] ?? []) assert.equal(omega(n), w)
  }
  assert.ok(pool.primes.every(isPrime))
  assert.ok(pool.primes.includes(2) && pool.primes.includes(139))
})

test("every value in the pool is at most three digits — the legibility ceiling", () => {
  const pool = buildNumberPool(2, 144)
  for (const bucket of pool.byOmega) {
    for (const n of bucket) assert.ok(String(n).length <= 3, `${n} is too long to read at speed`)
  }
})
