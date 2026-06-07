import {
  AvatarSpec,
  GeneratedIdentity,
  PlayerId,
  CosmeticItem,
  type AvatarLayer,
} from "@corpan-city/contracts"
import namesJson from "../../content/identity/names.json"
import starterJson from "../../content/cosmetics/starter.json"
import { bindT, applyDir, type BoundT } from "../i18n"
import { musicProfileStore, DEFAULT_MUSIC_PROFILE } from "../audio/musicProfile"
import { POC_STATIONS } from "../audio/cityRadio"
import "./onboarding.css"

/**
 * runOnboarding — Corpan City's premium, skippable first run.
 *
 * Four gentle steps, framer-less (vanilla DOM + CSS transitions), mobile-first:
 *   1. WELCOME — the plaza vibe in one breath.
 *   2. NAME ROLLER — spin a safe, fun, non-identifying name from FIXED curated
 *      lists (adjective + noun + optional number). Reroll / Use this.
 *   3. DRESS-UP — a layered paper-doll preview (rendered with the same cutout
 *      art language as the world) with the free starter kit: top + tint, hat,
 *      accessory. Then "Almost there".
 *   4. MUSIC — the consent gate (corpan-city-onboarding-music-consent): "Want
 *      music while you explore?" Yes → persist `enabled:true` + the default
 *      station/volume; No → persist `enabled:false`. The city radio NEVER starts
 *      from nowhere — it only ever resumes this stored choice. Then "Enter the Plaza".
 *
 * Skippable at every step (top-right "Skip"): resolves with a sensible random
 * default name + avatar. The resolved value is validated against the Zod
 * schemas before resolving — a malformed avatar can never reach the game.
 *
 * Storage-light: the whole flow lives in memory; the caller persists the
 * result. (Corpán packs share a tiny localStorage budget — see project memory.)
 */

export interface OnboardingOptions {
  /** stable player id to brand into the identity; one is minted if absent */
  playerId?: string
  /** start at a given step (dev) */
  startStep?: 0 | 1 | 2 | 3
  /**
   * The learner's NATIVE language (stack `languages[0]`). All onboarding copy
   * renders in it, and the card orients RTL when it is a right-to-left script.
   * Onboarding runs before the target is chosen, but the native is known up
   * front. Defaults to "en".
   */
  native?: string
  /**
   * EDIT-IDENTITY mode (#110): a RETURNING player re-running ONLY the name + look
   * steps to change them. When true, `runOnboarding`:
   *   - SEEDS the name roller + wardrobe from `seedName`/`seedAvatar` (the player's
   *     current identity) so it opens on their existing choices, not random ones;
   *   - runs ONLY steps name → dress (no welcome hero, no music consent — those are
   *     first-run only); the dress step's primary button SAVES + closes;
   *   - resolves the (possibly edited) identity exactly like first-run, so the
   *     caller persists it + applies the look in place via `player.redress`.
   */
  editOnly?: boolean
  /** EDIT mode: the player's current display name to seed the roller. */
  seedName?: GeneratedIdentity
  /** EDIT mode: the player's current avatar to seed the wardrobe. */
  seedAvatar?: AvatarSpec
}

export interface OnboardingResult {
  name: GeneratedIdentity
  avatar: AvatarSpec
}

/* ----------------------------------------------------- curated data load */

interface Word {
  id: string
  label: string
}
// names.json is now MULTI-POOL (R2-6 Pair Identity): `{ pools: { "pool-universal":
// { adjectives, nouns }, … } }`. Onboarding's global default reads the universal
// pool; pair-themed pools are selected by the entry/Track layer (see
// docs/PAIR_IDENTITY.md). Back-compat: a legacy flat `{ adjectives, nouns }`
// names.json still resolves (the universal pool === those lists).
const _names = namesJson as {
  pools?: Record<string, { adjectives: Word[]; nouns: Word[] }>
  adjectives?: Word[]
  nouns?: Word[]
}
const _universalPool = _names.pools?.["pool-universal"] ?? {
  adjectives: _names.adjectives ?? [],
  nouns: _names.nouns ?? [],
}
const ADJECTIVES = _universalPool.adjectives
const NOUNS = _universalPool.nouns

