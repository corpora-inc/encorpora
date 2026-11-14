import { classPracticeGate } from "./pilot-access.js";
import { randomUUID } from "node:crypto";
import { actorPerson, can, rosterScope } from "./authz.js";
import { activityPeople, readActivity } from "./activity.js";
import { SchoolError, schoolActions } from "./contracts.js";
import { recordEvent } from "./events.js";
import { fileSlug } from "./exports.js";
import {
  integrationLabels,
  readIntegrations,
  setProvider,
} from "./integrations.js";
import { SEAT_REQUEST_MAILBOX, SEAT_REQUESTS_PER_HOUR } from "./license.js";
import {
  activityPeopleSchema,
  activityQuerySchema,
  addSchoolSchema,
  requestIntegrationSchema,
} from "./org-contracts.js";
import { readOverview, readSchools } from "./org-reads.js";
import { readPractice } from "./practice-views.js";
import { eraseBatch, readPrivacy, schoolExport } from "./privacy.js";
import { rolloverOptions, runRollover } from "./rollover.js";
import type { defineSchoolRoute } from "./routes.js";
import { eventsSince } from "./setup-routes.js";
import { transferCampus, transferOptions } from "./transfer.js";
import { classIsPast, yearsOf } from "./years.js";

const ORG = "/api/v1/school/orgs/:org";
const orgParam = ({ params }: { params: Record<string, string> }) =>
  ({ kind: "org", orgId: params.org! }) as const;
const studentParam = ({ params }: { params: Record<string, string> }) =>
  ({ kind: "student", personId: params.student! }) as const;

/** The school and district layer: the overview, schools, the year, campus moves,
 * integrations, the privacy center and the log. Registered with every other
 * school route, so the cross-tenant walk covers them all. */
