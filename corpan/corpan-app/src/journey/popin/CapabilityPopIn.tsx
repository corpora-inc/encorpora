// src/journey/popin/CapabilityPopIn.tsx — host-owned phrase-actions sheet
// (capability-modules.md §5). v1 ships exactly one action: Pronounce it →
// mounts cap-pronounce in-process with a synthetic `popin-*` spec. Results
// are LOG-ONLY (never fed to FSRS in v1); pronounce attempts are unmetered.

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useTranslation } from "react-i18next"
import { X } from "lucide-react"
import type { ActivitySpec } from "../../contentPacks/activityContract"
import type { CapabilityHandle } from "@shared/capabilities/core"
import { loadCapability } from "../capabilities/registry.ts"
import {
  popInCapabilityHost,
  setPopInListener,
  type PhrasePopInRequest,
} from "./popinBus.ts"

export function CapabilityPopIn(props: {
  /** activity_result log sink, surface "popin" (log-only, v1). */
  onResult?: (result: unknown) => void
}) {
  const { t } = useTranslation()
  const [req, setReq] = useState<PhrasePopInRequest | null>(null)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const handleRef = useRef<CapabilityHandle | null>(null)

  useEffect(() => {
    setPopInListener((r) => setReq(r))
    return () => setPopInListener(null)
  }, [])

  useEffect(() => {
    if (!req) return
    req.onOpen?.()
    const host = popInCapabilityHost()
    const container = bodyRef.current
    if (!host || !container) return
    let disposed = false
    const spec: ActivitySpec = {
      specId: `popin-${Date.now().toString(36)}`,
      activityType: "cap-pronounce",
      itemRefs: req.itemRef ? [req.itemRef] : [],
      params: {
        text: req.text,
        lang: req.lang,
        romanization: req.romanization,
        nativeText: req.nativeText,
        modelPolicy: "offer-install",
        maxAttempts: 3,
      },
      targetLang: req.lang,
      modelNeeds: ["stt"],
    }
    void loadCapability("cap-pronounce").then((mod) => {
      if (disposed) return
      const handle = mod.mount(container, host, spec)
      handleRef.current = handle
      void handle.result.then((result) => {
        props.onResult?.(result)
      })
    })
    return () => {
      disposed = true
      handleRef.current?.dispose()
      handleRef.current = null
      req.onClose?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req])

  return (
    <AnimatePresence>
      {req && (
        <motion.div
          className="fixed inset-0 z-[1200] flex flex-col justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label={t("journey.popin.close")}
            className="absolute inset-0 bg-black/40"
            onClick={() => setReq(null)}
          />
          <motion.div
            className="relative rounded-t-2xl border-t border-border bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold text-foreground">
                {t("journey.popin.pronounceTitle")}
              </div>
              <button
                type="button"
                onClick={() => setReq(null)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
                aria-label={t("journey.popin.close")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div ref={bodyRef} className="min-h-40" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
