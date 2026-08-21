// cap-segment-player bare harness: plays the checked-in fixture mini-book
// (3 segments, three ~120ms tone WAVs) via the `preloaded` path — no
// installed pack, no host. Tap the text to replay a segment. §7.2.
import { capability } from "@shared/capabilities/segment-player"
import { bootHarness } from "../../test/harnessShell"
import segmentsData from "./fixtures/mini-book/segments.json"
import audioManifest from "./fixtures/mini-book/audio_manifest_en.json"

// Vite serves the fixture wavs from this directory.
const assetBase = new URL("./fixtures/mini-book/", import.meta.url)

bootHarness(capability, {
  knobs: [
    {
      kind: "select",
      id: "range",
      label: "segments",
      options: [
        { value: "all", label: "all three" },
        { value: "first", label: "first only" },
        { value: "tail", label: "last two" },
      ],
    },
    {
      kind: "select",
      id: "showText",
      label: "text",
      options: [
        { value: "yes", label: "word-sync text" },
        { value: "no", label: "pure listening" },
      ],
    },
  ],
  buildSpec: (knobs) => {
    const ids =
      knobs.range === "first"
        ? ["ch01-001"]
        : knobs.range === "tail"
          ? ["ch01-002", "ch01-003"]
          : ["ch01-001", "ch01-002", "ch01-003"]
    return {
      specId: `harness-${Date.now().toString(36)}`,
      activityType: "cap-segment-player",
      itemRefs: ids.map((id) => ({ kind: "segment" as const, source: "mini_book", id })),
      targetLang: "en",
      params: {
        bookId: "mini_book",
        language: "en",
        segments: ids,
        showText: knobs.showText !== "no",
        preloaded: {
          segmentsData,
          audioManifest,
          resolveAssetUrl: (rel: string) => new URL(rel, assetBase).toString(),
        },
      },
    }
  },
})
