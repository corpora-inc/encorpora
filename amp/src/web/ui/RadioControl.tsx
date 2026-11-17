import type { ComponentPropsWithRef } from "react";

/** The native radio shared by answer choices: practice's choices, figure
 * cards, a choice table's cells. The designed card or cell around it is its
 * label and draws the choice; name it with `aria-label` when the card shows
 * a figure. (CheckboxControl is its checkbox counterpart.) No stylesheet:
 * PracticeWorkspace also imports under Node for print and export. */
export function RadioControl(
  props: Omit<ComponentPropsWithRef<"input">, "type">,
) {
  return <input {...props} type="radio" />;
}
