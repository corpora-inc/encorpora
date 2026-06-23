/**
 * beatlounge — the SHARED selected-groove slice.
 *
 * Proves: a single shared id, random (never-first) default, set/persist, and the
 * test reset seam. The slice is the one source of truth every groove surface binds
 * to, so picking in one place reflects everywhere.
 */

import { beforeEach, describe, expect, it } from "vitest"
import { RHYTHMS } from "../rhythm"
import {
  ensureSelectedGroove,
  peekSelectedGroove,
  selectGroove,
  __resetSelectedGrooveForTest,
} from "./selectedGroove"

beforeEach(() => __resetSelectedGrooveForTest())

describe("selectedGroove slice", () => {
  it("starts with no selection until ensured", () => {
    expect(peekSelectedGroove()).toBeNull()
  })

  it("ensure rolls a RANDOM corpus groove (never necessarily the first), and sticks", () => {
    const id = ensureSelectedGroove(() => 0.97) // high rng → late in the corpus
    expect(RHYTHMS.some((r) => r.id === id)).toBe(true)
    expect(id).not.toBe(RHYTHMS[0].id) // a high rng does NOT pick son-clave[0]
    // Idempotent: a second ensure (different rng) keeps the first choice.
    expect(ensureSelectedGroove(() => 0.01)).toBe(id)
    expect(peekSelectedGroove()).toBe(id)
  })

  it("select records a new id (shared across surfaces) and is idempotent", () => {
    const target = RHYTHMS[3].id
    selectGroove(target)
    expect(peekSelectedGroove()).toBe(target)
    selectGroove(target) // no churn
    expect(peekSelectedGroove()).toBe(target)
  })

  it("select ignores ids that aren't in the corpus", () => {
    selectGroove(RHYTHMS[2].id)
    selectGroove("not-a-real-rhythm")
    expect(peekSelectedGroove()).toBe(RHYTHMS[2].id)
  })

  it("reset clears the selection", () => {
    selectGroove(RHYTHMS[1].id)
    __resetSelectedGrooveForTest()
    expect(peekSelectedGroove()).toBeNull()
  })
})
