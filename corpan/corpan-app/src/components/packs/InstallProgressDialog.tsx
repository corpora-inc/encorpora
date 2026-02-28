import { useTranslation } from "react-i18next"
import { motion, AnimatePresence } from "framer-motion"
import {
  Download,
  Shield,
  Archive,
  FolderCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Check,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { InstallProgressState, InstallStage } from "@/contentPacks/installProgress"

const STAGES: { key: InstallStage; icon: typeof Download }[] = [
  { key: "downloading", icon: Download },
  { key: "verifying", icon: Shield },
  { key: "extracting", icon: Archive },
  { key: "finalizing", icon: FolderCheck },
]

const STAGE_ORDER: Record<string, number> = {
  downloading: 0,
  verifying: 1,
  extracting: 2,
  finalizing: 3,
  complete: 4,
  error: -1,
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const val = bytes / Math.pow(1024, i)
  return `${val.toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

function StageIndicator({ currentStage }: { currentStage: InstallStage }) {
  const { t } = useTranslation()
  const currentIdx = STAGE_ORDER[currentStage] ?? -1

  const stageLabels: Record<string, string> = {
    downloading: t("packs.progressDownloading"),
    verifying: t("packs.progressVerifying"),
    extracting: t("packs.progressExtracting"),
    finalizing: t("packs.progressFinalizing"),
  }

  return (
    <div className="flex items-center justify-center gap-3">
      {STAGES.map((s, idx) => {
        const Icon = s.icon
        const isCompleted = currentIdx > idx
        const isActive = currentIdx === idx

        return (
          <div key={s.key} className="flex flex-col items-center gap-1.5">
            <div
              className={`
                flex h-10 w-10 items-center justify-center rounded-full transition-colors
                ${isCompleted ? "bg-green-100 text-green-600" : ""}
                ${isActive ? "bg-primary/10 text-primary" : ""}
                ${!isCompleted && !isActive ? "bg-muted text-muted-foreground/40" : ""}
              `}
            >
              {isCompleted ? (
                <Check className="h-5 w-5" />
              ) : isActive ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Icon className="h-5 w-5" />
              )}
            </div>
            <span
              className={`text-[10px] font-medium ${
                isActive ? "text-primary" : isCompleted ? "text-green-600" : "text-muted-foreground/40"
              }`}
            >
              {stageLabels[s.key]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function ProgressBar({
  progress,
  total,
}: {
  progress: number
  total: number
}) {
  const determinate = total > 0
  const pct = determinate ? Math.min((progress / total) * 100, 100) : 0

  return (
    <div className="space-y-1.5">
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        {determinate ? (
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        ) : (
          <div className="h-full w-full animate-pulse bg-primary/30 rounded-full" />
        )}
      </div>
      {determinate ? (
        <p className="text-xs text-muted-foreground text-center">
          {formatBytes(progress)} / {formatBytes(total)}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground text-center">
          {progress > 0 ? formatBytes(progress) : ""}
        </p>
      )}
    </div>
  )
}

export function InstallProgressDialog({
  state,
  onClose,
  onRetry,
  onOpen,
}: {
  state: InstallProgressState
  onClose: () => void
  onRetry?: () => void
  onOpen?: () => void
}) {
  const { t } = useTranslation()

  const isTerminal = state.stage === "complete" || state.stage === "error"
  const isDownloading = state.stage === "downloading"
  const isInProgress =
    state.stage === "downloading" ||
    state.stage === "verifying" ||
    state.stage === "extracting" ||
    state.stage === "finalizing"

  const errorMessage =
    state.error === "stuck"
      ? t("packs.progressStuck")
      : state.error ?? t("packs.progressErrorDesc")

  return (
    <Dialog open={state.active} onOpenChange={(open) => !open && isTerminal && onClose()}>
      <DialogContent
        hideCloseButton={!isTerminal}
        className="max-w-sm"
        onInteractOutside={(e) => {
          if (!isTerminal) e.preventDefault()
        }}
        onEscapeKeyDown={(e) => {
          if (!isTerminal) e.preventDefault()
        }}
      >
        <DialogTitle className="sr-only">
          {state.stage === "complete"
            ? t("packs.progressComplete")
            : state.stage === "error"
              ? t("packs.progressFailed")
              : t("packs.installing")}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {isInProgress ? t("packs.progressWait") : ""}
        </DialogDescription>

        <div className="flex flex-col items-center gap-5 py-4">
          <AnimatePresence mode="wait">
            {state.stage === "complete" && (
              <motion.div
                key="complete"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <CheckCircle2 className="h-14 w-14 text-green-500" />
              </motion.div>
            )}
            {state.stage === "error" && (
              <motion.div
                key="error"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <AlertCircle className="h-14 w-14 text-red-500" />
              </motion.div>
            )}
            {isInProgress && (
              <motion.div
                key="progress"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <StageIndicator currentStage={state.stage} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Title text */}
          <div className="text-center space-y-1">
            <h3 className="text-lg font-semibold">
              {state.stage === "complete"
                ? t("packs.progressComplete")
                : state.stage === "error"
                  ? t("packs.progressFailed")
                  : t("packs.progressPreparing")}
            </h3>
            {state.stage === "complete" && state.packName && (
              <p className="text-sm text-muted-foreground">
                {t("packs.progressReady", { name: state.packName })}
              </p>
            )}
            {state.stage === "error" && (
              <p className="text-sm text-red-600">{errorMessage}</p>
            )}
            {isInProgress && (
              <p className="text-sm text-muted-foreground">
                {t("packs.progressWait")}
              </p>
            )}
          </div>

          {/* Progress bar (only during download) */}
          {isDownloading && (
            <div className="w-full px-2">
              <ProgressBar progress={state.progress} total={state.total} />
            </div>
          )}

          {/* Indeterminate spinner for non-download in-progress stages */}
          {isInProgress && !isDownloading && (
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          )}

          {/* Action buttons */}
          {state.stage === "complete" && (
            <div className="flex gap-2 w-full">
              {onOpen && (
                <Button onClick={onOpen} className="flex-1">
                  {t("packs.open")}
                </Button>
              )}
              <Button
                variant={onOpen ? "outline" : "default"}
                onClick={onClose}
                className={onOpen ? "" : "flex-1"}
              >
                {t("packs.close")}
              </Button>
            </div>
          )}

          {state.stage === "error" && (
            <div className="flex gap-2 w-full">
              {onRetry && (
                <Button onClick={onRetry} className="flex-1">
                  {t("packs.retry")}
                </Button>
              )}
              <Button
                variant={onRetry ? "outline" : "default"}
                onClick={onClose}
                className={onRetry ? "" : "flex-1"}
              >
                {t("packs.close")}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
