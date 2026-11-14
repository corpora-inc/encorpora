import type { BrowserKind } from "./browser-kind";

/** Only suppress attributable webview runtime noise. An AMP frame anywhere
 * in the stack wins, even when an injected wrapper is the throwing frame.
 * Missing/redacted sources stay reportable: absence is not external evidence. */
export function isInjectedRuntimeError(
  error: unknown,
  filename: string | undefined,
  origin: string,
  browser: BrowserKind,
): boolean {
  if (!["inapp-facebook", "inapp-instagram", "inapp-tiktok"].includes(browser))
    return false;
  try {
    const stack = (error as Error)?.stack;
    const sources = filename ? [filename] : [];
    if (typeof stack === "string") {
      for (const line of stack.slice(0, 16384).split("\n").slice(0, 20)) {
        const frame = line.match(
          /(?:\bat\s+(?:[^()]*\()?|@)((?:https?:\/\/|blob:|[a-z][a-z0-9+.-]*:)[^\s()]+?)(?::\d+){1,2}\)?\s*$/i,
        );
        if (frame) sources.push(frame[1]);
      }
    }
    let external = false;
    for (const source of sources) {
      const url = new URL(source, origin);
      if (url.origin === origin) return false;
      external = true;
    }
    return external;
  } catch {
    return false;
  }
}
