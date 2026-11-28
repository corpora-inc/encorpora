import { Link } from "react-router";
import { X } from "lucide-react";
import type { Citation, PackAsset } from "../engine/types.ts";
import { cx } from "./kit.tsx";
import { citationText } from "./manual.tsx";

/**
 * The original page, beside the step on wide screens and over it on narrow
 * ones, with the passage's place on the page marked from the citation's boxes.
 */
export function PageViewer({ asset, src, citation, closeTo, docked = false }: { asset: PackAsset; src: string; citation: Citation; closeTo: string; docked?: boolean }) {
  const boxes = citation.page_asset_id === asset.asset_id ? citation.boxes : [];
  return (
    <section className={cx("flex flex-col", docked ? "sheet sticky top-[calc(var(--spacing-strip)+16px)] hidden max-h-[calc(100dvh-var(--spacing-strip)-32px)] lg:flex" : "h-full")} aria-label="Original page">
      <div className="flex min-h-tap shrink-0 items-center gap-3 border-b border-line bg-sheet px-4 pt-[env(safe-area-inset-top)]">
        <span className="min-w-0 flex-1 truncate font-sans text-small font-bold">{citation.page_label ? `Page ${citation.page_label}` : "Original page"}</span>
        <Link to={closeTo} replace aria-label="Close the page" className="-mr-2 inline-flex size-11 items-center justify-center rounded-control text-ink">
          <X aria-hidden size={24} />
        </Link>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-surface-3 p-3">
        <div className="relative mx-auto w-full max-w-[850px] bg-white shadow-sm">
          <img src={src} alt={`Page ${citation.page_label ?? ""}`} width={asset.width ?? undefined} height={asset.height ?? undefined} className="block h-auto w-full" />
          {boxes.map((b, i) => (
            <span
              key={i}
              aria-hidden
              className="absolute rounded-[2px] border-2 border-focus bg-focus/10"
              style={{ left: `${b.x0 * 100}%`, top: `${b.y0 * 100}%`, width: `${(b.x1 - b.x0) * 100}%`, height: `${(b.y1 - b.y0) * 100}%` }}
            />
          ))}
        </div>
      </div>
      <p className="shrink-0 border-t border-line bg-sheet px-4 py-2 font-sans text-meta text-ink-3">{citationText(citation)}</p>
    </section>
  );
}

