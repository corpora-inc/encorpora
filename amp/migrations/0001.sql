CREATE TABLE amp_learners (
 id text PRIMARY KEY, account_id text NOT NULL, name text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX amp_learners_account_idx ON amp_learners(account_id);
CREATE TABLE amp_instances (
 id text PRIMARY KEY, learner_id text NOT NULL REFERENCES amp_learners(id) ON DELETE CASCADE,
 content jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX amp_instances_learner_idx ON amp_instances(learner_id);
CREATE TABLE amp_attempts (
 id text PRIMARY KEY, learner_id text NOT NULL REFERENCES amp_learners(id) ON DELETE CASCADE,
 problem_id text NOT NULL REFERENCES amp_instances(id) ON DELETE CASCADE,
 request_id text NOT NULL, outcome jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT amp_attempts_request_idx UNIQUE(learner_id,request_id),
 CONSTRAINT amp_attempts_problem_idx UNIQUE(problem_id)
);
CREATE TABLE amp_grants (
 id text PRIMARY KEY, learner_id text NOT NULL REFERENCES amp_learners(id) ON DELETE CASCADE,
 channel text NOT NULL CHECK(channel IN ('pilot','stripe','apple','google','esa')),
 external_order_id text NOT NULL, status text NOT NULL CHECK(status IN ('active','revoked')),
 starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL CHECK(ends_at > starts_at),
 CONSTRAINT amp_grants_source_idx UNIQUE(channel,external_order_id)
);
CREATE TABLE amp_content_releases (
 id text PRIMARY KEY, version integer NOT NULL, manifest jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
