/**
 * The one accessor for a student's reported uncertainty on a stored level day,
 * as SQL over an `amp_level_days` row aliased `alias`. Every school read of a
 * student's sd goes through here, so moving to the calibrated reported sd is
 * this one line.
 */
export const levelSdSql = (alias = "d") =>
  `(${alias}.frontier->'overall'->>'sd')::float8`;
