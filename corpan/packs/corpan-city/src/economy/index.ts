/**
 * Economy slice (E0 + E1) public surface — the multi-currency wallet that kills
 * the gray moon-coin. The orchestrator (`game.ts`) wires the slice through this
 * barrel; other slices consume only the contracted seams (`walletGlance` via
 * HudGlances, the `InventoryStore` interface).
 */

export {
  createInventory,
  inventory,
  bindInventory,
  getItemDef,
  allItemDefs,
  type InventoryStore,
  type InventoryOptions,
  type Reward,
  type EconomyState,
  type EconomyEvent,
} from "./inventory"

export {
  getCurrency,
  allCurrencies,
  isLiveCurrency,
  decompose,
  topStacks,
  format,
  formatMajor,
  defaultCurrencyForScene,
  currencyIconSpec,
  denominationIconSpec,
  artToIconSpec,
  stubIconRenderer,
  setIconRenderer,
  iconRenderer,
  DEFAULT_CURRENCY_ID,
  type DenomStack,
} from "./currencies"

export {
  rollReward,
  rollForScene,
  getRewardTable,
  rewardTableForScene,
  seededRng,
  type RollOptions,
} from "./rewards"

export {
  midRate,
  quote,
  applyExchange,
  fxBoard,
  price,
  simRateSource,
  type RateSource,
  type FxQuote,
  type ExchangeResult,
} from "./exchange"

export { feedMult, maxDev, priceHistory, tickForEpoch, TICKS_PER_DAY, type PriceEvent } from "./priceSim"

export { makeWalletGlance, setWalletGlanceLocale } from "./walletGlance"
export { showRewardReveal, type RewardRevealHandle, type RewardRevealOptions } from "./rewardReveal"
export { createEconomyHud, type EconomyHud, type EconomyHudOptions } from "./economyHud"

export {
  getMarket,
  allMarkets,
  marketForScene,
  allEvents,
  eventsFor,
  EXCHANGE_DEFAULT_SPREAD_BPS,
  type Market,
  type MarketGood,
  type MarketEvent,
} from "./market/marketData"
export {
  quoteGood,
  buyGood,
  sellGood,
  goodMid,
  unrealizedPL,
  marketCurrencySymbol,
  type Position,
  type Positions,
  type GoodQuote,
  type TradeResult,
} from "./market/marketSim"
export { openMarketFloor, type MarketFloorHandle, type MarketFloorOptions, type MarketTab } from "./market/marketFloor"

// ── Commerce + wardrobe (the v2 economy surfaces) ───────────────────────────
export {
  resolveNpcOffer,
  presentNpcOffer,
  canAcceptOffer,
  applyNpcOffer,
  type NpcOffer,
  type OfferKind,
  type OfferGenInput,
  type OfferStrings,
  type OfferApplyResult,
} from "./npcOffer"
export {
  openWardrobe,
  composeAvatar,
  type WardrobeOptions,
  type WardrobeStrings,
  type WardrobeHandle,
} from "./wardrobe"
export {
  createShopVignette,
  type ShopVignetteOptions,
  type ShopKind,
} from "./shopVignette"
export {
  setTradeTransportProvider,
  getTradeTransport,
  hasP2pTrade,
  runTrade,
  type TradeTransportProvider,
  type TradeRunResult,
} from "./p2pTrade"
export {
  initEconomy,
  type InitEconomyOptions,
  type EconomyHandle,
  type ShopPlacement,
  type NpcOfferRequest,
} from "./initEconomy"

// The clean INVENTORY API the phone (src/shell/phone/*) reads — one barrel for
// the store interface + item defs + value/format helpers. The phone EMBEDS the
// inventory read-only; it should import from here, not reach into modules.
export type { InventoryStore as Inventory } from "./inventory"
export type { Item } from "../items/itemTypes"
