/**
 * beatlounge — the LLM tool protocol (text-only; NO native tool/JSON API).
 *
 * The on-device Qwen3 4B emits, after a tiny rationale, ONE delimited block:
 *
 *     <<tool>>{ "name": "density", "args": { "drum": "hat", "dir": "more" } }<</tool>>
 *
 * We stream with `stop: ["<</tool>>"]` (the proven corpan-city pattern) so the
 * model can't ramble past its single call. This module owns:
 *   • buildSystemPrompt — renders the CLOSED grammar + few-shot + a compact
 *     ASCII view of the CURRENT grid.
 *   • parseToolBlock — extracts + TOLERANTLY repairs the JSON (single→double
 *     quotes, trailing commas, k=v syntax, missing braces).
 *   • validateToolCall — coerces/clamps args against the closed catalog, drops
 *     unknown args, defaults missing ones, rejects unknown tools.
 *   • buildRepairMessage — the one-shot retry nudge when parse/validate fails.
 *
 * Everything is pure + synchronous so it is exhaustively unit-testable.
 */

import type { BeatloungeDoc } from "../model/document"
import { DRUM_PITCH, isInstrumentTrack } from "../model/document"
import { stepsInLoop, tickForStep } from "../model/timing"
import { MOOD_NAMES, TOOL_BY_NAME, TOOL_SPECS, type ToolParam } from "./tools"

export const TOOL_OPEN = "<<tool>>"
export const TOOL_CLOSE = "<</tool>>"

export interface ToolCall {
  name: string
  args: Record<string, unknown>
}

export type ParseResult =
  | { ok: true; call: ToolCall }
  | { ok: false; reason: string }

// ----------------------------------------------------------------- system prompt
const renderParam = (name: string, p: ToolParam): string => {
  const bits: string[] = [p.type]
  if (p.options) bits.push(`one of [${p.options.join(", ")}]`)
  if (p.min != null || p.max != null) bits.push(`${p.min ?? "-"}..${p.max ?? "-"}`)
  if (p.default != null) bits.push(`default ${JSON.stringify(p.default)}`)
  if (p.required) bits.push("required")
  return `      - ${name} (${bits.join(", ")}): ${p.describe}`
}

const renderTool = (name: string): string => {
  const spec = TOOL_BY_NAME[name]
  const params = Object.entries(spec.params)
    .map(([pn, p]) => renderParam(pn, p))
    .join("\n")
  return `  • ${spec.name} — ${spec.describe}\n${params || "      (no args)"}`
}

/** A compact ASCII snapshot of the loop so the model "sees" the current grid. */
export const renderGrid = (doc: BeatloungeDoc): string => {
  const lines: string[] = []
  lines.push(`tempo ${doc.bpm} bpm · swing ${(doc.swing.amount).toFixed(2)} · loop ${doc.loopLengthTicks}t`)
  const drumName = (pitch: number): string => {
    for (const [n, p] of Object.entries(DRUM_PITCH)) if (p === pitch) return n
    return `p${pitch}`
  }
  for (const track of doc.tracks) {
    if (!isInstrumentTrack(track)) continue
    const steps = Math.min(32, stepsInLoop(doc.loopLengthTicks, track.grid))
    if (track.instrument.kind === "drumSampler") {
      // One row per active drum lane.
      const pitches = [...new Set(track.notes.map((n) => n.pitch))].sort((a, b) => a - b)
      const lanes = pitches.length ? pitches : [DRUM_PITCH.kick, DRUM_PITCH.snare, DRUM_PITCH.hat]
      for (const pitch of lanes) {
        const cells: string[] = []
        const cellTicks = tickForStep(1, track.grid) || 1
        const hits = new Set(
          track.notes.filter((n) => n.pitch === pitch).map((n) => Math.round(n.tick / cellTicks)),
        )
        for (let s = 0; s < steps; s++) cells.push(hits.has(s) ? "x" : ".")
        lines.push(`  ${drumName(pitch).padEnd(5)} |${cells.join("")}|`)
      }
    } else {
      lines.push(`  ${track.name.slice(0, 5).padEnd(5)} |${track.notes.length} notes|`)
    }
  }
  return lines.join("\n")
}

