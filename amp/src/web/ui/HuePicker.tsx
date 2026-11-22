import { useState, type CSSProperties } from "react";
import styles from "./HuePicker.module.css";

/**
 * One hue of the circle, 0 to 359, or none: a wheel for "every one in turn"
 * and a row of every hue. `onPreview` fires as the thumb moves, so the page
 * can follow it; `onChoose` fires once, when the thumb is let go (moved or
 * not: a tap on it chooses the hue it sits on), a key has moved it, or the
 * wheel is pressed (null). One target tall whatever its state.
 */
export function HuePicker({
  labelledBy,
  wheelLabel,
  value,
  resting,
  disabled = false,
  onPreview,
  onChoose,
}: {
  /** The id of the visible label the row is named by. */
  labelledBy: string;
  /** What the wheel does, for those who can't see it. */
  wheelLabel: string;
  /** The hue chosen; null while the wheel is. */
  value: number | null;
  /** Where the thumb rests while no hue is chosen. */
  resting: number;
  disabled?: boolean;
  onPreview: (hue: number) => void;
  onChoose: (hue: number | null) => void;
}) {
  // The hue under the thumb while it moves; null when it rests.
  const [moving, setMoving] = useState<number | null>(null);
  const shown = moving ?? value ?? resting;
  const choose = (hue: number | null) => {
    setMoving(null);
    onChoose(hue);
  };
  return (
    <div className={styles.colors} data-off={disabled ? "" : undefined}>
      <button
        type="button"
        className={styles.wheel}
        aria-label={wheelLabel}
        aria-pressed={!disabled && value === null && moving === null}
        disabled={disabled}
        onClick={() => choose(null)}
      />
      <input
        type="range"
        className={styles.hue}
        aria-labelledby={labelledBy}
        min={0}
        max={359}
        step={1}
        value={shown}
        data-turning={value === null && moving === null ? "" : undefined}
        style={{ "--look-pick-hue": `${shown}deg` } as CSSProperties}
        disabled={disabled}
        onChange={(event) => {
          const hue = Number(event.target.value);
          setMoving(hue);
          onPreview(hue);
        }}
        onPointerUp={(event) => choose(Number(event.currentTarget.value))}
        onKeyUp={() => {
          // Only a key that moved it: arriving here by Tab chooses nothing.
          if (moving !== null) choose(moving);
        }}
        onBlur={() => {
          if (moving !== null) choose(moving);
        }}
      />
    </div>
  );
}
