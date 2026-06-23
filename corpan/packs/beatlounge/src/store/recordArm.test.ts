import { describe, expect, it, beforeEach } from "vitest"
import { isRecordArmed, setRecordArmed, disarmAllRecord } from "./recordArm"

describe("recordArm — per-track, sticky, default OFF", () => {
  beforeEach(() => disarmAllRecord())

  it("defaults to OFF for any track", () => {
    expect(isRecordArmed("trk-a")).toBe(false)
    expect(isRecordArmed(undefined)).toBe(false)
  })

  it("arm is specific to each track (no leak across voices)", () => {
    setRecordArmed("trk-a", true)
    expect(isRecordArmed("trk-a")).toBe(true)
    // Switching to another voice shows ITS own arm — not track A's.
    expect(isRecordArmed("trk-b")).toBe(false)
    setRecordArmed("trk-b", true)
    expect(isRecordArmed("trk-a")).toBe(true)
    expect(isRecordArmed("trk-b")).toBe(true)
  })

  it("turning a track OFF sticks (and leaves others untouched)", () => {
    setRecordArmed("trk-a", true)
    setRecordArmed("trk-b", true)
    setRecordArmed("trk-a", false)
    expect(isRecordArmed("trk-a")).toBe(false)
    expect(isRecordArmed("trk-b")).toBe(true)
  })

  it("ignores a missing track id", () => {
    setRecordArmed(undefined, true)
    expect(isRecordArmed(undefined)).toBe(false)
  })

  it("disarmAll clears every track (used on whole-song replace)", () => {
    setRecordArmed("trk-a", true)
    setRecordArmed("trk-b", true)
    disarmAllRecord()
    expect(isRecordArmed("trk-a")).toBe(false)
    expect(isRecordArmed("trk-b")).toBe(false)
  })
})
