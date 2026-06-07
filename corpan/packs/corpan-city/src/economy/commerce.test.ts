import { describe, it, expect, beforeEach } from "vitest"
import { createInventory, type InventoryStore } from "./inventory"
import { DEFAULT_CURRENCY_ID } from "./currencies"
import {
  resolveNpcOffer,
  canAcceptOffer,
  applyNpcOffer,
  type NpcOffer,
} from "./npcOffer"
import { composeAvatar } from "./wardrobe"
import { dressFromAvatar, dressToAvatar, defaultDress } from "../onboarding/onboarding"
import {
  setTradeTransportProvider,
  getTradeTransport,
  hasP2pTrade,
  runTrade,
} from "./p2pTrade"
import { LocalTradeTransport, type TradeProposal } from "./trade"
import { AvatarSpec, type CosmeticSlot } from "@corpan-city/contracts"
import { avatarToCharacterSpec } from "../character/characterSpec"

/* ---- a synchronous in-memory localStorage shim for the node test env ---- */
class MemStorage {
  private m = new Map<string, string>()
  getItem(k: string) {
    return this.m.has(k) ? (this.m.get(k) as string) : null
  }
  setItem(k: string, v: string) {
    this.m.set(k, v)
  }
  removeItem(k: string) {
    this.m.delete(k)
  }
  clear() {
    this.m.clear()
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null
  }
  get length() {
    return this.m.size
  }
}
beforeEach(() => {
  ;(globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage()
  ;(globalThis as unknown as { DOMException: typeof Error }).DOMException ??= Error as never
  setTradeTransportProvider(null)
})

const CUR = DEFAULT_CURRENCY_ID

function freshStore(): InventoryStore {
  return createInventory({ namespace: `test-${Math.random().toString(36).slice(2)}` })
}

/* ============================================================ NPC offers */

describe("npcOffer — deterministic generation", () => {
  it("is stable for a given (npcId, visit) seed", () => {
    const store = freshStore()
    const input = {
      npcId: "marta",
      npcName: "Marta",
      visit: 0,
      currencyId: CUR,
      stock: ["straw-hat", "linen-shirt", "lucky-charm"],
      store,
    }
    const a = resolveNpcOffer(input)
    const b = resolveNpcOffer(input)
    expect(a).not.toBeNull()
    expect(a).toEqual(b) // deterministic — same seed → same deal
  })

  it("rotates the deal across visits", () => {
    const store = freshStore()
    const base = {
      npcName: "Marta",
      currencyId: CUR,
      stock: ["straw-hat", "linen-shirt", "feathered-cap", "coffee-sack"],
      store,
    }
    const v0 = resolveNpcOffer({ ...base, npcId: "marta", visit: 0 })
    const v1 = resolveNpcOffer({ ...base, npcId: "marta", visit: 1 })
    // At least one of the resolvable fields differs across two visits (item/price).
    expect(v0).not.toBeNull()
    expect(v1).not.toBeNull()
    expect(JSON.stringify(v0)).not.toEqual(JSON.stringify(v1))
  })

  it("returns null when the NPC has no tradable stock", () => {
    const store = freshStore()
    const offer = resolveNpcOffer({
      npcId: "x",
      npcName: "X",
      currencyId: CUR,
      stock: [], // nothing to deal
      store,
    })
    expect(offer).toBeNull()
  })

  it("biases to a SELL when the player holds junk-for-quest clutter", () => {
    const store = freshStore()
    store.grant("coffee-sack", 1) // a tradable trade-good — junk for an unknown quest
    const offer = resolveNpcOffer({
      npcId: "buyer",
      npcName: "Buyer",
      currencyId: CUR,
      stock: ["straw-hat"],
      store,
      questId: "some-unrelated-quest",
    })
    expect(offer?.kind).toBe("sell")
    expect(offer?.itemId).toBe("coffee-sack")
  })
})

describe("npcOffer — apply is atomic + gated", () => {
  it("BUY debits funds and grants the item", () => {
    const store = freshStore()
    store.addCoins(1000)
    const offer: NpcOffer = {
      kind: "buy",
      npcName: "N",
      pitch: "deal?",
      itemId: "straw-hat",
      currencyId: CUR,
      price: 28,
    }
    expect(canAcceptOffer(store, offer).ok).toBe(true)
    const before = store.coins()
    expect(applyNpcOffer(store, offer).ok).toBe(true)
    expect(store.coins()).toBe(before - 28)
    expect(store.qtyOf("straw-hat")).toBe(1)
  })

  it("BUY refuses when the player can't afford it — no mutation", () => {
    const store = freshStore()
    store.addCoins(5)
    const offer: NpcOffer = {
      kind: "buy",
      npcName: "N",
      pitch: "",
      itemId: "feathered-cap",
      currencyId: CUR,
      price: 198,
    }
    expect(canAcceptOffer(store, offer).reason).toBe("insufficient-funds")
    const res = applyNpcOffer(store, offer)
    expect(res.ok).toBe(false)
    expect(store.coins()).toBe(5) // untouched
    expect(store.qtyOf("feathered-cap")).toBe(0)
  })

  it("SELL consumes the item and credits funds", () => {
    const store = freshStore()
    store.grant("lucky-charm", 1)
    const offer: NpcOffer = {
      kind: "sell",
      npcName: "N",
      pitch: "",
      itemId: "lucky-charm",
      currencyId: CUR,
      price: 13,
    }
    expect(applyNpcOffer(store, offer).ok).toBe(true)
    expect(store.qtyOf("lucky-charm")).toBe(0)
    expect(store.coins()).toBe(13)
  })

  it("SELL refuses when the player no longer holds the item", () => {
    const store = freshStore()
    const offer: NpcOffer = {
      kind: "sell",
      npcName: "N",
      pitch: "",
      itemId: "lucky-charm",
      currencyId: CUR,
      price: 13,
    }
    expect(applyNpcOffer(store, offer).reason).toBe("missing-item")
    expect(store.coins()).toBe(0)
  })

  it("SWAP consumes the wanted item and grants the offered one", () => {
    const store = freshStore()
    store.grant("coffee-sack", 1)
    const offer: NpcOffer = {
      kind: "swap",
      npcName: "N",
      pitch: "",
      itemId: "straw-hat",
      wantItemId: "coffee-sack",
      currencyId: CUR,
      price: 0,
    }
    expect(applyNpcOffer(store, offer).ok).toBe(true)
    expect(store.qtyOf("coffee-sack")).toBe(0)
    expect(store.qtyOf("straw-hat")).toBe(1)
  })

  it("BUY of an owned non-stackable cosmetic is gated as owned", () => {
    const store = freshStore()
    store.addCoins(1000)
    store.grant("straw-hat", 1)
    const offer: NpcOffer = {
      kind: "buy",
      npcName: "N",
      pitch: "",
      itemId: "straw-hat",
      currencyId: CUR,
      price: 28,
    }
    expect(canAcceptOffer(store, offer).reason).toBe("owned")
    expect(applyNpcOffer(store, offer).ok).toBe(false)
  })
})

/* ============================================================ wardrobe */

describe("wardrobe — avatar composition", () => {
  it("composeAvatar overlays worn catalog cosmetics on the starter dress", () => {
    const dress = defaultDress()
    dress.topId = "top-tunic"
    const worn = new Map<CosmeticSlot, { itemId: string; tint?: string }>([
      ["top", { itemId: "traveler-coat", tint: "#445" }],
      ["aura", { itemId: "festival-aura" }],
    ])
    const avatar = composeAvatar(dress, worn)
    const top = avatar.layers.find((l) => l.slot === "top")
    const aura = avatar.layers.find((l) => l.slot === "aura")
    // The bought coat REPLACES the starter top in the top slot.
    expect(top?.itemId).toBe("traveler-coat")
    // The aura is a NEW slot the starter kit never filled.
    expect(aura?.itemId).toBe("festival-aura")
    // Skin/face is preserved from the dress base.
    expect(avatar.palette?.skin).toBe(dress.skin)
    // The composed avatar is a VALID AvatarSpec the figure builder accepts (this
    // is exactly what player.redress feeds avatarToCharacterSpec — no throw).
    expect(() => AvatarSpec.parse(avatar)).not.toThrow()
    expect(() => avatarToCharacterSpec(avatar, "player-local")).not.toThrow()
  })

  it("dressFromAvatar round-trips a starter dress through dressToAvatar", () => {
    const dress = defaultDress()
    dress.topId = "top-vest"
    dress.hatId = "hat-sun"
    dress.skin = "#a06a3c"
    const avatar = dressToAvatar(dress)
    const back = dressFromAvatar(avatar)
    expect(back.topId).toBe("top-vest")
    expect(back.hatId).toBe("hat-sun")
    expect(back.skin).toBe("#a06a3c")
  })

  it("dressFromAvatar collapses an unknown (catalog) top id to the base, never crashing", () => {
    const avatar = {
      base: "paper-doll-a",
      layers: [
        { slot: "face" as CosmeticSlot, itemId: "face-base", tint: "#f0c79a" },
        { slot: "top" as CosmeticSlot, itemId: "traveler-coat", tint: "#234" }, // catalog id the doll can't draw
      ],
      palette: { skin: "#f0c79a" },
    }
    const back = dressFromAvatar(avatar)
    // unknown top id is not a starter option → keeps the default base top (no throw).
    expect(back.topId).toBe(defaultDress().topId)
  })
})

/* ============================================================ P2P trade */

describe("p2pTrade — transport seam + anti-cheat", () => {
  it("falls back to a local stub when no provider is registered (solo)", () => {
    expect(hasP2pTrade()).toBe(false)
    const { transport, live } = getTradeTransport("a", "b")
    expect(live).toBe(false)
    expect(transport).toBeInstanceOf(LocalTradeTransport)
  })

  it("uses the registered net provider when present", () => {
    let asked: [string, string] | null = null
    setTradeTransportProvider((from, to) => {
      asked = [from, to]
      return new LocalTradeTransport("accept")
    })
    expect(hasP2pTrade()).toBe(true)
    const { live } = getTradeTransport("me", "you")
    expect(live).toBe(true)
    expect(asked).toEqual(["me", "you"])
  })

  it("runs a solo trade end-to-end and applies OUR side only", async () => {
    const store = freshStore()
    store.grant("coffee-sack", 1)
    const res = await runTrade({
      store,
      fromPlayerId: "me",
      toPlayerId: "partner",
      offer: { items: [{ itemId: "coffee-sack", qty: 1 }], coins: 0 },
      request: { items: [{ itemId: "spices-cinnamon", qty: 1 }], coins: 0 },
      localBehavior: "accept",
    })
    expect(res.status).toBe("applied")
    expect(res.live).toBe(false)
    // we gave the coffee, received the cinnamon (our side applied)
    expect(store.qtyOf("coffee-sack")).toBe(0)
    expect(store.qtyOf("spices-cinnamon")).toBe(1)
  })

  it("rejects an invalid proposal (offering an item you don't own) before sending", async () => {
    const store = freshStore()
    const res = await runTrade({
      store,
      fromPlayerId: "me",
      toPlayerId: "partner",
      offer: { items: [{ itemId: "coffee-sack", qty: 5 }], coins: 0 }, // not owned
      request: { items: [{ itemId: "spices-cinnamon", qty: 1 }], coins: 0 },
    })
    expect(res.status).toBe("invalid")
    expect(res.reasons?.some((r) => r.startsWith("insufficient"))).toBe(true)
  })

  it("a declined partner resolves as declined with no mutation", async () => {
    const store = freshStore()
    store.grant("coffee-sack", 1)
    const res = await runTrade({
      store,
      fromPlayerId: "me",
      toPlayerId: "partner",
      offer: { items: [{ itemId: "coffee-sack", qty: 1 }], coins: 0 },
      request: { items: [{ itemId: "spices-cinnamon", qty: 1 }], coins: 0 },
      localBehavior: "decline",
    })
    expect(res.status).toBe("declined")
    expect(store.qtyOf("coffee-sack")).toBe(1) // untouched
  })

  it("a live transport delivering an accepted proposal applies the trade", async () => {
    const store = freshStore()
    store.grant("coffee-sack", 1)
    // a hand-rolled transport that echoes an accepted proposal — proves the live path
    setTradeTransportProvider(() => {
      const listeners = new Set<(p: TradeProposal) => void>()
      return {
        async propose(p: TradeProposal) {
          for (const fn of listeners) fn({ ...p, status: "accepted", updatedAt: Date.now() })
        },
        async respond() {},
        onUpdate(fn) {
          listeners.add(fn)
          return () => listeners.delete(fn)
        },
      }
    })
    const res = await runTrade({
      store,
      fromPlayerId: "me",
      toPlayerId: "partner",
      offer: { items: [{ itemId: "coffee-sack", qty: 1 }], coins: 0 },
      request: { items: [{ itemId: "spices-cinnamon", qty: 1 }], coins: 0 },
    })
    expect(res.status).toBe("applied")
    expect(res.live).toBe(true)
    expect(store.qtyOf("spices-cinnamon")).toBe(1)
  })
})
