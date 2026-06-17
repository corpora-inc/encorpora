import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
} from "react"
import { motion, useReducedMotion } from "framer-motion"
import {
  Brain,
  Mic,
  BookOpen,
  Radio,
  Gamepad2,
  PenTool,
  Sparkles,
  Citrus,
  Package,
  type LucideIcon,
} from "lucide-react"
import { triggerHaptic } from "@/util/haptics"

/**
 * The first-launch "razzle-dazzle" — a ~5s premium, full-screen collage that
 * plays ONCE when a brand-new user lands in their very first experience after
 * onboarding. A lively shuffle of every experience ("ding ding ding"), then the
 * chosen one pops to center with a haptic, then its colour washes the screen as
 * the real experience boots underneath.
 *
 * PURELY VISUAL. App.tsx owns all logic and timing handoff — this component only
 * animates and fires one haptic; it reports its two beats via `onReveal`
 * (chosen begins its center/wash → caller launches the experience under us) and
 * `onComplete` (the wash has covered + the overlay should unmount). It ALWAYS
 * reaches `onComplete` (a hard safety timeout backstops the animation), so it can
 * never trap the user. Honors reduced motion: skips the shuffle for a gentle
 * ~1s cross-fade, still firing the haptic + both callbacks.
 *
 * Art resolution mirrors Home (HomeHub's `Glyph`): catalog `imageUrl` rounded +
 * object-cover when present, else a colour-tinted tile with a lucide icon
 * resolved by name (registry fallback → Package).
 */

export type RazzleCard = {
  id: string
  name: string
  imageUrl?: string
  /** A lucide-react icon name (e.g. "Brain", "BookOpen") — resolved → component. */
  icon?: string
  /** Hex/CSS colour for the tile + the chosen-card wash. */
  color?: string
}

// The brand purple the chosen card washes to when it has no own colour.
const BRAND_PURPLE = "#A879F7"

// ── Timeline (ms) ──────────────────────────────────────────────────────────
// Full razzle is ~7.5s end to end — a lively shuffle, then the chosen card
// LINGERS center-stage with its name for a beat (the "this is where you're
// going" moment) before the colour wash. Phase boundaries:
//   0 ──── shuffle ──── 3000 ── recede + pop ── (linger w/ name) ── 5600 ── wash ── 7100 ── 7500 done
const T_SHUFFLE_END = 3000 // roster scatters + re-sorts several passes
const T_POP = 3000 // chosen centers/pops → onReveal + haptic + name appear here
const T_WASH_START = 5600 // after a ~2.6s linger, chosen zooms + colour covers
const T_WASH_FULL = 7100 // colour fully covers the screen
const T_DONE = 7500 // overlay fades out → onComplete

// Reduced-motion: a calm cross-fade that still lingers on the named chosen card.
const RM_REVEAL = 260 // haptic + onReveal fire just after the chosen fades in
const RM_DONE = 2200 // hold the named card, then a gentle fade → onComplete

// Hard safety backstop — no matter what, we unmount by here.
const SAFETY = T_DONE + 1200

// Shuffle passes: how many times the deck re-sorts during the lively phase.
const SHUFFLE_PASSES = 4

/** Lucide icon registry by name — the few experience glyphs Home ships, by their
 *  component name so a catalog `icon` string resolves to a real component. */
const ICON_BY_NAME: Record<string, LucideIcon> = {
  Brain,
  Mic,
  BookOpen,
  Radio,
  Gamepad2,
  PenTool,
  Sparkles,
  Citrus,
  Package,
}

function resolveIcon(name?: string): LucideIcon {
  return (name && ICON_BY_NAME[name]) || Package
}

type ThemeStyle = CSSProperties & Record<`--${string}`, string>

/** A single collage tile — catalog art (rounded, object-cover) or a colour
 *  tile with the lucide glyph. Matches Home's `Glyph`. With `label`, the pack's
 *  name sits beneath it so the user sees the breadth of experiences by name. */
