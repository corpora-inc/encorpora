-- Scheduling evidence belongs to the financial request, not an adult access
-- projection. Existing saved provider payloads retain their exact dates too.
ALTER TABLE amp_funding_requests ADD COLUMN scheduled_term jsonb;
