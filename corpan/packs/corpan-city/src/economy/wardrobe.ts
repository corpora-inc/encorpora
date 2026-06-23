import "./wardrobe.css"
import type { AvatarSpec, AvatarLayer, CosmeticSlot } from "@corpan-city/contracts"
import type { Item } from "../items/itemTypes"
import { isCosmetic } from "../items/itemTypes"
import type { InventoryStore } from "./inventory"
import {
  dressToAvatar,
  dressFromAvatar,
  drawDoll,
  STARTER_DRESS,
  type DressState,
  type DressOption,
} from "../onboarding/onboarding"
import { createWardrobePreview, type WardrobePreview } from "./wardrobePreview"

/**
 * wardrobe — RE-OPEN the avatar customizer in-game so the player changes outfit,
 * equips the bling they BOUGHT, and it persists per-profile.
 *
 * THE GAP THIS CLOSES: the player dressed up once at onboarding (`dressToAvatar`
 * over a starter kit) and then had no way back. The wardrobe is that way back —
 * reachable from the outfitter shop interior AND a dedicated "Wardrobe" control.
 * It reuses the EXACT onboarding model (`DressState` + `drawDoll` + the starter
 * dress vocabulary) so there is one dress path, then LAYERS the catalog cosmetics
 * the player owns (`straw-hat`, `traveler-coat`, `festival-aura`…) on top:
 *
 *   final AvatarSpec = dressToAvatar(starterDress)  ⊕  equipped catalog cosmetics
 *
 * Catalog cosmetics override their slot (a bought `traveler-coat` replaces the
 * starter top; a `festival-aura` adds an aura the starter kit never had). When a
 * catalog cosmetic the paper-doll can't draw is worn, the preview shows it as a
 * "worn" bling badge + (for auras) a glow ring over the faithful base doll, so the
 * player always SEES that their purchase is on.
 *
 * PERSISTENCE: the produced `AvatarSpec` fully encodes the look (skin + every
 * layer), so the caller persists exactly that (identity store). We ALSO mirror
 * each worn catalog cosmetic into `store.equip/unequip` so the Inventory panel's
 * "equipped" view agrees with what's on the figure. The live figure updates in
 * place via the caller's `onApply` (→ `player.redress`) — no world reload.
 *
 * Mounts INSIDE the passed container (`.wp-overlay`), never document.body. Every
 * visible string flows through the injected `t` with an inline English fallback.
 */

/* ----------------------------------------------------------------- options */

export interface WardrobeStrings {
  title: string
  subtitle: string
  outfit: string
  hat: string
  accessory: string
  skin: string
  bling: string
  color: string
  none: string
  apply: string
  cancel: string
  emptyBling: string
  worn: string
  buyMore: string
}

const DEFAULT_STRINGS: WardrobeStrings = {
  title: "Your wardrobe",
  subtitle: "Change your look — wear the things you've collected.",
  outfit: "Outfit",
  hat: "Hat",
  accessory: "Accessory",
  skin: "Skin",
  bling: "Your finery",
  color: "Colour",
  none: "None",
  apply: "Wear this",
  cancel: "Cancel",
  emptyBling: "Win challenges and visit the outfitter to collect finery.",
  worn: "Worn",
  buyMore: "Get more at the outfitter",
}

export interface WardrobeOptions {
  /** mount target — MUST be inside `.wp-overlay`. */
  container: HTMLElement
  /** The player's CURRENT avatar (re-opens showing this look, not a reset). */
  avatar: AvatarSpec
  /** Live inventory (owned catalog cosmetics + equip mirror). */
  store: InventoryStore
  accent?: string
  /** localization seam (key → string; key-unchanged ⇒ caller uses the fallback). */
  t?: (key: string, params?: Record<string, string | number>) => string
  /** RTL hint for the native locale. */
  dir?: "ltr" | "rtl"
  strings?: Partial<WardrobeStrings>
  /** Deep-link into the outfitter shop ("Get more"). */
  onBuyMore?: () => void
  /** Called with the new AvatarSpec when the player applies a look. */
  onApply: (avatar: AvatarSpec) => void
  /** Called on cancel / dismiss. */
  onClose?: () => void
}

export interface WardrobeHandle {
  close(): void
}

/* ----------------------------------------------------------------- glyphs */

