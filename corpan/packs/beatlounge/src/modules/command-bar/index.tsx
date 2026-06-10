/**
 * beatlounge — the command-bar module + standalone mount helpers.
 *
 * The HEADLINE natural-language surface. Two ways to use it:
 *
 *   1. As a BeatloungeModule (`createCommandBarModule(deps)`) — registered in
 *      allModules; its tile is a "Tell the loop what to do…" launcher that opens
 *      the bar immersively, and its `actions` expose the same intents to the
 *      cross-module tool index.
 *
 *   2. Standalone (`mountCommandBar(container, deps)`) — the integrator wires the
 *      Dock-Rail's `onCommand` to open the bar in any host-provided node (an
 *      overlay, a sheet) WITHOUT touching Shell/DockRail. See the report.
 *
 * The controller (createCommandBarController) is the framework-agnostic core.
 */

import { createRoot, type Root } from "react-dom/client"
import type {
  BeatloungeModule,
  ModuleAction,
  ModuleInstance,
  ModuleMount,
} from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import { CommandBar } from "./CommandBar"
import {
  createCommandBarController,
  type CommandBarController,
  type CommandBarControllerDeps,
} from "./controller"
import "./styles.css"

export { CommandBar } from "./CommandBar"
export type { CommandBarProps } from "./CommandBar"
export {
  createCommandBarController,
  type CommandBarController,
  type CommandBarControllerDeps,
  type CommandBarState,
} from "./controller"

export const COMMAND_BAR_ID = "command-bar"

export interface CommandBarModuleDeps {
  store: BeatloungeStore
  /** The mounted host surface (bus + toast). Matches ModuleDeps.host. */
  host: import("../../contracts/module").BeatloungeHost
}

/**
 * Mount the command bar into a host-provided container as a standalone overlay.
 * Returns a handle with `unmount()` — the integrator calls this from the
 * Dock-Rail `onCommand` (opening into an overlay node it owns). Pass `onClose`
 * so the bar can ask to be dismissed.
 */
export interface MountedCommandBar {
  controller: CommandBarController
  unmount(): void
}

export const mountCommandBar = (
  container: HTMLElement,
  deps: CommandBarControllerDeps,
  opts?: { onClose?: () => void; examples?: string[] },
): MountedCommandBar => {
  const controller = createCommandBarController(deps)
  const root: Root = createRoot(container)
  root.render(
    <CommandBar
      controller={controller}
      onClose={opts?.onClose}
      placeholderExamples={opts?.examples}
    />,
  )
  return {
    controller,
    unmount() {
      controller.dispose()
      queueMicrotask(() => root.unmount())
    },
  }
}

/** A tiny launcher tile React view — opens the bar immersively when tapped. */
const LauncherTile = ({ onOpen }: { onOpen: () => void }) => (
  <button type="button" className="bl-cmdbar-launcher" onClick={onOpen}>
    <span className="bl-cmdbar-launcher-label">Tell the loop what to do…</span>
  </button>
)

/**
 * The BeatloungeModule wrapper. Its actions surface the headline intents to the
 * cross-module tool index (the runtime owns the live model path; these give the
 * registry-driven UI something to enumerate). The tile launches the immersive
 * bar via the host's `enterImmersive`.
 */
export const createCommandBarModule = (deps: CommandBarModuleDeps): BeatloungeModule => {
  const controllerDeps: CommandBarControllerDeps = {
    store: deps.store,
    host: deps.host,
    hostApi: deps.host.hostApi,
  }
  return {
    id: COMMAND_BAR_ID,
    kind: "utility",
    title: "Command",
    glyph: "command",
    immersive: "sheet",
    tileAspect: "wide",
    actions: COMMAND_BAR_ACTIONS,
    mount(mount: ModuleMount): ModuleInstance {
      const root: Root = createRoot(mount.container)
      if (mount.surface === "tile") {
        const open = () => mount.host.enterImmersive(COMMAND_BAR_ID)
        root.render(<LauncherTile onOpen={open} />)
      } else {
        const controller = createCommandBarController(controllerDeps)
        root.render(
          <div className="bl-cmdbar-immersive">
            <CommandBar controller={controller} />
          </div>,
        )
        return {
          unmount() {
            controller.dispose()
            queueMicrotask(() => root.unmount())
          },
        }
      }
      return {
        unmount() {
          queueMicrotask(() => root.unmount())
        },
      }
    },
  }
}

/**
 * The headline intents, declared as ModuleActions so the registry's tool index
 * lists them. Their `run` is a thin pointer back to the deterministic tool
 * catalog (the live model path is in the runtime); this keeps the registry
 * surface honest without duplicating logic.
 */
const COMMAND_BAR_ACTIONS: ReadonlyArray<ModuleAction> = [
  {
    name: "naturalLanguage",
    describe: "Reshape the loop from a plain-language request (the command bar).",
    params: {
      text: { type: "string", describe: "What to change, e.g. 'more hihats' or 'latin feel'." },
    },
    impact: "mutate",
    run: () => ({ commands: [], summary: "Open the command bar" }),
  },
]
