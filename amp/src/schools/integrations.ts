import type { Pool } from "pg";
import { ssoProviders, type SsoProvider } from "./contracts.js";
import { recordEvent } from "./events.js";
import {
  setProviderSchema,
  type IntegrationsResponse,
  integrationRequests,
} from "./org-contracts.js";
import { activeToday } from "./principal.js";
import type { SchoolRepository } from "./repository.js";
import type { SchoolServices } from "./routes.js";
import { syncSsoCredentials } from "./sso-credentials.js";
import { YEAR_IN_USE } from "./years.js";

export const integrationLabels: Record<string, string> = {
  clever: "Clever",
  classlink: "ClassLink",
  "google-classroom": "Google Classroom",
  google: "Google",
  microsoft: "Microsoft",
};

/** What this school has connected, and which sign-ins would reach whom. */
export async function readIntegrations(
  pool: Pool,
  orgId: string,
  services: SchoolServices,
): Promise<IntegrationsResponse> {
  const [schools, students, classes, requests] = await Promise.all([
    pool.query(
      "SELECT sign_in_providers AS providers FROM amp_orgs WHERE path @> ARRAY[$1]::uuid[] AND kind='school'",
      [orgId],
    ),
    pool.query(
      `WITH here AS (
         SELECT DISTINCT p.id,lower(p.email) AS email FROM amp_people p
         JOIN amp_org_roles r ON r.person_id=p.id AND r.role='student' JOIN amp_orgs o ON o.id=r.org_id
         WHERE o.path @> ARRAY[$1]::uuid[] AND p.deleted_at IS NULL AND p.learner_id IS NOT NULL AND ${activeToday("r", "o")}
       ), shared AS (
         SELECT lower(p.email) AS email FROM amp_people p
         JOIN amp_org_roles r ON r.person_id=p.id AND r.role='student' JOIN amp_orgs o ON o.id=r.org_id
         WHERE p.tenant_id=(SELECT path[1] FROM amp_orgs WHERE id=$1) AND p.deleted_at IS NULL AND p.email IS NOT NULL AND ${activeToday("r", "o")}
         GROUP BY lower(p.email) HAVING count(DISTINCT p.id)>1
       )
       SELECT count(*)::int AS rostered,
         count(*) FILTER (WHERE email IS NULL)::int AS "noEmail",
         count(*) FILTER (WHERE email IN (SELECT email FROM shared))::int AS "sharedEmail"
       FROM here`,
      [orgId],
    ),
    pool.query(
      `SELECT count(*)::int AS classes,(array_agg(c.id ORDER BY lower(c.name),c.id))[1] AS first
       FROM amp_classes c JOIN amp_orgs o ON o.id=c.org_id JOIN amp_academic_sessions cs ON cs.id=c.session_id
       WHERE o.path @> ARRAY[$1]::uuid[] AND c.archived_at IS NULL AND ${YEAR_IN_USE}`,
      [orgId],
    ),
    pool.query(
      `SELECT DISTINCT ON (detail->'after'->>'id') detail->'after'->>'id' AS id,"at"
       FROM amp_school_events WHERE org_id=$1 AND action='integration.requested'
       ORDER BY detail->'after'->>'id',"at" DESC`,
      [orgId],
    ),
  ]);
  const requested = new Map<string, Date>(
    requests.rows.map((row) => [row.id, row.at]),
  );
  const facts = students.rows[0];
  const eligible = facts.rostered - facts.noEmail - facts.sharedEmail;
  const total = schools.rows.length;
  const at = (id: string) => requested.get(id)?.toISOString() ?? null;
  return {
    rostered: facts.rostered,
    classes: classes.rows[0].classes,
    firstClass: classes.rows[0].first,
    providers: ssoProviders.map((id) => {
      const schoolsOn = schools.rows.filter((row) =>
        row.providers.includes(id),
      ).length;
      return {
        id,
        available: !!services.oidc?.[id],
        on: total > 0 && schoolsOn === total,
        schoolsOn,
        schools: total,
        eligible,
        noEmail: facts.noEmail,
        sharedEmail: facts.sharedEmail,
        requestedAt: at(id),
      };
    }),
    requests: integrationRequests.map((id) => ({
      id,
      requestedAt: at(id),
    })),
  };
}

/** Turns an outside sign-in on or off for this school, or for every school in
 * this district. Credentials follow in the same transaction. */
export async function setProvider(
  repo: SchoolRepository,
  org: { orgId: string; path: string[] },
  raw: unknown,
  actorPersonId: string | null,
) {
  const { provider, enabled } = setProviderSchema.parse(raw);
  await repo.transaction(async (client) => {
    await client.query(
      `UPDATE amp_orgs SET sign_in_providers=CASE
         WHEN $3::boolean THEN (SELECT array_agg(DISTINCT value) FROM unnest(sign_in_providers||ARRAY[$2]::text[]) AS value)
         ELSE array_remove(sign_in_providers,$2) END
       WHERE path @> ARRAY[$1]::uuid[] AND kind='school'`,
      [org.orgId, provider, enabled],
    );
    await syncSsoCredentials(client, org.path[0]!);
    await recordEvent(client, {
      orgId: org.orgId,
      actorPersonId,
      action: "signin.provider-changed",
      targetKind: "org",
      targetId: org.orgId,
      detail: {
        after: {
          provider,
          enabled,
          label: integrationLabels[provider as SsoProvider],
        },
      },
    });
  });
}
