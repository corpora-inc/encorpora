import type { OAuthProvider } from "@better-auth/core/oauth2";
import { defineRequestState } from "@better-auth/core/context";
import { APIError } from "better-auth/api";

const verifiedProvider = defineRequestState<{
  provider: string;
  account: string;
} | null>(() => null);

/** Keep the library's verified account subject in its request-local store.
 * The library still performs all provider verification and profile mapping. */
export function rememberVerifiedProvider<T extends object, O extends object>(
  provider: OAuthProvider<T, O>,
) {
  return async (tokens: Parameters<OAuthProvider<T, O>["getUserInfo"]>[0]) => {
    const result = await provider.getUserInfo(tokens);
    if (!result) return null;
    const subject = await provider.accountSubject({
      tokens,
      profile: result.data,
    });
    const account = String(subject);
    if (
      !account.trim() ||
      account === "undefined" ||
      account === "null" ||
      (typeof subject === "number" && !Number.isFinite(subject))
    )
      throw new APIError("UNAUTHORIZED", {
        message: "This sign-in could not be verified.",
      });
    await verifiedProvider.set({ provider: provider.id, account });
    return { ...result, user: { ...result.user } };
  };
}

/** These fields authorize only the final session INSERT and are cleared by its
 * trigger. No identity is taken from client additional data or a session cookie. */
export async function sessionMethodAuthority(
  context: {
    path?: string;
    body?: { response?: { id?: unknown } };
  } | null,
) {
  if (context?.path === "/passkey/verify-authentication") {
    const credential = context.body?.response?.id;
    if (typeof credential !== "string" || !credential)
      throw new APIError("UNAUTHORIZED", {
        message: "This passkey could not be verified.",
      });
    return {
      ampMethodKind: "passkey",
      ampMethodId: credential,
      ampMethodProvider: null,
    };
  }
  if (
    context?.path === "/sign-in/social" ||
    context?.path?.startsWith("/callback/")
  ) {
    const identity = await verifiedProvider.get();
    if (!identity)
      throw new APIError("UNAUTHORIZED", {
        message: "This sign-in could not be verified.",
      });
    return {
      ampMethodKind: "provider",
      ampMethodId: identity.account,
      ampMethodProvider: identity.provider,
    };
  }
  return { ampMethodKind: null, ampMethodId: null, ampMethodProvider: null };
}
