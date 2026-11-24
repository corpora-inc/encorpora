import type { RefObject } from "react";
import { NavigationSheet, SheetClose } from "../../ui/NavigationSheet";
import { AppLogo } from "../../ui/AppLogo";
import { useShellSlots } from "../../lib/shell-slots";
import DrawerContents, { DrawerFooter } from "./DrawerContents";
import { menuLearner } from "./menu-learner";
import { useLookKnown, useMenuLook } from "../practice/look-known";
import type { SpaceDescriptor } from "../spaces/resolve";
import bar from "../../ui/AppBar.module.css";

/**
 * The app frame's one drawer, mounted once beside its bar. It opens with the
 * logo in the bar's exact spot, as its close control; it closes on that logo,
 * Escape, the scrim, or any link inside.
 *
 * A learner's own menu comes in once their look has been read for this
 * opening (practice/look-known.ts): it never paints Look rows an adult
 * turned off a moment ago.
 */
export default function ShellDrawer({
  space,
  triggerRef,
}: {
  space: SpaceDescriptor | null;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const open = useShellSlots((state) => state.drawerOpen);
  const setOpen = useShellSlots((state) => state.setDrawerOpen);
  const close = () => setOpen(false);
  const whose = menuLearner(space);
  const shown = useLookKnown(
    open && !!space,
    useMenuLook(whose.learning, whose.learnerId),
  );
  return (
    <NavigationSheet
      open={shown}
      onOpenChange={setOpen}
      onCloseAutoFocus={(event) => {
        // The shared bar owns the trigger outside Dialog.Root.
        if (triggerRef.current) {
          event.preventDefault();
          triggerRef.current.focus({ preventScroll: true });
        }
      }}
      header={
        <div className={bar.sheetBar}>
          <SheetClose asChild>
            <AppLogo
              aria-label="Close AMP menu"
              title="Close AMP menu"
              data-shell-close
            />
          </SheetClose>
        </div>
      }
      footer={<DrawerFooter close={close} />}
    >
      <DrawerContents close={close} space={space} />
    </NavigationSheet>
  );
}
