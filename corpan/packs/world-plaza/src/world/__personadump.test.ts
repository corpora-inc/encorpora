import { describe, it } from "vitest"
import { generateCharacter, ANTIGUA_1770 } from "../character/characterGen"
import { generatePersona } from "../npc/personaGen"
import { Scene as SceneSchema } from "@world-plaza/contracts"
import sceneJson from "../../content/scenes/antigua-grand.json"

describe("persona dump", () => {
  it("dumps stroller + keeper archetypes/names", () => {
    const scene = SceneSchema.parse(sceneJson)
    const seed = 12345
    const variety = 6
    const figureDraws = Array.from({ length: variety }, (_, i) =>
      generateCharacter("crowd", `ambient:${seed}:${i}`, ANTIGUA_1770),
    )
    const lines: string[] = []
    const counts: Record<string, number> = {}
    for (let i = 0; i < 14; i++) {
      const v = i % variety
      const npcId = `ambient:${seed}:stroller:${i}`
      const p = generatePersona(npcId, { scene, spec: figureDraws[v] })
      counts[p.archetype] = (counts[p.archetype] ?? 0) + 1
      lines.push(`stroller${i} v${v} dem=${figureDraws[v].demeanor} arch=${p.archetype} name=${p.name}`)
    }
    for (let i = 0; i < 8; i++) {
      const v = (i + 3) % variety
      const npcId = `ambient:${seed}:keeper:${i}`
      const p = generatePersona(npcId, { scene, spec: figureDraws[v] })
      counts["K:"+p.archetype] = (counts["K:"+p.archetype] ?? 0) + 1
      lines.push(`keeper${i}   v${v} dem=${figureDraws[v].demeanor} arch=${p.archetype} name=${p.name}`)
    }
    console.error("\n" + lines.join("\n") + "\nCOUNTS: " + JSON.stringify(counts) + "\n")
  })
})
