/**
 * beatlounge — phrase DISCOVERY / LIBRARY: the heart of the language feature.
 *
 * Interface #1 of two (the sequencer is #2). The flow:
 *
 *   search / shuffle the corpus
 *     → tap a phrase  → see EVERY stack language (one row each: code · text ·
 *                        romanization), not just native+target
 *       → drill a language → the full contiguous n-gram breakdown, grouped by N
 *                            (ella · lo · explicará / ella lo · lo explicará / …)
 *         → audition any combo through Web Audio (NEVER speak())
 *         → SAVE a combo to the BANK (renders + IDB-caches + registers a ref)
 *
 * A Bank tab manages the saved library (audition + remove). Saving to the bank
 * is this screen's endpoint; placement on the grid lives in the sequencer.
 *
 * Performance: the result list is windowed (only visible rows render) so 25k
 * phrases scroll smoothly. Heavy work (TTS render) happens only on audition/save.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import { useBeatloungeStore } from "../../store/store"
import type { EntryOut, VoiceInfo } from "../../sdk/types"
import { Glyph } from "../../bl-ui"
import { ct } from "../../i18n/strings"
import type { AudioSource } from "../../phrase/audioSource"
import { auditionPhrase } from "../../phrase/audition"
import { buildBankRef, bankHas } from "../../phrase/bank"
import {
  entryLanguageRows,
  headlineRow,
  nativeGloss,
  comboBreakdown,
  discoveryLanguageCodes,
  type LanguageRow,
} from "./discoveryModel"
import { languageLabel } from "./langLabel"
import { BankView } from "./BankView"

const SEARCH_DEBOUNCE_MS = 220
const PAGE = 80
const ROW_HEIGHT = 88
const OVERSCAN = 4

const LOG = "[beatlounge/phrase-discovery]"

type Tab = "discover" | "bank"

interface Props {
  host: BeatloungeHost
  store: BeatloungeStore
  audioSource: AudioSource
  /** Lifted so the tile reflects the last saved snippet. */
  onPlaced: (entry: EntryOut, summary: string) => void
}

export const PhraseSamplerImmersive = ({ host, store, audioSource, onPlaced }: Props) => {
  const hostApi = host.hostApi
  // Snapshot the stack ONCE per mount — the real host returns a fresh object on
  // every getStackConfig() call; reading it in render churned `languages`
  // identity and re-fetched the corpus in a loop.
  const stack = useMemo(() => hostApi.getStackConfig(), [hostApi])
  const languages = useMemo(() => stack.languages ?? [], [stack])
  const langCodes = useMemo(() => discoveryLanguageCodes(stack), [stack])
  const nativeCode = languages[0]

  const bankCount = useBeatloungeStore(store, (s) => s.doc.fragmentLibrary?.length ?? 0)

  const [tab, setTab] = useState<Tab>("discover")
  const [selected, setSelected] = useState<EntryOut | null>(null)

  return (
    <div className="bl-disc">
      <div className="bl-disc-tabs" data-bl-nocapture role="tablist" aria-label={ct("phrases.libraryTabs")}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "discover"}
          className={`bl-disc-tab${tab === "discover" ? " is-on" : ""}`}
          onClick={() => setTab("discover")}
        >
          <Glyph name="drawer" size={16} /> {ct("phrases.discover")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "bank"}
          className={`bl-disc-tab${tab === "bank" ? " is-on" : ""}`}
          onClick={() => setTab("bank")}
        >
          <Glyph name="wave" size={16} /> {ct("phrases.bank")}
          {bankCount > 0 && <span className="bl-disc-tabcount">{bankCount}</span>}
        </button>
      </div>

      {tab === "discover" ? (
        <DiscoverView
          host={host}
          store={store}
          audioSource={audioSource}
          languages={languages}
          langCodes={langCodes}
          nativeCode={nativeCode}
          showRomanization={stack.showRomanization}
          selected={selected}
          onSelect={setSelected}
          onSaved={onPlaced}
        />
      ) : (
        <BankView host={host} store={store} audioSource={audioSource} nativeCode={nativeCode} />
      )}
    </div>
  )
}

