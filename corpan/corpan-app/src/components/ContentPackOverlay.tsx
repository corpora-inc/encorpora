import ContentPackHost from "@/contentPacks/ContentPackHost"
import { Button } from "@/components/ui/button"

export function ContentPackOverlay({
  id,
  manifestUrl,
  onClose,
}: {
  id: string
  manifestUrl?: string
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[100]">
      <ContentPackHost id={id} manifestUrl={manifestUrl} />
      <div className="absolute top-5 right-5">
        <Button
          variant="secondary"
          className="shadow-lg"
          onClick={onClose}
        >
          Exit game
        </Button>
      </div>
    </div>
  )
}
