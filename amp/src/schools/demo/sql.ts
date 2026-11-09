/** SQL: the learner `learner` (an internal SQL expression, never request
 * input) is a made-up student of a demo place. Reports leave them out: a demo
 * is never usage, revenue or acquisition. */
export const demoLearnerSql = (learner: string) =>
  `EXISTS(SELECT 1 FROM amp_people demo_person JOIN amp_orgs demo_org ON demo_org.id=demo_person.tenant_id
    WHERE demo_person.learner_id=${learner} AND demo_org.demo)`;
