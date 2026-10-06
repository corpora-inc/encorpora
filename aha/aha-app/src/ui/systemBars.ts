/** The Android shell's bridge (`build.rs` adds it to the generated MainActivity). iOS and desktop have none. */
export interface SystemBarsBridge { setDark(dark: boolean): void }
declare global { interface Window { ahaSystemBars?: SystemBarsBridge } }
interface SystemBarsHost {
  matchMedia(query: string): { readonly matches: boolean; addEventListener(type: 'change', listener: () => void): void };
  ahaSystemBars?: SystemBarsBridge;
}

/**
 * Tell the native shell which theme the studio is painting, so the status-bar icons contrast with it.
 * The CSS theme follows the WebView's `prefers-color-scheme`, and Android WebView does not always agree
 * with the system night mode, so the icons follow this media query (the theme actually rendered) rather
 * than the system setting. Returns whether a bridge was found.
 */
export function syncSystemBars(host: SystemBarsHost, onError: (error: unknown) => void): boolean {
  const bridge = host.ahaSystemBars;
  if (!bridge) return false;
  const scheme = host.matchMedia('(prefers-color-scheme: dark)');
  const report = () => {
    try { bridge.setDark(scheme.matches); } catch (error) { onError(error); }
  };
  report();
  scheme.addEventListener('change', report);
  return true;
}
