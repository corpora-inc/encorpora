import {
  Component,
  lazy,
  Suspense,
  useState,
  type Ref,
  type ReactNode,
} from "react";
import { NavigationSheet } from "../../ui/NavigationSheet";
import { nativeRuntime } from "../../native-runtime";
const DrawerContents = lazy(() => import("./DrawerContents"));

/** The trigger stays light; account/progress data loads when the drawer opens. */
export function NavigationDrawer({
  triggerRef,
  practiceControls,
}: {
  triggerRef?: Ref<HTMLButtonElement>;
  practiceControls?: (close: () => void) => ReactNode;
} = {}) {
  const [open, setOpen] = useState(false);
  if (nativeRuntime) return null;
  return (
    <NavigationSheet open={open} onOpenChange={setOpen} triggerRef={triggerRef}>
      <MenuRecovery>
        <Suspense fallback={<p role="status">Loading your menu…</p>}>
          <DrawerContents
            close={() => setOpen(false)}
            practiceControls={practiceControls?.(() => setOpen(false))}
          />
        </Suspense>
      </MenuRecovery>
    </NavigationSheet>
  );
}

/** Keep the open problem and the drawer's close control usable after a load error. */
class MenuRecovery extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    console.error("Navigation could not be loaded", error.name);
  }
  render() {
    return this.state.failed ? (
      <div role="alert">
        <p>
          Your menu could not be loaded. Close it to keep learning, or reload to
          try again.
        </p>
        <button onClick={() => location.reload()}>Reload</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
