import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { buttonClass } from "./Button";
import { AppError } from "../lib/AppError";
import { WAVE_PATH } from "./Loading";
import { onMediaChange } from "../lib/media-query";
import { errorDetails } from "../../analytics/error-details";
import {
  recoverChunkError,
  dismissChunkNotice,
  chunkReloading,
} from "../lib/chunk-recovery";

// Reuse the bootstrap animation's document-timeline start time. Every React
// instance then joins the running wave instead of restarting it on navigation.
const waveStart =
  typeof document === "undefined"
    ? 0
    : (document.querySelector(".app-loading-wave")?.getAnimations?.()[0]
        ?.startTime ?? 0);

let arrivalTimer: ReturnType<typeof setTimeout> | undefined;
/** The wave just left: what replaces it fades in, once (`ui/loading.css`). */
function markArrival() {
  const root = document.documentElement;
  root.setAttribute("data-arriving", "");
  clearTimeout(arrivalTimer);
  arrivalTimer = setTimeout(() => root.removeAttribute("data-arriving"), 320);
}

/**
 * Match the centered first paint in index.html while the destination resolves.
 * index.html inlines its styles for the paint before any stylesheet;
 * `ui/loading.css` carries the same rules for every later mount. CSS handles
 * the motion; JavaScript only synchronizes each newly mounted wave.
 *
 * `overlay` is a screen's own wait for its data inside a frame: the same wave
 * in the same place as the router's pending screen, never a small one in the
 * corner of the content.
 */
export function LoadingScreen({
  error = "",
  retry,
  retryLabel = "Try again",
  busy = false,
  recovery,
  overlay = false,
}: {
  error?: string;
  retry?: () => void;
  retryLabel?: string;
  busy?: boolean;
  recovery?: ReactNode;
  /** Over a frame that has already painted, keeping its surface: centred in
   * the space under the bar. */
  overlay?: boolean;
}) {
  const wave = useRef<SVGPathElement>(null);
  useLayoutEffect(() => {
    if (error) return;
    const sync = () => {
      for (const animation of wave.current?.getAnimations?.() ?? [])
        animation.startTime = waveStart;
    };
    sync();
    const stop = onMediaChange("(prefers-reduced-motion: no-preference)", sync);
    return () => {
      stop();
      // Over a frame, the frame stays put; only a whole screen arrives.
      if (!overlay) markArrival();
    };
  }, [error, overlay]);
  return (
    <div
      className={`app-loading ${overlay ? "app-loading-overlay" : ""}`}
      role={error ? undefined : "status"}
      aria-label={error ? undefined : "Loading AMP"}
      aria-busy={!error}
    >
      <div className="app-loading-content">
        <svg
          className="app-loading-mark"
          viewBox="0 0 44 28"
          aria-hidden="true"
        >
          <path ref={wave} className="app-loading-wave" d={WAVE_PATH} />
        </svg>
        {error && (
          <main className="app-loading-body">
            <p role="alert">{error}</p>
            {retry && (
              <button
                className={buttonClass("primary")}
                disabled={busy}
                onClick={retry}
              >
                {retryLabel}
              </button>
            )}
            {recovery}
          </main>
        )}
      </div>
    </div>
  );
}
export function RouteError({
  error,
  reset,
}: {
  error: unknown;
  reset: () => void;
}) {
  const pathways =
    window.location.pathname === "/pathways" ||
    window.location.pathname.startsWith("/pathways/");
  const mapHref = "/pathways";
  // Keep the loading wave up while attempting guarded chunk recovery.
  const chunk = errorDetails(error).category === "chunk";
  const [checked, setChecked] = useState<unknown>();
  useEffect(() => {
    console.error("Application route failed to load or render.");
    if (chunk) {
      dismissChunkNotice();
      recoverChunkError(error, false);
      if (!chunkReloading()) setChecked(error);
    }
  }, [error, chunk]);
  if (chunk && checked !== error) return <LoadingScreen />;
  return (
    <LoadingScreen
      error={
        error instanceof AppError
          ? error.message
          : "This screen could not be loaded."
      }
      retryLabel={chunk ? "Reload" : "Try again"}
      // A file that failed to load is not fetched again in place: reload.
      retry={
        pathways ? undefined : chunk ? () => window.location.reload() : reset
      }
      recovery={
        pathways && (
          <div
            style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}
          >
            <a className={buttonClass("primary")} href={mapHref}>
              Back to map
            </a>
            <button
              className={buttonClass("secondary")}
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
          </div>
        )
      }
    />
  );
}
