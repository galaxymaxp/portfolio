import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const reduceMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Mirror-polished chrome. It has no colour of its own: what you see is the
// studio lights (see Lights in Scene.jsx) reflected in it.
function useChrome(extra) {
  return useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#ffffff',
        metalness: 1,
        roughness: 0.07,
        clearcoat: 1,
        clearcoatRoughness: 0.04,
        envMapIntensity: 1.8,
        ...extra,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
}

// Eases a 0..1 "energy" toward 1 while hovered, so every shape can react to
// the pointer smoothly instead of snapping.
function useEnergy(hovered) {
  const s = useMemo(() => ({ e: 0, t: 0 }), [])
  return (dt, speed = 1) => {
    s.e = THREE.MathUtils.lerp(s.e, hovered ? 1 : 0, 0.06)
    s.t += reduceMotion ? 0 : dt * speed * (1 + s.e * 1.2)
    return s
  }
}

// Moves every vertex of `geometry` each frame with `fn(base, normal, out, t, e)`,
// starting from the shape it was created with, then recomputes the normals so
// the chrome reflections follow the new surface.
function useDeform(geometry, fn) {
  const base = useMemo(() => {
    const p = geometry.attributes.position.array.slice()
    geometry.computeVertexNormals()
    return { p, n: geometry.attributes.normal.array.slice() }
  }, [geometry])
  const a = useMemo(() => new THREE.Vector3(), [])
  const n = useMemo(() => new THREE.Vector3(), [])
  const o = useMemo(() => new THREE.Vector3(), [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (t, e) => {
    const pos = geometry.attributes.position
    for (let i = 0; i < pos.count; i++) {
      a.fromArray(base.p, i * 3)
      n.fromArray(base.n, i * 3)
      fn(a, n, o, t, e)
      pos.setXYZ(i, o.x, o.y, o.z)
    }
    pos.needsUpdate = true
    geometry.computeVertexNormals()
  }
}

/* ---------- hero: liquid chrome orb ---------- */

// Droplets orbiting the core, each on its own looping path, so they drift in,
// fuse with the core, and pull away again.
const DROPLETS = [
  { r: 0.2, sx: 0.9, sy: 1.3, sz: 0.7, p: 0.0, s: 0.55 },
  { r: 0.22, sx: 1.1, sy: 0.6, sz: 1.4, p: 1.7, s: 0.5 },
  { r: 0.18, sx: 0.7, sy: 1.6, sz: 1.0, p: 3.1, s: 0.45 },
  { r: 0.24, sx: 1.5, sy: 0.9, sz: 0.6, p: 4.4, s: 0.4 },
  { r: 0.16, sx: 1.2, sy: 1.1, sz: 1.7, p: 5.6, s: 0.45 },
  { r: 0.21, sx: 0.6, sy: 1.4, sz: 1.2, p: 2.4, s: 0.4 },
]

export function LiquidOrb({ hovered }) {
  const chrome = useChrome()
  const liquid = useMemo(() => {
    const mc = new MarchingCubes(56, chrome, false, false, 80000)
    mc.isolation = 70
    mc.scale.setScalar(2.4)
    return mc
  }, [chrome])
  useEffect(() => () => liquid.geometry.dispose(), [liquid])
  const tick = useEnergy(hovered)

  useFrame((_, dt) => {
    const { e, t } = tick(dt, 0.6)
    // Field coordinates run 0..1 with the centre at 0.5.
    liquid.reset()
    liquid.addBall(0.5, 0.5, 0.5, 0.9 * (1 + Math.sin(t * 1.3) * 0.04), 12)
    const reach = 0.19 + e * 0.07
    for (const d of DROPLETS) {
      const k = t * d.s + d.p
      liquid.addBall(
        0.5 + Math.sin(k * d.sx) * (reach + d.r * 0.3),
        0.5 + Math.cos(k * d.sy) * reach * 0.9,
        0.5 + Math.sin(k * d.sz + 1.3) * reach * 0.8,
        0.3 + d.r * 0.5,
        12,
      )
    }
    liquid.update()
  })

  return <primitive object={liquid} />
}

/* ---------- about: liquid cube ---------- */

// A rounded chrome cube whose faces ripple like a shaken glass of mercury.
export function LiquidCube({ hovered }) {
  const chrome = useChrome()
  // Weld the faces together so normals are shared and the surface shades
  // smoothly instead of as separate flat facets.
  const geometry = useMemo(() => {
    const g = new RoundedBoxGeometry(1.75, 1.75, 1.75, 10, 0.32)
    g.deleteAttribute('normal')
    g.deleteAttribute('uv')
    return mergeVertices(g)
  }, [])
  const tick = useEnergy(hovered)
  const deform = useDeform(geometry, (p, _n, out, t, e) => {
    const amp = 0.06 + e * 0.1
    const w =
      Math.sin(p.x * 3.1 + t * 2.0) * Math.sin(p.y * 2.7 + t * 1.6) +
      Math.sin(p.z * 3.4 - t * 1.8) * 0.6
    // Push along the direction from the centre so neighbouring vertices on
    // an edge move together and the surface never tears.
    const len = p.length()
    out.copy(p).multiplyScalar(1 + (w * amp) / len)
  })
  useFrame((_, dt) => {
    const { t, e } = tick(dt)
    deform(t, e)
  })
  return <mesh geometry={geometry} material={chrome} />
}

/* ---------- contact: spiky urchin ---------- */

const SPIKES = 140

// Evenly spread directions over a sphere (golden-angle spiral).
function sphereDirections(n) {
  const out = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2
    const r = Math.sqrt(1 - y * y)
    out.push(new THREE.Vector3(Math.cos(golden * i) * r, y, Math.sin(golden * i) * r))
  }
  return out
}

// A chrome sea urchin. Its spikes pulse in waves; on hover they shoot out.
export function Urchin({ hovered }) {
  const chrome = useChrome({ roughness: 0.1 })
  const spikes = useRef()
  const dirs = useMemo(() => sphereDirections(SPIKES), [])
  const cone = useMemo(() => {
    const g = new THREE.ConeGeometry(0.075, 1, 12)
    g.translate(0, 0.5, 0) // grow outward from the base
    return g
  }, [])
  const tick = useEnergy(hovered)
  const m = useMemo(
    () => ({ mat: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) }),
    [],
  )
  useFrame((_, dt) => {
    const { t, e } = tick(dt)
    const mesh = spikes.current
    if (!mesh) return
    dirs.forEach((d, i) => {
      const wave = 0.5 + 0.5 * Math.sin(t * 3 + d.y * 5 + d.x * 2)
      const len = 0.45 + wave * 0.35 + e * 0.45
      m.q.setFromUnitVectors(m.up, d)
      m.s.set(1, len, 1)
      m.mat.compose(d.clone().multiplyScalar(0.62), m.q, m.s)
      mesh.setMatrixAt(i, m.mat)
    })
    mesh.instanceMatrix.needsUpdate = true
  })
  return (
    <group scale={0.95}>
      <mesh material={chrome}>
        <icosahedronGeometry args={[0.7, 6]} />
      </mesh>
      <instancedMesh ref={spikes} args={[cone, chrome, SPIKES]} />
    </group>
  )
}

