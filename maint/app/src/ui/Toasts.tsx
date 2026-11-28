import { CircleAlert, Info, X } from "lucide-react";
import { useToast } from "@appkit/toast.ts";

/** Fixed-position toast: overlays content, never moves it. */
export function Toasts() {
  const toast = useToast((s) => s.toast);
  const clear = useToast((s) => s.clear);
  return (
    <div aria-live="assertive" className="pointer-events-none fixed inset-x-0 top-[calc(var(--spacing-strip)+env(safe-area-inset-top)+8px)] z-50 flex justify-center px-4 md:pl-[calc(var(--spacing-rail)+16px)]">
      {toast && (
        <div role={toast.kind === "error" ? "alert" : "status"} className="pointer-events-auto flex w-full max-w-[560px] items-start gap-3 rounded-panel bg-overlay p-4 text-overlay-ink shadow-lg">
          {toast.kind === "error" ? <CircleAlert aria-hidden size={22} className="mt-0.5 shrink-0" /> : <Info aria-hidden size={22} className="mt-0.5 shrink-0" />}
          <p className="flex-1 text-small">{toast.text}</p>
          <button type="button" onClick={() => clear(toast.id)} aria-label="Dismiss" className="-m-2 inline-flex size-11 shrink-0 items-center justify-center">
            <X aria-hidden size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
