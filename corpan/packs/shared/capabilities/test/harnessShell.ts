// Shared bare-harness shell (capability-modules.md §7.2): a knob bar, a
// card-sized mount container, pause/resume/dispose buttons, a live result
// JSON panel, and the bare/hostile background toggle proving §2.4 styling
// isolation both ways (Tailwind-preflight-style resets + a fake consumer
// stylesheet with unprefixed .word/.pill/.flex classes).
import type {
  ActivitySpec,
  CapabilityHandle,
  CapabilityModule,
} from "@shared/capabilities/core"
import {
  createMockCapabilityHost,
  type MockCapabilityHostOptions,
} from "@shared/capabilities/core/mock"

// Checked-in hostile environment: the aggressive subset of Tailwind
// preflight (button/margins/borders nuked) + a fake consumer stylesheet
// defining unprefixed utility-ish classes a sloppy module would collide with.
const HOSTILE_CSS = `
/* -- tailwind-preflight (aggressive subset) -- */
*, ::before, ::after { box-sizing: border-box; border-width: 0; border-style: solid; margin: 0; padding: 0; }
html { line-height: 1.15; -webkit-text-size-adjust: 100%; font-family: ui-sans-serif, system-ui, sans-serif; }
h1, h2, h3, p { margin: 0; font-size: inherit; font-weight: inherit; }
button, input, select { font-family: inherit; font-size: 100%; line-height: inherit; color: inherit; margin: 0; padding: 0; }
button { background-color: transparent; background-image: none; cursor: pointer; appearance: button; }
ul, ol { list-style: none; }
/* -- fake consumer stylesheet (unprefixed classes a module must NOT bind) -- */
.word { background: hotpink !important; outline: 3px dashed red; }
.pill { transform: rotate(13deg); background: lime; }
.flex { display: block !important; }
.card, .banner, .detail { border: 5px double orange; }
`

export type HarnessSetup = {
  /** Rebuild the spec from the current knob values. */
  buildSpec: (knobs: Record<string, string>) => ActivitySpec
  /** Host options from knobs (e.g. mock STT score slider). */
  buildHostOptions?: (knobs: Record<string, string>) => MockCapabilityHostOptions
  /** Knob definitions: selects (options) and ranges. */
  knobs: Array<
    | { kind: "select"; id: string; label: string; options: Array<{ value: string; label: string }> }
    | { kind: "range"; id: string; label: string; min: number; max: number; step: number; value: number }
  >
}

export function bootHarness(capability: CapabilityModule, setup: HarnessSetup): void {
  document.title = `${capability.meta.id} harness`
  const app = document.createElement("div")
  app.innerHTML = `
    <style>
      body { margin: 0; font-family: system-ui, sans-serif; background: #f2efe9; }
      .hx-bar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding: 10px 14px; background: #fff; border-bottom: 1px solid #ddd; font-size: 13px; }
      .hx-bar label { display: inline-flex; gap: 6px; align-items: center; }
      .hx-stage { position: relative; width: min(520px, 94vw); height: 560px; margin: 18px auto; background: #fff; border-radius: 18px; box-shadow: 0 8px 30px rgba(0,0,0,.12); overflow: hidden; }
      .hx-result { width: min(520px, 94vw); margin: 0 auto 30px; background: #101418; color: #9fe8a8; font: 12px/1.5 ui-monospace, monospace; padding: 12px; border-radius: 10px; white-space: pre-wrap; min-height: 80px; }
      .hx-btn { padding: 5px 12px; border-radius: 8px; border: 1px solid #bbb; background: #fafafa; cursor: pointer; }
    </style>
    <div class="hx-bar" id="hx-knobs">
      <button class="hx-btn" id="hx-remount">Remount</button>
      <button class="hx-btn" id="hx-pause">Pause</button>
      <button class="hx-btn" id="hx-resume">Resume</button>
      <button class="hx-btn" id="hx-dispose">Dispose</button>
      <label><input type="checkbox" id="hx-hostile" /> hostile CSS environment</label>
    </div>
    <div class="hx-stage" id="hx-stage"></div>
    <div class="hx-result" id="hx-result">— result pending —</div>
  `
  document.body.appendChild(app)

  const knobBar = app.querySelector<HTMLDivElement>("#hx-knobs")!
  const stage = app.querySelector<HTMLDivElement>("#hx-stage")!
  const resultEl = app.querySelector<HTMLDivElement>("#hx-result")!

  for (const knob of setup.knobs) {
    const label = document.createElement("label")
    if (knob.kind === "select") {
      label.innerHTML = `${knob.label} <select id="hx-${knob.id}">${knob.options
        .map((o) => `<option value="${o.value}">${o.label}</option>`)
        .join("")}</select>`
    } else {
      label.innerHTML = `${knob.label} <input id="hx-${knob.id}" type="range" min="${knob.min}" max="${knob.max}" step="${knob.step}" value="${knob.value}" />`
    }
    knobBar.appendChild(label)
  }

  const hostileStyle = document.createElement("style")
  hostileStyle.textContent = HOSTILE_CSS
  const hostileToggle = app.querySelector<HTMLInputElement>("#hx-hostile")!
  hostileToggle.addEventListener("change", () => {
    if (hostileToggle.checked) document.head.appendChild(hostileStyle)
    else hostileStyle.remove()
  })

  const readKnobs = (): Record<string, string> => {
    const out: Record<string, string> = {}
    for (const knob of setup.knobs) {
      const el = app.querySelector<HTMLInputElement | HTMLSelectElement>(`#hx-${knob.id}`)
      if (el) out[knob.id] = el.value
    }
    return out
  }

  let handle: CapabilityHandle | null = null

  const mount = async () => {
    handle?.dispose()
    stage.innerHTML = ""
    resultEl.textContent = "— result pending —"
    const knobs = readKnobs()
    const host = createMockCapabilityHost(setup.buildHostOptions?.(knobs))
    const spec = setup.buildSpec(knobs)
    const availability = await capability.checkAvailability(host, spec)
    console.log(`[harness] availability:`, availability)
    handle = capability.mount(stage, host, spec)
    void handle.result.then((result) => {
      resultEl.textContent = JSON.stringify(result, null, 2)
    })
  }

  app.querySelector("#hx-remount")!.addEventListener("click", () => void mount())
  app.querySelector("#hx-pause")!.addEventListener("click", () => handle?.pause())
  app.querySelector("#hx-resume")!.addEventListener("click", () => handle?.resume())
  app.querySelector("#hx-dispose")!.addEventListener("click", () => handle?.dispose())

  void mount()
}
