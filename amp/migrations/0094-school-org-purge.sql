-- School event history stays append-only for every application writer. Only the
-- operator's delete-org command, inside a transaction that sets
-- amp.retention_purge to 'school-org', may delete the events of an org it is
-- removing entirely. UPDATE is refused always.
CREATE OR REPLACE FUNCTION amp_school_event_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' AND current_setting('amp.retention_purge',true)='school-org' THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'School event history is append-only';
END;
$$;
