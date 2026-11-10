import { useEffect, useLayoutEffect, useState } from "react";
import type { DesignTheme } from "./search";

/** Every gallery document (the page, its canvas and their frames) shares the
 * theme over one channel, so a change repaints them all without a reload. */
const CHANNEL = "amp-design-theme";

function channel() {
  return typeof BroadcastChannel === "undefined"
    ? null
    : new BroadcastChannel(CHANNEL);
}

/** The system's theme, for a gallery opened without one in its address. */
export function systemTheme(): DesignTheme {
  return typeof matchMedia !== "undefined" &&
    matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** Paint this document in `theme` (tokens.css reads `data-theme`), follow
 * the others' changes, and put the system's choice back on leaving. */
export function useDesignTheme(initial: DesignTheme) {
  const [theme, setTheme] = useState(initial);
  useLayoutEffect(() => {
    const root = document.documentElement;
    const before = root.getAttribute("data-theme");
    root.setAttribute("data-theme", theme);
    return () => {
      if (before === null) root.removeAttribute("data-theme");
      else root.setAttribute("data-theme", before);
    };
  }, [theme]);
  useEffect(() => {
    const listen = channel();
    if (!listen) return;
    listen.onmessage = (event: MessageEvent<unknown>) => {
      if (event.data === "light" || event.data === "dark") setTheme(event.data);
    };
    return () => listen.close();
  }, []);
  const choose = (next: DesignTheme) => {
    setTheme(next);
    const send = channel();
    send?.postMessage(next);
    send?.close();
  };
  return [theme, choose] as const;
}

/** Keep the gallery out of search for as long as it is on screen. */
export function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.append(meta);
    return () => meta.remove();
  }, []);
}
