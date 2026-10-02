import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  Edges,
  Float,
  MeshDistortMaterial,
} from '@react-three/drei'
import * as THREE from 'three'

const reduceMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const ACCENT = '#7c8cff'

/* ---------- shapes ---------- */

function Icosa() {
  return (
    <group>
      <mesh>
        <icosahedronGeometry args={[1.35, 0]} />
        <meshPhysicalMaterial
          color="#c9cfff"
          metalness={0.6}
          roughness={0.18}
          clearcoat={1}
          envMapIntensity={1.6}
          flatShading
        />
        <Edges threshold={1} color={ACCENT} />
      </mesh>
      <mesh scale={0.45}>
        <icosahedronGeometry args={[1, 3]} />
        <meshBasicMaterial color={ACCENT} toneMapped={false} />
      </mesh>
    </group>
  )
}

function Knot() {
  return (
    <mesh>
      <torusKnotGeometry args={[0.9, 0.3, 220, 28]} />
      <meshStandardMaterial color="#e8e8ee" metalness={1} roughness={0.12} envMapIntensity={1.4} />
    </mesh>
  )
}

function Box() {
  return (
    <mesh>
      <boxGeometry args={[1.8, 1.8, 1.8]} />
      <meshStandardMaterial color="#4a4a60" metalness={0.5} roughness={0.3} envMapIntensity={1.4} />
      <Edges threshold={15} color={ACCENT} />
    </mesh>
  )
}

function Discs() {
  return (
    <group rotation={[0.35, 0, 0.1]}>
      {[-0.7, 0, 0.7].map((y, i) => (
        <mesh key={i} position={[0, y, 0]} rotation={[0, i * 0.5, 0]}>
          <cylinderGeometry args={[1.25 - i * 0.12, 1.25 - i * 0.12, 0.2, 64]} />
          <meshStandardMaterial
            color={i === 1 ? ACCENT : '#cfcfd8'}
            metalness={i === 1 ? 0.3 : 1}
            roughness={i === 1 ? 0.35 : 0.18}
            envMapIntensity={1.2}
          />
        </mesh>
      ))}
    </group>
  )
}

function Blob() {
  return (
    <mesh>
      <sphereGeometry args={[1.3, 96, 96]} />
      <MeshDistortMaterial
        color="#14141c"
        metalness={0.8}
        roughness={0.2}
        distort={0.35}
        speed={1.5}
        envMapIntensity={1.3}
      />
    </mesh>
  )
}

function Ring() {
  return (
    <mesh>
      <torusGeometry args={[1.2, 0.07, 32, 160]} />
      <meshBasicMaterial color={ACCENT} toneMapped={false} />
    </mesh>
  )
}

const SHAPES = { icosa: Icosa, knot: Knot, box: Box, discs: Discs, blob: Blob, ring: Ring }

/* ---------- interaction wrapper ---------- */

// Places a shape in the scene, tilts it toward the pointer, speeds it up and
// enlarges it on hover, and reports clicks when `onSelect` is given.
export function Interactive({ shape, position, scale = 1, onSelect, active }) {
  const Shape = SHAPES[shape]
  const spinner = useRef()
  const [hovered, setHovered] = useState(false)
  const clickable = Boolean(onSelect)

  useFrame((state, dt) => {
    const g = spinner.current
    if (!g) return
    const spin = reduceMotion ? 0 : hovered || active ? 1.1 : 0.25
    g.rotation.y += dt * spin
    // Tilt toward the pointer; the lerp keeps it smooth rather than twitchy.
    const tiltX = reduceMotion ? 0 : -state.pointer.y * 0.35
    const tiltZ = reduceMotion ? 0 : state.pointer.x * 0.2
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, tiltX, 0.06)
    g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, tiltZ, 0.06)
    const target = scale * (hovered ? 1.12 : 1)
    g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, target, 0.1))
  })

  return (
    <group position={position}>
      <Float speed={reduceMotion ? 0 : 1.2} rotationIntensity={0} floatIntensity={0.6}>
        <group
          ref={spinner}
          onPointerOver={(e) => {
            e.stopPropagation()
            setHovered(true)
            if (clickable) document.body.style.cursor = 'pointer'
          }}
          onPointerOut={() => {
            setHovered(false)
            document.body.style.cursor = ''
          }}
          onClick={(e) => {
            e.stopPropagation()
            onSelect?.()
          }}
        >
          <Shape />
        </group>
      </Float>
    </group>
  )
}
