import {
  rememberVerifiedProvider,
  sessionMethodAuthority,
} from "./account-authority";
import { google, github, microsoft, apple } from "better-auth/social-providers";
import {
  accountSecurity,
  accountLinkSession,
  serializeSecurityEndpoint,
  SECURITY_FRESH_SECONDS,
} from "./account-security";
import { betterAuth } from "better-auth";
import { bearer, twoFactor } from "better-auth/plugins";
import { fromNodeHeaders } from "better-auth/node";
import { APIError } from "better-auth/api";
import { passkey } from "@better-auth/passkey";
import { passkeySignup, PASSKEY_SIGNUP_SECONDS } from "./passkey-signup";
import { SignJWT, importPKCS8 } from "jose";
import { Resend } from "resend";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { ApiError } from "./repository";
import type { Authenticator } from "./auth";
import { brand, brandTitle } from "../brand";

/** AMP's own parent accounts: users, sessions and linked sign-in methods live
 * in AMP's database (Better Auth). An account id is `amp|<user id>`. */
export const ACCOUNT_PREFIX = "amp|";
export const SOCIAL_PROVIDERS = [
  "google",
  "apple",
  "microsoft",
  "github",
] as const;
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];
/** Set by AMP from the trusted client address; any incoming value is replaced. */
const CLIENT_IP_HEADER = "x-amp-client-ip";

export interface AccountsConfig {
  baseURL: string;
  secret: string;
  production: boolean;
  /** Email and password sign-in; needs mail in production (verify, reset). */
  passwords: boolean;
  mail?: { apiKey: string; from: string };
  trustedOrigins: string[];
  google?: { clientId: string; clientSecret: string };
  microsoft?: { clientId: string; clientSecret: string; tenantId: string };
  github?: { clientId: string; clientSecret: string };
  apple?: {
    clientId: string;
    teamId: string;
    keyId: string;
    privateKey: string;
    bundleId?: string;
  };
}

/** Reads AMP_ACCOUNTS_* and provider settings. A provider is enabled only
 * when all of its settings are present; a partial set is an error. */
export function accountsConfiguration(env: NodeJS.ProcessEnv): AccountsConfig {
  const production = env.NODE_ENV === "production";
  const required = (name: string) => {
    const value = env[name];
    if (!value || value.trim() !== value)
      throw new Error(`Missing or invalid ${name}`);
    return value;
  };
  const baseURL = required("AMP_ACCOUNTS_URL");
  const url = new URL(baseURL);
  const loopback = ["127.0.0.1", "localhost"].includes(url.hostname);
  if (
    url.origin !== baseURL ||
    !(url.protocol === "https:" || (!production && loopback))
  )
    throw new Error(
      "AMP_ACCOUNTS_URL must be an HTTPS origin (loopback HTTP outside production)",
    );
  const secret = required("AMP_ACCOUNTS_SECRET");
  if (secret.length < 32)
    throw new Error("AMP_ACCOUNTS_SECRET must be at least 32 characters");
  const group = <K extends string>(prefix: string, keys: readonly K[]) => {
    const present = keys.filter((k) => env[`${prefix}_${k}`]);
    if (!present.length) return undefined;
    if (present.length !== keys.length)
      throw new Error(
        `${prefix}: set all of ${keys.map((k) => `${prefix}_${k}`).join(", ")}`,
      );
    return Object.fromEntries(
      keys.map((k) => [k, required(`${prefix}_${k}`)]),
    ) as Record<K, string>;
  };
  const mail = group("AMP_MAIL", ["RESEND_API_KEY", "FROM"] as const);
  const google = group("AMP_GOOGLE", ["CLIENT_ID", "CLIENT_SECRET"] as const);
  const github = group("AMP_GITHUB", ["CLIENT_ID", "CLIENT_SECRET"] as const);
  const microsoft = group("AMP_MICROSOFT", [
    "CLIENT_ID",
    "CLIENT_SECRET",
  ] as const);
  const apple = group("AMP_APPLE", [
    "CLIENT_ID",
    "TEAM_ID",
    "KEY_ID",
    "PRIVATE_KEY",
  ] as const);
  return {
    baseURL,
    secret,
    production,
    // Without mail, passwords cannot be verified or reset; in development the
    // links are printed to the server log instead.
    passwords: !!mail || !production,
    ...(mail && {
      mail: { apiKey: mail.RESEND_API_KEY, from: mail.FROM },
    }),
    trustedOrigins: (env.AMP_ACCOUNTS_TRUSTED_ORIGINS ?? "")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
    ...(google && {
      google: {
        clientId: google.CLIENT_ID,
        clientSecret: google.CLIENT_SECRET,
      },
    }),
    ...(github && {
      github: {
        clientId: github.CLIENT_ID,
        clientSecret: github.CLIENT_SECRET,
      },
    }),
    ...(microsoft && {
      microsoft: {
        clientId: microsoft.CLIENT_ID,
        clientSecret: microsoft.CLIENT_SECRET,
        tenantId: env.AMP_MICROSOFT_TENANT_ID ?? "common",
      },
    }),
    ...(apple && {
      apple: {
        clientId: apple.CLIENT_ID,
        teamId: apple.TEAM_ID,
        keyId: apple.KEY_ID,
        privateKey: apple.PRIVATE_KEY.replaceAll("\\n", "\n"),
        ...(env.AMP_APPLE_BUNDLE_ID && { bundleId: env.AMP_APPLE_BUNDLE_ID }),
      },
    }),
  };
}

