/**
 * reducedMotion.ts — one honest read of the user's motion preference for the
 * World Detail layer (fountain shimmer, ambient population motion, atmosphere
 * breathing). Honouring `prefers-reduced-motion` is non-negotiable
 * (CLAUDE.md principles); every animated extra this domain adds gates on it.
 *
 * SSR/test-safe: returns `false` when `matchMedia` is unavailable.
 */
export function prefersReducedMotion(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
  } catch {
    return false
  }
}
