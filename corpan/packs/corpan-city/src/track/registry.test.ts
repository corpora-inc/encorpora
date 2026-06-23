// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest"
import { loadOrMintPlayerId, PLAYER_ID_KEY } from "./registry"

describe("stable anonymous multiplayer identity", () => {
  beforeEach(() => localStorage.clear())

  it("mints one unique-looking id and reuses it for the installation", () => {
    const first = loadOrMintPlayerId()
    const second = loadOrMintPlayerId()
    expect(first).toMatch(/^pl-[a-z0-9-]+$/i)
    expect(second).toBe(first)
    expect(localStorage.getItem(PLAYER_ID_KEY)).toBe(first)
    expect(first).not.toBe("player-local")
  })
})
