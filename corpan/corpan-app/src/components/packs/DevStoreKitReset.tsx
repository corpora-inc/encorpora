import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useEntitlementStore } from "@/store/entitlements"
import { useDiagnosticsStore } from "@/store/diagnostics"
import { refreshEntitlements } from "@/contentPacks/purchase"

/**
 * Dev-only reset button. Renders only when `import.meta.env.DEV` is
 * true, so production / TestFlight builds never see it.
 *
 * Behaviour:
 * - Invokes the vendored plugin's `resetTestTransactions` which iterates
 *   all current + unfinished StoreKit transactions and calls `finish()`
 *   on each. Clears pending transaction state that tangles dev
 *   iteration.
 * - Clears local entitlement state (Zustand).
 * - Clears the diagnostics ring buffer.
 * - Re-runs `refreshEntitlements` so the UI reflects fresh state.
 *
 * What this does NOT do: delete non-consumable ownership. Apple does
 * not expose an API for that outside of `SKTestSession` (XCTest only).
 * If you need a fully fresh slate for a non-consumable, sign in with a
 * different Apple ID.
 */
export function DevStoreKitReset() {
  if (!import.meta.env.DEV) return null
  return <DevStoreKitResetInner />
}

function DevStoreKitResetInner() {
  const clearEntitlements = useEntitlementStore((s) => s.clearEntitlements)
  const clearDiagnostics = useDiagnosticsStore((s) => s.clear)
  const [status, setStatus] = useState<"idle" | "running" | "ok" | "error">("idle")
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [finishedCount, setFinishedCount] = useState<number | null>(null)

  const handleReset = async () => {
    const startedAt = performance.now()
    console.info("[DevStoreKitReset] ▶ starting reset")
    setStatus("running")
    setErrMsg(null)
    setFinishedCount(null)
    try {
      // 1. Pre-state — what does our local store think right now?
      const preSub = useEntitlementStore.getState().subscription
      const prePurchased = useEntitlementStore.getState().purchasedProducts
      console.info("[DevStoreKitReset] pre-state:", {
        subscription: preSub,
        purchasedProducts: prePurchased,
      })

      // 2. Native call — drains pending StoreKit transactions
      console.info("[DevStoreKitReset] invoking plugin:iap|reset_test_transactions …")
      const res = (await invoke("plugin:iap|reset_test_transactions")) as {
        finished?: number
        environments?: string[]
        productIds?: string[]
      } | null
      console.info("[DevStoreKitReset] ✓ native returned:", res)

      // Critical diagnostic: which StoreKit environment are these
      // transactions in? `xcode` = local StoreKit Test config is active.
      // `sandbox` = Apple sandbox, scheme config NOT being applied.
      const envs = res?.environments ?? []
      if (envs.length > 0) {
        const unique = Array.from(new Set(envs))
        console.info(
          `[DevStoreKitReset] 🎯 StoreKit environment: ${unique.join(", ")}`,
          "— paired with productIds:",
          res?.productIds
        )
        if (unique.includes("sandbox")) {
          console.warn(
            "[DevStoreKitReset] ⚠ Hitting Apple's real sandbox. The scheme's StoreKit Test config is NOT being applied at runtime. `tauri ios dev` may not activate it — try launching via Xcode Run (Cmd+R) directly."
          )
        }
        if (unique.includes("xcode")) {
          console.info(
            "[DevStoreKitReset] ✓ Local StoreKit Test is active. To fully wipe test DB: Xcode → Debug → StoreKit → Manage Transactions."
          )
        }
      } else {
        console.info(
          "[DevStoreKitReset] (no transactions were found to finish — either the user has no entitlements or environment is unreported)"
        )
      }

      // 3. Clear local Zustand state + diagnostics
      console.info("[DevStoreKitReset] clearing local entitlements + diagnostics buffer")
      clearEntitlements()
      clearDiagnostics()

      // 4. Re-query StoreKit — this is where ownership can come BACK.
      //    If the Apple ID genuinely owns the non-consumable or has an
      //    active subscription, `getProductStatus` returns isOwned:true
      //    and our refreshEntitlements re-applies it. That's not a bug;
      //    it's correct behaviour. Apple does not let app code un-own a
      //    non-consumable. The logs below will show exactly what StoreKit
      //    reports after the reset — that's the ground truth.
      console.info("[DevStoreKitReset] running refreshEntitlements() — this queries StoreKit")
      await refreshEntitlements().catch((err) => {
        console.error("[DevStoreKitReset] refreshEntitlements threw:", err)
      })
      const postSub = useEntitlementStore.getState().subscription
      const postPurchased = useEntitlementStore.getState().purchasedProducts
      console.info("[DevStoreKitReset] post-state (what StoreKit reports):", {
        subscription: postSub,
        purchasedProducts: postPurchased,
      })

      if (postSub.active || postPurchased.length > 0) {
        console.warn(
          "[DevStoreKitReset] Apple still reports ownership — non-consumables and current sandbox subs cannot be cleared from app code. Switch Apple IDs for a truly fresh slate.",
          { activeSubscription: postSub.active, ownedProducts: postPurchased }
        )
      }

      setFinishedCount(res?.finished ?? 0)
      setStatus("ok")
      console.info(
        `[DevStoreKitReset] ◼ done in ${(performance.now() - startedAt).toFixed(0)}ms — finished=${res?.finished ?? 0}`
      )
      window.setTimeout(() => setStatus("idle"), 3000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error("[DevStoreKitReset] ✗ reset failed:", err)
      setErrMsg(msg)
      setStatus("error")
      window.setTimeout(() => setStatus("idle"), 5000)
    }
  }

  return (
    <div className="rounded-md border border-dashed border-purple-300 bg-purple-50/60 dark:bg-purple-950/20 dark:border-purple-800/70 p-2 text-[11px]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-purple-900 dark:text-purple-100 font-mono uppercase tracking-wider">
          dev
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-6 px-2 text-[11px]"
          onClick={handleReset}
          disabled={status === "running"}
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          {status === "running"
            ? "Resetting…"
            : status === "ok"
              ? finishedCount !== null
                ? `Reset ✓ (finished ${finishedCount})`
                : "Reset ✓"
              : "Reset StoreKit transactions"}
        </Button>
      </div>
      {errMsg ? (
        <p className="mt-1 font-mono text-[10px] text-destructive break-all">
          {errMsg}
        </p>
      ) : null}
    </div>
  )
}
