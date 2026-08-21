// cap-pronounce — offer-install flow, dispose/mic-release, partial advance,
// and availability truth (V0.2-PLAN contract #4). The recorder/mount logic is
// dependency-injected, so these drive the real capability against a
// controllable in-test host (no native deps).
import { describe, it, expect } from "vitest"
import type {
  ActivitySpec,
  CapabilityHostApi,
  CapabilitySttApi,
  SttInstallProgress,
} from "@shared/capabilities/core"
import { makeMockTranscription } from "@shared/capabilities/core/mock"
import { createMockCapabilityHost } from "@shared/capabilities/core/mock"
import { capability } from "@shared/capabilities/pronounce"
import { visibleDefaultModel } from "@shared/capabilities/pronounce/src/modelRegistry"
import { wait, waitFor, pointerEvt } from "../test/drivers"

const FOLDER = visibleDefaultModel().folder

const makeSpec = (params?: Record<string, unknown>): ActivitySpec => ({
  specId: "spk-1",
  activityType: "cap-pronounce",
  itemRefs: [{ kind: "phrase", source: "base", id: "42" }],
  targetLang: "es",
  nativeLang: "en",
  params: {
    text: "hola mundo",
    lang: "es",
    nativeText: "hello world",
    modelPolicy: "offer-install",
    maxAttempts: 2,
    startPaused: false,
    ...params,
  },
  modelNeeds: ["stt"],
})

type InstallHostControls = {
  host: CapabilityHostApi
  state: {
    installed: boolean
    installCalls: number
    released: number
    cancelled: string[]
    sessions: string[]
  }
}

/** A host whose STT model install is controllable: starts uninstalled so the
 *  offer surface appears; installModel emits progress + flips to installed so
 *  the subsequent prepare succeeds and the round runs on the same mount. */
