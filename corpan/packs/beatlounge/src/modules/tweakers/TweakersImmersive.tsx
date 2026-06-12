/**
 * beatlounge — the Players IMMERSIVE view (formerly "Tweakers"). A thin wrapper
 * over the shared <PlayersPanel> — the SAME panel the Mixer's Players section
 * embeds — so the autonomous-modulation surface lives in one place and can't
 * drift. See PlayersPanel.tsx for the body. Kept as a module so the standalone
 * page still resolves (the integrator decides whether to keep it registered).
 */

import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import { PlayersPanel } from "./PlayersPanel"

interface Props {
  host: BeatloungeHost
  store: BeatloungeStore
}

export const TweakersImmersive = ({ host, store }: Props) => (
  <PlayersPanel host={host} store={store} />
)
