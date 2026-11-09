/** SQL: the learner `learner` (an internal SQL expression, never request
 * input) is a made-up student of a demo place. Reports leave them out: a demo
 * is never usage, revenue or acquisition. */
export const demoLearnerSql = (learner: string) =>
  `EXISTS(SELECT 1 FROM amp_people demo_person JOIN amp_orgs demo_org ON demo_org.id=demo_person.tenant_id
    WHERE demo_person.learner_id=${learner} AND demo_org.demo)`;

/** SQL: a demo student (`person`, an internal SQL expression) was here, so
 * their demo stays another `idleDemoDays`; at most hourly, and nothing for
 * anyone else. For a data-modifying CTE on the student's own request. */
export const touchDemoOfPersonSql = (person: string) =>
  `UPDATE amp_orgs demo_org SET demo_seen_at=now() FROM amp_people demo_person
   WHERE demo_person.id=${person} AND demo_org.id=demo_person.tenant_id
     AND demo_org.demo AND demo_org.demo_seen_at<now()-interval '1 hour'`;
