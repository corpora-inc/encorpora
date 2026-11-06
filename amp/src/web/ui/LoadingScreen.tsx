import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { buttonClass } from "./Button";
import { AppError } from "../lib/AppError";
import { WAVE_PATH } from "./Loading";

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
 * The inline stylesheet owns both frames, including before scripts arrive.
 * CSS handles the motion; JavaScript only synchronizes each newly mounted wave.
 */
export function LoadingScreen({
  error = "",
  retry,
  busy = false,
  recovery,
  overlay = false,
}: {
  error?: string;
  retry?: () => void;
  busy?: boolean;
  recovery?: ReactNode;
  /** Over a frame that has already painted, keeping its surface. */
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
    const motion = matchMedia("(prefers-reduced-motion: no-preference)");
    motion.addEventListener("change", sync);
    return () => {
      motion.removeEventListener("change", sync);
      markArrival();
    };
  }, [error]);
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
                Try again
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
  const mapHref =
    new URLSearchParams(window.location.search).get("context") === "trial"
      ? "/pathways?context=trial"
      : "/pathways";
  useEffect(() => {
    console.error("Application route failed to load or render.");
  }, [error]);
  return (
    <LoadingScreen
      error={
        error instanceof AppError
          ? error.message
          : "This screen could not be loaded."
      }
      retry={pathways ? undefined : reset}
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
