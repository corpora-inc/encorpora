import { requestFetch } from "./lib/request-transport";
import { createAuthClient } from "better-auth/client";
import { twoFactorClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";

/** Browser client for AMP's own parent accounts (same origin, /api/auth). */
export const accountClient = createAuthClient({
  basePath: "/api/auth",
  fetchOptions: {
    customFetchImpl: (input, init) => {
      const url = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
        window.location.origin,
      );
      // Sign-out must remain available even when /me cannot confirm renewal.
      return url.pathname === "/api/auth/sign-out"
        ? fetch(input, init)
        : requestFetch(input, init);
    },
  },
  plugins: [twoFactorClient(), passkeyClient()],
});
