/**
 * The centered, RPG-framed challenge ENCOUNTER overlay.
 *
 * One `ChallengeOverlay` owns: the fixed full-screen scrim, the framed
 * paper-cutout card, the NPC pretext ribbon, a timer/score/streak HUD, juicy
 * correct/wrong/combo feedback, and the coins/XP/item reward reveal. Each
 * `ChallengeTool` is handed an {@link OverlayApi} and renders ONLY into the
 * card body — it never touches the frame, so every challenge feels consistent
 * and premium.
 *
 * Layout-shift contract: the scrim/card are `position: fixed` from frame 0;
 * open/close animates opacity + transform only (compositor); the first
 * focusable input is focused with `preventScroll`. Mounting/unmounting can
 * NEVER reflow the canvas underneath.
 */

import "./challenge.css"
import type { ChallengeReward } from "@world-plaza/contracts"
import {
  moodForScore,
  renderResultCrest,
  renderXpIcon,
  renderCoinIcon,
  renderItemIcon,
} from "./resultArt"

/** Procedural mark glyphs (NO emoji) for the small chrome bits — drawn as inline
 *  SVG so they inherit `currentColor` and stay crisp at any size. */
function svgMark(kind: "close" | "check" | "cross" | "flame"): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg"
  const svg = document.createElementNS(ns, "svg")
  svg.setAttribute("viewBox", "0 0 24 24")
  svg.setAttribute("width", "1em")
  svg.setAttribute("height", "1em")
  svg.setAttribute("aria-hidden", "true")
  svg.style.display = "block"
  const path = document.createElementNS(ns, "path")
  path.setAttribute("fill", "none")
  path.setAttribute("stroke", "currentColor")
  path.setAttribute("stroke-width", "2.4")
  path.setAttribute("stroke-linecap", "round")
  path.setAttribute("stroke-linejoin", "round")
  const d = {
    close: "M6 6 L18 18 M18 6 L6 18",
    check: "M5 13 L10 18 L19 6",
    cross: "M6 6 L18 18 M18 6 L6 18",
    flame: "M12 3 C9 7 14 8 12 12 C10 9 7 11 8 15 A4.5 4.5 0 0 0 16 15 C17 11 14 10 14 7 C13.4 8 12.6 8 12 3 Z",
  }[kind]
  path.setAttribute("d", d)
  if (kind === "flame") path.setAttribute("fill", "currentColor")
  svg.appendChild(path)
  return svg
}

/** A neutral procedural bust (head + shoulders) for an avatar tile with no glyph. */
function neutralBust(): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg"
  const svg = document.createElementNS(ns, "svg")
  svg.setAttribute("viewBox", "0 0 24 24")
  svg.setAttribute("width", "1.1em")
  svg.setAttribute("height", "1.1em")
  svg.setAttribute("aria-hidden", "true")
  svg.style.display = "block"
  const head = document.createElementNS(ns, "circle")
  head.setAttribute("cx", "12")
  head.setAttribute("cy", "9")
  head.setAttribute("r", "4")
  head.setAttribute("fill", "currentColor")
  const body = document.createElementNS(ns, "path")
  body.setAttribute("d", "M4 21 a8 8 0 0 1 16 0 Z")
  body.setAttribute("fill", "currentColor")
  svg.appendChild(head)
  svg.appendChild(body)
  return svg
}

export interface OverlayPretext {
  /** NPC display name shown in the ribbon. */
  npcName: string
  /** Emoji/glyph for the NPC avatar tile. */
  avatar: string
  /** The in-character line that frames the challenge ("my words got scrambled…"). */
  line: string
}

/** Feedback flavors a tool can splash. */
export type FeedbackKind = "good" | "bad"

