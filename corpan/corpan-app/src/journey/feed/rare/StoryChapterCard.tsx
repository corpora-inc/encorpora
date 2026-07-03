// src/journey/feed/rare/StoryChapterCard.tsx — reader-chapter epic reward
// poster → overlay handoff (feed-ux §1.7/§6). Story CONTENT is cut from
// v0.1 (R11) — the engine never rolls this variant against v0.1 packs; the
// face ships so pack data can light it up OTA without an app release.

import { PackActivityCard } from "../PackActivityCard.tsx"
import type { FeedCard } from "../../types.ts"

export function StoryChapterCard(props: {
  card: Extract<FeedCard, { kind: "packActivity" }>
  pending: boolean
  onPlay: () => void
}) {
  return <PackActivityCard card={props.card} pending={props.pending} onPlay={props.onPlay} />
}
