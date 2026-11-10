/** Media queries in every browser the pitch meets. Older WebKit has only
 * `addListener`, and some webviews return a bare stub with neither, or no
 * `matchMedia` at all: those report no match and never change. */
function list(query: string): MediaQueryList | undefined {
  try {
    return matchMedia(query);
  } catch {
    return undefined;
  }
}

export function mediaMatches(query: string): boolean {
  return list(query)?.matches === true;
}

/** Calls `listener` when `query` starts or stops matching; returns the stop. */
export function onMediaChange(query: string, listener: () => void): () => void {
  const media = list(query);
  if (typeof media?.addEventListener === "function") {
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }
  if (typeof media?.addListener === "function") {
    media.addListener(listener);
    return () => media.removeListener(listener);
  }
  return () => {};
}
