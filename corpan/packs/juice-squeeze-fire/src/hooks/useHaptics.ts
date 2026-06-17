/**
 * Haptics hook (STUB).
 *
 * Wraps the optional native `hostApi.haptic?.({ type })`. Safe no-op when the
 * host doesn't provide haptics (desktop / mock). Real tuning is a later phase;
 * the surface is final so callers don't change.
 */
import { useCallback } from "react"
import type { HostApi, HapticType } from "../sdk/types"

export function useHaptics(hostApi: HostApi) {
  const fire = useCallback(
    (type: HapticType) => {
      try {
        hostApi.haptic?.({ type })
      } catch {
        // swallow — haptics are best-effort
      }
    },
    [hostApi]
  )
  return { fire }
}
