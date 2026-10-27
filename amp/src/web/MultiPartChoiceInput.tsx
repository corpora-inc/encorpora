import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useId, useState, type CSSProperties, type FormEvent } from "react";
import { MathText, spokenMath } from "./MathText";
import {
  chooseOption,
  chosenCount,
  draftChoices,
  multiPartMarks,
  type MultiPartBlank,
  type MultiPartChoiceResponse,
  type PartMark,
} from "../math/multi-part-choice";

/* Multi-part choice: one option per blank, row or slot. Every control keeps
   its size from the first frame (a blank is as wide as its widest option),
   menus open over the page, and review marks are drawn inside the controls,
   so choosing, checking and feedback never move anything. Styles live in
   multi-part-choice.css; this module also loads under Node. */

const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);
/** Closing punctuation that opens a sentence part: ".", ",", ")." and so on. */
const trailingPunctuation = (text: string) =>
  /^[.,;:!?)]+/.exec(text)?.[0] ?? "";

/** Review marks for a resolved problem: each blank's choice and answer. */
export function partsReview(
  response: MultiPartChoiceResponse,
  answer: string,
  chosen: string,
): PartMark[] | null {
  try {
    return multiPartMarks(response, answer, chosen);
  } catch (failure) {
    console.error("AMP multi-part review could not be drawn:", failure);
    return null;
  }
}