/** A sign-in provider may create an account only for an email it has
 * verified. Otherwise anyone could pre-create an account under a parent's
 * address (e.g. a Microsoft tenant asserting any email); the parent's later
 * confirmation would hand that account to the attacker's login. Unverified
 * provider logins can still be linked to a signed-in account. */
export function providerSignupRefused(
  user: { emailVerified?: boolean | null },
  path: string | undefined,
) {
  const viaProvider =
    !!path && (path.startsWith("/callback/") || path === "/sign-in/social");
  return viaProvider && !user.emailVerified;
}

/** Thrown when a provider has not verified the email it reports; the sign-in
 * screen explains it from this code. */
export const PROVIDER_EMAIL_UNVERIFIED = "provider_email_unverified";

/** Microsoft's `email` claim is not proof of ownership (the nOAuth class of
 * takeover). It counts as verified only with `xms_edov` (the email domain's
 * owner is verified; true for personal accounts that verified their address)
 * or when it is one of the user's verified addresses. */
export function microsoftEmailVerified(profile: {
  email?: unknown;
  xms_edov?: unknown;
  verified_primary_email?: unknown;
  verified_secondary_email?: unknown;
}) {
  const email = typeof profile.email === "string" ? profile.email : "";
  if (!email) return false;
  const listed = (claim: unknown) =>
    (Array.isArray(claim) ? claim : [claim]).some(
      (value) =>
        typeof value === "string" &&
        value.toLowerCase() === email.toLowerCase(),
    );
  return (
    profile.xms_edov === true ||
    profile.xms_edov === "true" ||
    profile.xms_edov === 1 ||
    profile.xms_edov === "1" ||
    listed(profile.verified_primary_email) ||
    listed(profile.verified_secondary_email)
  );
}

export function enabledProviders(config: AccountsConfig): SocialProvider[] {
  return SOCIAL_PROVIDERS.filter((p) => !!config[p]);
}

/** Apple's client secret is a JWT signed with the team's key, valid for at
 * most six months; it is minted at startup and deploys refresh it. */
