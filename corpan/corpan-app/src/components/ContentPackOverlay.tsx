import ContentPackHost from "@/contentPacks/ContentPackHost"

export function ContentPackOverlay({
  id,
  manifestUrl,
}: {
  id: string
  manifestUrl?: string
}) {
  return (
    <div className="fixed inset-0 z-[100]">
      <ContentPackHost id={id} manifestUrl={manifestUrl} />
    </div>
  )
}
