// src/journey/exercises/common/ConceptImage.tsx — a single reserved concept
// picture used as a PROMPT or a CUE (research/images.md — imagepan): the
// image_word prompt (ChoicePick) and the picture-cloze cue (Cloze).
//
// No-reflow rule (HARD): a fixed-size, aspect-locked box with a muted
// background, so an async load — or an absent/broken src — reserves its slot
// and never shifts the card. Squared-off 8px corners (design std).

export function ConceptImage(props: {
  src: string
  alt: string
  /** "prompt" = the hero meaning cue (larger); "cue" = a compact hint. */
  size?: "prompt" | "cue"
}) {
  const big = props.size !== "cue"
  return (
    <div
      className={[
        "flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted",
        big ? "h-40 w-40" : "h-24 w-24",
      ].join(" ")}
      data-testid="journey-concept-image"
    >
      <img src={props.src} alt={props.alt} className="h-full w-full object-contain" />
    </div>
  )
}
