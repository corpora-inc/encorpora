import { useState } from "react";
import { birthYears } from "../lib/birth-years";
import { Dialog } from "./Dialog";
import { TileChoice } from "./TileChoice";
import styles from "./YearField.module.css";

/**
 * A birth year as a field: the same field style as a text field beside it
 * (tokens.css --field-*), opening the year tiles the starter uses (ui/
 * TileChoice) in a dialog, full screen on a phone. Choosing a year closes it.
 */
export function YearField({
  value,
  onChange,
  label,
  placeholder = "Birth year",
  disabled = false,
  invalid = false,
  adult = false,
}: {
  value: string;
  onChange: (year: string) => void;
  /** Names the field for a screen reader: "Birth year, Child 2". */
  label: string;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  /** Offer "Adult" after the school years. */
  adult?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const now = new Date().getFullYear();
  const years = birthYears(16, 4);
  const adultYear = now - 25;
  const shown =
    value === ""
      ? null
      : adult && Number(value) === adultYear
        ? "Adult"
        : value;
  return (
    <>
      <button
        type="button"
        className={styles.field}
        aria-label={shown ? `${label}: ${shown}` : label}
        aria-haspopup="dialog"
        aria-invalid={invalid || undefined}
        data-empty={shown ? undefined : ""}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <span>{shown ?? placeholder}</span>
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path d="m3 4.5 3 3 3-3" />
        </svg>
      </button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={label}
        fullOnPhone
        // The chosen year (else the first) has focus and is in view.
        initialFocus='[role="radio"][tabindex="0"]'
      >
        <TileChoice
          label={label}
          // Oldest first: "Adult" leads, then the years in reading order.
          tiles={[
            ...(adult
              ? [{ value: adultYear, label: "Adult", span: "row" as const }]
              : []),
            ...years.map((year) => ({ value: year, label: String(year) })),
          ]}
          value={value ? Number(value) : null}
          onChange={(year) => {
            if (year === null) return;
            onChange(String(year));
            setOpen(false);
          }}
          columns={{ narrow: 4, wide: 4 }}
        />
      </Dialog>
    </>
  );
}
