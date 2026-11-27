import { CircleAlert, Info, X } from "lucide-react";
import { useToast } from "../store/toast.ts";
import { useT } from "./useT.ts";

/** Fixed-position toast: overlays content, never moves it. */
export function Toasts() {
  const toast = useToast((s) => s.toast);
  const clear = useToast((s) => s.clear);
  const t = useT();
  return (
    <div aria-live="assertive" className="pointer-events-none fixed inset-x-0 top-[max(12px,env(safe-area-inset-top))] z-50 flex justify-center px-4 md:pl-28">
      {toast && (
        <div role={toast.kind === "error" ? "alert" : "status"} className="pointer-events-auto flex w-full max-w-[560px] items-start gap-3 rounded-panel bg-[var(--overlay)] p-4 text-[var(--overlay-ink)] shadow-lg">
          {toast.kind === "error" ? <CircleAlert aria-hidden size={22} className="mt-0.5 shrink-0" /> : <Info aria-hidden size={22} className="mt-0.5 shrink-0" />}
          <p className="m-0 flex-1 text-small">{toast.text}</p>
          <button type="button" onClick={() => clear(toast.id)} aria-label={t("toast.dismiss")} className="-m-2 inline-flex size-11 shrink-0 items-center justify-center">
            <X aria-hidden size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
