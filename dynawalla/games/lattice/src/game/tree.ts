// THE FACTOR TREE — the shape the hint is drawn from.
//
// `72` hangs at the top. Under it, `8` and `9`. Under the `8`, `2` and `4`;
// under the `4`, `2` and `2`. It is the same object the arena already makes a
// child build with a trigger finger — `splitPair` is the very function a shot
// uses — except that here the whole thing is built at once, in memory, so it
// can be drawn.
//
// **Nothing in this file is allowed to lie.** A hint that shows a tree whose
// leaves do not multiply back to its root is worse than no hint at all: a child
// would sweep exactly what they were shown, fly into the resonator, and be
// refused by a game that told them to do it. `hint.test.ts` therefore checks the
// generator as a *property*, over every target the ladder can serve and many
// seeds: every node is the exact product of its two children, every leaf is
// prime, and the leaves are exactly `primeFactors(root)`.
//
// Everything here is integer arithmetic on values under 1000, and there is no
// clock, no canvas and no randomness beyond the seeded `Rng` handed in.

import type { Rng } from "../core/rng.ts"
import { isPrime, primeFactors, productOf, splitPair } from "./factor.ts"

export type TreeNode = {
  readonly value: number
  /** `null` at a prime. A prime does not go — that is the whole game. */
  readonly children: readonly [TreeNode, TreeNode] | null
}

/**
 * Build the factor tree of `n`.
 *
 * The splits come from `splitPair`, which is the arena's own: it prefers the
 * pair nearest the square root, so the tree is balanced rather than a stalk and
 * `72` comes apart as `8 × 9` instead of `2 × 36`. That matters twice over — a
 * balanced tree is shallower, so it fits on a phone, and it is the shape the
 * child has been watching husks make all session.
 *
 * A prime returns a single node with no children, which is not a degenerate
 * case to be guarded around: it is the wall, and drawing it as one lonely
 * numeral with nothing under it is the clearest statement of the wall the game
 * can make.
 */
export function factorTree(n: number, rng: Rng): TreeNode {
  if (!Number.isInteger(n) || n < 2) {
    // Loud rather than silent. Every caller draws from `primeFactors`-legal
    // targets, so this is a wiring mistake if it ever happens.
    console.error("[lattice] a factor tree was asked for of something that is not a number ≥ 2", n)
    return { value: 2, children: null }
  }
  const pair = splitPair(n, rng)
  if (!pair) return { value: n, children: null }
  return { value: n, children: [factorTree(pair[0], rng), factorTree(pair[1], rng)] }
}

/** The leaves, left to right. By construction these are exactly the primes. */
export function leavesOf(node: TreeNode): number[] {
  if (!node.children) return [node.value]
  return [...leavesOf(node.children[0]), ...leavesOf(node.children[1])]
}

/**
 * A tree flattened into rows and columns, ready to be drawn.
 *
 * `u` is a horizontal position in **leaf slots**, not pixels: leaves take
 * consecutive slots left to right and every parent sits at the midpoint of its
 * two children, which is the ordinary tidy-tree layout and the reason the
 * drawing never has to measure anything. The renderer scales `u` and `depth`
 * into whatever box it was given.
 */
export type PlacedNode = {
  readonly value: number
  readonly prime: boolean
  /** Rows from the root. The root is 0. */
  readonly depth: number
  /** Horizontal position in leaf slots, `0 .. columns - 1`. */
  readonly u: number
  /** Index of this node's parent, or `-1` at the root. */
  readonly parent: number
  /** Indices of this node's two children, or `null` at a leaf. */
  readonly kids: readonly [number, number] | null
}

export type Placed = {
  /** Pre-order: the root is always index 0. */
  readonly nodes: readonly PlacedNode[]
  /** How many leaf slots wide the tree is. */
  readonly columns: number
  /** How many rows deep it is. */
  readonly rows: number
  /** Indices of the leaves, left to right. */
  readonly leaves: readonly number[]
}

export function placeTree(root: TreeNode): Placed {
  type Mutable = { -readonly [K in keyof PlacedNode]: PlacedNode[K] }
  const nodes: Mutable[] = []
  const leaves: number[] = []
  let slot = 0
  let deepest = 0

  const walk = (node: TreeNode, depth: number, parent: number): number => {
    const index = nodes.length
    nodes.push({
      value: node.value,
      prime: isPrime(node.value),
      depth,
      u: 0,
      parent,
      kids: null,
    })
    if (depth > deepest) deepest = depth
    const self = nodes[index] as Mutable
    if (!node.children) {
      self.u = slot
      slot += 1
      leaves.push(index)
      return index
    }
    const a = walk(node.children[0], depth + 1, index)
    const b = walk(node.children[1], depth + 1, index)
    self.kids = [a, b]
    self.u = ((nodes[a] as Mutable).u + (nodes[b] as Mutable).u) / 2
    return index
  }

  walk(root, 0, -1)
  return { nodes, columns: Math.max(1, slot), rows: deepest + 1, leaves }
}

/** The product of a placed tree's leaves. Should always be the root. */
export function leafProduct(placed: Placed): number {
  return productOf(placed.leaves.map((i) => (placed.nodes[i] as PlacedNode).value))
}

/**
 * Is `n`'s tree the one the game would draw for it?
 *
 * Used by the property test rather than by the game: the leaves are exactly
 * `primeFactors(n)` as a multiset, which is the one claim the whole hint rests
 * on.
 */
export function treeIsHonest(n: number, root: TreeNode): boolean {
  if (root.value !== n) return false
  const want = primeFactors(n).slice().sort((a, b) => a - b)
  const got = leavesOf(root).sort((a, b) => a - b)
  if (want.length !== got.length) return false
  for (let i = 0; i < want.length; i++) {
    if (want[i] !== got[i]) return false
  }
  return everyNodeIsItsChildren(root)
}

function everyNodeIsItsChildren(node: TreeNode): boolean {
  if (!node.children) return isPrime(node.value)
  const [a, b] = node.children
  if (a.value * b.value !== node.value) return false
  if (a.value < 2 || b.value < 2) return false
  return everyNodeIsItsChildren(a) && everyNodeIsItsChildren(b)
}
