// The one purchase surface in the app, and the sheet a child sees when a game
// reaches its stopping point. Three stages, and which stage you are on decides
// who is being spoken to.
//
//   rest   a child. A game ended. There is no price on this screen, no offer,
//          no money, and no reason to go and find an adult. The biggest control
//          takes them back to the other games, which are all still open.
//   gate   an adult, proving it. Reading load, never arithmetic — this is a
//          maths app and a multiplication problem is a gate the audience is
//          being trained to defeat (see `parentalGate.ts`).
//   offer  an adult. Three prices, no subscription, no scarcity, no countdown,
//          no default selected, and "Not now" is one tap from anywhere.
//
// ── What is banned here, permanently ─────────────────────────────────────────
// No timer or countdown of any kind. No "N plays left". No "your friends are
// playing". No "today only". No interstitial that must be watched. No
// pre-selected plan. No copy that frames stopping as a loss. `pass.test.ts`
// holds the copy against a word list so the ban is mechanical rather than
// remembered.
//
// ── How it is drawn ──────────────────────────────────────────────────────────
// A modal is where "a web page in a wrapper" is most obvious, so every part of
// this is the platform's construction rather than the browser's:
//
//   * ONE panel for all three stages, mounted once. The stages swap inside it,
//     so the sheet arrives once and then changes its mind, rather than being
//     torn down and rebuilt — which would replay the entrance and move focus
//     three times.
//   * The scrim and the panel are `.dw-scrim` and `.dw-overlay`, the elevation
//     rungs from `index.css`. The panel used to be `bg-ground` on
//     a deep-ground wash at 85%, which in dark measured 1.13:1 against its own
//     backdrop: a sheet you could not see was a sheet.
//   * Focus is trapped while it is open and returned to whatever had it when it
//     closes. The container takes focus, never a button — Chrome matches
//     `:focus-visible` for programmatic focus and a ring on the child-facing
//     stage is one of the named tells.
//   * There is deliberately NO tap-outside-to-dismiss. Every stage has a
//     labelled way out; a scrim that closes on a stray palm is how a child
//     dismisses the one screen an adult was reading.
//   * Nothing on any stage appears or disappears in a way that moves what is
//     under it. The gate's "try again" line and the offer's status line are
//     always in the layout, empty until they have something to say.
//
// The CSP is `style-src 'self'`, so there is no `style` prop anywhere below —
// an inline style works in `vite dev` and is silently dropped in the shipped
// build, which is the worst failure mode available.

import { useEffect, useMemo, useRef, useState } from "react"

import { fill, strings } from "../app/strings.ts"
import { Mark } from "../design/Mark.tsx"
import { billing, FALLBACK_PRODUCTS, type PassProduct } from "./billing.ts"
import { makeChallenge, passes, reissue, type Challenge } from "./parentalGate.ts"
import { buyPass, restorePasses } from "./store.ts"

type Stage = "rest" | "gate" | "offer"

export type PassSheetProps = {
  /** The game that just ended, by its own name. Never an id. */
  readonly packName: string
  /** Close the sheet and go back to the other games. Always one tap away. */
  readonly onLeave: () => void
}

/** Which heading names the dialog, per stage. `aria-labelledby` must follow it. */
const TITLE_ID: Record<Stage, string> = {
  rest: "pass-rest-title",
  gate: "pass-gate-title",
  offer: "pass-offer-title",
}

/**
 * Everything inside the panel that can take focus, in document order.
 *
 * Queried on each Tab rather than cached, because the stages swap underneath
 * the panel and a cached list is a list of nodes that have been unmounted.
 */
const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

/**
 * The panel every stage is drawn in. One shape and one mounting, so the sheet
 * arrives once, the entrance is not replayed on every stage, and focus is taken
 * and given back exactly once.
 *
 * The mark at the top is the screen's single warm point — `--dw-index`, the
 * brand's apex gold, "once per screen, at the top of something". It is the
 * reason this is a sheet belonging to this product rather than a dialog.
 */
