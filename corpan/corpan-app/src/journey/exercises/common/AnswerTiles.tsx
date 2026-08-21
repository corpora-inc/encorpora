// src/journey/exercises/common/AnswerTiles.tsx — shared choice/tile grid
// (feed-ux §4). RTL-aware: the grid flows with the dir of the ANSWER
// language, never the UI.


import { isRTL } from "../../../util/convert"

export interface Tile {
  id: string
  text: string
  /** Eliminated by the retry scaffold (§3.3) — rendered dimmed + disabled. */
  eliminated?: boolean
  /** Review mode adornment. */
  state?: "correct" | "wrong" | null
}

export function AnswerTiles(props: {
  tiles: Tile[]
  lang: string
  disabled?: boolean
  onPick: (id: string) => void
  columns?: 1 | 2
  testId?: string
}) {
  const dir = isRTL(props.lang) ? "rtl" : "ltr"
  const cols = props.columns ?? 1
  return (
    <div
      dir={dir}
      className={`grid w-full gap-2 ${cols === 2 ? "grid-cols-2" : "grid-cols-1"}`}
      role="listbox"
      data-testid={props.testId ?? "journey-answer-tiles"}
    >
      {props.tiles.map((tile) => (
        <button
          key={tile.id}
          type="button"
          disabled={props.disabled || tile.eliminated}
          onClick={() => props.onPick(tile.id)}
          lang={props.lang}
          data-journey-tile={tile.id}
          className={[
            "min-h-12 rounded-xl border px-4 py-3 text-start text-base font-medium transition-all active:scale-[0.97]",
            tile.state === "correct"
              ? "border-emerald-500/60 bg-emerald-500/10 text-foreground"
              : tile.state === "wrong"
                ? "border-red-500/50 bg-red-500/10 text-foreground"
                : "border-border bg-card text-foreground hover:bg-muted",
            tile.eliminated ? "opacity-35 line-through" : "",
          ].join(" ")}
        >
          {tile.text}
        </button>
      ))}
    </div>
  )
}