interface StarterItem {
  id: string
  slot: string
  name: string
  rarity: string
  spriteRef: { url: string }
  unlock: { kind: string; value?: number }
  tints?: string[]
}
// starter.json is now MULTI-KIT (R2-6 Pair Identity): `{ kits: { "kit-traveler":
// { items }, … } }`. Onboarding's global default wears the traveler kit; pair-
// themed kits are selected by the entry/Track layer (see docs/PAIR_IDENTITY.md).
// Back-compat: a legacy flat `{ items }` starter.json still resolves.
const _starter = starterJson as {
  kits?: Record<string, { items: StarterItem[] }>
  items?: StarterItem[]
}
const STARTER = _starter.kits?.["kit-traveler"]?.items ?? _starter.items ?? []
// Validate the starter kit against the contract once at module load (fail loud
// in dev if someone edits the JSON into an invalid shape).
for (const it of STARTER) CosmeticItem.parse(it)

const bySlot = (slot: string) => STARTER.filter((i) => i.slot === slot)
const TOPS = bySlot("top")
const HATS = bySlot("hat")
const ACCS = bySlot("accessory")

const rand = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

/* ---------------------------------------------------- name composition */

function rollName(): { identity: GeneratedIdentity; display: string } {
  const adj = rand(ADJECTIVES)
  const noun = rand(NOUNS)
  // ~45% get a small number for uniqueness without ever looking identifying
  const withNum = Math.random() < 0.45
  const num = withNum ? String(10 + Math.floor(Math.random() * 89)) : undefined
  const display = `${adj.label} ${noun.label}${num ? " " + num : ""}`
  const identity: GeneratedIdentity = GeneratedIdentity.parse({
    playerId: PlayerId.parse(currentPlayerId),
    displayName: display,
    nameSeed: { adjId: adj.id, nounId: noun.id, ...(num ? { numId: num } : {}) },
  })
  return { identity, display }
}

let currentPlayerId = "player-local"

/* ---------------------------------------------------- avatar composition */

/**
 * The dress-up state the paper-doll preview + `dressToAvatar` operate on. EXPORTED
 * so the in-game WARDROBE (`economy/wardrobe.ts`) reuses the exact same model,
 * preview, and avatar builder — one dress vocabulary, no drift between onboarding
 * and re-dress.
 */
export interface DressState {
  topId: string
  topTint: string
  hatId: string
  hatTint?: string
  accId: string
  accTint?: string
  skin: string
}

/** A sensible default dress (the free starter look). Exported for the wardrobe. */
export function defaultDress(): DressState {
  return {
    topId: "top-tunic",
    topTint: TOPS[0]?.tints?.[0] ?? "#3f7fae",
    hatId: "hat-none",
    accId: "acc-none",
    skin: SKINS[1],
  }
}

/** The curated skin tones the dress-up + wardrobe offer. */
export const SKINS = ["#f4d6b0", "#f0c79a", "#e3ad79", "#c98a55", "#a06a3c", "#7a4a26"]

export function dressToAvatar(d: DressState): AvatarSpec {
  const layers: AvatarLayer[] = []
  // face/skin is the base tone; we record it as a face layer tint
  layers.push({ slot: "face", itemId: "face-base", tint: d.skin })
  if (d.topId && d.topId !== "top-none")
    layers.push({ slot: "top", itemId: d.topId, tint: d.topTint })
  if (d.hatId && d.hatId !== "hat-none")
    layers.push({ slot: "hat", itemId: d.hatId, ...(d.hatTint ? { tint: d.hatTint } : {}) })
  if (d.accId && d.accId !== "acc-none")
    layers.push({ slot: "accessory", itemId: d.accId, ...(d.accTint ? { tint: d.accTint } : {}) })
  return AvatarSpec.parse({ base: "paper-doll-a", layers, palette: { skin: d.skin } })
}

/**
 * Reverse of `dressToAvatar`: recover a `DressState` from a stored `AvatarSpec` so
 * the wardrobe re-opens showing the player's CURRENT look (not a reset). Unknown
 * layer ids collapse to the slot's "none" so a catalog cosmetic the doll can't
 * draw still leaves a clean base (the wardrobe surfaces those separately).
 */
