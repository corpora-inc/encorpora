import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import { activeToday } from "../schools/principal.js";
import { SchoolRepository } from "../schools/repository.js";
import {
  endSecondParentSessions,
  endStaffIn,
  inviteStaffIn,
  liveInviteUrl,
  mailedInviteUrl,
  reissueInviteIn,
  type InviteKeys,
} from "../schools/staff.js";
import type { ApprovalMail } from "./approvals.js";
import { FamilyError } from "./contracts.js";
import { SchoolError } from "../schools/contracts.js";

/* A family's second parent (docs/families.md). A paid family covers two
   adults: the account holder and one parent they invite. She is a teacher of
   the family's class through the ordinary staff invitation, which she accepts
   only with the invited address (`acceptInvite`), and `amp_families.
   second_parent` marks which teacher she is (migration 0104). That marker is
   what gives her the family's children's progress, "Let … practice here" and
   free practice of her own. Billing, consent, the children's names and
   deletion, and inviting or removing her, stay the account holder's. */

type Database = Pick<PoolClient, "query">;

/** Mails a family sends in a day: invitations and sends again. */
export const SECOND_PARENT_MAILS_PER_DAY = 10;

export const inviteSecondParentSchema = z.strictObject({
  email: z
    .string()
    .trim()
    .max(254)
    .pipe(z.email())
    .transform((value) => value.toLowerCase()),
});

/** "f…@…": enough for the account holder to recognise, never the address. */
export function emailHint(email: string | null) {
  const first = email?.trim()[0];
  return first ? `${first}…@…` : "…";
}

/** The account holder's view of their second parent. */
export type SecondParentView = {
  personId: string;
  status: "invited" | "active";
  /** The address, masked. */
  emailHint: string;
  /** Her name, once she has accepted. */
  name: string | null;
  /** "Copy link"; null when it lapsed and has to be sent again. */
  inviteUrl: string | null;
};

/** The family this account holds: its org, class and how it names itself. */
async function heldFamily(db: Database, holder: string, lock = false) {
  return (
    await db.query<{
      org_id: string;
      class_id: string;
      class_name: string;
      second_parent: string | null;
      holder_name: string | null;
      holder_person: string | null;
    }>(
      `SELECT f.org_id,f.class_id,c.name AS class_name,f.second_parent,
         (SELECT p.given_name FROM amp_people p WHERE p.tenant_id=f.org_id AND p.account_id=f.account_id
           AND p.deleted_at IS NULL) AS holder_name,
         (SELECT p.id FROM amp_people p WHERE p.tenant_id=f.org_id AND p.account_id=f.account_id
           AND p.deleted_at IS NULL) AS holder_person
       FROM amp_families f JOIN amp_classes c ON c.id=f.class_id
       WHERE f.account_id=$1${lock ? " FOR UPDATE OF f" : ""}`,
      [holder],
    )
  ).rows[0];
}

/** The second parent's person, with her latest live invitation. */
async function secondParentRow(db: Database, personId: string) {
  return (
    await db.query<{
      id: string;
      email: string | null;
      account_id: string | null;
      name: string;
      invite: { id: string; lookup_hash: string; expires_at: string } | null;
    }>(
      `SELECT p.id,p.email,p.account_id,concat_ws(' ',p.given_name,p.family_name) AS name,
         (SELECT row_to_json(i) FROM (SELECT c.id,c.lookup_hash,c.expires_at FROM amp_person_credentials c
           WHERE c.person_id=p.id AND c.kind='invite' AND c.revoked_at IS NULL
           ORDER BY c.created_at DESC,c.id LIMIT 1) i) AS invite
       FROM amp_people p WHERE p.id=$1 AND p.deleted_at IS NULL`,
      [personId],
    )
  ).rows[0];
}

/** Who may manage a family's second parent: the account that holds it. A
 * second parent gets 403, anyone else 404. */
async function holderFamily(db: Database, account: string, lock = false) {
  const family = await heldFamily(db, account, lock);
  if (family) return family;
  if (await isSecondParent(db, account))
    throw new FamilyError(403, "family_holder_only");
  throw new FamilyError(404, "family_not_found");
}

/** The account holder's second parent, invited or active; null without one. */
export async function secondParentOf(
  db: Database,
  keys: InviteKeys,
  holder: string,
): Promise<SecondParentView | null> {
  const family = await holderFamily(db, holder);
  if (!family.second_parent) return null;
  const row = await secondParentRow(db, family.second_parent);
  if (!row) return null;
  return {
    personId: row.id,
    status: row.account_id ? "active" : "invited",
    emailHint: emailHint(row.email),
    name: row.account_id ? row.name : null,
    inviteUrl: row.account_id ? null : liveInviteUrl(keys, row.invite),
  };
}

