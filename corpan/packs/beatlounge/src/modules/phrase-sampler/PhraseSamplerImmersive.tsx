/**
 * beatlounge — phrase-sampler IMMERSIVE view: the elite corpus browser.
 *
 * Layout (calm, glanceable, touch-first):
 *   - a search field (debounced) + a 🎲 randomize button,
 *   - facet chips (level + domain) that filter the result feed,
 *   - a VIRTUALIZED result list: target text big, romanization + native gloss
 *     under it, a ▸ audition button (hostApi.speak), and a ⊕ place button that
 *     runs the pipeline to drop the phrase as a sampler track on the grid,
 *   - a mode toggle (stack = one word up the scale / scatter = phrase across).
 *
 * The list is windowed (only the visible rows render) so 25k phrases scroll at
 * 60fps. Heavy work (audio resolution) is async + happens on "place" only.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import type { EntryOut } from "../../sdk/types"
import { Glyph } from "../../bl-ui"
import { applyCommands } from "../runAction"
import type { AudioSource } from "../../phrase/audioSource"
import {
  buildClip,
  clipToCommands,
  phraseLanguageCodes,
  resolvePhraseContent,
  type ClipMode,
} from "../../phrase/pipeline"

const ROW_HEIGHT = 92
const OVERSCAN = 4
const SEARCH_DEBOUNCE_MS = 220
const PAGE = 60

interface Props {
  host: BeatloungeHost
  store: BeatloungeStore
  audioSource: AudioSource
  /** Lifted state so the tile reflects the last-placed phrase. */
  onPlaced: (entry: EntryOut, summary: string) => void
}

const ALL_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const

