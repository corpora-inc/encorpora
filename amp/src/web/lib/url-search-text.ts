import { useCallback, useEffect, useRef, useState } from "react";

/** How long typing pauses before the URL follows the field. */
export const URL_FOLLOW_MS = 250;

/**
 * A search field whose text is mirrored into the URL (premium rule 5:
 * refresh, Back and a shared link restore it) without making a keystroke
 * wait on the router.
 *
 * The field owns its text. The URL follows after a pause in typing, on
 * Enter, on blur (before a click on a result can navigate away) and at once
 * when the field is cleared. `write` must navigate with `replace`, so a
 * typing burst adds no history entry. A URL value this field did not write
 * (Back, Forward, a shared link) replaces the text and drops a pending write.
 */
export function useUrlSearchText(
  /** The value in the URL now. */
  url: string,
  /** Puts a value in the URL, replacing the current entry. */
  write: (value: string) => void,
  delay = URL_FOLLOW_MS,
) {
  const [text, setText] = useState(url);
  const latest = useRef(url);
  const written = useRef(url.trim());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const writer = useRef(write);
  writer.current = write;

  const cancel = () => {
    clearTimeout(timer.current);
    timer.current = undefined;
  };
  const flush = useCallback(() => {
    cancel();
    const value = latest.current.trim();
    if (value === written.current) return;
    written.current = value;
    writer.current(value);
  }, []);

  useEffect(() => {
    // Our own write coming back, or the value we already show.
    if (url.trim() === written.current) return;
    cancel();
    written.current = url.trim();
    latest.current = url;
    setText(url);
  }, [url]);
  // A write still pending when the field goes away is dropped: the page it
  // would replace is no longer this one.
  useEffect(() => cancel, []);

  /** The field changed: show it now, put it in the URL after a pause. */
  const change = useCallback(
    (value: string) => {
      latest.current = value;
      setText(value);
      cancel();
      timer.current = setTimeout(flush, delay);
    },
    [delay, flush],
  );
  /** Sets the field and the URL at once (clear, Escape). */
  const set = useCallback(
    (value: string) => {
      latest.current = value;
      setText(value);
      flush();
    },
    [flush],
  );
  /**
   * The field's text, for a navigation of the caller's own that carries it
   * (a new filter, an opened result): the pending write is dropped, as that
   * navigation already puts the text in the URL.
   */
  const carry = useCallback(() => {
    cancel();
    written.current = latest.current.trim();
    return written.current;
  }, []);
  return { text, change, set, flush, carry };
}