const FEW_SHOT = [
  ['"make it faster"', '{ "name": "setTempo", "args": { "bpm": 128 } }'],
  ['"more hihats"', '{ "name": "density", "args": { "drum": "hat", "dir": "more" } }'],
  ['"give it a latin feel"', '{ "name": "setMood", "args": { "mood": "latin" } }'],
  ['"tresillo on the kick"', '{ "name": "euclid", "args": { "drum": "kick", "pulses": 3, "steps": 8 } }'],
  ['"loosen up the drums"', '{ "name": "humanize", "args": { "amount": 0.5 } }'],
] as const

export const buildSystemPrompt = (doc: BeatloungeDoc): string => {
  const tools = TOOL_SPECS.map((t) => renderTool(t.name)).join("\n")
  const shots = FEW_SHOT.map(([u, a]) => `User: ${u}\nYou: ${TOOL_OPEN}${a}${TOOL_CLOSE}`).join("\n")
  return [
    "You are the beat assistant inside a music app. The user describes a change to the loop in plain language. You reply with EXACTLY ONE tool call and nothing else.",
    "",
    "Format — emit one block, no prose before or after:",
    `${TOOL_OPEN}{ "name": "<tool>", "args": { ... } }${TOOL_CLOSE}`,
    "",
    "Rules:",
    "- Pick the SINGLE tool that best matches the request.",
    "- Use ONLY the tools and args below. Omit args you are unsure of (they default).",
    "- Numbers only where numbers are asked. Never invent tools or args.",
    `- moods are exactly: ${MOOD_NAMES.join(", ")}.`,
    "",
    "Tools:",
    tools,
    "",
    "Current loop:",
    renderGrid(doc),
    "",
    "Examples:",
    shots,
  ].join("\n")
}

/** The one-shot repair nudge appended as a user turn after a bad first reply. */
export const buildRepairMessage = (raw: string, reason: string): string =>
  [
    `Your last reply could not be used (${reason}).`,
    `It was: ${raw.slice(0, 200)}`,
    `Reply again with EXACTLY ONE ${TOOL_OPEN}{ "name": ..., "args": {...} }${TOOL_CLOSE} block, no other text.`,
  ].join("\n")

// ----------------------------------------------------------------- parsing
/**
 * Extract the inner text of the tool block from a (possibly partial / prose-
 * wrapped) model reply. Tolerant: the closing delimiter may be absent (we
 * streamed with it as a stop token, so it's usually stripped), and there may be
 * rationale prose before the opener.
 */
export const extractToolBody = (raw: string): string | null => {
  const openIdx = raw.indexOf(TOOL_OPEN)
  if (openIdx === -1) {
    // No delimiter at all — maybe the model emitted a bare object. Try to find one.
    const brace = raw.indexOf("{")
    return brace === -1 ? null : raw.slice(brace)
  }
  let body = raw.slice(openIdx + TOOL_OPEN.length)
  const closeIdx = body.indexOf(TOOL_CLOSE)
  if (closeIdx !== -1) body = body.slice(0, closeIdx)
  return body.trim()
}

/** Slice out the first balanced {...} object from a string (ignores braces in
 *  strings). Returns null if no balanced object is found. */
const firstObject = (s: string): string | null => {
  const start = s.indexOf("{")
  if (start === -1) return null
  let depth = 0
  let inStr = false
  let quote = ""
  for (let i = start; i < s.length; i++) {
    const ch = s[i]
    if (inStr) {
      if (ch === "\\") { i++; continue }
      if (ch === quote) inStr = false
      continue
    }
    if (ch === '"' || ch === "'") { inStr = true; quote = ch; continue }
    if (ch === "{") depth++
    else if (ch === "}") {
      depth--
      if (depth === 0) return s.slice(start, i + 1)
    }
  }
  // Unbalanced (truncated) — return from the first brace; repair will close it.
  return s.slice(start)
}

/**
 * Tolerant JSON repair for small model outputs:
 *  - strip JS line/block comments
 *  - convert k=v / k:v (bareword keys) to quoted JSON keys
 *  - single → double quotes
 *  - quote bareword string values (e.g. drum: hat)
 *  - strip trailing commas
 *  - balance a single missing closing brace
 */
