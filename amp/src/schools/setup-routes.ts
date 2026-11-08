import type { FastifyInstance } from "fastify";
import { schoolActions, SchoolError, type SchoolAction } from "./contracts.js";
import { can, type SchoolTarget } from "./authz.js";
import { recordEvent } from "./events.js";
import {
  INVITE_MAILS_PER_DAY,
  SEAT_REQUEST_MAILBOX,
  SEAT_REQUESTS_PER_HOUR,
} from "./license.js";
import { applyRoster, planRoster } from "./reconcile.js";
import { syncSsoCredentials } from "./sso-credentials.js";
import type { SchoolRepository } from "./repository.js";
import {
  licenseView,
  removeStudent,
  setStudentClasses,
  updateClass,
  updateStudent,
} from "./roster.js";
import {
  type defineSchoolRoute,
  type SchoolRouteContext,
  type SchoolServices,
} from "./routes.js";
import { actorPerson } from "./authz.js";
import {
  acceptSetupAgreement,
  addDivision,
  calendar,
  defaultCalendar,
  finishSetup,
  setCalendar,
  setExperience,
  setupState,
  updateSession,
  updateSetupSchool,
} from "./setup.js";
import { removeStudentSchema, requestSeatsSchema } from "./setup-contracts.js";
import {
  acceptInvite,
  endStaff,
  inviteStaff,
  listStaff,
  lookupInvite,
  mailedInviteUrl,
  reissueInvite,
  setStaffClasses,
  type IssuedInvite,
} from "./staff.js";

const ROSTER_BODY = 4 * 1024 * 1024;

const roleWord: Record<string, string> = {
  admin: "an admin",
  teacher: "a teacher",
  aide: "an aide",
  viewer: "a viewer",
};
export const eventsSince = async (
  repository: SchoolRepository,
  orgId: string,
  action: string,
  hours: number,
) =>
  (
    await repository.pool.query(
      `SELECT count(*)::int AS events FROM amp_school_events
       WHERE org_id=$1 AND action=$2 AND "at">now()-make_interval(hours=>$3)`,
      [orgId, action, hours],
    )
  ).rows[0].events as number;
/** A school invitation through the account mail path. A failure is reported,
 * not thrown: the invitation stands, and its link can be copied. */
async function mailInvite(
  services: SchoolServices,
  repository: SchoolRepository,
  orgId: string,
  invite: Pick<IssuedInvite, "credentialId" | "email">,
  orgName: string,
  role: string,
) {
  if (!invite.credentialId || !invite.email || !services.mail) return false;
  if (
    (await eventsSince(repository, orgId, "staff.invited", 24)) >
    INVITE_MAILS_PER_DAY
  )
    return false;
  try {
    await services.mail(
      invite.email,
      `${orgName} invited you to AMP for Schools`,
      `${orgName} invited you to join as ${roleWord[role] ?? "staff"} on AMP for Schools. Open this link to accept. It works once and expires in 30 days. If you weren’t expecting this, you can ignore it.`,
      mailedInviteUrl(services, invite.credentialId),
    );
    return true;
  } catch (error) {
    console.error("[schools] invitation mail not sent", {
      message: (error as Error).message,
    });
    return false;
  }
}
const orgNameOf = async (repository: SchoolRepository, orgId: string) =>
  (
    await repository.pool.query("SELECT name FROM amp_orgs WHERE id=$1", [
      orgId,
    ])
  ).rows[0]?.name as string;
type Input = { params: Record<string, string> };
const orgParam = ({ params }: Input) =>
  ({ kind: "org", orgId: params.org! }) as const;
const classParam = ({ params }: Input) =>
  ({ kind: "class", orgId: params.org!, classId: params.class! }) as const;
const studentParam = ({ params }: Input) =>
  ({ kind: "student", personId: params.student! }) as const;
const who = ({
  actor,
  target,
}: Pick<
  SchoolRouteContext<Extract<SchoolTarget, { path: string[] }>>,
  "actor" | "target"
>) => actorPerson(actor, target);

/** Which org-level actions this caller holds, so a screen offers only those. */
export const canList = ({
  actor,
  target,
}: Pick<SchoolRouteContext, "actor" | "target">): SchoolAction[] =>
  schoolActions.filter((action) => can(actor, action, target));

