/**
 * A small reader for `ParamSchema.validate`.
 *
 * Every family validates the same four shapes — a bounded integer, a bounded
 * bigint-free count, a string from a closed set, a boolean — and the first two
 * families that wrote it by hand disagreed about whether a missing key was
 * `undefined` or an error. The reader settles that once: a missing key, a key of
 * the wrong type and a key out of range are all *issues*, all reported together,
 * and `finish` refuses to hand back a value while any issue stands.
 *
 * Collecting rather than throwing matters for the validator's output: CG-7 prints
 * every issue a binding has, and a reader that threw on the first one would make a
 * six-field mistake take six runs to fix.
 */

import type { ParamIssue, ParamResult } from "../../types/generator.ts";

export type Reader = {
  /** A safe integer in `[lo, hi]`. Returns `lo` after recording an issue. */
  int(path: string, lo: number, hi: number): number;
  /** One of `allowed`. Returns the first allowed value after recording an issue. */
  choice<T extends string>(path: string, allowed: readonly T[]): T;
  boolean(path: string): boolean;
  /** Record a cross-field issue the individual readers cannot see. */
  reject(path: string, message: string): void;
  /** True when nothing has gone wrong yet, so cross-field checks can be skipped. */
  clean(): boolean;
  finish<P>(value: P): ParamResult<P>;
};

export function reader(raw: unknown): Reader {
  const issues: ParamIssue[] = [];
  const record: Record<string, unknown> | null =
    typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : null;
  if (record === null) issues.push({ path: "", message: "params must be an object" });

  const reject = (path: string, message: string): void => {
    issues.push({ path, message });
  };

  return {
    int(path: string, lo: number, hi: number): number {
      const value = record?.[path];
      if (typeof value !== "number" || !Number.isSafeInteger(value)) {
        reject(path, `${path} must be an integer`);
        return lo;
      }
      if (value < lo || value > hi) {
        reject(path, `${path} must be ${String(lo)}..${String(hi)}, got ${String(value)}`);
        return lo;
      }
      return value;
    },

    choice<T extends string>(path: string, allowed: readonly T[]): T {
      const value = record?.[path];
      const first = allowed[0];
      if (first === undefined) throw new RangeError(`choice: ${path} has no allowed values`);
      if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
        reject(path, `${path} must be one of ${allowed.join(", ")}`);
        return first;
      }
      return value as T;
    },

    boolean(path: string): boolean {
      const value = record?.[path];
      if (typeof value !== "boolean") {
        reject(path, `${path} must be a boolean`);
        return false;
      }
      return value;
    },

    reject,
    clean: () => issues.length === 0,

    finish<P>(value: P): ParamResult<P> {
      return issues.length === 0 ? { ok: true, value } : { ok: false, issues };
    },
  };
}
