import { nativeRuntime } from "./native-runtime";
import {
  nativeSession,
  nativeSignIn,
  nativeSignOut,
  nativeSessionEvents,
} from "./native-session";
import { UserManager, WebStorageStateStore, type User } from "oidc-client-ts";
import { accountClient } from "./account-client";
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
  | { mode: "accounts"; passwords: boolean; providers: string[] }
  | { mode: "oidc" | "development" | "native" };
let config: Promise<AuthConfig> | null = null;
export function authConfig(): Promise<AuthConfig> {
  // The native app signs in through its own session layer, not this API.
  if (nativeRuntime) return Promise.resolve({ mode: "native" });
  const fallback: AuthConfig = { mode: manager ? "oidc" : "development" };
  config ??= fetch("/api/v1/auth-config").then((r) => {
    if (r.ok) return r.json() as Promise<AuthConfig>;
    throw new Error(`auth-config ${r.status}`);
  });
  // A failed lookup is not remembered: the next call asks again.
  return config.catch((error) => {
    console.warn("Sign-in configuration unavailable", error);
    config = null;
    return fallback;
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
    const { data, error } = await accountClient.getSession();
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
    location.assign(intent === "create" ? "/?sign-in=create" : "/?sign-in");
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
    await accountClient.signOut();
    location.assign("/");
    return;
  }
  if (manager) await manager.signoutRedirect();
}

export function onSessionChanged(
  update: (session: AuthSession | null) => void,
  error?: (message: string) => void,
) {
  if (nativeRuntime) return nativeSessionEvents(update, error);
  if (!manager) return () => {};
  const loaded = (user: User) => update(session(user));
  const unloaded = () => update(null);
  manager.events.addUserLoaded(loaded);
  manager.events.addUserUnloaded(unloaded);
  manager.events.addAccessTokenExpired(unloaded);
  return () => {
    manager.events.removeUserLoaded(loaded);
    manager.events.removeUserUnloaded(unloaded);
    manager.events.removeAccessTokenExpired(unloaded);
  };
}
