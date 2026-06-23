/**
 * beatlounge — the standalone GROOVES IMMERSIVE view. It now renders the shared
 * <GroovesPanel> (the single source of truth, also embedded in the Drums page),
 * so the browser/Apply/Layer/Vary/Evolve/Randomize behaviour and the responsive
 * no-clip layout are identical wherever Grooves appears. Keeping the standalone
 * module registered means Grooves is still its own destination — it just shares
 * the panel.
 */

import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import { GroovesPanel } from "./GroovesPanel"

interface Props {
  store: BeatloungeStore
  host: BeatloungeHost
}

export const GroovesImmersive = ({ store, host }: Props) => (
  <div className="bl-grooves">
    <GroovesPanel store={store} host={host} variant="standalone" />
  </div>
)
