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
  /** Set the big centered prompt above the tool UI (optional helper). */
  setPrompt: (text: string, sub?: string) => void
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
  const closeBtn = el("button", "wp-ch-close", "✕")
  closeBtn.setAttribute("aria-label", "Leave challenge")
  closeBtn.addEventListener("click", () => doCancel())
  card.appendChild(closeBtn)

  // ---- pretext ribbon ----
  const ribbon = el("div", "wp-ch-pretext")
  const avatar = el("div", "wp-ch-avatar", pretext.avatar || "🧑")
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
      label ?? (kind === "good" ? "✓" : "✗"),
    )
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
    streakChip.textContent = `🔥 ${n}`
    streakChip.classList.remove("wp-ch-chip__pulse")
    void streakChip.offsetWidth
    streakChip.classList.add("wp-ch-chip__pulse")
  }

  function setPrompt(text: string, sub?: string) {
    let prompt = body.querySelector<HTMLElement>(".wp-ch-prompt")
    if (!prompt) {
      prompt = el("div", "wp-ch-prompt")
      body.insertBefore(prompt, body.firstChild)
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
    const panel = el("div", "wp-ch-reward")
    // Inner column carries the content + `margin:auto` so it centers when the
    // card has room and scrolls (top-anchored) when the viewport is short.
    const inner = el("div", "wp-ch-reward__inner")
    panel.appendChild(inner)
    const pct = Math.round(score01 * 100)
    const burstGlyph = score01 >= 0.85 ? "🌟" : score01 >= 0.5 ? "✨" : "💪"
    inner.appendChild(el("div", "wp-ch-reward__burst", burstGlyph))
    inner.appendChild(
      el("div", "wp-ch-reward__grade", grade ?? gradeFor(score01)),
    )
    inner.appendChild(
      el(
        "div",
        "wp-ch-reward__title",
        score01 >= 0.85 ? "Magnificent!" : score01 >= 0.5 ? "Well done!" : "Nice try!",
      ),
    )

    const rows = el("div", "wp-ch-reward__rows")
    const mkRow = (label: string, amt: string, delay: number) => {
      const row = el("div", "wp-ch-reward__row")
      row.style.animationDelay = `${delay}ms`
      row.appendChild(el("span", undefined, label))
      row.appendChild(el("span", "wp-ch-reward__amt", amt))
      return row
    }
    rows.appendChild(mkRow("Score", `${pct}%`, 60))
    rows.appendChild(mkRow("⭐ XP", `+${reward.xp}`, 160))
    rows.appendChild(mkRow("🪙 Coins", `+${reward.coins}`, 260))
    if (reward.items.length) {
      const itemRow = el("div", "wp-ch-reward__row")
      itemRow.style.animationDelay = "360ms"
      for (const id of reward.items) {
        const rare = /rare|token|relic|gem/i.test(id)
        const chip = el(
          "span",
          `wp-ch-reward__item${rare ? " wp-ch-reward__item--rare" : ""}`,
        )
        chip.textContent = `${rare ? "🎁" : "📦"} ${prettyItem(id)}`
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
    // Confetti rides the card (overflow:hidden) so it isn't clipped by the
    // reward's own scroll region and never expands the scrollable area.
    if (score01 >= 0.5) confetti(card)
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
    showReward(Math.max(0, Math.min(1, score01)), reward, grade)
  }
  function doCancel() {
    if (finished) {
      close()
      return
    }
    finished = true
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