function Panel({
  labelId,
  children,
}: {
  readonly labelId: string
  readonly children: React.ReactNode
}) {
  const dialog = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const node = dialog.current
    if (node === null) return

    // Whatever had focus before the sheet opened gets it back when it closes.
    // Without this, closing the sheet drops focus on `<body>` and a keyboard or
    // switch user restarts from the top of the document.
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null

    // The page behind a sheet does not move. The scrim is `position: fixed`,
    // so body was still the scrolling box underneath it and a drag on the
    // scrim scrolled the catalogue — the sheet then closed onto a different
    // offset and the surface you came back to was not the one you left. The
    // class is on `<html>`, because `overflow-x: hidden` there promotes body
    // to the scroller and both boxes have to be told.
    document.documentElement.classList.add("dw-locked")

    // The CONTAINER, not a control. `:focus-visible` matches programmatic focus
    // in Chrome when there has been no prior interaction, so focusing the "Choose
    // another game" button drew a ring on the child-facing screen every time.
    node.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return
      const stops = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)]
      const first = stops[0]
      const last = stops.at(-1)
      if (first === undefined || last === undefined) {
        // Nothing to move to. Swallowing the key is what keeps focus inside a
        // modal that is momentarily empty rather than letting it escape to the
        // page underneath, which is still there and still interactive.
        event.preventDefault()
        return
      }
      const held = document.activeElement
      if (event.shiftKey && (held === first || held === node)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && held === last) {
        event.preventDefault()
        first.focus()
      }
    }

    node.addEventListener("keydown", onKey)
    return () => {
      node.removeEventListener("keydown", onKey)
      document.documentElement.classList.remove("dw-locked")
      before?.focus()
    }
  }, [])

  return (
    <div className="dw-scrim dw-anim-fade fixed inset-0 z-[var(--z-modal)] flex items-center justify-center pt-[max(var(--dw-frame-pad),var(--safe-top))] pr-[max(var(--dw-frame-pad),var(--safe-right))] pb-[max(var(--dw-frame-pad),var(--safe-bottom))] pl-[max(var(--dw-frame-pad),var(--safe-left))] backdrop-blur-sm">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        tabIndex={-1}
        className="dw-overlay dw-anim-enter rounded-cut-lg p-surface max-h-[var(--dialog-max-h)] w-full max-w-md overflow-y-auto overscroll-contain outline-none"
      >
        <Mark className="text-index mx-auto block h-9 w-9" />
        {children}
      </div>
    </div>
  )
}

/**
 * The head of a stage: the mark's own axis, so the three stages share one
 * vertical rhythm and the sheet does not appear to re-typeset itself when it
 * changes stage.
 */
function Head({
  id,
  title,
  body,
}: {
  readonly id: string
  readonly title: string
  readonly body?: string
}) {
  return (
    <div className="mt-stack-tight text-center">
      <h2 id={id} className="inscription text-ink text-2xl text-balance">
        {title}
      </h2>
      {body === undefined ? null : (
        <p className="text-ink-muted mt-label text-md text-pretty">{body}</p>
      )}
    </div>
  )
}

/**
 * Stage one. A child reads this and nothing else.
 *
 * "That's FUSE for today" is a statement about a game that ended, not about
 * what has been withheld. The second line is the important one and it is true:
 * every other game is open, and the child is being pointed at them rather than
 * at a shop.
 *
 * The way out is the only filled control on the sheet, at 64 px — a child-sized
 * row, not a link — because it is the thing they should press and the audit
 * found this the least inviting screen in the app. "Grown-ups" is quiet, ink
 * grey, and carries no underline: an underlined phrase is a web idiom, and on
 * this stage it was also the most conspicuous thing on the screen.
 */
function Rest({
  packName,
  onLeave,
  onGrownUps,
}: {
  readonly packName: string
  readonly onLeave: () => void
  readonly onGrownUps: () => void
}) {
  return (
    <>
      <Head
        id={TITLE_ID.rest}
        title={fill(strings.pass.restTitle, { pack: packName })}
        body={strings.pass.restBody}
      />

      <button
        type="button"
        onClick={onLeave}
        className="dw-press bg-accent-fill text-on-accent rounded-cut-md mt-stack min-h-row-min flex w-full items-center justify-center px-4 text-lg"
      >
        <span className="inscription">{strings.pass.restLeave}</span>
      </button>

      {/* Small, plain, and at the bottom. A child is not being sent for a
          grown-up; an adult who wants the prices knows where they are. */}
      <button
        type="button"
        onClick={onGrownUps}
        className="dw-press text-ink-muted rounded-cut-sm mt-stack-tight min-h-target w-full text-sm"
      >
        {strings.pass.forGrownUps}
      </button>
    </>
  )
}

