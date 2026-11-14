import { storedAdoptionSnapshot } from "./clever/store.js";
import { forgedPost } from "./request-origin.js";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import { refuseStudentTokens, type Authenticator } from "../server/auth.js";
import { SchoolError } from "./contracts.js";
import { type Snapshot, type User, CleverSyncError } from "./clever/model.js";
import {
  adoptionCleverRequest,
  adoptionAcceptRequest,
  adoptionRequest,
  adoptionReviewRequest,
} from "./adoption-contracts.js";
import {
  acceptSchoolAdoption,
  issueSchoolAdoption,
  reviewSchoolAdoption,
  revokeSchoolAdoption,
  schoolAdoptionDistrict,
  schoolAdoptionOptions,
  schoolAdoptionCleverSource,
  schoolAdoptionAuthority,
  schoolAdoptionCleverPreview,
} from "./adoption.js";

/** Tokens travel only in POST bodies. Never include bodies, token hashes,
 * names, exception messages or database row details in diagnostics. */
export async function registerSchoolAdoptionRoutes(
  app: FastifyInstance,
  options: {
    pool: Pool;
    authenticate: Authenticator;
    origin?: string;
    /** The link secret: approval links derive from it, so they can be read
     * again by the school that issued them. */
    secret?: string;
    cleverUser?: (connectionId: string, userId: string) => Promise<User>;
  },
) {
  const authenticate = refuseStudentTokens(options.authenticate);
  await app.register(async (scope) => {
    scope.addHook("onRequest", async (request, reply) => {
      reply
        .header("Cache-Control", "no-store")
        .header("Referrer-Policy", "no-referrer");

      if (forgedPost(request, options.origin, true)) {
        request.log.warn(
          { origin: request.headers.origin ?? null, url: request.url },
          "Adoption request refused: origin",
        );
        throw new SchoolError(403, "request_origin_invalid");
      }
    });
    scope.setErrorHandler((error, request, reply) => {
      if (error instanceof SchoolError)
        return reply.code(error.statusCode).send({ error: error.code });
      if (error instanceof z.ZodError)
        return reply.code(400).send({ error: "invalid_school_request" });
      if (error instanceof CleverSyncError) {
        const status = /authority/.test(error.code)
          ? 403
          : /not_found/.test(error.code)
            ? 404
            : 409;
        return reply.code(status).send({ error: error.code });
      }
      const status = Number((error as { statusCode?: number }).statusCode);
      if (status === 401 || status === 403)
        return reply.code(status).send({ error: "sign_in_required" });
      if (status === 429)
        return reply.code(429).send({ error: "too_many_requests" });
      request.log.error(
        { route: request.routeOptions.url },
        "School adoption request failed",
      );
      return reply.code(503).send({ error: "school_service_unavailable" });
    });
    const post = (
      path: string,
      run: (accountId: string, body: unknown) => Promise<unknown>,
    ) =>
      scope.post(
        `/api/v1/school/adoptions/${path}`,
        { bodyLimit: 2 * 1024 * 1024 },
        async (request) => run(await authenticate(request), request.body),
      );
    post("options", async (account, body) => {
      const input = z.object({ districtId: z.uuid().optional() }).parse(body);
      return schoolAdoptionOptions(
        options.pool,
        account,
        input.districtId,
        options.secret,
      );
    });
    post("district", async (account, body) => {
      const { districtId } = z.object({ districtId: z.uuid() }).parse(body);
      const authority = await schoolAdoptionAuthority(
        options.pool,
        account,
        { districtId },
        options.cleverUser,
      );
      return schoolAdoptionDistrict(
        options.pool,
        account,
        districtId,
        authority,
      );
    });
    post("issue", async (account, body) =>
      issueSchoolAdoption(
        options.pool,
        account,
        adoptionRequest.parse(body),
        new Date(),
        options.secret,
      ),
    );
    post("review", async (account, body) => {
      const { token } = adoptionReviewRequest.parse(body);
      const authority = await schoolAdoptionAuthority(
        options.pool,
        account,
        { token },
        options.cleverUser,
      );
      return reviewSchoolAdoption(options.pool, account, token, authority);
    });
    post("clever-preview", async (account, body) => {
      const input = adoptionCleverRequest.parse(body);
      const authority = await schoolAdoptionAuthority(
        options.pool,
        account,
        { token: input.token },
        options.cleverUser,
      );
      const connection = await schoolAdoptionCleverSource(
        options.pool,
        account,
        input.token,
        input.connectionId,
        authority,
      );
      const snapshot = await storedAdoptionSnapshot(
        options.pool,
        connection.id,
        input.schoolId,
      );
      return schoolAdoptionCleverPreview(snapshot, input.schoolId);
    });
    post("accept", async (account, body) => {
      const input = adoptionAcceptRequest.parse(body);
      const authority = await schoolAdoptionAuthority(
        options.pool,
        account,
        { token: input.token },
        options.cleverUser,
      );
      let snapshot: Snapshot | undefined;
      if (input.cleverSchool) {
        const connection = await schoolAdoptionCleverSource(
          options.pool,
          account,
          input.token,
          input.cleverSchool.connectionId,
          authority,
        );
        snapshot = await storedAdoptionSnapshot(
          options.pool,
          connection.id,
          input.cleverSchool.schoolId,
        );
      }
      return acceptSchoolAdoption(options.pool, account, input.token, input, {
        snapshot,
        ...authority,
      });
    });
    post("revoke", async (account, body) =>
      revokeSchoolAdoption(
        options.pool,
        account,
        z.object({ id: z.uuid() }).parse(body).id,
      ),
    );
  });
}
