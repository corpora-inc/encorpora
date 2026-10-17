-- An authorization epoch changes on every consent write, including same-policy re-enrollment.
CREATE SEQUENCE amp_offline_consent_revision_seq;
ALTER TABLE amp_parent_consents ADD COLUMN offline_revision bigint NOT NULL DEFAULT nextval('amp_offline_consent_revision_seq');
CREATE FUNCTION amp_rotate_offline_consent_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.offline_revision := nextval('amp_offline_consent_revision_seq'); RETURN NEW; END $$;
CREATE TRIGGER amp_rotate_offline_consent_revision BEFORE INSERT OR UPDATE ON amp_parent_consents
FOR EACH ROW EXECUTE FUNCTION amp_rotate_offline_consent_revision();
ALTER TABLE amp_grants ADD COLUMN offline_revision bigint NOT NULL DEFAULT nextval('amp_offline_consent_revision_seq');
CREATE TRIGGER amp_rotate_offline_grant_revision BEFORE INSERT OR UPDATE ON amp_grants
FOR EACH ROW EXECUTE FUNCTION amp_rotate_offline_consent_revision();
CREATE TABLE amp_offline_packs (
 id uuid PRIMARY KEY, learner_id text NOT NULL REFERENCES amp_learners(id) ON DELETE CASCADE,
 request_id uuid NOT NULL, request_digest text NOT NULL, consent_revision bigint NOT NULL,
 grant_id text NOT NULL REFERENCES amp_grants(id) ON DELETE CASCADE, grant_revision bigint NOT NULL,
 grant_start timestamptz NOT NULL, grant_end timestamptz NOT NULL,
 issued_at timestamptz NOT NULL, expires_at timestamptz NOT NULL,
 binding jsonb NOT NULL,
 signed_pack text NOT NULL CHECK(octet_length(signed_pack)<=524288),
 CHECK(expires_at>issued_at AND expires_at<=issued_at+interval '24 hours'),
 UNIQUE(learner_id,request_id)
);
CREATE INDEX amp_offline_packs_learner_time ON amp_offline_packs(learner_id,issued_at DESC);
CREATE INDEX amp_offline_packs_expiry ON amp_offline_packs(expires_at);
CREATE TABLE amp_offline_instances (
 id text PRIMARY KEY, pack_id uuid NOT NULL REFERENCES amp_offline_packs(id) ON DELETE CASCADE,
 ordinal integer NOT NULL CHECK(ordinal>=0 AND ordinal<15),
 grader_version integer NOT NULL CHECK(grader_version=1), content jsonb NOT NULL,
 UNIQUE(pack_id,ordinal), UNIQUE(pack_id,id)
);
CREATE TABLE amp_offline_attempts (
 id uuid PRIMARY KEY, pack_id uuid NOT NULL, problem_id text NOT NULL,
 request_id uuid NOT NULL, response text NOT NULL CHECK(length(response)<=100),
 correct boolean NOT NULL, received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 evidence_kind text NOT NULL DEFAULT 'offline-provisional' CHECK(evidence_kind='offline-provisional'),
 FOREIGN KEY(pack_id,problem_id) REFERENCES amp_offline_instances(pack_id,id) ON DELETE CASCADE,
 UNIQUE(pack_id,request_id), UNIQUE(problem_id)
);
CREATE FUNCTION amp_offline_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'offline records are immutable'; END $$;
CREATE TRIGGER amp_offline_pack_immutable BEFORE UPDATE ON amp_offline_packs FOR EACH ROW EXECUTE FUNCTION amp_offline_immutable();
CREATE TRIGGER amp_offline_instance_immutable BEFORE UPDATE ON amp_offline_instances FOR EACH ROW EXECUTE FUNCTION amp_offline_immutable();
CREATE TRIGGER amp_offline_attempt_immutable BEFORE UPDATE ON amp_offline_attempts FOR EACH ROW EXECUTE FUNCTION amp_offline_immutable();

CREATE TABLE amp_offline_receipts (
 pack_id uuid NOT NULL REFERENCES amp_offline_packs(id) ON DELETE CASCADE,
 request_id uuid NOT NULL, input_digest text NOT NULL, result jsonb NOT NULL,
 PRIMARY KEY(pack_id,request_id)
);
CREATE TRIGGER amp_offline_receipt_immutable BEFORE UPDATE ON amp_offline_receipts FOR EACH ROW EXECUTE FUNCTION amp_offline_immutable();
