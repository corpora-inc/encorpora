import { z } from "zod";

/** What a school decides about the student experience. One schema, one
 * resolver: district → school → class → student, and a level above can lock. */
export const levelVisibilities = ["hidden", "choice", "shown"] as const;
export const standingsScopes = ["off", "class", "school", "district"] as const;
export const standingsMeasures = ["growth", "practice", "level"] as const;
export const schoolSettingsSchema = z.strictObject({
  levels: z.enum(levelVisibilities),
  standings: z.enum(standingsScopes),
  measure: z.enum(standingsMeasures),
  weeklyTargetMinutes: z.number().int().min(1).max(10_080).optional(),
});
export type SchoolSettings = z.infer<typeof schoolSettingsSchema>;
export type LevelVisibility = SchoolSettings["levels"];
export type SettingKey = keyof SchoolSettings;
const keys = Object.keys(schoolSettingsSchema.shape) as SettingKey[];

export const defaultSettings = {
  levels: "hidden",
  standings: "off",
  measure: "growth",
} as const satisfies SchoolSettings;

export type ScopeKind = "org" | "class" | "person";
export type SettingsScope = {
  kind: ScopeKind;
  id: string;
  values: Partial<Record<SettingKey, unknown>>;
  locked: readonly string[];
};
export type ScopeRef = { kind: ScopeKind; id: string };
export type ResolvedSetting<K extends SettingKey = SettingKey> = {
  value: SchoolSettings[K];
  /** The scope that set this value; null when it is the default. */
  setBy: ScopeRef | null;
  /** The scope that locked it, so lower levels can't change it. */
  lockedBy: ScopeRef | null;
};
export type ResolvedSettings = { [K in SettingKey]: ResolvedSetting<K> };

const ref = ({ kind, id }: SettingsScope): ScopeRef => ({ kind, id });

/** Pure. `chain` runs from the top: org path root first, then class, then
 * person. A stored value the schema no longer accepts is ignored, so a bad row
 * can't take a class down; a value below a lock is ignored as if unset. */
export function resolveSettings(
  chain: readonly SettingsScope[],
): ResolvedSettings {
  const resolved = Object.fromEntries(
    keys.map((key) => [
      key,
      {
        value: (defaultSettings as Partial<SchoolSettings>)[key],
        setBy: null,
        lockedBy: null,
      },
    ]),
  ) as Record<
    SettingKey,
    { value: unknown; setBy: ScopeRef | null; lockedBy: ScopeRef | null }
  >;
  for (const scope of chain)
    for (const key of keys) {
      const setting = resolved[key];
      if (setting.lockedBy) continue;
      const parsed = schoolSettingsSchema.shape[key].safeParse(
        scope.values[key],
      );
      if (parsed.success && parsed.data !== undefined) {
        setting.value = parsed.data;
        setting.setBy = ref(scope);
      }
      if (scope.locked.includes(key)) setting.lockedBy = ref(scope);
    }
  return resolved as ResolvedSettings;
}

/** Keys of `changes` that a scope above has locked. */
export function lockedKeys(
  above: readonly SettingsScope[],
  changes: Partial<SchoolSettings>,
): SettingKey[] {
  return (Object.keys(changes) as SettingKey[]).filter((key) =>
    above.some((scope) => scope.locked.includes(key)),
  );
}
/** A write to a key locked above is rejected; lower scopes never override. */
export class SettingLockedError extends Error {
  constructor(public readonly keys: SettingKey[]) {
    super(`Locked above: ${keys.join(", ")}`);
  }
}
export function assertSettingsWritable(
  above: readonly SettingsScope[],
  changes: Partial<SchoolSettings>,
): void {
  const locked = lockedKeys(above, changes);
  if (locked.length) throw new SettingLockedError(locked);
}

const restrictiveness: Record<LevelVisibility, number> = {
  hidden: 2,
  choice: 1,
  shown: 0,
};
/** A student in two classes gets the most restrictive level setting of the
 * two: whether levels show is one decision for the whole app. */
export function studentLevelVisibility(
  perEnrollment: readonly ResolvedSettings[],
): ResolvedSetting<"levels"> {
  return perEnrollment.reduce<ResolvedSetting<"levels">>(
    (strictest, { levels }) =>
      restrictiveness[levels.value] > restrictiveness[strictest.value]
        ? levels
        : strictest,
    perEnrollment[0]?.levels ?? {
      value: defaultSettings.levels,
      setBy: null,
      lockedBy: null,
    },
  );
}
