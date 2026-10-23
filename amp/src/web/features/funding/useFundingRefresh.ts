import { useEffect, useLayoutEffect, useRef } from "react";

/** Keep pending purchases current without polling hidden tabs or overlapping work. */
export function useFundingRefresh(
  identity: string,
  pending: boolean,
  refresh: () => Promise<void>,
  busy: () => boolean,
) {
  const callbacks = useRef({ refresh, busy });
  useLayoutEffect(() => {
    callbacks.current = { refresh, busy };
  });
  useEffect(() => {
    if (!pending) return;
    let stopped = false,
      running = false;
    const check = async () => {
      if (stopped || running || document.hidden || callbacks.current.busy())
        return;
      running = true;
      try {
        await callbacks.current.refresh();
      } catch {
        /* Preserve verified status; explicit refresh reports errors. */
      } finally {
        running = false;
      }
    };
    const visible = () => void check();
    const timer = window.setInterval(visible, 30_000);
    document.addEventListener("visibilitychange", visible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [identity, pending]);
}
