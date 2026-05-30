import { useCallback, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useSettingsStore } from "@/store/settings"
import { getAutonym } from "@/store/translations"
import { ONBOARDING_GRAPH, ENTRY_NODE } from "./graph"
import { resolveNext } from "./types"
import type { Draft, NodeCtx, NextSpec, QuestionOption, MultiQuestionNode } from "./types"

/**
 * Decision-graph traversal: a string-id back-stack (pure graph walk, no
 * numeric indices) + a non-persisted draft accumulated as the user answers.
 * The draft is flushed to the stores only at the terminal node, so Back is
 * non-destructive. (Existing components still write languages/voicePrefs/
 * phrasePackIds eagerly; those are intentionally outside the draft.)
 */
export function useOnboardingGraph() {
  const { t } = useTranslation()
  const [currentId, setCurrentId] = useState<string>(ENTRY_NODE)
  const [history, setHistory] = useState<string[]>([])
  const draftRef = useRef<Draft>({})

  const langName = useCallback(
    (code?: string) => (code ? t(`languages.${code}`, { defaultValue: getAutonym(code) }) : ""),
    [t]
  )

  const makeCtx = useCallback((): NodeCtx => {
    const langs = useSettingsStore.getState().languages
    return {
      draft: draftRef.current,
      patch: (p) => {
        draftRef.current = { ...draftRef.current, ...p }
      },
      t: t as unknown as NodeCtx["t"],
      primary: () => langName(langs[0]),
      targets: () => langs.slice(1).map(langName),
    }
  }, [t, langName])

  const goTo = useCallback((nextId: string) => {
    setHistory((h) => [...h, currentId])
    setCurrentId(nextId)
  }, [currentId])

  /** Advance from an adapter/info node using its own `next`. */
  const advance = useCallback(() => {
    const node = ONBOARDING_GRAPH[currentId]
    if (!node || node.kind === "terminal" || node.kind === "question") return
    goTo(resolveNext(node.next as NextSpec, makeCtx()))
  }, [currentId, goTo, makeCtx])

  /** Choose a question option: apply its side effect, then route. */
  const choose = useCallback(
    (option: QuestionOption) => {
      const ctx = makeCtx()
      option.apply?.(ctx)
      goTo(resolveNext(option.next, ctx))
    },
    [goTo, makeCtx]
  )

  /** Commit a multi-select node's chosen ids (empty = skip), then route. */
  const chooseMulti = useCallback(
    (node: MultiQuestionNode, selectedIds: string[]) => {
      const ctx = makeCtx()
      node.apply(ctx, selectedIds)
      goTo(resolveNext(node.next, ctx))
    },
    [goTo, makeCtx]
  )

  const back = useCallback(() => {
    setHistory((h) => {
      if (!h.length) return h
      setCurrentId(h[h.length - 1])
      return h.slice(0, -1)
    })
  }, [])

  return {
    node: ONBOARDING_GRAPH[currentId],
    currentId,
    canBack: history.length > 0,
    advance,
    choose,
    chooseMulti,
    back,
    makeCtx,
  }
}
