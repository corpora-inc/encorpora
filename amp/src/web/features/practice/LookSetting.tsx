import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useState, type CSSProperties } from "react";
import type { Look } from "../../../learning/look";
import { AppError } from "../../lib/AppError";
import { LockMark } from "../school/classroom/SettingMeta";
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
 * How practice looks for one learner: Calm or Colorful. Shown the same in a
 * child's settings and in the learner's own drawer. Locked by a class, it
 * is disabled and says so in the label row, which is always there, so
 * nothing moves when it loads or changes.
 */
export function LookSetting({
  scope,
  flush = false,
  adult = false,
}: {
  /** No side inset, for a list whose rows already have none. */
  flush?: boolean;
  /** A grown-up's view of the child (their settings): may change a look a
   * parent locked, and holds or frees it with the lock. The child's own
   * menu is not this. */
  adult?: boolean;
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
  const by = data?.lookLockedBy ?? null;
  // A class's lock holds for everyone; a parent's holds for the child.
  const locked = by === "class" || (by === "adult" && !adult);
  const lock = async (on: boolean) => {
    setBusy(true);
    try {
      await adjust.change({ kind: "lookLock", locked: on });
    } catch (failure) {
      console.error("The look lock didn’t save", failure);
      setError(
        failure instanceof AppError && failure.message
          ? failure.message
          : "That change didn’t save. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  // The hue under the thumb while it moves; null when it rests.
  const [picking, setPicking] = useState<number | null>(null);
  /** Shows a hue on the page behind the menu at once, with no turn. */
  const preview = (hue: number) => {
    const root = document.documentElement;
    root.setAttribute(ARRIVING, "");
    root.style.setProperty("--look-hue", `${hue}deg`);
    setPicking(hue);
  };
  /** Saves the color they keep, or (null) a new one with every problem. */
  const keep = async (hue: number | null) => {
    document.documentElement.removeAttribute(ARRIVING);
    setPicking(null);
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
  // Where the thumb sits: the hue being picked, the one kept, or the one on
  // the page now.
  const shownHue = picking ?? kept ?? hueOnScreen() ?? 0;
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
  return (
    <div
      className={`${styles.look} ${flush ? styles.flush : ""}`}
      data-look-setting=""
    >
      <div className={`${styles.head} ${adult ? styles.tall : ""}`}>
        <span>Look</span>
        {adult && by !== "class" ? (
          <button
            type="button"
            className={styles.lock}
            aria-pressed={by === "adult"}
            disabled={!data || busy}
            onClick={() => void lock(by !== "adult")}
          >
            <LockMark open={by !== "adult"} />
            Lock
          </button>
        ) : (
          <span className={styles.why}>
            {by === "class"
              ? "Set by the class"
              : by === "adult"
                ? "Set by a parent"
                : ""}
          </span>
        )}
      </div>
      <Segmented
        label="Look"
        options={OPTIONS}
        value={data?.effectiveLook ?? null}
        compact
        dense
        disabled={!data || locked || busy}
        onChange={(next) => {
          if (next !== data?.effectiveLook) void choose(next);
        }}
      />
      {/* The learner's own menu only: the color is theirs, whoever chose the
          look. Always there, so choosing a look moves nothing; in Calm it
          has nothing to choose. */}
      {!adult && (
        <>
          <div className={styles.head}>
            <span id={colorLabel}>Color</span>
          </div>
          <div className={styles.colors} data-off={colorful ? undefined : ""}>
            <button
              type="button"
              className={styles.wheel}
              aria-label="A new color every problem"
              aria-pressed={colorful && kept === null && picking === null}
              disabled={!colorful || busy}
              onClick={() => void keep(null)}
            />
            <input
              type="range"
              className={styles.hue}
              aria-labelledby={colorLabel}
              min={0}
              max={359}
              step={1}
              value={shownHue}
              data-turning={kept === null && picking === null ? "" : undefined}
              style={{ "--look-pick-hue": `${shownHue}deg` } as CSSProperties}
              disabled={!colorful || busy}
              onChange={(event) => preview(Number(event.target.value))}
              // The choice is made when the thumb is let go, moved or not (a
              // tap on it keeps the color on screen), or a key has moved it.
              onPointerUp={(event) =>
                void keep(Number(event.currentTarget.value))
              }
              onKeyUp={() => {
                // Only a key that moved it: arriving here by Tab keeps nothing.
                if (picking !== null) void keep(picking);
              }}
              onBlur={() => {
                if (picking !== null) void keep(picking);
              }}
            />
          </div>
        </>
      )}
      <Toast message={error} onDismiss={() => setError("")} />
    </div>
  );
}