function blingGlyph(it: Item): string {
  const map: Record<string, string> = {
    "cos-hat-sun": "👒", "cos-hat-tricorn": "🎩", "cos-hat-bonnet": "👒", "cos-hat-feather": "🎩",
    "cos-top-linen": "👕", "cos-top-embroidered": "👚", "cos-top-coat": "🧥",
    "cos-shoes-leather": "👞", "cos-acc-satchel": "🎒", "cos-acc-shawl": "🧣",
    "cos-acc-quill": "🖋️", "cos-face-spectacles": "👓", "cos-aura-festival": "✨", "cos-aura-petals": "🌼",
  }
  return map[it.art] ?? "🎽"
}

/* ----------------------------------------------------------------- builder */

/**
 * Build the final AvatarSpec from the starter dress base + the worn catalog
 * cosmetics (keyed by slot). A worn cosmetic REPLACES its slot's base layer;
 * slots the starter kit doesn't fill (face-cosmetic, aura, shoes) are added.
 */
export function composeAvatar(
  dress: DressState,
  wornBySlot: Map<CosmeticSlot, { itemId: string; tint?: string }>,
): AvatarSpec {
  const base = dressToAvatar(dress)
  const layers: AvatarLayer[] = base.layers.filter((l) => !wornBySlot.has(l.slot))
  for (const [slot, { itemId, tint }] of wornBySlot) {
    layers.push({ slot, itemId, ...(tint ? { tint } : {}) })
  }
  return { base: base.base, layers, palette: base.palette }
}

/* ----------------------------------------------------------------- el util */

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (text != null) n.textContent = text
  return n
}

/* ----------------------------------------------------------------- mount */

