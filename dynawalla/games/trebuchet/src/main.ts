/** Standalone dev entry: the game plus the local stub host. `npm run dev`. */

import { mount } from './index.ts'
import { createStubHost } from './stubHost.ts'

const el = document.getElementById('app')
if (!el) throw new Error('#app missing')

const host = createStubHost({ seed: 0xc0ffee })
const handle = mount(el, host)

declare global {
  interface Window {
    __trebHost?: ReturnType<typeof createStubHost>
    __trebUnmount?: () => void
  }
}
window.__trebHost = host
window.__trebUnmount = handle.unmount