function BlankPicker({
  blank,
  value,
  onChoose,
  disabled,
  mark,
}: {
  blank: MultiPartBlank;
  value: string | undefined;
  onChoose: (optionId: string) => void;
  disabled: boolean;
  mark?: PartMark;
}) {
  const [open, setOpen] = useState(false);
  const chosen = blank.options.find((o) => o.id === value);
  const name = capitalize(spokenMath(blank.label));
  const state = !mark
    ? undefined
    : mark.correct
      ? "correct"
      : chosen
        ? "incorrect"
        : "missed";
  const verdict = !mark
    ? ""
    : mark.correct
      ? ", correct"
      : `, ${chosen ? "incorrect" : "not answered"}. The answer is ${spokenMath(mark.expected.label)}`;
  return (
    <DropdownMenu.Root
      open={open && !disabled}
      onOpenChange={setOpen}
      modal={false}
    >
      <DropdownMenu.Trigger asChild disabled={disabled}>
        <button
          type="button"
          className="multi-part-blank"
          data-blank={blank.id}
          data-filled={chosen ? "" : undefined}
          data-mark={state}
          aria-label={`${name}: ${chosen ? spokenMath(chosen.label) : "not chosen"}${verdict}`}
        >
          {/* Every option is laid out in one cell; only the chosen one shows,
              so the blank never changes width. */}
          <span className="multi-part-blank-stack" aria-hidden="true">
            <span
              className="multi-part-blank-value multi-part-placeholder"
              data-shown={chosen ? undefined : ""}
            >
              Choose
            </span>
            {blank.options.map((o) => (
              <span
                key={o.id}
                className="multi-part-blank-value"
                data-shown={o.id === value ? "" : undefined}
              >
                <MathText text={o.label} />
              </span>
            ))}
          </span>
          <svg
            className="multi-part-chevron"
            viewBox="0 0 12 12"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M2.5 4.5 6 8l3.5-3.5" />
          </svg>
          {state && (
            <span className="multi-part-mark" aria-hidden="true">
              {state === "correct" ? "✓" : "✕"}
            </span>
          )}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="multi-part-menu"
          align="start"
          sideOffset={6}
          collisionPadding={16}
          loop
          aria-label={name}
        >
          <DropdownMenu.Label className="multi-part-menu-label">
            <MathText text={capitalize(blank.label)} />
          </DropdownMenu.Label>
          <DropdownMenu.RadioGroup
            value={value ?? ""}
            onValueChange={(next) => onChoose(next)}
          >
            {blank.options.map((o) => (
              <DropdownMenu.RadioItem
                key={o.id}
                value={o.id}
                className="multi-part-option"
              >
                <span className="multi-part-option-check" aria-hidden="true">
                  <DropdownMenu.ItemIndicator>✓</DropdownMenu.ItemIndicator>
                </span>
                <span className="multi-part-option-label">
                  <MathText text={o.label} />
                </span>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** The blanks, table or slots of the problem itself. */
export function MultiPartChoiceInput({
  response,
  value,
  onChange,
  locked,
  review,
}: {
  response: MultiPartChoiceResponse;
  value: string;
  onChange: (value: string) => void;
  locked: boolean;
  /** After an answer or a skip: each blank's choice and answer. */
  review: PartMark[] | null;
}) {
  const group = useId();
  const chosen = draftChoices(response, value);
  const choose = (blankId: string, optionId: string) => {
    if (!locked) onChange(chooseOption(response, value, blankId, optionId));
  };
  const markOf = (blankId: string) =>
    review?.find((m) => m.blank.id === blankId);
  const picker = (blank: MultiPartBlank) => (
    <BlankPicker
      blank={blank}
      value={chosen[blank.id]}
      onChoose={(optionId) => choose(blank.id, optionId)}
      disabled={locked}
      mark={markOf(blank.id)}
    />
  );
  if (response.layout === "table") {
    const columns = response.blanks[0]!.options;
    return (
      <div
        className="multi-part"
        data-layout="table"
        role="group"
        aria-label={spokenMath(response.label)}
      >
        <table
          className="multi-part-table"
          style={{ "--columns": columns.length } as CSSProperties}
        >
          <thead>
            <tr>
              <th scope="col">{response.rowHeader ?? ""}</th>
              {columns.map((c) => (
                <th scope="col" key={c.id}>
                  <MathText text={c.label} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {response.blanks.map((row) => {
              const mark = markOf(row.id);
              return (
                <tr key={row.id} data-blank={row.id}>
                  <th scope="row">
                    <MathText text={row.label} />
                  </th>
                  {columns.map((c) => {
                    const selected = chosen[row.id] === c.id;
                    const key = mark?.expected.id === c.id;
                    const state = !mark
                      ? undefined
                      : selected
                        ? key
                          ? "correct"
                          : "incorrect"
                        : key && !mark.correct
                          ? "answer"
                          : undefined;
                    return (
                      <td key={c.id}>
                        <label
                          className="multi-part-cell"
                          data-selected={selected ? "" : undefined}
                          data-mark={state}
                        >
                          <input
                            type="radio"
                            name={`${group}-${row.id}`}
                            value={c.id}
                            checked={selected}
                            disabled={locked}
                            onChange={() => choose(row.id, c.id)}
                            aria-label={`${spokenMath(row.label)}: ${spokenMath(c.label)}${
                              state === "correct"
                                ? ", correct"
                                : state === "incorrect"
                                  ? ", incorrect"
                                  : state === "answer"
                                    ? ", the answer"
                                    : ""
                            }`}
                          />
                          <span className="multi-part-radio" aria-hidden="true">
                            {state === "correct"
                              ? "✓"
                              : state === "incorrect"
                                ? "✕"
                                : ""}
                          </span>
                          {/* Narrow screens stack each row; its options
                              then name their column. */}
                          <span
                            className="multi-part-cell-text"
                            aria-hidden="true"
                          >
                            <MathText text={c.label} />
                          </span>
                        </label>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }
  if (response.layout === "slots")
    return (
      <div
        className="multi-part"
        data-layout="slots"
        role="group"
        aria-label={spokenMath(response.label)}
      >
        <ol className="multi-part-slots">
          {response.blanks.map((blank) => (
            <li key={blank.id}>
              <span className="multi-part-slot-label" aria-hidden="true">
                <MathText text={capitalize(blank.label)} />
              </span>
              {picker(blank)}
            </li>
          ))}
        </ol>
      </div>
    );
  return (
    <div
      className="multi-part"
      data-layout="inline"
      role="group"
      aria-label={spokenMath(response.label)}
    >
      <p className="multi-part-sentence">
        {(response.sentence ?? []).map((part, i, parts) => {
          if ("text" in part) {
            // Punctuation right after a blank travels with that blank.
            const text =
              i > 0 && "blank" in parts[i - 1]!
                ? part.text.slice(trailingPunctuation(part.text).length)
                : part.text;
            if (!text) return null;
            return (
              <span key={i} aria-hidden="true">
                <MathText text={text} />
              </span>
            );
          }
          const blank = response.blanks.find((b) => b.id === part.blank)!;
          const next = parts[i + 1];
          const glued =
            next && "text" in next ? trailingPunctuation(next.text) : "";
          // A blank and its punctuation share a line, so a full-width blank
          // never leaves a lone period on the next one.
          return (
            <span key={i} className={glued ? "multi-part-glued" : undefined}>
              {picker(blank)}
              {glued && <span aria-hidden="true">{glued}</span>}
            </span>
          );
        })}
      </p>
      {/* The sentence, read once in full for screen readers. */}
      <p className="sr-only">
        {spokenMath(
          (response.sentence ?? [])
            .map((part) => ("text" in part ? part.text : " blank "))
            .join(""),
        )}
      </p>
    </div>
  );
}

/** The dock: how many parts are chosen, Clear and Check. */
export function MultiPartChoiceAnswer({
  response,
  value,
  onChange,
  locked,
  busy,
  resolved,
  submit,
}: {
  response: MultiPartChoiceResponse;
  value: string;
  onChange: (value: string) => void;
  locked: boolean;
  busy: boolean;
  resolved: boolean;
  submit: () => void;
}) {
  const count = chosenCount(response, value);
  const total = response.blanks.length;
  const complete = count === total;
  return (
    <form
      className="multi-part-form"
      aria-label={spokenMath(response.label)}
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        if (!busy && !resolved && complete) submit();
      }}
    >
      <p className="multi-part-count" role="status" aria-live="polite">
        {count} of {total} chosen
      </p>
      <div className="multi-part-actions">
        <button
          type="button"
          className="secondary multi-part-clear"
          disabled={locked || count === 0}
          onClick={() => onChange("")}
        >
          Clear
        </button>
        <button
          className="choice-submit multi-part-check"
          type="submit"
          disabled={busy || resolved || !complete}
          aria-busy={busy}
        >
          Check
        </button>
      </div>
    </form>
  );
}
