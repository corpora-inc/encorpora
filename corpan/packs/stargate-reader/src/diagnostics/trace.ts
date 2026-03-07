import { traceNativeEvent } from "../audio/nativeKeepAlive"

type TraceScalar = string | number | boolean | null | undefined
export type TraceFields = Record<string, TraceScalar>
export type TraceLevel = "log" | "warn" | "error"
export type TraceOptions = {
  level?: TraceLevel
  native?: boolean
}

let traceSeq = 0
const traceStartMs =
  typeof performance !== "undefined" && Number.isFinite(performance.now())
    ? performance.now()
    : Date.now()

function getElapsedMs(): number {
  const now =
    typeof performance !== "undefined" && Number.isFinite(performance.now())
      ? performance.now()
      : Date.now()
  return Math.max(0, now - traceStartMs)
}

function formatTraceFields(fields?: TraceFields): string {
  if (!fields) return ""
  const parts: string[] = []
  const keys = Object.keys(fields).sort()
  for (const key of keys) {
    const value = fields[key]
    if (value === undefined) continue
    parts.push(`${key}=${String(value)}`)
  }
  return parts.join(" ")
}

export function srTrace(event: string, fields?: TraceFields, options: TraceOptions = {}): number {
  traceSeq += 1
  const seq = traceSeq
  const elapsedMs = getElapsedMs()
  const details = formatTraceFields(fields)
  const message =
    details.length > 0
      ? `[SR:trace] seq=${seq} t=${elapsedMs.toFixed(1)}ms event=${event} ${details}`
      : `[SR:trace] seq=${seq} t=${elapsedMs.toFixed(1)}ms event=${event}`

  const level = options.level ?? "log"
  if (level === "warn") {
    console.warn(message)
  } else if (level === "error") {
    console.error(message)
  } else {
    console.log(message)
  }

  if (options.native) {
    void traceNativeEvent({
      seq,
      elapsedMs,
      event,
      details: details.length > 0 ? details : undefined,
    })
  }

  return seq
}
