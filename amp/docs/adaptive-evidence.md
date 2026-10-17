# Practice evidence and strand selection

AMP selects mixed practice from implemented problem families. Its scheduling rules organize useful practice; they are not a calibrated mastery estimate, a grade placement test, or a prediction of a standardized-test score. Curriculum links alone do not establish that a learner has demonstrated a skill.

Each skill has a durable evidence summary derived from retained attempts: total attempts, independent correct answers, the latest five outcomes, the latest independent success, and a retrieval schedule. Summaries exclude response text, answers and explanations. An outcome records whether a hint or lesson was used. An assisted answer contributes an attempt but no independent success. A skill is marked **review-ready** only when at least five attempts exist, at least four of the latest five are independently correct, and the latest attempt is independently correct. Errors and assistance return it to **practicing**.

Retrieval intervals are six hours, one day, three days, seven days, fourteen days and thirty days. A correct independent retrieval advances that schedule only if at least six hours have elapsed since the last credited retrieval. A burst of answers cannot manufacture several spaced retrievals. An error or assisted answer resets spacing. These are explicit scheduling rules, not estimates of memory strength. Response speed does not affect them.

## Independent strands

Each strand has its own observed challenge range. A correct advanced algebra answer does not raise an untouched geometry strand, and a multiplication error does not lower the algebra range. The range uses observed independent successes in that strand and its latest three outcomes. A recent run of independent success permits exploration one broad grade band higher; repeated difficulty lowers that strand's suggested range. A previously attempted skill can return for support or review even if it is above the suggested range.

Demonstrated prerequisites can make a task in another strand eligible. A successful exploratory task never grants evidence to unobserved ancestors. When a learner struggles, the planner crosses unimplemented curriculum nodes to find the nearest implemented prerequisite needing practice. That search does not certify intermediate skills.

The latest global attempts are used only for interleaving. Selection discourages immediate same-skill repetition and reserves an eligible support or due-review task within a batch. A batch contains at most five problems. Reservations apply within the generated batch; unused problems in another device's batch are not a cross-device reservation system.

Selection reasons are:

- **prerequisite**: practice an implemented prerequisite of a struggling skill;
- **revisit**: return to a skill after an error or assistance;
- **review**: retrieve a skill whose scheduled interval has elapsed;
- **frontier**: a task whose listed prerequisites have demonstrated review readiness;
- **explore**: an unconfirmed challenge, with no implied prerequisite credit.

## Storage and privacy

Migration `0008-skill-evidence.sql` builds summaries from the attempts present in the database. Missing or deleted history is not reconstructed. Historical ordering uses the stored creation time and attempt ID. Future attempts receive a monotonically increasing ingestion sequence while holding the learner lock, so equal timestamps and concurrent requests have a defined order. Original attempt facts are retained unchanged.

An insertion trigger updates the corresponding summary in the attempt transaction. A rejected duplicate attempt or a rolled-back transaction adds no evidence. Reads use one row per observed skill and an indexed twelve-attempt recency window; they do not rescan the full attempt history for every batch or progress request.

Parent exports identify summaries as `derived-skill-evidence`. Learning-data deletion purges summaries and attempt history, including when an opaque learner record must be retained for billing. Consent withdrawal blocks new learning writes under the existing account lock; it does not itself delete retained history.

Apply the migration with learning writers stopped before starting an application version that reads the projection. Back up the database and test the migration against a representative isolated database first. Historical backfill is a transactional, bounded-memory replay and its duration grows with retained attempts. Test fixtures must use a dedicated database or isolated schema. This design does not establish throughput or latency at millions of learners; load testing and operational capacity work are separate release requirements.
