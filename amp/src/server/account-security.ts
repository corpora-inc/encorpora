import type { Pool } from "pg";
import type { Endpoint } from "better-call";
import type { AuthContext } from "@better-auth/core";
import {
  getCurrentAdapter,
  runWithTransaction,
} from "@better-auth/core/context";
import { bearer } from "better-auth/plugins";
import {
  APIError,
  changePassword,
  createAuthEndpoint,
  createAuthMiddleware,
  freshSessionMiddleware,
  getSessionFromCtx,
  addOAuthServerContext,
  getOAuthState,
  sessionMiddleware,
} from "better-auth/api";
import { z } from "zod";
import type { AccountsConfig } from "./accounts";

export const SECURITY_FRESH_SECONDS = 5 * 60;
const providers = ["google", "apple", "microsoft", "github"] as const;

/** Serialize session-authorized changes for one parent through the original
 * library handler. A no-op parent update acquires the same row lock as removal.
 * All library writes (including session rotation) share this transaction. */
export function serializeSecurityEndpoint<E extends Endpoint>(endpoint: E): E {
  const wrapped = async (ctx: Parameters<E>[0]) => {
    const session = await getSessionFromCtx(ctx, { disableCookieCache: true });
    // TOTP sign-in challenges have no authenticated session; the library owns
    // their single-use proof. Enrollment verification does have a session.
    if (!session && endpoint.path === "/two-factor/verify-totp")
      return endpoint(ctx);
    if (!session)
      throw new APIError("UNAUTHORIZED", { message: "Sign in to continue." });
    const adapter: AuthContext["adapter"] = ctx.context.adapter;
    return runWithTransaction(adapter, async () => {
      const transaction = await getCurrentAdapter(adapter);
      await transaction.update({
        model: "user",
        where: [{ field: "id", value: session.user.id }],
        update: { id: session.user.id },
      });
      const live = await transaction.update<{
        id: string;
        userId: string;
        createdAt: Date;
        expiresAt: Date;
      }>({
        model: "session",
        where: [
          { field: "id", value: session.session.id },
          { field: "userId", value: session.user.id },
        ],
        update: { id: session.session.id },
      });
      if (
        !live ||
        new Date(live.expiresAt).getTime() <= Date.now() ||
        Date.now() - new Date(live.createdAt).getTime() >=
          SECURITY_FRESH_SECONDS * 1000
      )
        throw new APIError("FORBIDDEN", {
          code: "SESSION_NOT_FRESH",
          message: "Sign in again before changing security settings.",
        });
      return endpoint({
        ...ctx,
        context: { ...ctx.context, adapter: transaction },
      });
    });
  };
  return Object.assign(wrapped, {
    path: endpoint.path,
    options: endpoint.options,
  }) as E;
}

/** Read only library-owned request context, never client additionalData. */
export async function accountLinkSession(
  userId: string,
  context: {
    path?: string;
    context: {
      session?: { user: { id: string }; session: { id: string } } | null;
    };
  } | null,
) {
  if (context?.path === "/link-social") {
    const session = context.context.session;
    if (!session || session.user.id !== userId)
      throw new APIError("FORBIDDEN", {
        message: "Sign in again before linking an account.",
      });
    return session.session.id;
  }
  const state = await getOAuthState();
  if (!state?.link) return undefined;
  const sessionId = state.serverContext?.ampLinkSessionId;
  if (state.link.userId !== userId || typeof sessionId !== "string")
    throw new APIError("FORBIDDEN", {
      message: "Sign in again before linking an account.",
    });
  return sessionId;
}

/** All method removals use one parent-row lock. Counting and deleting in the
 * same transaction prevents concurrent removals from stranding an account. */
