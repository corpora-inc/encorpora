import { CheckboxControl } from "../../ui/Checkbox";
import {
  prepareFeedbackSound,
  useFeedbackPreferences,
} from "./feedback-preferences";
import settings from "./DrawerSettings.module.css";

export function FeedbackPreferences() {
  const preferences = useFeedbackPreferences();
  const haptics = typeof navigator.vibrate === "function";
  return (
    <fieldset className={settings.section}>
      <legend>Answer feedback</legend>
      <label className={settings.toggle}>
        <span>Sound</span>
        <CheckboxControl
          checked={preferences.sound}
          onChange={(event) => {
            preferences.set("sound", event.target.checked);
            prepareFeedbackSound();
          }}
        />
      </label>
      {haptics && (
        <label className={settings.toggle}>
          <span>Haptics</span>
          <CheckboxControl
            checked={preferences.haptics}
            onChange={(event) =>
              preferences.set("haptics", event.target.checked)
            }
          />
        </label>
      )}
    </fieldset>
  );
}
