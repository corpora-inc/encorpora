import { Float, Stars } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { useMemo, useRef } from "react"
import * as THREE from "three"

type RunnerSceneProps = {
  lanes?: number
  speed?: number
}

type Obstacle = {
  position: THREE.Vector3
  scale: THREE.Vector3
  lane: number
}

const palette = {
  track: "#10121f",
  lane: "#1c2040",
  glow: "#53f4c4",
  accent: "#f6b042",
}

export function RunnerScene({ lanes = 3, speed = 5 }: RunnerSceneProps) {
  const groupRef = useRef<THREE.Group>(null)
  const obstacles = useMemo<Obstacle[]>(() => {
    const items: Obstacle[] = []
    for (let i = 0; i < 12; i += 1) {
      const lane = i % lanes
      items.push({
        lane,
        position: new THREE.Vector3(lane - (lanes - 1) / 2, 0.4, -i * 6),
        scale: new THREE.Vector3(0.8, 0.6 + (i % 3) * 0.2, 1.4),
      })
    }
    return items
  }, [lanes])

  useFrame((_, delta) => {
    const group = groupRef.current
    if (!group) {
      return
    }
    group.position.z += speed * delta
    if (group.position.z > 6) {
      group.position.z = 0
    }
  })

  return (
    <group>
      <color attach="background" args={["#050608"]} />
      <fog attach="fog" args={["#050608", 8, 32]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 6, 2]} intensity={0.9} />
      <Stars radius={55} depth={35} count={600} factor={3} fade />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[16, 80]} />
        <meshStandardMaterial color={palette.track} />
      </mesh>
      <group>
        {Array.from({ length: lanes }).map((_, index) => {
          const x = index - (lanes - 1) / 2
          return (
            <mesh
              key={`lane-${index}`}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[x, 0, -12]}
            >
              <planeGeometry args={[0.9, 80]} />
              <meshStandardMaterial
                color={palette.lane}
                emissive={palette.glow}
                emissiveIntensity={0.08}
              />
            </mesh>
          )
        })}
      </group>
      <mesh position={[0, 0.5, 3]}>
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshStandardMaterial color={palette.accent} emissive={palette.glow} />
      </mesh>
      <group ref={groupRef}>
        {obstacles.map((item, index) => (
          <mesh
            key={`obstacle-${index}`}
            position={item.position}
            scale={item.scale}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial
              color={palette.glow}
              emissive={palette.glow}
              emissiveIntensity={0.6}
            />
          </mesh>
        ))}
      </group>
      <Float floatIntensity={1.2} speed={2.2}>
        <mesh position={[0, 2.2, -4]}>
          <ringGeometry args={[1.1, 1.4, 32]} />
          <meshStandardMaterial
            color={palette.glow}
            emissive={palette.glow}
            emissiveIntensity={1}
          />
        </mesh>
      </Float>
    </group>
  )
}