/** Public, because the person may not have an account yet: holding the token
 * is the permission, and it answers only the school's name and the role. */
export function registerInvitePreview(
  scope: FastifyInstance,
  repository: SchoolRepository,
) {
  scope.post(
    "/api/v1/school/invites/lookup",
    { bodyLimit: 1024 },
    async (request) => {
      const invite = await lookupInvite(repository, request.body);
      if (!invite) throw new SchoolError(404, "invite_not_found");
      return { invite };
    },
  );
}

export function defineSetupRoutes(define: typeof defineSchoolRoute) {
  /* Setup, for a school we issued: `scripts/school-admin.ts` create-school
   * makes the org and invites its admin, who carries on from here. */
  define({
    method: "GET",
    url: "/api/v1/school/orgs/:org/setup",
    action: "setup.write",
    target: orgParam,
    handler: async ({ target, repository }) =>
      setupState(repository, target.orgId),
  });
  define({
    method: "POST",
    url: "/api/v1/school/orgs/:org/setup/school",
    action: "setup.write",
    target: orgParam,
    bodyLimit: 4096,
    handler: async ({ request, target, repository }) => {
      await updateSetupSchool(repository, target.orgId, request.body);
      return setupState(repository, target.orgId);
    },
  });
  define({
    method: "POST",
    url: "/api/v1/school/orgs/:org/setup/default-calendar",
    action: "setup.write",
    target: orgParam,
    bodyLimit: 256,
    handler: async ({ target, repository }) => {
      await defaultCalendar(repository, target.orgId);
      return setupState(repository, target.orgId);
    },
  });
  define({
    method: "POST",
    url: "/api/v1/school/orgs/:org/setup/experience",
    action: "setup.write",
    target: orgParam,
    bodyLimit: 1024,
    handler: async (context) => {
      await setExperience(
        context.repository,
        context.target.orgId,
        context.request.body,
        who(context),
      );
      return setupState(context.repository, context.target.orgId);
    },
  });
  define({
    method: "POST",
    url: "/api/v1/school/orgs/:org/setup/agreement",
    action: "setup.write",
    target: orgParam,
    bodyLimit: 2048,
    handler: async (context) => {
      await acceptSetupAgreement(
        context.repository,
        context.target.orgId,
        context.request.body,
        who(context),
      );
      return setupState(context.repository, context.target.orgId);
    },
  });
  define({
    method: "POST",
    url: "/api/v1/school/orgs/:org/setup/finish",
    action: "setup.write",
    target: orgParam,
    bodyLimit: 64 * 1024,
    handler: async (context) =>
      finishSetup(
        context.repository,
        context.target.orgId,
        context.request.body,
        who(context),
      ),
  });

  /* Calendar. */
  define({
    method: "GET",
    url: "/api/v1/school/orgs/:org/calendar",
    action: "calendar.read",
    target: orgParam,
    handler: async ({ target, repository }) => ({
      sessions: await calendar(repository, target.orgId),
    }),
  });
  define({
    method: "POST",
    url: "/api/v1/school/orgs/:org/calendar",
    action: "calendar.write",
    target: orgParam,
    bodyLimit: 1024,
    handler: async (context) => {
      await setCalendar(
        context.repository,
        context.target.orgId,
        context.request.body,
        who(context),
      );
      return {
        sessions: await calendar(context.repository, context.target.orgId),
      };
    },
  });
  define({
    method: "POST",
    url: "/api/v1/school/orgs/:org/calendar/divisions",
    action: "calendar.write",
    target: orgParam,
    bodyLimit: 1024,
    handler: async ({ request, target, repository }) => {
      await addDivision(repository, target.orgId, request.body);
      return { sessions: await calendar(repository, target.orgId) };
    },
  });
  define({
    method: "POST",
    url: "/api/v1/school/orgs/:org/calendar/sessions/:session",
    action: "calendar.write",
    target: orgParam,
    bodyLimit: 1024,
    handler: async (context) => {
      const { session } = context.request.params as { session: string };
      await updateSession(
        context.repository,
        context.target.orgId,
        session,
        context.request.body,
        who(context),
      );
      return {
        sessions: await calendar(context.repository, context.target.orgId),
      };
    },
  });

  /* Classes and students. */
  define({
    method: "POST",
    url: "/api/v1/school/orgs/:org/classes/:class",
    action: "classes.update",
    target: classParam,
    bodyLimit: 2048,
    handler: async (context) =>
      updateClass(
        context.repository,
        context.target.classId,
        context.request.body,
        who(context),
      ),
  });
  define({
    method: "POST",
    url: "/api/v1/school/orgs/:org/students/:student",
    action: "students.update",
    target: studentParam,
    bodyLimit: 1024,
    handler: async (context) =>
      updateStudent(
        context.repository,
        context.target.orgId,
        context.target.personId,
        context.request.body,
        who(context),
      ),
  });
  define({
    method: "POST",
    url: "/api/v1/school/orgs/:org/students/:student/classes",
    action: "students.transfer",
    target: studentParam,
    bodyLimit: 4096,
    handler: async (context) =>
      setStudentClasses(
        context.repository,
        context.target.orgId,
        context.target.personId,
        context.request.body,
        who(context),
      ),
  });
  define({
    method: "POST",
    url: "/api/v1/school/orgs/:org/students/:student/remove",
    action: "students.remove",
    target: studentParam,
    bodyLimit: 256,
    handler: async (context) => {
      removeStudentSchema.parse(context.request.body);
      return removeStudent(
        context.repository,
        context.target.orgId,
        context.target.personId,
        who(context),
      );
    },
  });

  /* Staff. */
  define({
    method: "GET",
    url: "/api/v1/school/orgs/:org/staff",
    action: "staff.read",
    target: orgParam,
    handler: async (context) => ({
      staff: await listStaff(
        context.repository,
        context.services,
        context.target.orgId,
        {
          accountId: context.actor.accountId,
          withLinks: can(context.actor, "staff.manage", context.target),
        },
      ),
    }),
  });
  define({
    method: "POST",
    url: "/api/v1/school/orgs/:org/staff/invites",
    action: "staff.manage",
    target: orgParam,
    bodyLimit: 4096,
    handler: async (context) => {
      const { request, reply, repository, services, target } = context;
      const issued = await inviteStaff(
        repository,
        services,
        target.orgId,
        request.body,
        who(context),
      );
      const mailed = await mailInvite(
        services,
        repository,
        target.orgId,
        issued,
        await orgNameOf(repository, target.orgId),
        (request.body as { role: string }).role,
      );
      return reply.code(201).send({
        personId: issued.personId,
        linked: issued.linked,
        mailed,
      });
    },
  });
  define({
    method: "POST",
    url: "/api/v1/school/orgs/:org/staff/:person/invite",
    action: "staff.manage",
    target: orgParam,
    bodyLimit: 256,
    handler: async ({ request, repository, services, target }) => {
      const { person } = request.params as { person: string };
      const issued = await reissueInvite(
        repository,
        services,
        target.orgId,
        person,
      );
      const role = (
        await repository.pool.query(
          "SELECT role FROM amp_org_roles WHERE person_id=$1 AND role<>'student' AND end_on IS NULL ORDER BY created_at LIMIT 1",
          [person],
        )
      ).rows[0]?.role as string;
      return {
        mailed: await mailInvite(
          services,
          repository,
          target.orgId,
          issued,
          await orgNameOf(repository, target.orgId),
          role,
        ),
      };
    },
  });
  define({
    method: "POST",
    url: "/api/v1/school/orgs/:org/staff/:person/classes",
    action: "staff.manage",
    target: orgParam,
    bodyLimit: 4096,
    handler: async (context) => {
      const { person } = context.request.params as { person: string };
      return setStaffClasses(
        context.repository,
        context.target.orgId,
        person,
        context.request.body,
        who(context),
      );
    },
  });
  define({
    method: "POST",
    url: "/api/v1/school/orgs/:org/staff/:person/end",
    action: "staff.manage",
    target: orgParam,
    bodyLimit: 256,
    handler: async (context) => {
      const { person } = context.request.params as { person: string };
      return endStaff(
        context.repository,
        context.target.orgId,
        person,
        who(context),
      );
    },
  });
  define({
    method: "POST",
    url: "/api/v1/school/invites/accept",
    action: "invites.accept",
    target: () => ({ kind: "self" }) as const,
    bodyLimit: 1024,
    handler: async ({ request, actor, repository }) =>
      acceptInvite(repository, actor.accountId, request.body),
  });
  define({
    method: "GET",
    url: "/api/v1/school/orgs/:org/sign-in-help",
    action: "org.read",
    target: orgParam,
    handler: async ({ services }) => ({
      origin: services.origin,
      google: services.signIn?.google ?? null,
      microsoft: services.signIn?.microsoft
        ? {
            clientId: services.signIn.microsoft,
            adminConsentUrl: `https://login.microsoftonline.com/organizations/adminconsent?client_id=${encodeURIComponent(services.signIn.microsoft)}`,
          }
        : null,
    }),
  });

  /* License. */
  define({
    method: "GET",
    url: "/api/v1/school/orgs/:org/license",
    action: "license.read",
    target: orgParam,
    handler: async ({ target, repository }) =>
      licenseView(repository, target.orgId),
  });
  define({
    method: "POST",
    url: "/api/v1/school/orgs/:org/license/request",
    action: "license.request",
    target: orgParam,
    bodyLimit: 4096,
    handler: async ({ request, actor, target, repository, services }) => {
      const input = requestSeatsSchema.parse(request.body);
      if (!services.mail) throw new SchoolError(503, "mail_unavailable");
      if (
        (await eventsSince(repository, target.orgId, "license.requested", 1)) >=
        SEAT_REQUESTS_PER_HOUR
      )
        throw new SchoolError(429, "too_many_requests");
      const name = await orgNameOf(repository, target.orgId);
      const view = await licenseView(repository, target.orgId);
      const requester = actor.accountId.startsWith("amp|")
        ? (
            await repository.pool.query(
              "SELECT email FROM amp_auth_users WHERE id=$1",
              [actor.accountId.slice(4)],
            )
          ).rows[0]?.email
        : null;
      await services
        .mail(
          SEAT_REQUEST_MAILBOX,
          `Seat request: ${name}`,
          [
            `${name} asks for ${input.seats} seats.`,
            `Org: ${target.orgId}`,
            `Now: ${view.used} of ${view.seats} used, ${view.waiting} waiting.`,
            `From: ${requester ?? "unknown"}`,
            ...(input.note ? [`Note: ${input.note}`] : []),
          ].join("\n"),
          `${services.origin}/school/${target.orgId}/license`,
        )
        .catch((error) => {
          console.error("[schools] seat request mail not sent", {
            message: (error as Error).message,
          });
          throw new SchoolError(503, "mail_unavailable");
        });
      await repository.transaction((client) =>
        recordEvent(client, {
          orgId: target.orgId,
          actorPersonId: actorPerson(actor, target),
          action: "license.requested",
          targetKind: "org",
          targetId: target.orgId,
          detail: { after: { seats: input.seats } },
        }),
      );
      return { requested: true };
    },
  });

  /* Roster import. */
  define({
    method: "POST",
    url: "/api/v1/school/orgs/:org/roster/plan",
    action: "roster.import",
    target: orgParam,
    bodyLimit: ROSTER_BODY,
    handler: async ({ request, target, repository }) => ({
      results: await planRoster(repository, target.orgId, request.body),
    }),
  });
  define({
    method: "POST",
    url: "/api/v1/school/orgs/:org/roster/apply",
    action: "roster.import",
    target: orgParam,
    bodyLimit: ROSTER_BODY,
    handler: async (context) => {
      const { request, repository, services, target } = context;
      const { results, invites } = await applyRoster(
        repository,
        services,
        target.orgId,
        request.body,
        who(context),
      );
      // New students and changed addresses reach any outside sign-in that's on.
      await repository.transaction((client) =>
        syncSsoCredentials(client, target.path[0]!),
      );
      const name = invites.length
        ? await orgNameOf(repository, target.orgId)
        : "";
      let invited = 0;
      for (const invite of invites)
        if (
          await mailInvite(
            services,
            repository,
            target.orgId,
            invite,
            name,
            "teacher",
          )
        )
          invited++;
      return { results, invited };
    },
  });
}
