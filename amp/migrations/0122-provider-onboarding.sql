-- Reauthorization proves an identity without restoring revoked school access.
-- Only the connection setup endpoints accept an onboarding credential.
ALTER TABLE amp_provider_sessions ADD COLUMN purpose text NOT NULL DEFAULT 'session'
 CHECK(purpose IN ('session','onboarding'));
