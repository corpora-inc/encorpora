/**
 * Browser-global shims for the zero-dep node:test runner. Imported (statically,
 * FIRST) by the catalog upgrade/library tests so `localStorage` / `window` exist
 * before zustand's persist middleware captures them at store-creation time.
 *
 * Not shipped — referenced only by *.test.ts. Mutable `navState` lets a test
 * drive `navigator.onLine` / `navigator.connection`.
 */

class MemoryStorage {
  private m = new Map<string, string>()
  getItem(k: string): string | null {
    return this.m.has(k) ? (this.m.get(k) as string) : null
  }
  setItem(k: string, v: string): void {
    this.m.set(k, String(v))
  }
  removeItem(k: string): void {
    this.m.delete(k)
  }
  clear(): void {
    this.m.clear()
  }
}

export const navState: {
  online: boolean
  connection?: { saveData?: boolean; type?: string; effectiveType?: string }
} = { online: true }

const winTarget = new EventTarget()
export const fakeWindow = {
  addEventListener: winTarget.addEventListener.bind(winTarget),
  removeEventListener: winTarget.removeEventListener.bind(winTarget),
  dispatchEvent: winTarget.dispatchEvent.bind(winTarget),
}

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: new MemoryStorage(),
})
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: fakeWindow,
})
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: {
    get onLine() {
      return navState.online
    },
    get connection() {
      return navState.connection
    },
  },
})

if (typeof (globalThis as { CustomEvent?: unknown }).CustomEvent === "undefined") {
  ;(globalThis as { CustomEvent: unknown }).CustomEvent = class<T> extends Event {
    detail: T
    constructor(type: string, init?: { detail?: T }) {
      super(type)
      this.detail = init?.detail as T
    }
  }
}
