import { Switch } from "../../ui/Switch";
import { useCurriculumDetails } from "../curriculum/CurriculumDetails";
import {
  prepareFeedbackSound,
  useFeedbackPreferences,
} from "../practice/feedback-preferences";
import settings from "../practice/DrawerSettings.module.css";

/**
 * This device's own preferences, quiet at the foot of a parent's menu: an
 * answer's sound and haptics, and grade numbers for whoever practices here.
 * Each takes effect at once and stays on this device.
 */
export function ThisDevice({
  gradeNumbers = true,
  learner,
}: {
  /** Offer grade numbers: a child is chosen on this device. */
  gradeNumbers?: boolean;
  /** Whose grade numbers they are. */
  learner?: string;
}) {
  const preferences = useFeedbackPreferences();
  const details = useCurriculumDetails();
  const haptics = typeof navigator.vibrate === "function";
  return (
    <fieldset className={settings.section} data-this-device="">
      <legend>This device</legend>
      <Switch
        label="Sound"
        checked={preferences.sound}
        onChange={(on) => {
          preferences.set("sound", on);
          prepareFeedbackSound();
        }}
      />
      {haptics && (
        <Switch
          label="Haptics"
          checked={preferences.haptics}
          onChange={(on) => preferences.set("haptics", on)}
        />
      )}
      {gradeNumbers && !details.decided && (
        <Switch
          label="Grade numbers"
          detail={learner ? `For ${learner} on this device` : undefined}
          checked={details.shown}
          disabled={!details.ready}
          onChange={(on) => details.setShown(on)}
        />
      )}
    </fieldset>
  );
}
