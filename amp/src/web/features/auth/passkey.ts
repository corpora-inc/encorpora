import {
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
  startAuthentication,
  startRegistration,
  WebAuthnError,
} from "@simplewebauthn/browser";
import { nativeRuntime } from "../../native-runtime";

/**
 * Passkeys are offered only where the ceremony can succeed: a browser with
 * WebAuthn on a secure origin named by a domain. The native app never shows them: its webview
 * has no associated-domain (iOS `webcredentials`) or Digital Asset Links
 * (Android) binding to AMP's relying party, so a ceremony there would fail.
 */
export function passkeysAvailable(): boolean {
  return (
    !nativeRuntime &&
    typeof window !== "undefined" &&
    window.isSecureContext &&
    // An IP address is not a valid relying-party ID (use localhost locally).
    !/^\d+\.\d+\.\d+\.\d+$|^\[/.test(location.hostname) &&
    browserSupportsWebAuthn()
  );
}

/** What to do when a passkey sign-in did not finish: the browser does not
 * reveal whether the parent cancelled or has no passkey for AMP yet. */
export const NO_PASSKEY =
  "No passkey for AMP was used. If you haven't saved one, sign in another way below, then add one in Family → Security.";

export type PasskeySignUpResult =
  | { ok: true }
  | { ok: false; code: "exists" | "cancelled" | "failed"; message: string };

async function post(path: string, body: unknown) {
  const response = await fetch(`/api/auth${path}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => null)) as {
    code?: string;
    message?: string;
  } | null;
  return { response, data };
}

/** Create the parent account with a new passkey and sign in. The server
 * creates nothing until the passkey is verified. */
export async function signUpWithPasskey(
  email: string,
): Promise<PasskeySignUpResult> {
  const options = await post("/passkey-signup/options", { email });
  if (options.data?.code === "ACCOUNT_EXISTS")
    return {
      ok: false,
      code: "exists",
      message: "An AMP account already uses this email. Sign in instead.",
    };
  if (!options.response.ok) {
    console.error("Passkey sign-up options failed", options.response.status);
    return {
      ok: false,
      code: "failed",
      message:
        options.data?.message ?? "The account could not be created. Try again.",
    };
  }
  let credential;
  try {
    credential = await startRegistration({
      optionsJSON: options.data as never,
    });
  } catch (error) {
    console.warn("Passkey registration did not finish", error);
    const cancelled =
      (error instanceof WebAuthnError &&
        error.code === "ERROR_CEREMONY_ABORTED") ||
      (error instanceof Error && error.name === "NotAllowedError");
    return {
      ok: false,
      code: cancelled ? "cancelled" : "failed",
      message: cancelled
        ? "No passkey was saved, so no account was created. Try again, or use a password instead."
        : "This device could not save a passkey. Use a password or another way to sign up.",
    };
  }
  const { clientExtensionResults: _ignored, ...response } = credential;
  const verified = await post("/passkey-signup/verify", { response });
  if (verified.data?.code === "ACCOUNT_EXISTS")
    return {
      ok: false,
      code: "exists",
      message: "An AMP account already uses this email. Sign in instead.",
    };
  if (!verified.response.ok) {
    console.error("Passkey sign-up failed", verified.response.status);
    return {
      ok: false,
      code: "failed",
      message:
        verified.data?.message ??
        "The account could not be created. Try again.",
    };
  }
  return { ok: true };
}

/**
 * Arm passkey autofill on the email field (WebAuthn conditional mediation).
 * Resolves true once the parent chose a passkey and the server signed them
 * in. `live` is checked before every step, so a screen that has gone never
 * starts a ceremony or completes a sign-in in the background.
 */
export async function passkeyAutofill(live: () => boolean): Promise<boolean> {
  if (!(await browserSupportsWebAuthnAutofill()) || !live()) return false;
  const options = await fetch(
    "/api/auth/passkey/generate-authenticate-options",
    { credentials: "same-origin" },
  );
  if (!options.ok || !live()) return false;
  let credential;
  try {
    credential = await startAuthentication({
      optionsJSON: await options.json(),
      useBrowserAutofill: true,
    });
  } catch {
    return false; // Replaced by the button, or the screen closed.
  }
  if (!live()) return false;
  const { clientExtensionResults: _ignored, ...response } = credential;
  const verified = await post("/passkey/verify-authentication", { response });
  if (!verified.response.ok)
    console.warn("Passkey autofill sign-in refused", verified.response.status);
  return verified.response.ok;
}