async function appleClientSecret(apple: NonNullable<AccountsConfig["apple"]>) {
  const key = await importPKCS8(apple.privateKey, "ES256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: apple.keyId })
    .setIssuer(apple.teamId)
    .setSubject(apple.clientId)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt()
    .setExpirationTime("150d")
    .sign(key);
}

export async function createAccounts(pool: Pool, config: AccountsConfig) {
  const mailer = config.mail && new Resend(config.mail.apiKey);
  async function send(to: string, subject: string, text: string, url: string) {
    if (mailer) {
      const { error } = await mailer.emails.send({
        from: config.mail!.from,
        to,
        subject,
        text: `${text}\n\n${url}\n\n${brandTitle}\n`,
      });
      if (error) throw new Error(`Email not sent: ${error.message}`);
    } else if (!config.production) {
      console.info(`[accounts] email to ${to}: ${subject}\n${url}`);
    } else throw new Error("Email delivery is not configured");
  }
  const { origin, hostname } = new URL(config.baseURL);
  const twoFactorPlugin = twoFactor({
    issuer: brand.name,
    schema: { twoFactor: { modelName: "amp_auth_two_factors" } },
  });
  const protectedTwoFactor = new Set([
    "/two-factor/enable",
    "/two-factor/disable",
    "/two-factor/generate-backup-codes",
    "/two-factor/verify-totp",
  ]);
  for (const [key, endpoint] of Object.entries(twoFactorPlugin.endpoints)) {
    if (protectedTwoFactor.has(endpoint.path))
      Object.assign(twoFactorPlugin.endpoints, {
        [key]: serializeSecurityEndpoint(endpoint),
      });
  }
  const passkeyPlugin = passkey({
    rpID: hostname,
    rpName: brand.name,
    origin,
    schema: { passkey: { modelName: "amp_auth_passkeys" } },
  });
  // A new parent can start with a passkey wherever confirmation email can be
  // delivered (the same condition as passwords).
  const signupPlugin = passkeySignup({
    enabled: config.passwords,
    rpID: hostname,
    rpName: brand.name,
    origin,
  });
  passkeyPlugin.endpoints.verifyPasskeyRegistration = serializeSecurityEndpoint(
    passkeyPlugin.endpoints.verifyPasskeyRegistration,
  );
  passkeyPlugin.endpoints.updatePasskey = serializeSecurityEndpoint(
    passkeyPlugin.endpoints.updatePasskey,
  );
  const appleOptions = config.apple
    ? {
        clientId: config.apple.clientId,
        clientSecret: await appleClientSecret(config.apple),
        ...(config.apple.bundleId && {
          appBundleIdentifier: config.apple.bundleId,
        }),
      }
    : undefined;
  const microsoftOptions = config.microsoft && {
    ...config.microsoft,
    // The profile photo is not used; skip the extra Graph request.
    disableProfilePhoto: true,
    mapProfileToUser: (profile: Record<string, unknown>) => ({
      emailVerified: microsoftEmailVerified(profile),
    }),
  };
  const auth = betterAuth({
    appName: brand.name,
    baseURL: config.baseURL,
    basePath: "/api/auth",
    secret: config.secret,
    database: pool,
    trustedOrigins: [
      ...config.trustedOrigins,
      ...(config.apple ? ["https://appleid.apple.com"] : []),
    ],
    user: { modelName: "amp_auth_users" },
    session: {
      modelName: "amp_auth_sessions",
      freshAge: SECURITY_FRESH_SECONDS,
      additionalFields: {
        ampMethodKind: {
          type: "string",
          required: false,
          input: false,
          returned: false,
        },
        ampMethodId: {
          type: "string",
          required: false,
          input: false,
          returned: false,
        },
        ampMethodProvider: {
          type: "string",
          required: false,
          input: false,
          returned: false,
        },
      },
    },
    verification: { modelName: "amp_auth_verifications" },
    account: {
      modelName: "amp_auth_accounts",
      additionalFields: {
        ampLinkSessionId: {
          type: "string",
          required: false,
          input: false,
          returned: false,
        },
      },
      // A provider identity links to an existing parent only when the
      // provider verified the email and the parent's own address is verified
      // (Better Auth checks both; no provider is "trusted" past that). The
      // account trigger (0023) also refuses identities the parent removed and
      // parents with an authenticator; they link explicitly from Security,
      // where a different email is allowed.
      accountLinking: {
        enabled: true,
        disableImplicitLinking: false,
        requireLocalEmailVerified: true,
        trustedProviders: [],
        allowDifferentEmails: true,
      },
    },
    emailAndPassword: {
      enabled: config.passwords,
      requireEmailVerification: config.production,
      minPasswordLength: 10,
      revokeSessionsOnPasswordReset: true,
      // A reset link proves the address. Before it was confirmed, anyone could
      // have added sign-in methods under it, so they go; the address is confirmed.
      onPasswordReset: async ({ user }) => {
        if (!user.emailVerified) await confirmByReset(pool, user.id);
      },
      sendResetPassword: ({ user, url }) =>
        send(
          user.email,
          `Reset your ${brand.name} password`,
          "Use this link to choose a new password. It expires in one hour. If you did not ask for it, ignore this email.",
          url,
        ),
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session, context) => ({
            data: { ...session, ...(await sessionMethodAuthority(context)) },
          }),
        },
      },
      account: {
        create: {
          before: async (account, context) => {
            const sessionId = await accountLinkSession(account.userId, context);
            if (sessionId)
              return { data: { ...account, ampLinkSessionId: sessionId } };
          },
        },
      },
      user: {
        create: {
          before: async (user, context) => {
            if (providerSignupRefused(user, context?.path))
              throw new APIError("FORBIDDEN", {
                code: PROVIDER_EMAIL_UNVERIFIED,
                message: "The provider has not verified this email address.",
              });
          },
        },
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      // An unconfirmed parent who signs in gets a fresh link (no lockout).
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: ({ user, url }) =>
        send(
          user.email,
          `Confirm your email for ${brand.name}`,
          `Confirm this address for your ${brand.name} parent account. Until it is confirmed, the account cannot buy access or give consent for a learner. If you did not create an ${brand.name} account, ignore this email; nothing happens without your confirmation.`,
          url,
        ),
    },
    socialProviders: {
      ...(config.google && {
        google: {
          ...config.google,
          getUserInfo: rememberVerifiedProvider(google(config.google)),
        },
      }),
      ...(config.github && {
        github: {
          ...config.github,
          getUserInfo: rememberVerifiedProvider(github(config.github)),
        },
      }),
      ...(microsoftOptions && {
        microsoft: {
          ...microsoftOptions,
          getUserInfo: rememberVerifiedProvider(microsoft(microsoftOptions)),
        },
      }),
      ...(appleOptions && {
        apple: {
          ...appleOptions,
          getUserInfo: rememberVerifiedProvider(apple(appleOptions)),
        },
      }),
    },
    plugins: [
      accountSecurity(pool, config),
      bearer(),
      twoFactorPlugin,
      passkeyPlugin,
      signupPlugin,
    ],
    rateLimit: {
      enabled: true,
      storage: "memory",
      // Each attempt says whether an email has an account; keep that slow.
      customRules: {
        "/passkey-signup/options": { window: PASSKEY_SIGNUP_SECONDS, max: 10 },
        "/passkey-signup/verify": { window: PASSKEY_SIGNUP_SECONDS, max: 10 },
      },
    },
    // Internal failures reach clients as a generic 500; log the cause.
    onAPIError: {
      onError: (error) => console.error("[accounts] request failed", error),
    },
    advanced: {
      cookiePrefix: "amp",
      ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
      // Migrations (0016) define the schema; skip the startup catalog scan.
      database: { validateSchema: false },
    },
  });
  return { auth, config };
}
export type Accounts = Awaited<ReturnType<typeof createAccounts>>;