// ============================================================ Discover view
interface DiscoverProps {
  host: BeatloungeHost
  store: BeatloungeStore
  audioSource: AudioSource
  languages: string[]
  langCodes: string[]
  nativeCode?: string
  showRomanization: boolean
  selected: EntryOut | null
  onSelect: (e: EntryOut | null) => void
  onSaved: (e: EntryOut, summary: string) => void
}

const DiscoverView = ({
  host,
  store,
  audioSource,
  languages,
  langCodes,
  nativeCode,
  showRomanization,
  selected,
  onSelect,
  onSaved,
}: DiscoverProps) => {
  const hostApi = host.hostApi
  const [query, setQuery] = useState("")
  const [debounced, setDebounced] = useState("")
  const [entries, setEntries] = useState<EntryOut[]>([])
  const [loading, setLoading] = useState(false)
  const reqSeq = useRef(0)

  // Debounce the search box.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [query])

  const fetchEntries = useCallback(async () => {
    const seq = ++reqSeq.current
    setLoading(true)
    try {
      let list: EntryOut[] = []
      if (debounced && hostApi.searchEntriesByText) {
        list = await hostApi.searchEntriesByText({
          text: debounced,
          languageCodes: langCodes,
          limit: PAGE,
        })
      } else if (!debounced && hostApi.getRandomEntries) {
        list = await hostApi.getRandomEntries({ count: PAGE, languageCodes: langCodes })
      } else if (debounced && !hostApi.searchEntriesByText) {
        // Older host without text search: degrade to a random browse + a note.
        host.toast(ct("phrases.searchUnavailable"))
        if (hostApi.getRandomEntries) {
          list = await hostApi.getRandomEntries({ count: PAGE, languageCodes: langCodes })
        }
      }
      if (seq === reqSeq.current) setEntries(list)
    } catch (err) {
      console.warn(`${LOG} fetch failed:`, err)
      if (seq === reqSeq.current) {
        setEntries([])
        host.toast(ct("phrases.cantLoad"))
      }
    } finally {
      if (seq === reqSeq.current) setLoading(false)
    }
  }, [debounced, langCodes, hostApi, host])

  useEffect(() => {
    void fetchEntries()
  }, [fetchEntries])

  const shuffle = useCallback(async () => {
    setQuery("")
    setDebounced("")
    onSelect(null)
    const seq = ++reqSeq.current
    setLoading(true)
    try {
      if (hostApi.getRandomEntries) {
        const list = await hostApi.getRandomEntries({ count: PAGE, languageCodes: langCodes })
        if (seq === reqSeq.current) setEntries(list)
      } else {
        host.toast(ct("phrases.shuffleUnavailable"))
      }
    } catch (err) {
      console.warn(`${LOG} shuffle failed:`, err)
      host.toast(ct("phrases.cantShuffle"))
    } finally {
      if (seq === reqSeq.current) setLoading(false)
    }
  }, [hostApi, langCodes, host, onSelect])

  return (
    <div className="bl-disc-body bl-disc-body--split">
      {/* Master pane: search/shuffle + results. Its own column on wide screens. */}
      <div className="bl-disc-master">
        <div className="bl-disc-toolbar" data-bl-nocapture>
          <div className="bl-disc-search">
            <span className="bl-disc-searchicon">
              <Glyph name="drawer" size={16} />
            </span>
            <input
              className="bl-disc-input"
              type="search"
              inputMode="search"
              placeholder={ct("phrases.searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={ct("phrases.searchPhrases")}
            />
            {query && (
              <button
                type="button"
                className="bl-disc-clear"
                aria-label={ct("phrases.clearSearch")}
                onClick={() => setQuery("")}
              >
                ×
              </button>
            )}
          </div>
          <button
            type="button"
            className="bl-disc-shuffle"
            onClick={() => void shuffle()}
            aria-label={ct("phrases.shufflePhrases")}
            title={ct("phrases.shuffle")}
          >
            <Glyph name="wave" size={16} />
            <span>{ct("phrases.shuffle")}</span>
          </button>
        </div>

        <ResultList
          entries={entries}
          loading={loading}
          languages={languages}
          selectedId={selected?.entry_id ?? null}
          onSelect={onSelect}
        />
      </div>

      {/* Detail pane. On phone it's an absolute slide-over (only when a phrase is
          selected). On wide screens it's a persistent second column — including
          an empty/resting state when nothing is selected. Same DOM, CSS reflows. */}
      {selected ? (
        <PhraseDetail
          host={host}
          store={store}
          audioSource={audioSource}
          entry={selected}
          languages={languages}
          nativeCode={nativeCode}
          showRomanization={showRomanization}
          onClose={() => onSelect(null)}
          onSaved={(summary) => onSaved(selected, summary)}
        />
      ) : (
        <div className="bl-disc-detail bl-disc-detail-rest" aria-hidden="true">
          <div className="bl-disc-rest-inner">
            <span className="bl-disc-rest-glyph">
              <Glyph name="drawer" size={30} />
            </span>
            <p className="bl-disc-rest-title">{ct("phrases.pickPhrase")}</p>
            <p className="bl-disc-empty-sm">
              {ct("phrases.pickPhraseHint")}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------ result list
interface ResultListProps {
  entries: EntryOut[]
  loading: boolean
  languages: string[]
  selectedId: number | null
  onSelect: (e: EntryOut) => void
}

const ResultList = ({ entries, loading, languages, selectedId, onSelect }: ResultListProps) => {
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
      <div className="bl-disc-list is-empty" ref={scrollRef}>
        <p className="bl-disc-empty">{ct("phrases.noPhrases")}</p>
      </div>
    )
  }

  return (
    <div
      className="bl-disc-list"
      ref={scrollRef}
      onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
    >
      <div className="bl-disc-spacer" style={{ height: total * ROW_HEIGHT }}>
        {slice.map((entry, i) => {
          const idx = first + i
          return (
            <ResultRow
              key={`${entry.source ?? "base"}:${entry.entry_id}`}
              entry={entry}
              top={idx * ROW_HEIGHT}
              languages={languages}
              selected={entry.entry_id === selectedId}
              onSelect={() => onSelect(entry)}
            />
          )
        })}
      </div>
    </div>
  )
}

interface ResultRowProps {
  entry: EntryOut
  top: number
  languages: string[]
  selected: boolean
  onSelect: () => void
}

const ResultRow = ({ entry, top, languages, selected, onSelect }: ResultRowProps) => {
  const head = headlineRow(entry, languages)
  const gloss = nativeGloss(entry, languages)
  const rowCount = entryLanguageRows(entry, languages).length
  return (
    <button
      type="button"
      className={`bl-disc-row${selected ? " is-sel" : ""}`}
      style={{ top }}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <div className="bl-disc-rowtext">
        <div className="bl-disc-rowhead" lang={head?.code}>
          {head?.text || "—"}
        </div>
        {gloss && head && gloss !== head.text && (
          <div className="bl-disc-rowgloss" lang={languages[0]}>
            {gloss}
          </div>
        )}
        <div className="bl-disc-rowmeta">
          <span className="bl-disc-badge">{entry.level}</span>
          {rowCount > 0 && (
            <span className="bl-disc-langcount">
              {rowCount === 1
                ? ct("phrases.languageCountOne", { n: String(rowCount) })
                : ct("phrases.languageCount", { n: String(rowCount) })}
            </span>
          )}
          {(entry.domains ?? []).slice(0, 1).map((d) => (
            <span className="bl-disc-tag" key={d}>
              {d}
            </span>
          ))}
        </div>
      </div>
      <span className="bl-disc-rowchevron" aria-hidden="true">
        <Glyph name="chevron-left" size={18} style={{ transform: "scaleX(-1)" }} />
      </span>
    </button>
  )
}

// ============================================================ phrase detail
interface DetailProps {
  host: BeatloungeHost
  store: BeatloungeStore
  audioSource: AudioSource
  entry: EntryOut
  languages: string[]
  nativeCode?: string
  showRomanization: boolean
  onClose: () => void
  onSaved: (summary: string) => void
}

const PhraseDetail = ({
  host,
  store,
  audioSource,
  entry,
  languages,
  nativeCode,
  showRomanization,
  onClose,
  onSaved,
}: DetailProps) => {
  const rows = useMemo(() => entryLanguageRows(entry, languages), [entry, languages])
  // Default the drilled language to the first non-native (target) row, else 0.
  const defaultLang = useMemo(
    () => rows.find((r) => !r.isNative)?.code ?? rows[0]?.code ?? null,
    [rows]
  )
  const [drillLang, setDrillLang] = useState<string | null>(defaultLang)
  useEffect(() => setDrillLang(defaultLang), [defaultLang])

  const drillRow = rows.find((r) => r.code === drillLang) ?? null

  return (
    <div className="bl-disc-detail" data-bl-nocapture role="dialog" aria-label={ct("phrases.phraseDetail")}>
      <div className="bl-disc-detail-head">
        <button type="button" className="bl-disc-back" onClick={onClose} aria-label={ct("phrases.backToResults")}>
          <Glyph name="chevron-left" size={18} />
        </button>
        <div className="bl-disc-detail-title">
          <span className="bl-disc-badge">{entry.level}</span>
          {(entry.domains ?? []).slice(0, 2).map((d) => (
            <span className="bl-disc-tag" key={d}>
              {d}
            </span>
          ))}
        </div>
      </div>

      <div className="bl-disc-detail-scroll">
        {/* Every stack language present — one row each. */}
        <div className="bl-disc-langs">
          <div className="bl-disc-section-h">{ct("phrases.allLanguages")}</div>
          {rows.length === 0 && <p className="bl-disc-empty-sm">{ct("phrases.noTranslations")}</p>}
          {rows.map((row) => (
            <LanguageRowView
              key={row.code}
              row={row}
              nativeCode={nativeCode}
              showRomanization={showRomanization}
              isDrilled={row.code === drillLang}
              onDrill={() => setDrillLang(row.code)}
              onAudition={() =>
                void auditionPhrase(host.audioContext(), audioSource, row.text, row.code).catch(
                  (err) => {
                    console.warn(`${LOG} audition row failed:`, err)
                    host.toast(ct("phrases.cantPlay"))
                  }
                )
              }
            />
          ))}
        </div>

        {drillRow && (
          <ComboBreakdownView
            host={host}
            store={store}
            audioSource={audioSource}
            row={drillRow}
            nativeCode={nativeCode}
            onSaved={onSaved}
          />
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------ language row
interface LanguageRowViewProps {
  row: LanguageRow
  nativeCode?: string
  showRomanization: boolean
  isDrilled: boolean
  onDrill: () => void
  onAudition: () => void
}

const LanguageRowView = ({
  row,
  nativeCode,
  showRomanization,
  isDrilled,
  onDrill,
  onAudition,
}: LanguageRowViewProps) => (
  <div className={`bl-disc-lang${isDrilled ? " is-drilled" : ""}`}>
    <button type="button" className="bl-disc-lang-main" onClick={onDrill} aria-pressed={isDrilled}>
      <span className="bl-disc-lang-tag">
        {languageLabel(row.code, nativeCode)}
        {row.isNative && <span className="bl-disc-native-dot" title={ct("phrases.native")} />}
      </span>
      <span className="bl-disc-lang-text" lang={row.code}>
        {row.text}
      </span>
      {showRomanization && row.romanization && (
        <span className="bl-disc-lang-roman">{row.romanization}</span>
      )}
    </button>
    <button
      type="button"
      className="bl-disc-iconbtn"
      onClick={onAudition}
      aria-label={ct("phrases.hearLanguage", { lang: languageLabel(row.code, nativeCode) })}
      title={ct("phrases.hearIt")}
    >
      <Glyph name="play" size={18} />
    </button>
  </div>
)

// ------------------------------------------------------------ combo breakdown
interface ComboViewProps {
  host: BeatloungeHost
  store: BeatloungeStore
  audioSource: AudioSource
  row: LanguageRow
  nativeCode?: string
  onSaved: (summary: string) => void
}

const ComboBreakdownView = ({ host, store, audioSource, row, nativeCode, onSaved }: ComboViewProps) => {
  const [voiceId, setVoiceId] = useState<string | undefined>(undefined)
  // Offer ALL n-grams of the phrase (#420) — no cap; the deeper bands stay
  // collapsed by default so a long phrase is browsable, not overwhelming.
  const breakdown = useMemo(() => comboBreakdown(row.text, row.code), [row])
  // Which N bands are expanded. N=1 and N=2 open by default; deeper bands collapse.
  const [openBands, setOpenBands] = useState<Set<number>>(new Set([1, 2]))
  useEffect(() => setOpenBands(new Set([1, 2])), [row.code, row.text])
  const [busyText, setBusyText] = useState<string | null>(null)

  // Reactive doc for bank-membership "saved" checkmarks.
  const doc = useBeatloungeStore(store, (s) => s.doc)

  const toggleBand = (n: number) =>
    setOpenBands((prev) => {
      const next = new Set(prev)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })

  const audition = useCallback(
    (text: string) => {
      void auditionPhrase(host.audioContext(), audioSource, text, row.code, { voiceId }).catch(
        (err) => {
          console.warn(`${LOG} audition combo failed:`, err)
          host.toast(ct("phrases.cantPlay"))
        }
      )
    },
    [host, audioSource, row.code, voiceId]
  )

  const save = useCallback(
    async (text: string) => {
      setBusyText(text)
      try {
        const built = await buildBankRef(audioSource, { text, lang: row.code, voiceId })
        if (!built) {
          host.toast(ct("phrases.nothingToSave"))
          return
        }
        store.dispatch({ t: "registerFragment", ref: built.ref })
        const note = built.result.hasAudio ? "" : ct("phrases.synthVoiceSuffix")
        host.toast(ct("phrases.savedToBank", { text, note }), { undo: () => store.undo() })
        onSaved(ct("phrases.savedShort", { text }))
      } catch (err) {
        console.warn(`${LOG} save combo failed:`, err)
        host.toast(ct("phrases.cantSave"))
      } finally {
        setBusyText(null)
      }
    },
    [audioSource, row.code, voiceId, store, host, onSaved]
  )

  return (
    <div className="bl-disc-combos">
      <div className="bl-disc-section-h bl-disc-combos-h">
        <span>
          {ct("phrases.breakdown")} · <span lang={row.code}>{languageLabel(row.code, nativeCode)}</span>
        </span>
        <VoicePicker host={host} lang={row.code} voiceId={voiceId} onPick={setVoiceId} />
      </div>

      {breakdown.tokens.length === 0 ? (
        <p className="bl-disc-empty-sm">{ct("phrases.nothingToBreakDown")}</p>
      ) : (
        <>
          <p className="bl-disc-combos-sub">
            {breakdown.tokens.length === 1
              ? ct("phrases.tokenCountOne", { n: String(breakdown.tokens.length) })
              : ct("phrases.tokenCount", { n: String(breakdown.tokens.length) })}{" "}
            · {ct("phrases.combosOf", {
              shown: String(breakdown.shownCount),
              full: String(breakdown.fullCount),
            })}
            {breakdown.cappedAtN !== undefined && (
              <span className="bl-disc-capnote">
                {" "}
                {ct("phrases.cappedNote", {
                  n: String(breakdown.cappedAtN),
                  hidden: String(breakdown.hiddenCount),
                })}
              </span>
            )}
          </p>

          {breakdown.bands.map((band) => {
            const open = openBands.has(band.n)
            return (
              <div key={band.n} className={`bl-disc-band${open ? " is-open" : ""}`}>
                <button
                  type="button"
                  className="bl-disc-band-h"
                  onClick={() => toggleBand(band.n)}
                  aria-expanded={open}
                >
                  <span className="bl-disc-band-chev" aria-hidden="true">
                    <Glyph name="chevron-down" size={16} />
                  </span>
                  <span className="bl-disc-band-n">{ct("phrases.nGram", { n: String(band.n) })}</span>
                  <span className="bl-disc-band-count">{band.combos.length}</span>
                </button>
                {open && (
                  <div className="bl-disc-band-grid">
                    {band.combos.map((c) => {
                      const saved = bankHas(doc, c.text, row.code, voiceId)
                      const busy = busyText === c.text
                      return (
                        <div key={`${c.n}:${c.start}`} className="bl-disc-combo">
                          <button
                            type="button"
                            className="bl-disc-combo-text"
                            lang={row.code}
                            onClick={() => audition(c.text)}
                            title={ct("phrases.audition")}
                          >
                            <Glyph name="play" size={14} />
                            <span>{c.text}</span>
                          </button>
                          <button
                            type="button"
                            className={`bl-disc-combo-save${saved ? " is-saved" : ""}`}
                            onClick={() => !saved && void save(c.text)}
                            disabled={busy || saved}
                            aria-label={saved ? ct("phrases.alreadyInBank") : ct("phrases.savePhraseToBank", { text: c.text })}
                            title={saved ? ct("phrases.inBank") : ct("phrases.saveToBank")}
                          >
                            {busy ? (
                              <span className="bl-disc-spin" />
                            ) : saved ? (
                              <Check />
                            ) : (
                              <Plus />
                            )}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

// ------------------------------------------------------------ voice picker
interface VoicePickerProps {
  host: BeatloungeHost
  lang: string
  voiceId?: string
  onPick: (id: string | undefined) => void
}

const VoicePicker = ({ host, lang, voiceId, onPick }: VoicePickerProps) => {
  const [voices, setVoices] = useState<VoiceInfo[] | null>(null)
  const listVoices = host.hostApi.listVoices

  useEffect(() => {
    let alive = true
    onPick(undefined)
    if (!listVoices) {
      setVoices(null)
      return
    }
    setVoices(null)
    void (async () => {
      try {
        const vs = await listVoices(lang)
        if (alive) setVoices(vs ?? [])
      } catch (err) {
        console.warn(`${LOG} listVoices failed:`, err)
        if (alive) setVoices([])
      }
    })()
    return () => {
      alive = false
    }
    // onPick is stable from parent; lang/listVoices drive the refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, listVoices])

  if (!listVoices || !voices || voices.length === 0) return null

  return (
    <label className="bl-disc-voice">
      <span className="bl-disc-voice-label">{ct("phrases.voice")}</span>
      <select
        className="bl-disc-voice-sel"
        value={voiceId ?? ""}
        onChange={(e) => onPick(e.target.value || undefined)}
        aria-label={ct("phrases.renderVoice")}
      >
        <option value="">{ct("phrases.defaultVoice")}</option>
        {voices.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name || v.id}
          </option>
        ))}
      </select>
    </label>
  )
}

// ------------------------------------------------------------ inline glyphs
const Plus = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
)
const Check = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7" />
  </svg>
)
