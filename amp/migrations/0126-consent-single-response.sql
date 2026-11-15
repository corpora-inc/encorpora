-- Email-plus consent completes on the parent's first affirmative response. The
-- delayed confirmatory message is a notice with revocation, not a second
-- response. Complete current requests that were waiting on that response; their
-- queued confirmatory notice still goes out.
WITH completed AS (
  UPDATE amp_consent_requests r SET phase='active',completed_at=now()
  FROM amp_consent_policy p
  WHERE r.phase='awaiting-confirmation' AND r.initial_at IS NOT NULL AND r.expires_at>now()
    AND p.singleton AND p.enabled AND p.reviewed_until>now()
    AND p.digest=r.policy_digest AND p.generation=r.policy_generation
  RETURNING r.id,r.account_id,r.notice
)
INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference)
SELECT account_id,notice->>'version','internal-email-plus-v1',id::text FROM completed
ON CONFLICT(account_id) DO UPDATE SET policy_version=EXCLUDED.policy_version,
  verification_method=EXCLUDED.verification_method,evidence_reference=EXCLUDED.evidence_reference,
  recorded_at=now(),withdrawn_at=NULL;
