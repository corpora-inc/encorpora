import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  currentInAppBrowser,
  type InAppPlatform,
} from "../../../analytics/browser-kind";
import { nativeRuntime } from "../../native-runtime";
import {
  browserHandoffHref,
  handoffHint,
  withArrival,
} from "./browser-handoff";
import styles from "./OpenInBrowser.module.css";

/** How long a page that handed off stays on view before the jump counts as
 * not having happened. A jump hides the page well within it. */
const LEAVE_WINDOW = 1500;

/**
 * Leaves an in-app browser for the phone's real browser in one tap
 * (`browser-handoff.ts`). `open(href)` returns false where no jump exists
 * (a standard browser, AMP's own app, a webview off Android and iOS), so the
 * caller carries on in place. When the page is still on view after the tap,
 * `hint` points at the app's menu, which has its own "open in browser".
 */
export function useBrowserHandoff() {
  const [inApp] = useState(() =>
    nativeRuntime ? null : currentInAppBrowser(),
  );
  const [hint, setHint] = useState(false);
  const pending = useRef<() => void>(undefined);
  useEffect(() => () => pending.current?.(), []);
  function open(href: string) {
    const target = inApp && browserHandoffHref(href, inApp.platform);
    if (!target) return false;
    pending.current?.();
    setHint(false);
    let left = false;
    const leave = () => {
      left = true;
    };
    const timer = setTimeout(() => {
      stop();
      if (!left && document.visibilityState === "visible") {
        console.warn("Browser handoff did not leave the in-app browser", {
          platform: inApp.platform,
          app: inApp.app,
        });
        // The app's own "open in browser" opens this address: it takes
        // the tab's arrival along, as the jump would have.
        try {
          history.replaceState(history.state, "", withArrival(location.href));
        } catch (error) {
          console.warn("The address couldn't take the arrival along", error);
        }
        setHint(true);
      }
    }, LEAVE_WINDOW);
    const stop = () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", leave);
      removeEventListener("pagehide", leave);
      pending.current = undefined;
    };
    pending.current = stop;
    document.addEventListener("visibilitychange", leave);
    addEventListener("pagehide", leave);
    // A followed link, not a script assignment: host apps hand a tapped
    // link's scheme to the system.
    const link = document.createElement("a");
    link.href = target;
    link.rel = "noopener";
    link.click();
    return true;
  }
  return {
    /** The in-app browser this page runs in; null in a standard browser. */
    inApp,
    /** Whether this page can hand off to the real browser in one tap. */
    available: !!inApp && inApp.platform !== "other",
    open,
    hint:
      hint && inApp ? (
        <OpenInBrowser
          platform={inApp.platform}
          onDismiss={() => setHint(false)}
        />
      ) : null,
  };
}

/** Points at the app's menu (top right in Facebook, Instagram, TikTok,
 * LinkedIn, Snapchat, X, LINE and WeChat), over the page so nothing moves. */
export function OpenInBrowser({
  platform,
  onDismiss,
}: {
  platform: InAppPlatform;
  onDismiss: () => void;
}) {
  const { menu, text } = handoffHint(platform);
  return createPortal(
    <div className={styles.anchor} role="status">
      <button
        type="button"
        className={styles.hint}
        data-browser-hint
        onClick={onDismiss}
      >
        <span>
          {text}{" "}
          <span className={styles.menu} aria-label="the menu">
            {menu}
          </span>
        </span>
        <svg
          className={styles.arrow}
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M6 18 18 6M9 6h9v9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>,
    document.body,
  );
}
