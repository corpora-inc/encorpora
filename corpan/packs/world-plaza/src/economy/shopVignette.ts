import "./shopVignette.css"
import type {
  Vignette,
  VignetteContext,
  VignetteNpcHandle,
  VignetteResult,
} from "../vignettes/types"
import { NO_TRAVEL } from "../vignettes/types"
import { registerRootHooks } from "../vignettes/host"
import type { InventoryStore } from "./inventory"
import { inventory } from "./inventory"
import { openShop, type MerchantConfig } from "./shop"
import { openWardrobe, type WardrobeStrings } from "./wardrobe"
import type { AvatarSpec } from "@world-plaza/contracts"

/**
 * shopVignette — a dedicated, ENTERABLE indoor shop interior (the v2 commerce
 * surface). You walk up to a shopfront in the city, ENTER a cozy interior scene —
 * shelves, a hanging sign, a warm window, the shopkeeper behind a counter — and
 * BROWSE / BUY from the live merchant stock, then EXIT back to town.
 *
 * It's the SAME vignette seam the taxi uses (`Vignette`/`VignetteContext`), so it
 * pauses the world + frees the LLM, recedes chrome, runs fullscreen inside
 * `.wp-overlay`, and resolves on exit. Three shipped interiors via `ShopKind`:
 *   - outfitter   — buy bling/outfits; ALSO opens the WARDROBE to dress up.
 *   - general     — a general store (goods, consumables, curios).
 *   - market-stall — a market keeper's stall (trade goods).
 *
 * Commerce reuses the shipped `openShop` overlay (buy/sell/trade/equip) so there
 * is ONE commerce UI; the interior is the framing around it. The shopkeeper is a
 * REAL Qwen3 NPC (via `ctx.openNpc`) you can chat with in the target language.
 *
 * The inventory store + avatar accessors are injected by the orchestrator at
 * registration (the same pattern as the taxi's destinations) so the vignette
 * touches the LIVE economy without importing the orchestrator.
 */

export type ShopKind = "outfitter" | "general" | "market-stall"

export interface ShopVignetteOptions {
  kind: ShopKind
  /** The merchant stock + name shown in the buy/sell overlay. */
  merchant: MerchantConfig
  /** Live inventory store (defaults to the singleton). */
  store?: InventoryStore
  /** Stable id + display name for the shopkeeper NPC. */
  keeperId?: string
  keeperName?: string
  /** Active quest id, for quest-relevance badges in the shop. */
  questId?: string
  /** local player id for trade drafts. */
  playerId?: string
  /** Read the player's CURRENT avatar (outfitter wardrobe re-opens on it). */
  getAvatar?: () => AvatarSpec | null
  /** Apply a new avatar to the live figure + persist (outfitter wardrobe). */
  onAvatarChange?: (avatar: AvatarSpec) => void
  /** Localized wardrobe strings (outfitter). */
  wardrobeStrings?: Partial<WardrobeStrings>
}

/* ----------------------------------------------------------------- copy */

const KIND_COPY: Record<
  ShopKind,
  { sign: string; emoji: string; title: string; sub: string; enterBrowse: string }
> = {
  outfitter: {
    sign: "Outfitter",
    emoji: "🧵",
    title: "The Outfitter",
    sub: "Hats, coats & fine finery",
    enterBrowse: "Browse the rails",
  },
  general: {
    sign: "General Store",
    emoji: "🛍️",
    title: "General Store",
    sub: "Goods, curios & sundries",
    enterBrowse: "Browse the shelves",
  },
  "market-stall": {
    sign: "Market Stall",
    emoji: "🧺",
    title: "Market Stall",
    sub: "Spices, cloth & fresh goods",
    enterBrowse: "Look over the stall",
  },
}

/* ----------------------------------------------------------------- DOM */

function div(cls: string): HTMLDivElement {
  const d = document.createElement("div")
  d.className = cls
  return d
}
function textDiv(cls: string, text: string): HTMLDivElement {
  const d = div(cls)
  d.textContent = text
  return d
}
function btn(cls: string, text: string): HTMLButtonElement {
  const b = document.createElement("button")
  b.type = "button"
  b.className = cls
  b.textContent = text
  return b
}

/* ----------------------------------------------------------------- factory */

