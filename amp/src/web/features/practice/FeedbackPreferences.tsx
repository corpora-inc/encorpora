import {
  prepareFeedbackSound,
  useFeedbackPreferences,
} from "./feedback-preferences";
import styles from "./FeedbackPreferences.module.css";

export function FeedbackPreferences() {
  const preferences = useFeedbackPreferences();
  const haptics = typeof navigator.vibrate === "function";
  return (
    <fieldset className={styles.preferences}>
      <legend>Answer feedback</legend>
      <label>
        <span>Sound</span>
        <input
          type="checkbox"
          checked={preferences.sound}
          onChange={(event) => {
            preferences.set("sound", event.target.checked);
            prepareFeedbackSound();
          }}
        />
      </label>
      {haptics && (
        <label>
          <span>Haptics</span>
          <input
            type="checkbox"
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
