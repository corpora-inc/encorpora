import { useProjectStore } from "../storage/projectStore"
import type { SkinId } from "../model/project"

const SKINS: { id: SkinId; label: string }[] = [
  { id: "earthgate", label: "Earthgate" },
  { id: "stargate", label: "Stargate" },
  { id: "hover-runner", label: "Hover Runner" },
]

export const SkinPicker = () => {
  const skin = useProjectStore((s) => s.project.skin)
  const setSkin = useProjectStore((s) => s.setSkin)

  return (
    <div className="mp-skin-picker" role="radiogroup" aria-label="Skin">
      {SKINS.map((s) => (
        <div
          key={s.id}
          className={`mp-skin-swatch ${skin === s.id ? "is-active" : ""}`}
          data-skin={s.id}
          onClick={() => setSkin(s.id)}
          role="radio"
          aria-checked={skin === s.id}
          aria-label={s.label}
          title={s.label}
        />
      ))}
    </div>
  )
}
