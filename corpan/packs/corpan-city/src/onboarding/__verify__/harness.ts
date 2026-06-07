// Standalone screenshot harness for the onboarding music-consent step (NOT shipped).
import { runOnboarding } from "../onboarding"
const params = new URLSearchParams(location.search)
const startStep = Number(params.get("step") ?? "3") as 0 | 1 | 2 | 3
const native = params.get("native") ?? "en"
const root = document.createElement("div")
root.style.cssText = "position:fixed;inset:0;"
document.body.appendChild(root)
void runOnboarding(root, { startStep, native })
;(window as unknown as { __wpVerifyReady?: boolean }).__wpVerifyReady = true
console.log("[verify] onboarding harness ready")