export function createShopVignette(opts: ShopVignetteOptions): Vignette {
  let disposed = false
  let npc: VignetteNpcHandle | null = null
  const cleanup: Array<() => void> = []

  function enter(ctx: VignetteContext): Promise<VignetteResult> {
    return new Promise<VignetteResult>((resolve) => {
      const { mountRoot, scene, learnerPair, reducedMotion } = ctx
      const store = opts.store ?? inventory()
      const copy = KIND_COPY[opts.kind]
      const accent = scene.palette?.accent ?? "#e8b54a"

      // Inline-fallback localization (the taxi convention): try the resolver; if it
      // returns the key unchanged, use the inline English fallback.
      const t = (key: string, fallback: string, params?: Record<string, string | number>): string => {
        let s = ctx.t(key, params)
        if (s === key || s == null || s === "") s = fallback
        if (params) s = s.replace(/\{(\w+)\}/g, (_m, k) => String(params[k] ?? `{${k}}`))
        return s
      }

      let settled = false
      const finish = (result: VignetteResult) => {
        if (settled) return
        settled = true
        npc?.dispose()
        npc = null
        resolve(result)
      }

      registerRootHooks(mountRoot, {
        exit: () => finish(NO_TRAVEL),
        exitLabel: t(`vignette.shop.${opts.kind}.leave`, "Step outside"),
      })

      // ── interior scaffold ───────────────────────────────────────────────────
      const interior = div("wp-shopv")
      interior.style.setProperty("--wp-shopv-accent", accent)
      mountRoot.appendChild(interior)

      // back wall: shelves + a warm window + a hanging sign
      const wall = div("wp-shopv-wall")
      wall.appendChild(div("wp-shopv-window"))
      const sign = div("wp-shopv-sign")
      sign.appendChild(textDiv("wp-shopv-sign__emoji", copy.emoji))
      sign.appendChild(textDiv("wp-shopv-sign__text", t(`vignette.shop.${opts.kind}.sign`, copy.sign)))
      wall.appendChild(sign)
      // three shelves of goods (procedural little parcels — no asset dependency)
      for (let s = 0; s < 3; s++) {
        const shelf = div("wp-shopv-shelf")
        const n = 4 + ((s * 3) % 3)
        for (let i = 0; i < n + 3; i++) {
          const good = div("wp-shopv-good")
          good.style.setProperty("--h", `${60 + ((s * 7 + i * 13) % 30)}%`)
          good.style.setProperty(
            "--hue",
            `${(20 + s * 40 + i * 23) % 360}`,
          )
          shelf.appendChild(good)
        }
        wall.appendChild(shelf)
      }
      interior.appendChild(wall)

      // counter + shopkeeper billboard (a 2D paper-person, HD-2D discipline)
      const counter = div("wp-shopv-counter")
      const keeper = div("wp-shopv-keeper")
      if (!reducedMotion) keeper.classList.add("wp-shopv-keeper--sway")
      keeper.appendChild(div("wp-shopv-keeper__head"))
      keeper.appendChild(div("wp-shopv-keeper__body"))
      interior.appendChild(keeper)
      interior.appendChild(counter)

      // header card
      const header = div("wp-shopv-header")
      header.appendChild(textDiv("wp-shopv-header__title", t(`vignette.shop.${opts.kind}.title`, copy.title)))
      header.appendChild(textDiv("wp-shopv-header__sub", t(`vignette.shop.${opts.kind}.sub`, copy.sub)))
      interior.appendChild(header)

      // ── the shopkeeper conversation (real Qwen3) ────────────────────────────
      const tray = div("wp-shopv-tray")
      interior.appendChild(tray)
      npc = ctx.openNpc({
        container: tray,
        npcId: opts.keeperId ?? `shopkeeper-${opts.kind}`,
        npcName: opts.keeperName ?? t(`vignette.shop.${opts.kind}.keeper`, "the shopkeeper"),
        persona: {
          tone: `a warm, proud shopkeeper of ${copy.title.toLowerCase()} who loves their wares`,
          quirks: [
            "greets you and asks what you're looking for",
            "describes one item with pride",
            "wishes you well whether or not you buy",
          ],
        },
        scriptedFallback: [
          t(`vignette.shop.${opts.kind}.fallback.greet`, "Welcome in! Take a look around."),
          t(`vignette.shop.${opts.kind}.fallback.help`, "Anything catch your eye?"),
          t(`vignette.shop.${opts.kind}.fallback.thanks`, "Come back any time!"),
        ],
        voiceCode: learnerPair.target,
        starterChips: [
          t(`vignette.shop.${opts.kind}.chip.browse`, "What do you have?"),
          t("vignette.shop.chip.greet", "Hello!"),
        ],
        onClose: () => {
          /* tray stays; tap the keeper to re-open. door/Exit leaves. */
        },
      })

      // ── action buttons ──────────────────────────────────────────────────────
      const actions = div("wp-shopv-actions")
      const browse = btn("wp-shopv-btn wp-shopv-btn--primary", t(`vignette.shop.${opts.kind}.browse`, copy.enterBrowse))
      browse.addEventListener("click", () => {
        openShop(mountRoot, {
          merchant: opts.merchant,
          questId: opts.questId,
          store,
          playerId: opts.playerId,
          tab: "buy",
        })
      })
      actions.appendChild(browse)

      // The OUTFITTER also opens the wardrobe — dress up + equip bought bling.
      if (opts.kind === "outfitter" && opts.getAvatar && opts.onAvatarChange) {
        const dress = btn("wp-shopv-btn wp-shopv-btn--wardrobe", t("vignette.shop.outfitter.wardrobe", "Try things on"))
        dress.addEventListener("click", () => {
          const avatar = opts.getAvatar?.()
          if (!avatar) return
          openWardrobe({
            container: mountRoot,
            avatar,
            store,
            accent,
            t: (key, params) => ctx.t(key, params),
            strings: opts.wardrobeStrings,
            onApply: (next) => opts.onAvatarChange?.(next),
            onBuyMore: () => {
              // already in the outfitter — just open the buy overlay
              openShop(mountRoot, { merchant: opts.merchant, store, playerId: opts.playerId, tab: "buy" })
            },
          })
        })
        actions.appendChild(dress)
      }
      interior.appendChild(actions)

      cleanup.push(() => interior.remove())

      // gentle entrance ding
      if (!reducedMotion) requestAnimationFrame(() => interior.classList.add("wp-shopv--in"))
      else interior.classList.add("wp-shopv--in")
    })
  }

  function dispose(): void {
    if (disposed) return
    disposed = true
    npc?.dispose()
    npc = null
    for (const fn of cleanup) {
      try {
        fn()
      } catch (e) {
        console.error("[wp/shopVignette] cleanup threw:", e)
      }
    }
  }

  return { enter, dispose }
}
