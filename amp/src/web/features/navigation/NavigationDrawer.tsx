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
const contents = () => import("./DrawerContents");
const DrawerContents = lazy(contents);
const DrawerFooter = lazy(() =>
  contents().then((module) => ({ default: module.DrawerFooter })),
);

/**
 * The drawer for frames outside the app frame (sign-in and first-run cards,
 * a student's standings): its own wave-mark
 * trigger, the same contents as the app frame's drawer. The trigger stays
 * light; the contents load when it opens.
 */
export function NavigationDrawer({
  triggerRef,
  practiceControls,
}: {
  triggerRef?: Ref<HTMLButtonElement>;
  practiceControls?: (close: () => void) => ReactNode;
} = {}) {
  const [open, setOpen] = useState(false);
  if (nativeRuntime) return null;
  const close = () => setOpen(false);
  return (
    <NavigationSheet
      open={open}
      onOpenChange={setOpen}
      triggerRef={triggerRef}
      footer={
        <MenuRecovery quiet>
          <Suspense fallback={null}>
            <DrawerFooter close={close} />
          </Suspense>
        </MenuRecovery>
      }
    >
      <MenuRecovery>
        {/* Reserved, not announced: the contents are a moment away. */}
        <Suspense
          fallback={<div aria-busy="true" style={{ minHeight: 320 }} />}
        >
          <DrawerContents
            close={close}
            practiceControls={practiceControls?.(close)}
          />
        </Suspense>
      </MenuRecovery>
    </NavigationSheet>
  );
}

/** Keep the open problem and the drawer's close control usable after a load error. */
class MenuRecovery extends Component<
  { children: ReactNode; quiet?: boolean },
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
      this.props.quiet ? null : (
        <div role="alert">
          <p>
            Your menu could not be loaded. Close it to keep learning, or reload
            to try again.
          </p>
          <button onClick={() => location.reload()}>Reload</button>
        </div>
      )
    ) : (
      this.props.children
    );
  }
}
