import { FaAppStore, FaGooglePlay } from "react-icons/fa";

export const DYNAWALLA_PLAY_URL =
  "https://play.google.com/store/apps/details?id=inc.corpora.dynawalla";

/**
 * Where you can get it.
 *
 * iOS is deliberately rendered as a disabled state rather than omitted: the
 * build is submitted and waiting on review, and a visitor on an iPhone should
 * learn that from the page instead of concluding the app is Android-only.
 * When it is approved, replace the span with a link to the listing.
 */
export function StoreButtons({ className }: { className?: string }) {
  return (
    <div className={["flex flex-wrap items-center gap-3", className].filter(Boolean).join(" ")}>
      <a
        href={DYNAWALLA_PLAY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-3 rounded-lg px-5 py-3 font-medium text-[#0b0618] bg-[#e8deff] hover:bg-white transition-colors"
      >
        <FaGooglePlay className="h-5 w-5" />
        <span>Get it on Google Play</span>
      </a>

      <span
        className="inline-flex items-center gap-3 rounded-lg px-5 py-3 font-medium text-[#c9b4ff]/70 ring-1 ring-inset ring-[#c9b4ff]/25 cursor-default"
        aria-label="App Store — coming soon"
      >
        <FaAppStore className="h-5 w-5" />
        <span>App Store</span>
        <span className="text-xs uppercase tracking-widest text-[#e0b15a]">
          Coming soon
        </span>
      </span>
    </div>
  );
}