export type SentInvitation = {
  credentialId: string;
  email: string;
  orgId: string;
  className: string;
  holderName: string | null;
};

/** One second parent per family, so a family that has one, invited or
 * active, invites nobody else until she's removed. The family's row is locked
 * first, as accepting and removing take it, so two invitations at once still
 * leave one. */
export async function inviteSecondParent(
  pool: Pool,
  keys: InviteKeys,
  holder: string,
  raw: unknown,
): Promise<SentInvitation> {
  const { email } = inviteSecondParentSchema.parse(raw);
  const schools = new SchoolRepository(pool);
  return schools.transaction(async (client) => {
    const family = await holderFamily(client, holder, true);
    if (family.second_parent)
      throw new FamilyError(409, "second_parent_exists");
    const own = holder.startsWith("amp|")
      ? ((
          await client.query<{ email: string }>(
            "SELECT email FROM amp_auth_users WHERE id=$1",
            [holder.slice(4)],
          )
        ).rows[0]?.email ?? null)
      : null;
    if (own && own.trim().toLowerCase() === email)
      throw new FamilyError(409, "second_parent_is_you");
    const issued = await inviteStaffIn(
      client,
      schools,
      keys,
      family.org_id,
      {
        email,
        role: "teacher",
        classIds: [family.class_id],
        newPerson: true,
      },
      family.holder_person,
    );
    await client.query(
      "UPDATE amp_families SET second_parent=$2 WHERE account_id=$1",
      [holder, issued.personId],
    );
    return {
      credentialId: issued.credentialId!,
      email,
      orgId: family.org_id,
      className: family.class_name,
      holderName: family.holder_name,
    };
  });
}

/** Send again: the same link, good for another full period. */
export async function resendSecondParent(
  pool: Pool,
  keys: InviteKeys,
  holder: string,
): Promise<SentInvitation> {
  const schools = new SchoolRepository(pool);
  // The family's row first, as accepting takes it: a link is never issued
  // again for a second parent who has just joined.
  return schools.transaction(async (client) => {
    const family = await holderFamily(client, holder, true);
    const row = family.second_parent
      ? await secondParentRow(client, family.second_parent)
      : null;
    if (!row) throw new FamilyError(404, "second_parent_not_found");
    if (row.account_id) throw new FamilyError(409, "second_parent_active");
    const issued = await reissueInviteIn(
      client,
      schools,
      keys,
      family.org_id,
      row.id,
    ).catch((error: unknown) => {
      if (
        error instanceof SchoolError &&
        error.code === "invite_already_accepted"
      )
        throw new FamilyError(409, "second_parent_active");
      throw error;
    });
    return {
      credentialId: issued.credentialId,
      email: issued.email!,
      orgId: family.org_id,
      className: family.class_name,
      holderName: family.holder_name,
    };
  });
}

/** Ends her family access and her free practice. Her own account and her own
 * learner stay hers; only her place in this family goes. */
export async function removeSecondParent(pool: Pool, holder: string) {
  const schools = new SchoolRepository(pool);
  return schools.transaction(async (client) => {
    const family = await holderFamily(client, holder, true);
    if (!family.second_parent)
      throw new FamilyError(404, "second_parent_not_found");
    // Her role may already have ended some other way; the marker goes too.
    const live = await client.query(
      `SELECT 1 FROM amp_org_roles r JOIN amp_orgs o ON o.id=r.org_id
       WHERE r.person_id=$1 AND r.org_id=$2 AND r.role<>'student' AND ${activeToday("r", "o")}`,
      [family.second_parent, family.org_id],
    );
    if (live.rowCount)
      await endStaffIn(
        client,
        schools,
        family.org_id,
        family.second_parent,
        family.holder_person,
      );
    else {
      await client.query(
        "UPDATE amp_families SET second_parent=NULL WHERE account_id=$1",
        [holder],
      );
      const parent = (
        await client.query<{ account_id: string | null }>(
          "SELECT account_id FROM amp_people WHERE id=$1",
          [family.second_parent],
        )
      ).rows[0]?.account_id;
      if (parent) await endSecondParentSessions(client, holder, parent);
    }
    return { removed: true };
  });
}

/** The invitation, through the account mail path. A failure is reported, not
 * thrown: the invitation stands, and its link can be copied. */
