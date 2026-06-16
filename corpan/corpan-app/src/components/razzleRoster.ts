// src/components/razzleRoster.ts
//
// Builds the card roster for the PackLaunchTransition collage from the same art
// source Home uses (catalog `imageUrl` + localized experience names), plus the
// per-experience icon/colour fallbacks. Kept separate from App.tsx so the glue
// stays lean and this is unit-testable.

import type { CatalogGame } from "@/contentPacks/catalog"
import { EXPERIENCES } from "@/experiences/registry"
import type { RazzleCard } from "./PackLaunchTransition"

/** lucide icon NAME per experience (matches PackLaunchTransition's registry). */
const ICON_BY_ID: Record<string, string> = {
  earthgate_reader: "BookOpen",
  stargate_reader: "BookOpen",
  world_radio: "Radio",
  hover_runner: "Gamepad2",
  corpan_city: "Sparkles",
  juice_squeeze: "Citrus",
  pronunciation_coach: "Mic",
  hanzipan: "PenTool",
  phrase_main: "Brain",
  tutomaton: "Mic",
}

/** A distinct accent per experience (tile tint + the chosen-card wash colour). */
const COLOR_BY_ID: Record<string, string> = {
  earthgate_reader: "#5ea9f7",
  stargate_reader: "#7c8cf8",
  world_radio: "#34d399",
  hover_runner: "#f59e0b",
  corpan_city: "#f472b6",
  juice_squeeze: "#f97316",
  pronunciation_coach: "#22d3ee",
  hanzipan: "#ef4444",
  phrase_main: "#a879f7",
  tutomaton: "#a78bfa",
}

export type RosterDeps = {
  /** Runtime catalog (for pack imageUrl + name fallback). */
  catalog: CatalogGame[]
  /** Localized experience-name resolver: (id, fallback) → display name. */
  name: (id: string, fallback: string) => string
}

function cardFor(id: string, deps: RosterDeps): RazzleCard {
  const cg = deps.catalog.find((g) => g.id === id)
  return {
    id,
    name: deps.name(id, cg?.name ?? id),
    imageUrl: cg?.imageUrl,
    icon: ICON_BY_ID[id] ?? "Package",
    color: COLOR_BY_ID[id],
  }
}

/** The full collage roster — every experience (hints at the breadth). */
export function buildRazzleRoster(deps: RosterDeps): RazzleCard[] {
  return EXPERIENCES.map((e) => cardFor(e.id, deps))
}

/** Resolve one card by chosen id (a pack id, "phrase_main", or "library"). */
export function resolveRazzleCard(id: string, deps: RosterDeps): RazzleCard {
  return cardFor(id, deps)
}
