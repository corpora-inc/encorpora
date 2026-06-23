/**
 * Narrator (Character) profile screen.
 *
 * Renders a Spotify-artist-style profile for a narrator: layered hero (banner +
 * circular avatar overlap), tagline, language coverage, bio, voice variants
 * (with provider + provenance + preview play), and a series-grouped grid of
 * every book this narrator has ever narrated.
 *
 * Designed as a pure renderer: the host (appShell, or a standalone shell)
 * passes a container + a CatalogIndex + callbacks for "open book detail" and
 * "back". This keeps it embeddable from the command drawer without coupling
 * to drawer state.
 */

import type { Character, CatalogNarrationEntry, VoiceProfile, BookEntry } from "./types"
import type { CatalogIndex } from "./catalogIndex"
import { getLanguageName, partitionLanguagesByStack } from "./searchFilter"
import {
  playPreview,
  stopPreview,
  subscribePreview,
  isPreviewing,
  type VoicePreviewState,
} from "./voicePreview"

const SVG_BACK = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`
const SVG_PLAY = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 4l14 8-14 8z"/></svg>`
const SVG_STOP = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`

export type NarratorDetailOptions = {
  characterId: string
  index: CatalogIndex
  onSelectBook: (bookId: string, preferredVoiceId?: string) => void
  onBack: () => void
  /** Optional translator for user-facing strings. */
  t?: (key: string, defaultValue: string, params?: Record<string, unknown>) => string
  /**
   * User's stack languages, in user-preferred order. Used to surface the
   * languages the user cares about first in pill lists and book cards.
   * Default `[]` disables prioritization (no stack configured / dev mock).
   */
  stackLanguages?: string[]
}

export type NarratorDetail = {
  render: () => void
  dispose: () => void
  /**
   * Update the stack-language list and re-render. Called by the app shell
   * when the user changes their stack while the profile is mounted, so the
   * pill ordering stays in sync without us tearing down the whole screen.
   */
  setStackLanguages: (next: string[]) => void
}

export function createNarratorDetail(
  container: HTMLElement,
  opts: NarratorDetailOptions,
): NarratorDetail {
  const { characterId, index, onSelectBook, onBack } = opts
  const t = opts.t ?? ((_k: string, defaultValue: string) => defaultValue)
  let bioCollapsed = true
  let showExperimental = false
  let stackLanguages: string[] = opts.stackLanguages ? [...opts.stackLanguages] : []
  /**
   * Whether the narrator-profile language list is showing every supported
   * language (true) or only the stack-matched ones (false). Defaults to
   * collapsed; the user expands via the "Show all" toggle and the choice
   * resets next time the screen mounts.
   */
  let showAllLangs = false
  const previewUnsubs: (() => void)[] = []

  function render(): void {
    cleanupPreviewSubs()
    container.innerHTML = ""

    const character = index.getCharacter(characterId)
    if (!character) {
      const empty = document.createElement("div")
      empty.className = "command-drawer-browse-empty"
      empty.textContent = t(
        "catalog.narrator.notFound",
        "This narrator is no longer available.",
      )
      container.appendChild(empty)
      return
    }

    container.appendChild(renderBackButton())
    container.appendChild(renderHero(character))
    container.appendChild(renderIdentity(character))

    const variants = collectVoiceProfiles(characterId, index)
    if (variants.length > 0) {
      container.appendChild(renderVoiceVariantsSection(variants))
    }

    container.appendChild(renderNarrationsSection(character))
  }

  function renderBackButton(): HTMLElement {
    const btn = document.createElement("button")
    btn.className = "command-drawer-detail-back"
    btn.innerHTML = `${SVG_BACK} ${t("catalog.narrator.back", "Back")}`
    btn.onclick = () => {
      stopPreview()
      onBack()
    }
    return btn
  }

  function renderHero(character: Character): HTMLElement {
    const hero = document.createElement("div")
    hero.className = "catalog-narrator-detail-hero"

    const banner = document.createElement("div")
    if (character.bannerUrl) {
      banner.className = "catalog-narrator-detail-banner"
      banner.style.backgroundImage = `url(${cssUrl(character.bannerUrl)})`
    } else {
      banner.className = "catalog-narrator-detail-banner catalog-narrator-detail-banner--placeholder"
    }
    if (character.accentColor) {
      hero.style.setProperty("--catalog-accent", character.accentColor)
    }
    hero.appendChild(banner)

    const avatar = document.createElement("div")
    if (character.avatarUrl) {
      avatar.className = "catalog-narrator-detail-avatar"
      avatar.style.backgroundImage = `url(${cssUrl(character.avatarUrl)})`
    } else {
      avatar.className = "catalog-narrator-detail-avatar catalog-narrator-detail-avatar--placeholder"
      avatar.textContent = initials(character.displayName)
    }
    hero.appendChild(avatar)

    return hero
  }

  function renderIdentity(character: Character): HTMLElement {
    const wrap = document.createElement("div")
    wrap.className = "catalog-narrator-detail-identity"

    const name = document.createElement("h2")
    name.className = "catalog-narrator-detail-name"
    name.textContent = character.displayName
    wrap.appendChild(name)

    if (character.tagline) {
      const tagline = document.createElement("p")
      tagline.className = "catalog-narrator-detail-tagline"
      tagline.textContent = character.tagline
      wrap.appendChild(tagline)
    }

    const langs = collectLanguages(character, index)
    if (langs.length > 0) {
      wrap.appendChild(renderLanguagePills(langs))
    }

    if (character.bio) {
      const bio = document.createElement("p")
      bio.className =
        "catalog-narrator-detail-bio" +
        (bioCollapsed ? " catalog-narrator-detail-bio--collapsed" : "")
      bio.textContent = character.bio
      wrap.appendChild(bio)
      // Always render the toggle if there's a bio — we can't measure overflow
      // synchronously without layout, so let the user expand it on demand.
      const toggle = document.createElement("button")
      toggle.className = "catalog-narrator-detail-bio-toggle"
      toggle.textContent = bioCollapsed
        ? t("catalog.narrator.bio.more", "Show more")
        : t("catalog.narrator.bio.less", "Show less")
      toggle.onclick = () => {
        bioCollapsed = !bioCollapsed
        render()
      }
      wrap.appendChild(toggle)
    }

    return wrap
  }

  /**
   * Render the narrator's supported-language pills, prioritizing the user's
   * stack. With 50-language narrators, a flat list is unscannable; we put
   * stack matches first with an accent style, then collapse the rest
   * behind a "Show all" toggle.
   *
   * Layout:
   *   [English] [Spanish] [Korean]   ← stack langs, accent style
   *   Show all 47 languages         ← toggle (when collapsed)
   * or, expanded:
   *   [English] [Spanish] [Korean] [Arabic] [Bengali] …  ← muted "other" style
   *   Show fewer
   */
  function renderLanguagePills(langs: string[]): HTMLElement {
    const wrap = document.createElement("div")
    wrap.className = "catalog-narrator-detail-langs"

    const { stack, other } = partitionLanguagesByStack(langs, stackLanguages)

    for (const lang of stack) {
      wrap.appendChild(makeLangPill(lang, "stack"))
    }

    // No stack overlap — render everything as plain pills (no collapse).
    if (stack.length === 0) {
      for (const lang of other) {
        wrap.appendChild(makeLangPill(lang, "plain"))
      }
      return wrap
    }

    // Stack exists. Reveal others on demand.
    if (other.length === 0) return wrap

    if (showAllLangs) {
      for (const lang of other) {
        wrap.appendChild(makeLangPill(lang, "other"))
      }
      const toggle = document.createElement("button")
      toggle.type = "button"
      toggle.className = "catalog-narrator-detail-bio-toggle"
      toggle.textContent = t("catalog.narrator.langs.showFewer", "Show fewer")
      toggle.onclick = () => {
        showAllLangs = false
        render()
      }
      wrap.appendChild(toggle)
    } else {
      const toggle = document.createElement("button")
      toggle.type = "button"
      toggle.className = "catalog-narrator-detail-bio-toggle"
      toggle.textContent = t(
        "catalog.narrator.langs.showAll",
        "Show all {{count}} languages",
        { count: langs.length },
      )
      toggle.onclick = () => {
        showAllLangs = true
        render()
      }
      wrap.appendChild(toggle)
    }
    return wrap
  }

  function makeLangPill(
    lang: string,
    kind: "stack" | "other" | "plain",
  ): HTMLElement {
    const pill = document.createElement("span")
    const mod =
      kind === "stack"
        ? " catalog-narrator-detail-lang-pill--stack"
        : kind === "other"
          ? " catalog-narrator-detail-lang-pill--other"
          : ""
    pill.className = `catalog-narrator-detail-lang-pill${mod}`
    pill.textContent = getLanguageName(lang)
    return pill
  }

  function renderVoiceVariantsSection(profiles: VoiceProfile[]): HTMLElement {
    const section = document.createElement("div")
    section.className = "catalog-narrator-detail-section"

    const title = document.createElement("div")
    title.className = "catalog-narrator-detail-section-title"
    title.textContent = t("catalog.narrator.voices", "Voice Variants")
    section.appendChild(title)

    const visible = showExperimental
      ? profiles
      : profiles.filter((v) => v.status === "active")

    if (visible.length === 0 && profiles.length > 0) {
      // All profiles are experimental/deprecated; offer the toggle directly.
      section.appendChild(renderVariantToggle(profiles.length))
      return section
    }

    const list = document.createElement("div")
    list.className = "catalog-voice-variants"
    for (const v of visible) {
      list.appendChild(renderVoiceVariant(v))
    }
    section.appendChild(list)

    const hiddenCount = profiles.length - visible.length
    if (hiddenCount > 0) {
      section.appendChild(renderVariantToggle(hiddenCount))
    }

    return section
  }

  function renderVariantToggle(hiddenCount: number): HTMLElement {
    const toggle = document.createElement("button")
    toggle.className = "catalog-narrator-detail-bio-toggle"
    toggle.textContent = showExperimental
      ? t("catalog.narrator.voices.hideExperimental", "Hide experimental")
      : t(
          "catalog.narrator.voices.showExperimental",
          "Show {{count}} experimental",
          { count: hiddenCount },
        )
    toggle.onclick = () => {
      showExperimental = !showExperimental
      render()
    }
    return toggle
  }

  function renderVoiceVariant(profile: VoiceProfile): HTMLElement {
    const row = document.createElement("div")
    row.className = "catalog-voice-variant"

    const info = document.createElement("div")
    info.className = "catalog-voice-variant-info"

    const header = document.createElement("div")
    header.className = "catalog-voice-variant-header"

    const name = document.createElement("span")
    name.className = "catalog-voice-variant-name"
    name.textContent = profile.displayName
    header.appendChild(name)

    const provider = document.createElement("span")
    provider.className = "catalog-voice-variant-provider"
    provider.textContent = profile.provider
    header.appendChild(provider)

    if (profile.status !== "active") {
      const status = document.createElement("span")
      status.className = "catalog-voice-variant-status"
      status.textContent = profile.status
      header.appendChild(status)
    }
    info.appendChild(header)

    const meta = document.createElement("div")
    meta.className = "catalog-voice-variant-meta"
    meta.textContent = describeVoiceProfile(profile, t)
    info.appendChild(meta)

    row.appendChild(info)

    const previewBtn = document.createElement("button")
    previewBtn.className = "catalog-voice-preview-btn"
    if (!profile.previewClipUrl) {
      previewBtn.disabled = true
      previewBtn.innerHTML = `${SVG_PLAY} <span>${t(
        "catalog.narrator.voices.preview.unavailable",
        "No preview",
      )}</span>`
    } else {
      const url = profile.previewClipUrl
      const updateButton = (state: VoicePreviewState) => {
        const playing = isPreviewing(profile.id)
        const loading =
          state.status === "loading" && state.voiceProfileId === profile.id
        previewBtn.classList.toggle("catalog-voice-preview-btn--playing", playing)
        if (loading) {
          previewBtn.innerHTML = `<span>${t(
            "catalog.narrator.voices.preview.loading",
            "Loading...",
          )}</span>`
        } else if (playing) {
          previewBtn.innerHTML = `${SVG_STOP} <span>${t(
            "catalog.narrator.voices.preview.stop",
            "Stop",
          )}</span>`
        } else {
          previewBtn.innerHTML = `${SVG_PLAY} <span>${t(
            "catalog.narrator.voices.preview.play",
            "Preview",
          )}</span>`
        }
      }
      const unsub = subscribePreview(updateButton)
      previewUnsubs.push(unsub)
      previewBtn.onclick = (e) => {
        e.stopPropagation()
        playPreview(profile.id, url)
      }
    }
    row.appendChild(previewBtn)

    return row
  }

  function renderNarrationsSection(character: Character): HTMLElement {
    const section = document.createElement("div")
    section.className = "catalog-narrator-detail-section"

    const title = document.createElement("div")
    title.className = "catalog-narrator-detail-section-title"
    title.textContent = t("catalog.narrator.narrations", "Narrations")
    section.appendChild(title)

    const narrations = index.getNarrationsForCharacter(character.id)
    if (narrations.length === 0) {
      const empty = document.createElement("div")
      empty.className = "command-drawer-browse-empty"
      empty.textContent = t(
        "catalog.narrator.narrations.empty",
        "No narrations published yet.",
      )
      section.appendChild(empty)
      return section
    }

    const seriesGroups = groupBookIdsBySeries(narrations, index)
    for (const sg of seriesGroups) {
      if (sg.series) {
        const seriesLabel = document.createElement("div")
        seriesLabel.className = "catalog-narrator-detail-series"
        seriesLabel.textContent = sg.series
        section.appendChild(seriesLabel)
      }
      const grid = document.createElement("div")
      grid.className = "catalog-grid"
      for (const bookId of sg.bookIds) {
        const book = index.getBook(bookId)
        if (!book) continue
        grid.appendChild(renderBookCard(book, character.id))
      }
      section.appendChild(grid)
    }

    return section
  }

  function renderBookCard(book: BookEntry, characterId: string): HTMLElement {
    const card = document.createElement("div")
    card.className = "catalog-card"
    card.onclick = () => {
      stopPreview()
      const narrations = index.getNarrationsForBook(book.bookId)
      const own = narrations.find(
        (n) => index.getCharacterForNarration(n)?.id === characterId,
      )
      onSelectBook(book.bookId, own?.voiceId)
    }

    const cover = document.createElement("div")
    if (book.coverImageUrl) {
      cover.className = "catalog-cover-thumb"
      cover.style.backgroundImage = `url(${cssUrl(book.coverImageUrl)})`
    } else {
      cover.className = "catalog-cover-thumb catalog-cover-thumb--placeholder"
      cover.textContent = initials(book.title)
    }
    card.appendChild(cover)

    const titleEl = document.createElement("div")
    titleEl.className = "catalog-card-title"
    titleEl.textContent = book.title
    card.appendChild(titleEl)

    const langs = uniqueLangs(
      index.getNarrationsForBook(book.bookId).filter(
        (n) => index.getCharacterForNarration(n)?.id === characterId,
      ),
    )
    if (langs.length > 0) {
      card.appendChild(renderBookCardLangs(langs))
    }

    return card
  }

  /**
   * Stack-first badge row for a book card on a narrator profile. Same
   * heuristic as the catalog browse card: small books render every lang,
   * larger books surface the user's stack + a "+N more" chip, and books
   * with zero stack overlap show a single "N languages" count chip.
   */
  function renderBookCardLangs(langs: string[]): HTMLElement {
    const wrap = document.createElement("div")
    wrap.className = "catalog-card-langs"

    if (langs.length <= 3) {
      // Even small books benefit from stack-first ordering.
      const { stack, other } = partitionLanguagesByStack(langs, stackLanguages)
      for (const lang of [...stack, ...other]) {
        wrap.appendChild(makeBookCardBadge(lang, "default"))
      }
      return wrap
    }

    const { stack, other } = partitionLanguagesByStack(langs, stackLanguages)

    if (stack.length === 0) {
      const count = document.createElement("span")
      count.className = "catalog-lang-badge catalog-lang-badge--count"
      count.textContent = t(
        "catalog.languages.count",
        "{{count}} languages",
        { count: langs.length },
      )
      wrap.appendChild(count)
      return wrap
    }

    // Render every stack-matched language, then a "+N more" chip for the
    // non-stack remainder. Stacks of 5–15 are common; the user's stack is
    // exactly what they care about — never truncate it.
    for (const lang of stack) {
      wrap.appendChild(makeBookCardBadge(lang, "stack"))
    }
    if (other.length > 0) {
      const more = document.createElement("span")
      more.className = "catalog-lang-badge catalog-lang-badge--more"
      more.textContent = t(
        "catalog.languages.more",
        "+{{count}} more",
        { count: other.length },
      )
      wrap.appendChild(more)
    }
    return wrap
  }

  function makeBookCardBadge(lang: string, kind: "stack" | "default"): HTMLElement {
    const badge = document.createElement("span")
    const inStack = stackLanguages.includes(lang)
    const mod = inStack || kind === "stack" ? " catalog-lang-badge--stack" : ""
    badge.className = `catalog-lang-badge${mod}`
    badge.textContent = getLanguageName(lang)
    return badge
  }

  function cleanupPreviewSubs(): void {
    for (const fn of previewUnsubs) fn()
    previewUnsubs.length = 0
  }

  function dispose(): void {
    cleanupPreviewSubs()
    stopPreview()
    container.innerHTML = ""
  }

  function setStackLanguages(next: string[]): void {
    const incoming = Array.isArray(next) ? [...next] : []
    if (
      incoming.length === stackLanguages.length &&
      incoming.every((v, i) => v === stackLanguages[i])
    ) {
      return
    }
    stackLanguages = incoming
    // Stack change can invalidate the collapsed "show all" choice — if the
    // user just added a language that was previously hidden in the "other"
    // bucket, they probably want the pills to re-render in collapsed form
    // so the new stack pill is prominent at the top.
    showAllLangs = false
    render()
  }

  return { render, dispose, setStackLanguages }
}

// ── Helpers ──

function collectVoiceProfiles(characterId: string, index: CatalogIndex): VoiceProfile[] {
  return index.voiceProfiles.filter((v) => v.characterId === characterId)
}

function collectLanguages(character: Character, index: CatalogIndex): string[] {
  if (character.supportedLanguages && character.supportedLanguages.length > 0) {
    return [...character.supportedLanguages]
  }
  return index.getCharacterLanguages(character.id)
}

function describeVoiceProfile(
  profile: VoiceProfile,
  t: (k: string, d: string, p?: Record<string, unknown>) => string,
): string {
  const parts: string[] = []
  if (profile.source.kind === "cloned") {
    if (profile.source.lengthSeconds > 0) {
      parts.push(
        t("catalog.narrator.voices.cloned", "Cloned from {{seconds}}s reference", {
          seconds: profile.source.lengthSeconds,
        }),
      )
    } else {
      parts.push(t("catalog.narrator.voices.clonedShort", "Cloned voice"))
    }
  } else {
    parts.push(t("catalog.narrator.voices.native", "Native provider voice"))
  }
  const langs = profile.supportedLanguages.length
  if (langs > 0) {
    parts.push(
      t("catalog.narrator.voices.langs", "{{count}} languages", { count: langs }),
    )
  }
  return parts.join(" · ")
}

function groupBookIdsBySeries(
  narrations: CatalogNarrationEntry[],
  index: CatalogIndex,
): { series: string; bookIds: string[] }[] {
  // Preserve first-seen order, group by series, dedupe books.
  const order: string[] = []
  const map = new Map<string, string[]>()
  const seen = new Set<string>()
  for (const n of narrations) {
    const book = index.getBook(n.bookId)
    if (!book) continue
    if (seen.has(book.bookId)) continue
    seen.add(book.bookId)
    const key = book.series ?? ""
    if (!map.has(key)) {
      map.set(key, [])
      order.push(key)
    }
    map.get(key)!.push(book.bookId)
  }
  return order.map((series) => ({ series, bookIds: map.get(series)! }))
}

function uniqueLangs(narrations: CatalogNarrationEntry[]): string[] {
  const set = new Set<string>()
  for (const n of narrations) set.add(n.language)
  return [...set].sort()
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p.charAt(0).toUpperCase()).join("")
}

function cssUrl(raw: string): string {
  // Escape parens/quotes in url() — defensive against weird CDN paths.
  return `"${raw.replace(/"/g, '\\"')}"`
}