export function openWardrobe(opts: WardrobeOptions): WardrobeHandle {
  // Strings are pre-localized by the caller (initEconomy threads `t` and builds
  // the strings); the wardrobe just consumes them with English defaults.
  const strings: WardrobeStrings = { ...DEFAULT_STRINGS, ...(opts.strings ?? {}) }
  const { store } = opts

  // Recover the starter dress from the current avatar so we re-open on the live look.
  const dress: DressState = dressFromAvatar(opts.avatar)

  // The worn catalog cosmetics, keyed by slot — seeded from the avatar's layers
  // that correspond to OWNED catalog cosmetics (so re-opening preserves bling).
  const worn = new Map<CosmeticSlot, { itemId: string; tint?: string }>()
  const ownedCosmetics: Item[] = store
    .bagWithDefs()
    .map((b) => b.def)
    .filter((d): d is Item => isCosmetic(d))
  const ownedById = new Map(ownedCosmetics.map((c) => [c.id, c] as const))
  for (const l of opts.avatar.layers ?? []) {
    if (ownedById.has(l.itemId)) worn.set(l.slot, { itemId: l.itemId, tint: l.tint })
  }

  const root = el("div", "wp-wardrobe")
  if (opts.accent) root.style.setProperty("--wp-wardrobe-accent", opts.accent)
  if (opts.dir) root.dir = opts.dir
  root.setAttribute("role", "dialog")
  root.setAttribute("aria-label", strings.title)
  const scrim = el("div", "wp-wardrobe-scrim")
  const sheet = el("div", "wp-wardrobe-sheet")
  root.append(scrim, sheet)

  /* header */
  const head = el("div", "wp-wardrobe-head")
  head.append(
    el("div", "wp-wardrobe-title", strings.title),
    el("div", "wp-wardrobe-sub", strings.subtitle),
  )
  const closeBtn = el("button", "wp-wardrobe-close", "✕")
  closeBtn.setAttribute("aria-label", strings.cancel)
  sheet.append(head, closeBtn)

  /* stage: the LIVE 3D portrait (the in-world body) + a worn-bling badge row.
     A 2D paper-doll canvas is kept as a graceful fallback when WebGL is absent. */
  const stage = el("div", "wp-wardrobe-stage")
  const figCanvas = el("canvas", "wp-wardrobe-fig") as HTMLCanvasElement
  const cv = el("canvas", "wp-wardrobe-doll") as HTMLCanvasElement
  cv.width = 240
  cv.height = 300
  const dctx = cv.getContext("2d")
  const blingBadges = el("div", "wp-wardrobe-bling-badges")
  stage.append(figCanvas, cv, blingBadges)
  sheet.append(stage)

  // Try the real 3D character portrait; on failure fall back to the 2D doll.
  let preview: WardrobePreview | null = null
  try {
    preview = createWardrobePreview(figCanvas, composeAvatar(dress, worn))
  } catch (e) {
    console.error("[wp/wardrobe] 3D preview failed to mount, using 2D doll:", e)
  }
  if (preview) {
    cv.style.display = "none"
  } else {
    figCanvas.style.display = "none"
  }

  const redrawDoll = () => {
    // Drive whichever portrait is live: 3D figure tracks the new look, else 2D.
    if (preview) preview.setAvatar(composeAvatar(dress, worn))
    else if (dctx) drawDoll(dctx, 240, 300, dress)
    // Auras get a glow ring behind the portrait; worn cosmetics show as badges.
    blingBadges.replaceChildren()
    for (const [slot, w] of worn) {
      const def = ownedById.get(w.itemId)
      if (!def) continue
      const badge = el("div", "wp-wardrobe-bling-badge", blingGlyph(def))
      badge.title = `${strings.worn}: ${def.name}`
      if (slot === "aura") root.classList.add("wp-wardrobe--aura")
      blingBadges.append(badge)
    }
    if (![...worn.keys()].includes("aura")) root.classList.remove("wp-wardrobe--aura")
  }

  /* controls */
  const controls = el("div", "wp-wardrobe-controls")
  sheet.append(controls)

  // A chip row factory for a starter slot.
  const slotRow = (
    label: string,
    items: ReadonlyArray<DressOption>,
    noneId: string,
    getActive: () => string,
    onPick: (id: string) => void,
  ) => {
    const group = el("div", "wp-wardrobe-group")
    group.append(el("div", "wp-wardrobe-group-label", label))
    const chips = el("div", "wp-wardrobe-chips")
    const refresh = () => {
      chips.querySelectorAll(".wp-wardrobe-chip").forEach((c) => {
        c.classList.toggle("wp-wardrobe-chip--on", (c as HTMLElement).dataset.id === getActive())
      })
    }
    // "None" option first.
    const noneChip = el("button", "wp-wardrobe-chip", strings.none)
    noneChip.dataset.id = noneId
    noneChip.addEventListener("click", () => {
      onPick(noneId)
      redrawDoll()
      refresh()
    })
    chips.append(noneChip)
    // DEDUPE: the starter vocabulary carries an explicit "No Hat"/"No Accessory"
    // data item whose id IS `noneId`. The single localized "None" chip above
    // already covers it, so drop the data twin (else the row showed both).
    for (const it of items) {
      if (it.id === noneId) continue
      const chip = el("button", "wp-wardrobe-chip", it.name)
      chip.dataset.id = it.id
      chip.addEventListener("click", () => {
        onPick(it.id)
        redrawDoll()
        refresh()
      })
      chips.append(chip)
    }
    group.append(chips)
    refresh()
    return { group, refresh }
  }

  // OUTFIT (starter tops) — clearing `worn.top` so a starter top shows.
  const outfit = slotRow(
    strings.outfit,
    STARTER_DRESS.tops,
    "top-none",
    () => (worn.has("top") ? "" : dress.topId),
    (id) => {
      worn.delete("top")
      store.unequip("top")
      dress.topId = id
      const def = STARTER_DRESS.tops.find((t) => t.id === id)
      if (def) dress.topTint = def.tints?.[0] ?? dress.topTint
    },
  )
  controls.append(outfit.group)

  // HAT (starter hats)
  const hat = slotRow(
    strings.hat,
    STARTER_DRESS.hats,
    "hat-none",
    () => (worn.has("hat") ? "" : dress.hatId),
    (id) => {
      worn.delete("hat")
      store.unequip("hat")
      dress.hatId = id
      dress.hatTint = STARTER_DRESS.hats.find((h) => h.id === id)?.tints?.[0]
    },
  )
  controls.append(hat.group)

  // ACCESSORY (starter accessories)
  const acc = slotRow(
    strings.accessory,
    STARTER_DRESS.accessories,
    "acc-none",
    () => (worn.has("accessory") ? "" : dress.accId),
    (id) => {
      worn.delete("accessory")
      store.unequip("accessory")
      dress.accId = id
      dress.accTint = STARTER_DRESS.accessories.find((a) => a.id === id)?.tints?.[0]
    },
  )
  controls.append(acc.group)

  // SKIN tones
  const skinGroup = el("div", "wp-wardrobe-group")
  skinGroup.append(el("div", "wp-wardrobe-group-label", strings.skin))
  const skinChips = el("div", "wp-wardrobe-chips")
  for (const c of STARTER_DRESS.skins) {
    const sw = el("button", "wp-wardrobe-tint")
    sw.style.background = c
    sw.dataset.c = c
    if (c === dress.skin) sw.classList.add("wp-wardrobe-tint--on")
    sw.addEventListener("click", () => {
      dress.skin = c
      redrawDoll()
      skinChips.querySelectorAll(".wp-wardrobe-tint").forEach((s) =>
        s.classList.toggle("wp-wardrobe-tint--on", (s as HTMLElement).dataset.c === c),
      )
    })
    skinChips.append(sw)
  }
  skinGroup.append(skinChips)
  controls.append(skinGroup)

  // BLING — the player's OWNED catalog cosmetics, toggled on/off per slot.
  const blingGroup = el("div", "wp-wardrobe-group wp-wardrobe-bling")
  blingGroup.append(el("div", "wp-wardrobe-group-label", strings.bling))
  const blingChips = el("div", "wp-wardrobe-chips")
  const refreshAllStarter = () => {
    outfit.refresh()
    hat.refresh()
    acc.refresh()
  }
  if (!ownedCosmetics.length) {
    blingGroup.append(el("div", "wp-wardrobe-empty", strings.emptyBling))
  } else {
    for (const it of ownedCosmetics) {
      const chip = el("button", "wp-wardrobe-bling-chip")
      chip.append(
        el("span", `wp-wardrobe-bling-glyph wp-wardrobe-bling-glyph--${it.rarity}`, blingGlyph(it)),
        el("span", "wp-wardrobe-bling-name", it.name),
      )
      chip.dataset.id = it.id
      const slot = it.slot as CosmeticSlot
      const isOn = () => worn.get(slot)?.itemId === it.id
      const refreshBling = () => {
        blingChips.querySelectorAll(".wp-wardrobe-bling-chip").forEach((c) => {
          const cid = (c as HTMLElement).dataset.id
          const cdef = cid ? ownedById.get(cid) : undefined
          c.classList.toggle(
            "wp-wardrobe-bling-chip--on",
            !!cdef && worn.get(cdef.slot as CosmeticSlot)?.itemId === cid,
          )
        })
      }
      chip.addEventListener("click", () => {
        if (isOn()) {
          worn.delete(slot)
          store.unequip(slot)
        } else {
          worn.set(slot, { itemId: it.id, tint: it.tints?.[0] })
          store.equip(it.id, it.tints?.[0])
        }
        redrawDoll()
        refreshBling()
        refreshAllStarter()
      })
      blingChips.append(chip)
    }
    // initial on-state
    blingGroup.append(blingChips)
    queueMicrotask(() => {
      blingChips.querySelectorAll(".wp-wardrobe-bling-chip").forEach((c) => {
        const cid = (c as HTMLElement).dataset.id
        const cdef = cid ? ownedById.get(cid) : undefined
        c.classList.toggle(
          "wp-wardrobe-bling-chip--on",
          !!cdef && worn.get(cdef.slot as CosmeticSlot)?.itemId === cid,
        )
      })
    })
  }
  if (opts.onBuyMore) {
    const buy = el("button", "wp-wardrobe-link", `${strings.buyMore} ▸`)
    buy.addEventListener("click", () => opts.onBuyMore?.())
    blingGroup.append(buy)
  }
  controls.append(blingGroup)

  /* footer actions */
  const actions = el("div", "wp-wardrobe-actions")
  const cancel = el("button", "wp-wardrobe-btn wp-wardrobe-btn--ghost", strings.cancel)
  const apply = el("button", "wp-wardrobe-btn wp-wardrobe-btn--apply", strings.apply)
  actions.append(cancel, apply)
  sheet.append(actions)

  redrawDoll()

  /* lifecycle */
  let settled = false
  const close = (applied: boolean) => {
    if (settled) return
    settled = true
    root.classList.remove("wp-wardrobe--in")
    window.removeEventListener("keydown", onKey)
    const done = () => {
      preview?.dispose()
      root.remove()
      if (applied) {
        try {
          opts.onApply(composeAvatar(dress, worn))
        } catch (e) {
          console.error("[wp/wardrobe] onApply threw:", e)
        }
      }
      opts.onClose?.()
    }
    root.addEventListener("transitionend", done, { once: true })
    window.setTimeout(done, 340)
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") close(false)
  }
  window.addEventListener("keydown", onKey)
  closeBtn.addEventListener("click", () => close(false))
  cancel.addEventListener("click", () => close(false))
  scrim.addEventListener("click", () => close(false))
  apply.addEventListener("click", () => close(true))

  opts.container.append(root)
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add("wp-wardrobe--in")))

  return { close: () => close(false) }
}
