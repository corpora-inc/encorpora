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
// The CSP is `style-src 'self'`, so there is no `style` prop anywhere below —
// an inline style works in `vite dev` and is silently dropped in the shipped
// build, which is the worst failure mode available.

import { useEffect, useMemo, useRef, useState } from "react"

import { fill, strings } from "../app/strings.ts"
import { IndexMark } from "../design/IndexMark.tsx"
import { billing, FALLBACK_PRODUCTS, type PassProduct } from "./billing.ts"
import { makeChallenge, passes, type Challenge } from "./parentalGate.ts"
import { buyPass, restorePasses } from "./store.ts"

type Stage = "rest" | "gate" | "offer"

export type PassSheetProps = {
  /** The game that just ended, by its own name. Never an id. */
  readonly packName: string
  /** Close the sheet and go back to the other games. Always one tap away. */
  readonly onLeave: () => void
}

/** The panel every stage is drawn in. One shape, so the sheet does not jump. */
function Panel({
  labelId,
  children,
}: {
  readonly labelId: string
  readonly children: React.ReactNode
}) {
  return (
    <div className="bg-ground-deep/85 fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-[var(--dw-frame-pad)] backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        className="bg-ground border-line-strong rounded-cut-lg max-h-[var(--dialog-max-h)] w-full max-w-md overflow-y-auto border p-[var(--dw-surface-pad)]"
      >
        {children}
      </div>
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
  const leave = useRef<HTMLButtonElement | null>(null)
  useEffect(() => leave.current?.focus(), [])

  return (
    <Panel labelId="pass-rest-title">
      <h2
        id="pass-rest-title"
        className="inscription text-ink text-2xl tracking-wide text-balance"
      >
        {fill(strings.pass.restTitle, { pack: packName })}
      </h2>
      <p className="text-ink-muted mt-2 text-base">{strings.pass.restBody}</p>

      <button
        ref={leave}
        type="button"
        onClick={onLeave}
        className="border-line-cut bg-ground-raised text-ink rounded-cut-md hover:bg-ground-sunk mt-[var(--dw-stack-gap)] flex min-h-16 w-full items-center justify-center gap-3 border text-lg transition-colors duration-[var(--dw-motion-quick)]"
      >
        <IndexMark className="text-index" />
        <span className="inscription tracking-wide">{strings.pass.restLeave}</span>
      </button>

      {/* Small, plain, and at the bottom. A child is not being sent for a
          grown-up; an adult who wants the prices knows where they are. */}
      <button
        type="button"
        onClick={onGrownUps}
        className="text-ink-muted mt-[var(--dw-stack-gap-tight)] min-h-11 w-full text-sm underline underline-offset-4"
      >
        {strings.pass.forGrownUps}
      </button>
    </Panel>
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
  const field = useRef<HTMLInputElement | null>(null)
  useEffect(() => field.current?.focus(), [])

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (passes(challenge, typed)) {
      onPassed()
      return
    }
    // A new challenge on every miss: repeating the same one turns the gate into
    // something a child defeats by guessing twice.
    setWrong(true)
    setTyped("")
    setChallenge(makeChallenge())
  }

  return (
    <Panel labelId="pass-gate-title">
      <h2 id="pass-gate-title" className="inscription text-ink text-xl tracking-wide">
        {strings.pass.gateTitle}
      </h2>

      <form onSubmit={submit} className="mt-[var(--dw-stack-gap-tight)]">
        <label htmlFor="pass-gate-entry" className="text-ink block text-base">
          {challenge.kind === "year" ? strings.pass.gateYear : strings.pass.gateWord}
        </label>
        {challenge.kind === "word" ? (
          <p className="inscription text-ink mt-2 text-3xl tracking-[0.12em] break-all">
            {challenge.word}
          </p>
        ) : null}

        <input
          id="pass-gate-entry"
          ref={field}
          type="text"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-label={strings.pass.gateEntry}
          aria-invalid={wrong}
          className="numeral border-line-cut bg-ground-raised text-ink rounded-cut-sm mt-[var(--dw-stack-gap-tight)] min-h-16 w-full border px-4 text-2xl tracking-widest"
        />

        {wrong ? (
          <p role="alert" className="text-strike mt-2 text-sm">
            {strings.pass.gateWrong}
          </p>
        ) : null}

        <button
          type="submit"
          className="border-line-cut bg-ground-raised text-ink rounded-cut-md hover:bg-ground-sunk mt-[var(--dw-stack-gap-tight)] min-h-16 w-full border text-lg transition-colors duration-[var(--dw-motion-quick)]"
        >
          <span className="inscription tracking-wide">{strings.pass.gateGo}</span>
        </button>
      </form>

      <button
        type="button"
        onClick={onCancel}
        className="text-ink-muted mt-[var(--dw-stack-gap-tight)] min-h-11 w-full text-sm underline underline-offset-4"
      >
        {strings.pass.notNow}
      </button>
    </Panel>
  )
}

/** One pass, as a plate. The lifetime plate is the loud one; nothing else is. */
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
  return (
    <button
      type="button"
      onClick={onBuy}
      className={[
        "rounded-cut-md flex min-h-20 w-full items-center gap-4 border p-4 text-left",
        "transition-colors duration-[var(--dw-motion-quick)] hover:bg-ground-sunk",
        // The headline is carried by the frame and the type size, not by a
        // badge, a banner, a "best value" flag or a struck-through price.
        headline
          ? "border-index bg-ground-raised border-2"
          : "border-line-cut bg-ground",
      ].join(" ")}
    >
      <span className="min-w-0 flex-1">
        <span
          className={[
            "inscription text-ink block tracking-wide",
            headline ? "text-2xl" : "text-lg",
          ].join(" ")}
        >
          {name}
        </span>
        <span className="text-ink-muted block text-sm">{note}</span>
      </span>
      <span
        className={[
          "numeral text-ink shrink-0",
          headline ? "text-2xl" : "text-lg",
        ].join(" ")}
      >
        {price}
      </span>
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
    <Panel labelId="pass-offer-title">
      <h2 id="pass-offer-title" className="inscription text-ink text-2xl tracking-wide">
        {strings.pass.offerTitle}
      </h2>
      <p className="text-ink-muted mt-2 text-base">{strings.pass.offerBody}</p>

      {/* Lifetime first and largest. It is the one-time purchase, it is the
          cheapest way to own this outright, and a parent who hates
          subscriptions should not have to scroll past two of them to find it. */}
      <div className="mt-[var(--dw-stack-gap)] flex flex-col gap-[var(--dw-stack-gap-tight)]">
        <Plate
          headline
          name={strings.pass.lifetime}
          note={strings.pass.lifetimeNote}
          price={by.get("lifetime")?.price ?? ""}
          onBuy={() => buy(by.get("lifetime")?.productId)}
        />
        <Plate
          headline={false}
          name={strings.pass.month}
          note={strings.pass.monthNote}
          price={by.get("month")?.price ?? ""}
          onBuy={() => buy(by.get("month")?.productId)}
        />
        <Plate
          headline={false}
          name={strings.pass.day}
          note={strings.pass.dayNote}
          price={by.get("day")?.price ?? ""}
          onBuy={() => buy(by.get("day")?.productId)}
        />
      </div>

      {failed ? (
        <p role="alert" className="text-strike mt-[var(--dw-stack-gap-tight)] text-sm">
          {strings.pass.storeUnavailable}
        </p>
      ) : null}
      {held ? (
        <p className="text-seat mt-[var(--dw-stack-gap-tight)] text-sm">{strings.pass.held}</p>
      ) : null}

      <div className="mt-[var(--dw-stack-gap)] flex flex-wrap items-center justify-between gap-3">
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
          className="text-ink-muted min-h-11 text-sm underline underline-offset-4"
        >
          {strings.pass.restore}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="border-line-cut text-ink rounded-cut-sm min-h-11 border px-4 text-sm"
        >
          {strings.pass.notNow}
        </button>
      </div>
    </Panel>
  )
}

/**
 * The sheet.
 *
 * Escape closes it from any stage, the same as "Not now" and the same as
 * "Choose another game": there is no stage of this thing a person can be stuck
 * in, and no stage where the way out is hidden behind a delay.
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

  if (stage === "gate") {
    return <Gate onPassed={() => setStage("offer")} onCancel={onLeave} />
  }
  if (stage === "offer") return <Offer onClose={onLeave} />
  return <Rest packName={packName} onLeave={onLeave} onGrownUps={() => setStage("gate")} />
}
