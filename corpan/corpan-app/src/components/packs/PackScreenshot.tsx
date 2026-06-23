import { useState } from "react"

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
  const [imageError, setImageError] = useState(false)

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

  // If image failed to load, don't render anything (graceful fallback)
  if (imageError) {
    return null
  }

  // Default to image with error handling
  return (
    <img
      src={src}
      alt={alt}
      className="aspect-video w-full rounded-md object-cover"
      loading="lazy"
      onError={() => setImageError(true)}
    />
  )
}