export function defineOrgRoutes(define: typeof defineSchoolRoute) {
  define({
    method: "GET",
    url: `${ORG}/overview`,
    action: "overview.read",
    target: orgParam,
    handler: ({ actor, target, pool, services }) =>
      readOverview(
        pool,
        target.orgId,
        actorPerson(actor, target),
        can(actor, "year.rollover", target),
        services.now?.(),
      ),
  });

  define({
    method: "GET",
    url: `${ORG}/practice`,
    action: "overview.read",
    target: orgParam,
    handler: ({ target, pool, services }) =>
      readPractice(pool, target.orgId, services.now?.()),
  });

  /* Schools. */
  define({
    method: "GET",
    url: `${ORG}/schools`,
    action: "overview.read",
    target: orgParam,
    handler: ({ target, pool, services }) =>
      readSchools(pool, target.orgId, services.now?.()),
  });
  define({
    method: "POST",
    url: `${ORG}/schools`,
    action: "schools.add",
    target: orgParam,
    bodyLimit: 1024,
    handler: async ({ request, reply, actor, target, repository }) => {
      const input = addSchoolSchema.parse(request.body);
      const kind = (
        await repository.pool.query("SELECT kind FROM amp_orgs WHERE id=$1", [
          target.orgId,
        ])
      ).rows[0]?.kind;
      if (kind === "school") throw new SchoolError(404, "not_found");
      const created = await repository.createOrg({
        kind: "school",
        name: input.name,
        timezone: input.timezone,
        parentId: target.orgId,
      });
      await repository.transaction((client) =>
        recordEvent(client, {
          orgId: created.id,
          actorPersonId: actorPerson(actor, target),
          action: "school.added",
          targetKind: "org",
          targetId: created.id,
        }),
      );
      return reply.code(201).send({ school: { id: created.id } });
    },
  });

  /* The year. */
  define({
    method: "GET",
    url: `${ORG}/years`,
    action: "classes.read",
    target: orgParam,
    handler: async ({ actor, target, pool }) => ({
      years: await yearsOf(
        pool,
        target.orgId,
        rosterScope(actor, target).classIds,
      ),
    }),
  });
  define({
    method: "GET",
    url: "/api/v1/school/classes/:class/year",
    action: "classes.read",
    target: ({ params }) =>
      ({ kind: "class", classId: params.class! }) as const,
    // The class's year, and what binds it to a place: its org, the path
    // above it, its name, and what this person may do in it (the same `can`
    // as every route). The shell frames a class only under its own org
    // (docs/architecture/spaces.md).
    handler: async ({ actor, target, pool }) => {
      const [past, named, gate] = await Promise.all([
        classIsPast(pool, target.classId),
        pool.query("SELECT name FROM amp_classes WHERE id=$1", [
          target.classId,
        ]),
        classPracticeGate(pool, target.classId),
      ]);
      return {
        past,
        // Whether students can practice: the sign-in tools follow it for
        // every reader of the class, not only those who read its pilot.
        practice: gate ?? "open",
        orgId: target.orgId,
        path: target.path,
        name: (named.rows[0]?.name as string | undefined) ?? null,
        can: schoolActions.filter((action) => can(actor, action, target)),
      };
    },
  });
  define({
    method: "GET",
    url: `${ORG}/year`,
    action: "year.rollover",
    target: orgParam,
    handler: ({ target, pool }) => rolloverOptions(pool, target.orgId),
  });
  for (const [leaf, dryRun] of [
    ["plan", true],
    ["apply", false],
  ] as const)
    define({
      method: "POST",
      url: `${ORG}/year/${leaf}`,
      action: "year.rollover",
      target: orgParam,
      bodyLimit: 256 * 1024,
      handler: ({ request, actor, target, repository }) =>
        runRollover(
          repository,
          target.orgId,
          request.body,
          actorPerson(actor, target),
          { dryRun },
        ),
    });

  /* Campus transfer. */
  define({
    method: "GET",
    url: "/api/v1/school/students/:student/transfer",
    action: "students.transfer",
    target: studentParam,
    handler: ({ actor, target, pool }) => transferOptions(pool, actor, target),
  });
  define({
    method: "POST",
    url: "/api/v1/school/students/:student/transfer",
    action: "students.transfer",
    target: studentParam,
    bodyLimit: 1024,
    handler: ({ request, actor, target, repository }) =>
      transferCampus(repository, actor, target, request.body),
  });

  /* Integrations. */
  define({
    method: "GET",
    url: `${ORG}/integrations`,
    action: "integrations.read",
    target: orgParam,
    handler: ({ target, pool, services }) =>
      readIntegrations(pool, target.orgId, services),
  });
  define({
    method: "POST",
    url: `${ORG}/integrations/sign-in`,
    action: "integrations.manage",
    target: orgParam,
    bodyLimit: 512,
    handler: async ({ request, actor, target, pool, repository, services }) => {
      await setProvider(
        repository,
        target,
        request.body,
        actorPerson(actor, target),
      );
      return readIntegrations(pool, target.orgId, services);
    },
  });
  define({
    method: "POST",
    url: `${ORG}/integrations/request`,
    action: "integrations.manage",
    target: orgParam,
    bodyLimit: 512,
    handler: async ({ request, actor, target, pool, repository, services }) => {
      const { id } = requestIntegrationSchema.parse(request.body);
      if (!services.mail) throw new SchoolError(503, "mail_unavailable");
      if (
        (await eventsSince(
          repository,
          target.orgId,
          "integration.requested",
          1,
        )) >= SEAT_REQUESTS_PER_HOUR
      )
        throw new SchoolError(429, "too_many_requests");
      const { name } = (
        await pool.query("SELECT name FROM amp_orgs WHERE id=$1", [
          target.orgId,
        ])
      ).rows[0];
      const label = integrationLabels[id]!;
      const requester = actor.accountId.startsWith("amp|")
        ? (
            await pool.query("SELECT email FROM amp_auth_users WHERE id=$1", [
              actor.accountId.slice(4),
            ])
          ).rows[0]?.email
        : null;
      await services
        .mail(
          SEAT_REQUEST_MAILBOX,
          `Integration request: ${label} for ${name}`,
          [
            `${name} asks to set up ${label}.`,
            `Org: ${target.orgId}`,
            `From: ${requester ?? "unknown"}`,
          ].join("\n"),
          `${services.origin}/school/${target.orgId}/integrations`,
        )
        .catch((error) => {
          console.error("[schools] integration request mail not sent", {
            message: (error as Error).message,
          });
          throw new SchoolError(503, "mail_unavailable");
        });
      await repository.transaction((client) =>
        recordEvent(client, {
          orgId: target.orgId,
          actorPersonId: actorPerson(actor, target),
          action: "integration.requested",
          targetKind: "org",
          targetId: target.orgId,
          detail: { after: { id, label } },
        }),
      );
      return readIntegrations(pool, target.orgId, services);
    },
  });

  /* Privacy. */
  define({
    method: "GET",
    url: `${ORG}/privacy`,
    action: "privacy.read",
    target: orgParam,
    handler: ({ target, pool }) => readPrivacy(pool, target),
  });
  define({
    method: "GET",
    url: `${ORG}/privacy/export.zip`,
    action: "privacy.export",
    target: orgParam,
    handler: async ({ reply, actor, target, pool, repository }) => {
      const { name } = (
        await pool.query("SELECT name FROM amp_orgs WHERE id=$1", [
          target.orgId,
        ])
      ).rows[0];
      await repository.transaction((client) =>
        recordEvent(client, {
          orgId: target.orgId,
          actorPersonId: actorPerson(actor, target),
          action: "privacy.exported",
          targetKind: "org",
          targetId: target.orgId,
          detail: { after: { id: randomUUID() } },
        }),
      );
      return reply
        .type("application/zip")
        .header(
          "Content-Disposition",
          `attachment; filename="${fileSlug(name, "student-data")}.zip"`,
        )
        .send(schoolExport(pool, target));
    },
  });
  define({
    method: "POST",
    url: `${ORG}/privacy/erase`,
    action: "privacy.delete",
    target: orgParam,
    bodyLimit: 1024,
    handler: ({ request, actor, target, repository }) =>
      eraseBatch(repository, target, request.body, actorPerson(actor, target)),
  });

  /* The log. */
  define({
    method: "GET",
    url: `${ORG}/activity`,
    action: "activity.read",
    target: orgParam,
    handler: async ({ request, actor, target, pool }) => {
      const { timezone } = (
        await pool.query("SELECT timezone FROM amp_orgs WHERE id=$1", [
          target.orgId,
        ])
      ).rows[0];
      return readActivity(
        pool,
        { ...target, timezone },
        activityQuerySchema.parse(request.query),
        actor.accountId,
      );
    },
  });
  // In a body, so a name someone typed never reaches a request log.
  define({
    method: "POST",
    url: `${ORG}/activity/people`,
    action: "activity.read",
    target: orgParam,
    bodyLimit: 512,
    handler: ({ request, actor, target, pool }) => {
      const { q } = activityPeopleSchema.parse(request.body);
      return activityPeople(pool, target, q, actor.accountId);
    },
  });
}
