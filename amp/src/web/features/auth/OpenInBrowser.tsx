import { useRef, useState } from "react";
import { browserHandoffUrl } from "../../lib/funded-entry";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import styles from "./Auth.module.css";

/** Host apps can block external schemes and clipboard APIs. Always provide a
 * selectable link; never assume Chrome is installed or claim an app opened.
 * Copy the continuation across browser storage boundaries, never the form draft. */
export function OpenInBrowser() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");
  const link = useRef<HTMLTextAreaElement>(null);
  const url = browserHandoffUrl(window.location.href);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Link copied. Paste it into your browser’s address bar.");
    } catch {
      console.warn("Browser handoff clipboard unavailable");
      setStatus(
        "Select and copy the page link, then paste it into your browser’s address bar.",
      );
      link.current?.focus();
      link.current?.select();
    }
  }
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          setOpen(true);
          setStatus("");
          void copy();
        }}
      >
        Open in your browser
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Open in your browser"
        initialFocus="#browser-link"
      >
        <div className={styles.browserHelp}>
          <p>
            Copy this link and open it in Safari, Chrome, or your usual browser.
            You can also use this app’s menu to open the page in a browser.
          </p>
          <label htmlFor="browser-link">Page link</label>
          <textarea
            id="browser-link"
            ref={link}
            readOnly
            value={url}
            rows={3}
            onFocus={(event) => event.currentTarget.select()}
          />
          <Button type="button" variant="secondary" onClick={() => void copy()}>
            Copy link
          </Button>
          <p className={styles.copyStatus} role="status">
            {status}
          </p>
        </div>
      </Dialog>
    </>
  );
}
