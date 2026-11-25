import { resolveLook } from "../../src/learning/look";
import {
  allowsColorful,
  defaultPracticeSettings,
  type PracticeSettings,
  type PracticeState,
} from "../../src/learning/practice-settings";

/**
 * What the API answers for `/learners/:id/practice-state`
 * (server/practice-settings.ts `practiceState`), for a browser check that
 * stands in for it: the settings with the look that applies (no class here)
 * and who holds it. The bare settings are not that answer: practice reads it
 * with `practiceStateSchema`, which needs the look.
 */
export function practiceStateFixture(
  settings: PracticeSettings = defaultPracticeSettings(),
  points?: number,
): PracticeState {
  const { look, locked, lockedBy } = resolveLook({
    own: settings.look,
    ownOff: !allowsColorful(settings),
    classes: [],
  });
  return {
    ...settings,
    effectiveLook: look,
    lookLocked: locked,
    lookLockedBy: lockedBy,
    ...(points === undefined ? {} : { points }),
  };
}
