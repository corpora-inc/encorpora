import { useCurrentLearner } from "../../learner-store";
import { useAddressedIdentity } from "../spaces/useAddressed";
import { useSessionOrNull } from "../../lib/session";
import { Switch } from "../../ui/Switch";
import { LookSetting } from "./LookSetting";
import {
  prepareFeedbackSound,
  useFeedbackPreferences,
} from "./feedback-preferences";
import settings from "./DrawerSettings.module.css";

/** The look for one learner, when the menu has one whose it is. */
function LearnerLook({ named }: { named: string | null }) {
  const session = useSessionOrNull();
  const addressed = useAddressedIdentity();
  const current = useCurrentLearner();
  const learnerId = named ?? addressed?.id ?? current;
  if (!session || !learnerId) return null;
  return (
    <LookSetting
      scope={{
        identity: session.accountId,
        learnerId,
        token: session.token,
      }}
    />
  );
}

/**
 * An answer's sound and haptics, this device's own preferences, the one
 * control for them in every menu (a parent's, a learner's): each a switch,
 * since each takes effect at once and stays on this device. Whether a child
 * sees grade levels is theirs, on their settings (family/Practice.tsx),
 * never a device's. A learner's own menu adds how practice looks (theirs,
 * not this device's) beside them.
 */
export function FeedbackPreferences({
  learning = false,
  learnerId = null,
}: {
  /** The menu is a learner's own, so it has their look to set. */
  learning?: boolean;
  /** Whose, when the screen names them; else the learner on screen. */
  learnerId?: string | null;
}) {
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
      {learning && <LearnerLook named={learnerId} />}
    </fieldset>
  );
}
