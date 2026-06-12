/**
 * beatlounge — phrase-SCRATCH bank DRAWER.
 *
 * Brings phrase-pack management INTO scratch: a bottom drawer that browses /
 * searches the saved phrase bank and loads a snippet onto deck A or B — so the
 * scratch view is self-sufficient for managing what's on the table (no leaving
 * for the sequencer's bank screen). It reads the SAME `bankSnippets` data the
 * per-deck picker uses; nothing is duplicated.
 *
 * Each row shows the phrase + language and a Load-A / Load-B affordance (B only
 * when the second deck is up). The row marked ▸A / ▸B is what each deck holds.
 */

import { useMemo, useState } from "react"
import type { FragmentRef } from "../../model/document"
import { Glyph } from "../../bl-ui"

interface Props {
  bank: FragmentRef[]
  keyA: string | null
  keyB: string | null
  showDeckB: boolean
  refKey: (r: FragmentRef) => string
  onLoad: (deck: "a" | "b", r: FragmentRef) => void
  onClose: () => void
}

export const ScratchBankDrawer = ({
  bank,
  keyA,
  keyB,
  showDeckB,
  refKey,
  onLoad,
  onClose,
}: Props) => {
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()
  // Newest first (matches the picker); filter on text + language.
  const rows = useMemo(() => {
    const all = [...bank].reverse()
    if (!q) return all
    return all.filter(
      (r) =>
        (r.text ?? "").toLowerCase().includes(q) ||
        (r.language ?? "").toLowerCase().includes(q)
    )
  }, [bank, q])

  return (
    <div className="bl-scrbank" role="dialog" aria-label="Phrase bank" data-bl-nocapture>
      <div className="bl-scrbank-head">
        <span className="bl-scrbank-title">Phrases</span>
        <button
          type="button"
          className="bl-scrbank-close"
          onClick={onClose}
          aria-label="Close phrases"
        >
          <Glyph name="chevron-down" size={16} />
        </button>
      </div>

      <input
        type="search"
        className="bl-scrbank-search"
        placeholder="Search the bank"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search the phrase bank"
      />

      <div className="bl-scrbank-list">
        {rows.length === 0 ? (
          <p className="bl-scrbank-empty">No phrases match.</p>
        ) : (
          rows.map((r) => {
            const k = refKey(r)
            const onA = keyA === k
            const onB = showDeckB && keyB === k
            return (
              <div className="bl-scrbank-row" key={r.id}>
                <span className="bl-scrbank-text" lang={r.language}>
                  {r.text ?? "—"}
                </span>
                {r.language && (
                  <span className="bl-scrbank-lang">{r.language.toUpperCase()}</span>
                )}
                <div className="bl-scrbank-load">
                  <button
                    type="button"
                    className={`bl-scrbank-deck${onA ? " is-on" : ""}`}
                    onClick={() => onLoad("a", r)}
                    aria-pressed={onA}
                    aria-label={`Load onto deck A: ${r.text ?? ""}`}
                  >
                    A
                  </button>
                  {showDeckB && (
                    <button
                      type="button"
                      className={`bl-scrbank-deck${onB ? " is-on" : ""}`}
                      onClick={() => onLoad("b", r)}
                      aria-pressed={onB}
                      aria-label={`Load onto deck B: ${r.text ?? ""}`}
                    >
                      B
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
