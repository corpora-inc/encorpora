import type { Pool } from "pg";
import {
  APIError,
  createAuthEndpoint,
  createAuthMiddleware,
  freshSessionMiddleware,
  getSessionFromCtx,
  sessionMiddleware,
} from "better-auth/api";
import { z } from "zod";
import type { AccountsConfig } from "./accounts";

export const SECURITY_FRESH_SECONDS = 5 * 60;
const providers = ["google", "apple", "microsoft", "github"] as const;

/** All method removals use one parent-row lock. Counting and deleting in the
 * same transaction prevents concurrent removals from stranding an account. */
export function accountSecurity(pool: Pool, config: AccountsConfig) {
  const enabled = providers.filter((provider) => !!config[provider]);
  const usable = `(("providerId" = 'credential' AND "password" IS NOT NULL AND $2::boolean)
    OR "providerId" = ANY($3::text[]))`;
  async function remove(
    userId: string,
    kind: "account" | "passkey",
    id: string,
  ) {
    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      await db.query("SELECT id FROM amp_auth_users WHERE id=$1 FOR UPDATE", [
        userId,
      ]);
      const table =
        kind === "account" ? "amp_auth_accounts" : "amp_auth_passkeys";
      const target = await db.query(
        `SELECT id FROM ${table} WHERE id=$1 AND "userId"=$2`,
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
        [userId, config.passwords, enabled, kind, id],
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
      await db.query("COMMIT");
      return { status: true };
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    } finally {
      db.release();
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
            const session = await getSessionFromCtx(ctx, {
              disableCookieCache: true,
            });
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
            if (ctx.path === "/change-password")
              ctx.body.revokeOtherSessions = true;
            if (
              ctx.path === "/passkey/update-passkey" &&
              typeof ctx.body.name === "string" &&
              ctx.body.name.trim().length > 80
            )
              throw new APIError("BAD_REQUEST", {
                message: "Use a name of at most 80 characters.",
              });
          }),
        },
      ],
    },
    endpoints: {
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
            await remove(ctx.context.session.user.id, "account", ctx.body.id),
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
            await remove(ctx.context.session.user.id, "passkey", ctx.body.id),
          ),
      ),
    },
  };
}
