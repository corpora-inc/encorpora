import { useEffect, useRef, useImperativeHandle, forwardRef } from "react"
import { createScene } from "../babylon/createScene"
import { createBottle3D, type Bottle3D } from "../babylon/bottle3D"
import { createWinParticles, type WinParticles } from "../babylon/particles"
import { type FruitDef, type CEFRLevel, LEVEL_FRUIT_COLORS } from "../utils/colors"

export type BottleCanvasRef = {
  updateFill: (percent: number) => void
  setColor: (fruit: FruitDef | CEFRLevel) => void
  triggerSqueeze: () => void
  triggerWin: () => void
  reset: () => void
}

// Convert hex color to RGB components
const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (result) {
    return {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255,
    }
  }
  return { r: 1, g: 0.6, b: 0 }
}

type BottleCanvasProps = {
  initialLevel?: CEFRLevel
}

export const BottleCanvas = forwardRef<BottleCanvasRef, BottleCanvasProps>(
  function BottleCanvas({ initialLevel = "A0" }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const sceneRef = useRef<ReturnType<typeof createScene> | null>(null)
    const bottleRef = useRef<Bottle3D | null>(null)
    const particlesRef = useRef<WinParticles | null>(null)
    const currentColorRef = useRef<{ r: number; g: number; b: number }>(
      hexToRgb(LEVEL_FRUIT_COLORS[initialLevel].primary)
    )

    useEffect(() => {
      if (!canvasRef.current) return

      const { engine, scene, dispose } = createScene(canvasRef.current)
      sceneRef.current = { engine, scene, camera: null as never, dispose }

      const bottle = createBottle3D(scene, initialLevel)
      bottleRef.current = bottle

      const particles = createWinParticles(scene)
      particlesRef.current = particles

      // Update layout on resize
      const updateLayout = () => {
        const canvas = engine.getRenderingCanvas()
        if (!canvas) return

        const aspectRatio = canvas.width / canvas.height
        const worldWidth = 20
        const worldHeight = worldWidth / aspectRatio

        bottle.updateLayout(worldWidth, worldHeight)
      }

      updateLayout()
      window.addEventListener("resize", updateLayout)

      return () => {
        window.removeEventListener("resize", updateLayout)
        particles.dispose()
        bottle.dispose()
        dispose()
      }
    }, [initialLevel])

    useImperativeHandle(ref, () => ({
      updateFill: (percent: number) => {
        bottleRef.current?.updateFill(percent / 100)
      },
      setColor: (fruit: FruitDef | CEFRLevel) => {
        bottleRef.current?.setColor(fruit)
        // Track color for particles
        const fruitColors = typeof fruit === "string" ? LEVEL_FRUIT_COLORS[fruit] : fruit
        currentColorRef.current = hexToRgb(fruitColors.primary)
        // Update win particles color too
        particlesRef.current?.setColor(
          currentColorRef.current.r,
          currentColorRef.current.g,
          currentColorRef.current.b
        )
      },
      triggerSqueeze: () => {
        bottleRef.current?.triggerSqueeze()
      },
      triggerWin: () => {
        // Set particle color before triggering
        particlesRef.current?.setColor(
          currentColorRef.current.r,
          currentColorRef.current.g,
          currentColorRef.current.b
        )
        particlesRef.current?.trigger()
        bottleRef.current?.triggerOverflow()
      },
      reset: () => {
        bottleRef.current?.reset()
      },
    }))

    return (
      <div className="bottle-canvas-wrapper">
        <canvas ref={canvasRef} className="bottle-canvas" />
      </div>
    )
  }
)
