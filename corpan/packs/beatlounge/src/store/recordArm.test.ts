import { describe, expect, it, beforeEach } from "vitest"
import {
  isRecordArmed,
  setRecordArmed,
  disarmAllRecord,
  __resetRecordArmForTest,
} from "./recordArm"

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

  it("session-scoped: a reload never comes up silently armed (#391)", () => {
    // A prior session armed a track, and (to prove it can't leak back) we also
    // stash a matching entry in localStorage — what a persisted store WOULD
    // rehydrate on load.
    setRecordArmed("trk-a", true)
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("beatlounge:recordArm", JSON.stringify(["trk-a"]))
      }
    } catch {
      /* no localStorage in this env — the in-memory guarantee still holds */
    }
    // A full app reload re-initialises the store: arm is in-memory only, so it
    // must come back OFF — never silently re-armed, never quietly recording.
    __resetRecordArmForTest()
    expect(isRecordArmed("trk-a")).toBe(false)
  })
})
