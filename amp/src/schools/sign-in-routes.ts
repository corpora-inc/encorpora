import type { FastifyInstance } from "fastify";
import { actorPerson, can } from "./authz.js";
import {
  joinCardSchema,
  joinLookupSchema,
  joinPictureSchema,
  type SsoProvider,
} from "./contracts.js";
import type { SchoolRepository } from "./repository.js";
import type { defineSchoolRoute } from "./routes.js";
import { SchoolSignIn } from "./sign-in.js";

/** Each sign-in route, per address per minute per pod: a school's whole building
 * behind one address, signing in at the bell, stays well under it. Guessing is
 * stopped by the counters on each student and class, not by this; this only
 * caps how hard anyone can lean on these routes. The address, not the usual
 * key: these take no credential, so a made-up header must not earn a new limit. */
export const JOIN_RATE_LIMIT = 1200;
export const limited = {
  bodyLimit: 1024,
  config: {
    rateLimit: {
      max: JOIN_RATE_LIMIT,
      timeWindow: "1 minute",
      keyGenerator: (request: { ip: string }) => request.ip,
    },
  },
};

/** Public: the code, card or pictures are the credential. A secret only ever
 * travels in a request body, which the request log doesn't record. */
export function registerJoinRoutes(
  scope: FastifyInstance,
  repository: SchoolRepository,
  oidc?: Partial<Record<SsoProvider, unknown>>,
) {
  const signIn = new SchoolSignIn(repository);
  scope.post("/api/v1/school/join/lookup", limited, async (request) => {
    const roster = await signIn.lookup(joinLookupSchema.parse(request.body));
    // Only what this school turned on and this deployment can actually do.
    return {
      ...roster,
      signIn: roster.signIn?.filter((provider) => !!oidc?.[provider]) ?? [],
    };
  });
  scope.post("/api/v1/school/join/picture", limited, async (request) =>
    signIn.picture(joinPictureSchema.parse(request.body)),
  );
  scope.post("/api/v1/school/join/card", limited, async (request) =>
    signIn.card(joinCardSchema.parse(request.body)),
  );
}

const classParam = ({ params }: { params: Record<string, string> }) =>
  ({ kind: "class", classId: params.class! }) as const;
const CLASS = "/api/v1/school/classes/:class";

/** Called once by `routes.ts`, which owns the table these join. */
export function defineSignInRoutes(define: typeof defineSchoolRoute) {
  define({
    method: "GET",
    url: `${CLASS}/presence`,
    action: "signin.read",
    target: classParam,
    handler: ({ target, repository }) =>
      new SchoolSignIn(repository).presence(target.classId),
  });
  define({
    method: "GET",
    url: `${CLASS}/roster`,
    action: "signin.read",
    target: classParam,
    handler: ({ actor, target, repository }) =>
      new SchoolSignIn(repository).roster(
        target.classId,
        can(actor, "signin.manage", target),
        can(actor, "share.manage", target),
      ),
  });
  define({
    method: "POST",
    url: `${CLASS}/rotate-code`,
    action: "signin.manage",
    target: classParam,
    bodyLimit: 1024,
    handler: ({ actor, target, repository }) =>
      new SchoolSignIn(repository).rotateCode(
        target,
        actorPerson(actor, target),
      ),
  });
  define({
    method: "POST",
    url: `${CLASS}/cards`,
    action: "signin.manage",
    target: classParam,
    bodyLimit: 64 * 1024,
    handler: ({ request, actor, target, repository }) =>
      new SchoolSignIn(repository).issueCards(
        target,
        request.body,
        actorPerson(actor, target),
      ),
  });
  define({
    method: "POST",
    url: `${CLASS}/students/:student/reset-pictures`,
    action: "signin.manage",
    target: classParam,
    bodyLimit: 1024,
    handler: ({ request, actor, target, repository }) =>
      new SchoolSignIn(repository).resetPictures(
        target,
        (request.params as { student: string }).student,
        actorPerson(actor, target),
      ),
  });
  define({
    method: "POST",
    url: `${CLASS}/students/:student/revoke-sessions`,
    action: "signin.manage",
    target: classParam,
    bodyLimit: 1024,
    handler: ({ request, actor, target, repository }) =>
      new SchoolSignIn(repository).revokeSessions(
        target,
        (request.params as { student: string }).student,
        actorPerson(actor, target),
      ),
  });
}
