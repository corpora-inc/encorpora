import { AppError } from "../lib/AppError";
export function LoadingScreen() {
  return (
    <main className="app-loading" aria-busy="true">
      <strong>AMP</strong>
      <p>Opening your workspace…</p>
      <button
        className="loading-retry"
        style={{ visibility: "hidden" }}
        tabIndex={-1}
      >
        Try again
      </button>
    </main>
  );
}
export function RouteError({
  error,
  reset,
}: {
  error: unknown;
  reset: () => void;
}) {
  const message =
    error instanceof AppError
      ? error.message
      : "This screen could not be loaded. Try again.";
  return (
    <main className="app-loading">
      <strong>AMP</strong>
      <p role="alert">{message}</p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
