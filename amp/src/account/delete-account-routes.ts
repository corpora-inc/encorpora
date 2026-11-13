import { fromNodeHeaders } from "better-auth/node";
import { ACCOUNT_PREFIX, type Accounts } from "../server/accounts.js";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { SchoolError } from "../schools/contracts.js";
import type { Authenticator } from "../server/auth.js";
import {
  AccountDeletionError,
  deleteAccount,
  previewAccountDeletion,
} from "./delete-account.js";
import { deleteAccountSchema } from "./deletion-contracts.js";

/** "Delete my account" (src/account/delete-account.ts): what goes, then the
 * deletion itself. A student session never reaches either: `authenticate`
 * refuses student tokens. */
export async function registerDeleteAccountRoutes(
  app: FastifyInstance,
  options: { pool: Pool; authenticate: Authenticator; accounts?: Accounts },
) {
  // Read the authenticated session itself, never an account-wide timestamp or
  // updatedAt (ordinary session refreshes do not prove a new sign-in).
  const freshForMs = async (request: FastifyRequest, account: string) => {
    const result = await options.accounts?.auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
      query: { disableCookieCache: true, disableRefresh: true },
    });
    if (!result || `${ACCOUNT_PREFIX}${result.user.id}` !== account) return 0;
    const age = Date.now() - new Date(result.session.createdAt).getTime();
    return Number.isFinite(age) && age >= 0
      ? Math.max(0, 10 * 60_000 - age)
      : 0;
  };
  // Place names, family composition, practice counts and billing status are
  // sensitive, so the preview requires the same recent sign-in as deletion.
  app.get("/api/v1/account/deletion", async (request, reply) => {
    const account = await options.authenticate(request);
    const remaining = await freshForMs(request, account);
    if (!remaining) return reply.code(403).send({ error: "reauth_required" });
    return {
      ...(await previewAccountDeletion(options.pool, account)),
      freshForMs: remaining,
    };
  });
  app.post(
    "/api/v1/account/delete",
    {
      bodyLimit: 1024,
      config: { rateLimit: { max: 10, timeWindow: "1 hour" } },
    },
    async (request, reply) => {
      const account = await options.authenticate(request);
      if (!(await freshForMs(request, account)))
        return reply.code(403).send({ error: "reauth_required" });
      deleteAccountSchema.parse(request.body);
      try {
        const result = await deleteAccount(options.pool, {
          accountId: account,
          via: "self",
          commit: true,
        });
        // Counts only: no name, address or id beyond what the journal keeps.
        request.log.info(
          { accountDeleted: Object.keys(result.counts).length },
          "account deleted",
        );
        return { deleted: true as const };
      } catch (error) {
        if (error instanceof AccountDeletionError) {
          request.log.warn(
            { deletionRefused: error.code },
            "account deletion refused",
          );
          return reply
            .code(error.statusCode)
            .send({ error: error.code, blockers: error.blockers });
        }
        // A place that couldn't be removed whole (records shared with another
        // school, a school learner's order): nothing was deleted.
        if (error instanceof SchoolError) {
          request.log.warn(
            { deletionRefused: error.code },
            "account deletion refused",
          );
          return reply.code(409).send({ error: error.code });
        }
        throw error;
      }
    },
  );
}