function CardFace({
  card,
  size,
  label,
}: {
  card: RazzleCard
  size: number
  /** "none" hides the name; "small" = collage caption; "hero" = big chosen name. */
  label?: "none" | "small" | "hero"
}) {
  const tint = card.color || BRAND_PURPLE
  const Icon = resolveIcon(card.icon)
  const show = label ?? "none"
  return (
    <div className="flex flex-col items-center" style={{ width: size }} aria-hidden="true">
      <div
        className="overflow-hidden rounded-2xl"
        style={{
          height: size,
          width: size,
          backgroundColor: card.imageUrl ? "transparent" : `${tint}26`, // ~15% tint
          boxShadow: `0 8px 30px rgba(0,0,0,0.35), 0 0 0 1px ${tint}40`,
        }}
      >
        {card.imageUrl ? (
          <img
            src={card.imageUrl}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Icon style={{ height: size * 0.42, width: size * 0.42, color: tint }} />
          </div>
        )}
      </div>
      {show !== "none" && card.name ? (
        <div
          className={
            show === "hero"
              ? "mt-3 text-center text-xl font-bold tracking-tight"
              : "mt-1.5 max-w-full truncate text-center text-[11px] font-medium opacity-80"
          }
          style={{ color: "#ECEAF6", width: show === "hero" ? "min(80vw, 320px)" : size + 24 }}
        >
          {card.name}
        </div>
      ) : null}
    </div>
  )
}

/** Deterministic pseudo-random in [0,1) from a seed — keeps the scatter stable
 *  across re-renders (no layout jitter) without pulling in a dep. */
