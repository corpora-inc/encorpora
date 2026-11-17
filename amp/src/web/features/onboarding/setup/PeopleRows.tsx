import { Button } from "../../../ui/Button";
import { TextField } from "../../../ui/TextField";
import { YearField } from "../../../ui/YearField";
import styles from "./Setup.module.css";

/* The rows of people a parent or a tutor adds: a name and a birth year
   each, saved where the caller says. Setup's kids and students, and adding
   a child to a family over its own screens, draw the same rows. */

export type Row = {
  key: string;
  label: string;
  name: string;
  year: string;
  /** Already saved: Remove only when the row takes `onRemove`. Its year
   * shows, and can be corrected when the row takes `onYear`. */
  fixed?: boolean;
  onName: (name: string) => void;
  /** The name field was left: save what was typed. */
  onCommit?: () => void;
  onYear?: (year: string) => void;
  onRemove?: () => void;
  /** This row is being saved. */
  busy?: boolean;
};

/** A row's name field, one cell of the rows' grid. */
const nameCell = {
  root: styles.cell!,
  head: styles.cellHead!,
  label: styles.cellLabel!,
  input: styles.nameInput!,
  note: styles.cellNote!,
};

/** Each child: a name field whose placeholder is what they go by if it stays
 * blank ("Child 2"), a birth year in the shared field style that opens the
 * year tiles, and, for a new row, Remove. One line from 560 px, under column
 * labels; stacked with its own labels on a phone. A row that still needs its
 * year says so at that field, once Next is asked for. */
export function People({
  field,
  rows,
  invalid,
  nameNote,
  missingYear,
  disabled,
  add,
}: {
  field: { label: string; placeholder: string; max: number };
  rows: Row[];
  invalid: number;
  /** The invalid name's problem, said under it. */
  nameNote: string;
  /** Show "Choose a year" at each row without one. */
  missingYear: boolean;
  disabled: boolean;
  add: { label: string; onAdd: () => void } | null;
}) {
  return (
    <div className={styles.people}>
      {rows.length > 0 && (
        <div className={styles.columns} aria-hidden="true">
          <span>{field.label}</span>
          <span>Birth year</span>
          <span />
        </div>
      )}
      <ol className={styles.rows}>
        {rows.map((row, at) => {
          const needsYear = missingYear && !row.fixed && !row.year;
          // Named by what the parent typed, else the row's own name.
          const remove = row.onRemove && (
            <RemoveRow
              label={`Remove ${row.name.trim() || row.label}`}
              disabled={disabled || !!row.busy}
              onRemove={row.onRemove}
            />
          );
          return (
            <li key={row.key} className={styles.person}>
              {/* On a phone, Remove sits on the name's label line, at the
                  field's right edge: part of the child, not of the field. */}
              <TextField
                cell={nameCell}
                label={field.label}
                action={
                  remove && <span className={styles.headRemove}>{remove}</span>
                }
                error={invalid === at ? nameNote : undefined}
                value={row.name}
                placeholder={row.label}
                maxLength={field.max}
                autoComplete="off"
                autoCapitalize="words"
                spellCheck={false}
                aria-invalid={invalid === at || undefined}
                aria-label={`${field.label}, ${row.label} (${field.placeholder.toLowerCase()})`}
                disabled={disabled || row.busy}
                onChange={(event) => row.onName(event.target.value)}
                onBlur={row.onCommit}
              />
              <div className={styles.cell}>
                <span className={styles.cellLabel} aria-hidden="true">
                  Birth year
                </span>
                {row.fixed && !row.onYear ? (
                  <span className={styles.fixedYear}>{row.year || "—"}</span>
                ) : (
                  <YearField
                    label={`Birth year, ${row.name.trim() || row.label}`}
                    earlier
                    placeholder="Choose"
                    value={row.year}
                    disabled={disabled || row.busy}
                    invalid={needsYear}
                    onChange={(value) => row.onYear?.(value)}
                  />
                )}
                <span className={styles.cellNote} aria-live="polite">
                  {needsYear ? "Choose a year" : ""}
                </span>
              </div>
              <span className={styles.removeCell}>{remove}</span>
            </li>
          );
        })}
      </ol>
      {add && (
        <Button
          type="button"
          variant="secondary"
          className={styles.addRow}
          disabled={disabled}
          onClick={add.onAdd}
        >
          {add.label}
        </Button>
      )}
    </div>
  );
}

/** A row's Remove: a muted mark with a full-size target. */
function RemoveRow({
  label,
  disabled,
  onRemove,
}: {
  label: string;
  disabled: boolean;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.remove}
      aria-label={label}
      disabled={disabled}
      onClick={onRemove}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="m4 4 8 8m0-8-8 8" />
      </svg>
    </button>
  );
}
