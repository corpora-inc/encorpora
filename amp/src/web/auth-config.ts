import { measureAuth } from "./lib/auth-measurement";

/** How this deployment signs parents in, as the API reports it. */
export type AuthConfig =
  | {
      mode: "accounts";
      passwords: boolean;
      /** A new parent can create the account with a passkey. */
      passkeySignup?: boolean;
      parentFollowup?: boolean;
      providers: string[];
      clever?: boolean;
    }
  | { mode: "oidc" | "development" | "native" };

let config: Promise<AuthConfig> | null = null;
/** The API's answer, asked once per page and shared by the light home entry
 * (`home-entry.tsx`) and the app (`auth.ts`), so the home document's preload
 * of it is used once. A failed lookup is not remembered: the next call asks
 * again. */
export function fetchAuthConfig(): Promise<AuthConfig> {
  const asked = (config ??= measureAuth("configuration", async () => {
    const response = await fetch("/api/v1/auth-config", {
      signal: AbortSignal.timeout(10000),
    });
    if (response.ok) return response.json() as Promise<AuthConfig>;
    throw new Error(`auth-config ${response.status}`);
  }));
  asked.catch(() => {
    if (config === asked) config = null;
  });
  return asked;
}