/** Stage two. Nothing about a price is rendered until this returns true. */
function Gate({
  onPassed,
  onCancel,
}: {
  readonly onPassed: () => void
  readonly onCancel: () => void
}) {
  // One challenge per mounting, made once. Regenerating it on every keystroke
  // would move the question while an adult is answering it.
  const [challenge, setChallenge] = useState<Challenge>(() => makeChallenge())
  const [typed, setTyped] = useState("")
  const [wrong, setWrong] = useState(false)
  // The field is NOT auto-focused. Focusing it on mount drew a 2 px focus ring around the
  // input with no user interaction at all — pixel-scanned at x = 600 on the
  // dark gate: a ring at y432–433, an offset gap, then the field's own border
  // at y436, two concentric rectangles, the exact pattern this design removed
  // from the search field. It also raises the keyboard over the sheet on a
  // phone before an adult has decided to answer. `Panel` above focuses the
  // dialog container, which is where a modal's focus belongs; the field is one
  // Tab away and is the first stop inside it.

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (passes(challenge, typed)) {
      onPassed()
      return
    }
    // A new challenge on every miss: repeating the same one turns the gate into
    // something a child defeats by guessing twice. `reissue` keeps the FORM —
    // a word is replaced by a different word — because a miss that swapped a
    // word challenge for a year one would take a line of display type out of
    // the layout and jump the field and the button up the screen.
    setWrong(true)
    setTyped("")
    setChallenge((current) => reissue(current))
  }

  const word = challenge.kind === "word" ? challenge.word : null

  return (
    <>
      <Head id={TITLE_ID.gate} title={strings.pass.gateTitle} />

      <form onSubmit={submit} className="mt-stack">
        <label htmlFor="pass-gate-entry" className="text-ink-muted text-md block text-center">
          {word === null ? strings.pass.gateYear : strings.pass.gateWord}
        </label>
        {word === null ? null : (
          <p
            id="pass-gate-word"
            className="dw-caps inscription text-ink mt-label text-center text-xl break-words"
          >
            {word}
          </p>
        )}

        <input
          id="pass-gate-entry"
          type="text"
          value={typed}
          onChange={(event) => {
            setTyped(event.target.value)
          }}
          autoComplete="off"
          autoCorrect="off"
          // A four-digit year wants the number pad and no capitalisation; a
          // fourteen-letter word wants the letters, in the case it is shown in.
          inputMode={word === null ? "numeric" : "text"}
          autoCapitalize={word === null ? "off" : "characters"}
          spellCheck={false}
          aria-describedby={word === null ? undefined : "pass-gate-word"}
          aria-invalid={wrong}
          className={[
            "dw-sunk text-ink rounded-cut-sm mt-stack-tight min-h-row-min w-full px-4 text-center text-xl",
            wrong ? "border-strike-line" : "",
          ].join(" ")}
        />

        {/* Always in the layout, empty until it has something to say. A line
            that appears on a wrong answer pushes the button it sits above down
            the screen under the finger that is already reaching for it. */}
        <p role="status" aria-live="polite" className="text-strike mt-label min-h-5 text-center text-sm">
          {wrong ? strings.pass.gateWrong : ""}
        </p>

        <button
          type="submit"
          className="dw-press bg-accent-fill text-on-accent rounded-cut-md mt-label min-h-target-comfort w-full text-lg"
        >
          <span className="inscription">{strings.pass.gateGo}</span>
        </button>
      </form>

      <button
        type="button"
        onClick={onCancel}
        className="dw-press text-ink-muted rounded-cut-sm mt-stack-tight min-h-target w-full text-sm"
      >
        {strings.pass.notNow}
      </button>
    </>
  )
}

/**
 * One pass, as a plate.
 *
 * **One row, one face.** The name used to be old-style serif, the note system
 * sans and the price a rounded grotesque, which read as three products in one
 * row. Everything here is the text face; the price only asks for tabular lining
 * figures so three prices line up in a column.
 *
 * Name and price share a baseline — the note sits under both rather than
 * between them, which is what left the price floating in the middle of the row.
 * The headline is carried by the frame and the type size, never by a badge, a
 * banner, a "best value" flag or a struck-through price.
 */
function Plate({
  name,
  note,
  price,
  headline,
  onBuy,
}: {
  readonly name: string
  readonly note: string
  readonly price: string
  readonly headline: boolean
  readonly onBuy: () => void
}) {
  const size = headline ? "text-xl" : "text-md"
  return (
    <button
      type="button"
      onClick={onBuy}
      className={[
        "dw-press dw-raised rounded-cut-md min-h-row-min block w-full p-inset text-left",
        headline ? "border-accent border-2" : "",
      ].join(" ")}
    >
      {/* `flex-wrap` and two shrinkable children: a currency that renders long
          — "Rp 1.299.000" — wraps onto its own line instead of dragging the
          panel sideways, which is the bug the parent area shipped once. */}
      <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className={`text-ink min-w-0 ${size}`}>{name}</span>
        <span className={`text-ink min-w-0 tabular-nums ${size}`}>{price}</span>
      </span>
      <span className="text-ink-muted mt-1 block text-sm">{note}</span>
    </button>
  )
}

