// src/journey/exercises/common/ImageTiles.tsx — the shared 2×2 picture-answer
// grid (research/images.md — imagepan). Used wherever the TAP TARGETS are
// pictures: ListenPick (HEAR → picture, the flagship) and ChoicePick (word →
// picture). The answer-slot layout is built by the pure buildImageTiles
// (imageChoice.ts); this is the render + a11y + result-state skin.
//
// No-reflow rule (HARD): the tiles are fixed aspect-square boxes in a fixed
// 2-col grid, so an async picture load — or a broken/absent src — never shifts
// anything; the box is reserved at layout time and the muted background stands
// in until (or instead of) the bitmap. Squared-off 8px corners (design std).

import type { ImageTile } from "../imageChoice.ts"

export function ImageTiles(props: {
  tiles: ImageTile[]
  /** The correct tile id (imageChoice.IMAGE_ANSWER_TILE_ID). */
  answerId: string
  /** The tile the learner tapped, or null. */
  picked: string | null
  /** Answered (a pick landed) or review mode → paint the correct/wrong skin. */
  answered: boolean
  disabled: boolean
  onPick: (id: string) => void
}) {
  return (
    <div
      className="grid w-full max-w-md grid-cols-2 gap-2"
      role="listbox"
      data-testid="journey-image-tiles"
    >
      {props.tiles.map((tile) => {
        const state = props.answered
          ? tile.id === props.answerId
            ? "correct"
            : tile.id === props.picked
              ? "wrong"
              : null
          : null
        return (
          <button
            key={tile.id}
            type="button"
            disabled={props.disabled}
            onClick={() => props.onPick(tile.id)}
            data-journey-tile={tile.id}
            aria-label={tile.alt}
            className={[
              "aspect-square overflow-hidden rounded-lg border p-2 transition-all active:scale-[0.97]",
              state === "correct"
                ? "border-emerald-500/70 bg-emerald-500/10"
                : state === "wrong"
                  ? "border-red-500/60 bg-red-500/10"
                  : "border-border bg-muted hover:bg-muted/70",
            ].join(" ")}
          >
            {/* corpan-pack:// is a local scheme an <img> loads directly. The box
                above is reserved, so a slow/failed load never reflows. */}
            <img src={tile.imageSrc} alt={tile.alt} className="h-full w-full object-contain" />
          </button>
        )
      })}
    </div>
  )
}
