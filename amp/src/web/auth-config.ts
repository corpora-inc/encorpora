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
      /** Clever's page where a district adds AMP, when configured. */
      cleverDistrictSignupUrl?: string;
    }
  | { mode: "oidc" | "development" | "native" };

let config: Promise<AuthConfig> | null = null;
let known: AuthConfig | undefined;
/** The API's answer once it has arrived, read without waiting: a screen that
 * paints after the boot's session check (which reads it) knows it at once. */
export const knownAuthConfig = () => known;
/** The API's answer, asked once per page and shared by the light home entry
 * (`home-entry.tsx`) and the app (`auth.ts`), so the home document's preload
 * of it is used once. A failed lookup is not remembered: the next call asks
 * again. */
export function fetchAuthConfig(): Promise<AuthConfig> {
  const asked = (config ??= measureAuth("configuration", async () => {
    const response = await fetch("/api/v1/auth-config", {
      signal: AbortSignal.timeout(10000),
    });
    if (response.ok) {
      const answer = (await response.json()) as AuthConfig;
      known = answer;
      return answer;
    }
    throw new Error(`auth-config ${response.status}`);
  }));
  asked.catch((error: unknown) => {
    // Its callers show the failure; this only lets the next call ask again.
    console.warn("AMP: the sign-in configuration wasn’t read", error);
    if (config === asked) config = null;
  });
  return asked;
}
