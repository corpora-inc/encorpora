import { randomUUID } from "node:crypto";
import { SchoolError } from "./contracts.js";
import { recordEvent } from "./events.js";
import { INVITE_DAYS } from "./license.js";
import type { SchoolRepository } from "./repository.js";
import { createSchoolSchema } from "./setup-contracts.js";
import { inviteStaffIn, mailedInviteUrl, type InviteKeys } from "./staff.js";

/** Until the admin chooses theirs in setup. */
const DEFAULT_TIMEZONE = "America/New_York";

export type CreatedSchool = {
  orgId: string;
  licenseId: string;
  adminPersonId: string;
  /** False when this school was already waiting for this admin: the same
   * invitation again, and nothing new. */
  created: boolean;
  /** The admin's setup link. It is the invitation's secret. */
  setupUrl: string;
  name: string;
  adminEmail: string;
};

/** A school exists once we issue it a license. One transaction makes the org,
 * the license and its admin's setup invitation, so a school never half-exists.
 * The admin opens the link, signs in or signs up, and lands in guided setup with
 * the school step already answered.
 *
 * Asking again with the same name and admin while setup is still pending sends
 * the same invitation, good for another full period, and creates nothing. */
export async function createSchool(
  repo: SchoolRepository,
  keys: InviteKeys,
  raw: unknown,
): Promise<CreatedSchool> {
  const input = createSchoolSchema.parse(raw);
  const timezone = input.timezone ?? DEFAULT_TIMEZONE;
  return repo.transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `create-school:${input.name.toLowerCase()}:${input.adminEmail}`,
    ]);
    const waiting = (
      await client.query(
        `SELECT o.id,(SELECT l.id FROM amp_school_licenses l WHERE l.org_id=o.id ORDER BY l.created_at DESC,l.id LIMIT 1) AS license_id
         FROM amp_orgs o JOIN amp_people p ON p.tenant_id=o.id
         JOIN amp_org_roles r ON r.person_id=p.id AND r.org_id=o.id AND r.role='admin' AND r.end_on IS NULL
         WHERE o.parent_id IS NULL AND o.setup_pending AND lower(o.name)=lower($1)
           AND lower(p.email)=$2 AND p.account_id IS NULL AND p.deleted_at IS NULL
         ORDER BY o.created_at DESC LIMIT 1`,
        [input.name, input.adminEmail],
      )
    ).rows[0] as { id: string; license_id: string | null } | undefined;
    let orgId: string, licenseId: string | null;
    if (waiting) {
      orgId = waiting.id;
      licenseId = waiting.license_id;
    } else {
      // Whole days in the school's zone: the license runs through `endsOn`.
      const window = (
        await client.query(
          `SELECT ($1::date::timestamp AT TIME ZONE $3) AS starts_at,
             (($2::date + 1)::timestamp AT TIME ZONE $3) AS ends_at,
             (($2::date + 1)::timestamp AT TIME ZONE $3)<=now() AS ended`,
          [input.startsOn, input.endsOn, timezone],
        )
      ).rows[0] as { starts_at: Date; ends_at: Date; ended: boolean };
      if (window.ended) throw new SchoolError(400, "license_ended");
      orgId = randomUUID();
      await client.query(
        `INSERT INTO amp_orgs(id,kind,path,name,timezone,solo,setup_pending)
         VALUES($1,'school',$2,$3,$4,false,true)`,
        [orgId, [orgId], input.name, timezone],
      );
      await recordEvent(client, {
        orgId,
        action: "org.created",
        targetKind: "org",
        targetId: orgId,
        detail: { after: { kind: "school", reference: input.reference } },
      });
      licenseId = (
        await repo.issueLicenseIn(client, {
          orgId,
          seats: input.seats,
          startsAt: window.starts_at.toISOString(),
          endsAt: window.ends_at.toISOString(),
          reference: input.reference,
        })
      ).licenseId;
    }
    const invite = await inviteStaffIn(
      client,
      repo,
      keys,
      orgId,
      { email: input.adminEmail, role: "admin" },
      null,
    );
    // A new person here, so there is always an invitation to accept.
    if (!invite.credentialId || !licenseId)
      throw new Error("A new school's admin has no invitation");
    const name = (
      await client.query("SELECT name FROM amp_orgs WHERE id=$1", [orgId])
    ).rows[0].name as string;
    return {
      orgId,
      licenseId,
      adminPersonId: invite.personId,
      created: !waiting,
      setupUrl: mailedInviteUrl(keys, invite.credentialId),
      name,
      adminEmail: input.adminEmail,
    };
  });
}

/** The setup invitation, through the account mail path. A failure is reported,
 * not thrown: the school and its link stand, and the operator can send it. */
export async function mailSetupInvitation(
  services: {
    mail?: (
      to: string,
      subject: string,
      text: string,
      url: string,
    ) => Promise<void>;
  },
  school: Pick<CreatedSchool, "name" | "adminEmail" | "setupUrl">,
) {
  if (!services.mail) return false;
  try {
    await services.mail(
      school.adminEmail,
      `${school.name} is ready on AMP for Schools`,
      `AMP for Schools is ready for ${school.name}, and you’re its admin. Open this link to sign in or create your account, then set up your school year, what students see, the data agreement and your roster. The link works once and expires in ${INVITE_DAYS} days. If you weren’t expecting this, you can ignore it.`,
      school.setupUrl,
    );
    return true;
  } catch (error) {
    console.error("[schools] setup invitation mail not sent", {
      message: (error as Error).message,
    });
    return false;
  }
}
