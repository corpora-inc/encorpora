import { useLocation } from "@tanstack/react-router";
import { namedByTab } from "../features/navigation/shell-frame";
import styles from "./ScreenTitle.module.css";

/**
 * A screen's title. When the open tab already says it (Time under the Time
 * tab, Sign-in under Sign-in), it is for screen readers only and the page
 * starts with its content: a label is never said twice in a stack. `named`
 * says so for a frame that knows better (sub-tabs that name the page).
 */
export function ScreenTitle({
  children,
  id,
  className,
  named,
}: {
  children: string;
  id?: string;
  className?: string;
  named?: boolean;
}) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const hidden = named || namedByTab(pathname, children);
  return (
    <h1
      id={id}
      className={
        [className, hidden ? styles.hidden : ""].filter(Boolean).join(" ") ||
        undefined
      }
      data-named-by-tab={hidden ? "" : undefined}
    >
      {children}
    </h1>
  );
}

/** For a heading that sits with other lines: whether it is shown at all. */
export function useNamedByTab(title: string) {
  const pathname = useLocation({ select: (location) => location.pathname });
  return namedByTab(pathname, title);
}