export const PhraseSamplerImmersive = ({ host, store, audioSource, onPlaced }: Props) => {
  const hostApi = host.hostApi
  const stack = hostApi.getStackConfig()
  const languages = stack.languages
  const langCodes = useMemo(() => phraseLanguageCodes(languages), [languages])

  const [query, setQuery] = useState("")
  const [debounced, setDebounced] = useState("")
  const [level, setLevel] = useState<string | null>(null)
  const [domain, setDomain] = useState<string | null>(null)
  const [mode, setMode] = useState<ClipMode>("stack")
  const [entries, setEntries] = useState<EntryOut[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const reqSeq = useRef(0)

  // Debounce the search box.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [query])

  const domains = stack.domains ?? []

  // Fetch entries on query / facet change (search OR random feed).
  const fetchEntries = useCallback(async () => {
    const seq = ++reqSeq.current
    setLoading(true)
    try {
      let list: EntryOut[] = []
      const levels = level ? [level] : undefined
      const dom = domain ? [domain] : undefined
      if (debounced && hostApi.searchEntriesByText) {
        list = await hostApi.searchEntriesByText({
          text: debounced,
          languageCodes: langCodes,
          limit: PAGE,
        })
      } else if (hostApi.getRandomEntries) {
        list = await hostApi.getRandomEntries({
          count: PAGE,
          languageCodes: langCodes,
          levels,
          domains: dom,
        })
      }
      // Client-side facet narrowing on the search path (search lacks filters).
      if (debounced) {
        list = list.filter(
          (e) =>
            (!level || e.level === level) &&
            (!domain || (e.domains ?? []).includes(domain))
        )
      }
      if (seq === reqSeq.current) setEntries(list)
    } catch (err) {
      console.warn("[beatlounge/phrase-sampler] fetch failed:", err)
      if (seq === reqSeq.current) setEntries([])
    } finally {
      if (seq === reqSeq.current) setLoading(false)
    }
  }, [debounced, level, domain, langCodes, hostApi])

  useEffect(() => {
    void fetchEntries()
  }, [fetchEntries])

  const randomize = useCallback(async () => {
    setQuery("")
    setDebounced("")
    const seq = ++reqSeq.current
    setLoading(true)
    try {
      if (hostApi.getRandomEntries) {
        const list = await hostApi.getRandomEntries({
          count: PAGE,
          languageCodes: langCodes,
          levels: level ? [level] : undefined,
          domains: domain ? [domain] : undefined,
        })
        if (seq === reqSeq.current) setEntries(list)
      }
    } catch (err) {
      console.warn("[beatlounge/phrase-sampler] randomize failed:", err)
    } finally {
      if (seq === reqSeq.current) setLoading(false)
    }
  }, [hostApi, langCodes, level, domain])

  const audition = useCallback(
    (entry: EntryOut) => {
      const content = resolvePhraseContent(entry, languages)
      if (content.phraseText) {
        try {
          void hostApi.speak(content.targetLang, content.phraseText)
        } catch (err) {
          console.warn("[beatlounge/phrase-sampler] speak failed:", err)
        }
      }
    },
    [hostApi, languages]
  )

  const place = useCallback(
    async (entry: EntryOut) => {
      setBusyId(entry.entry_id)
      try {
        const content = resolvePhraseContent(entry, languages)
        const doc = store.vanilla.getState().doc
        const clip = await buildClip(
          { audioSource, hostApi, loopTicks: doc.loopLengthTicks },
          { content, mode }
        )
        const commands = clipToCommands(clip)
        applyCommands(store, commands, `Place "${clip.phraseText}"`)
        const summary =
          mode === "stack"
            ? `Riff: "${clip.phraseText}"`
            : `Phrase: "${clip.phraseText}"`
        host.toast(summary, { undo: () => store.undo() })
        onPlaced(entry, summary)
      } catch (err) {
        console.warn("[beatlounge/phrase-sampler] place failed:", err)
        host.toast("Could not place phrase")
      } finally {
        setBusyId(null)
      }
    },
    [audioSource, hostApi, languages, mode, store, host, onPlaced]
  )

  return (
    <div className="bl-ps">
      <div className="bl-ps-toolbar" data-bl-nocapture>
        <div className="bl-ps-search">
          <Glyph name="drawer" size={16} />
          <input
            className="bl-ps-input"
            type="search"
            inputMode="search"
            placeholder="Search the corpus…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search phrases"
          />
          {query && (
            <button
              type="button"
              className="bl-ps-clear"
              aria-label="Clear search"
              onClick={() => setQuery("")}
            >
              ×
            </button>
          )}
        </div>
        <button
          type="button"
          className="bl-chip bl-ps-dice"
          onClick={() => void randomize()}
          aria-label="Randomize phrases"
          title="Randomize"
        >
          <Glyph name="wave" size={16} /> Shuffle
        </button>
      </div>

      <div className="bl-ps-facets" data-bl-nocapture>
        <div className="bl-ps-facetrow">
          {ALL_LEVELS.map((lv) => (
            <button
              key={lv}
              type="button"
              className={`bl-ps-facet${level === lv ? " is-on" : ""}`}
              onClick={() => setLevel(level === lv ? null : lv)}
            >
              {lv}
            </button>
          ))}
        </div>
        {domains.length > 0 && (
          <div className="bl-ps-facetrow">
            {domains.map((d) => (
              <button
                key={d}
                type="button"
                className={`bl-ps-facet${domain === d ? " is-on" : ""}`}
                onClick={() => setDomain(domain === d ? null : d)}
              >
                {d}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bl-ps-modebar" data-bl-nocapture>
        <span className="bl-ps-modelabel">Place as</span>
        <div className="bl-ps-modeseg" role="radiogroup" aria-label="Placement mode">
          <button
            type="button"
            role="radio"
            aria-checked={mode === "stack"}
            className={`bl-ps-modebtn${mode === "stack" ? " is-on" : ""}`}
            onClick={() => setMode("stack")}
          >
            Riff
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={mode === "scatter"}
            className={`bl-ps-modebtn${mode === "scatter" ? " is-on" : ""}`}
            onClick={() => setMode("scatter")}
          >
            Phrase
          </button>
        </div>
      </div>

      <VirtualList
        entries={entries}
        loading={loading}
        languages={languages}
        showRomanization={stack.showRomanization}
        busyId={busyId}
        onAudition={audition}
        onPlace={(e) => void place(e)}
      />
    </div>
  )
}

// ----------------------------------------------------------- virtual list
interface VListProps {
  entries: EntryOut[]
  loading: boolean
  languages: string[]
  showRomanization: boolean
  busyId: number | null
  onAudition: (e: EntryOut) => void
  onPlace: (e: EntryOut) => void
}

const VirtualList = ({
  entries,
  loading,
  languages,
  showRomanization,
  busyId,
  onAudition,
  onPlace,
}: VListProps) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportH, setViewportH] = useState(480)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const measure = () => setViewportH(el.clientHeight || 480)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const total = entries.length
  const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const visibleCount = Math.ceil(viewportH / ROW_HEIGHT) + OVERSCAN * 2
  const last = Math.min(total, first + visibleCount)
  const slice = entries.slice(first, last)

  if (!loading && total === 0) {
    return (
      <div className="bl-ps-list is-empty" ref={scrollRef}>
        <p className="bl-ps-empty">No phrases. Try a different search or Shuffle.</p>
      </div>
    )
  }

  return (
    <div
      className="bl-ps-list"
      ref={scrollRef}
      onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
    >
      <div className="bl-ps-spacer" style={{ height: total * ROW_HEIGHT }}>
        {slice.map((entry, i) => {
          const idx = first + i
          return (
            <PhraseRow
              key={`${entry.source ?? "base"}:${entry.entry_id}`}
              entry={entry}
              top={idx * ROW_HEIGHT}
              languages={languages}
              showRomanization={showRomanization}
              busy={busyId === entry.entry_id}
              onAudition={() => onAudition(entry)}
              onPlace={() => onPlace(entry)}
            />
          )
        })}
      </div>
    </div>
  )
}

// ----------------------------------------------------------- one row
interface RowProps {
  entry: EntryOut
  top: number
  languages: string[]
  showRomanization: boolean
  busy: boolean
  onAudition: () => void
  onPlace: () => void
}

const PhraseRow = ({
  entry,
  top,
  languages,
  showRomanization,
  busy,
  onAudition,
  onPlace,
}: RowProps) => {
  const content = resolvePhraseContent(entry, languages)
  return (
    <div className="bl-ps-row" style={{ top }}>
      <div className="bl-ps-text">
        <div className="bl-ps-target" lang={content.targetLang}>
          {content.phraseText || "—"}
        </div>
        {showRomanization && content.romanization && (
          <div className="bl-ps-roman">{content.romanization}</div>
        )}
        {content.gloss && content.gloss !== content.phraseText && (
          <div className="bl-ps-gloss" lang={content.nativeLang ?? undefined}>
            {content.gloss}
          </div>
        )}
        <div className="bl-ps-meta">
          <span className="bl-ps-badge">{entry.level}</span>
          {(entry.domains ?? []).slice(0, 2).map((d) => (
            <span className="bl-ps-tag" key={d}>
              {d}
            </span>
          ))}
        </div>
      </div>
      <div className="bl-ps-actions" data-bl-nocapture>
        <button
          type="button"
          className="bl-ps-act"
          aria-label="Audition phrase"
          title="Hear it"
          onClick={onAudition}
        >
          <Glyph name="play" size={18} />
        </button>
        <button
          type="button"
          className="bl-ps-act is-place"
          aria-label="Place phrase as a sampler track"
          title="Place on the grid"
          onClick={onPlace}
          disabled={busy}
        >
          {busy ? <span className="bl-ps-spin" /> : <Glyph name="grid" size={18} />}
        </button>
      </div>
    </div>
  )
}
