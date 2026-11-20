-- PortalOnly is Clever's default staff role ("the standard portal experience";
-- SchoolTechLead adds Clever-side powers), not a "no app access" marker.
-- Every school administrator in Clever's Certification ISD is PortalOnly.
-- A source-owned admin role stays current for a district administrator, or for
-- current staff of exactly the school the role is held at, whatever their
-- Clever staff sub-role. Both still require an active connection, an unexpired
-- bootstrap and a signed-in identity whose claims agree with the roster.
CREATE OR REPLACE FUNCTION amp_school_role_current(role_id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT NOT EXISTS(
  SELECT 1 FROM amp_clever_memberships m JOIN amp_clever_connections c ON c.id=m.connection_id
   JOIN amp_org_roles r ON r.id=m.local_id JOIN amp_people p ON p.id=r.person_id
  WHERE m.kind='org_role' AND m.local_id=$1 AND m.owned AND r.role='admin'
   AND (c.status<>'active' OR m.bootstrap_valid_until<=now() OR NOT (
     EXISTS(
      SELECT 1 FROM amp_clever_bindings b WHERE b.connection_id=c.id AND b.kind='user'
        AND b.local_id=p.id AND b.archived_at IS NULL AND b.metadata->'roles' @> '["district_admin"]'::jsonb
        AND NOT EXISTS(SELECT 1 FROM amp_provider_identities i WHERE i.account_id=p.account_id
          AND i.environment=c.environment AND i.district_id=c.district_id AND i.subject=b.clever_id
          AND NOT i.claims->'roles' @> '["district_admin"]'::jsonb))
     OR EXISTS(
      SELECT 1 FROM amp_clever_bindings b JOIN amp_clever_bindings s
        ON s.connection_id=c.id AND s.kind='school' AND s.local_id=r.org_id AND s.archived_at IS NULL
       WHERE b.connection_id=c.id AND b.kind='user' AND b.local_id=p.id AND b.archived_at IS NULL
        AND b.metadata->'roles' @> '["staff"]'::jsonb
        AND (b.record->'roles'->'staff'->>'school'=s.clever_id
          OR COALESCE(b.record->'roles'->'staff'->'schools','[]'::jsonb) ? s.clever_id)
        AND NOT EXISTS(SELECT 1 FROM amp_provider_identities i WHERE i.account_id=p.account_id
          AND i.environment=c.environment AND i.district_id=c.district_id AND i.subject=b.clever_id
          AND NOT i.claims->'roles' @> '["staff"]'::jsonb))
   ))
 )
$$;