/** Stage three. An adult, three prices, and no pressure of any kind. */
function Offer({ onClose }: { readonly onClose: () => void }) {
  const [products, setProducts] = useState<readonly PassProduct[]>(FALLBACK_PRODUCTS)
  const [failed, setFailed] = useState(false)
  const [held, setHeld] = useState(false)

  useEffect(() => {
    let live = true
    billing()
      .products()
      .then((list) => {
        if (live && list.length > 0) setProducts(list)
      })
      .catch((error: unknown) => {
        console.error("[pass] the product list could not be read", error)
      })
    return () => {
      live = false
    }
  }, [])

  const by = useMemo(
    () => new Map(products.map((product) => [product.kind, product])),
    [products],
  )

  const buy = (productId: string | undefined) => {
    if (productId === undefined) return
    setFailed(false)
    void buyPass(productId).then((outcome) => {
      if (outcome.status === "granted") {
        setHeld(true)
        onClose()
        return
      }
      // A cancellation is a parent changing their mind, which is not a failure
      // and is never reported as one.
      if (outcome.status !== "cancelled") setFailed(true)
    })
  }

  return (
    <>
      <Head id={TITLE_ID.offer} title={strings.pass.offerTitle} body={strings.pass.offerBody} />

      {/* Lifetime first and largest. It is the one-time purchase, it is the
          cheapest way to own this outright, and a parent who hates
          subscriptions should not have to scroll past two of them to find it.

          The three sit in a SUNK track, which is the same construction every
          platform uses for a group of choices: a recess with raised faces in
          it. It is load-bearing in dark, where `.dw-raised` is a step darker
          than `.dw-overlay` — a plate drawn straight onto the sheet reads as a
          slot cut into it rather than as a key standing on it. */}
      <div className="dw-sunk rounded-cut-md mt-stack flex flex-col gap-stack-tight p-inset">
        <Plate
          headline
          name={strings.pass.lifetime}
          note={strings.pass.lifetimeNote}
          price={by.get("lifetime")?.price ?? ""}
          onBuy={() => {
            buy(by.get("lifetime")?.productId)
          }}
        />
        <Plate
          headline={false}
          name={strings.pass.month}
          note={strings.pass.monthNote}
          price={by.get("month")?.price ?? ""}
          onBuy={() => {
            buy(by.get("month")?.productId)
          }}
        />
        <Plate
          headline={false}
          name={strings.pass.day}
          note={strings.pass.dayNote}
          price={by.get("day")?.price ?? ""}
          onBuy={() => {
            buy(by.get("day")?.productId)
          }}
        />
      </div>

      {/* One line, always present, so a store that cannot be reached does not
          shove the way out from under the finger reaching for it. */}
      <p
        role="status"
        aria-live="polite"
        className={[
          "mt-label min-h-5 text-center text-sm",
          failed ? "text-strike" : "text-seat",
        ].join(" ")}
      >
        {failed ? strings.pass.storeUnavailable : held ? strings.pass.held : ""}
      </p>

      {/* Two plain tinted controls, which is what a native sheet puts at its
          foot. Neither is boxed: a filled box down here competes with the three
          plates above it for the eye, and in dark a `.dw-raised` box on an
          `.dw-overlay` sheet is drawn darker than the sheet it sits on. */}
      <div className="mt-label flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            setFailed(false)
            void restorePasses().then((outcome) => {
              if (outcome.status === "granted") {
                setHeld(true)
                onClose()
              } else if (outcome.status !== "cancelled") setFailed(true)
            })
          }}
          className="dw-press text-accent-ink rounded-cut-sm min-h-target px-inset text-sm"
        >
          {strings.pass.restore}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="dw-press text-ink rounded-cut-sm min-h-target px-inset text-sm"
        >
          {strings.pass.notNow}
        </button>
      </div>
    </>
  )
}

/**
 * The sheet.
 *
 * Escape closes it from any stage, the same as "Not now" and the same as
 * "Choose another game": there is no stage of this thing a person can be stuck
 * in, and no stage where the way out is hidden behind a delay.
 *
 * The panel is mounted once and the stages swap inside it. `key={stage}` gives
 * each stage its own fade in, which is the one motion this needs: it explains
 * that the content changed and the surface did not.
 */
export function PassSheet({ packName, onLeave }: PassSheetProps) {
  const [stage, setStage] = useState<Stage>("rest")

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onLeave()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onLeave])

  let content: React.ReactNode
  if (stage === "gate") {
    content = <Gate onPassed={() => setStage("offer")} onCancel={onLeave} />
  } else if (stage === "offer") {
    content = <Offer onClose={onLeave} />
  } else {
    content = (
      <Rest
        packName={packName}
        onLeave={onLeave}
        onGrownUps={() => {
          setStage("gate")
        }}
      />
    )
  }

  return (
    <Panel labelId={TITLE_ID[stage]}>
      <div key={stage} className="dw-anim-fade">
        {content}
      </div>
    </Panel>
  )
}
