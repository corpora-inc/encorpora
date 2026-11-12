import type { FastifyInstance } from "fastify";
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
  options: { pool: Pool; authenticate: Authenticator },
) {
  app.get("/api/v1/account/deletion", async (request) => {
    const account = await options.authenticate(request);
    return previewAccountDeletion(options.pool, account);
  });
  app.post(
    "/api/v1/account/delete",
    {
      bodyLimit: 1024,
      config: { rateLimit: { max: 10, timeWindow: "1 hour" } },
    },
    async (request, reply) => {
      const account = await options.authenticate(request);
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
