import { useEffect, useMemo, useState } from "react"
import { Copy, RefreshCw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  useDiagnosticsStore,
  hasDiagnosticFailures,
  formatDiagnostics,
  type DiagEntry,
} from "@/store/diagnostics"
import { getAppVersion } from "@/lib/appVersion"

/**
 * Visible-in-UI diagnostics for IAP failures.
 *
 * Appears only when the diagnostics ring buffer contains at least one
 * non-OK entry in this session. On the happy path, renders nothing.
 *
 * Gives reviewers (and us, supporting users) an inline, screenshot-able,
 * copyable record of what StoreKit or Play Billing actually said — which
 * we can't get any other way from a remote device.
 */
export function DiagnosticsStrip({ onRetry }: { onRetry?: () => void }) {
  const entries = useDiagnosticsStore((s) => s.entries)
  const clear = useDiagnosticsStore((s) => s.clear)
  const [expanded, setExpanded] = useState(false)
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle")
  const [appVersion, setAppVersion] = useState<string>("")

  useEffect(() => {
    getAppVersion().then(setAppVersion).catch(() => {})
  }, [])

  const showStrip = useMemo(() => hasDiagnosticFailures(entries), [entries])
  if (!showStrip) return null

  const latestFailure = entries.find((e) => e.result !== "ok")
  const summary = summarize(latestFailure)

  const handleCopy = async () => {
    const text = formatDiagnostics(entries, appVersion)
    try {
      await navigator.clipboard.writeText(text)
      setCopyStatus("copied")
      window.setTimeout(() => setCopyStatus("idle"), 2000)
    } catch {
      console.warn("[DiagnosticsStrip] clipboard write failed; falling back to console")
      console.log(text)
    }
  }

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <span className="text-amber-900 dark:text-amber-100 font-medium">
          {summary}
        </span>
        <button
          type="button"
          aria-label="Dismiss diagnostics"
          onClick={clear}
          className="text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-amber-800 dark:text-amber-200 underline underline-offset-2"
        >
          {expanded ? "Hide details" : "Show details"}
        </button>
        {onRetry ? (
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-[11px]"
            onClick={onRetry}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="outline"
          className="h-6 px-2 text-[11px]"
          onClick={handleCopy}
        >
          <Copy className="h-3 w-3 mr-1" />
          {copyStatus === "copied" ? "Copied" : "Copy diagnostics"}
        </Button>
      </div>

      {expanded ? (
        <pre className="mt-2 max-h-40 overflow-auto rounded bg-amber-100/60 dark:bg-amber-900/30 p-2 font-mono text-[10px] leading-relaxed text-amber-950 dark:text-amber-100">
          {formatDiagnostics(entries, appVersion)}
        </pre>
      ) : null}
    </div>
  )
}

function summarize(entry: DiagEntry | undefined): string {
  if (!entry) return "IAP diagnostics"
  if (entry.category === "fetch" && entry.result === "empty") {
    return "Couldn't load store products"
  }
  if (entry.category === "fetch" && entry.result === "error") {
    return "Store product fetch failed"
  }
  if (entry.category === "purchase" && entry.result === "error") {
    return entry.detail ?? "Purchase failed"
  }
  return entry.detail ?? "IAP issue"
}
