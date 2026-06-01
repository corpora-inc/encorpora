// src/components/UpdatePrompt.tsx

import { motion, AnimatePresence } from "framer-motion"
import { X, Download, Sparkles } from "lucide-react"
import { useTranslation } from "react-i18next"
import { openUrl } from "@tauri-apps/plugin-opener"

import { Button } from "@/components/ui/button"
import { useLatestVersion } from "@/hooks/useLatestVersion"
import {
  selectShouldShowPrompt,
  useUpdatePromptStore,
} from "@/store/updatePrompt"

export function UpdatePrompt() {
  const { t } = useTranslation()

  // Probe latest version (throttled internally) and keep currentVersion fresh.
  useLatestVersion()

  const show = useUpdatePromptStore(selectShouldShowPrompt)
  const latestVersion = useUpdatePromptStore((s) => s.latestVersion)
  const latestStoreUrl = useUpdatePromptStore((s) => s.latestStoreUrl)
  const dismissCurrent = useUpdatePromptStore((s) => s.dismissCurrent)
  const remindLater = useUpdatePromptStore((s) => s.remindLater)

  const handleUpdate = async () => {
    dismissCurrent()
    if (!latestStoreUrl) return
    try {
      await openUrl(latestStoreUrl)
    } catch {
      // openUrl may fail on unusual platforms — silent is fine, the user can
      // navigate to the store themselves from the About panel.
    }
  }

  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/25 backdrop-blur-sm z-100"
            onClick={remindLater}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-101 w-[90%] max-w-md"
          >
            <div className="bg-background rounded-3xl shadow-2xl p-6 sm:p-7 relative overflow-hidden border border-black/5">
              <button
                onClick={remindLater}
                className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label={t("update.close" as any)}
              >
                <X size={24} />
              </button>

              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  delay: 0.1,
                  type: "spring",
                  stiffness: 220,
                  damping: 18,
                }}
                className="flex justify-center mb-4"
              >
                <div className="bg-linear-to-br from-emerald-400 to-emerald-600 rounded-full p-4 shadow-md">
                  <Sparkles className="text-white" size={30} />
                </div>
              </motion.div>

              <motion.h3
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="text-xl font-semibold text-center text-foreground mb-1"
              >
                {t("update.title" as any)}
              </motion.h3>

              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-center text-muted-foreground mb-2 text-sm leading-relaxed"
              >
                {t("update.description" as any)}
              </motion.p>

              {latestVersion && (
                <motion.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="text-center text-muted-foreground mb-5 text-xs leading-snug"
                >
                  {t("update.versionLine" as any, { version: latestVersion })}
                </motion.p>
              )}

              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex flex-col gap-2"
              >
                <Button
                  onClick={handleUpdate}
                  size="lg"
                  className="w-full justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <Download className="h-4 w-4" />
                  {t("update.updateNow" as any)}
                </Button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground"
              >
                <button
                  onClick={remindLater}
                  className="underline-offset-2 hover:underline cursor-pointer"
                >
                  {t("update.remindLater" as any)}
                </button>

                <button
                  onClick={dismissCurrent}
                  className="underline-offset-2 hover:underline cursor-pointer"
                >
                  {t("update.skipThisVersion" as any)}
                </button>
              </motion.div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
