import { useId, useLayoutEffect, useRef, type ReactNode } from "react";

/** The practice panels' modal dialog (a lesson, a hint, "Report a problem",
 * "Report this film"): a native `<dialog>` in the top layer, its title
 * focused on open, Escape and × closing it, and focus returned to what
 * opened it. Styles: practice.css and theme.css `.practice-dialog`. */
export function FocusDialog({
  title,
  children,
  close,
  returnFocus,
  className = "",
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  returnFocus?: HTMLElement | null;
  className?: string;
}) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    const previous =
      returnFocus ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);
    dialog.current?.showModal();
    heading.current?.focus({ preventScroll: true });
    return () => {
      dialog.current?.close();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`practice-dialog ${className}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        close();
      }}
    >
      <div className="dialog-heading">
        <h2 id={titleId} ref={heading} tabIndex={-1}>
          {title}
        </h2>
        <button
          className="dialog-close"
          onClick={close}
          aria-label="Close panel"
        >
          ×
        </button>
      </div>
      <div className="dialog-content">{children}</div>
    </dialog>
  );
}
