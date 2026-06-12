/**
 * beatlounge — App: the composition root.
 *
 * HYDRATE-FIRST: we load the persisted doc from IndexedDB BEFORE building the
 * bus + modules, so module track-bindings resolve against the real (persisted)
 * doc and stay valid. (Building from a fresh default and swapping the doc in
 * afterwards left track-bound tiles pointing at stale ids — they rendered
 * nothing.) Old persisted docs are backfilled with any fields added since.
 *
 * Constructs the spine (command bus + store with debounced IDB persistence),
 * the audio facade (real lookahead scheduler + audio graph + modulation), the
 * host (via a chrome bridge so it exists before the shell), and the module
 * registry, then renders the Stage + Dock-Rail + Immersive shell.
 */

import { useEffect, useState } from "react"
import type { HostApi } from "./sdk/types"
import { createCommandBus } from "./model/commandBus"
import { createDefaultDoc, type BeatloungeDoc } from "./model/document"
import { newId } from "./model/ids"
import { createBeatloungeAudio } from "./engine/createAudio"
import { createBeatloungeStore } from "./store/store"
import { loadActiveDoc } from "./store/persistence"
import { createAudioSource } from "./phrase/audioSource"
import { createChromeBridge } from "./host/chromeBridge"
import { createHost } from "./host/createHost"
import { createFormObserver } from "./host/formFactor"
import { createModuleRegistry } from "./modules/registry"
import { registerAllModules } from "./modules/allModules"
import { Shell } from "./shell/Shell"
import { ErrorBoundary } from "./shell/ErrorBoundary"
import { createAutoConductor } from "./shell/AutoConductor"

/** Backfill fields added after a doc was persisted, so the engine never reads
 *  an undefined array (e.g. audioGraph iterates doc.buses). */
const normalizeDoc = (d: BeatloungeDoc): BeatloungeDoc => ({
  ...d,
  tempoMap: d.tempoMap ?? [],
  meterMap:
    d.meterMap && d.meterMap.length
      ? d.meterMap
      : [{ id: newId("m"), tick: 0, sig: { numerator: 4, denominator: 4 } }],
  buses: d.buses ?? [],
  fragmentLibrary: d.fragmentLibrary ?? [],
  modulators: d.modulators ?? [],
  swing: d.swing ?? { amount: 0, grid: { denominator: 16 } },
})

interface Rig {
  store: ReturnType<typeof createBeatloungeStore>
  audio: ReturnType<typeof createBeatloungeAudio>
  formObs: ReturnType<typeof createFormObserver>
  bridge: ReturnType<typeof createChromeBridge>
  host: ReturnType<typeof createHost>
  registry: ReturnType<typeof createModuleRegistry>
  /** The always-on Auto melody conductor — rig-level so an armed line keeps
   *  regenerating after you leave Instruments / go to the Stage. */
  conductor: ReturnType<typeof createAutoConductor>
}

const buildRig = (hostApi: HostApi, doc: BeatloungeDoc): Rig => {
  const bus = createCommandBus(doc)
  const store = createBeatloungeStore(bus)
  const audioSource = createAudioSource({ hostApi })
  const audio = createBeatloungeAudio(bus, {
    fragmentDeps: {
      audioSource,
      getFragmentRef: (id) => bus.snapshot().fragmentLibrary.find((f) => f.id === id),
    },
  })
  const formObs = createFormObserver()
  const bridge = createChromeBridge(formObs.get)
  const host = createHost({ hostApi, bus, audio, chrome: bridge.chrome })
  const registry = createModuleRegistry()
  registerAllModules(registry, { store, audio, host })
  // The Auto melody conductor lives at the rig (pack) lifetime — created exactly
  // once per rig and immune to Score remount / screen nav. Generation is gated
  // on the global transport, so this is silent until the user presses play.
  const conductor = createAutoConductor({ store, audio })
  return { store, audio, formObs, bridge, host, registry, conductor }
}

/** Dispose every rig subsystem, each guarded so one failure can't abort the
 *  rest or throw out of React cleanup (which would white-screen the pack). */
const disposeRig = (rig: Rig | null): void => {
  if (!rig) return
  for (const dispose of [
    rig.conductor.dispose,
    rig.store.dispose,
    rig.audio.dispose,
    rig.formObs.dispose,
  ]) {
    try {
      dispose()
    } catch (err) {
      console.warn("[beatlounge] rig dispose threw (continuing):", err)
    }
  }
}

export const App = ({ hostApi }: { hostApi: HostApi }) => {
  const [rig, setRig] = useState<Rig | null>(null)

  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let alive = true
    let built: Rig | null = null
    void loadActiveDoc().then((persisted) => {
      if (!alive) return
      const doc = persisted ? normalizeDoc(persisted) : createDefaultDoc(Date.now())
      built = buildRig(hostApi, doc)
      setRig(built)
    })
    return () => {
      alive = false
      setRig(null)
      // Dispose each subsystem independently + defensively: a throw in one
      // (e.g. an audio node already torn down) must never abort the others or
      // bubble out of cleanup and blank the screen. Each dispose is itself
      // idempotent, so a double-cleanup is a no-op.
      disposeRig(built)
      built = null
    }
  }, [hostApi, nonce])

  if (!rig) {
    return (
      <div className="bl-root" data-skin="midnight">
        <div className="bl-boot">
          <div className="bl-wordmark">beatlounge</div>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary onReset={() => setNonce((n) => n + 1)}>
      <Shell
        store={rig.store}
        audio={rig.audio}
        registry={rig.registry}
        host={rig.host}
        attachChrome={(chrome) => rig.bridge.set(chrome)}
        skin="midnight"
      />
    </ErrorBoundary>
  )
}
