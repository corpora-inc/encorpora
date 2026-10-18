import { betterAuth } from "better-auth";
import { bearer, twoFactor } from "better-auth/plugins";
import { fromNodeHeaders } from "better-auth/node";
import { passkey } from "@better-auth/passkey";
import { SignJWT, importPKCS8 } from "jose";
import { Resend } from "resend";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { ApiError } from "./repository";
import type { Authenticator } from "./auth";

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
        text: `${text}\n\n${url}\n`,
      });
      if (error) throw new Error(`Email not sent: ${error.message}`);
    } else if (!config.production) {
      console.info(`[accounts] email to ${to}: ${subject}\n${url}`);
    } else throw new Error("Email delivery is not configured");
  }
  const { origin, hostname } = new URL(config.baseURL);
  const auth = betterAuth({
    appName: "AMP",
    baseURL: config.baseURL,
    basePath: "/api/auth",
    secret: config.secret,
    database: pool,
    trustedOrigins: [
      ...config.trustedOrigins,
      ...(config.apple ? ["https://appleid.apple.com"] : []),
    ],
    user: { modelName: "amp_auth_users" },
    session: { modelName: "amp_auth_sessions" },
    verification: { modelName: "amp_auth_verifications" },
    account: {
      modelName: "amp_auth_accounts",
      // Same-email sign-ins link only when the provider verified the email;
      // a signed-in parent may link a login with a different email.
      accountLinking: { enabled: true, allowDifferentEmails: true },
    },
    emailAndPassword: {
      enabled: config.passwords,
      requireEmailVerification: config.production,
      minPasswordLength: 10,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: ({ user, url }) =>
        send(
          user.email,
          "Reset your AMP password",
          "Use this link to choose a new password. It expires in one hour. If you did not ask for it, ignore this email.",
          url,
        ),
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user, context) => {
            if (providerSignupRefused(user, context?.path)) return false;
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
          "Confirm your email for AMP",
          "Confirm this address to finish creating your AMP parent account. If you did not create an AMP account, ignore this email; nothing happens without your confirmation.",
          url,
        ),
    },
    socialProviders: {
      ...(config.google && { google: config.google }),
      ...(config.github && { github: config.github }),
      ...(config.microsoft && { microsoft: config.microsoft }),
      ...(config.apple && {
        apple: {
          clientId: config.apple.clientId,
          clientSecret: await appleClientSecret(config.apple),
          ...(config.apple.bundleId && {
            appBundleIdentifier: config.apple.bundleId,
          }),
        },
      }),
    },
    plugins: [
      bearer(),
      twoFactor({
        issuer: "AMP",
        schema: { twoFactor: { modelName: "amp_auth_two_factors" } },
      }),
      passkey({
        rpID: hostname,
        rpName: "AMP",
        origin,
        schema: { passkey: { modelName: "amp_auth_passkeys" } },
      }),
    ],
    rateLimit: { enabled: true, storage: "memory" },
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
