import type { ComponentPropsWithRef } from "react";

/** The native field a learner types math into: practice's answer, a
 * structured-work cell, the calculator's expression. It never autocompletes,
 * capitalizes, autocorrects or spellchecks. With `keypad` (a phone, where
 * AMP's own keypad types) the system keyboard stays closed. No stylesheet:
 * PracticeWorkspace also imports under Node for print and export. */
export function AnswerInput({
  keypad = false,
  inputMode,
  ...props
}: ComponentPropsWithRef<"input"> & { keypad?: boolean }) {
  return (
    <input
      autoComplete="off"
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      {...props}
      inputMode={keypad ? "none" : inputMode}
    />
  );
}