/** The surface a mounted tool drives the frame through. */
export interface OverlayApi {
  /** The card body element — the tool renders all of its UI here. */
  readonly body: HTMLElement
  /**
   * Set the big centered prompt above the tool UI — RESERVED for actual STIMULUS
   * content (the phrase to read, the word to unscramble), NOT meta-instructions.
   * `sub` is the small caption beneath it (e.g. a romanization / meaning hint).
   */
  setPrompt: (text: string, sub?: string) => void
  /**
   * Set the small, SECONDARY instruction line ("Which is it? Listen carefully.")
   * — a quiet caption that is part of the challenge widget's chrome, never a big
   * NPC-style bubble and NEVER spoken by TTS. Use this for the meta-instruction;
   * use {@link setPrompt} only for the stimulus the player must act on. Passing an
   * empty string clears it.
   */
  setInstruction: (text: string) => void
  /** Show the timer bar and count down `seconds`; calls `onExpire` once at 0. */
  startTimer: (seconds: number, onExpire: () => void) => void
  /** Stop + hide the timer (e.g. on the last correct answer). */
  stopTimer: () => void
  /** Update the score chip (0..1 normalized → shown as %). */
  setScore: (score01: number) => void
  /** Set the visible streak count; pulses on increase. */
  setStreak: (n: number) => void
  /** Splash juicy feedback (✓ combo / ✗) over the card. */
  feedback: (kind: FeedbackKind, label?: string) => void
  /** Speak a phrase via host TTS (wired by the runner to the host). */
  speak: (text: string) => Promise<void>
  /**
   * Finish the challenge: reveals the reward, then resolves the run.
   * `score01` is the normalized final score; `reward` the concrete grant.
   */
  complete: (score01: number, reward: ChallengeReward, grade?: string) => void
  /** Abort without a result (the player closed the encounter). */
  cancel: () => void
  /** A focusable handle: focus the first input WITHOUT scroll-jumping WebKit. */
  focusSafely: (el: HTMLElement) => void
}

export interface OverlayCallbacks {
  /** TTS bridge supplied by the runner (→ host.speak). */
  speak: (text: string) => Promise<void>
  /** Fired exactly once with the final normalized score + reward. */
  onComplete: (score01: number, reward: ChallengeReward) => void
  /** Fired if the player cancels before completing. */
  onCancel: () => void
}

export interface ChallengeOverlayHandle {
  api: OverlayApi
  unmount: () => void
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (text != null) node.textContent = text
  return node
}

/**
 * Mount the encounter overlay into `container` (the game overlay layer). The
 * tool then renders into `handle.api.body`.
 */
