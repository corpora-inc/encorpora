import { createHash, createHmac, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { activeToday } from "./principal.js";
import { SchoolError, type StaffRole } from "./contracts.js";
import { recordEvent } from "./events.js";
import { INVITE_DAYS } from "./license.js";
import { generateHandle, type SchoolRepository } from "./repository.js";
import {
  acceptInviteSchema,
  inviteLookupSchema,
  inviteStaffSchema,
  setClassesSchema,
  type InviteView,
  type StaffResource,
} from "./setup-contracts.js";
import { markStaffAccount } from "./staff-account.js";

/** Invitation mail and links, set up by the server at startup. */
export type InviteKeys = { secret: string; origin: string };
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const derive = (keys: InviteKeys, purpose: string, credentialId: string) =>
  createHmac("sha256", keys.secret)
    .update(`school-invite-${purpose}:${credentialId}`)
    .digest("base64url");
/** The link an admin can always copy: derived, so nothing secret is stored and
 * it stays the same for as long as the invite lasts. */
export const inviteToken = (keys: InviteKeys, credentialId: string) =>
  derive(keys, "link", credentialId);
/** The second half of the mailed link. Only the mailbox ever sees it, so it is
 * what shows that the person accepting can read that address. The fragment
 * never reaches a server log. */
const inviteProof = (keys: InviteKeys, credentialId: string) =>
  derive(keys, "proof", credentialId);
const copyUrl = (keys: InviteKeys, credentialId: string) =>
  `${keys.origin}/school/invite#${inviteToken(keys, credentialId)}`;
/** The "Copy link" form of a live invitation, or null when it lapsed or the
 * key changed and it has to be sent again. */
export function liveInviteUrl(
  keys: InviteKeys,
  invite: { id: string; lookup_hash: string; expires_at: Date | string } | null,
) {
  if (!invite || new Date(invite.expires_at) <= new Date()) return null;
  return hash(inviteToken(keys, invite.id)) === invite.lookup_hash
    ? copyUrl(keys, invite.id)
    : null;
}
export const mailedInviteUrl = (keys: InviteKeys, credentialId: string) =>
  `${copyUrl(keys, credentialId)}.${inviteProof(keys, credentialId)}`;

export type IssuedInvite = {
  personId: string;
  credentialId: string | null;
  email: string | null;
  /** Already an account holder here: the role applies now, nothing to accept. */
  linked: boolean;
};

async function issueCredential(
  client: PoolClient,
  keys: InviteKeys,
  personId: string,
) {
  const live = (
    await client.query(
      `SELECT id FROM amp_person_credentials WHERE person_id=$1 AND kind='invite'
       AND revoked_at IS NULL ORDER BY created_at DESC,id LIMIT 1`,
      [personId],
    )
  ).rows[0];
  const expires = new Date(Date.now() + INVITE_DAYS * 86_400_000);
  if (live) {
    await client.query(
      "UPDATE amp_person_credentials SET expires_at=$2 WHERE id=$1",
      [live.id, expires],
    );
    return live.id as string;
  }
  const id = randomUUID();
  await client.query(
    `INSERT INTO amp_person_credentials(id,person_id,kind,lookup_hash,secret_hash,expires_at)
     VALUES($1,$2,'invite',$3,$4,$5)`,
    [
      id,
      personId,
      hash(inviteToken(keys, id)),
      hash(inviteProof(keys, id)),
      expires,
    ],
  );
  return id;
}

/** A person with a role and an invitation, in a transaction the caller holds.
 * Asking twice for one address is the same invitation; a person who already has
 * an account here just gets the role. */
export async function inviteStaffIn(
  client: PoolClient,
  repo: SchoolRepository,
  keys: InviteKeys,
  orgId: string,
  input: {
    email?: string;
    role: StaffRole;
    givenName?: string;
    familyName?: string;
    classIds?: string[];
    personId?: string;
    /** Always a new person with an invitation to accept, never the role
     * applied to whoever already has this address here: a family's second
     * parent (src/family/second-parent.ts) accepts with that address. */
    newPerson?: boolean;
  },
  actorPersonId: string | null,
): Promise<IssuedInvite> {
  const org = await repo.org(client, orgId);
  const tenantId = org.path[0]!;
  const found =
    input.email && !input.newPerson
      ? (
          await client.query(
            `SELECT id,account_id FROM amp_people WHERE tenant_id=$1 AND lower(email)=$2
           AND deleted_at IS NULL AND learner_id IS NULL ORDER BY created_at,id LIMIT 1`,
            [tenantId, input.email],
          )
        ).rows[0]
      : undefined;
  const personId: string = found?.id ?? input.personId ?? randomUUID();
  if (!found)
    await client.query(
      `INSERT INTO amp_people(id,tenant_id,given_name,family_name,handle,email,timezone)
       VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [
        personId,
        tenantId,
        (input.givenName ?? input.email?.split("@")[0] ?? "Staff").slice(
          0,
          100,
        ),
        input.familyName ?? null,
        generateHandle(),
        input.email ?? null,
        org.timezone,
      ],
    );
  const today = await repo.today(client, org.timezone);
  await client.query(
    `INSERT INTO amp_org_roles(id,person_id,org_id,role,begin_on) VALUES($1,$2,$3,$4,$5)
     ON CONFLICT (person_id,org_id,role) WHERE end_on IS NULL DO NOTHING`,
    [randomUUID(), personId, org.id, input.role, today],
  );
  if (input.role === "teacher" || input.role === "aide")
    for (const classId of input.classIds ?? []) {
      const home = await repo.classIn(client, classId, org.path);
      await repo.enroll(client, home.id, personId, input.role, today);
    }
  const linked = !!found?.account_id;
  const credentialId = linked
    ? null
    : await issueCredential(client, keys, personId);
  await recordEvent(client, {
    orgId: org.id,
    actorPersonId,
    action: "staff.invited",
    targetKind: "person",
    targetId: personId,
    detail: { after: { role: input.role, linked } },
  });
  return { personId, credentialId, email: input.email ?? null, linked };
}

export async function inviteStaff(
  repo: SchoolRepository,
  keys: InviteKeys,
  orgId: string,
  raw: unknown,
  actorPersonId: string | null,
) {
  const input = inviteStaffSchema.parse(raw);
  return repo.transaction((client) =>
    inviteStaffIn(client, repo, keys, orgId, input, actorPersonId),
  );
}

/** Send again: the same link, good for another full period. */
export async function reissueInvite(
  repo: SchoolRepository,
  keys: InviteKeys,
  orgId: string,
  personId: string,
) {
  return repo.transaction(async (client) => {
    const person = await staffPerson(client, repo, orgId, personId);
    if (person.account_id)
      throw new SchoolError(409, "invite_already_accepted");
    const credentialId = await issueCredential(client, keys, personId);
    await recordEvent(client, {
      orgId,
      action: "staff.invited",
      targetKind: "person",
      targetId: personId,
      detail: { after: { resent: true } },
    });
    return {
      personId,
      credentialId,
      email: person.email as string | null,
    };
  });
}

/** A person with a staff role along this org, or not found. */
async function staffPerson(
  client: PoolClient,
  repo: SchoolRepository,
  orgId: string,
  personId: string,
) {
  if (!/^[0-9a-f-]{36}$/i.test(personId))
    throw new SchoolError(404, "staff_not_found");
  const org = await repo.org(client, orgId);
  const person = (
    await client.query(
      `SELECT p.id,p.email,p.account_id FROM amp_people p
       WHERE p.id=$1 AND p.tenant_id=$2 AND p.deleted_at IS NULL
         AND EXISTS(SELECT 1 FROM amp_org_roles r JOIN amp_orgs o ON o.id=r.org_id
           WHERE r.person_id=p.id AND r.role<>'student' AND o.path @> ARRAY[$3]::uuid[] AND ${activeToday("r", "o")})`,
      [personId, org.path[0], org.id],
    )
  ).rows[0];
  if (!person) throw new SchoolError(404, "staff_not_found");
  return person;
}

/** Everyone with a staff role at this org or below, pending or active. Only an
 * admin's list carries the links. */
export async function listStaff(
  repo: SchoolRepository,
  keys: InviteKeys,
  orgId: string,
  options: { accountId: string; withLinks: boolean },
): Promise<StaffResource[]> {
  const rows = (
    await repo.pool.query(
      `SELECT p.id,concat_ws(' ',p.given_name,p.family_name) AS name,p.email,p.account_id,
         array_agg(DISTINCT r.role) AS roles,
         ARRAY(SELECT e.class_id FROM amp_enrollments e JOIN amp_classes c ON c.id=e.class_id JOIN amp_orgs eo ON eo.id=c.org_id
           WHERE e.person_id=p.id AND e.role<>'student' AND c.archived_at IS NULL AND ${activeToday("e", "eo")}) AS "classIds",
         (SELECT row_to_json(i) FROM (SELECT c.id,c.lookup_hash,c.expires_at FROM amp_person_credentials c
           WHERE c.person_id=p.id AND c.kind='invite' AND c.revoked_at IS NULL ORDER BY c.created_at DESC,c.id LIMIT 1) i) AS invite,
         EXISTS(SELECT 1 FROM amp_families f WHERE f.second_parent=p.id) AS second_parent
       FROM amp_people p JOIN amp_org_roles r ON r.person_id=p.id AND r.role<>'student'
       JOIN amp_orgs o ON o.id=r.org_id
       WHERE o.path @> ARRAY[$1]::uuid[] AND p.deleted_at IS NULL AND ${activeToday("r", "o")}
       GROUP BY p.id ORDER BY p.account_id IS NOT NULL,lower(p.given_name),p.id LIMIT 2000`,
      [orgId],
    )
  ).rows;
  return rows.map((row) => {
    const pending = !row.account_id;
    const token = row.invite ? inviteToken(keys, row.invite.id) : null;
    const live =
      !!row.invite &&
      new Date(row.invite.expires_at) > new Date() &&
      hash(token!) === row.invite.lookup_hash;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      roles: row.roles,
      classIds: row.classIds,
      status: pending ? ("invited" as const) : ("active" as const),
      ...(options.withLinks && pending
        ? {
            inviteUrl: live ? copyUrl(keys, row.invite.id) : null,
            inviteExpiresAt: row.invite?.expires_at ?? null,
          }
        : {}),
      self: row.account_id === options.accountId,
      ...(row.second_parent ? { secondParent: true as const } : {}),
    };
  });
}

/** Ending a role today stops access on the next request. The invitation goes
 * too. A school is never left without an admin: that button isn't offered. */
export async function endStaff(
  repo: SchoolRepository,
  orgId: string,
  personId: string,
  actorPersonId: string | null,
) {
  return repo.transaction((client) =>
    endStaffIn(client, repo, orgId, personId, actorPersonId),
  );
}

/** `endStaff` in a transaction the caller holds. A family's second parent is
 * one of its staff: ending her ends that too, and the family may invite
 * another (src/family/second-parent.ts). */
export async function endStaffIn(
  client: PoolClient,
  repo: SchoolRepository,
  orgId: string,
  personId: string,
  actorPersonId: string | null,
) {
  // The family's row first, in the order inviting and accepting take it.
  await client.query(
    "SELECT 1 FROM amp_families WHERE second_parent=$1 FOR UPDATE",
    [personId],
  );
  await staffPerson(client, repo, orgId, personId);
  const org = await repo.org(client, orgId);
  const others = await client.query(
    `SELECT 1 FROM amp_org_roles r JOIN amp_orgs o ON o.id=r.org_id
     JOIN amp_people p ON p.id=r.person_id AND p.deleted_at IS NULL AND p.account_id IS NOT NULL
     WHERE r.role='admin' AND r.person_id<>$1 AND o.path @> ARRAY[$2]::uuid[] AND ${activeToday("r", "o")} LIMIT 1`,
    [personId, org.path[0]],
  );
  if (!others.rowCount) {
    const isAdmin = await client.query(
      `SELECT 1 FROM amp_org_roles r JOIN amp_orgs o ON o.id=r.org_id
       WHERE r.person_id=$1 AND r.role='admin' AND ${activeToday("r", "o")} LIMIT 1`,
      [personId],
    );
    if (isAdmin.rowCount) throw new SchoolError(409, "last_admin");
  }
  const today = await repo.today(client, org.timezone);
  await client.query(
    `UPDATE amp_org_roles r SET end_on=$2 FROM amp_orgs o
     WHERE r.person_id=$1 AND r.role<>'student' AND r.end_on IS NULL AND o.id=r.org_id AND o.path @> ARRAY[$3]::uuid[]`,
    [personId, today, org.id],
  );
  await client.query(
    `UPDATE amp_enrollments e SET end_on=$2 FROM amp_classes c JOIN amp_orgs o ON o.id=c.org_id
     WHERE e.person_id=$1 AND e.role<>'student' AND e.end_on IS NULL AND c.id=e.class_id AND o.path @> ARRAY[$3]::uuid[]`,
    [personId, today, org.id],
  );
  await client.query(
    "UPDATE amp_person_credentials SET revoked_at=now() WHERE person_id=$1 AND kind='invite' AND revoked_at IS NULL",
    [personId],
  );
  await client.query(
    "UPDATE amp_families SET second_parent=NULL WHERE second_parent=$1",
    [personId],
  );
  await recordEvent(client, {
    orgId: org.id,
    actorPersonId,
    action: "staff.ended",
    targetKind: "person",
    targetId: personId,
  });
  return { ended: true };
}

/** Which classes a staff member teaches here. */
export async function setStaffClasses(
  repo: SchoolRepository,
  orgId: string,
  personId: string,
  raw: unknown,
  actorPersonId: string | null,
) {
  const { classIds } = setClassesSchema.parse(raw);
  return repo.transaction(async (client) => {
    await staffPerson(client, repo, orgId, personId);
    const org = await repo.org(client, orgId);
    const today = await repo.today(client, org.timezone);
    let role = (
      await client.query(
        `SELECT r.role FROM amp_org_roles r JOIN amp_orgs o ON o.id=r.org_id
         WHERE r.person_id=$1 AND r.role IN ('teacher','aide') AND ${activeToday("r", "o")}
         ORDER BY array_position(ARRAY['teacher','aide'],r.role) LIMIT 1`,
        [personId],
      )
    ).rows[0]?.role as "teacher" | "aide" | undefined;
    // An admin who takes a class teaches here from now on: a head of a small
    // school, a tutor or a parent runs the place and teaches its class.
    if (!role && classIds.length) {
      const admin = await client.query(
        `SELECT 1 FROM amp_org_roles r JOIN amp_orgs o ON o.id=r.org_id
         WHERE r.person_id=$1 AND r.role='admin' AND r.org_id=ANY($2::uuid[])
           AND ${activeToday("r", "o")}`,
        [personId, org.path],
      );
      if (admin.rowCount) {
        await client.query(
          `INSERT INTO amp_org_roles(id,person_id,org_id,role,begin_on) VALUES($1,$2,$3,'teacher',$4)
           ON CONFLICT (person_id,org_id,role) WHERE end_on IS NULL DO NOTHING`,
          [randomUUID(), personId, org.id, today],
        );
        role = "teacher";
      }
    }
    if (!role) throw new SchoolError(409, "class_staff_must_teach");
    await client.query(
      `UPDATE amp_enrollments e SET end_on=$2 FROM amp_classes c JOIN amp_orgs o ON o.id=c.org_id
       WHERE e.person_id=$1 AND e.role<>'student' AND e.end_on IS NULL AND c.id=e.class_id
         AND o.path @> ARRAY[$3]::uuid[] AND NOT (e.class_id=ANY($4::uuid[]))`,
      [personId, today, org.id, classIds],
    );
    for (const classId of classIds) {
      const home = await repo.classIn(client, classId, org.path);
      await repo.enroll(client, home.id, personId, role, today);
    }
    await recordEvent(client, {
      orgId: org.id,
      actorPersonId,
      action: "staff.classes-changed",
      targetKind: "person",
      targetId: personId,
      detail: { after: { classIds } },
    });
    return { classIds };
  });
}

/** What a link's holder sees before signing in: which school, which role, and
 * who it was sent to, so they can use that address. The token is the
 * credential; the route takes it in the body, which the request log skips. */
export async function lookupInvite(
  repo: SchoolRepository,
  raw: unknown,
): Promise<InviteView | null> {
  const { token } = inviteLookupSchema.parse(raw);
  const row = (
    await repo.pool.query(
      `SELECT c.revoked_at,c.expires_at,p.email,p.account_id,o.name,r.role,o.setup_pending,
         (SELECT k.name FROM amp_families f JOIN amp_classes k ON k.id=f.class_id
           WHERE f.second_parent=p.id) AS family_class
       FROM amp_person_credentials c JOIN amp_people p ON p.id=c.person_id
       JOIN amp_org_roles r ON r.person_id=p.id AND r.role<>'student'
       JOIN amp_orgs o ON o.id=r.org_id
       WHERE c.kind='invite' AND c.lookup_hash=$1
       ORDER BY r.end_on IS NULL DESC,r.created_at DESC LIMIT 1`,
      [hash(token)],
    )
  ).rows[0];
  if (!row) return null;
  return {
    status: row.revoked_at
      ? row.account_id
        ? "used"
        : "ended"
      : new Date(row.expires_at) <= new Date()
        ? "expired"
        : "open",
    orgName: row.name,
    role: row.role,
    email: row.email,
    setup: row.role === "admin" && row.setup_pending === true,
    ...(row.family_class
      ? { secondParent: { className: row.family_class } }
      : {}),
  };
}

/** Binds to whichever signed-in account accepts, because a teacher may sign in
 * with a different address than the one the school has. If the mailed link's
 * proof came with it and this account has that address, the address is now
 * confirmed, and no second mail is needed. Single use. */
export async function acceptInvite(
  repo: SchoolRepository,
  accountId: string,
  raw: unknown,
) {
  const input = acceptInviteSchema.parse(raw);
  return repo.transaction(async (client) => {
    // A family's second parent: the family's row first, in the order
    // inviting and removing her take it (src/family/second-parent.ts).
    const family = (
      await client.query<{ account_id: string; second_parent: string }>(
        `SELECT f.account_id,f.second_parent FROM amp_families f
         WHERE f.second_parent=(SELECT c.person_id FROM amp_person_credentials c
           WHERE c.kind='invite' AND c.lookup_hash=$1) FOR UPDATE OF f`,
        [hash(input.token)],
      )
    ).rows[0];
    const invite = (
      await client.query(
        `SELECT c.id,c.person_id,c.revoked_at,c.expires_at,c.secret_hash
         FROM amp_person_credentials c WHERE c.kind='invite' AND c.lookup_hash=$1 FOR UPDATE`,
        [hash(input.token)],
      )
    ).rows[0];
    if (!invite) throw new SchoolError(404, "invite_not_found");
    const person = (
      await client.query(
        "SELECT id,tenant_id,email,account_id FROM amp_people WHERE id=$1 FOR UPDATE",
        [invite.person_id],
      )
    ).rows[0];
    if (invite.revoked_at) {
      if (person?.account_id === accountId)
        return { accepted: true, ...(await joinedOrg(client, person.id)) };
      throw new SchoolError(410, "invite_used");
    }
    if (new Date(invite.expires_at) <= new Date())
      throw new SchoolError(410, "invite_expired");
    if (family)
      await secondParentMayAccept(client, {
        holder: family.account_id,
        invited: person.email,
        accountId,
        proven: !!input.proof && hash(input.proof) === invite.secret_hash,
      });
    const already = (
      await client.query(
        "SELECT id FROM amp_people WHERE tenant_id=$1 AND account_id=$2 AND deleted_at IS NULL",
        [person.tenant_id, accountId],
      )
    ).rows[0];
    let personId: string = person.id;
    if (already) {
      await moveStaffRecords(client, person.id, already.id);
      personId = already.id;
    } else {
      const words = input.name?.trim().split(/\s+/);
      await client.query(
        `UPDATE amp_people SET account_id=$2,given_name=COALESCE($3,given_name),family_name=CASE WHEN $3::text IS NULL THEN family_name ELSE $4 END WHERE id=$1`,
        [
          person.id,
          accountId,
          words
            ? (words.length > 1 ? words.slice(0, -1) : words).join(" ")
            : null,
          words && words.length > 1 ? words.at(-1) : null,
        ],
      );
    }
    await client.query(
      "UPDATE amp_person_credentials SET revoked_at=now() WHERE id=$1",
      [invite.id],
    );
    const proven =
      !!input.proof &&
      !!person.email &&
      hash(input.proof) === invite.secret_hash &&
      accountId.startsWith("amp|");
    if (proven)
      await client.query(
        `UPDATE amp_auth_users SET "emailVerified"=true,"updatedAt"=now()
         WHERE id=$1 AND lower(email)=lower($2) AND NOT "emailVerified"`,
        [accountId.slice(4), person.email],
      );
    // Her family points at the person who holds her account here.
    if (family)
      await client.query(
        "UPDATE amp_families SET second_parent=$2 WHERE account_id=$1",
        [family.account_id, personId],
      );
    await markStaffAccount(client, accountId);
    const org = await joinedOrg(client, personId);
    if (org.orgId)
      await recordEvent(client, {
        orgId: org.orgId,
        actorPersonId: personId,
        action: "staff.accepted",
        targetKind: "person",
        targetId: personId,
      });
    return { accepted: true, ...org };
  });
}

/** Where an accepted invitation leads: the school, and whether its admin is
 * still setting it up; for a family's second parent, the family's class. */
async function joinedOrg(client: PoolClient, personId: string) {
  const row = (
    await client.query(
      `SELECT r.org_id,o.setup_pending AND EXISTS(SELECT 1 FROM amp_org_roles a
         WHERE a.person_id=r.person_id AND a.org_id=r.org_id AND a.role='admin' AND a.end_on IS NULL) AS setup,
         (SELECT f.class_id FROM amp_families f WHERE f.second_parent=r.person_id) AS family_class
       FROM amp_org_roles r JOIN amp_orgs o ON o.id=r.org_id
       WHERE r.person_id=$1 AND r.role<>'student' AND r.end_on IS NULL
       ORDER BY r.created_at DESC LIMIT 1`,
      [personId],
    )
  ).rows[0];
  return {
    orgId: (row?.org_id as string | undefined) ?? null,
    setup: row?.setup === true,
    ...(row?.family_class ? { familyClassId: row.family_class as string } : {}),
  };
}

/** A family's second parent accepts only as the address the invitation went
 * to, confirmed by its provider, by its confirmation link, or by this mailed
 * link's proof: her account sees the family's children and practices free.
 * The account holder is already the family's first parent. */
async function secondParentMayAccept(
  client: PoolClient,
  {
    holder,
    invited,
    accountId,
    proven,
  }: {
    holder: string;
    invited: string | null;
    accountId: string;
    proven: boolean;
  },
) {
  if (accountId === holder) throw new SchoolError(403, "invite_wrong_account");
  const user = accountId.startsWith("amp|")
    ? ((
        await client.query<{ email: string; emailVerified: boolean }>(
          'SELECT email,"emailVerified" FROM amp_auth_users WHERE id=$1',
          [accountId.slice(4)],
        )
      ).rows[0] ?? null)
    : null;
  if (
    !user ||
    !invited ||
    user.email.trim().toLowerCase() !== invited.trim().toLowerCase()
  )
    throw new SchoolError(403, "invite_wrong_account");
  if (!user.emailVerified && !proven)
    throw new SchoolError(403, "invite_email_unconfirmed");
}

/** An account that already has a person in this tenant keeps that one; the
 * invited person's roles and classes move to it, and the empty row is retired. */
async function moveStaffRecords(
  client: PoolClient,
  fromId: string,
  toId: string,
) {
  await client.query(
    `UPDATE amp_org_roles r SET person_id=$2 WHERE r.person_id=$1 AND r.role<>'student'
     AND NOT EXISTS(SELECT 1 FROM amp_org_roles k WHERE k.person_id=$2 AND k.org_id=r.org_id AND k.role=r.role AND k.end_on IS NULL)`,
    [fromId, toId],
  );
  await client.query(
    `UPDATE amp_enrollments e SET person_id=$2 WHERE e.person_id=$1 AND e.role<>'student'
     AND NOT EXISTS(SELECT 1 FROM amp_enrollments k WHERE k.person_id=$2 AND k.class_id=e.class_id AND k.role=e.role AND k.end_on IS NULL)`,
    [fromId, toId],
  );
  await client.query(
    "UPDATE amp_people SET deleted_at=now(),given_name='Removed',family_name=NULL,display_name=NULL,email=NULL WHERE id=$1",
    [fromId],
  );
}
