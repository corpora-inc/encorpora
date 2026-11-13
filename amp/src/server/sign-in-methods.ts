import type { Pool } from "pg";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { z } from "zod";

/** The ways a parent can sign in, in the order they are named to them. */
export const SIGN_IN_METHODS = [
  "google",
  "apple",
  "microsoft",
  "github",
  "passkey",
  "password",
] as const;
export type SignInMethod = (typeof SIGN_IN_METHODS)[number];

const spoken: Record<SignInMethod, string> = {
  google: "Google",
  apple: "Apple",
  microsoft: "Microsoft",
  github: "GitHub",
  passkey: "a passkey",
  password: "a password",
};

/**
 * The sign-in methods that work for an account in this deployment: each
 * enabled provider it has linked, a passkey, and a password only when one is
 * set and passwords are on. `null` when no account uses the address.
 */
export async function accountSignInMethods(
  pool: Pool,
  by: { userId: string } | { email: string },
  enabled: { providers: readonly string[]; passwords: boolean },
): Promise<SignInMethod[] | null> {
  const { rows } = await pool.query<{
    providers: string[];
    password: boolean;
    passkey: boolean;
  }>(
    `SELECT
       ARRAY(SELECT DISTINCT a."providerId" FROM amp_auth_accounts a
             WHERE a."userId"=u.id AND a."providerId"<>'credential') AS providers,
       EXISTS(SELECT 1 FROM amp_auth_accounts a WHERE a."userId"=u.id
              AND a."providerId"='credential' AND a.password IS NOT NULL
              AND a.password<>'') AS password,
       EXISTS(SELECT 1 FROM amp_auth_passkeys p WHERE p."userId"=u.id) AS passkey
     FROM amp_auth_users u
     WHERE ${"userId" in by ? "u.id=$1" : "u.email=$1"}`,
    ["userId" in by ? by.userId : by.email.trim().toLowerCase()],
  );
  const account = rows[0];
  if (!account) return null;
  return SIGN_IN_METHODS.filter((method) =>
    method === "password"
      ? account.password && enabled.passwords
      : method === "passkey"
        ? account.passkey
        : account.providers.includes(method) &&
          enabled.providers.includes(method),
  );
}

/** "Google", "Google or a passkey", "Google, a passkey, or a password". */
export function methodList(methods: readonly SignInMethod[]) {
  const names = methods.map((m) => spoken[m]);
  return names.length <= 2
    ? names.join(" or ")
    : `${names.slice(0, -1).join(", ")}, or ${names.at(-1)}`;
}

const RETURN_PATHS: Record<string, string> = {
  "/access": "access",
  "/family/security": "security",
};
const SAFE_VALUE = /^[a-z0-9-]{1,40}$/;

/**
 * The sign-in page, carrying where the parent was headed. `from` is the
 * same-origin callback the screen sent (a continuation such as `/access`, or
 * `/reset-password?return=access`); anything else yields the plain page. The
 * screen re-validates every carried value.
 */
export function signInLink(baseURL: string, from?: unknown, path = "/sign-in") {
  const link = new URL(path, baseURL);
  if (typeof from !== "string" || from.length > 2048) return link.href;
  let target: URL;
  try {
    target = new URL(from, baseURL);
  } catch {
    return link.href;
  }
  if (target.origin !== link.origin) return link.href;
  const carried = {
    return: target.searchParams.get("return") ?? RETURN_PATHS[target.pathname],
    program: target.searchParams.get("program"),
    entry: target.searchParams.get("entry"),
  };
  for (const [key, value] of Object.entries(carried))
    if (value && SAFE_VALUE.test(value)) link.searchParams.set(key, value);
  return link.href;
}

/** The email to an account's owner when someone tries to create an account
 * with its address: how it signs in, and a password reset only when it has a
 * password. */
export function existingAccountEmail(
  brandName: string,
  methods: readonly SignInMethod[],
  links: { signIn: string; forgot: string },
) {
  const how = methods.length
    ? `It signs in with ${methodList(methods)}.`
    : "Choose Forgot password? on the sign-in page to set a password for it.";
  return {
    subject: `You already have an ${brandName} account`,
    text: [
      `You already have an ${brandName} account. ${how}`,
      `Someone tried to create a new ${brandName} account with this address. If that was not you, ignore this email; nothing changed.`,
      ...(methods.includes("password") || !methods.length
        ? [`Forgot your password? Choose a new one here:\n${links.forgot}`]
        : []),
      "Sign in:",
    ].join("\n\n"),
    url: links.signIn,
  };
}

/** The password-reset email. An account without a password is told how it
 * signs in; the reset link is offered only as a way to add a password. */
export function resetPasswordEmail(
  brandName: string,
  methods: readonly SignInMethod[] | null,
  signIn: string,
) {
  const others = (methods ?? []).filter((m) => m !== "password");
  if (methods?.includes("password") || !others.length)
    return {
      subject: `Reset your ${brandName} password`,
      text: "Use this link to choose a new password. It expires in one hour. If you did not ask for it, ignore this email.",
    };
  return {
    subject: `Sign in to ${brandName}`,
    text: [
      `Your account signs in with ${methodList(others)}. Sign in here:\n${signIn}`,
      "Or add a password with this link. It expires in one hour. If you did not ask for it, ignore this email.",
    ].join("\n\n"),
  };
}

/**
 * `POST /sign-in-methods {email}` → `{methods}`: how an address signs in, so
 * the sign-in screen can offer the one action that will work instead of a
 * password form that cannot. It says no more than the passkey sign-up check
 * already does (whether an address has an account) and shares its rate limit.
 */
export function signInMethodLookup(
  pool: Pool,
  enabled: { providers: readonly string[]; passwords: boolean },
) {
  return {
    id: "amp-sign-in-methods",
    endpoints: {
      signInMethods: createAuthEndpoint(
        "/sign-in-methods",
        { method: "POST", body: z.object({ email: z.string().max(254) }) },
        async (ctx) => {
          if (!enabled.passwords)
            throw new APIError("NOT_FOUND", {
              code: "SIGN_IN_METHODS_UNAVAILABLE",
              message: "Choose a way to sign in.",
            });
          const email = ctx.body.email.trim().toLowerCase();
          if (!z.email().safeParse(email).success)
            throw new APIError("BAD_REQUEST", {
              code: "INVALID_EMAIL",
              message: "Enter a complete email address.",
            });
          const methods = await accountSignInMethods(pool, { email }, enabled);
          return ctx.json({ methods: methods ?? [] });
        },
      ),
    },
  };
}
