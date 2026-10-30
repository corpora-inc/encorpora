import { accountChannel, broadcastAccountChange } from "./lib/account-signals";
import { nativeRuntime } from "./native-runtime";
import {
  nativeSession,
  nativeSignIn,
  nativeSignOut,
  nativeSessionEvents,
} from "./native-session";
import { UserManager, WebStorageStateStore, type User } from "oidc-client-ts";
import { accountClient } from "./account-client";
import { AppError } from "./lib/AppError";
import { measureAuth } from "./lib/auth-measurement";
const authority = import.meta.env.VITE_AMP_AUTHORITY as string | undefined;
const clientId = import.meta.env.VITE_AMP_CLIENT_ID as string | undefined;
const manager =
  !nativeRuntime && authority && clientId
    ? new UserManager({
        authority,
        client_id: clientId,
        redirect_uri: `${location.origin}/`,
        response_type: "code",
        scope: import.meta.env.VITE_AMP_SCOPES ?? "openid profile",
        ...(import.meta.env.VITE_AMP_RESOURCE
          ? { resource: import.meta.env.VITE_AMP_RESOURCE }
          : {}),
        userStore: new WebStorageStateStore({ store: sessionStorage }),
        automaticSilentRenew: true,
      })
    : null;
const devSignedOut = "amp.dev.signedOut";

/** How this deployment signs parents in, as the API reports it. */
export type AuthConfig =
  | {
      mode: "accounts";
      passwords: boolean;
      /** A new parent can create the account with a passkey. */
      passkeySignup?: boolean;
      parentFollowup?: boolean;
      providers: string[];
    }
  | { mode: "oidc" | "development" | "native" };
let config: Promise<AuthConfig> | null = null;
export function authConfig(): Promise<AuthConfig> {
  // The native app signs in through its own session layer, not this API.
  if (nativeRuntime) return Promise.resolve({ mode: "native" });
  const fallback: AuthConfig = { mode: manager ? "oidc" : "development" };
  config ??= measureAuth("configuration", async () => {
    const response = await fetch("/api/v1/auth-config", {
      signal: AbortSignal.timeout(10000),
    });
    if (response.ok) return response.json() as Promise<AuthConfig>;
    throw new Error(`auth-config ${response.status}`);
  });
  // A failed lookup is not remembered: the next call asks again.
  return config.catch(() => {
    config = null;
    if (import.meta.env.DEV) return fallback;
    throw new AppError(
      "unavailable",
      "Sign-in options couldn’t load. Please try again.",
      true,
    );
  });
}
export interface AuthSession {
  token: string;
  accountId: string;
}
function session(user: User): AuthSession {
  return {
    token: user.access_token,
    accountId: `${authority}|${user.profile.sub}`,
  };
}
export async function accessSession(): Promise<AuthSession | null> {
  if (nativeRuntime) return nativeSession();
  if ((await authConfig()).mode === "accounts") {
    // AMP's own accounts: the session token doubles as the API bearer token.
    const { data, error } = await accountClient.getSession({
      fetchOptions: { timeout: 10000 },
    });
    if (error) throw new Error(error.message ?? "Sign-in could not be checked");
    return data
      ? { token: data.session.token, accountId: `amp|${data.user.id}` }
      : null;
  }
  if (import.meta.env.DEV && !manager) {
    // Development only: `?signed-out` simulates a visitor without an account
    // for this tab, so the "Try free" path can be exercised locally.
    if (new URLSearchParams(location.search).has("signed-out")) {
      sessionStorage.setItem(devSignedOut, "1");
      history.replaceState({}, "", location.pathname);
    }
    if (sessionStorage.getItem(devSignedOut)) return null;
    return {
      token: "amp-local-development",
      accountId: "development-household",
    };
  }
  if (!manager) return null;
  if (new URLSearchParams(location.search).has("code")) {
    await manager.signinRedirectCallback();
    history.replaceState({}, "", location.pathname);
  }
  const user = await manager.getUser();
  return user && !user.expired ? session(user) : null;
}
/** Starts sign-in; `create` opens the new-account form. */
export async function signIn(intent?: "create") {
  if (nativeRuntime) return nativeSignIn();
  if ((await authConfig()).mode === "accounts") {
    location.assign(intent === "create" ? "/sign-up" : "/sign-in");
    return;
  }
  if (import.meta.env.DEV && !manager) {
    sessionStorage.removeItem(devSignedOut);
    location.reload();
    return;
  }
  if (!manager)
    throw new Error(
      "Account sign-in has not been configured for this deployment.",
    );
  await manager.signinRedirect();
}
export async function signOut() {
  if (nativeRuntime) return nativeSignOut();
  if ((await authConfig()).mode === "accounts") {
    const result = await accountClient.signOut();
    if (result.error)
      throw new Error(result.error.message ?? "Sign out did not finish");
    notifyAccountSessionChanged();
    location.assign("/");
    return;
  }
  if (manager) await manager.signoutRedirect();
}

const accountSessionListeners = new Set<
  (session: AuthSession | null) => void
>();

/** Publish a checked session in this tab before navigation. Cross-tab messages
 * carry no credentials; other tabs check their own session. */
export function notifyAccountSessionChanged(checked?: AuthSession | null) {
  if (checked === undefined)
    window.dispatchEvent(new Event("amp-account-session-changed"));
  else for (const listener of accountSessionListeners) listener(checked);
  broadcastAccountChange();
}

export function onSessionChanged(
  update: (session: AuthSession | null) => void,
  error?: (message: string) => void,
) {
  if (nativeRuntime) return nativeSessionEvents(update, error);
  let generation = 0;
  const checked = (session: AuthSession | null) => {
    generation++;
    update(session);
  };
  accountSessionListeners.add(checked);
  if (!manager) {
    const changed = () => {
      const current = ++generation;
      void accessSession()
        .then((session) => {
          if (current === generation) update(session);
        })
        .catch((failure) => {
          if (current === generation) error?.(String(failure));
        });
    };
    const channel = accountChannel();
    if (channel) channel.onmessage = changed;
    window.addEventListener("amp-account-session-changed", changed);
    return () => {
      generation++;
      accountSessionListeners.delete(checked);
      window.removeEventListener("amp-account-session-changed", changed);
      try {
        channel?.close();
      } catch {
        /* Optional cross-tab transport. */
      }
    };
  }
  const loaded = (user: User) => update(session(user));
  const unloaded = () => update(null);
  manager.events.addUserLoaded(loaded);
  manager.events.addUserUnloaded(unloaded);
  manager.events.addAccessTokenExpired(unloaded);
  return () => {
    accountSessionListeners.delete(checked);
    manager.events.removeUserLoaded(loaded);
    manager.events.removeUserUnloaded(unloaded);
    manager.events.removeAccessTokenExpired(unloaded);
  };
}
