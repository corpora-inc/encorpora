import { z } from "zod";
import type { PoolClient } from "pg";
import { actorPerson, can } from "./authz.js";
import { SchoolError } from "./contracts.js";
import { recordEvent } from "./events.js";
import type { defineSchoolRoute, SchoolServices } from "./routes.js";
import { classContext, termsFor } from "./term-grades.js";
import {
  classLms,
  createLmsAssignment,
  deleteLmsAssignment,
  readLmsAssignments,
  republishLmsAssignment,
  requestLmsSync,
  updateLmsAssignment,
} from "./clever/lms-store.js";
import type { LmsResponse, LmsSummary } from "./lms-contracts.js";

const CLASS = "/api/v1/school/classes/:class";
const classParam = ({ params }: { params: Record<string, string> }) =>
  ({ kind: "class", classId: params.class! }) as const;
const assignmentParam = z.object({ assignment: z.uuid() });
type Db = Pick<PoolClient, "query">;

/** The class's LMS, or null: the feature is off, or the class is not a
 * Clever section of an active district connection. */
export async function lmsSummaryFor(
  db: Db,
  services: SchoolServices,
  classId: string,
): Promise<LmsSummary | null> {
  if (!services.lms) return null;
  const found = await classLms(db, classId, services.lms.environment);
  // Only once Clever has said which LMS the district uses: a district
  // without one never shows the button.
  return found?.lmsType
    ? {
        type: found.lmsType,
        state: found.lmsState,
        failureCode: found.failureCode,
      }
    : null;
}

/** Every LMS route answers 404 while LMS Connect is off for this deployment
 * or the class has no LMS; the screens never show it. */
async function requireLms(db: Db, services: SchoolServices, classId: string) {
  const summary = await lmsSummaryFor(db, services, classId);
  if (!summary || !services.lms) throw new SchoolError(404, "not_found");
  return { summary, environment: services.lms.environment };
}

/**
 * A teacher's LMS Connect: assignments in the class's LMS gradebook and the
 * grades AMP returns to it (docs/clever-lms-connect.md). These handlers only
 * write AMP's rows; the Clever worker makes every provider call.
 */
export function defineLmsRoutes(define: typeof defineSchoolRoute) {
  define({
    method: "GET",
    url: `${CLASS}/lms`,
    action: "grades.read",
    target: classParam,
    handler: async ({
      actor,
      target,
      pool,
      services,
    }): Promise<LmsResponse> => {
      const { summary } = await requireLms(pool, services, target.classId);
      const context = await classContext(
        pool,
        target.classId,
        services.now?.(),
      );
      return {
        lms: summary,
        canEdit: can(actor, "grades.write", target),
        today: context.today,
        terms: (await termsFor(pool, context)).map((term) => ({
          id: term.id,
          name: term.name,
          startsOn: term.startsOn,
          endsOn: term.endsOn,
          state: term.state,
        })),
        assignments: await readLmsAssignments(pool, target.classId),
      };
    },
  });
  define({
    method: "POST",
    url: `${CLASS}/lms/assignments`,
    action: "grades.write",
    target: classParam,
    bodyLimit: 2048,
    handler: async ({
      request,
      reply,
      actor,
      target,
      repository,
      services,
    }) => {
      const { environment } = await requireLms(
        repository.pool,
        services,
        target.classId,
      );
      const person = actorPerson(actor, target);
      const created = await repository.transaction(async (client) => {
        const result = await createLmsAssignment(client, {
          classId: target.classId,
          environment,
          input: request.body,
          personId: person,
          ...(services.now ? { now: services.now() } : {}),
        });
        await record(
          client,
          target.orgId,
          person,
          "lms.assignment.create",
          result.id,
        );
        return result;
      });
      return reply.code(201).send(created);
    },
  });
  const change = (
    suffix: string,
    action: string,
    run: (
      client: PoolClient,
      args: { classId: string; id: string; body: unknown; now?: Date },
    ) => Promise<void>,
    status = 200,
  ) =>
    define({
      method: "POST",
      url: `${CLASS}/lms/assignments/:assignment${suffix}`,
      action: "grades.write",
      target: classParam,
      bodyLimit: 2048,
      handler: async ({
        request,
        reply,
        actor,
        target,
        repository,
        services,
      }) => {
        const { assignment } = assignmentParam.parse(request.params);
        await requireLms(repository.pool, services, target.classId);
        const person = actorPerson(actor, target);
        await repository.transaction(async (client) => {
          await run(client, {
            classId: target.classId,
            id: assignment,
            body: request.body,
            ...(services.now ? { now: services.now() } : {}),
          });
          await record(client, target.orgId, person, action, assignment);
        });
        return reply.code(status).send({ ok: true });
      },
    });
  change("", "lms.assignment.update", (client, args) =>
    updateLmsAssignment(client, {
      classId: args.classId,
      id: args.id,
      input: args.body,
      ...(args.now ? { now: args.now } : {}),
    }),
  );
  change("/delete", "lms.assignment.delete", (client, args) =>
    deleteLmsAssignment(client, {
      classId: args.classId,
      id: args.id,
      ...(args.now ? { now: args.now } : {}),
    }),
  );
  change(
    "/sync",
    "lms.assignment.sync",
    (client, args) => requestLmsSync(client, args),
    202,
  );
  change(
    "/republish",
    "lms.assignment.republish",
    (client, args) => republishLmsAssignment(client, args),
    202,
  );
}

async function record(
  client: PoolClient,
  orgId: string,
  person: string | null,
  action: string,
  id: string,
) {
  await recordEvent(client, {
    orgId,
    actorPersonId: person,
    action,
    targetKind: "lms_assignment",
    targetId: id,
  });
}
