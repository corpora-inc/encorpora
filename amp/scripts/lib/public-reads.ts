/** What a signed-out or just-signed-in screen reads before anything is
 * under test: which programs invoice and the plans' prices (the pitch's Buy, none here) and the
 * sign-in configuration (sign-up and sign-in). Mocked fixtures answer these
 * the way a local server does. `path` is under `/api/v1`. */
export function publicRead(path: string): object | undefined {
  if (path === "/funding/invoice-offers") return { offers: [] };
  // The pitch's prices, unavailable here (it then names no price).
  if (path === "/billing/prices") return { available: false, offers: [] };
  if (path === "/auth-config")
    return {
      mode: "accounts",
      passwords: true,
      passkeySignup: true,
      parentFollowup: true,
      providers: ["google"],
    };
  return undefined;
}
