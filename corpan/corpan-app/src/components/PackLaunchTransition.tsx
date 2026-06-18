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

// ── Colour helpers (no dep) — mix a hex toward white/black so the finale's
// bloom has a luminous core and a deep, saturated rim instead of a flat fill,
// and the sparks carry light-accent + white-hot + warm-gold tints. ──
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "")
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function mix(hex: string, toward: string, t: number): string {
  const a = hexToRgb(hex)
  const b = hexToRgb(toward)
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t))
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
}
const lighten = (hex: string, t: number): string => mix(hex, "#FFFFFF", t)
const darken = (hex: string, t: number): string => mix(hex, "#000000", t)

// ── Timeline (ms) ──────────────────────────────────────────────────────────
// Full razzle is ~8.4s end to end — a lively shuffle, then the chosen card
// LINGERS center-stage with its name for a beat (the "this is where you're
// going" moment), then an unrushed little FIREWORKS show bursts from it as a
// warm colour bloom swells up and washes over the screen. Phase boundaries:
//   0 ── shuffle ── 3000 ── recede + pop ── (linger w/ name) ── 5200 ── fireworks + bloom ── 7900 ── 8400 done
const T_SHUFFLE_END = 3000 // roster scatters + re-sorts several passes
const T_POP = 3000 // chosen centers/pops → onReveal + haptic + name appear here
const T_WASH_START = 5200 // after a ~2.2s linger, fireworks ignite + colour blooms
const T_WASH_FULL = 7900 // colour bloom fully covers the screen
const T_DONE = 8400 // overlay fades out → onComplete

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

  // 1 vmax in px — sparks travel in viewport units so the burst reaches the
  // edges on any screen. Captured once (the show is ~3s; no resize mid-flight).
  const vmax = useMemo(
    () => (typeof window !== "undefined" ? Math.max(window.innerWidth, window.innerHeight) / 100 : 8),
    [],
  )

  // The fireworks: three staggered shells of sparks bursting outward from the
  // card. Deterministic (seeded) so they don't re-roll on re-render. Each shell
  // fires a beat later and reaches farther — a patient, building "show" rather
  // than one flat pop. Palette = pack accent → light accent → white-hot → warm
  // gold for that classic firework sparkle.
  const sparks = useMemo(() => {
    const palette = [washColor, lighten(washColor, 0.5), "#FFFFFF", "#FFE7A6"]
    const shells = [
      { count: 14, delay: 0.0, reach: 34 },
      { count: 18, delay: 0.55, reach: 54 },
      { count: 22, delay: 1.15, reach: 74 },
    ]
    const out: { x: number; y: number; size: number; color: string; delay: number; dur: number }[] = []
    let k = 0
    for (const sh of shells) {
      for (let i = 0; i < sh.count; i++, k++) {
        const ang = (i / sh.count) * Math.PI * 2 + seeded(k * 5.3) * 0.5
        const dist = sh.reach * (0.7 + seeded(k * 2.1) * 0.5) * vmax
        out.push({
          x: Math.cos(ang) * dist,
          y: Math.sin(ang) * dist,
          size: 4 + seeded(k * 1.7) * 7,
          color: palette[k % palette.length],
          delay: sh.delay + seeded(k * 3.9) * 0.16,
          dur: 1.0 + seeded(k * 0.7) * 0.6,
        })
      }
    }
    return out
  }, [washColor, vmax])

  // Shockwave rings ripple out at the same staggered beats as the shells.
  const rings = [0, 0.55, 1.15]

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
              // `p` = clamped pass progression (0..1). The chosen RISES STRAIGHT
              // UP THE CENTER of the deck — pinned dead center and upright the
              // whole time, climbing from behind (low z) and GROWING toward the
              // viewer as the passes go by. It calmly comes straight forward
              // through the shuffling cards rather than bending in from a side
              // slot. Non-chosen stay scattered.
              const p = Math.min(pass, SHUFFLE_PASSES) / SHUFFLE_PASSES

              // Per-pass scattered slot for the NON-chosen (deterministic).
              // Pushed outward so they ring the stage and leave the center lane
              // clear for the chosen to rise straight up through them.
              const a = seeded(i * 7.13 + pass * 3.7) * Math.PI * 2
              const r = 42 + seeded(i * 4.1 + pass * 1.9) * 46 // % of half-stage
              const x = isChosen ? 0 : Math.cos(a) * r
              const y = isChosen ? 0 : Math.sin(a) * r
              const rot = isChosen ? 0 : (seeded(i * 9.2 + pass * 2.3) - 0.5) * 26
              const tileSize = isChosen ? 150 : 88

              const chosenShuffleScale = 0.72 + p * 0.36 // 0.72 → 1.08 (present from the start, still grows forward)
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
                    // Non-chosen ride at reduced opacity so they read as an
                    // ambient backing deck and the rising chosen shows through
                    // them even before it climbs to the front.
                    opacity: recede ? 0 : isChosen ? 1 : 0.5,
                    x: `${x}%`,
                    y: `${y}%`,
                    rotate: rot,
                    scale:
                      isChosen && phase === "pop"
                        ? 1.08 // settle at hero size — exactly the wash card's start (seamless handoff)
                        : isChosen
                          ? chosenShuffleScale // grows as it climbs to the front
                          : recede
                            ? 0.7
                            : 1,
                  }}
                  // NOTE: a spring needs SINGLE-TARGET values — a multi-keyframe
                  // array (e.g. `[1, 1.1, 1.07]`) throws "Only two keyframes
                  // supported with spring", an UNCAUGHT error that blanks the
                  // whole tree. And a keyframe array also restarts from
                  // keyframe[0], jump-cutting from the card's live scale (the
                  // old "click"). So the pop uses a single-target scale and rides
                  // a spring that CONTINUES the shuffle spring — framer carries
                  // position + velocity across the phase change, so there's no
                  // type switch, no keyframe snap, and no reversal hitch. That's
                  // what makes the seat into center perfectly smooth.
                  transition={
                    recede
                      ? // non-chosen melt away gently rather than snapping out.
                        { duration: 0.8, ease: [0.4, 0, 0.2, 1] }
                      : isChosen && phase === "pop"
                        ? // a soft, well-damped landing into center (little overshoot).
                          { type: "spring", stiffness: 120, damping: 20, mass: 1 }
                        : {
                            // a calm, well-damped settle for the shuffle (less jitter).
                            type: "spring",
                            stiffness: 70,
                            damping: 16,
                            mass: 1,
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

      {/* ── Finale — a patient little fireworks show, composited so the CARD
            stays the hero and never a flat colour blob. Layered back-to-front:
            1) a radial-gradient BLOOM disc (zIndex 5) — luminous core, deep
               saturated rim — swelling up from behind the card. A transform
               scale is GPU-composited and buttery (unlike an animated clip-path,
               which stair-steps on Android WebView).
            2) shockwave RINGS (zIndex 8) rippling out at each shell's beat.
            3) a soft GLOW halo behind the card (zIndex 29) so the card reads as
               the light source the bloom pours from.
            4) the chosen CARD (zIndex 30), crisp, zooming gently toward you.
            5) SPARK shells (zIndex 35) bursting past the card in staggered waves.
            All live at the overlay root so the burst reaches every corner; the
            whole overlay then fades on `done`, dissolving everything together to
            reveal the booted pack. Reduced motion: just the gentle bloom + glow,
            no sparks/rings/flash. ── */}
      {(phase === "wash" || phase === "done") && (
        <motion.div
          className="pointer-events-none absolute left-1/2 top-1/2 rounded-full"
          style={{
            width: "260vmax",
            height: "260vmax",
            marginLeft: "-130vmax",
            marginTop: "-130vmax",
            background: `radial-gradient(circle at 50% 48%, ${lighten(washColor, 0.55)} 0%, ${washColor} 38%, ${darken(washColor, 0.42)} 100%)`,
            zIndex: 5,
            willChange: "transform",
          }}
          initial={{ scale: 0.03, opacity: 0.96 }}
          animate={{ scale: 1, opacity: 1 }}
          // A long, gentle ease-out so the colour swells up patiently and settles
          // rather than snapping into place.
          transition={{
            duration: (T_WASH_FULL - T_WASH_START) / 1000,
            ease: [0.16, 1, 0.3, 1],
          }}
        />
      )}
      {phase === "wash" && (
        <>
          {!reduceMotion && (
            <>
              {/* ignition flash — a single quick breath of light as the first
                  shell fires; never a harsh strobe. */}
              <motion.div
                className="pointer-events-none absolute inset-0"
                style={{ background: lighten(washColor, 0.72), zIndex: 40, willChange: "opacity" }}
                initial={{ opacity: 0.42 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
              {/* shockwave rings */}
              {rings.map((d, i) => (
                <motion.div
                  key={`ring-${i}`}
                  className="pointer-events-none absolute left-1/2 top-1/2 rounded-full"
                  style={{
                    width: "44vmax",
                    height: "44vmax",
                    marginLeft: "-22vmax",
                    marginTop: "-22vmax",
                    border: `2px solid ${lighten(washColor, 0.45)}`,
                    zIndex: 8,
                    willChange: "transform, opacity",
                  }}
                  initial={{ scale: 0.04, opacity: 0.55 }}
                  animate={{ scale: 1.8, opacity: 0 }}
                  transition={{ duration: 1.5, delay: d, ease: [0.16, 1, 0.3, 1] }}
                />
              ))}
              {/* spark shells */}
              {sparks.map((s, i) => (
                <motion.div
                  key={`spark-${i}`}
                  className="pointer-events-none absolute left-1/2 top-1/2 rounded-full"
                  style={{
                    width: s.size,
                    height: s.size,
                    marginLeft: -s.size / 2,
                    marginTop: -s.size / 2,
                    background: s.color,
                    boxShadow: `0 0 ${s.size * 2.4}px ${s.size * 0.7}px ${s.color}`,
                    zIndex: 35,
                    willChange: "transform, opacity",
                  }}
                  initial={{ x: 0, y: 0, scale: 0.3, opacity: 0 }}
                  animate={{ x: s.x, y: s.y, scale: [0.3, 1, 0.4], opacity: [0, 1, 0] }}
                  transition={{
                    default: { duration: s.dur, delay: s.delay, ease: [0.12, 0.78, 0.24, 1] },
                    scale: { duration: s.dur, delay: s.delay, times: [0, 0.22, 1], ease: "easeOut" },
                    opacity: { duration: s.dur, delay: s.delay, times: [0, 0.16, 1], ease: "easeOut" },
                  }}
                />
              ))}
            </>
          )}

          {/* glow halo behind the card — the card as the light source. */}
          <motion.div
            className="pointer-events-none absolute left-1/2 top-1/2 rounded-full"
            style={{
              width: 360,
              height: 360,
              marginLeft: -180,
              marginTop: -180,
              background: `radial-gradient(circle, ${lighten(washColor, 0.65)} 0%, transparent 68%)`,
              zIndex: 29,
              willChange: "transform, opacity",
            }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: [0, 0.9, 0.7], scale: 1.5 }}
            transition={{
              duration: (T_DONE - T_WASH_START) / 1000,
              times: [0, 0.28, 1],
              ease: "easeOut",
            }}
          />

          {/* the chosen card, drifting gently toward the viewer. Mounts at the
              EXACT transform the popped card settled into (center, scale 1.08)
              so the collage→wash handoff is invisible — then it zooms. */}
          <motion.div
            className="absolute left-1/2 top-1/2"
            style={{ marginLeft: -75, marginTop: -75, zIndex: 30, willChange: "transform" }}
            initial={{ scale: 1.08 }}
            animate={{ scale: 1.5 }}
            transition={{ duration: (T_DONE - T_WASH_START) / 1000, ease: [0.16, 1, 0.3, 1] }}
          >
            <CardFace card={chosen} size={150} label="hero" />
          </motion.div>
        </>
      )}
    </motion.div>
  )
}
