import type { AuthSession } from "../../auth";
import { AddChildSheet } from "../family-class/AddChildSheet";

/** Adding a child to the family, from its Today or its Settings: a name and
 * a birth year, one at a time, the sheet staying open for the next. */
export function AddKidsSheet({
  session,
  open,
  onOpenChange,
}: {
  session: AuthSession;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <AddChildSheet
      session={session}
      kind="child"
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}
