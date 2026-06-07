import "../exchange.css"
import type { Translate } from "../../contracts/runtime"
import { inventory, getItemDef, type InventoryStore } from "../inventory"
import {
  getCurrency,
  format,
  currencyIconSpec,
  iconRenderer,
  allCurrencies,
} from "../currencies"
import {
  quote as fxQuote,
  applyExchange,
  simRateSource,
  type RateSource,
} from "../exchange"
import {
  getMarket,
  marketForScene,
  allEvents,
  eventsFor,
  EXCHANGE_DEFAULT_SPREAD_BPS,
  type Market,
} from "./marketData"
import { quoteGood, buyGood, sellGood, type Positions } from "./marketSim"
import { feedMult, tickForEpoch, priceHistory } from "../priceSim"

/**
 * marketFloor — the premium in-overlay market + exchange surface
 * (ECONOMY_CURRENCY §4.5, §5.3). Three tabs:
 *   - TICKER   — glanceable rows: icon · price · ▲▼ delta · sparkline. Calm
 *                deltas (no FOMO). Live event headline.
 *   - MARKET   — buy/sell goods against the AMM market-maker at mid ± spread,
 *                with a live local-currency price.
 *   - EXCHANGE — the money-changer: give A → get B at the live mid − spread,
 *                with the spread shown honestly and the result in grouped
 *                numerals (the place-value drill).
 *
 * Mounts INSIDE the passed container (the caller passes `.wp-overlay`, NEVER
 * document.body). Localized via `Translate`. Reduced-motion → static sparklines,
 * no live refresh churn.
 */

export type MarketTab = "ticker" | "market" | "exchange"

export interface MarketFloorOptions {
  store?: InventoryStore
  /** which market to open (else resolve from sceneKeys, else the first). */
  marketId?: string
  /** scene place/era/tags to pick the local market + headline scope. */
  sceneKeys?: Array<string | undefined>
  /** per-Track positions map (qty + avg cost). Caller persists it. */
  positions?: Positions
  tab?: MarketTab
  locale?: string
  t?: Translate
  /** rate source (offline sim by default; E2 server feed swaps in). */
  rateSource?: RateSource
  onClose?: () => void
}

export interface MarketFloorHandle {
  close(): void
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (text != null) n.textContent = text
  return n
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  } catch {
    return false
  }
}

/** Draw a tiny sparkline of a series' last N feedMult samples. */
function sparkline(values: number[], w = 56, h = 22): HTMLCanvasElement {
  const c = document.createElement("canvas")
  c.width = w
  c.height = h
  c.className = "wp-econ-spark"
  const x = c.getContext("2d")
  if (!x || values.length < 2) return c
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  x.strokeStyle = values[values.length - 1] >= values[0] ? "#2f7a4a" : "#9a6a3a"
  x.lineWidth = 1.5
  x.beginPath()
  values.forEach((v, i) => {
    const px = (i / (values.length - 1)) * (w - 2) + 1
    const py = h - 2 - ((v - min) / span) * (h - 4)
    i === 0 ? x.moveTo(px, py) : x.lineTo(px, py)
  })
  x.stroke()
  return c
}

