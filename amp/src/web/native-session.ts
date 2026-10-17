import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { AuthSession } from "./auth";

let subscriptionReady: Promise<void> = Promise.resolve();
export const nativeSession = async () => {
  await subscriptionReady;
  return invoke<AuthSession | null>("native_session");
};
export const nativeSignIn = () => invoke<void>("native_sign_in");
export const nativeSignOut = () => invoke<void>("native_sign_out");
export function nativeSessionEvents(
  update: (session: AuthSession | null) => void,
  error?: (message: string) => void,
) {
  let alive = true;
  let unlisten: (() => void) | undefined;
  subscriptionReady = listen<{
    session: AuthSession | null;
    error: string | null;
  }>("amp-session", ({ payload }) => {
    if (!alive) return;
    update(payload.session);
    if (payload.error) error?.(payload.error);
  })
    .then((stop) => {
      if (alive) unlisten = stop;
      else stop();
    })
    .catch(() => {
      if (alive)
        error?.("Native sign-in is unavailable. Please reopen the app.");
    });
  return () => {
    alive = false;
    unlisten?.();
  };
}