export function accountSecurity(pool: Pool, config: AccountsConfig) {
  const enabled = providers.filter((provider) => !!config[provider]);
  const usable = `(("providerId" = 'credential' AND "password" IS NOT NULL AND "password" <> '' AND $2::boolean)
    OR "providerId" = ANY($3::text[]))`;
  async function remove(
    userId: string,
    kind: "account" | "passkey",
    id: string,
    sessionId: string,
  ) {
    const db = await pool.connect();
    let discard = false;
    try {
      await db.query("BEGIN");
      const parent = await db.query<{ emailVerified: boolean }>(
        'SELECT "emailVerified" FROM amp_auth_users WHERE id=$1 FOR UPDATE',
        [userId],
      );
      const authority = await db.query(
        `SELECT id FROM amp_auth_sessions WHERE id=$1 AND "userId"=$2
          AND "expiresAt">clock_timestamp() AND "createdAt">clock_timestamp()-interval '5 minutes' FOR KEY SHARE`,
        [sessionId, userId],
      );
      if (!authority.rowCount)
        throw new APIError("FORBIDDEN", {
          code: "SESSION_NOT_FRESH",
          message: "Sign in again before changing security settings.",
        });
      const table =
        kind === "account" ? "amp_auth_accounts" : "amp_auth_passkeys";
      const target = await db.query(
        `SELECT id FROM ${table} WHERE id=$1 AND "userId"=$2 ${kind === "account" ? "AND \"providerId\" <> 'credential'" : ""}`,
        [id, userId],
      );
      if (!target.rowCount)
        throw new APIError("NOT_FOUND", {
          code: "METHOD_NOT_FOUND",
          message: "This sign-in method was not found.",
        });
      const remaining = await db.query<{ count: number }>(
        `SELECT (
        (SELECT count(*) FROM amp_auth_accounts WHERE "userId"=$1 AND ${usable} AND NOT ($4='account' AND id=$5)) +
        (SELECT count(*) FROM amp_auth_passkeys WHERE "userId"=$1 AND NOT ($4='passkey' AND id=$5))
      )::integer AS count`,
        [
          userId,
          config.passwords &&
            (!config.production || parent.rows[0]?.emailVerified === true),
          enabled,
          kind,
          id,
        ],
      );
      if (!remaining.rows[0].count)
        throw new APIError("BAD_REQUEST", {
          code: "LAST_SIGN_IN_METHOD",
          message:
            "Add another available sign-in method before removing this one.",
        });
      await db.query(`DELETE FROM ${table} WHERE id=$1 AND "userId"=$2`, [
        id,
        userId,
      ]);
      await db.query(
        'DELETE FROM amp_auth_sessions WHERE "userId"=$1 AND id<>$2',
        [userId, sessionId],
      );
      // Only this reserved identifier prefix contains library-generated JSON
      // OAuth state. Other verification values are deliberately not cast.
      await db.query(
        `DELETE FROM amp_auth_verifications WHERE id IN (
        SELECT id FROM (SELECT id, value FROM amp_auth_verifications WHERE identifier LIKE 'auth-state:%') AS pending
        WHERE (value::jsonb #>> '{link,userId}')=$1
      )`,
        [userId],
      );
      await db.query("COMMIT");
      return { status: true };
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
  const sensitive = new Set([
    "/link-social",
    "/change-password",
    "/passkey/generate-register-options",
    "/passkey/verify-registration",
    "/passkey/update-passkey",
    "/two-factor/enable",
    "/two-factor/disable",
    "/two-factor/generate-backup-codes",
    "/two-factor/get-totp-uri",
  ]);
  return {
    id: "amp-account-security",
    hooks: {
      before: [
        {
          matcher: (ctx: { path?: string }) =>
            !!ctx.path &&
            (sensitive.has(ctx.path) ||
              ["/unlink-account", "/passkey/delete-passkey"].includes(
                ctx.path,
              )),
          handler: createAuthMiddleware(async (ctx) => {
            // The library's separate removals cannot enforce a cross-method lock.
            if (
              ctx.path === "/unlink-account" ||
              ctx.path === "/passkey/delete-passkey"
            )
              throw new APIError("FORBIDDEN", {
                code: "USE_SECURITY_SETTINGS",
                message:
                  "Remove sign-in methods through account security settings.",
              });
            // Before-hook context patches are applied only after all hooks.
            // Reuse the library converter so bearer callers see the same session.
            const converted = await bearer().hooks.before[0].handler({
              ...ctx,
              returnHeaders: false,
            });
            const session = await getSessionFromCtx(
              { ...ctx, headers: converted?.context?.headers ?? ctx.headers },
              {
                disableCookieCache: true,
              },
            );
            if (!session)
              throw new APIError("UNAUTHORIZED", {
                message: "Sign in to continue.",
              });
            if (
              Date.now() - new Date(session.session.createdAt).getTime() >=
              SECURITY_FRESH_SECONDS * 1000
            )
              throw new APIError("FORBIDDEN", {
                code: "SESSION_NOT_FRESH",
                message: "Sign in again before changing security settings.",
              });
            if (ctx.path === "/link-social")
              await addOAuthServerContext({
                ampLinkSessionId: session.session.id,
              });
            if (ctx.path === "/change-password" && ctx.body)
              ctx.body.revokeOtherSessions = true;
            if (
              ctx.path?.startsWith("/passkey/") &&
              typeof (ctx.body?.name ?? ctx.query?.name) === "string" &&
              (ctx.body?.name ?? ctx.query?.name).trim().length > 80
            )
              throw new APIError("BAD_REQUEST", {
                message: "Use a name of at most 80 characters.",
              });
          }),
        },
      ],
    },
    endpoints: {
      changePassword: serializeSecurityEndpoint(changePassword),
      securitySummary: createAuthEndpoint(
        "/security/summary",
        { method: "GET", use: [sessionMiddleware] },
        async (ctx) => {
          const { user, session } = ctx.context.session;
          const accounts = await pool.query<{
            id: string;
            providerId: string;
            hasPassword: boolean;
          }>(
            'SELECT id, "providerId", (password IS NOT NULL) AS "hasPassword" FROM amp_auth_accounts WHERE "userId"=$1 ORDER BY "createdAt", id',
            [user.id],
          );
          const passkeys = await pool.query<{
            id: string;
            name: string | null;
            createdAt: Date;
          }>(
            'SELECT id, name, "createdAt" FROM amp_auth_passkeys WHERE "userId"=$1 ORDER BY "createdAt", id',
            [user.id],
          );
          return ctx.json({
            email: user.email,
            passwords: config.passwords,
            hasPassword: accounts.rows.some(
              (a) => a.providerId === "credential" && a.hasPassword,
            ),
            twoFactorEnabled: !!(
              user as typeof user & { twoFactorEnabled?: boolean }
            ).twoFactorEnabled,
            freshUntil: new Date(
              new Date(session.createdAt).getTime() +
                SECURITY_FRESH_SECONDS * 1000,
            ).toISOString(),
            providers: enabled,
            accounts: accounts.rows
              .filter((a) => a.providerId !== "credential")
              .map((a) => ({
                id: a.id,
                provider: a.providerId,
                available: enabled.includes(
                  a.providerId as (typeof enabled)[number],
                ),
              })),
            passkeys: passkeys.rows,
          });
        },
      ),
      securityUnlinkAccount: createAuthEndpoint(
        "/security/unlink-account",
        {
          method: "POST",
          body: z.object({ id: z.string().min(1).max(200) }),
          use: [freshSessionMiddleware],
        },
        async (ctx) =>
          ctx.json(
            await remove(
              ctx.context.session.user.id,
              "account",
              ctx.body.id,
              ctx.context.session.session.id,
            ),
          ),
      ),
      securityDeletePasskey: createAuthEndpoint(
        "/security/delete-passkey",
        {
          method: "POST",
          body: z.object({ id: z.string().min(1).max(200) }),
          use: [freshSessionMiddleware],
        },
        async (ctx) =>
          ctx.json(
            await remove(
              ctx.context.session.user.id,
              "passkey",
              ctx.body.id,
              ctx.context.session.session.id,
            ),
          ),
      ),
    },
  };
}
