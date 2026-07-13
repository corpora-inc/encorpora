// cap-pronounce — model-SHARING boot flow (0.20.2 fix #1). A user who already
// installed a big Whisper (e.g. via pronunciation-coach — same hostApi.stt seam
// + same modelRegistry folders) must have Journey REUSE it, never see a
// redundant 75 MB Tiny install offer. These drive the real capability against a
// controllable in-test host (no native deps).
import { describe, it, expect } from "vitest"
import type {
  ActivitySpec,
  CapabilityHostApi,
  CapabilitySttApi,
} from "@shared/capabilities/core"
import { makeMockTranscription } from "@shared/capabilities/core/mock"
import { capability } from "@shared/capabilities/pronounce"
import {
  visibleDefaultModel,
  modelById,
} from "@shared/capabilities/pronounce/src/modelRegistry"
import { wait, waitFor, pointerEvt } from "../test/drivers"

const DEFAULT_FOLDER = visibleDefaultModel().folder
// A big model a user already installed elsewhere (Large q5 ≈ 1 GB).
const BIG_FOLDER = modelById("large_qlora")!.folder

const makeSpec = (params?: Record<string, unknown>): ActivitySpec => ({
  specId: "spk-1",
  activityType: "cap-pronounce",
  itemRefs: [{ kind: "phrase", source: "base", id: "42" }],
  targetLang: "es",
  nativeLang: "en",
  params: {
    text: "hola mundo",
    lang: "es",
    modelPolicy: "offer-install",
    maxAttempts: 2,
    startPaused: false,
    ...params,
  },
  modelNeeds: ["stt"],
})

type Controls = {
  host: CapabilityHostApi
  state: {
    preparedFolders: string[]
    startedWithModel: string[]
    installCalls: number
  }
}

/** A host with a controllable install inventory + optional loaded model.
 *  Whatever `installedFolders` says, `listInstalled`/`validateModel`/`prepare`
 *  agree — so we can assert which folder the module chose to prepare. */
const makeHost = (opts: {
  installedFolders: string[]
  loadedModel?: string | null
  /** Drop listInstalled entirely to force the validateModel fallback path. */
  noListInstalled?: boolean
  /** Answer listInstalled with the legacy non-canonical Android shape. */
  androidShape?: boolean
}): Controls => {
  const state = {
    preparedFolders: [] as string[],
    startedWithModel: [] as string[],
    installCalls: 0,
  }
  const isInstalled = (f?: string) => !!f && opts.installedFolders.includes(f)
  const stt: CapabilitySttApi = {
    isAvailable: async () => true,
    getStatus: async () => ({
      available: true,
      prepared: opts.loadedModel != null,
      model: opts.loadedModel ?? null,
      recording: false,
      message: null,
    }),
    prepare: async (o) => {
      const f = o?.model ?? DEFAULT_FOLDER
      if (isInstalled(f)) {
        state.preparedFolders.push(f)
        return { ready: true, model: f }
      }
      return {
        ready: false,
        model: f,
        message: "not installed",
        code: "MODEL_NOT_INSTALLED" as const,
      }
    },
    startSession: async (o) => {
      state.startedWithModel.push(o.scoringParams ? "with-scoring" : "no-scoring")
      return { started: true, sessionId: o.sessionId }
    },
    stopSession: async (o) => makeMockTranscription(o.sessionId, "hola mundo", "es"),
    cancelSession: async () => {},
    validateModel: async (o) => ({
      model: o?.model ?? DEFAULT_FOLDER,
      valid: isInstalled(o?.model),
      problems: isInstalled(o?.model) ? [] : ["missing"],
    }),
    installModel: async () => {
      state.installCalls += 1
      return { installed: true, model: DEFAULT_FOLDER, alreadyInstalled: false }
    },
    releaseAudio: async () => {},
  }
  if (!opts.noListInstalled) {
    stt.listInstalled = async (o) => {
      if (opts.androidShape) {
        // Legacy Android bridge shape: `{ installed: [...] }`, no `models`.
        return { installed: opts.installedFolders } as never
      }
      return {
        models: o.models
          .filter((m) => isInstalled(m))
          .map((m) => ({
            model: m,
            valid: true,
            problems: [],
            sizeBytes: 1,
            isLoaded: m === opts.loadedModel,
          })),
      }
    }
  }
  const host: CapabilityHostApi = {
    speak: async () => {},
    getStackConfig: () => ({
      languages: ["en", "es"],
      rate: 1,
      showRomanization: true,
      levels: ["A0", "A1"],
    }),
    stopSpeech: async () => {},
    stt,
  }
  return { host, state }
}

