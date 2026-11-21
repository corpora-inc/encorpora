/** A window's page-lifecycle and presence events, fired by hand. */
export function fakeWindow() {
  const listeners = new Map<string, Set<(event: Event) => void>>();
  return {
    addEventListener(type: string, listener: (event: Event) => void) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener(type: string, listener: (event: Event) => void) {
      listeners.get(type)?.delete(listener);
    },
    fire(
      type:
        | "beforeunload"
        | "pagehide"
        | "pageshow"
        | "pointerdown"
        | "keydown"
        | "focus",
      persisted = false,
    ) {
      const event = Object.assign(new Event(type), { persisted });
      for (const listener of listeners.get(type) ?? []) listener(event);
    },
  };
}
export type FakeWindow = ReturnType<typeof fakeWindow>;