export function openMarketFloor(container: HTMLElement, opts: MarketFloorOptions = {}): MarketFloorHandle {
  const store = opts.store ?? inventory()
  const t: Translate = opts.t ?? ((k) => k)
  const interp = (s: string, params?: Record<string, string | number>): string =>
    params ? s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m)) : s
  const tr = (key: string, fallback: string, params?: Record<string, string | number>): string => {
    const v = t(key, opts.locale ?? "en", params)
    // a real loc table interpolates itself; the stub returns the key → use the
    // localized fallback and interpolate params ourselves so no {placeholders} leak.
    return v && v !== key ? v : interp(fallback, params)
  }
  const positions: Positions = opts.positions ?? {}
  const reduced = prefersReducedMotion()
  const src: RateSource = opts.rateSource ?? simRateSource(allEvents(), 0)

  const market: Market | undefined = opts.marketId
    ? getMarket(opts.marketId)
    : marketForScene(opts.sceneKeys ?? [])

  let tab: MarketTab = opts.tab ?? "ticker"

  const root = el("div", "wp-econ")
  root.setAttribute("role", "dialog")
  root.setAttribute("aria-label", tr("econ.market.title", "Market"))
  const scrim = el("div", "wp-econ-scrim")
  const sheet = el("div", "wp-econ-sheet")
  root.append(scrim, sheet)

  const head = el("div", "wp-econ-head")
  head.append(el("div", "wp-econ-title", market?.name ?? tr("econ.market.title", "Market")))
  const closeBtn = el("button", "wp-econ-close", "✕")
  closeBtn.setAttribute("aria-label", tr("common.close", "Close"))
  head.append(closeBtn)
  sheet.append(head)

  const tabsRow = el("div", "wp-econ-tabs")
  const tabDefs: Array<[MarketTab, string, string]> = [
    ["ticker", "econ.tab.ticker", "Ticker"],
    ["market", "econ.tab.market", "Market"],
    ["exchange", "econ.tab.exchange", "Exchange"],
  ]
  const tabBtns = new Map<MarketTab, HTMLButtonElement>()
  for (const [id, key, fallback] of tabDefs) {
    const b = el("button", "wp-econ-tab", tr(key, fallback))
    b.addEventListener("click", () => {
      tab = id
      render()
    })
    tabBtns.set(id, b)
    tabsRow.append(b)
  }
  sheet.append(tabsRow)

  const body = el("div", "wp-econ-body")
  sheet.append(body)

  const toast = el("div", "wp-econ-toast")
  sheet.append(toast)
  let toastTimer: number | undefined
  const showToast = (msg: string) => {
    toast.textContent = msg
    toast.classList.add("wp-econ-toast--show")
    window.clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => toast.classList.remove("wp-econ-toast--show"), 1500)
  }

  /* --------------------------------------------------------- ticker tab */

  function renderTicker() {
    const now = Date.now()
    // headline: the first active event (if any) today.
    const tick = tickForEpoch(now)
    const liveEvent = allEvents().find((e) => {
      const day = Math.floor(tick / 8640)
      return (((day - e.offset) % e.every) + e.every) % e.every === 0
    })
    if (liveEvent?.headline) {
      const key = liveEvent.headlineKey ?? `econ.event.${liveEvent.id}`
      body.append(el("div", "wp-econ-headline", tr(key, liveEvent.headline)))
    }

    const strip = el("div", "wp-econ-ticker")
    // currency rows (rate vs the catalog default, shown as a multiplier %).
    for (const c of allCurrencies().slice(0, 8)) {
      const evs = eventsFor("currency", c.id)
      const mult = feedMult(c.id, tick, { volatility: c.volatility, events: evs })
      const hist = priceHistory(c.id, tick, 16, { volatility: c.volatility, events: evs })
      const row = el("div", "wp-econ-tickrow")
      const icon = iconRenderer().renderIcon(currencyIconSpec(c), { size: 26 })
      icon.className = "wp-econ-tick-icon"
      row.append(icon)
      row.append(el("div", "wp-econ-tick-name", c.symbol))
      const delta = (mult - 1) * 100
      const d = el("span", `wp-econ-delta wp-econ-delta--${delta >= 0 ? "up" : "down"}`, `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta).toFixed(1)}%`)
      row.append(d)
      row.append(sparkline(reduced ? [hist[0], hist[hist.length - 1]] : hist))
      strip.append(row)
    }
    body.append(strip)

    // good rows for the local market.
    if (market) {
      const list = el("div", "wp-econ-list")
      for (const g of market.goods) {
        const def = getItemDef(g.itemId)
        const q = quoteGood(market.id, g.itemId, now)
        if (!q) continue
        const evs = eventsFor("good", g.itemId)
        const hist = priceHistory(`${market.id}:${g.itemId}`, tick, 16, { volatility: g.volatility, events: evs })
        const row = el("div", "wp-econ-row")
        const nameWrap = el("div", undefined)
        nameWrap.style.flex = "1"
        nameWrap.append(el("div", "wp-econ-row-name", def?.name ?? g.itemId))
        nameWrap.append(el("div", "wp-econ-row-sub", `${tr("econ.mid", "mid")} ${q.mid}`))
        row.append(nameWrap)
        row.append(sparkline(reduced ? [hist[0], hist[hist.length - 1]] : hist))
        list.append(row)
      }
      body.append(list)
    }
  }

  /* --------------------------------------------------------- market tab */

  function renderMarket() {
    if (!market) {
      body.append(el("div", "wp-econ-empty", tr("econ.market.none", "No market here.")))
      return
    }
    const cur = getCurrency(market.localCurrency)
    const list = el("div", "wp-econ-list")
    for (const g of market.goods) {
      const def = getItemDef(g.itemId)
      const q = quoteGood(market.id, g.itemId)
      if (!q || !cur) continue
      const held = store.qtyOf(g.itemId)
      const row = el("div", "wp-econ-row")
      const nameWrap = el("div", undefined)
      nameWrap.style.flex = "1"
      nameWrap.append(el("div", "wp-econ-row-name", def?.name ?? g.itemId))
      const sub = held > 0 ? `${tr("econ.held", "held")} ×${held}` : tr("econ.market.buyhint", "buy low, sell high")
      nameWrap.append(el("div", "wp-econ-row-sub", sub))
      row.append(nameWrap)

      const buyBtn = el("button", "wp-econ-btn", `${tr("econ.buy", "Buy")} ${cur.symbol}${q.buy}`) as HTMLButtonElement
      buyBtn.disabled = store.balance(market.localCurrency) < q.buy
      buyBtn.addEventListener("click", () => {
        const r = buyGood(store, positions, market.id, g.itemId, 1)
        showToast(r.ok ? tr("econ.bought", "Bought {name}", { name: def?.name ?? g.itemId }) : tr("econ.cant", "Can't right now"))
        render()
      })
      const sellBtn = el("button", "wp-econ-btn wp-econ-btn--ghost", `${tr("econ.sell", "Sell")} ${cur.symbol}${q.sell}`) as HTMLButtonElement
      sellBtn.disabled = held <= 0
      sellBtn.addEventListener("click", () => {
        const r = sellGood(store, positions, market.id, g.itemId, 1)
        showToast(r.ok ? tr("econ.sold", "Sold {name}", { name: def?.name ?? g.itemId }) : tr("econ.cant", "Can't right now"))
        render()
      })
      row.append(buyBtn, sellBtn)
      list.append(row)
    }
    body.append(list)
  }

  /* ------------------------------------------------------- exchange tab */

  let fxFrom = market?.localCurrency ?? allCurrencies()[0]?.id ?? ""
  let fxTo = allCurrencies().find((c) => c.id !== fxFrom)?.id ?? fxFrom
  let fxGiveMajor = 1

  function renderExchange() {
    const held = store.walletEntries()
    const fromCur = getCurrency(fxFrom)
    const toCur = getCurrency(fxTo)
    if (!fromCur || !toCur) {
      body.append(el("div", "wp-econ-empty", tr("econ.fx.none", "Nothing to exchange.")))
      return
    }

    const wrap = el("div", "wp-econ-fx")

    const mkSelect = (selId: string, onChange: (id: string) => void): HTMLSelectElement => {
      const sel = el("select", "wp-econ-select") as HTMLSelectElement
      for (const c of allCurrencies()) {
        const o = el("option", undefined, `${c.symbol} ${tr(`econ.currency.${c.id}.name`, c.name)}`)
        o.value = c.id
        if (c.id === selId) o.selected = true
        sel.append(o)
      }
      sel.addEventListener("change", () => onChange(sel.value))
      return sel
    }

    // GIVE pane
    const givePane = el("div", "wp-econ-fx-pane")
    const giveCol = el("div", undefined)
    giveCol.style.flex = "1"
    giveCol.append(el("div", "wp-econ-fx-label", tr("econ.fx.give", "Give")))
    giveCol.append(mkSelect(fxFrom, (id) => { fxFrom = id; if (fxTo === id) fxTo = allCurrencies().find((c) => c.id !== id)?.id ?? id; render() }))
    const bal = store.balance(fxFrom)
    giveCol.append(el("div", "wp-econ-row-sub", `${tr("econ.balance", "balance")} ${format(fromCur, bal, opts.locale)}`))
    givePane.append(giveCol)

    const stepper = el("div", "wp-econ-stepper")
    const minus = el("button", "wp-econ-step", "−")
    const amt = el("div", "wp-econ-amount", String(fxGiveMajor))
    const plus = el("button", "wp-econ-step", "+")
    minus.addEventListener("click", () => { fxGiveMajor = Math.max(1, fxGiveMajor - 1); render() })
    plus.addEventListener("click", () => { fxGiveMajor = fxGiveMajor + 1; render() })
    stepper.append(minus, amt, plus)
    givePane.append(stepper)
    wrap.append(givePane)

    // GET pane
    const getPane = el("div", "wp-econ-fx-pane")
    const getCol = el("div", undefined)
    getCol.style.flex = "1"
    getCol.append(el("div", "wp-econ-fx-label", tr("econ.fx.get", "Get")))
    getCol.append(mkSelect(fxTo, (id) => { fxTo = id; if (fxFrom === id) fxFrom = allCurrencies().find((c) => c.id !== id)?.id ?? id; render() }))
    getPane.append(getCol)
    wrap.append(getPane)

    const giveUnits = fxGiveMajor * fromCur.minorPerMajor
    const q = fxQuote(fxFrom, fxTo, giveUnits, src, { spreadBps: EXCHANGE_DEFAULT_SPREAD_BPS })
    // honest spread line: "rate 1R = 132¥, changer keeps 2.5%"
    const oneFrom = fxQuote(fxFrom, fxTo, fromCur.minorPerMajor, src, { spreadBps: EXCHANGE_DEFAULT_SPREAD_BPS })
    wrap.append(
      el(
        "div",
        "wp-econ-rateline",
        tr("econ.fx.rate", "1 {from} = {rate} {to} · changer keeps {pct}%", {
          from: fromCur.symbol,
          rate: (oneFrom.getUnits / toCur.minorPerMajor).toLocaleString(opts.locale),
          to: toCur.symbol,
          pct: (EXCHANGE_DEFAULT_SPREAD_BPS / 100).toFixed(1),
        }),
      ),
    )
    wrap.append(el("div", "wp-econ-get", `→ ${format(toCur, q.getUnits, opts.locale)}`))

    const confirm = el("button", "wp-econ-btn", tr("econ.fx.confirm", "Exchange")) as HTMLButtonElement
    confirm.style.alignSelf = "center"
    confirm.disabled = q.getUnits <= 0 || bal < giveUnits || fxFrom === fxTo
    confirm.addEventListener("click", () => {
      const r = applyExchange(store, fxFrom, fxTo, giveUnits, src, { spreadBps: EXCHANGE_DEFAULT_SPREAD_BPS })
      if (r.ok) showToast(tr("econ.fx.done", "Exchanged for {amt}", { amt: format(toCur, r.quote.getUnits, opts.locale) }))
      else showToast(tr("econ.fx.fail", "Can't exchange that"))
      render()
    })
    wrap.append(confirm)

    if (!held.length) wrap.append(el("div", "wp-econ-empty", tr("econ.fx.empty", "Earn some currency first, then come exchange.")))
    body.append(wrap)
  }

  /* ----------------------------------------------------------- render */

  function render() {
    for (const [id, b] of tabBtns) b.classList.toggle("wp-econ-tab--on", id === tab)
    body.replaceChildren()
    if (tab === "ticker") renderTicker()
    else if (tab === "market") renderMarket()
    else renderExchange()
  }

  /* ---------------------------------------------------------- lifecycle */

  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    root.classList.remove("wp-econ--in")
    window.removeEventListener("keydown", onKey)
    window.clearTimeout(toastTimer)
    unsub()
    const done = () => {
      root.remove()
      opts.onClose?.()
    }
    root.addEventListener("transitionend", done, { once: true })
    window.setTimeout(done, 360)
  }
  closeBtn.addEventListener("click", close)
  scrim.addEventListener("click", close)
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") close()
  }
  window.addEventListener("keydown", onKey)
  const unsub = store.subscribe(() => {
    if (!closed) render()
  })

  container.append(root)
  render()
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add("wp-econ--in")))

  return { close }
}
