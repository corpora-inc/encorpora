/**
 * beatlounge — the GROOVES module (kind "sequencer"): a browsable bank of world
 * rhythms (clave, samba, reggaetón, second-line, teental…) you Apply / Vary /
 * Evolve / Randomize onto the drum track. Mirrors the phrase-jam module shape —
 * a factory binds store + audio + host and returns a BeatloungeModule whose
 * `mount()` renders the tile or the immersive picker into the host container via
 * its own React root.
 *
 * The corpus + operations engine (src/rhythm) do all the musical work; this
 * module is the surface. Every operation dispatches through the command bus as
 * ONE undo step (the actions return command lists; runAction wraps them in a
 * batch). Applying a groove only WRITES the grid — it never plays sound.
 *
 * The apply/vary/evolve/randomize actions are exposed so the LLM command bus can
 * drive them later (LLM-as-artist is a future hook; v1 variation is algorithmic).
 */

import { createRoot, type Root } from "react-dom/client"
import { ct } from "../../i18n/strings"
import { makeDeferredUnmount } from "../_shared/deferUnmount"
import type {
  BeatloungeModule,
  ModuleInstance,
  ModuleMount,
} from "../../contracts/module"
import type { ModuleDeps } from "../allModules"
import { groovesActions } from "./actions"
import { GroovesTile } from "./GroovesTile"
import { GroovesImmersive } from "./GroovesImmersive"
import "./grooves.css"

export const GROOVES_ID = "grooves"

export const createGroovesModule = ({ store }: ModuleDeps): BeatloungeModule => ({
  id: GROOVES_ID,
  kind: "sequencer",
  // The module-bar glyph must be a known bl-ui GlyphName; "metronome" reads as
  // rhythm. The tile + immersive render a custom inline-SVG groove mark.
  glyph: "metronome",
  title: ct("grooves.title"),
  immersive: "full",
  tileAspect: "wide",
  actions: groovesActions,
  mount(mount: ModuleMount): ModuleInstance {
    const root: Root = createRoot(mount.container)

    const render = () => {
      if (mount.surface === "tile") {
        root.render(<GroovesTile store={store} />)
      } else {
        root.render(<GroovesImmersive store={store} host={mount.host} />)
      }
    }

    render()

    return {
      unmount: makeDeferredUnmount(root),
      refreshTile: mount.surface === "tile" ? render : undefined,
    }
  },
})
