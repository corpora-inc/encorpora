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
// Full razzle is ~5s end to end. Phase boundaries:
//   0 ──────── shuffle ──────── 2200 ── recede + pop ── 3200 ── zoom + wash ── 4800 ── done
const T_SHUFFLE_END = 2200 // roster scatters + re-sorts a couple of passes
const T_POP = 2200 // chosen begins center/pop → onReveal + haptic fire here
const T_WASH_START = 3200 // chosen zooms toward viewer; colour begins covering
const T_WASH_FULL = 4500 // colour fully covers the screen
const T_DONE = 4800 // overlay fades out → onComplete

// Reduced-motion: a single calm cross-fade.
const RM_REVEAL = 220 // haptic + onReveal fire just after the chosen fades in
const RM_DONE = 1000 // gentle ~1s fade then onComplete

// Hard safety backstop — no matter what, we unmount by here.
const SAFETY = T_DONE + 1200

// Shuffle passes: how many times the deck re-sorts during the lively phase.
const SHUFFLE_PASSES = 3

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
 *  tile with the lucide glyph. Matches Home's `Glyph`. */
function CardFace({ card, size }: { card: RazzleCard; size: number }) {
  const tint = card.color || BRAND_PURPLE
  const Icon = resolveIcon(card.icon)
  return (
    <div
      className="overflow-hidden rounded-2xl"
      style={{
        height: size,
        width: size,
        backgroundColor: card.imageUrl ? "transparent" : `${tint}26`, // ~15% tint
        boxShadow: `0 8px 30px rgba(0,0,0,0.35), 0 0 0 1px ${tint}40`,
      }}
      aria-hidden="true"
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
  )
}

/** Deterministic pseudo-random in [0,1) from a seed — keeps the scatter stable
 *  across re-renders (no layout jitter) without pulling in a dep. */
function seeded(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

export function PackLaunchTransition({
  roster,
  chosen,
  onReveal,
  onComplete,
}: {
  roster: RazzleCard[]
  chosen: RazzleCard
  onReveal: () => void
  onComplete: () => void
}): JSX.Element {
  const reduceMotion = useReducedMotion()

  // Fire each callback at most once even under StrictMode double-effects.
  const firedReveal = useRef(false)
  const firedComplete = useRef(false)
  const doReveal = () => {
    if (firedReveal.current) return
    firedReveal.current = true
    triggerHaptic("medium")
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

    // Re-sort the deck a few times during the lively phase.
    const passGap = T_SHUFFLE_END / (SHUFFLE_PASSES + 1)
    for (let p = 1; p <= SHUFFLE_PASSES; p++) {
      timers.push(window.setTimeout(() => setPass(p), passGap * p))
    }

    // Chosen pops to center → haptic + onReveal.
    timers.push(
      window.setTimeout(() => {
        setPhase("pop")
        doReveal()
      }, T_POP),
    )
    // Colour wash begins covering the screen.
    timers.push(window.setTimeout(() => setPhase("wash"), T_WASH_START))
    // Overlay fades out → onComplete.
    timers.push(
      window.setTimeout(() => {
        setPhase("done")
        doComplete()
      }, T_DONE),
    )
    // Hard safety: guarantee onComplete even if a frame is dropped.
    timers.push(window.setTimeout(doComplete, SAFETY))

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
      initial={{ opacity: 0 }}
      animate={{ opacity: phase === "done" ? 0 : 1 }}
      transition={{ duration: phase === "done" ? 0.3 : 0.18, ease: "easeOut" }}
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
                    zIndex: isChosen ? 30 : 10,
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
                        ? [1, 1.16, 1.08] // spring "wiggle" overshoot at the apex
                        : isChosen
                          ? 1.04
                          : recede
                            ? 0.7
                            : 1,
                  }}
                  transition={
                    isChosen && phase === "pop"
                      ? { type: "spring", stiffness: 360, damping: 14, mass: 0.7 }
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
                  <CardFace card={card} size={tileSize} />
                </motion.div>
              )
            })}

          {/* ── Wash phase: the chosen card zooms toward the viewer and its
                colour expands from its center to cover everything. ── */}
          {phase === "wash" && (
            <>
              {/* The chosen, blown up + fading as the colour takes over. */}
              <motion.div
                className="absolute"
                style={{
                  top: "50%",
                  left: "50%",
                  marginTop: -75,
                  marginLeft: -75,
                  zIndex: 30,
                }}
                initial={{ scale: 1.08, opacity: 1 }}
                animate={{ scale: 2.6, opacity: 0 }}
                transition={{ duration: 1.0, ease: [0.4, 0, 0.2, 1] }}
              >
                <CardFace card={chosen} size={150} />
              </motion.div>
            </>
          )}
        </div>
      </div>

      {/* Full-bleed colour wash — a circle expanding from center to cover the
          viewport. Lives outside the bounded stage so it can reach the corners
          even on iPad. Mounts only in wash/done so it never blocks the collage. */}
      {(phase === "wash" || phase === "done") && (
        <motion.div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(circle at center, ${washColor}, ${washColor})`,
          }}
          initial={{ clipPath: "circle(8% at 50% 50%)", opacity: 0.95 }}
          animate={{ clipPath: "circle(75% at 50% 50%)", opacity: 1 }}
          transition={{
            duration: (T_WASH_FULL - T_WASH_START) / 1000,
            ease: [0.22, 1, 0.36, 1],
          }}
        />
      )}
    </motion.div>
  )
}
