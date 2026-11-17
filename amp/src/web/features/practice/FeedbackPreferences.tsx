import { Switch } from "../../ui/Switch";
import {
  prepareFeedbackSound,
  useFeedbackPreferences,
} from "./feedback-preferences";
import settings from "./DrawerSettings.module.css";

/**
 * An answer's sound and haptics, this device's own preferences, the one
 * control for them in every menu (a parent's, a learner's): each a switch,
 * since each takes effect at once and stays on this device. Whether a child
 * sees grade levels is theirs, on their settings (family/Practice.tsx),
 * never a device's.
 */
export function FeedbackPreferences() {
  const preferences = useFeedbackPreferences();
  const haptics = typeof navigator.vibrate === "function";
  return (
    <fieldset className={settings.section} data-this-device="">
      <legend>Answer feedback</legend>
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
    </fieldset>
  );
}
