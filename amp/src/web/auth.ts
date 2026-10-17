import { nativeRuntime } from "./native-runtime";
import { UserManager, WebStorageStateStore, type User } from "oidc-client-ts";
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
  if (nativeRuntime) return null;
  if (import.meta.env.DEV && !manager)
    return {
      token: "amp-local-development",
      accountId: "development-household",
    };
  if (!manager) return null;
  if (new URLSearchParams(location.search).has("code")) {
    await manager.signinRedirectCallback();
    history.replaceState({}, "", location.pathname);
  }
  const user = await manager.getUser();
  return user && !user.expired ? session(user) : null;
}
export async function signIn() {
  if (nativeRuntime)
    throw new Error("Parent sign-in is not available in this native preview.");
  if (!manager)
    throw new Error(
      "Account sign-in has not been configured for this deployment.",
    );
  await manager.signinRedirect();
}
export async function signOut() {
  if (manager) await manager.signoutRedirect();
}

export function onSessionChanged(
  update: (session: AuthSession | null) => void,
) {
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
