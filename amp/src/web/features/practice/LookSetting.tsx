import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import type { Look } from "../../../learning/look";
import { AppError } from "../../lib/AppError";
import { HuePicker } from "../../ui/HuePicker";
import { Segmented } from "../../ui/Segmented";
import { Toast } from "../../ui/Toast";
import {
  practiceSettingsOptions,
  usePracticeAdjustment,
  type PracticeScope,
} from "./practice-settings";
import styles from "./LookSetting.module.css";

const OPTIONS: { value: Look; label: string }[] = [
  { value: "calm", label: "Calm" },
  { value: "bold", label: "Colorful" },
];
/** No turn while a hue is tried (ui/tokens.css): the page follows the thumb. */
const ARRIVING = "data-look-arriving";
/** The hue on the page now (celebration/hue.ts paints it on `<html>`), as
 * the setting stores it; null when Colorful is not on this screen. */
function hueOnScreen(): number | null {
  const painted = Number.parseFloat(
    document.documentElement.style.getPropertyValue("--look-hue"),
  );
  return Number.isFinite(painted)
    ? ((Math.round(painted) % 360) + 360) % 360
    : null;
}

/**
 * How practice looks for one learner, in their own menu: Calm or Colorful,
 * and in Colorful the color they keep. It is theirs to choose. Where an
 * adult has Colorful off (a class, a school, a parent: "Allow Colorful"),
 * the learner is in Calm and none of this is in their menu at all: not
 * disabled, not explained, absent. Their choice is kept for when it is
 * allowed again.
 *
 * A menu reads this before it opens (look-known.ts), and the rows are
 * settled once for an opening, from what is known as it opens: there only
 * if the learner is known to have the choice. A switch flipped while the
 * menu is open, or an answer slower than the menu waits for, never takes
 * rows away or adds them under a finger; rows that turned out not to be
 * the learner's to use rest until the menu closes, and rows that were not
 * known in time are there the next time it opens.
 */
export function LookSetting({
  scope,
  flush = false,
}: {
  /** No side inset, for a list whose rows already have none. */
  flush?: boolean;
  scope: PracticeScope;
}) {
  const state = useQuery(practiceSettingsOptions(scope));
  const adjust = usePracticeAdjustment(scope);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (state.isError)
      console.error("The look setting didn’t load", state.error);
  }, [state.isError, state.error]);
  const data = state.data;
  /** Shows a hue on the page behind the menu at once, with no turn. */
  const preview = (hue: number) => {
    const root = document.documentElement;
    root.setAttribute(ARRIVING, "");
    root.style.setProperty("--look-hue", `${hue}deg`);
  };
  /** Saves the color they keep, or (null) a new one with every problem. */
  const keep = async (hue: number | null) => {
    document.documentElement.removeAttribute(ARRIVING);
    if (hue === (data?.lookHue ?? null)) return;
    setBusy(true);
    try {
      await adjust.change({ kind: "lookHue", hue });
    } catch (failure) {
      console.error("The color didn’t save", failure);
      setError(
        failure instanceof AppError && failure.message
          ? failure.message
          : "That change didn’t save. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  const colorful = data?.effectiveLook === "bold";
  const kept = colorful ? (data?.lookHue ?? null) : null;
  const colorLabel = useId();
  const choose = async (look: Look) => {
    setBusy(true);
    try {
      await adjust.change({ kind: "look", look });
    } catch (failure) {
      console.error("The look didn’t save", failure);
      setError(
        failure instanceof AppError && failure.message
          ? failure.message
          : "That change didn’t save. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  // Colorful is off for this learner (or nothing is known of it): no Look,
  // no color. Settled as the menu opens, for as long as it is open.
  const opened = useRef<boolean | null>(null);
  if (opened.current === null) opened.current = !!data && !data.lookLocked;
  if (!opened.current) return null;
  const off = !!data?.lookLocked;
  return (
    <div
      className={`${styles.look} ${flush ? styles.flush : ""}`}
      data-look-setting=""
    >
      <div className={styles.head}>
        <span>Look</span>
      </div>
      <Segmented
        label="Look"
        options={OPTIONS}
        value={data?.effectiveLook ?? null}
        compact
        dense
        disabled={busy || off}
        onChange={(next) => {
          if (next !== data?.effectiveLook) void choose(next);
        }}
      />
      {/* Always there, so choosing a look moves nothing; in Calm it has
          nothing to choose. */}
      <div className={styles.head}>
        <span id={colorLabel}>Color</span>
      </div>
      <HuePicker
        labelledBy={colorLabel}
        wheelLabel="A new color every problem"
        value={kept}
        resting={hueOnScreen() ?? 0}
        disabled={!colorful || busy || off}
        onPreview={preview}
        onChoose={(hue) => void keep(hue)}
      />
      <Toast message={error} onDismiss={() => setError("")} />
    </div>
  );
}
