-- A change of what a class's students may see ("Allow Colorful", at the
-- class, a school or district above it, or for one child by a grown-up) is
-- one more thing the live outbox says: `settings`. A student's open screen
-- hears it on the stream it already holds and reads its settings again, so
-- the change reaches the screen in about a second, with nothing asked of the
-- server per problem. A row with a person is that student's own; without
-- one, the whole class's.
ALTER TABLE amp_class_events DROP CONSTRAINT amp_class_events_kind_check;
ALTER TABLE amp_class_events ADD CONSTRAINT amp_class_events_kind_check
  CHECK(kind IN ('answer','help','presence','session','signal','settings'));
