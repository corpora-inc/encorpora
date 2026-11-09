import type { RefObject } from "react";
import { NavigationSheet, SheetClose } from "../../ui/NavigationSheet";
import { AppLogo } from "../../ui/AppLogo";
import { useShellSlots } from "../../lib/shell-slots";
import DrawerContents, { DrawerFooter } from "./DrawerContents";
import type { ShellFrame } from "./shell-frame";
import bar from "../../ui/AppBar.module.css";

/**
 * The app frame's one drawer, mounted once beside its bar. It opens with the
 * logo in the bar's exact spot, as its close control; it closes on that logo,
 * Escape, the scrim, or any link inside.
 */
export default function ShellDrawer({
  frame,
  triggerRef,
}: {
  frame: ShellFrame | null;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const open = useShellSlots((state) => state.drawerOpen);
  const setOpen = useShellSlots((state) => state.setDrawerOpen);
  const close = () => setOpen(false);
  return (
    <NavigationSheet
      open={open && !!frame}
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
      <DrawerContents close={close} frame={frame} />
    </NavigationSheet>
  );
}
