import { describe, it, expect } from "vitest"
import { continentOf } from "./geo"

describe("geo continent map", () => {
  it("maps well-known countries to the right continent", () => {
    expect(continentOf("US")).toBe("north-america")
    expect(continentOf("JP")).toBe("asia")
    expect(continentOf("FR")).toBe("europe")
    expect(continentOf("BR")).toBe("south-america")
    expect(continentOf("NG")).toBe("africa")
    expect(continentOf("AU")).toBe("oceania")
  })

  it("is case-insensitive", () => {
    expect(continentOf("us")).toBe("north-america")
  })

  it("returns undefined for unknown / empty (→ hidden place)", () => {
    expect(continentOf("ZZ")).toBeUndefined()
    expect(continentOf(undefined)).toBeUndefined()
    expect(continentOf("")).toBeUndefined()
  })
})
