import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type FormEvent,
  type Ref,
  type RefCallback,
} from "react";

/**
 * One validation pattern for every field (ui/Form.tsx, ui/TextField.tsx).
 *
 * A field's rules are its native constraints (`required`, `type="email"`,
 * `minLength`, `pattern`), so autofill and phone keyboards still know what it
 * holds, but the browser never draws its own bubble: forms are `noValidate`
 * and a field cancels its `invalid` event. The field says what is wrong in
 * its own reserved line instead:
 *
 * - on blur, once something was typed (an untouched field waits for submit);
 * - on submit, when ui/Form checks the form (`checkValidity()` fires
 *   `invalid` at each field that fails);
 * - while typing, a showing message clears the moment the value is valid,
 *   and a new message never appears mid-word.
 */

/** A field's own words for a broken rule, in place of the defaults. */
export type FieldMessages = {
  /** Nothing entered. */
  missing?: string;
  /** Shorter than `minLength`. */
  tooShort?: string;
  /** Doesn't match `pattern` (a code's digits). */
  pattern?: string;
};

const lowerFirst = (text: string) =>
  /^[A-Z][a-z’']/.test(text) ? text[0]!.toLowerCase() + text.slice(1) : text;

/**
 * What is wrong with an email address, and how to fix it, in one short line
 * (it must fit one line of a 320 px phone: nothing moves when it appears).
 * Empty when the address is complete.
 */
export function emailProblem(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  const at = value.indexOf("@");
  if (at < 0) return "Include an @, as in name@example.com.";
  if (at === 0) return "Add the name before the @.";
  const domain = value.slice(at + 1);
  if (!domain) return "Finish the address after the @.";
  if (domain.includes("@") || /\s/.test(value))
    return "Enter one address, like name@example.com.";
  if (!/^[^.]+(\.[^.]+)+$/.test(domain) || /\.$/.test(domain))
    return "Add the ending, such as .com.";
  return "";
}

/** A rule the browser doesn't check: a blank-only required value, or an
 * address the server would refuse ("name@example" with no ending). */
function customProblem(input: HTMLInputElement): string {
  // A password may be any characters, spaces too.
  if (
    input.required &&
    input.type !== "password" &&
    input.value !== "" &&
    !input.value.trim()
  )
    return "blank";
  if (input.type === "email" && input.value && !input.validity.typeMismatch)
    return emailProblem(input.value);
  return "";
}

/** The message for a field's first broken rule, or "" when it is valid. */
export function fieldMessage(
  input: HTMLInputElement,
  label: string,
  messages: FieldMessages = {},
): string {
  const v = input.validity;
  if (v.valid) return "";
  const email = input.type === "email";
  const missing =
    messages.missing ??
    (email ? "Enter an email address." : `Enter the ${lowerFirst(label)}.`);
  if (v.valueMissing || input.validationMessage === "blank") return missing;
  if (email && (v.typeMismatch || v.customError))
    return (
      emailProblem(input.value) || "Enter an address like name@example.com."
    );
  if (v.tooShort)
    return messages.tooShort ?? `Use at least ${input.minLength} characters.`;
  if (v.patternMismatch)
    return messages.pattern ?? `Check the ${lowerFirst(label)} and try again.`;
  return `Check the ${lowerFirst(label)} and try again.`;
}

function assign<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) (ref as { current: T | null }).current = value;
}

type InputHandlers = {
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
  onInvalid?: (event: FormEvent<HTMLInputElement>) => void;
};

/**
 * A field's validation state: the message it shows (a caller's `error`
 * wins) and the handlers and ref its input takes. The caller's own
 * handlers and ref still run.
 */
export function useFieldValidation({
  label,
  error,
  messages,
  value,
  ref,
  onChange,
  onBlur,
  onInvalid,
}: InputHandlers & {
  label: string;
  error?: string;
  messages?: FieldMessages;
  value: unknown;
  ref?: Ref<HTMLInputElement>;
}) {
  const [shown, setShown] = useState("");
  const input = useRef<HTMLInputElement | null>(null);
  const edited = useRef(false);
  // The value as last typed, to tell a form's own reset from typing.
  const typed = useRef("");
  // The custom rules follow the value, however it changed (typing, a reset,
  // autofill), so a form's submit check always sees them.
  useLayoutEffect(() => {
    const node = input.current;
    if (node) node.setCustomValidity(customProblem(node));
  }, [value]);
  const check = (node: HTMLInputElement) => {
    node.setCustomValidity(customProblem(node));
    return fieldMessage(node, label, messages);
  };
  const setRef: RefCallback<HTMLInputElement> = useCallback(
    (node) => {
      input.current = node;
      assign(ref, node);
    },
    [ref],
  );
  return {
    message: error || shown,
    props: {
      ref: setRef,
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        edited.current = true;
        typed.current = event.currentTarget.value;
        // A showing message goes as soon as the value is right; while it is
        // still wrong, the same words stay (no swap mid-typing).
        if (shown && !check(event.currentTarget)) setShown("");
        onChange?.(event);
      },
      onBlur: (event: FocusEvent<HTMLInputElement>) => {
        const node = event.currentTarget;
        // Emptied by its form after a send (a changed password), not by
        // typing: the field is untouched again and waits for the next submit.
        if (!node.value && typed.current) edited.current = false;
        if (edited.current || node.value) setShown(check(node));
        onBlur?.(event);
      },
      onInvalid: (event: FormEvent<HTMLInputElement>) => {
        // Never the browser's bubble: the field's own line says it.
        event.preventDefault();
        setShown(check(event.currentTarget));
        onInvalid?.(event);
      },
    },
  };
}
