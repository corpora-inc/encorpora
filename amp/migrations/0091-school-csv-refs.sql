-- A CSV knows a class, or a person with no student ID, only by name, and a name
-- means something only inside the school the file is for: two schools in a
-- district each have a "Grade 3 Math". From here on the reconciler keeps those
-- references per school (`<school id>/name:...`); this moves the ones already
-- made. Student IDs and teacher emails stay the whole tenant's.
UPDATE amp_external_refs x
SET sourced_id = c.org_id::text || '/' || x.sourced_id
FROM amp_classes c
WHERE x.source = 'csv' AND x.kind = 'class' AND x.sourced_id LIKE 'name:%'
  AND c.id = x.local_id;

UPDATE amp_external_refs x
SET sourced_id = r.org_id::text || '/' || x.sourced_id
FROM (
  SELECT DISTINCT ON (r.person_id) r.person_id, r.org_id
  FROM amp_org_roles r JOIN amp_orgs o ON o.id = r.org_id AND o.kind = 'school'
  ORDER BY r.person_id, r.end_on IS NULL DESC, r.begin_on DESC
) r
WHERE x.source = 'csv' AND x.kind = 'person' AND x.sourced_id LIKE 'name:%'
  AND r.person_id = x.local_id;
