import { Destination } from "./Destination.tsx"
import { WorldScreen } from "../world/Screen.tsx"
import { worldStore } from "../world/live.ts"

/**
 * Everything the child has cut.
 *
 * No heading, no total, no encouragement to come back and cut more. An empty
 * plate at the start is honest — the stone is there and nothing is out of it
 * yet — and a screen with four courses in it does not need to be described.
 * The count is in the text alternative, where a number belongs.
 */
export function WorldRoute() {
  const placed = worldStore((state) => state.placed)

  return (
    <Destination>
      <WorldScreen placed={placed} className="mx-auto block h-auto w-full max-w-sm" />
    </Destination>
  )
}
