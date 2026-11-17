import { useState } from "react";
import { birthYears } from "../lib/birth-years";
import { Dialog } from "./Dialog";
import { TilePicker } from "./TileChoice";
import { Button } from "./Button";
import { TextField } from "./TextField";
import styles from "./YearField.module.css";
import { Form } from "./Form";

/**
 * A birth year as a field: the same field style as a text field beside it
 * (tokens.css --field-*) and the calendar mark of ui/DatePicker, opening the
 * year tiles the starter uses in a dialog, full screen on a phone. Every
 * birth year in the app is this field. Choosing a year closes it and focus
 * returns to the field, which reads the year. The tiles are a listbox (ui/
 * TilePicker): arrows and typing move, Enter or Space chooses, Escape
 * closes; four typed digits outside the tiles open "Earlier year…" with them.
 */
export function YearField({
  value,
  onChange,
  label,
  placeholder = "Birth year",
  disabled = false,
  invalid = false,
  adult = false,
  earlier = false,
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
  /** Enter an exact birth year outside the quick school-year choices. */
  earlier?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [entering, setEntering] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");
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
        onClick={() => {
          setEntering(earlier && !!value && Number(value) < years[0]!);
          setTyped(value);
          setError("");
          setOpen(true);
        }}
      >
        <span>{shown ?? placeholder}</span>
        {/* The calendar of ui/DatePicker: a year is a date, chosen from the
            tiles it opens, never a dropdown list. */}
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M4 5.5h12v11H4v-11Zm0 3.5h12M7.5 3v3.5M12.5 3v3.5" />
        </svg>
      </button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={label}
        fullOnPhone
        // The years take focus, the chosen one (else the first) active.
        initialFocus={entering ? "input" : '[role="listbox"]'}
      >
        {entering ? (
          <Form
            className={styles.earlier}
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const year = Number(typed);
              if (!/^\d{4}$/.test(typed) || year < 1900 || year > now - 2) {
                setError(`Enter a year from 1900 to ${now - 2}.`);
                return;
              }
              onChange(String(year));
              setOpen(false);
            }}
          >
            <TextField
              label="Birth year"
              autoFocus
              value={typed}
              inputMode="numeric"
              maxLength={4}
              error={error}
              onChange={(event) => {
                setTyped(event.target.value);
                setError("");
              }}
            />
            <Button type="submit" variant="primary">
              Use this year
            </Button>
          </Form>
        ) : (
          <>
            <TilePicker
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
                onChange(String(year));
                setOpen(false);
              }}
              columns={{ narrow: 4, wide: 4 }}
              onTypeUnmatched={
                earlier
                  ? (year) => {
                      setTyped(year);
                      setError("");
                      setEntering(true);
                    }
                  : undefined
              }
            />
            {earlier && (
              <Button
                variant="quiet"
                className={styles.otherYear}
                onClick={() => setEntering(true)}
              >
                Earlier year…
              </Button>
            )}
          </>
        )}
      </Dialog>
    </>
  );
}