export function mountChallengeOverlay(
  container: HTMLElement,
  pretext: OverlayPretext,
  cb: OverlayCallbacks,
): ChallengeOverlayHandle {
  let finished = false
  let timerRaf: number | null = null

  const scrim = el("div", "wp-ch-scrim")
  scrim.setAttribute("role", "dialog")
  scrim.setAttribute("aria-modal", "true")

  const card = el("div", "wp-ch-card")
  scrim.appendChild(card)

  // ---- close button ----
  const closeBtn = el("button", "wp-ch-close")
  closeBtn.appendChild(svgMark("close"))
  closeBtn.setAttribute("aria-label", "Leave challenge")
  closeBtn.addEventListener("click", () => doCancel())
  card.appendChild(closeBtn)

  // ---- pretext ribbon ----
  const ribbon = el("div", "wp-ch-pretext")
  // The avatar tile renders whatever glyph the NPC supplies; when none is given
  // we draw a neutral procedural bust (NO emoji fallback) so the ribbon is never
  // a bare placeholder face.
  const avatar = el("div", "wp-ch-avatar")
  if (pretext.avatar) avatar.textContent = pretext.avatar
  else avatar.appendChild(neutralBust())
  const ptext = el("div", "wp-ch-pretext-text")
  ptext.appendChild(el("div", "wp-ch-npc-name", pretext.npcName))
  ptext.appendChild(el("div", "wp-ch-pretext-line", pretext.line))
  ribbon.appendChild(avatar)
  ribbon.appendChild(ptext)
  card.appendChild(ribbon)

  // ---- HUD: timer / streak / score ----
  const hud = el("div", "wp-ch-hud")
  const timerWrap = el("div", "wp-ch-timer")
  const timerFill = el("div", "wp-ch-timer__fill")
  timerWrap.appendChild(timerFill)
  timerWrap.style.display = "none"
  const streakChip = el("div", "wp-ch-chip wp-ch-chip--streak")
  streakChip.style.display = "none"
  const scoreChip = el("div", "wp-ch-chip wp-ch-chip--score", "0%")
  hud.appendChild(timerWrap)
  hud.appendChild(streakChip)
  hud.appendChild(scoreChip)
  card.appendChild(hud)

  // ---- body (tool renders here) ----
  const body = el("div", "wp-ch-body")
  card.appendChild(body)

  container.appendChild(scrim)
  // Force a frame so the entrance transition runs (no layout shift — fixed).
  requestAnimationFrame(() => scrim.classList.add("wp-ch-scrim--in"))

  /* ---------------- timer ---------------- */
  function clearTimer() {
    if (timerRaf != null) cancelAnimationFrame(timerRaf)
    timerRaf = null
  }
  function startTimer(seconds: number, onExpire: () => void) {
    clearTimer()
    timerWrap.style.display = ""
    const total = seconds * 1000
    const start = performance.now()
    const tick = (now: number) => {
      const elapsed = now - start
      const frac = Math.max(0, 1 - elapsed / total)
      timerFill.style.transform = `scaleX(${frac})`
      timerFill.classList.toggle("wp-ch-timer__fill--low", frac < 0.28)
      if (frac <= 0) {
        timerRaf = null
        onExpire()
        return
      }
      timerRaf = requestAnimationFrame(tick)
    }
    timerRaf = requestAnimationFrame(tick)
  }
  function stopTimer() {
    clearTimer()
    timerWrap.style.display = "none"
  }

  /* ---------------- feedback splash ---------------- */
  function feedback(kind: FeedbackKind, label?: string) {
    const splash = el(
      "div",
      `wp-ch-splash wp-ch-splash--${kind === "good" ? "good" : "bad"}`,
    )
    if (label) splash.textContent = label
    else splash.appendChild(svgMark(kind === "good" ? "check" : "cross"))
    card.appendChild(splash)
    requestAnimationFrame(() => splash.classList.add("wp-ch-splash--go"))
    setTimeout(() => splash.remove(), 760)
  }

  /* ---------------- HUD setters ---------------- */
  function setScore(score01: number) {
    const pct = Math.round(Math.max(0, Math.min(1, score01)) * 100)
    scoreChip.textContent = `${pct}%`
    scoreChip.classList.remove("wp-ch-chip__pulse")
    void scoreChip.offsetWidth
    scoreChip.classList.add("wp-ch-chip__pulse")
  }
  function setStreak(n: number) {
    if (n <= 1) {
      streakChip.style.display = "none"
      return
    }
    streakChip.style.display = ""
    streakChip.replaceChildren()
    const flame = svgMark("flame")
    flame.style.marginRight = "3px"
    streakChip.appendChild(flame)
    streakChip.appendChild(document.createTextNode(String(n)))
    streakChip.classList.remove("wp-ch-chip__pulse")
    void streakChip.offsetWidth
    streakChip.classList.add("wp-ch-chip__pulse")
  }

  function setPrompt(text: string, sub?: string) {
    let prompt = body.querySelector<HTMLElement>(".wp-ch-prompt")
    if (!prompt) {
      prompt = el("div", "wp-ch-prompt")
      // Sit BELOW any instruction caption (which owns the top of the body) but
      // above the tool UI.
      const instr = body.querySelector<HTMLElement>(".wp-ch-instruction")
      if (instr) instr.after(prompt)
      else body.insertBefore(prompt, body.firstChild)
    }
    prompt.textContent = text
    let subEl = body.querySelector<HTMLElement>(".wp-ch-sub")
    if (sub) {
      if (!subEl) {
        subEl = el("div", "wp-ch-sub")
        prompt.after(subEl)
      }
      subEl.textContent = sub
    } else if (subEl) {
      subEl.remove()
    }
  }

  function setInstruction(text: string) {
    let instr = body.querySelector<HTMLElement>(".wp-ch-instruction")
    if (!text) {
      instr?.remove()
      return
    }
    if (!instr) {
      instr = el("div", "wp-ch-instruction")
      // The instruction is the quiet caption at the very TOP of the body — above
      // the prompt + tool UI — so it reads as the widget's own small label.
      body.insertBefore(instr, body.firstChild)
    }
    instr.textContent = text
  }

  function focusSafely(target: HTMLElement) {
    try {
      ;(target as HTMLElement & { focus: (o?: FocusOptions) => void }).focus({
        preventScroll: true,
      })
    } catch {
      target.focus()
    }
  }

  /* ---------------- reward reveal ---------------- */
  function showReward(score01: number, reward: ChallengeReward, grade?: string) {
    const mood = moodForScore(score01)
    const panel = el("div", `wp-ch-reward wp-ch-reward--${mood.tier}`)
    // The whole panel's MOOD tiers with the score: a miss gets a calm, neutral
    // surface (no gold, no confetti, no celebratory glyph); a win gets the warm
    // paper + crest + confetti. Never congratulate a 0%.
    panel.style.background = mood.panelBg
    // Inner column carries the content + `margin:auto` so it centers when the
    // card has room and scrolls (top-anchored) when the viewport is short.
    const inner = el("div", "wp-ch-reward__inner")
    panel.appendChild(inner)
    const pct = Math.round(score01 * 100)

    // Procedural tiered crest (NO emoji) — star/check/ring/retry by tier.
    const crest = el("div", "wp-ch-reward__burst")
    crest.appendChild(renderResultCrest(mood.tier, 72))
    inner.appendChild(crest)

    const gradeEl = el("div", "wp-ch-reward__grade", grade ?? gradeFor(score01))
    gradeEl.style.color = mood.titleColor
    inner.appendChild(gradeEl)
    const titleEl = el("div", "wp-ch-reward__title", RESULT_TITLE[mood.titleKey])
    titleEl.style.color = mood.titleColor
    inner.appendChild(titleEl)

    const rows = el("div", "wp-ch-reward__rows")
    const mkRow = (
      icon: HTMLCanvasElement | null,
      label: string,
      amt: string,
      delay: number,
      amtColor?: string,
    ) => {
      const row = el("div", "wp-ch-reward__row")
      row.style.animationDelay = `${delay}ms`
      const labelWrap = el("span", "wp-ch-reward__label")
      if (icon) {
        icon.classList.add("wp-ch-reward__glyph")
        labelWrap.appendChild(icon)
      }
      labelWrap.appendChild(document.createTextNode(label))
      row.appendChild(labelWrap)
      const amtEl = el("span", "wp-ch-reward__amt", amt)
      if (amtColor) amtEl.style.color = amtColor
      row.appendChild(amtEl)
      return row
    }
    // Score row: amount color follows the mood (muted on a miss, not green).
    rows.appendChild(mkRow(null, "Score", `${pct}%`, 60, mood.amountColor))
    rows.appendChild(mkRow(renderXpIcon(22), "XP", `+${reward.xp}`, 160, mood.amountColor))
    rows.appendChild(mkRow(renderCoinIcon(22), "Coins", `+${reward.coins}`, 260, mood.amountColor))
    if (reward.items.length) {
      const itemRow = el("div", "wp-ch-reward__row")
      itemRow.style.animationDelay = "360ms"
      for (const id of reward.items) {
        const rare = /rare|token|relic|gem/i.test(id)
        const chip = el(
          "span",
          `wp-ch-reward__item${rare ? " wp-ch-reward__item--rare" : ""}`,
        )
        const ic = renderItemIcon(id, 20)
        ic.classList.add("wp-ch-reward__glyph")
        chip.appendChild(ic)
        chip.appendChild(document.createTextNode(prettyItem(id)))
        itemRow.appendChild(chip)
      }
      rows.appendChild(itemRow)
    }
    inner.appendChild(rows)

    const cont = el("button", "wp-ch-btn", "Claim reward")
    cont.style.marginTop = "8px"
    cont.style.animationDelay = "460ms"
    cont.classList.add("wp-ch-reward__row")
    cont.addEventListener("click", () => {
      cb.onComplete(score01, reward)
      close()
    })
    inner.appendChild(cont)

    // Hide the card chrome so the card sizes to the reward alone (grow-to-content
    // where there's room; the crown is never clipped). The reward is in-flow.
    card.classList.add("wp-ch-card--rewarding")
    card.appendChild(panel)
    // Confetti ONLY on an actual win (mood.celebrate) — never on a miss. It rides
    // the card (overflow:hidden) so it isn't clipped by the reward's scroll region.
    if (mood.celebrate) confetti(card)
    requestAnimationFrame(() => panel.classList.add("wp-ch-reward--in"))
    focusSafely(cont)
  }

  function confetti(parent: HTMLElement) {
    const colors = ["#e8b54a", "#5fbf6a", "#e8704a", "#c9a4ff", "#5aa9e6"]
    for (let i = 0; i < 18; i++) {
      const dot = el("div", "wp-ch-confetti")
      dot.style.left = `${8 + Math.random() * 84}%`
      dot.style.background = colors[i % colors.length]
      dot.style.animation = `wp-ch-fall ${0.9 + Math.random() * 0.7}s ease-in ${Math.random() * 0.3}s forwards`
      parent.appendChild(dot)
    }
  }

  /* ---------------- lifecycle ---------------- */
  function complete(score01: number, reward: ChallengeReward, grade?: string) {
    if (finished) return
    finished = true
    clearTimer()
    // #62 — record the OUTCOME on the scrim so the NPC chat (which watches the
    // overlay's lifecycle, not the result) congratulates ONLY on a real finish,
    // never on a bail. The observer reads this from the (detached) scrim node.
    scrim.dataset.wpChOutcome = "completed"
    showReward(Math.max(0, Math.min(1, score01)), reward, grade)
  }
  function doCancel() {
    if (finished) {
      close()
      return
    }
    finished = true
    scrim.dataset.wpChOutcome = "aborted" // #62 — a bail, never congratulated
    cb.onCancel()
    close()
  }
  function close() {
    clearTimer()
    scrim.classList.remove("wp-ch-scrim--in")
    setTimeout(() => scrim.remove(), 280)
  }

  // ESC closes; tools' own inputs handle Enter.
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation()
      doCancel()
    }
  }
  scrim.addEventListener("keydown", onKey)
  // Click on the scrim backdrop (not the card) cancels.
  scrim.addEventListener("pointerdown", (e) => {
    if (e.target === scrim) doCancel()
  })

  const api: OverlayApi = {
    body,
    setPrompt,
    setInstruction,
    startTimer,
    stopTimer,
    setScore,
    setStreak,
    feedback,
    speak: cb.speak,
    complete,
    cancel: doCancel,
    focusSafely,
  }

  return {
    api,
    unmount: () => {
      finished = true
      close()
    },
  }
}

/**
 * Score-tiered headline (English source). The tone tiers WITH the score: a 0%
 * gets an encouraging-but-honest "Not this time", never a celebration.
 * TODO(i18n): these map 1:1 to keys `result.fail|low|mid|high|perfect` — route
 * through `t()` when the i18n slice keys them (owned by the i18n agent).
 */
const RESULT_TITLE: Record<
  "result.fail" | "result.low" | "result.mid" | "result.high" | "result.perfect",
  string
> = {
  "result.fail": "Not this time",
  "result.low": "Keep at it",
  "result.mid": "Well done!",
  "result.high": "Great work!",
  "result.perfect": "Magnificent!",
}

function gradeFor(score01: number): string {
  if (score01 >= 0.92) return "Perfect"
  if (score01 >= 0.75) return "Great"
  if (score01 >= 0.5) return "Good"
  if (score01 > 0) return "Cleared"
  return "Try again"
}

function prettyItem(id: string): string {
  return id
    .replace(/^item[-_]/, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
