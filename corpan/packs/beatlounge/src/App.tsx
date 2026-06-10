/**
 * beatlounge — App: the composition root.
 *
 * Constructs the spine (command bus + store with debounced IDB persistence),
 * the audio facade (the real lookahead scheduler + audio graph), the host (via
 * a chrome bridge so it exists before the shell), and the
 * module registry with the step-grid module placed on the Stage. Then renders
 * the Stage + Dock-Rail + Immersive shell.
 */

import { useEffect, useMemo } from "react"
import type { HostApi } from "./sdk/types"
import { createCommandBus } from "./model/commandBus"
import { createDefaultDoc } from "./model/document"
import { createBeatloungeAudio } from "./engine/createAudio"
import { createBeatloungeStore } from "./store/store"
import { createAudioSource } from "./phrase/audioSource"
import { createChromeBridge } from "./host/chromeBridge"
import { createHost } from "./host/createHost"
import { createFormObserver } from "./host/formFactor"
import { createModuleRegistry } from "./modules/registry"
import { registerAllModules } from "./modules/allModules"
import { Shell } from "./shell/Shell"

export const App = ({ hostApi }: { hostApi: HostApi }) => {
  const rig = useMemo(() => {
    const bus = createCommandBus(createDefaultDoc(Date.now()))
    const store = createBeatloungeStore(bus)
    // Shared phrase-sampler audio source so ttsFragment tracks play real audio
    // (the headline sampler feature); the IDB byte-cache is shared with the
    // phrase-sampler module by content hash.
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
    return { bus, store, audio, formObs, bridge, host, registry }
  }, [hostApi])

  // Hydrate from IndexedDB once, then own teardown.
  useEffect(() => {
    void rig.store.hydrateFromIdb()
    return () => {
      rig.store.dispose()
      rig.audio.dispose()
      rig.formObs.dispose()
    }
  }, [rig])

  return (
    <Shell
      store={rig.store}
      audio={rig.audio}
      registry={rig.registry}
      host={rig.host}
      attachChrome={(chrome) => rig.bridge.set(chrome)}
      skin="midnight"
    />
  )
}
