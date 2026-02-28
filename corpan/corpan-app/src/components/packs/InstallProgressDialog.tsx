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
  RefreshCw,
  ExternalLink,
  X,
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
  const currentIdx = STAGE_ORDER[currentStage] ?? -1

  return (
    <div className="flex items-center justify-center gap-2">
      {STAGES.map((s, idx) => {
        const Icon = s.icon
        const isCompleted = currentIdx > idx
        const isActive = currentIdx === idx

        return (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={`
                flex h-10 w-10 items-center justify-center rounded-full transition-colors
                ${isCompleted ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" : ""}
                ${isActive ? "bg-primary/10 text-primary" : ""}
                ${!isCompleted && !isActive ? "bg-muted text-muted-foreground/30" : ""}
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
            {idx < STAGES.length - 1 && (
              <div
                className={`h-0.5 w-4 rounded-full transition-colors ${
                  currentIdx > idx ? "bg-green-400 dark:bg-green-500" : "bg-muted"
                }`}
              />
            )}
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
      <p className="text-xs text-muted-foreground text-center tabular-nums">
        {determinate
          ? `${formatBytes(progress)} / ${formatBytes(total)}`
          : progress > 0
            ? formatBytes(progress)
            : "\u00A0"}
      </p>
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
  const isTerminal = state.stage === "complete" || state.stage === "error"
  const isDownloading = state.stage === "downloading"
  const isInProgress =
    state.stage === "downloading" ||
    state.stage === "verifying" ||
    state.stage === "extracting" ||
    state.stage === "finalizing"

  return (
    <Dialog open={state.active} onOpenChange={(open) => !open && isTerminal && onClose()}>
      <DialogContent
        hideCloseButton={!isTerminal}
        className="max-w-xs"
        onInteractOutside={(e) => {
          if (!isTerminal) e.preventDefault()
        }}
        onEscapeKeyDown={(e) => {
          if (!isTerminal) e.preventDefault()
        }}
      >
        <DialogTitle className="sr-only">
          {state.packName || "Pack install"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {state.stage}
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
                <CheckCircle2 className="h-16 w-16 text-green-500" />
              </motion.div>
            )}
            {state.stage === "error" && (
              <motion.div
                key="error"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <AlertCircle className="h-16 w-16 text-red-500" />
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

          {/* Pack name */}
          {state.packName && (
            <p className="text-sm font-medium text-muted-foreground text-center truncate max-w-full">
              {state.packName}
            </p>
          )}

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

          {/* Action buttons — icon-only */}
          {state.stage === "complete" && (
            <div className="flex gap-3 justify-center">
              {onOpen && (
                <Button
                  size="icon"
                  onClick={onOpen}
                  className="h-12 w-12 rounded-full"
                >
                  <ExternalLink className="h-5 w-5" />
                </Button>
              )}
              <Button
                size="icon"
                variant="outline"
                onClick={onClose}
                className="h-12 w-12 rounded-full"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          )}

          {state.stage === "error" && (
            <div className="flex gap-3 justify-center">
              {onRetry && (
                <Button
                  size="icon"
                  onClick={onRetry}
                  className="h-12 w-12 rounded-full"
                >
                  <RefreshCw className="h-5 w-5" />
                </Button>
              )}
              <Button
                size="icon"
                variant="outline"
                onClick={onClose}
                className="h-12 w-12 rounded-full"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