export function dressFromAvatar(avatar: AvatarSpec): DressState {
  const d = defaultDress()
  const known = (ids: string[], id?: string) => (id && ids.includes(id) ? id : undefined)
  const topIds = ["top-none", ...TOPS.map((t) => t.id)]
  const hatIds = ["hat-none", ...HATS.map((h) => h.id)]
  const accIds = ["acc-none", ...ACCS.map((a) => a.id)]
  for (const l of avatar.layers ?? []) {
    if (l.slot === "face") d.skin = l.tint ?? d.skin
    else if (l.slot === "top") {
      d.topId = known(topIds, l.itemId) ?? d.topId
      if (l.tint) d.topTint = l.tint
    } else if (l.slot === "hat") {
      d.hatId = known(hatIds, l.itemId) ?? "hat-none"
      d.hatTint = l.tint
    } else if (l.slot === "accessory") {
      d.accId = known(accIds, l.itemId) ?? "acc-none"
      d.accTint = l.tint
    }
  }
  return d
}

/**
 * The catalog of starter dress options per slot, EXPORTED so the wardrobe can
 * offer the same base wardrobe the onboarding did (plus the player's bought
 * catalog cosmetics, which it layers on top).
 */
export const STARTER_DRESS = {
  tops: TOPS as ReadonlyArray<StarterItem>,
  hats: HATS as ReadonlyArray<StarterItem>,
  accessories: ACCS as ReadonlyArray<StarterItem>,
  skins: SKINS as ReadonlyArray<string>,
}
export type DressOption = StarterItem

/* ------------- 2D paper-doll preview (same art language as cutoutArt) ----- */

