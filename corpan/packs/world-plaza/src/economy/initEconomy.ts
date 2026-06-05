import type { AvatarSpec } from "@world-plaza/contracts"
import type { InventoryStore } from "./inventory"
import { inventory } from "./inventory"
import { MERCHANTS, type MerchantConfig } from "./shop"
import { createShopVignette, type ShopKind } from "./shopVignette"
import { openWardrobe, type WardrobeStrings } from "./wardrobe"
import {
  resolveNpcOffer,
  presentNpcOffer,
  type NpcOffer,
  type OfferKind,
  type OfferStrings,
} from "./npcOffer"
import { setTradeTransportProvider, type TradeTransportProvider } from "./p2pTrade"
import type { VignetteHost } from "../vignettes/types"
import { createPortalAffordance, type PortalAffordance } from "../world/portalAffordance"
import type { WorldEngine } from "../world/engine"

/**
 * initEconomy — the ONE small wiring call `game.ts` makes to stand up the whole
 * COMMERCE + WARDROBE layer:
 *
 *   • registers the enterable INDOOR SHOP vignettes (outfitter / general /
 *     market-stall) on the vignette host and drops a city PORTAL at each chosen
 *     anchor (the same affordance the taxi rank uses);
 *   • exposes `presentOffer(...)` so an NPC can make a REAL, deterministic,
 *     inventory-affecting buy/sell/trade offer with a juicy confirm;
 *   • exposes `openWardrobe(...)` so a dedicated control (or the outfitter) can
 *     re-open the avatar customizer; on apply it live-updates the figure +
 *     persists per-profile via the injected `onAvatarChange`;
 *   • registers the P2P trade transport provider seam (the net agent fills it;
 *     solo falls back to the local stub).
 *
 * Everything mounts inside the passed `overlay` (`.wp-overlay`), never body.
 * game.ts keeps a single `const economy = initEconomy({...})` and wires the
 * returned helpers into the NPC engage path + a menu control.
 */

/** One indoor-shop placement: an anchor + which interior + the merchant stock. */
export interface ShopPlacement {
  /** City topology anchor id the shopfront sits at (filtered to present anchors). */
  anchorId: string
  kind: ShopKind
  /** The merchant config (stock/name); defaults from MERCHANTS by kind. */
  merchant?: MerchantConfig
  /** Localized portal label (e.g. "Enter the Outfitter"). */
  label: string
  /** Optional stable shopkeeper id/name. */
  keeperId?: string
  keeperName?: string
}

export interface InitEconomyOptions {
  world: WorldEngine
  overlay: HTMLElement
  vignetteHost: VignetteHost
  store?: InventoryStore
  accent?: string
  /** active quest id (for shop relevance badges + offer SELL safety). */
  questId?: string
  /** local player id (trade drafts). */
  playerId?: string
  /** Read the player's CURRENT avatar (wardrobe re-opens on it). */
  getAvatar: () => AvatarSpec | null
  /** Apply a new avatar to the LIVE figure + persist per-profile. */
  onAvatarChange: (avatar: AvatarSpec) => void
  /** Resolve a city anchor's world pos (null if absent) — for portal placement. */
  getAnchorPos: (anchorId: string) => { x: number; z: number } | null
  /** Suppress the world while a shop/wardrobe owns the screen (and restore). */
  setWorldActive?: (active: boolean) => void
  /** True iff a blocking surface (dialogue/challenge/vignette) already owns the screen. */
  isBusy?: () => boolean
  /** The shop placements to drop into the city. */
  shops: ShopPlacement[]
  /**
   * Localization seam (key → string; key-unchanged ⇒ use the inline fallback).
   * The same `vt` game.ts threads to the vignettes.
   */
  t?: (key: string, params?: Record<string, string | number>) => string
  /** RTL hint for the native locale (wardrobe orientation). */
  dir?: "ltr" | "rtl"
}

