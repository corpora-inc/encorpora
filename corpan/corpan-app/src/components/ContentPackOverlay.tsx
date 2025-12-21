import ContentPackHost from "@/contentPacks/ContentPackHost"
import { Button } from "@/components/ui/button"

export function ContentPackOverlay({
  id,
  onClose,
}: {
  id: string
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[100]">
      <ContentPackHost id={id} />
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