const mountIn = (host: CapabilityHostApi, spec: ActivitySpec) => {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const handle = capability.mount(container, host, spec)
  return { container, handle }
}

const micReady = (container: HTMLElement) =>
  waitFor(
    () => {
      const b = container.querySelector<HTMLButtonElement>(".capPron-mic")
      return b && !b.disabled && !b.hidden ? b : null
    },
    3000,
    "mic ready",
  )

describe("cap-pronounce — shares an already-installed model (fix #1)", () => {
  it("reuses the big installed model, never shows the 75 MB install offer", async () => {
    const { host, state } = makeHost({ installedFolders: [BIG_FOLDER] })
    const { container, handle } = mountIn(host, makeSpec())
    await micReady(container)
    // No redundant install offer, no install call.
    expect(container.querySelector(".capPron-install")).toBeNull()
    expect(state.installCalls).toBe(0)
    // Prepared the BIG model — not the tiny default.
    expect(state.preparedFolders).toContain(BIG_FOLDER)
    expect(state.preparedFolders).not.toContain(DEFAULT_FOLDER)
    handle.dispose()
    container.remove()
  })

  it("prefers the currently-LOADED model (zero re-load)", async () => {
    const { host, state } = makeHost({
      installedFolders: [DEFAULT_FOLDER, BIG_FOLDER],
      loadedModel: BIG_FOLDER,
    })
    const { container, handle } = mountIn(host, makeSpec())
    await micReady(container)
    expect(state.preparedFolders).toContain(BIG_FOLDER)
    handle.dispose()
    container.remove()
  })

  it("picks the LARGEST installed model when several are present", async () => {
    const { host, state } = makeHost({
      installedFolders: [DEFAULT_FOLDER, BIG_FOLDER],
    })
    const { container, handle } = mountIn(host, makeSpec())
    await micReady(container)
    expect(state.preparedFolders).toContain(BIG_FOLDER)
    handle.dispose()
    container.remove()
  })

  it("scores using the reused model's folder (per-model scoring params)", async () => {
    const { host, state } = makeHost({ installedFolders: [BIG_FOLDER] })
    const { container, handle } = mountIn(host, makeSpec())
    const mic = await micReady(container)
    mic.dispatchEvent(pointerEvt("pointerdown"))
    await wait(20)
    mic.dispatchEvent(pointerEvt("pointerup"))
    await handle.result
    expect(state.startedWithModel).toContain("with-scoring")
    container.remove()
  })

  it("falls back to validateModel when listInstalled is absent (older host)", async () => {
    const { host, state } = makeHost({
      installedFolders: [BIG_FOLDER],
      noListInstalled: true,
    })
    const { container, handle } = mountIn(host, makeSpec())
    await micReady(container)
    expect(container.querySelector(".capPron-install")).toBeNull()
    expect(state.preparedFolders).toContain(BIG_FOLDER)
    handle.dispose()
    container.remove()
  })

  it("falls back to validateModel when listInstalled returns the legacy Android shape", async () => {
    const { host, state } = makeHost({
      installedFolders: [BIG_FOLDER],
      androidShape: true,
    })
    const { container, handle } = mountIn(host, makeSpec())
    await micReady(container)
    expect(container.querySelector(".capPron-install")).toBeNull()
    expect(state.preparedFolders).toContain(BIG_FOLDER)
    handle.dispose()
    container.remove()
  })

  it("nothing installed anywhere → still shows the install offer", async () => {
    const { host } = makeHost({ installedFolders: [] })
    const { container, handle } = mountIn(host, makeSpec())
    const prompt = await waitFor(
      () => container.querySelector<HTMLElement>(".capPron-install"),
      3000,
      "install offer",
    )
    expect(prompt.querySelector(".capPron-install-btn")).not.toBeNull()
    handle.dispose()
    container.remove()
  })
})

