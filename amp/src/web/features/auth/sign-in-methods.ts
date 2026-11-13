import { isProvider, providerNames, type Provider } from "./ProviderButtons";

export type SignInMethod = Provider | "passkey" | "password";

/** How an address signs in (`[]`: no account), from the server's
 * rate-limited lookup. `null` when the answer is unavailable (limited,
 * offline); the screen then keeps its ordinary path. */
export async function lookUpSignInMethods(
  email: string,
): Promise<SignInMethod[] | null> {
  try {
    const response = await fetch("/api/auth/sign-in-methods", {
      method: "POST",
      credentials: "same-origin",
      signal: AbortSignal.timeout(8000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (response.status === 429) {
      // Expected where many people share an address; the ordinary path stays.
      console.warn("Sign-in method lookup rate-limited");
      return null;
    }
    if (!response.ok) {
      console.error("Sign-in method lookup failed", response.status);
      return null;
    }
    const data = (await response.json()) as { methods?: unknown };
    if (!Array.isArray(data.methods)) {
      console.error("Sign-in method lookup returned no methods");
      return null;
    }
    return data.methods.filter(
      (m): m is SignInMethod =>
        isProvider(m) || m === "passkey" || m === "password",
    );
  } catch (error) {
    console.error("Sign-in method lookup failed", error);
    return null;
  }
}

/** "Google", "Google or a passkey", "Google, Apple, or a passkey". */
export function methodList(methods: readonly SignInMethod[]) {
  const names = methods.map((m) =>
    m === "passkey"
      ? "a passkey"
      : m === "password"
        ? "a password"
        : providerNames[m],
  );
  return names.length <= 2
    ? names.join(" or ")
    : `${names.slice(0, -1).join(", ")}, or ${names.at(-1)}`;
}
