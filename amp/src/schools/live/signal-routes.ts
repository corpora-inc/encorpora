import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { actorPerson } from "../authz.js";
import { SchoolError } from "../contracts.js";
import { resolveStudentSession, studentBearer } from "../principal.js";
import type { SchoolRepository } from "../repository.js";
import type { defineSchoolRoute } from "../routes.js";
import { limited } from "../sign-in-routes.js";
import { SchoolSignIn } from "../sign-in.js";
import {
  forgotPictureBody,
  forgotPictureQuery,
  resolveSignalBody,
  studentSignalBody,
} from "./contracts.js";
import {
  acknowledgeHand,
  forgotPictureState,
  raiseForgotPicture,
  raiseHand,
  readStudentSignals,
  resolvePersonSignals,
} from "./signals.js";

/** Registered inside the school scope for its refusal shapes and no-store headers. */
export function registerStudentSignalRoutes(
  scope: FastifyInstance,
  repository: SchoolRepository,
) {
  const student = async (request: FastifyRequest) => {
    const token = studentBearer(request);
    const session =
      token && (await resolveStudentSession(repository.pool, token));
    if (!session) throw new SchoolError(401, "sign_in_required");
    return session.personId;
  };
  scope.post(
    "/api/v1/school/student/signals",
    { bodyLimit: 1024 },
    async (request) => {
      const personId = await student(request);
      studentSignalBody.parse(request.body);
      return {
        signals: await repository.transaction((db) => raiseHand(db, personId)),
      };
    },
  );
  scope.post(
    "/api/v1/school/student/signals/withdraw",
    { bodyLimit: 1024 },
    async (request) => {
      const personId = await student(request);
      studentSignalBody.parse(request.body);
      return {
        signals: await repository.transaction((db) =>
          resolvePersonSignals(db, personId, "hand", "withdrawn", personId),
        ),
      };
    },
  );
  scope.get("/api/v1/school/student/signals", async (request) => ({
    signals: await readStudentSignals(repository.pool, await student(request)),
  }));

  const signIn = new SchoolSignIn(repository);
  scope.post("/api/v1/school/join/forgot-picture", limited, async (request) => {
    const input = forgotPictureBody.parse(request.body);
    const found = await signIn.pictureStudent(input);
    await repository.transaction((db) =>
      raiseForgotPicture(db, found.id, input.personId),
    );
    return { state: "waiting" as const };
  });
  scope.get("/api/v1/school/join/forgot-picture", limited, async (request) => {
    const input = forgotPictureQuery.parse(request.query);
    const found = await signIn.pictureStudent(input);
    return forgotPictureState(repository.pool, found.id, input.personId);
  });
}

export function defineSignalRoutes(define: typeof defineSchoolRoute) {
  define({
    method: "POST",
    url: "/api/v1/school/classes/:class/signals/:signal/resolve",
    action: "signal.resolve",
    target: ({ params }) =>
      ({ kind: "class", classId: params.class! }) as const,
    bodyLimit: 1024,
    handler: async ({ request, actor, target, repository }) => {
      resolveSignalBody.parse(request.body);
      const parsed = z
        .uuid()
        .safeParse((request.params as { signal: string }).signal);
      if (!parsed.success) throw new SchoolError(404, "not_found");
      return {
        signal: await repository.transaction((db) =>
          acknowledgeHand(
            db,
            target.classId,
            parsed.data,
            actorPerson(actor, target),
          ),
        ),
      };
    },
  });
}
