// src/hooks/useStackPhraseCount.ts
//
// Lazy, debounced count of phrases matching the active stack's filter
// (levels + base + active phrase packs). Powers the "~N phrases match
// this stack" chip in the Stacks settings tab so a user with a tight
// filter understands their pool size before the back-to-back-repeat
// surprises them.
//
// The underlying Rust command (`count_entries_for_filter`) is read-only
// and FilterSig-cached, so identical re-queries are sub-millisecond —
// the JS-side debounce just smooths out chip-tap bursts.

import { useEffect, useMemo, useRef, useState } from "react"
import { invoke } from "@tauri-apps/api/core"

import { useSettingsStore } from "@/store/settings"

const DEBOUNCE_MS = 250

export type StackPhraseCount = {
    /** Total entries across active sources for the current filter. */
    count: number | null
    /** True while a debounced query is in flight. UI can show a soft
     *  shimmer if it wants, but the chip is usually fine with the
     *  previous value during the brief debounce window. */
    isLoading: boolean
}

export function useStackPhraseCount(): StackPhraseCount {
    const levels = useSettingsStore((s) => s.levels)
    const phrasePackIds = useSettingsStore((s) => s.phrasePackIds)
    const baseCorpusEnabled = useSettingsStore((s) => s.baseCorpusEnabled)

    // Stable JSON serialization of the filter axes — feeding `levels`
    // and `phrasePackIds` directly into a useEffect dep array would
    // refire on every render because Zustand returns new array refs.
    const filterKey = useMemo(
        () =>
            JSON.stringify({
                l: [...levels].sort(),
                p: [...phrasePackIds].sort(),
                b: baseCorpusEnabled,
            }),
        [levels, phrasePackIds, baseCorpusEnabled],
    )

    const [count, setCount] = useState<number | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const reqSeqRef = useRef(0)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        setIsLoading(true)
        const mySeq = ++reqSeqRef.current
        debounceRef.current = setTimeout(() => {
            void (async () => {
                try {
                    const n = await invoke<number>("count_entries_for_filter", {
                        levels,
                        phrasePackIds,
                        baseCorpusEnabled,
                    })
                    if (mySeq !== reqSeqRef.current) return
                    setCount(n)
                } catch (err) {
                    if (mySeq !== reqSeqRef.current) return
                    console.warn(
                        "[useStackPhraseCount] count_entries_for_filter failed:",
                        err,
                    )
                    setCount(null)
                } finally {
                    if (mySeq === reqSeqRef.current) setIsLoading(false)
                }
            })()
        }, DEBOUNCE_MS)
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterKey])

    return { count, isLoading }
}
