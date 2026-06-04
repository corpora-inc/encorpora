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