const rounded = (
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number,
) => {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function paperPiece(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number,
  fill: string, deckle = 6,
) {
  ctx.save()
  ctx.shadowColor = "rgba(28,20,12,0.28)"
  ctx.shadowBlur = 8
  ctx.shadowOffsetY = 5
  ctx.fillStyle = "#fdf7ec"
  rounded(ctx, x - deckle, y - deckle, w + deckle * 2, h + deckle * 2, r + deckle)
  ctx.fill()
  ctx.restore()
  ctx.fillStyle = fill
  rounded(ctx, x, y, w, h, r)
  ctx.fill()
  ctx.save()
  rounded(ctx, x, y, w, h, r)
  ctx.clip()
  const g = ctx.createLinearGradient(0, y, 0, y + h)
  g.addColorStop(0, "rgba(255,255,255,0.16)")
  g.addColorStop(1, "rgba(20,12,6,0.13)")
  ctx.fillStyle = g
  ctx.fillRect(x, y, w, h)
  ctx.restore()
}

/**
 * Draw the layered paper-doll for a {@link DressState}. EXPORTED so the wardrobe
 * renders the IDENTICAL preview as onboarding (one art path). It draws the
 * STARTER dress vocabulary (tunic/vest, cap/baker/sun hats, scarf/satchel); a
 * bought CATALOG cosmetic the doll doesn't know is surfaced by the wardrobe as a
 * worn-bling badge layered over this base.
 */
export function drawDoll(ctx: CanvasRenderingContext2D, W: number, H: number, d: DressState) {
  ctx.clearRect(0, 0, W, H)
  const cx = W / 2

  // legs
  paperPiece(ctx, cx - W * 0.14, H * 0.74, W * 0.11, H * 0.2, W * 0.05, "#5a4636", 4)
  paperPiece(ctx, cx + W * 0.03, H * 0.74, W * 0.11, H * 0.2, W * 0.05, "#5a4636", 4)

  // body / top
  const topTint = d.topId === "top-none" ? "#cbb083" : d.topTint
  paperPiece(ctx, cx - W * 0.24, H * 0.42, W * 0.48, H * 0.38, W * 0.14, topTint)
  // arms
  paperPiece(ctx, cx - W * 0.31, H * 0.44, W * 0.1, H * 0.26, W * 0.05, topTint, 4)
  paperPiece(ctx, cx + W * 0.21, H * 0.44, W * 0.1, H * 0.26, W * 0.05, topTint, 4)

  // vest vs tunic accent
  if (d.topId === "top-vest") {
    ctx.save()
    rounded(ctx, cx - W * 0.16, H * 0.5, W * 0.32, H * 0.28, W * 0.05)
    ctx.fillStyle = "rgba(255,255,255,0.18)"
    ctx.fill()
    ctx.restore()
  }

  // accessory: scarf (under head) or satchel (across body)
  if (d.accId === "acc-scarf") {
    ctx.fillStyle = d.accTint ?? "#c0392b"
    rounded(ctx, cx - W * 0.18, H * 0.44, W * 0.36, H * 0.06, W * 0.03)
    ctx.fill()
  } else if (d.accId === "acc-satchel") {
    paperPiece(ctx, cx + W * 0.14, H * 0.52, W * 0.16, H * 0.15, W * 0.04, d.accTint ?? "#9c6b3f", 3)
    ctx.strokeStyle = "rgba(60,40,20,0.5)"
    ctx.lineWidth = W * 0.02
    ctx.beginPath()
    ctx.moveTo(cx + W * 0.14, H * 0.52)
    ctx.quadraticCurveTo(cx + W * 0.02, H * 0.42, cx - W * 0.04, H * 0.48)
    ctx.stroke()
  }

  // head
  const hr = W * 0.18
  const hy = H * 0.3
  // simple hair tuft behind head
  paperPiece(ctx, cx - hr * 1.1, hy - hr * 1.05, hr * 2.2, hr * 1.5, hr * 0.85, "#4a3322", 4)
  paperPiece(ctx, cx - hr, hy - hr, hr * 2, hr * 2, hr, d.skin, 5)
  // face
  ctx.save()
  ctx.globalAlpha = 0.5
  ctx.fillStyle = "#e9967a"
  ctx.beginPath()
  ctx.arc(cx - hr * 0.5, hy + hr * 0.18, hr * 0.18, 0, Math.PI * 2)
  ctx.arc(cx + hr * 0.5, hy + hr * 0.18, hr * 0.18, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  ctx.fillStyle = "#2a2018"
  ctx.beginPath()
  ctx.arc(cx - hr * 0.36, hy - hr * 0.05, hr * 0.12, 0, Math.PI * 2)
  ctx.arc(cx + hr * 0.36, hy - hr * 0.05, hr * 0.12, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = "#7a3b28"
  ctx.lineWidth = hr * 0.1
  ctx.lineCap = "round"
  ctx.beginPath()
  ctx.arc(cx, hy + hr * 0.1, hr * 0.45, 0.12 * Math.PI, 0.88 * Math.PI)
  ctx.stroke()

  // hat
  if (d.hatId === "hat-cap") {
    const c = d.hatTint ?? "#b5854a"
    paperPiece(ctx, cx - hr * 1.2, hy - hr * 0.85, hr * 2.4, hr * 0.45, hr * 0.2, c, 4)
    paperPiece(ctx, cx - hr * 0.9, hy - hr * 1.7, hr * 1.8, hr * 1.0, hr * 0.4, c, 4)
  } else if (d.hatId === "hat-baker") {
    const c = d.hatTint ?? "#f2e8d0"
    paperPiece(ctx, cx - hr * 1.1, hy - hr * 1.1, hr * 2.2, hr * 0.5, hr * 0.2, c, 4)
    paperPiece(ctx, cx - hr * 0.85, hy - hr * 2.1, hr * 1.7, hr * 1.3, hr * 0.7, c, 4)
  } else if (d.hatId === "hat-sun") {
    const c = d.hatTint ?? "#e0c060"
    paperPiece(ctx, cx - hr * 1.6, hy - hr * 0.7, hr * 3.2, hr * 0.45, hr * 0.22, c, 4)
    paperPiece(ctx, cx - hr * 0.8, hy - hr * 1.6, hr * 1.6, hr * 1.0, hr * 0.5, c, 4)
    ctx.fillStyle = "rgba(0,0,0,0.12)"
    rounded(ctx, cx - hr * 0.8, hy - hr * 0.8, hr * 1.6, hr * 0.2, hr * 0.08)
    ctx.fill()
  }
}

/* --------------------------------------------------------------- DOM kit */

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K, cls?: string, text?: string,
): HTMLElementTagNameMap[K] => {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (text !== undefined) n.textContent = text
  return n
}

/* --------------------------------------------------------------- runner */

export function runOnboarding(
  container: HTMLElement,
  opts: OnboardingOptions = {},
): Promise<OnboardingResult> {
  currentPlayerId = opts.playerId ?? "player-local"
  const t: BoundT = bindT(opts.native ?? "en")

  // #110 — EDIT mode: re-running ONLY name + look, seeded from the current identity.
  const editOnly = opts.editOnly === true

  return new Promise<OnboardingResult>((resolve) => {
    // EDIT mode seeds from the player's CURRENT identity (so the roller/wardrobe open
    // on their existing name + look); first-run starts from sensible random defaults.
    const dress = editOnly && opts.seedAvatar ? dressFromAvatar(opts.seedAvatar) : defaultDress()
    let nameState =
      editOnly && opts.seedName
        ? { identity: opts.seedName, display: opts.seedName.displayName }
        : rollName()

    const root = el("div", "wp-onb")
    // Orient the onboarding card for an RTL native (Arabic, Hebrew, Farsi, Urdu).
    applyDir(root, opts.native ?? "en")
    const card = el("div", "wp-onb-card")
    root.appendChild(card)
    container.appendChild(root)
    // animate in
    requestAnimationFrame(() => root.classList.add("wp-onb--in"))

    let settled = false
    const finish = (result?: OnboardingResult) => {
      if (settled) return
      settled = true
      const out: OnboardingResult =
        result ?? { name: nameState.identity, avatar: dressToAvatar(dress) }
      // final validation gate — never resolve with anything the game can't trust
      GeneratedIdentity.parse(out.name)
      AvatarSpec.parse(out.avatar)
      root.classList.remove("wp-onb--in")
      root.classList.add("wp-onb--out")
      setTimeout(() => {
        root.remove()
        resolve(out)
      }, 320)
    }

    // Skip button (always present)
    const skip = el("button", "wp-onb-skip", t("onb.skip"))
    skip.setAttribute("aria-label", t("onb.skipAria"))
    skip.onclick = () => finish() // resolves with the current (sensible) defaults
    card.appendChild(skip)

    // Step dots — first-run: welcome · name · dress · music (the music step is the
    // consent gate so the radio never starts from nowhere). EDIT mode (#110): only
    // the two editable steps (name · dress) — no welcome hero, no music re-consent.
    const dots = el("div", "wp-onb-dots")
    const dotIdx = editOnly ? [1, 2] : [0, 1, 2, 3]
    const dotEls = new Map<number, HTMLElement>()
    for (const i of dotIdx) {
      const d = el("span", "wp-onb-dot")
      dotEls.set(i, d)
      dots.appendChild(d)
    }
    card.appendChild(dots)

    // Step host (content swaps here)
    const host = el("div", "wp-onb-host")
    card.appendChild(host)

    // EDIT mode opens directly on the NAME step (welcome is first-run only).
    let step: 0 | 1 | 2 | 3 = opts.startStep ?? (editOnly ? 1 : 0)
    const setStep = (s: 0 | 1 | 2 | 3) => {
      step = s
      dotEls.forEach((d, i) => d.classList.toggle("wp-onb-dot--on", i === s))
      void step // step is read by callers/handlers; keep the assignment meaningful
      host.classList.remove("wp-onb-host--in")
      host.innerHTML = ""
      if (s === 0) renderWelcome()
      else if (s === 1) renderName()
      else if (s === 2) renderDress()
      else renderMusic()
      requestAnimationFrame(() => host.classList.add("wp-onb-host--in"))
    }

    /* ---- step 0: welcome ---- */
    const renderWelcome = () => {
      const hero = el("div", "wp-onb-hero")
      // tiny animated paper diorama header (canvas of a doll waving)
      const cv = el("canvas", "wp-onb-hero-canvas") as HTMLCanvasElement
      cv.width = 220
      cv.height = 220
      const hctx = cv.getContext("2d")
      if (hctx) drawDoll(hctx, 220, 220, defaultDress())
      hero.appendChild(cv)
      host.appendChild(hero)

      host.appendChild(el("h1", "wp-onb-title", t("onb.welcome.title")))
      host.appendChild(el("p", "wp-onb-sub", t("onb.welcome.sub")))
      const go = el("button", "wp-onb-btn wp-onb-btn--primary", t("onb.welcome.begin"))
      go.onclick = () => setStep(1)
      host.appendChild(go)
    }

    /* ---- step 1: name roller ---- */
    const renderName = () => {
      host.appendChild(el("h2", "wp-onb-title", t("onb.name.title")))
      host.appendChild(el("p", "wp-onb-sub", t("onb.name.sub")))

      const roller = el("div", "wp-onb-roller")
      const nameLabel = el("div", "wp-onb-name", nameState.display)
      roller.appendChild(nameLabel)
      host.appendChild(roller)

      const showName = (animate = true) => {
        if (animate) {
          nameLabel.classList.remove("wp-onb-name--pop")
          void nameLabel.offsetWidth
          nameLabel.classList.add("wp-onb-name--pop")
        }
        nameLabel.textContent = nameState.display
      }

      const row = el("div", "wp-onb-row")
      const reroll = el("button", "wp-onb-btn wp-onb-btn--ghost", t("onb.name.reroll"))
      reroll.onclick = () => {
        // brief spin: cycle a few teaser names then settle
        let n = 0
        const spin = () => {
          nameState = rollName()
          nameLabel.textContent = nameState.display
          n++
          if (n < 6) setTimeout(spin, 55 + n * 12)
          else showName(true)
        }
        spin()
      }
      const use = el("button", "wp-onb-btn wp-onb-btn--primary", t("onb.name.use"))
      use.onclick = () => setStep(2)
      row.appendChild(reroll)
      row.appendChild(use)
      host.appendChild(row)
    }

    /* ---- step 2: dress-up ---- */
    const renderDress = () => {
      host.appendChild(el("h2", "wp-onb-title", t("onb.dress.title")))
      host.appendChild(el("p", "wp-onb-sub", t("onb.dress.subNamed", { name: nameState.display })))

      const stage = el("div", "wp-onb-stage")
      const cv = el("canvas", "wp-onb-doll") as HTMLCanvasElement
      cv.width = 260
      cv.height = 320
      const dctx = cv.getContext("2d")
      const redraw = () => {
        if (dctx) drawDoll(dctx, 260, 320, dress)
      }
      redraw()
      stage.appendChild(cv)
      host.appendChild(stage)

      const wardrobe = el("div", "wp-onb-wardrobe")

      // A chip row factory for a slot
      const swatchRow = (
        label: string,
        items: StarterItem[],
        getActive: () => string,
        onPick: (it: StarterItem) => void,
      ) => {
        const group = el("div", "wp-onb-group")
        group.appendChild(el("div", "wp-onb-group-label", label))
        const chips = el("div", "wp-onb-chips")
        const refresh = () => {
          chips.querySelectorAll(".wp-onb-chip").forEach((c) => {
            c.classList.toggle("wp-onb-chip--on", (c as HTMLElement).dataset.id === getActive())
          })
        }
        items.forEach((it) => {
          const chip = el("button", "wp-onb-chip", it.name)
          chip.dataset.id = it.id
          chip.onclick = () => {
            onPick(it)
            redraw()
            refresh()
          }
          chips.appendChild(chip)
        })
        group.appendChild(chips)
        refresh()
        return group
      }

      // A colour swatch row for tints on the active item
      const tintRow = (
        label: string,
        getTints: () => string[] | undefined,
        getActive: () => string | undefined,
        onPick: (c: string) => void,
      ) => {
        const group = el("div", "wp-onb-group")
        group.appendChild(el("div", "wp-onb-group-label", label))
        const chips = el("div", "wp-onb-chips")
        group.appendChild(chips)
        const build = () => {
          chips.innerHTML = ""
          const tints = getTints() ?? []
          tints.forEach((c) => {
            const sw = el("button", "wp-onb-tint")
            sw.style.background = c
            sw.dataset.c = c
            sw.onclick = () => {
              onPick(c)
              redraw()
              chips.querySelectorAll(".wp-onb-tint").forEach((s) =>
                s.classList.toggle("wp-onb-tint--on", (s as HTMLElement).dataset.c === getActive()),
              )
            }
            if (c === getActive()) sw.classList.add("wp-onb-tint--on")
            chips.appendChild(sw)
          })
          group.style.display = tints.length ? "" : "none"
        }
        build()
        return { group, build }
      }

      // TOP slot + its tint
      const topTints = tintRow(
        t("onb.dress.color"),
        () => TOPS.find((top) => top.id === dress.topId)?.tints,
        () => dress.topTint,
        (c) => (dress.topTint = c),
      )
      wardrobe.appendChild(
        swatchRow(t("onb.dress.outfit"), TOPS, () => dress.topId, (it) => {
          dress.topId = it.id
          dress.topTint = it.tints?.[0] ?? dress.topTint
          topTints.build()
        }),
      )
      wardrobe.appendChild(topTints.group)

      // HAT slot + its tint
      const hatTints = tintRow(
        t("onb.dress.hatColor"),
        () => HATS.find((h) => h.id === dress.hatId)?.tints,
        () => dress.hatTint,
        (c) => (dress.hatTint = c),
      )
      wardrobe.appendChild(
        swatchRow(t("onb.dress.hat"), HATS, () => dress.hatId, (it) => {
          dress.hatId = it.id
          dress.hatTint = it.tints?.[0]
          hatTints.build()
        }),
      )
      wardrobe.appendChild(hatTints.group)

      // ACCESSORY slot + its tint
      const accTints = tintRow(
        t("onb.dress.accessoryColor"),
        () => ACCS.find((a) => a.id === dress.accId)?.tints,
        () => dress.accTint,
        (c) => (dress.accTint = c),
      )
      wardrobe.appendChild(
        swatchRow(t("onb.dress.accessory"), ACCS, () => dress.accId, (it) => {
          dress.accId = it.id
          dress.accTint = it.tints?.[0]
          accTints.build()
        }),
      )
      wardrobe.appendChild(accTints.group)

      // SKIN tones
      const skinGroup = el("div", "wp-onb-group")
      skinGroup.appendChild(el("div", "wp-onb-group-label", t("onb.dress.skin")))
      const skinChips = el("div", "wp-onb-chips")
      SKINS.forEach((c) => {
        const sw = el("button", "wp-onb-tint")
        sw.style.background = c
        sw.dataset.c = c
        if (c === dress.skin) sw.classList.add("wp-onb-tint--on")
        sw.onclick = () => {
          dress.skin = c
          redraw()
          skinChips.querySelectorAll(".wp-onb-tint").forEach((s) =>
            s.classList.toggle("wp-onb-tint--on", (s as HTMLElement).dataset.c === c),
          )
        }
        skinChips.appendChild(sw)
      })
      skinGroup.appendChild(skinChips)
      wardrobe.appendChild(skinGroup)

      host.appendChild(wardrobe)

      // First-run: dress advances to the music-consent step. EDIT mode (#110): dress
      // is the LAST step — its button SAVES the (possibly changed) name + look and
      // closes; the caller persists + applies the look in place via player.redress.
      const dressBtnKey = editOnly ? "onb.edit.save" : "onb.dress.next"
      const next = el("button", "wp-onb-btn wp-onb-btn--primary wp-onb-btn--enter", t(dressBtnKey))
      next.onclick = editOnly ? () => finish() : () => setStep(3)
      host.appendChild(next)
    }

    /* ---- step 3: music consent ---- */
    // Owner directive (corpan-city-onboarding-music-consent): the player CHOOSES
    // music here, before the world — the city radio never starts from nowhere. Both
    // choices are a consent: "Yes" persists `enabled:true` (+ the default station/
    // volume) so the radio resumes it; "No" persists `enabled:false` so the world
    // stays quiet. The Phone's Music app then merely CONTROLS this consented feature.
    const renderMusic = () => {
      host.appendChild(el("h2", "wp-onb-title", t("onb.music.title")))
      host.appendChild(el("p", "wp-onb-sub", t("onb.music.sub")))

      // A calm radio glyph (inherits the onboarding ink) over the choice.
      const hero = el("div", "wp-onb-music-hero")
      hero.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<rect x="3" y="8.5" width="18" height="11.5" rx="2.5"/>' +
        '<path d="M7 8.5 16 4"/><circle cx="8.5" cy="14.2" r="2.6"/>' +
        '<path d="M16 12.5h2.5M16 16h2.5"/></svg>'
      host.appendChild(hero)

      // The station the radio will start on if they say yes (read off the dial).
      const defaultStation = POC_STATIONS[0]
      const hint = el(
        "p",
        "wp-onb-music-hint",
        t("onb.music.hint", { station: defaultStation?.name ?? "the city station" }),
      )
      host.appendChild(hint)

      const row = el("div", "wp-onb-music-choices")
      const no = el("button", "wp-onb-btn wp-onb-btn--ghost", t("onb.music.no"))
      no.onclick = () => {
        musicProfileStore.set({ enabled: false })
        finish()
      }
      const yes = el("button", "wp-onb-btn wp-onb-btn--primary", t("onb.music.yes"))
      yes.onclick = () => {
        // Consent ON + the remembered station/volume the radio resumes (defaults
        // are explicit so a restart never reverts to a different station/level).
        musicProfileStore.set({
          enabled: true,
          stationId: defaultStation?.id ?? null,
          volume: DEFAULT_MUSIC_PROFILE.volume,
        })
        finish()
      }
      row.append(no, yes)
      host.appendChild(row)
    }

    setStep(step)
  })
}

/** A valid default identity + avatar, e.g. for "Skip" callers or tests. */
export function defaultIdentity(playerId = "player-local"): OnboardingResult {
  currentPlayerId = playerId
  const name = rollName().identity
  const avatar = dressToAvatar(defaultDress())
  return { name, avatar }
}
