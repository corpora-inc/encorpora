/**
 * beatlounge — <KitPicker> — a self-contained, reusable drum-kit browser.
 *
 * The integrator embeds this into the (reworked) drum page in a couple of lines:
 *
 *   import { KitPicker } from "../../kits/KitPicker"
 *   <KitPicker host={host} store={store} trackId={drumTrackId} />
 *
 * It browses the drum-kit corpus grouped by family, highlights the ACTIVE kit,
 * selects a kit (→ ONE `setInstrument` that swaps `kitId` while preserving the
 * rest of the drum config), and auditions a couple of voices on an explicit
 * "preview" tap — WITHOUT starting the transport ("setup, don't play":
 * selecting a kit never starts playback). The synth's `update()` makes the swap
 * audible immediately (engine/audioGraph.ts reconciles on the config change).
 *
 * Premium dark — `--bl-*` tokens only, inline-SVG glyphs (no emoji), ≥44px hit
 * targets, responsive grid, and `prefers-reduced-motion` honoured via CSS.
 */

import type { BeatloungeHost } from "../contracts/module"
import type { BeatloungeStore } from "../store/store"
import { useBeatloungeStore } from "../store/store"
import {
  findTrack,
  isInstrumentTrack,
  type Id,
} from "../model/document"
import {
  kitsGroupedByFamily,
  FAMILY_META,
  ROLE_TO_PITCH,
  DEFAULT_KIT_ID,
  type KitDef,
} from "./index"

interface Props {
  host: BeatloungeHost
  store: BeatloungeStore
  /** The drum track to re-kit. If absent, the first drumSampler track is used. */
  trackId?: Id
}

/** Voices to audition on the preview tap (kick + snare = the kit's signature). */
const PREVIEW_ROLES = ["kick", "snare", "closedHat"] as const

export const KitPicker = ({ host, store, trackId }: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)

  // Resolve the target drum track: the passed id, else the first drumSampler.
  const target =
    (trackId && findTrack(doc, trackId)) ||
    doc.tracks.find(
      (t) => isInstrumentTrack(t) && t.instrument.kind === "drumSampler"
    )

  if (!target || !isInstrumentTrack(target) || target.instrument.kind !== "drumSampler") {
    return <div className="bl-kitpicker-empty">No drum track to re-kit.</div>
  }

  const inst = target.instrument
  const activeId = inst.kitId ?? DEFAULT_KIT_ID
  const groups = kitsGroupedByFamily()

  const selectKit = (kit: KitDef) => {
    // ONE setInstrument: swap kitId, preserve pads + fallback (the rest of the
    // drum config). The audioGraph reconciler calls instrument.update() → the
    // synth rebuilds its voices → the new kit is heard immediately.
    store.dispatch({
      t: "setInstrument",
      trackId: target.id,
      config: { ...inst, kitId: kit.id },
    })
    host.toast(`Kit · ${kit.name}`)
  }

  return (
    <div className="bl-kitpicker">
      {groups.map(({ family, kits }) => (
        <section key={family} className="bl-kitpicker-section">
          <header className="bl-kitpicker-head">
            <span className="bl-kitpicker-family">{FAMILY_META[family].label}</span>
            <span className="bl-kitpicker-blurb">{FAMILY_META[family].blurb}</span>
          </header>
          <div className="bl-kitpicker-grid">
            {kits.map((kit) => (
              <KitCard
                key={kit.id}
                kit={kit}
                active={kit.id === activeId}
                onSelect={() => selectKit(kit)}
                onPreview={() => previewKit(host, target.id, kit)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

/**
 * Audition a kit WITHOUT starting playback. If the kit is already active we can
 * preview the live track directly; otherwise we momentarily swap, preview, and
 * — since selecting IS the intent of pressing preview on a card — leave it
 * selected. To keep "preview" purely a sound (no commit) when the user is just
 * browsing, we only preview the ACTIVE kit's voices here; inactive cards expose
 * their own select+hear via the card body (see KitCard).
 */
const previewKit = (host: BeatloungeHost, trackId: Id, kit: KitDef) => {
  // Stagger a couple of the kit's signature voices so the tap reads as a fill,
  // not a single thud. previewTrack triggers a one-shot at audio-now; it does
  // NOT start the transport.
  void kit
  const stagger = [0, 130, 240]
  PREVIEW_ROLES.forEach((role, i) => {
    const pitch = ROLE_TO_PITCH[role]
    window.setTimeout(() => host.previewTrack(trackId, 0.9, pitch), stagger[i] ?? 0)
  })
}

// ----------------------------------------------------------------- one card
const KitCard = ({
  kit,
  active,
  onSelect,
  onPreview,
}: {
  kit: KitDef
  active: boolean
  onSelect: () => void
  onPreview: () => void
}) => (
  <div className={`bl-kitcard${active ? " is-active" : ""}`}>
    <button
      type="button"
      className="bl-kitcard-main"
      onClick={onSelect}
      aria-pressed={active}
    >
      <span className="bl-kitcard-name">
        {active && <CheckGlyph />}
        {kit.name}
      </span>
      <span className="bl-kitcard-desc">{kit.description}</span>
    </button>
    <button
      type="button"
      className="bl-kitcard-preview"
      onClick={(e) => {
        e.stopPropagation()
        // Selecting first guarantees the preview is THIS kit's sound (the synth
        // rebuilds on the swap); then we audition. Setup, not play.
        onSelect()
        onPreview()
      }}
      aria-label={`Preview ${kit.name}`}
      title={`Preview ${kit.name}`}
    >
      <PlayGlyph />
    </button>
  </div>
)

// ----------------------------------------------------------------- glyphs (no emoji)
const CheckGlyph = () => (
  <svg
    className="bl-kitcard-check"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M5 13l4 4L19 7"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const PlayGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M8 5v14l11-7z" />
  </svg>
)
