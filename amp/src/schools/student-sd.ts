/**
 * The one accessor for a student's reported uncertainty on a stored level day,
 * as SQL over an `amp_level_days` row aliased `alias`. Every school read of a
 * student's sd goes through here, so moving to the calibrated reported sd is
 * this one line. It is the frontier's reported sd, stored beside the level
 * on the index (migrations/0112-level-sd.sql), so a district's fits never
 * open a frontier.
 */
export const levelSdSql = (alias = "d") => `${alias}.overall_sd`;
