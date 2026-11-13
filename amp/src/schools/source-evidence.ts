import { createHash, randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { PoolClient } from "pg";
import { SchoolError } from "./contracts.js";
import type { RosterRow } from "./sources/rows.js";

type Period = { startsOn?: string; endsOn?: string };
type ImportEvidence = {
  evidence: RosterRow["sourceEvidence"];
  classDigest: string;
  roleIds?: Record<string, string>;
  enrollmentIds?: Record<string, string>;
};
export const rosterClassDigest = (row: RosterRow) =>
  createHash("sha256").update(JSON.stringify(row.classes)).digest("hex");
const supported = (role: string): role is "student" | "teacher" | "aide" =>
  ["student", "teacher", "aide"].includes(role);

/** Keep source scope and every dated membership alongside its explicit identity
 * binding. Only selected-school teaching/student roles become AMP memberships.
 * A file import is additive: omitted rows never remove manual or prior roles. */
export async function applySourceEvidence(
  db: PoolClient,
  args: {
    tenantId: string;
    orgId: string;
    personId: string;
    source: string;
    row: RosterRow;
    classIds: Map<string, string>;
    today: string;
    scope?: { classId: string };
  },
): Promise<boolean> {
  const { tenantId, orgId, personId, source, row, classIds, today, scope } =
    args;
  const evidence = row.sourceEvidence;
  if (!evidence) return false;
  const bucket = scope ? "classImports" : "schoolImports",
    target = scope?.classId ?? orgId,
    classDigest = rosterClassDigest(row);
  const old = (
    await db.query(
      `SELECT metadata->$5->$6 AS data FROM amp_external_refs
    WHERE tenant_id=$1 AND source=$2 AND kind='person' AND sourced_id=$3 AND local_id=$4`,
      [tenantId, source, row.sourcedId, personId, bucket, target],
    )
  ).rows[0]?.data as ImportEvidence | undefined;
  if (
    isDeepStrictEqual(old?.evidence, evidence) &&
    old?.classDigest === classDigest
  )
    return false;
  const roleIds: Record<string, string> = Object.assign(
      Object.create(null),
      old?.roleIds,
    ),
    enrollmentIds: Record<string, string> = Object.assign(
      Object.create(null),
      old?.enrollmentIds,
    );
  // A classroom CSV/OneRoster copy authorizes only this target class. Preserve
  // source evidence without applying any school-wide or extra-class roles.
  if (!scope) {
    const put = async (
      table: "amp_org_roles" | "amp_enrollments",
      placeId: string,
      role: string,
      period: Period,
      owned: string | undefined,
    ) => {
      const column = table === "amp_org_roles" ? "org_id" : "class_id";
      const existing = owned
        ? (
            await db.query(
              `SELECT id FROM ${table} WHERE id=$1 AND person_id=$2 AND ${column}=$3 AND role=$4`,
              [owned, personId, placeId, role],
            )
          ).rows[0]
        : null;
      if (existing) {
        if (!period.endsOn) {
          const conflict = (
            await db.query(
              `SELECT 1 FROM ${table} WHERE person_id=$1 AND ${column}=$2 AND role=$3 AND end_on IS NULL AND id<>$4`,
              [personId, placeId, role, owned],
            )
          ).rowCount;
          if (conflict)
            throw new SchoolError(409, "source_membership_conflict");
        }
        await db.query(
          `UPDATE ${table} SET begin_on=COALESCE($2::date,begin_on),end_on=$3 WHERE id=$1`,
          [owned, period.startsOn ?? null, period.endsOn ?? null],
        );
        return owned;
      }
      const open = !period.endsOn
        ? (
            await db.query(
              `SELECT id,begin_on::text FROM ${table} WHERE person_id=$1 AND ${column}=$2 AND role=$3 AND end_on IS NULL`,
              [personId, placeId, role],
            )
          ).rows[0]
        : null;
      if (open) {
        if (period.startsOn && open.begin_on !== period.startsOn)
          throw new SchoolError(409, "source_membership_conflict");
        return undefined; // A manual role satisfies it; this source never owns it.
      }
      const id = randomUUID();
      await db.query(
        `INSERT INTO ${table}(id,person_id,${column},role,begin_on,end_on) VALUES($1,$2,$3,$4,$5,$6)`,
        [
          id,
          personId,
          placeId,
          role,
          period.startsOn ?? today,
          period.endsOn ?? null,
        ],
      );
      return id;
    };
    const roles = evidence.roles.filter(
      (role) =>
        supported(role.role) &&
        (!role.orgSourcedId || role.orgSourcedId === evidence.schoolSourcedId),
    );
    for (const role of [...new Set(evidence.enrollments.map((e) => e.role))])
      if (!roles.some((item) => item.role === role)) {
        const memberships = evidence.enrollments
          .filter((e) => e.role === role)
          .map((e) => ({ startsOn: e.startsOn ?? today, endsOn: e.endsOn }))
          .sort((a, b) => a.startsOn.localeCompare(b.startsOn));
        const intervals: Period[] = [];
        for (const membership of memberships) {
          const previous = intervals.at(-1);
          if (
            previous &&
            membership.startsOn <= (previous.endsOn ?? "9999-12-31")
          ) {
            previous.endsOn =
              !previous.endsOn || !membership.endsOn
                ? undefined
                : previous.endsOn > membership.endsOn
                  ? previous.endsOn
                  : membership.endsOn;
          } else intervals.push({ ...membership });
        }
        // Derive the union of teaching dates, preserving gaps between terms.
        // Exact source enrollment intervals remain in their own rows/evidence.
        intervals.forEach((period, index) =>
          roles.push({
            role,
            sourcedId: `derived:${role}:${index}`,
            orgSourcedId: evidence.schoolSourcedId,
            ...period,
          }),
        );
      }
    for (const role of roles) {
      const key =
        role.sourcedId ??
        `${role.orgSourcedId ?? evidence.schoolSourcedId}:${role.role}`;
      const owned = await put(
        "amp_org_roles",
        orgId,
        role.role,
        role,
        roleIds[key],
      );
      if (owned) roleIds[key] = owned;
    }
    for (const enrollment of evidence.enrollments) {
      const classId = classIds.get(enrollment.classSourcedId);
      if (!classId) throw new SchoolError(400, "source_class_missing");
      const owned = await put(
        "amp_enrollments",
        classId,
        enrollment.role,
        enrollment,
        enrollmentIds[enrollment.sourcedId],
      );
      if (owned) enrollmentIds[enrollment.sourcedId] = owned;
    }
  }
  await db.query(
    `UPDATE amp_external_refs SET metadata=metadata||jsonb_build_object($5::text,
    COALESCE(metadata->$5,'{}'::jsonb)||jsonb_build_object($6::text,$7::jsonb))
    WHERE tenant_id=$1 AND source=$2 AND kind='person' AND sourced_id=$3 AND local_id=$4`,
    [
      tenantId,
      source,
      row.sourcedId,
      personId,
      bucket,
      target,
      JSON.stringify({ evidence, classDigest, roleIds, enrollmentIds }),
    ],
  );
  return true;
}
