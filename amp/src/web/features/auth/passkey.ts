import {
  browserSupportsWebAuthn,
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
  freePractice?: { program?: "ar-efa" | "az-esa" },
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
    console.warn("Passkey registration did not finish");
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
  const verified = await post("/passkey-signup/verify", {
    response,
    ...(freePractice
      ? { freePractice: true, program: freePractice.program }
      : {}),
  });
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
