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
          variant="ghost"
          className="h-10 w-10 rounded-full bg-white/10 p-0 text-white/80 shadow-lg backdrop-blur hover:bg-white/20 hover:text-white"
          onClick={onClose}
          aria-label="Exit game"
        >
          ×
        </Button>
      </div>
    </div>
  )
}
