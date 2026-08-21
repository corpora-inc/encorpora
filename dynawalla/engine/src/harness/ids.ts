/** Branding helpers, so the harness reads like the app without importing it. */

import type { SkillId } from "../types.ts";

export function skillId(value: string): SkillId {
  return value;
}
