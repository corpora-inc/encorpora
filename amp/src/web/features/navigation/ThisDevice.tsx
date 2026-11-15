import { Switch } from "../../ui/Switch";
import {
  prepareFeedbackSound,
  useFeedbackPreferences,
} from "../practice/feedback-preferences";
import settings from "../practice/DrawerSettings.module.css";

/**
 * This device's own preferences, quiet at the foot of a parent's menu: an
 * answer's sound and haptics. Each takes effect at once and stays on this
 * device. Whether a child sees grade levels is theirs, on their settings
 * (family/Practice.tsx), never a device's.
 */
export function ThisDevice() {
  const preferences = useFeedbackPreferences();
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
    </fieldset>
  );
}
