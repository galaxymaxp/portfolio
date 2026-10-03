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
      <pointLight position={[5, -2, 1]} intensity={60} distance={30} color="#ffffff" />
    </group>
  )
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.15} />
      <directionalLight position={[4, 5, 6]} intensity={0.8} />
      {/* Studio-style reflections built from shapes, so no HDR file is downloaded. */}
      {/* A black studio with bright softboxes: chrome reflects these as the
          crisp white bands and highlights that make it read as metal. */}
      <Environment resolution={512}>
        <Lightformer form="rect" intensity={2} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[7, 2.5, 1]} />
        <Lightformer form="rect" intensity={4} position={[-5, 1, 3]} rotation-y={Math.PI / 2.5} scale={[1.2, 10, 1]} />
        <Lightformer form="rect" intensity={4} position={[5, 1, 3]} rotation-y={-Math.PI / 2.5} scale={[1.2, 10, 1]} />
        <Lightformer form="rect" intensity={2} position={[0, 0, -8]} scale={[14, 1.2, 1]} />
        <Lightformer form="rect" intensity={1.5} position={[0, -1.5, 8]} rotation-y={Math.PI} scale={[8, 0.6, 1]} />
        <Lightformer form="rect" intensity={0.6} position={[0, -6, 0]} rotation-x={-Math.PI / 2} scale={[10, 10, 1]} />
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
      <Decor stops={items.length} />
      <Sparkles
        count={140}
        scale={[22, 12, STOP_GAP * items.length]}
        position={[0, 0, -(STOP_GAP * (items.length - 1)) / 2]}
        size={2.2}
        speed={0.25}
        opacity={0.5}
        color="#ffffff"
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
        yaw={narrow ? 0 : -side * 0.4}
        active={activeId === item.id}
        onSelect={item.selectable ? () => onSelect(item.id) : undefined}
      />
    )
  })
}

// Extra pieces you fly past between sections. Each sits behind the previous
// stop on that stop's object side (even stops right, odd left) and further
// out than the object, so it never hides behind the text or the object.
const DECOR = [
  { shape: 'rumbler', at: 0.5, x: 6, y: 2.4, scale: 0.55 },
  { shape: 'twister', at: 1.5, x: -6, y: -2.2, scale: 0.7 },
  { shape: 'rumbler', at: 2.5, x: 6, y: -2.3, scale: 0.45 },
  { shape: 'twister', at: 3.5, x: -6, y: 2.3, scale: 0.6 },
]

function Decor({ stops }) {
  const width = useThree((s) => s.size.width)
  if (width < 768) return null
  return DECOR.filter((d) => d.at < stops - 1).map((d, i) => (
    <Interactive key={i} shape={d.shape} position={[d.x, d.y, -d.at * STOP_GAP]} scale={d.scale} />
  ))
}
