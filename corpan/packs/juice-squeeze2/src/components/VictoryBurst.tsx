import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

type Particle = {
  id: number
  x: number
  y: number
  angle: number
  size: number
}

type Props = {
  trigger: number // increment to trigger burst
  color: string   // hex color for particles
}

export function VictoryBurst({ trigger, color }: Props) {
  const [particles, setParticles] = useState<Particle[]>([])

  useEffect(() => {
    if (trigger === 0) return

    // Generate 25 particles bursting outward from center-top area (near bottle)
    const newParticles: Particle[] = Array.from({ length: 25 }, (_, i) => ({
      id: Date.now() + i,
      x: 50 + (Math.random() - 0.5) * 10,  // center with slight variance
      y: 30 + (Math.random() - 0.5) * 10,  // near top of middle area
      angle: Math.random() * 360,
      size: 8 + Math.random() * 8, // varied sizes
    }))
    setParticles(newParticles)

    // Clean up after animation
    const timeout = setTimeout(() => setParticles([]), 1500)
    return () => clearTimeout(timeout)
  }, [trigger])

  return (
    <div className="victory-burst-container">
      <AnimatePresence>
        {particles.map(p => (
          <motion.div
            key={p.id}
            className="victory-particle"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
              backgroundColor: color,
              boxShadow: `0 0 ${p.size / 2}px ${color}`,
            }}
            initial={{ scale: 0, opacity: 1 }}
            animate={{
              scale: [0, 1.5, 1],
              opacity: [1, 1, 0],
              x: Math.cos(p.angle * Math.PI / 180) * 150,
              y: Math.sin(p.angle * Math.PI / 180) * 150 + 50, // gravity effect
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}
