import { useEffect } from "react"
import ContentPackHost from "@/contentPacks/ContentPackHost"

export function ContentPackOverlay({
  id,
  manifestUrl,
}: {
  id: string
  manifestUrl?: string
}) {
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
    if (!meta) return
    const original = meta.getAttribute("content") || ""
    // Force zoom reset by temporarily constraining scale
    meta.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover")
    const timer = requestAnimationFrame(() => {
      meta.setAttribute("content", original)
    })
    return () => cancelAnimationFrame(timer)
  }, [])

  return (
    <div className="fixed inset-0 z-[1100]">
      <ContentPackHost id={id} manifestUrl={manifestUrl} />
    </div>
  )
}