const makeInstallHost = (opts?: {
  overallScore?: number
  failInstall?: boolean
  supported?: boolean
  startInstalled?: boolean
}): InstallHostControls => {
  const state = {
    installed: opts?.startInstalled ?? false,
    installCalls: 0,
    released: 0,
    cancelled: [] as string[],
    sessions: [] as string[],
  }
  const stt: CapabilitySttApi = {
    isAvailable: async () => opts?.supported ?? true,
    getStatus: async () => ({
      available: opts?.supported ?? true,
      prepared: state.installed,
      model: state.installed ? FOLDER : null,
      recording: false,
      message: null,
    }),
    prepare: async (o) => ({
      ready: state.installed,
      model: o?.model ?? FOLDER,
      ...(state.installed
        ? {}
        : { message: "not installed", code: "MODEL_NOT_INSTALLED" as const }),
    }),
    startSession: async (o) => {
      state.sessions.push(o.sessionId)
      return { started: true, sessionId: o.sessionId }
    },
    stopSession: async (o) =>
      makeMockTranscription(o.sessionId, "hola mundo", "es", {
        overallScore: opts?.overallScore ?? 0.86,
      }),
    cancelSession: async (o) => {
      state.cancelled.push(o.sessionId)
    },
    listInstalled: async (o) => ({
      models: o.models
        .filter((m) => state.installed && m === FOLDER)
        .map((m) => ({ model: m, valid: true, problems: [], sizeBytes: 1, isLoaded: true })),
    }),
    installModel: async (_o, onProgress?: (e: SttInstallProgress) => void) => {
      state.installCalls += 1
      onProgress?.({ model: FOLDER, phase: "downloading", fraction: 0.5 })
      if (opts?.failInstall) {
        throw new Error("network died")
      }
      onProgress?.({ model: FOLDER, phase: "verifying" })
      state.installed = true
      return { installed: true, model: FOLDER, alreadyInstalled: false }
    },
    releaseAudio: async () => {
      state.released += 1
    },
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

describe("cap-pronounce — offer-install flow (contract #4)", () => {
  it("model missing → renders inline offer (title + install + decline)", async () => {
    const { host } = makeInstallHost()
    const { container, handle } = mountIn(host, makeSpec())
    const prompt = await waitFor(
      () => container.querySelector<HTMLElement>(".capPron-install"),
      3000,
      "install offer",
    )
    expect(prompt.querySelector(".capPron-install-title")).not.toBeNull()
    expect(prompt.querySelector(".capPron-install-btn")).not.toBeNull()
    expect(prompt.querySelector(".capPron-install-decline")).not.toBeNull()
    handle.dispose()
    container.remove()
  })

  it("decline → settles abandoned with flags.sttDeclined", async () => {
    const { host } = makeInstallHost()
    const { container, handle } = mountIn(host, makeSpec())
    const decline = await waitFor(
      () => container.querySelector<HTMLButtonElement>(".capPron-install-decline"),
      3000,
      "decline button",
    )
    decline.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    const result = await handle.result
    expect(result.abandoned).toBe(true)
    expect(result.detail?.flags?.sttDeclined).toBe(true)
    // Never mislabels a decline as a host degradation.
    expect(result.detail?.flags?.sttUnavailable).toBeUndefined()
    handle.dispose()
    container.remove()
  })

  it("install success → prompt clears, mic returns, round scores on same mount", async () => {
    const { host, state } = makeInstallHost({ overallScore: 0.9 })
    const { container, handle } = mountIn(host, makeSpec())
    const install = await waitFor(
      () => container.querySelector<HTMLButtonElement>(".capPron-install-btn"),
      3000,
      "install button",
    )
    install.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    // After install the offer disappears and the mic becomes usable.
    const mic = await waitFor(
      () => {
        const b = container.querySelector<HTMLButtonElement>(".capPron-mic")
        return b && !b.disabled && !b.hidden ? b : null
      },
      3000,
      "mic enabled after install",
    )
    expect(state.installCalls).toBe(1)
    expect(container.querySelector(".capPron-install")).toBeNull()
    // Record once → a real (non-abandoned) scoring outcome, no remount.
    mic.dispatchEvent(pointerEvt("pointerdown"))
    await wait(30)
    mic.dispatchEvent(pointerEvt("pointerup"))
    const result = await handle.result
    expect(result.abandoned).toBeUndefined()
    expect(result.perItem[0]?.outcome).toBe("pass")
    expect(result.detail?.stt?.overallScore).toBeGreaterThan(0.85)
    container.remove()
  })

  it("install failure → error shown, offer stays for retry (no settle)", async () => {
    const { host } = makeInstallHost({ failInstall: true })
    const { container, handle } = mountIn(host, makeSpec())
    const install = await waitFor(
      () => container.querySelector<HTMLButtonElement>(".capPron-install-btn"),
      3000,
      "install button",
    )
    install.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await waitFor(
      () => {
        const err = container.querySelector<HTMLElement>(".capPron-error")
        return err && !err.hidden ? err : null
      },
      3000,
      "install error surfaced",
    )
    // The offer is still there (retry) and the run has NOT settled.
    expect(container.querySelector(".capPron-install")).not.toBeNull()
    let settled = false
    void handle.result.then(() => {
      settled = true
    })
    await wait(50)
    expect(settled).toBe(false)
    handle.dispose()
    container.remove()
  })

  it("partial (0.6..0.85) advances with a partial outcome after attempts", async () => {
    const { host } = makeInstallHost({ overallScore: 0.7, startInstalled: true })
    const { container, handle } = mountIn(host, makeSpec())
    const mic = await waitFor(
      () => {
        const b = container.querySelector<HTMLButtonElement>(".capPron-mic")
        return b && !b.disabled ? b : null
      },
      3000,
      "mic enabled (preinstalled)",
    )
    // maxAttempts=2: a mid-band attempt does NOT auto-settle; a second
    // attempt exhausts the budget and settles on the best (partial ≥ 0.6).
    for (let i = 0; i < 2; i++) {
      mic.dispatchEvent(pointerEvt("pointerdown"))
      await wait(30)
      mic.dispatchEvent(pointerEvt("pointerup"))
      await wait(30)
    }
    const result = await handle.result
    expect(result.abandoned).toBeUndefined()
    expect(result.perItem[0]?.outcome).toBe("partial")
    container.remove()
  })

  it("dispose mid-record releases audio + cancels the session (fast swipe)", async () => {
    const { host, state } = makeInstallHost({ startInstalled: true })
    const { container, handle } = mountIn(host, makeSpec())
    const mic = await waitFor(
      () => {
        const b = container.querySelector<HTMLButtonElement>(".capPron-mic")
        return b && !b.disabled ? b : null
      },
      3000,
      "mic enabled",
    )
    // Open a session, then tear down before releasing (card swiped away).
    mic.dispatchEvent(pointerEvt("pointerdown"))
    await wait(30)
    expect(state.sessions.length).toBe(1)
    handle.dispose()
    await wait(10)
    expect(state.cancelled.length).toBe(1)
    expect(state.released).toBeGreaterThanOrEqual(1)
    const result = await handle.result
    expect(result.abandoned).toBe(true)
    container.remove()
  })
})

describe("cap-pronounce — feedback dwell (R4 / settleOnTopBand)", () => {
  const recordOnce = async (container: HTMLElement) => {
    const mic = await waitFor(
      () => {
        const b = container.querySelector<HTMLButtonElement>(".capPron-mic")
        return b && !b.disabled ? b : null
      },
      3000,
      "mic enabled",
    )
    mic.dispatchEvent(pointerEvt("pointerdown"))
    await wait(30)
    mic.dispatchEvent(pointerEvt("pointerup"))
  }

  it("settleOnTopBand:false → a top-band attempt does NOT auto-settle", async () => {
    const { host } = makeInstallHost({ overallScore: 0.95, startInstalled: true })
    const { container, handle } = mountIn(
      host,
      makeSpec({ settleOnTopBand: false, maxAttempts: 12 }),
    )
    await recordOnce(container)
    await wait(40)
    // The round stays OPEN so the great score can dwell — the learner advances
    // on their own Continue, never an app-initiated instant advance.
    let settled = false
    void handle.result.then(() => {
      settled = true
    })
    await wait(60)
    expect(settled).toBe(false)
    // Continue (dispose) then settles on the best (top-band) attempt.
    handle.dispose()
    const result = await handle.result
    expect(result.detail?.stt?.overallScore).toBeGreaterThan(0.85)
    container.remove()
  })

  it("default (settleOnTopBand true) → a top-band attempt auto-settles", async () => {
    const { host } = makeInstallHost({ overallScore: 0.95, startInstalled: true })
    const { container, handle } = mountIn(host, makeSpec({ maxAttempts: 12 }))
    await recordOnce(container)
    // Pack pacing preserved: a top-band attempt settles immediately (no dwell).
    const result = await handle.result
    expect(result.abandoned).toBeUndefined()
    expect(result.perItem[0]?.outcome).toBe("pass")
    container.remove()
  })
})

describe("cap-pronounce — availability truth (contract #4)", () => {
  it("supported + no model → needs-model", async () => {
    const host = createMockCapabilityHost({ stt: { installedModels: [] } })
    const a = await capability.checkAvailability(host, makeSpec())
    expect(a.state).toBe("needs-model")
  })

  it("supported + model installed → ready", async () => {
    const host = createMockCapabilityHost({ stt: { installedModels: [FOLDER] } })
    const a = await capability.checkAvailability(host, makeSpec())
    expect(a.state).toBe("ready")
  })

  it("native STT unavailable (isAvailable=false) → unavailable, not needs-model", async () => {
    const host = createMockCapabilityHost({ stt: { installedModels: [] } })
    ;(host.stt as CapabilitySttApi).isAvailable = async () => false
    const a = await capability.checkAvailability(host, makeSpec())
    expect(a.state).toBe("unavailable")
  })

  it("whisper cannot score the language → unavailable", async () => {
    const host = createMockCapabilityHost({ stt: { installedModels: [FOLDER] } })
    const a = await capability.checkAvailability(host, makeSpec({ lang: "xx" }))
    expect(a.state).toBe("unavailable")
  })

  it("no stt seam at all → unavailable", async () => {
    const host = createMockCapabilityHost({ stt: false })
    const a = await capability.checkAvailability(host, makeSpec())
    expect(a.state).toBe("unavailable")
  })
})
