import { describe, expect, it } from "vitest"
import { createDefaultDoc } from "../model/document"
import { captureSnapshot, type SceneSnapshot } from "../model/snapshot"
import {
  addScene,
  deleteScene,
  findSceneByName,
  loadScenes,
  makeScene,
  renameScene,
  sortScenes,
  type Scene,
} from "./scenesStore"

const snap = (): SceneSnapshot => captureSnapshot(createDefaultDoc(0))

const scene = (id: string, name: string, createdAt: number): Scene =>
  makeScene(name, snap(), createdAt, id)

describe("scenesStore — makeScene", () => {
  it("builds a scene with the given fields + a generated id", () => {
    const s = makeScene("My State", snap(), 5)
    expect(s.name).toBe("My State")
    expect(s.createdAt).toBe(5)
    expect(s.id).toMatch(/^scene_/)
    expect(s.snapshot.bpm).toBe(96)
  })
})

describe("scenesStore — list ops are pure", () => {
  it("addScene appends without mutating the input", () => {
    const a = scene("s1", "A", 1)
    const list = [a]
    const next = addScene(list, scene("s2", "B", 2))
    expect(next).toHaveLength(2)
    expect(list).toHaveLength(1) // original untouched
  })

  it("sortScenes orders newest-first", () => {
    const out = sortScenes([
      scene("s1", "old", 100),
      scene("s2", "new", 300),
      scene("s3", "mid", 200),
    ])
    expect(out.map((s) => s.id)).toEqual(["s2", "s3", "s1"])
  })

  it("renameScene renames by id, ignores blank, leaves others", () => {
    const list = [scene("s1", "A", 1), scene("s2", "B", 2)]
    const renamed = renameScene(list, "s1", "  Alpha  ")
    expect(renamed.find((s) => s.id === "s1")!.name).toBe("Alpha")
    expect(renamed.find((s) => s.id === "s2")!.name).toBe("B")
    // blank name → no change to the target
    const blank = renameScene(list, "s1", "   ")
    expect(blank.find((s) => s.id === "s1")!.name).toBe("A")
  })

  it("deleteScene removes by id", () => {
    const list = [scene("s1", "A", 1), scene("s2", "B", 2)]
    const next = deleteScene(list, "s1")
    expect(next.map((s) => s.id)).toEqual(["s2"])
  })

  it("findSceneByName matches case-insensitively", () => {
    const list = [scene("s1", "Brave Canyon", 1)]
    expect(findSceneByName(list, "brave canyon")!.id).toBe("s1")
    expect(findSceneByName(list, "nope")).toBeUndefined()
  })
})

describe("scenesStore — IDB primitives degrade without IndexedDB", () => {
  it("loadScenes returns [] when IDB is unavailable", async () => {
    // happy-dom has no indexedDB → getBeatloungeDb resolves null → [].
    const list = await loadScenes("song_x")
    expect(list).toEqual([])
  })
})