export const repairJson = (input: string): string => {
  let s = input.trim()
  // Strip comments.
  s = s.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "")
  // Normalize `key = value` to `key : value` (only for bareword keys).
  s = s.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*=/g, '$1$2:')
  // Quote bareword keys:  { name: ... } → { "name": ... }
  s = s.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')
  // Single-quoted strings → double-quoted.
  s = s.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_m, inner) => `"${String(inner).replace(/"/g, '\\"')}"`)
  // Quote bareword string values:  "drum": hat  → "drum": "hat"
  //   (value is a non-numeric, non-keyword, non-{[ token up to , } or end)
  s = s.replace(/:\s*([A-Za-z_][A-Za-z0-9_-]*)\s*(?=[,}\]]|$)/g, (m, word) => {
    if (word === "true" || word === "false" || word === "null") return m
    return `: "${word}"`
  })
  // Strip trailing commas before } or ].
  s = s.replace(/,\s*([}\]])/g, "$1")
  // Balance braces: if more { than }, append the difference (truncated stream).
  const opens = (s.match(/{/g) || []).length
  const closes = (s.match(/}/g) || []).length
  if (opens > closes) s += "}".repeat(opens - closes)
  return s
}

/** Parse a model reply into a (name, args) call — tolerant, never throws. */
export const parseToolBlock = (raw: string): ParseResult => {
  const body = extractToolBody(raw)
  if (body == null) return { ok: false, reason: "no tool block" }
  const objStr = firstObject(body)
  if (objStr == null) return { ok: false, reason: "no JSON object" }

  let obj: unknown
  try {
    obj = JSON.parse(objStr)
  } catch {
    try {
      obj = JSON.parse(repairJson(objStr))
    } catch (e) {
      return { ok: false, reason: `unparseable JSON: ${(e as Error).message}` }
    }
  }
  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) {
    return { ok: false, reason: "not an object" }
  }
  const rec = obj as Record<string, unknown>
  // Accept {name, args}, or a flat {tool, ...} / {name, ...} shape.
  const name =
    typeof rec.name === "string"
      ? rec.name
      : typeof rec.tool === "string"
        ? rec.tool
        : undefined
  if (!name) return { ok: false, reason: "missing tool name" }
  let args: Record<string, unknown>
  if (rec.args && typeof rec.args === "object" && !Array.isArray(rec.args)) {
    args = rec.args as Record<string, unknown>
  } else {
    // Flat shape: everything except name/tool is an arg.
    const { name: _n, tool: _t, ...rest } = rec
    void _n
    void _t
    args = rest
  }
  return { ok: true, call: { name, args } }
}

// ----------------------------------------------------------------- validation
export type ValidateResult =
  | { ok: true; call: ToolCall }
  | { ok: false; reason: string }

const coerceParam = (p: ToolParam, raw: unknown): unknown | undefined => {
  switch (p.type) {
    case "number":
    case "int": {
      let n = typeof raw === "number" ? raw : Number(String(raw).replace(/[^0-9.+-]/g, ""))
      if (!Number.isFinite(n)) return undefined
      if (p.type === "int") n = Math.round(n)
      if (p.min != null) n = Math.max(p.min, n)
      if (p.max != null) n = Math.min(p.max, n)
      return n
    }
    case "enum": {
      const s = String(raw)
      if (p.options && !p.options.includes(s)) return undefined
      return s
    }
    case "drum":
      // Free text resolved later by resolveDrumPitch; keep the string.
      return raw == null ? undefined : String(raw)
    default:
      return raw
  }
}

/**
 * Validate + normalize a parsed call against the CLOSED catalog: unknown tool →
 * reject; unknown args dropped; each known arg coerced/clamped; missing args
 * filled from defaults (so `build()` always receives sane values).
 */
export const validateToolCall = (call: ToolCall): ValidateResult => {
  const spec = TOOL_BY_NAME[call.name]
  if (!spec) return { ok: false, reason: `unknown tool "${call.name}"` }
  const out: Record<string, unknown> = {}
  for (const [pn, p] of Object.entries(spec.params)) {
    const present = pn in call.args
    if (present) {
      const coerced = coerceParam(p, call.args[pn])
      if (coerced !== undefined) {
        out[pn] = coerced
        continue
      }
    }
    if (p.default !== undefined) out[pn] = p.default
    else if (p.required) {
      // A required arg with no usable value and no default: leave it out and let
      // build() apply its own internal default (build() never trusts the model).
    }
  }
  return { ok: true, call: { name: call.name, args: out } }
}

/** One call: parse → validate. Returns the normalized call or a reason. */
export const interpretReply = (raw: string): ValidateResult => {
  const parsed = parseToolBlock(raw)
  if (!parsed.ok) return parsed
  return validateToolCall(parsed.call)
}
