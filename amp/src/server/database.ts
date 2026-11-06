import { Pool, type PoolConfig } from "pg";

/** Each API process shares one pool; separate job processes have their own budget. */
export function databasePoolMax(env: NodeJS.ProcessEnv = process.env): number {
  const value = env.AMP_DATABASE_POOL_MAX;
  if (value === undefined) {
    const hosted =
      env.NODE_ENV === "production" ||
      env.AMP_AUTH_MODE === "accounts" ||
      env.AMP_AUTH_MODE === "oidc";
    return hosted ? 6 : 10;
  }
  const max = Number(value);
  if (!/^[0-9]+$/.test(value) || !Number.isSafeInteger(max) || max < 2)
    throw new Error("AMP_DATABASE_POOL_MAX must be an integer of at least 2");
  return max;
}

/** The long-running API keeps one connection open, so the next parent on a
 * quiet server doesn't wait for a reconnect. Short-lived jobs leave these unset:
 * an idle connection would keep them from exiting. */
export const serverPoolOptions = {
  min: 1,
  idleTimeoutMillis: 60_000,
  keepAlive: true,
} satisfies PoolConfig;

export function createDatabasePool(config: Omit<PoolConfig, "max">): Pool {
  return new Pool({ ...config, max: databasePoolMax() });
}
