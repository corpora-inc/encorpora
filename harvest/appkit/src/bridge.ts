/** The Tauri bridge, when the app runs in the native shell. No imports: safe anywhere, including node tests. */
export type Invoke = (cmd: string, args?: Record<string, unknown> | Uint8Array, options?: { headers?: Record<string, string> }) => Promise<unknown>;

export function tauriInvoke(): Invoke | null {
  const w = globalThis as unknown as { __TAURI_INTERNALS__?: { invoke: Invoke } };
  return w.__TAURI_INTERNALS__?.invoke ?? null;
}

export const isNative = () => tauriInvoke() !== null;
