// src/journey/feed/rare/MiniGameRoundCard.tsx — pack anchor poster →
// overlay handoff (feed-ux §1.7/§6). Thin dispatch onto PackActivityCard.

import { PackActivityCard } from "../PackActivityCard.tsx"
import type { FeedCard } from "../../types.ts"

export function MiniGameRoundCard(props: {
  card: Extract<FeedCard, { kind: "packActivity" }>
  pending: boolean
  onPlay: () => void
}) {
  return <PackActivityCard card={props.card} pending={props.pending} onPlay={props.onPlay} />
}