/** A password reset on an unconfirmed parent confirms the address and removes
 * every passkey, provider login and session that predates it, under the parent
 * lock that sign-in also takes. Otherwise whoever created the account under
 * someone else's address would keep a way in after the owner recovers it. */
export async function confirmByReset(pool: Pool, userId: string) {
  const db = await pool.connect();
  let discard = false;
  try {
    await db.query("BEGIN");
    const parent = await db.query<{ emailVerified: boolean }>(
      'SELECT "emailVerified" FROM amp_auth_users WHERE id=$1 FOR UPDATE',
      [userId],
    );
    if (parent.rows[0] && !parent.rows[0].emailVerified) {
      await db.query('DELETE FROM amp_auth_passkeys WHERE "userId"=$1', [
        userId,
      ]);
      await db.query(
        `DELETE FROM amp_auth_accounts WHERE "userId"=$1 AND "providerId"<>'credential'`,
        [userId],
      );
      await db.query('DELETE FROM amp_auth_sessions WHERE "userId"=$1', [
        userId,
      ]);
      await db.query(
        'UPDATE amp_auth_users SET "emailVerified"=true, "updatedAt"=now() WHERE id=$1',
        [userId],
      );
    }
    await db.query("COMMIT");
  } catch (error) {
    try {
      await db.query("ROLLBACK");
    } catch {
      discard = true;
    }
    throw error;
  } finally {
    db.release(discard);
  }
}

/** Resolves a request's session (cookie, or `Authorization: Bearer <session
 * token>`) to its parent account id. */
export function accountsAuth({ auth }: Accounts): Authenticator {
  return async (request) => {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });
    if (!session) throw new ApiError(401, "Sign in to continue");
    return `${ACCOUNT_PREFIX}${session.user.id}`;
  };
}

/** Mounts the account endpoints under /api/auth. Bodies are forwarded raw:
 * Apple posts its callback as a form, which Fastify does not parse. */
export async function registerAccountRoutes(
  app: FastifyInstance,
  { auth, config }: Accounts,
) {
  // Tells the browser which sign-in methods this deployment offers.
  app.get("/api/v1/auth-config", async () => ({
    mode: "accounts",
    passwords: config.passwords,
    passkeySignup: config.passwords,
    providers: enabledProviders(config),
  }));
  await app.register(async (scope) => {
    scope.removeAllContentTypeParsers();
    scope.addContentTypeParser(
      "*",
      { parseAs: "buffer" },
      (_request, body, done) => done(null, body),
    );
    scope.route({
      method: ["GET", "POST"],
      url: "/api/auth/*",
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
      handler: async (request, reply) => {
        const headers = fromNodeHeaders(request.headers);
        headers.set(CLIENT_IP_HEADER, request.ip);
        const body =
          request.method === "GET" ? undefined : (request.body as Buffer);
        // Only the path and query are taken from the request line.
        const { pathname, search } = new URL(request.url, "http://local");
        const response = await auth.handler(
          new Request(new URL(pathname + search, config.baseURL), {
            method: request.method,
            headers,
            ...(body?.length ? { body: new Uint8Array(body) } : {}),
          }),
        );
        reply.status(response.status);
        response.headers.forEach((value, key) => {
          if (key !== "set-cookie" && key !== "content-length")
            reply.header(key, value);
        });
        const cookies = response.headers.getSetCookie();
        if (cookies.length) reply.header("set-cookie", cookies);
        return reply.send(
          response.body ? Buffer.from(await response.arrayBuffer()) : null,
        );
      },
    });
  });
}
