import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Float } from '@react-three/drei'
import * as THREE from 'three'
import { LiquidCube, LiquidOrb, Rumbler, Twister, Urchin } from './Chrome.jsx'
import { Monitor, Phone } from './Devices.jsx'

const reduceMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* ---------- shapes ---------- */

const SHAPES = {
  orb: LiquidOrb,
  cube: LiquidCube,
  urchin: Urchin,
  rumbler: Rumbler,
  twister: Twister,
  phone: Phone,
  monitor: Monitor,
}

// Devices turn to face you and sway; everything else spins.
const SWAY = new Set(['phone', 'monitor'])

/* ---------- interaction wrapper ---------- */

// Places a shape in the scene, tilts it toward the pointer, livens it up and
// enlarges it on hover, and reports clicks when `onSelect` is given.
// `yaw` turns devices toward the middle of the screen.
export function Interactive({ shape, position, scale = 1, yaw = 0, onSelect, active }) {
  const Shape = SHAPES[shape]
  const sway = SWAY.has(shape)
  const spinner = useRef()
  const [hovered, setHovered] = useState(false)
  const clickable = Boolean(onSelect)

  useFrame((state, dt) => {
    const g = spinner.current
    if (!g) return
    if (sway) {
      // Face the viewer more squarely on hover; otherwise drift gently.
      const drift = reduceMotion || hovered ? 0 : Math.sin(state.clock.elapsedTime * 0.6) * 0.12
      const target = (hovered ? yaw * 0.3 : yaw) + drift + (reduceMotion ? 0 : state.pointer.x * 0.25)
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, target, 0.06)
    } else {
      const spin = reduceMotion ? 0 : hovered || active ? 1.1 : 0.25
      g.rotation.y += dt * spin
    }
    // Tilt toward the pointer; the lerp keeps it smooth rather than twitchy.
    const tiltX = reduceMotion ? 0 : -state.pointer.y * 0.35
    const tiltZ = reduceMotion || sway ? 0 : state.pointer.x * 0.2
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
          <Shape hovered={hovered} />
        </group>
      </Float>
    </group>
  )
}
