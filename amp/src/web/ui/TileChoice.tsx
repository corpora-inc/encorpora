import {
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useTileListbox } from "./tile-listbox";
import styles from "./TileChoice.module.css";

export type Tile<V> = {
  value: V;
  label: ReactNode;
  /** The tile's name for a screen reader, when its label is short ("K"). */
  name?: string;
  /** Spans the whole row ("Adult") or two cells ("College"). */
  span?: "row" | 2;
};

/**
 * One choice among a grid of equal tiles: birth years, grades. Each tile is
 * paper on the page with a clear edge; the chosen one fills with the brand
 * ink. A radio group with one tab stop; the arrow keys, Home and End move
 * the choice. `clearable` lets a second tap on the chosen tile clear it, for
 * a choice that is optional (docs/design/ia.md: every optional choice has a
 * way back).
 */
export function TileChoice<V extends string | number>({
  label,
  labelledBy,
  tiles,
  value,
  onChange,
  columns = { narrow: 4, wide: 8 },
  disabled = false,
  clearable = false,
  className = "",
}: {
  label?: string;
  labelledBy?: string;
  tiles: readonly Tile<V>[];
  value: V | null;
  onChange: (value: V | null) => void;
  /** Tiles to a row on a phone, and from 560 px. */
  columns?: { narrow: number; wide: number };
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const chosen = tiles.findIndex((tile) => tile.value === value);
  const stop = chosen >= 0 ? chosen : 0;
  const move = (event: KeyboardEvent, at: number) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[
      event.key
    ];
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tiles.length - 1
          : step === undefined
            ? null
            : (at + step + tiles.length) % tiles.length;
    if (next === null) return;
    event.preventDefault();
    onChange(tiles[next]!.value);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      aria-disabled={disabled || undefined}
      className={`${styles.grid} ${className}`}
      style={
        {
          "--tiles-narrow": columns.narrow,
          "--tiles-wide": columns.wide,
        } as CSSProperties
      }
    >
      {tiles.map((tile, at) => (
        <button
          key={String(tile.value)}
          ref={(node) => {
            refs.current[at] = node;
          }}
          type="button"
          role="radio"
          aria-checked={tile.value === value}
          aria-label={tile.name}
          tabIndex={at === stop ? 0 : -1}
          disabled={disabled}
          className={styles.tile}
          data-span={tile.span}
          onClick={() =>
            onChange(clearable && tile.value === value ? null : tile.value)
          }
          onKeyDown={(event) => move(event, at)}
        >
          {tile.label}
        </button>
      ))}
    </div>
  );
}

/** The tiles' row count at this width, as TileChoice.module.css sets it. */
function columnsNow(columns: { narrow: number; wide: number }) {
  return typeof window !== "undefined" &&
    window.matchMedia?.("(min-width: 560px)").matches
    ? columns.wide
    : columns.narrow;
}

/**
 * The same tiles where choosing one is the commit: a year that closes its
 * dialog. A radio group would choose on every arrow press, so this is a
 * listbox (ui/tile-listbox): the arrows, Home, End, Page Up, Page Down and
 * typing move a focus ring over the tiles, and Enter or Space chooses.
 */
export function TilePicker<V extends string | number>({
  label,
  tiles,
  value,
  onChange,
  columns = { narrow: 4, wide: 8 },
  disabled = false,
  onTypeUnmatched,
}: {
  label: string;
  tiles: readonly (Tile<V> & { label: string })[];
  value: V | null;
  onChange: (value: V) => void;
  columns?: { narrow: number; wide: number };
  disabled?: boolean;
  /** Four typed digits that match no tile. */
  onTypeUnmatched?: (typed: string) => void;
}) {
  const { listProps, optionProps } = useTileListbox({
    labels: tiles.map((tile) => tile.name ?? tile.label),
    selected: tiles.findIndex((tile) => tile.value === value),
    onChoose: (index) => onChange(tiles[index]!.value),
    spans: tiles.map((tile) => tile.span),
    columns: () => columnsNow(columns),
    disabled,
    onTypeUnmatched,
  });
  return (
    <div
      {...listProps}
      aria-label={label}
      className={`${styles.grid} ${styles.picker}`}
      style={
        {
          "--tiles-narrow": columns.narrow,
          "--tiles-wide": columns.wide,
        } as CSSProperties
      }
    >
      {tiles.map((tile, at) => (
        <button
          key={String(tile.value)}
          type="button"
          {...optionProps(at)}
          aria-label={tile.name}
          className={styles.tile}
          data-span={tile.span}
        >
          {tile.label}
        </button>
      ))}
    </div>
  );
}
