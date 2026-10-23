import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { createPortal } from "react-dom";
import styles from "./Menu.module.css";

type Insets = { top: number; right: number; bottom: number; left: number };

/** Space kept between the menu and the viewport edge, outside any safe area. */
const GUTTER = 16;

/** The device's safe-area insets, read once per open from `env()`. */
function safeAreaInsets(): Insets {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;visibility:hidden;pointer-events:none;" +
    "padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) " +
    "env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)";
  document.body.append(probe);
  const style = getComputedStyle(probe);
  const px = (value: string) => Number.parseFloat(value) || 0;
  const insets = {
    top: px(style.paddingTop),
    right: px(style.paddingRight),
    bottom: px(style.paddingBottom),
    left: px(style.paddingLeft),
  };
  probe.remove();
  return insets;
}

const padded = (insets: Insets): Insets => ({
  top: insets.top + GUTTER,
  right: insets.right + GUTTER,
  bottom: insets.bottom + GUTTER,
  left: insets.left + GUTTER,
});

/**
 * A menu button: the trigger opens a list of actions. Outside taps, Escape,
 * the trigger itself and choosing an item close it; focus returns to the
 * trigger. Arrow keys, Home, End and type-ahead move between items.
 */
export function Menu({
  label,
  children,
  "aria-label": ariaLabel,
  open: controlledOpen,
  onOpenChange,
  triggerRef,
  triggerClassName,
  align = "end",
  showChevron = true,
}: {
  /** The trigger's visible text. */
  label: ReactNode;
  children: ReactNode;
  /** The trigger's accessible name; it must contain the visible label. */
  "aria-label"?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerRef?: Ref<HTMLButtonElement>;
  triggerClassName?: string;
  align?: "start" | "center" | "end";
  /** Icon-only controls already identify their menu without a second glyph. */
  showChevron?: boolean;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [padding, setPadding] = useState<Insets>(() =>
    padded({ top: 0, right: 0, bottom: 0, left: 0 }),
  );
  const open = controlledOpen ?? uncontrolledOpen;
  // A touch browser hit-tests a tap's click after the menu has already closed
  // on pointerdown, so a tap outside would also press whatever lies beneath.
  // A transparent shield outlives the menu just long enough to absorb that
  // click: a tap outside only closes the menu.
  const [shielded, setShielded] = useState(false);
  const outsidePress = useRef(false);
  useEffect(() => {
    if (open || !shielded) return;
    const release = window.setTimeout(() => setShielded(false), 700);
    return () => window.clearTimeout(release);
  }, [open, shielded]);
  const setOpen = (next: boolean) => {
    if (next) {
      setPadding(padded(safeAreaInsets()));
      setShielded(true);
    } else if (!outsidePress.current) setShielded(false);
    outsidePress.current = false;
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          ref={triggerRef}
          aria-label={ariaLabel}
          className={`${styles.trigger} ${triggerClassName ?? ""}`}
        >
          {label}
          {showChevron && (
            <svg
              className={styles.chevron}
              viewBox="0 0 12 12"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M2.5 4.5 6 8l3.5-3.5" />
            </svg>
          )}
        </button>
      </DropdownMenu.Trigger>
      {shielded &&
        createPortal(
          <div
            className={styles.shield}
            aria-hidden="true"
            onClick={() => {
              if (!open) setShielded(false);
            }}
          />,
          document.body,
        )}
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={styles.content}
          align={align}
          sideOffset={8}
          collisionPadding={padding}
          loop
          onPointerDownOutside={() => {
            outsidePress.current = true;
          }}
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** One action in a Menu. Choosing it runs `onSelect` and closes the menu. */
export function MenuItem({
  children,
  onSelect,
  disabled,
}: {
  children: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu.Item
      className={styles.item}
      disabled={disabled}
      onSelect={onSelect}
    >
      {children}
    </DropdownMenu.Item>
  );
}

/** Noninteractive context for the actions in a menu. */
export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <DropdownMenu.Label className={styles.label}>{children}</DropdownMenu.Label>
  );
}
