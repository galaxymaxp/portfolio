import { useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import { Interactive } from './objects.jsx'
import { scroll } from './scroll.js'

export const STOP_GAP = 10 // distance between neighbouring objects along z
const CAMERA_OFFSET = 8 // camera sits this far in front of the current stop

const reduceMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Moves the camera down the z axis as you scroll, and shifts it slightly with
// the pointer. Because objects sit at different distances, the same camera
// shift moves near objects more than far ones — that is the parallax.
function Rig({ stops }) {
  const look = new THREE.Vector3()
  const lights = useRef()
  useFrame((state, dt) => {
    const t = scroll.progress * (stops - 1)
    const targetZ = CAMERA_OFFSET - t * STOP_GAP
    const cam = state.camera
    const px = reduceMotion ? 0 : state.pointer.x
    const py = reduceMotion ? 0 : state.pointer.y
    const k = 1 - Math.pow(0.001, dt) // frame-rate independent smoothing
    cam.position.x = THREE.MathUtils.lerp(cam.position.x, px * 0.8, k)
    cam.position.y = THREE.MathUtils.lerp(cam.position.y, py * 0.45, k)
    cam.position.z = THREE.MathUtils.lerp(cam.position.z, targetZ, k)
    look.set(cam.position.x * 0.25, cam.position.y * 0.25, cam.position.z - 10)
    cam.lookAt(look)
    lights.current?.position.copy(cam.position)
  })
  // Lights ride with the camera so every object is lit the same way as you pass it.
  return (
    <group ref={lights}>
      <pointLight position={[-4, 4, 2]} intensity={90} distance={30} color="#ffffff" />
      <pointLight position={[5, -2, 1]} intensity={60} distance={30} color="#8a97ff" />
    </group>
  )
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.15} />
      <directionalLight position={[4, 5, 6]} intensity={0.8} />
      {/* Studio-style reflections built from shapes, so no HDR file is downloaded. */}
      <Environment resolution={256}>
        <group rotation={[-Math.PI / 4, 0, 0]}>
          <Lightformer form="rect" intensity={4} position={[0, 5, -6]} scale={[12, 3, 1]} />
          <Lightformer form="rect" intensity={2} position={[-6, 1, 2]} scale={[3, 8, 1]} color="#aab4ff" />
          <Lightformer form="rect" intensity={2} position={[6, 0, 2]} scale={[3, 8, 1]} />
          <Lightformer form="ring" intensity={3} position={[0, -3, 4]} scale={4} color="#7c8cff" />
        </group>
      </Environment>
    </>
  )
}

export default function Scene({ items, activeId, onSelect }) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, CAMERA_OFFSET], fov: 40, near: 0.1, far: 80 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={['#000000']} />
      <fog attach="fog" args={['#000000', 6, 19]} />
      <Lights />
      <Rig stops={items.length} />
      <Layout items={items} activeId={activeId} onSelect={onSelect} />
      <Sparkles
        count={140}
        scale={[22, 12, STOP_GAP * items.length]}
        position={[0, 0, -(STOP_GAP * (items.length - 1)) / 2]}
        size={2.2}
        speed={0.25}
        opacity={0.5}
        color="#9aa6ff"
      />
    </Canvas>
  )
}

// Positions each object opposite its text block on wide screens, and centred
// above the text on narrow ones.
function Layout({ items, activeId, onSelect }) {
  const width = useThree((s) => s.size.width)
  const narrow = width < 768
  return items.map((item, i) => {
    const side = i % 2 === 0 ? 1 : -1
    const x = narrow || item.center ? 0 : side * 2.7
    const y = narrow ? 1.5 : item.center ? 1.5 : 0
    return (
      <Interactive
        key={item.id}
        shape={item.shape}
        position={[x, y, -i * STOP_GAP]}
        scale={(narrow ? 0.7 : 1) * (item.center ? 0.75 : 1)}
        active={activeId === item.id}
        onSelect={item.selectable ? () => onSelect(item.id) : undefined}
      />
    )
  })
}