/** What an NPC engage path passes to surface a deterministic offer. */
export interface NpcOfferRequest {
  npcId: string
  npcName: string
  /** the visit counter (rotates the deal, still deterministic). */
  visit?: number
  /** the items this NPC deals in (its stock). Omit → a small default. */
  stock?: string[]
  /** mount target (the game overlay). */
  container: HTMLElement
  onAccepted?: (offer: NpcOffer) => void
  onClosed?: () => void
}

export interface EconomyHandle {
  /**
   * Resolve THIS NPC's standing deterministic offer (or null if it has nothing to
   * deal). The orchestrator surfaces it as a chip; tapping the chip calls
   * `present(...)`. Split so the chip can show/hide on whether an offer exists.
   */
  resolveOffer(req: { npcId: string; npcName: string; visit?: number; stock?: string[] }): NpcOffer | null
  /** Present a resolved offer as a juicy confirm sheet (applies on accept). */
  presentOffer(offer: NpcOffer, req: Pick<NpcOfferRequest, "container" | "onAccepted" | "onClosed">): void
  /** Open the dedicated wardrobe (from a menu control or anywhere). */
  openWardrobe(container?: HTMLElement): void
  /** Register the real (net-backed) P2P trade transport provider (or null). */
  setTradeProvider(provider: TradeTransportProvider | null): void
  /** Currency id offers/prices are quoted in (the Track default). */
  currencyId(): string
  dispose(): void
}

const DEFAULT_OFFER_STOCK = ["lucky-charm", "map-scrap", "candle-beeswax", "jade-bead"]