/* ---------- decor: rumbling rock ---------- */

// Cheap repeatable hash so a vertex always gets the same bump, and vertices
// shared by two facets stay welded.
const hash = (x, y, z) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453
  return s - Math.floor(s)
}

// A faceted chrome boulder that shudders in bursts, like something rumbling
// underneath it. Hover keeps it shaking.
export function Rumbler({ hovered }) {
  const chrome = useChrome({ flatShading: true, roughness: 0.12 })
  const body = useRef()
  const geometry = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(1, 2)
    const p = g.attributes.position
    const v = new THREE.Vector3()
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i)
      v.multiplyScalar(0.8 + hash(v.x, v.y, v.z) * 0.35)
      p.setXYZ(i, v.x, v.y, v.z)
    }
    g.computeVertexNormals()
    return g
  }, [])
  const tick = useEnergy(hovered)
  useFrame((state, dt) => {
    const { e } = tick(dt)
    const g = body.current
    if (!g || reduceMotion) return
    const t = state.clock.elapsedTime
    // Rumbles come in bursts every few seconds; hovering holds it at full.
    const burst = Math.max(Math.pow(Math.max(Math.sin(t * 0.9), 0), 6), e)
    const k = 0.06 * burst
    g.position.set(Math.sin(t * 61) * k, Math.sin(t * 47 + 1) * k, Math.sin(t * 53 + 2) * k)
    g.rotation.set(Math.sin(t * 43) * k * 0.6, 0, Math.sin(t * 59) * k * 0.6)
  })
  return <mesh ref={body} geometry={geometry} material={chrome} />
}

/* ---------- decor: twisting bar ---------- */

// A square chrome bar that wrings itself one way, then the other.
export function Twister({ hovered }) {
  const chrome = useChrome()
  // Many rows along its length so the twist bends smoothly.
  const dense = useMemo(() => new THREE.BoxGeometry(0.6, 2.6, 0.6, 2, 80, 2), [])
  const tick = useEnergy(hovered)
  const deform = useDeform(dense, (p, _n, out, t, e) => {
    const twist = Math.sin(t * 0.8) * (1.6 + e * 1.4) * p.y
    const c = Math.cos(twist)
    const s = Math.sin(twist)
    out.set(p.x * c - p.z * s, p.y, p.x * s + p.z * c)
  })
  useFrame((_, dt) => {
    const { t, e } = tick(dt)
    deform(t, e)
  })
  return <mesh geometry={dense} material={chrome} rotation={[0, 0, 0.5]} />
}
