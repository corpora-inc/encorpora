import { Pool, type PoolConfig } from "pg";

/** Each API process shares one pool; separate job processes have their own budget. */
export function databasePoolMax(env: NodeJS.ProcessEnv = process.env): number {
  const value = env.AMP_DATABASE_POOL_MAX;
  if (value === undefined) return 10;
  const max = Number(value);
  if (!/^[0-9]+$/.test(value) || !Number.isSafeInteger(max) || max < 2)
    throw new Error("AMP_DATABASE_POOL_MAX must be an integer of at least 2");
  return max;
}

export function createDatabasePool(config: Omit<PoolConfig, "max">): Pool {
  return new Pool({ ...config, max: databasePoolMax() });
}
