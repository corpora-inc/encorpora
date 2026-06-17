/**
 * Sound-effects hook.
 *
 * Wraps the `SfxEngine` (src/audio/SfxEngine.ts): preloaded HTMLAudioElements,
 * gesture-unlocked on iOS, cloned-per-play so events overlap freely.
 *  - `play("win")`            → win.wav            (every correct phrase, 1.0)
 *  - `play("fill")`           → fill.wav           (the pour "glug", 0.85)
 *  - `play("bottleComplete")` → level-complete.wav (a bottle fills, 1.0)
 *  - `play("jarClose")`       → jar-close.wav      (the jar caps + flies up, 0.9)
 *  - `play("snap")`           → snap.wav           (tap-to-place a word, 0.5)
 *  - `play("ping")`           → ping-h-1.wav       (soft accent on bottle-complete, 0.5)
 *  - `playBottle()`           → convenience alias for the bottle sound.
 *
 * Respects `settings.soundEffectsEnabled`. Every call is fail-safe (the engine
 * itself never throws); when sound is disabled we simply skip playback.
 */
import { useCallback, useEffect, useMemo } from "react"
import { getSfxEngine, type SfxName } from "../audio/SfxEngine"
import { useGameStore } from "../state/gameStore"

export type { SfxName }

export function useSfx() {
  const engine = useMemo(() => getSfxEngine(), [])

  // Preload + decode the sounds once so the first win is instant.
  useEffect(() => {
    engine.preload()
  }, [engine])

  const play = useCallback(
    (name: SfxName) => {
      if (!useGameStore.getState().settings.soundEffectsEnabled) return
      engine.play(name)
    },
    [engine]
  )

  const playBottle = useCallback(() => play("bottleComplete"), [play])

  return { play, playBottle }
}