function seeded(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

// The chosen pack may still be downloading when the collage would otherwise
// reveal. Keep the lively shuffle going (looping) until it's ready — but never
// longer than this, so a slow/offline install still resolves (the caller's
// launch falls back to Phrase Flip).
const MAX_READY_WAIT = 9000 // ms from mount before we reveal regardless
const READY_POLL_MS = 220
const WASH_AFTER_POP = T_WASH_START - T_POP // keep the original relative beats
const DONE_AFTER_POP = T_DONE - T_POP

export function PackLaunchTransition({
  roster,
  chosen,
  onReveal,
  onComplete,
  waitUntilReady,
}: {
  roster: RazzleCard[]
  chosen: RazzleCard
  onReveal: () => void
  onComplete: () => void
  /** Optional readiness gate — the chosen experience is installed/launchable.
   *  The collage holds (looping) until this returns true or MAX_READY_WAIT, so
   *  we actually land IN the pack instead of a premature fallback. Default: ready
   *  immediately (preserves the plain fixed-timeline behavior). */
  waitUntilReady?: () => boolean
}): JSX.Element {
  const reduceMotion = useReducedMotion()

  // Fire each callback at most once even under StrictMode double-effects.
  const firedReveal = useRef(false)
  const firedComplete = useRef(false)
  const doReveal = () => {
    if (firedReveal.current) return
    firedReveal.current = true
    triggerHaptic("heavy")
    onReveal()
  }
  const doComplete = () => {
    if (firedComplete.current) return
    firedComplete.current = true
    onComplete()
  }

  // The collage deck: the chosen card always present, plus the rest (deduped),
  // capped so the scatter stays readable on a 320px screen.
  const deck = useMemo(() => {
    const seen = new Set<string>()
    const out: RazzleCard[] = []
    for (const c of [chosen, ...roster]) {
      if (seen.has(c.id)) continue
      seen.add(c.id)
      out.push(c)
    }
    return out.slice(0, 12)
  }, [roster, chosen])

  const chosenIndex = Math.max(
    0,
    deck.findIndex((c) => c.id === chosen.id),
  )

  // Drive the shuffle "pass" so the deck visibly re-sorts a couple of times.
  const [pass, setPass] = useState(0)
  // Phase: shuffle → pop (chosen centers) → wash (colour covers) → done (fade out).
  const [phase, setPhase] = useState<"shuffle" | "pop" | "wash" | "done">(
    reduceMotion ? "pop" : "shuffle",
  )

  // ── Reduced motion: calm cross-fade, no shuffle. Still hits every beat. ──
  useEffect(() => {
    if (!reduceMotion) return
    const tReveal = window.setTimeout(doReveal, RM_REVEAL)
    const tWash = window.setTimeout(() => setPhase("wash"), RM_REVEAL + 80)
    const tDone = window.setTimeout(() => {
      setPhase("done")
      doComplete()
    }, RM_DONE)
    return () => {
      window.clearTimeout(tReveal)
      window.clearTimeout(tWash)
      window.clearTimeout(tDone)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion])

  // ── Full razzle timeline. ──
  useEffect(() => {
    if (reduceMotion) return
    const timers: number[] = []
    const mountedAt = Date.now()
    let revealed = false

    // Re-sort the deck a few times during the lively phase.
    const passGap = T_SHUFFLE_END / (SHUFFLE_PASSES + 1)
    for (let p = 1; p <= SHUFFLE_PASSES; p++) {
      timers.push(window.setTimeout(() => setPass(p), passGap * p))
    }

    // Run the pop → wash → done finale (once the pack is ready).
    const runFinale = () => {
      if (revealed) return
      revealed = true
      setPhase("pop")
      doReveal()
      timers.push(window.setTimeout(() => setPhase("wash"), WASH_AFTER_POP))
      timers.push(
        window.setTimeout(() => {
          setPhase("done")
          doComplete()
        }, DONE_AFTER_POP),
      )
    }

    // At the pop beat, gate on readiness: if the chosen experience is installed
    // (or no gate given), reveal now; otherwise keep the collage alive and poll
    // until ready or MAX_READY_WAIT. A `shuffle`-phase pass cycles so it stays
    // lively while a slow pack downloads behind the curtain.
    const tryReveal = () => {
      if (revealed) return
      const ready = waitUntilReady ? waitUntilReady() : true
      const waited = Date.now() - mountedAt
      if (ready || waited >= MAX_READY_WAIT) {
        runFinale()
      } else {
        // keep shuffling while we wait
        setPass((p) => (p % SHUFFLE_PASSES) + 1)
        timers.push(window.setTimeout(tryReveal, READY_POLL_MS))
      }
    }
    timers.push(window.setTimeout(tryReveal, T_POP))

    // Hard safety: guarantee onComplete even if something stalls.
    timers.push(window.setTimeout(doComplete, MAX_READY_WAIT + SAFETY))

    return () => timers.forEach(window.clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion])

  const washColor = chosen.color || BRAND_PURPLE
  const showCollage = phase === "shuffle" || phase === "pop"

  // Immersive near-black backdrop with a brand aura — same vocabulary as the
  // paywall/lock surfaces so the brand reads as one.
  const backdropStyle: ThemeStyle = {
    backgroundColor: "#07070A",
    backgroundImage:
      `radial-gradient(120% 70% at 50% -10%, ${washColor}24, transparent 60%),` +
      `radial-gradient(100% 60% at 50% 115%, rgba(98,66,168,0.16), transparent 60%),` +
      "linear-gradient(to bottom, #0C0A14, #07070A 55%, #050507)",
    color: "#ECEAF6",
  }

  return (
    <motion.div
      role="presentation"
      aria-hidden="true"
      className="fixed inset-0 z-[1200] overflow-hidden"
      style={backdropStyle}
      // Opaque from the FIRST frame — App mounts this in a useLayoutEffect (before
      // paint), so a transparent fade-in would let Home show through for ~180ms
      // ("flash of Home before the animation"). The dark backdrop covers Home
      // instantly; the collage cards do their own fade-in over it. Only the
      // end-of-show wash fades the whole overlay out.
      initial={{ opacity: 1 }}
      animate={{ opacity: phase === "done" ? 0 : 1 }}
      transition={{ duration: phase === "done" ? 0.3 : 0, ease: "easeOut" }}
    >
      {/* Centered stage — the collage and the chosen card share this anchor so
          the chosen flies smoothly from its scatter slot to dead center. */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          paddingTop: "max(env(safe-area-inset-top), 0px)",
          paddingBottom: "max(env(safe-area-inset-bottom), 0px)",
          paddingInlineStart: "max(env(safe-area-inset-left), 0px)",
          paddingInlineEnd: "max(env(safe-area-inset-right), 0px)",
        }}
      >
        <div
          className="relative"
          style={{ width: "min(86vw, 420px)", height: "min(86vw, 420px)" }}
        >
          {/* ── The scatter collage (non-chosen + chosen pre-pop). ── */}
          {showCollage &&
            deck.map((card, i) => {
              const isChosen = i === chosenIndex
              // Per-pass scattered slot (deterministic). Spread around the stage
              // center, biased outward; the chosen rides the same field then
              // snaps to center on "pop".
              const a = seeded(i * 7.13 + pass * 3.7) * Math.PI * 2
              const r = 26 + seeded(i * 4.1 + pass * 1.9) * 40 // % of half-stage
              const x = isChosen && phase === "pop" ? 0 : Math.cos(a) * r
              const y = isChosen && phase === "pop" ? 0 : Math.sin(a) * r
              const rot =
                isChosen && phase === "pop"
                  ? 0
                  : (seeded(i * 9.2 + pass * 2.3) - 0.5) * 26
              const tileSize = isChosen ? 150 : 88

              // The chosen card RISES THROUGH the deck: it starts behind every
              // shuffling card (low z) and climbs to the front over the passes,
              // growing from ~tile-size toward hero-size as it nears — so it
              // emerges from the pack, then pops to center. Non-chosen sit at a
              // fixed mid layer. `p` is the clamped pass progression (0..1).
              const p = Math.min(pass, SHUFFLE_PASSES) / SHUFFLE_PASSES
              const chosenShuffleScale = 0.62 + p * 0.46 // 0.62 → 1.08 across passes
              const chosenShuffleZ = Math.round(2 + p * SHUFFLE_PASSES * 5) // 2 → ~22, passing others (z10)

              // Non-chosen recede + blur + fade as the chosen pops.
              const recede = phase === "pop" && !isChosen
              return (
                <motion.div
                  key={card.id}
                  className="absolute"
                  style={{
                    top: "50%",
                    left: "50%",
                    // size is set on CardFace; center the tile on its slot.
                    marginTop: -(tileSize / 2),
                    marginLeft: -(tileSize / 2),
                    zIndex: isChosen ? (phase === "pop" ? 40 : chosenShuffleZ) : 10,
                    filter: recede ? "blur(6px)" : "none",
                  }}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{
                    opacity: recede ? 0 : 1,
                    x: `${x}%`,
                    y: `${y}%`,
                    rotate: rot,
                    scale:
                      isChosen && phase === "pop"
                        ? [1, 1.16, 1.08] // "wiggle" overshoot, then settle at the apex
                        : isChosen
                          ? chosenShuffleScale // grows as it climbs to the front
                          : recede
                            ? 0.7
                            : 1,
                  }}
                  // NOTE: a multi-keyframe (`[1, 1.16, 1.08]`) scale CANNOT use a
                  // spring — framer-motion throws "Only two keyframes supported
                  // with spring", an UNCAUGHT error that took down the whole tree
                  // (blank, unclickable screen) right at the reveal. Use a tween
                  // with a back-ease for the pop wiggle; springs only where the
                  // animated values are single targets.
                  transition={
                    isChosen && phase === "pop"
                      ? { type: "tween", duration: 0.6, times: [0, 0.55, 1], ease: [0.34, 1.56, 0.64, 1] }
                      : recede
                        ? { duration: 0.5, ease: "easeIn" }
                        : {
                            type: "spring",
                            stiffness: 90,
                            damping: 14,
                            mass: 0.9,
                          }
                  }
                >
                  <CardFace
                    card={card}
                    size={tileSize}
                    label={isChosen ? (phase === "pop" ? "hero" : "none") : "small"}
                  />
                </motion.div>
              )
            })}

        </div>
      </div>

      {/* ── Wash phase. Two layers, composited so the CARD reads as the hero
            flying at you, NOT a flat colour blob:
            1) a solid-colour "blast" disc BEHIND the card (zIndex 5) that scales
               up from a point — a transform scale is GPU-composited and buttery,
               unlike an animated `clip-path` circle (which stair-steps / looks
               pixelated on Android WebView).
            2) the chosen card ON TOP (zIndex 30), crisp, zooming toward the
               viewer over the blast — never covered by it.
            Both live at the overlay root (outside the bounded stage) so the
            blast reaches every corner; the whole overlay then fades on `done`,
            dissolving card + colour together to reveal the booted pack. ── */}
      {(phase === "wash" || phase === "done") && (
        <motion.div
          className="pointer-events-none absolute left-1/2 top-1/2 rounded-full"
          style={{
            width: "260vmax",
            height: "260vmax",
            marginLeft: "-130vmax",
            marginTop: "-130vmax",
            background: washColor,
            zIndex: 5,
            willChange: "transform",
          }}
          initial={{ scale: 0.04, opacity: 0.96 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            duration: (T_WASH_FULL - T_WASH_START) / 1000,
            ease: [0.22, 1, 0.36, 1],
          }}
        />
      )}
      {phase === "wash" && (
        <motion.div
          className="absolute left-1/2 top-1/2"
          style={{ marginLeft: -75, marginTop: -110, zIndex: 30, willChange: "transform" }}
          initial={{ scale: 1.08 }}
          animate={{ scale: 1.55 }}
          transition={{ duration: (T_DONE - T_WASH_START) / 1000, ease: [0.22, 1, 0.36, 1] }}
        >
          <CardFace card={chosen} size={150} label="hero" />
        </motion.div>
      )}
    </motion.div>
  )
}