export async function mailSecondParent(
  pool: Pool,
  keys: InviteKeys,
  mail: ApprovalMail | undefined,
  sent: SentInvitation,
) {
  if (!mail) return false;
  const today = (
    await pool.query<{ sends: number }>(
      `SELECT count(*)::int AS sends FROM amp_school_events
       WHERE org_id=$1 AND action='staff.invited' AND "at">now()-interval '24 hours'`,
      [sent.orgId],
    )
  ).rows[0]!.sends;
  if (today > SECOND_PARENT_MAILS_PER_DAY) return false;
  const who = sent.holderName ?? "A parent";
  try {
    await mail(
      sent.email,
      `${who} invited you to ${sent.className} on AMP`,
      `${who} invited you to ${sent.className} on AMP, the adaptive math practice, as a parent. You’ll see the children’s class and progress, and your own practice is free. Open this link, then sign in or create an account with this email address. It works once and expires in 30 days. If you weren’t expecting this, you can ignore it.`,
      mailedInviteUrl(keys, sent.credentialId),
    );
    return true;
  } catch (error) {
    console.error("[family] second parent invitation not sent", {
      message: (error as Error).message,
    });
    return false;
  }
}

/* What a second parent reaches. Each read checks her teacher role in the
   family today, so removal stops it on the next request. They run outside a
   transaction, on the pool: a database before families and schools (an
   older fixture) has no second parents. */

const beforeFamilies = (error: { code?: string }) => {
  if (error.code === "42P01" || error.code === "42703") return { rows: [] };
  throw error;
};

const SECOND_PARENT = `FROM amp_people sp
  JOIN amp_families f ON f.second_parent=sp.id
  JOIN amp_orgs fo ON fo.id=f.org_id
  WHERE sp.account_id=$1 AND sp.deleted_at IS NULL
    AND EXISTS(SELECT 1 FROM amp_org_roles fr WHERE fr.person_id=sp.id AND fr.org_id=f.org_id
      AND fr.role='teacher' AND ${activeToday("fr", "fo")})`;

/** The families this account is a second parent of, today. */
export async function secondParentFamilies(db: Database, account: string) {
  return (
    await db.query<{
      holder: string;
      orgId: string;
      classId: string;
      className: string;
    }>(
      `SELECT f.account_id AS holder,f.org_id AS "orgId",f.class_id AS "classId",
         (SELECT c.name FROM amp_classes c WHERE c.id=f.class_id) AS "className"
       ${SECOND_PARENT} ORDER BY f.created_at,f.account_id`,
      [account],
    )
  ).rows;
}

export async function isSecondParent(db: Database, account: string) {
  return !!(
    await db
      .query(`SELECT 1 ${SECOND_PARENT} LIMIT 1`, [account])
      .catch(beforeFamilies)
  ).rows.length;
}

/** The account holder who owns this child, when `account` is that family's
 * second parent; otherwise null. */
export async function secondParentOwner(
  db: Database,
  account: string,
  learnerId: string,
): Promise<string | null> {
  const row = (
    await db
      .query<{ holder: string }>(
        `SELECT f.account_id AS holder ${SECOND_PARENT}
         AND EXISTS(SELECT 1 FROM amp_learners l WHERE l.id=$2 AND l.account_id=f.account_id
           AND NOT l.adult AND l.deleted_at IS NULL)
       LIMIT 1`,
        [account, learnerId],
      )
      .catch(beforeFamilies)
  ).rows[0] as { holder: string } | undefined;
  return row?.holder ?? null;
}

/** A decision about this child is the account holder's: buying, naming,
 * deleting, birth year and starting point. */
export async function refuseSecondParentFor(
  db: Database,
  account: string,
  learnerId: string,
) {
  if (await secondParentOwner(db, account, learnerId))
    throw new FamilyError(403, "family_holder_only");
}

/** A second parent with no family of her own: the family's purchases and
 * consent are the account holder's, so she has none to make or withdraw. A
 * second parent who also holds a family of her own manages that one. */
export async function isSecondParentOnly(db: Database, account: string) {
  if (!(await isSecondParent(db, account))) return false;
  const own = await db.query(
    `SELECT 1 FROM amp_families WHERE account_id=$1
     UNION ALL SELECT 1 FROM amp_learners WHERE account_id=$1 AND NOT adult AND deleted_at IS NULL
     LIMIT 1`,
    [account],
  );
  return !own.rowCount;
}
export async function refuseSecondParentOnly(db: Database, account: string) {
  if (await isSecondParentOnly(db, account))
    throw new FamilyError(403, "family_holder_only");
}
