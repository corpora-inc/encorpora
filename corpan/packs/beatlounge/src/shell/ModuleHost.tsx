/**
 * beatlounge — ModuleHost: mounts a BeatloungeModule into a real DOM node via
 * its frozen `mount(ModuleMount)` contract (the module owns its render — its
 * own React root, canvas, etc.). The shell only provides the container + the
 * surface + form + host. Re-mounts when surface / trackId change; unmounts on
 * teardown. NEVER renders into document.body — always the provided ref node.
 */

import { useEffect, useRef } from "react"
import type {
  BeatloungeHost,
  BeatloungeModule,
  FormFactor,
  ModuleInstance,
} from "../contracts/module"

interface Props {
  module: BeatloungeModule
  surface: "tile" | "immersive"
  form: FormFactor
  host: BeatloungeHost
  trackId?: string
  className?: string
}

export const ModuleHost = ({
  module,
  surface,
  form,
  host,
  trackId,
  className,
}: Props) => {
  const ref = useRef<HTMLDivElement>(null)
  const instRef = useRef<ModuleInstance | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const inst = module.mount({ container: el, surface, form, host, trackId })
    instRef.current = inst
    return () => {
      inst.unmount()
      instRef.current = null
    }
    // Re-mount only when the module identity / surface / track binding changes;
    // form is read live by the module via host.form(), so it isn't a dep here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module, surface, trackId])

  return <div ref={ref} className={className} />
}
