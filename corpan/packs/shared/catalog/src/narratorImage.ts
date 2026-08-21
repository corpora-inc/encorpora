/**
 * Offline-safe CSS background images (D12, offline-cache.md §1.1 row 9).
 *
 * The reader catalog renders covers/banners/avatars as CSS
 * `background-image`, which has no onerror — offline, a remote URL silently
 * paints an EMPTY box (the same bug class as the Home covers). This module
 * fixes that pattern for every such surface:
 *
 *   placeholder first (initials/tint — instantly, never blank), resolve the
 *   URL through the host's offline-cache seam when provided, preload-verify
 *   the pixels, and only then swap the real image in.
 *
 * Standalone on purpose (no sibling value imports): unit-testable with the
 * bare node:test runner, no DOM required — the target surface is duck-typed.
 */

/** The element surface `applyImageBackground` needs — a plain DOM element
 *  satisfies it; tests drive a stub object. */
export type ImageBackgroundTarget = {
  className: string
  textContent: string | null
  style: { backgroundImage: string }
  /** False once the element left the document (render() re-ran) — a late
   *  async resolve then quietly no-ops. Optional: plain stubs omit it. */
  isConnected?: boolean
}

export type ApplyImageBackgroundOptions = {
  url?: string
  /** Class list for the loaded-image state. */
  imageClass: string
  /** Class list for the no-pixels state (placeholder styling). */
  placeholderClass: string
  /** Optional placeholder text (e.g. initials) shown until pixels land. */
  placeholderText?: string
  /**
   * Optional offline-cache resolver (`hostApi.offlineCache?.imageSrc`, D12):
   * local cached copy when available, remote URL when online, undefined when
   * offline with no cached copy. Absent = resolve to the raw URL.
   */
  resolveImageUrl?: (url: string) => Promise<string | undefined>
  /** Test seam; defaults to an Image() preload probe. */
  loadImage?: (url: string) => Promise<boolean>
}

export function cssUrl(raw: string): string {
  // Escape quotes in url("…") — defensive against weird CDN paths.
  return `"${raw.replace(/"/g, '\\"')}"`
}

/** Preload-verify pixels so a CSS background-image can never silently paint
 *  an empty box. When the runtime has no Image constructor (tests/SSR),
 *  verification is skipped and the URL is trusted (legacy behavior). */
function defaultLoadImage(url: string): Promise<boolean> {
  if (typeof Image === "undefined") return Promise.resolve(true)
  return new Promise((resolve) => {
    const probe = new Image()
    probe.onload = () => resolve(true)
    probe.onerror = () => resolve(false)
    probe.src = url
  })
}

/**
 * Apply a remote image as an element's CSS background, offline-first:
 *
 *  1. The placeholder (class + text) renders IMMEDIATELY — a book card is
 *     never a blank box, with or without connectivity.
 *  2. The URL is resolved through `resolveImageUrl` when provided; an
 *     undefined resolution (offline, uncached) keeps the placeholder.
 *  3. The resolved URL is preload-verified before the background is set;
 *     unreachable pixels keep the placeholder.
 *
 * Never throws; a late resolve after a re-render no-ops via isConnected.
 */
export async function applyImageBackground(
  el: ImageBackgroundTarget,
  opts: ApplyImageBackgroundOptions,
): Promise<void> {
  el.className = opts.placeholderClass
  if (opts.placeholderText) el.textContent = opts.placeholderText
  if (!opts.url) return

  try {
    const resolved = opts.resolveImageUrl ? await opts.resolveImageUrl(opts.url) : opts.url
    if (!resolved) return // offline with no cached copy — placeholder stays
    const load = opts.loadImage ?? defaultLoadImage
    if (!(await load(resolved))) return // pixels unreachable — placeholder stays
    if (el.isConnected === false) return // screen re-rendered meanwhile
    el.className = opts.imageClass
    if (opts.placeholderText) el.textContent = ""
    el.style.backgroundImage = `url(${cssUrl(resolved)})`
  } catch {
    // Any failure keeps the placeholder — never a blank box.
  }
}
