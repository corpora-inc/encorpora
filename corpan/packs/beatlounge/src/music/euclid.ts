/**
 * beatlounge — Euclidean rhythms (Bjorklund's algorithm).
 *
 * Pure, dependency-free. Distributes `pulses` hits as evenly as possible across
 * `steps` slots — the basis of the LLM `euclid` tool and the sequencer's
 * generative fills. e.g. euclid(3, 8) → x..x..x. (the tresillo).
 */

/** Returns a boolean[] of length `steps` with `pulses` evenly-spread hits. */
export const euclid = (pulses: number, steps: number, rotate = 0): boolean[] => {
  const n = Math.max(0, Math.floor(steps))
  const k = Math.max(0, Math.min(n, Math.floor(pulses)))
  if (n === 0) return []
  if (k === 0) return new Array(n).fill(false)
  if (k === n) return new Array(n).fill(true)

  // Bjorklund: build by repeatedly distributing remainders.
  let groups: boolean[][] = []
  for (let i = 0; i < k; i++) groups.push([true])
  let remainders: boolean[][] = []
  for (let i = 0; i < n - k; i++) remainders.push([false])

  while (remainders.length > 1) {
    const count = Math.min(groups.length, remainders.length)
    const newGroups: boolean[][] = []
    for (let i = 0; i < count; i++) newGroups.push([...groups[i], ...remainders[i]])
    const newRemainders: boolean[][] = []
    if (groups.length > count) {
      for (let i = count; i < groups.length; i++) newRemainders.push(groups[i])
    } else {
      for (let i = count; i < remainders.length; i++) newRemainders.push(remainders[i])
    }
    groups = newGroups
    remainders = newRemainders
  }

  const flat = [...groups, ...remainders].flat()
  // Normalize length (defensive) and apply rotation.
  const pattern = flat.slice(0, n)
  while (pattern.length < n) pattern.push(false)
  if (rotate % n === 0) return pattern
  const r = ((rotate % n) + n) % n
  return [...pattern.slice(r), ...pattern.slice(0, r)]
}

/** Convenience: the indices (steps) at which a Euclidean pattern hits. */
export const euclidIndices = (pulses: number, steps: number, rotate = 0): number[] => {
  const p = euclid(pulses, steps, rotate)
  const out: number[] = []
  for (let i = 0; i < p.length; i++) if (p[i]) out.push(i)
  return out
}
