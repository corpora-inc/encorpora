import type { ComponentPropsWithRef } from "react";

/**
 * Every form in the app (`npm run lint:controls` fails on a raw `<form>`).
 *
 * It never shows the browser's validation bubble (`noValidate`). Submitting
 * checks every field's constraints first: each field that fails says why in
 * its own reserved line (ui/field-validation.ts), the first one takes focus,
 * and `onSubmit` runs only once all of them pass.
 */
export function Form({ onSubmit, ...props }: ComponentPropsWithRef<"form">) {
  return (
    <form
      {...props}
      noValidate
      onSubmit={(event) => {
        // `checkValidity()` fires `invalid` at each failing field, which
        // shows its message and cancels the browser's bubble.
        if (!event.currentTarget.checkValidity()) {
          event.preventDefault();
          event.currentTarget
            .querySelector<HTMLElement>(
              "input:invalid, textarea:invalid, select:invalid",
            )
            ?.focus();
          return;
        }
        onSubmit?.(event);
      }}
    />
  );
}