describe("cap-pronounce — sttModel seam (single source of truth, R5)", () => {
  it("uses the host's sttModel.resolveFolder without re-probing", async () => {
    const prepared: string[] = []
    const notePrepared: string[] = []
    const stt: CapabilitySttApi = {
      isAvailable: async () => true,
      // The PROBE reports NOTHING installed — only the seam knows the folder.
      getStatus: async () => ({
        available: true,
        prepared: false,
        model: null,
        recording: false,
        message: null,
      }),
      prepare: async (o) => {
        const f = o?.model ?? DEFAULT_FOLDER
        prepared.push(f)
        return { ready: true, model: f }
      },
      startSession: async (o) => ({ started: true, sessionId: o.sessionId }),
      stopSession: async (o) => makeMockTranscription(o.sessionId, "hola mundo", "es"),
      cancelSession: async () => {},
      listInstalled: async () => ({ models: [] }),
      validateModel: async (o) => ({
        model: o?.model ?? DEFAULT_FOLDER,
        valid: false,
        problems: ["missing"],
      }),
      releaseAudio: async () => {},
    }
    const host: CapabilityHostApi = {
      speak: async () => {},
      getStackConfig: () => ({
        languages: ["en", "es"],
        rate: 1,
        showRomanization: true,
        levels: ["A0", "A1"],
      }),
      stopSpeech: async () => {},
      stt,
      sttModel: {
        resolveFolder: () => BIG_FOLDER,
        notePrepared: (f) => notePrepared.push(f),
      },
    }
    const { container, handle } = mountIn(host, makeSpec())
    await micReady(container)
    // Seam won: prepared the BIG model the store resolved, no install offer,
    // and reported back what it prepared.
    expect(container.querySelector(".capPron-install")).toBeNull()
    expect(prepared).toContain(BIG_FOLDER)
    expect(notePrepared).toContain(BIG_FOLDER)
    handle.dispose()
    container.remove()
  })
})

describe("cap-pronounce — never offers tiny over an installed model (R1)", () => {
  it("an installed model that won't load settles unavailable, no tiny offer", async () => {
    const prepared: string[] = []
    let installCalls = 0
    const stt: CapabilitySttApi = {
      isAvailable: async () => true,
      getStatus: async () => ({
        available: true,
        prepared: false,
        model: null,
        recording: false,
        message: null,
      }),
      // Reports the big model installed, but it will not load (corrupt on disk).
      prepare: async (o) => {
        const f = o?.model ?? DEFAULT_FOLDER
        prepared.push(f)
        return { ready: false, model: f, message: "corrupt", code: "LOAD_FAILED" as const }
      },
      startSession: async (o) => ({ started: true, sessionId: o.sessionId }),
      stopSession: async (o) => makeMockTranscription(o.sessionId, "hola mundo", "es"),
      cancelSession: async () => {},
      listInstalled: async (o) => ({
        models: o.models
          .filter((m) => m === BIG_FOLDER)
          .map((m) => ({ model: m, valid: true, problems: [], sizeBytes: 1, isLoaded: false })),
      }),
      installModel: async () => {
        installCalls += 1
        return { installed: true, model: DEFAULT_FOLDER, alreadyInstalled: false }
      },
      releaseAudio: async () => {},
    }
    const host: CapabilityHostApi = {
      speak: async () => {},
      getStackConfig: () => ({
        languages: ["en", "es"],
        rate: 1,
        showRomanization: true,
        levels: ["A0", "A1"],
      }),
      stopSpeech: async () => {},
      stt,
    }
    const { container, handle } = mountIn(host, makeSpec())
    const result = await handle.result
    // Degrades (sttUnavailable) instead of offering to download the 75 MB tiny.
    expect(result.abandoned).toBe(true)
    expect(result.detail?.flags?.sttUnavailable).toBe(true)
    expect(container.querySelector(".capPron-install")).toBeNull()
    expect(installCalls).toBe(0)
    // It tried the installed big model, never the tiny default.
    expect(prepared).toContain(BIG_FOLDER)
    expect(prepared).not.toContain(DEFAULT_FOLDER)
    container.remove()
  })
})