export function initEconomy(opts: InitEconomyOptions): EconomyHandle {
  const store = opts.store ?? inventory()
  const currencyId = store.defaultCurrency()

  // localize: key-unchanged ⇒ inline fallback (the taxi/shared convention).
  const tr = (key: string, fallback: string, params?: Record<string, string | number>): string => {
    if (!opts.t) return fallback
    const out = opts.t(key, params)
    return out && out !== key ? out : fallback
  }

  const offerStrings = (): Partial<OfferStrings> => ({
    title: tr("economy.offer.title", "An offer"),
    accept: tr("economy.offer.accept", "It's a deal"),
    decline: tr("economy.offer.decline", "No thanks"),
    cantAfford: tr("economy.offer.cantAfford", "You can't afford this yet."),
    alreadyOwned: tr("economy.offer.owned", "You already have one."),
  })
  const offerPitches: Partial<Record<OfferKind, (item: string, price: string) => string>> = {
    buy: (item, price) => tr("economy.offer.pitch.buy", `I can let you have my ${item} for ${price}. Interested?`, { item, price }),
    sell: (item, price) => tr("economy.offer.pitch.sell", `That ${item} of yours — I'll give you ${price} for it.`, { item, price }),
    swap: (item) => tr("economy.offer.pitch.swap", `Trade you my ${item} for one of yours — a fair swap?`, { item }),
  }

  const wardrobeStrings = (): Partial<WardrobeStrings> => ({
    title: tr("economy.wardrobe.title", "Your wardrobe"),
    subtitle: tr("economy.wardrobe.subtitle", "Change your look — wear the things you've collected."),
    outfit: tr("economy.wardrobe.outfit", "Outfit"),
    hat: tr("economy.wardrobe.hat", "Hat"),
    accessory: tr("economy.wardrobe.accessory", "Accessory"),
    skin: tr("economy.wardrobe.skin", "Skin"),
    bling: tr("economy.wardrobe.bling", "Your finery"),
    color: tr("economy.wardrobe.color", "Colour"),
    none: tr("economy.wardrobe.none", "None"),
    apply: tr("economy.wardrobe.apply", "Wear this"),
    cancel: tr("economy.wardrobe.cancel", "Cancel"),
    emptyBling: tr("economy.wardrobe.emptyBling", "Win challenges and visit the outfitter to collect finery."),
    worn: tr("economy.wardrobe.worn", "Worn"),
    buyMore: tr("economy.wardrobe.buyMore", "Get more at the outfitter"),
  })

  /* ── register the indoor shop vignettes + city portals ──────────────────── */

  const portals: PortalAffordance[] = []
  const SHOP_VIGNETTE_PREFIX = "shop:"
  for (const shop of opts.shops) {
    const merchant = shop.merchant ?? MERCHANTS[shop.kind === "outfitter" ? "tailor" : shop.kind === "general" ? "trader" : "grocer"]
    const vignetteId = `${SHOP_VIGNETTE_PREFIX}${shop.anchorId}`
    opts.vignetteHost.register(vignetteId, () =>
      createShopVignette({
        kind: shop.kind,
        merchant,
        store,
        keeperId: shop.keeperId,
        keeperName: shop.keeperName,
        questId: opts.questId,
        playerId: opts.playerId,
        getAvatar: opts.getAvatar,
        onAvatarChange: opts.onAvatarChange,
        wardrobeStrings: wardrobeStrings(),
      }),
    )

    const pos = opts.getAnchorPos(shop.anchorId)
    if (!pos) {
      console.warn(`[wp/economy] shop anchor "${shop.anchorId}" absent — portal skipped`)
      continue
    }
    let portal: PortalAffordance | null = null
    const enter = async (anchorId: string): Promise<void> => {
      if (opts.isBusy?.()) return
      portal?.setEnabled(false)
      opts.setWorldActive?.(false)
      try {
        await opts.vignetteHost.enter(vignetteId, { anchorId })
      } catch (e) {
        console.error(`[wp/economy] shop vignette "${vignetteId}" failed:`, e)
      } finally {
        opts.setWorldActive?.(true)
        portal?.setEnabled(true)
      }
    }
    portal = createPortalAffordance(opts.world, opts.overlay, {
      anchorId: shop.anchorId,
      pos,
      label: shop.label,
      onEnter: (id) => void enter(id),
    })
    portals.push(portal)
  }

  /* ── register the P2P trade provider seam (solo until the net fills it) ──── */
  // (no-op until game.ts/net calls setTradeProvider; getTradeTransport falls back)

  /* ── the wardrobe opener (dedicated control + outfitter both reach it) ───── */
  const doOpenWardrobe = (container?: HTMLElement) => {
    const avatar = opts.getAvatar()
    if (!avatar) {
      console.warn("[wp/economy] openWardrobe: no avatar available")
      return
    }
    opts.setWorldActive?.(false)
    openWardrobe({
      container: container ?? opts.overlay,
      avatar,
      store,
      accent: opts.accent,
      t: opts.t,
      dir: opts.dir,
      strings: wardrobeStrings(),
      onApply: (next) => {
        try {
          opts.onAvatarChange(next)
        } catch (e) {
          console.error("[wp/economy] onAvatarChange threw:", e)
        }
      },
      onClose: () => opts.setWorldActive?.(true),
    })
  }

  return {
    resolveOffer: (req) =>
      resolveNpcOffer({
        npcId: req.npcId,
        npcName: req.npcName,
        visit: req.visit,
        currencyId,
        stock: req.stock ?? DEFAULT_OFFER_STOCK,
        store,
        questId: opts.questId,
        pitches: offerPitches,
      }),
    presentOffer: (offer, req) =>
      void presentNpcOffer({
        offer,
        store,
        container: req.container,
        accent: opts.accent,
        strings: offerStrings(),
        onAccepted: req.onAccepted,
        onDeclined: req.onClosed,
      }),
    openWardrobe: doOpenWardrobe,
    setTradeProvider: (provider) => setTradeTransportProvider(provider),
    currencyId: () => currencyId,
    dispose: () => {
      for (const p of portals) {
        try {
          p.dispose()
        } catch (e) {
          console.error("[wp/economy] portal dispose threw:", e)
        }
      }
      setTradeTransportProvider(null)
    },
  }
}
