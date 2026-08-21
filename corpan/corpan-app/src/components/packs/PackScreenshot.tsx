import { OfflineImage } from "@/components/ui/OfflineImage"

/**
 * Component to display pack screenshots or video embeds
 */
export function PackScreenshot({
  src,
  alt,
  type = "image",
}: {
  src?: string
  alt: string
  type?: "image" | "video"
}) {
  if (!src) {
    return null
  }

  if (type === "video") {
    // Support YouTube embeds (extract video ID from various formats)
    const youtubeMatch = src.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/
    )
    if (youtubeMatch) {
      const videoId = youtubeMatch[1]
      return (
        <div className="relative aspect-video w-full overflow-hidden rounded-md">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            title={alt}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        </div>
      )
    }
  }

  // Default to an offline-cached image. Screenshots are optional content, so
  // the fallback stays null (render nothing) — but a once-seen screenshot now
  // renders from the on-device cache when offline (D12).
  return (
    <OfflineImage
      src={src}
      alt={alt}
      fallback={null}
      className="aspect-video w-full rounded-md object-cover"
      loading="lazy"
    />
  )
}
