/**
 * beatlounge — protocol tests: the parser/repair/validate pipeline against the
 * MESSY outputs a 4B model actually produces (prose, missing braces, k=v,
 * single quotes, trailing commas, bareword values, flat shapes).
 */

import { describe, expect, it } from "vitest"
import {
  buildSystemPrompt,
  extractToolBody,
  interpretReply,
  parseToolBlock,
  renderGrid,
  repairJson,
  TOOL_CLOSE,
  TOOL_OPEN,
  validateToolCall,
} from "./protocol"
import { createDefaultDoc } from "../model/document"

const wrap = (body: string) => `${TOOL_OPEN}${body}${TOOL_CLOSE}`

describe("extractToolBody", () => {
  it("pulls the body out of a delimited block", () => {
    expect(extractToolBody(wrap('{"name":"setTempo"}'))).toBe('{"name":"setTempo"}')
  })
  it("tolerates a missing closing delimiter (stop-token stripped)", () => {
    expect(extractToolBody(`${TOOL_OPEN}{"name":"setTempo"}`)).toBe('{"name":"setTempo"}')
  })
  it("ignores rationale prose before the opener", () => {
    const raw = `Sure, let's speed it up.\n${TOOL_OPEN}{"name":"setTempo","args":{"bpm":130}}${TOOL_CLOSE}`
    expect(extractToolBody(raw)).toBe('{"name":"setTempo","args":{"bpm":130}}')
  })
  it("falls back to a bare object when there's no delimiter", () => {
    expect(extractToolBody('here: {"name":"density"}')).toBe('{"name":"density"}')
  })
  it("returns null when there's nothing object-like", () => {
    expect(extractToolBody("I cannot help with that")).toBeNull()
  })
})

describe("repairJson", () => {
  it("quotes bareword keys", () => {
    expect(JSON.parse(repairJson("{name: 'setTempo'}"))).toEqual({ name: "setTempo" })
  })
  it("converts k=v to k:v", () => {
    expect(JSON.parse(repairJson("{name='density'}"))).toEqual({ name: "density" })
  })
  it("quotes bareword string values", () => {
    expect(JSON.parse(repairJson("{drum: hat, dir: more}"))).toEqual({ drum: "hat", dir: "more" })
  })
  it("strips trailing commas", () => {
    expect(JSON.parse(repairJson('{"a":1,"b":2,}'))).toEqual({ a: 1, b: 2 })
  })
  it("balances a missing closing brace (truncated stream)", () => {
    expect(JSON.parse(repairJson('{"name":"density","args":{"dir":"more"'))).toEqual({
      name: "density",
      args: { dir: "more" },
    })
  })
  it("leaves true/false/null unquoted", () => {
    expect(JSON.parse(repairJson("{reverse: true, x: null}"))).toEqual({ reverse: true, x: null })
  })
})

describe("parseToolBlock", () => {
  it("parses clean JSON", () => {
    const r = parseToolBlock(wrap('{"name":"setTempo","args":{"bpm":120}}'))
    expect(r).toEqual({ ok: true, call: { name: "setTempo", args: { bpm: 120 } } })
  })
  it("repairs single quotes + trailing comma", () => {
    const r = parseToolBlock(wrap("{'name':'density','args':{'dir':'more',}}"))
    expect(r.ok && r.call).toEqual({ name: "density", args: { dir: "more" } })
  })
  it("repairs bareword keys and values", () => {
    const r = parseToolBlock(wrap("{name: setMood, args: {mood: latin}}"))
    expect(r.ok && r.call).toEqual({ name: "setMood", args: { mood: "latin" } })
  })
  it("accepts a flat shape ({name, ...args})", () => {
    const r = parseToolBlock(wrap('{"name":"setTempo","bpm":90}'))
    expect(r.ok && r.call).toEqual({ name: "setTempo", args: { bpm: 90 } })
  })
  it("accepts {tool} as the name key", () => {
    const r = parseToolBlock(wrap('{"tool":"humanize","args":{"amount":0.5}}'))
    expect(r.ok && r.call).toEqual({ name: "humanize", args: { amount: 0.5 } })
  })
  it("handles a truncated (no-close) block with k=v", () => {
    const r = parseToolBlock(`${TOOL_OPEN}{name=density, args={drum=kick, dir=more`)
    expect(r.ok && r.call.name).toBe("density")
    expect(r.ok && r.call.args).toMatchObject({ drum: "kick", dir: "more" })
  })
  it("fails cleanly on pure prose", () => {
    const r = parseToolBlock("I'm not sure what you mean.")
    expect(r.ok).toBe(false)
  })
  it("fails on a missing name", () => {
    const r = parseToolBlock(wrap('{"args":{"bpm":120}}'))
    expect(r.ok).toBe(false)
  })
})

describe("validateToolCall", () => {
  it("rejects an unknown tool", () => {
    expect(validateToolCall({ name: "explode", args: {} }).ok).toBe(false)
  })
  it("clamps a number arg to range", () => {
    const r = validateToolCall({ name: "setTempo", args: { bpm: 9999 } })
    expect(r.ok && r.call.args.bpm).toBe(220)
  })
  it("rounds an int arg", () => {
    const r = validateToolCall({ name: "setTempo", args: { bpm: 121.7 } })
    expect(r.ok && r.call.args.bpm).toBe(122)
  })
  it("coerces a stringy number with units", () => {
    const r = validateToolCall({ name: "setTempo", args: { bpm: "128 bpm" } })
    expect(r.ok && r.call.args.bpm).toBe(128)
  })
  it("drops an unknown arg", () => {
    const r = validateToolCall({ name: "setTempo", args: { bpm: 100, color: "red" } })
    expect(r.ok && r.call.args).toEqual({ bpm: 100 })
  })
  it("fills a missing arg from default", () => {
    const r = validateToolCall({ name: "density", args: {} })
    expect(r.ok && r.call.args).toMatchObject({ dir: "more", drum: "hat" })
  })
  it("rejects an out-of-set enum (no usable value) and uses default", () => {
    const r = validateToolCall({ name: "density", args: { dir: "sideways" } })
    expect(r.ok && r.call.args.dir).toBe("more")
  })
  it("keeps a valid enum", () => {
    const r = validateToolCall({ name: "setMood", args: { mood: "dark" } })
    expect(r.ok && r.call.args.mood).toBe("dark")
  })
})

describe("interpretReply (parse + validate)", () => {
  it("end-to-end on a messy reply", () => {
    const raw = `Let's brighten it.\n${TOOL_OPEN}{name: setMood, args: {mood: 'dreamy',}`
    const r = interpretReply(raw)
    expect(r.ok && r.call).toEqual({ name: "setMood", args: { mood: "dreamy" } })
  })
})

describe("buildSystemPrompt + renderGrid", () => {
  const doc = createDefaultDoc(0)
  it("lists every tool by name", () => {
    const p = buildSystemPrompt(doc)
    for (const name of ["setTempo", "setSwing", "density", "setMood", "euclid", "humanize"]) {
      expect(p).toContain(name)
    }
  })
  it("renders the current tempo + an ASCII drum grid", () => {
    const grid = renderGrid(doc)
    expect(grid).toContain("tempo 96 bpm")
    expect(grid).toMatch(/kick\s+\|[x.]+\|/)
  })
  it("includes the delimiter format + few-shots", () => {
    const p = buildSystemPrompt(doc)
    expect(p).toContain(TOOL_OPEN)
    expect(p).toContain("more hihats")
  })
})
