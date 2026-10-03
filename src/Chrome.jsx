import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
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

/* ---------- hero: magnetic building blocks ---------- */

const PITCH = 0.66 // block size plus gap
const SLOTS = []
for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) SLOTS.push([x, y, z])

// The loop, in seconds. Blocks fly in and snap together, the cube spins and
// its top layer twists, then it blows apart and the pieces drift and tumble
// until the next round pulls them back in.
const T = { assemble: 2.8, stagger: 0.045, fly: 1.0, spin: [3.0, 4.1], twist: [4.2, 5.0], explode: [5.5, 6.1], end: 8.2 }
const BLAST = 1.7
const DRIFT = 0.4

const clamp01 = (x) => Math.min(Math.max(x, 0), 1)
const easeInOut = (x) => x * x * (3 - 2 * x)
const easeOut = (x) => 1 - Math.pow(1 - x, 3)
// Overshoots a little before settling: the "snap" of a magnet.
const easeOutBack = (x) => {
  const c = 1.9
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2)
}

// Direction block `i` is thrown in round `c`: outward from its slot, with a
// per-round wobble so every explosion looks different.
function blastDir(c, i, out) {
  const [x, y, z] = SLOTS[i]
  out.set(x + (hash(c, i, 1) - 0.5) * 1.6, y + (hash(c, i, 2) - 0.5) * 1.6, z + (hash(c, i, 3) - 0.5) * 1.6)
  if (out.lengthSq() < 0.01) out.set(0, 1, 0)
  return out.normalize()
}

function tumbleAxis(c, i, out) {
  return out.set(hash(c, i, 4) - 0.5, hash(c, i, 5) - 0.5, hash(c, i, 6) - 0.5).normalize()
}

export function Blocks({ hovered }) {
  const chrome = useChrome({ roughness: 0.09 })
  const mesh = useRef()
  const geometry = useMemo(() => new RoundedBoxGeometry(0.6, 0.6, 0.6, 4, 0.07), [])
  const tick = useEnergy(hovered)
  const tmp = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
      q2: new THREE.Quaternion(),
      p: new THREE.Vector3(),
      a: new THREE.Vector3(),
      b: new THREE.Vector3(),
      d: new THREE.Vector3(),
      ax: new THREE.Vector3(),
      one: new THREE.Vector3(1, 1, 1),
      yAxis: new THREE.Vector3(0, 1, 0),
    }),
    [],
  )

  useFrame((_, dt) => {
    const { t } = tick(dt, 1)
    const g = mesh.current
    if (!g) return
    const round = Math.floor(t / T.end)
    const lt = t - round * T.end
    const { m, q, q2, p, a, b, d, ax, one, yAxis } = tmp

    // Whole-cube spin and top-layer twist are each exactly a quarter turn,
    // so once they finish the blocks sit in slots again and the angles can
    // snap back to zero invisibly (every block looks the same).
    const spin = easeInOut(clamp01((lt - T.spin[0]) / (T.spin[1] - T.spin[0]))) * (Math.PI / 2)
    const twist = easeInOut(clamp01((lt - T.twist[0]) / (T.twist[1] - T.twist[0]))) * (Math.PI / 2)
    const exploding = lt >= T.explode[0]

    SLOTS.forEach(([sx, sy, sz], i) => {
      b.set(sx, sy, sz).multiplyScalar(PITCH) // home slot
      if (!exploding) {
        // Fly in from where the last round's explosion left this block.
        blastDir(round - 1, i, d)
        a.copy(b).addScaledVector(d, BLAST + DRIFT)
        const k = clamp01((lt - i * T.stagger) / T.fly)
        const e = easeOutBack(k)
        p.copy(a).lerp(b, e)
        tumbleAxis(round - 1, i, ax)
        q.setFromAxisAngle(ax, (1 - easeOut(k)) * 4)
        if (sy === 1) {
          p.applyAxisAngle(yAxis, twist)
          q.premultiply(q2.setFromAxisAngle(yAxis, twist))
        }
        p.applyAxisAngle(yAxis, spin)
        q.premultiply(q2.setFromAxisAngle(yAxis, spin))
      } else {
        // Blast outward fast, then keep drifting and tumbling.
        blastDir(round, i, d)
        const k = easeOut(clamp01((lt - T.explode[0]) / (T.explode[1] - T.explode[0])))
        const drift = clamp01((lt - T.explode[1]) / (T.end - T.explode[1])) * DRIFT
        p.copy(b).addScaledVector(d, k * BLAST + drift)
        tumbleAxis(round, i, ax)
        q.setFromAxisAngle(ax, (k + drift) * 4)
      }
      m.compose(p, q, one)
      g.setMatrixAt(i, m)
    })
    g.instanceMatrix.needsUpdate = true
  })

  return <instancedMesh ref={mesh} args={[geometry, chrome, SLOTS.length]} />
}

/* ---------- contact: a planet forming ---------- */

const DEBRIS = 170

// A molten chrome core that churns as it forms, with rubble spiralling in
// from an accretion disk and vanishing into it, plus a thin dust ring.
// Hover speeds the whole system up.
export function Planet({ hovered }) {
  const chrome = useChrome({ roughness: 0.1 })
  const rocky = useChrome({ roughness: 0.18, flatShading: true })
  // Welded so normals are shared and the churning surface shades smoothly.
  const core = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(0.85, 20)
    g.deleteAttribute('normal')
    g.deleteAttribute('uv')
    return mergeVertices(g)
  }, [])
  const debris = useRef()
  const dust = useRef()
  const chunk = useMemo(() => new THREE.IcosahedronGeometry(0.06, 0), [])
  const grain = useMemo(() => new THREE.IcosahedronGeometry(0.018, 0), [])
  const tick = useEnergy(hovered)

  // Each piece of rubble: its own start angle, speed, height and lifetime.
  const rubble = useMemo(
    () =>
      Array.from({ length: DEBRIS }, (_, i) => ({
        angle: hash(i, 1, 9) * Math.PI * 2,
        speed: 0.5 + hash(i, 2, 9) * 0.6,
        life: 4 + hash(i, 3, 9) * 4,
        offset: hash(i, 4, 9),
        lift: (hash(i, 5, 9) - 0.5) * 0.25,
        size: 0.5 + hash(i, 6, 9) * 1.3,
        spinAxis: new THREE.Vector3(hash(i, 7, 9) - 0.5, hash(i, 8, 9) - 0.5, 0.3).normalize(),
      })),
    [],
  )

  const deform = useDeform(core, (p, n, out, t) => {
    // Slow, broad swells plus finer churn: a surface that is still settling.
    const w =
      Math.sin(n.x * 4 + t * 0.9) * Math.sin(n.y * 3.5 - t * 0.7) * 0.05 +
      Math.sin(n.z * 9 + n.x * 6 + t * 1.6) * 0.018
    out.copy(p).addScaledVector(n, w)
  })

  const tmp = useMemo(
    () => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3() }),
    [],
  )

  useFrame((_, dt) => {
    const { t, e } = tick(dt, 1)
    deform(t, e)
    const { m, q, p, s } = tmp

    const d = debris.current
    if (d) {
      rubble.forEach((r, i) => {
        // Age 0 = outer edge of the disk, 1 = swallowed by the core.
        const age = (t / r.life + r.offset) % 1
        const radius = THREE.MathUtils.lerp(2.3, 0.82, Math.pow(age, 1.4))
        const ang = r.angle + t * r.speed * (2.4 / radius) // faster near the core
        p.set(Math.cos(ang) * radius, r.lift * radius, Math.sin(ang) * radius)
        q.setFromAxisAngle(r.spinAxis, t * 2 + i)
        const shrink = age > 0.9 ? 1 - (age - 0.9) / 0.1 : 1
        s.setScalar(r.size * shrink)
        m.compose(p, q, s)
        d.setMatrixAt(i, m)
      })
      d.instanceMatrix.needsUpdate = true
    }
    if (dust.current) dust.current.rotation.y = t * 0.12
  })

  const ring = useMemo(() => {
    const ms = []
    const mm = new THREE.Matrix4()
    for (let i = 0; i < 400; i++) {
      const a = hash(i, 11, 3) * Math.PI * 2
      const r = 2.5 + hash(i, 12, 3) * 0.45
      mm.makeTranslation(Math.cos(a) * r, (hash(i, 13, 3) - 0.5) * 0.04, Math.sin(a) * r)
      ms.push(mm.clone())
    }
    return ms
  }, [])

  return (
    <group rotation={[0.38, 0, -0.18]}>
      <mesh geometry={core} material={chrome} />
      <instancedMesh ref={debris} args={[chunk, rocky, DEBRIS]} />
      <instancedMesh
        ref={(mesh) => {
          dust.current = mesh
          if (mesh && !mesh.userData.filled) {
            ring.forEach((mm, i) => mesh.setMatrixAt(i, mm))
            mesh.instanceMatrix.needsUpdate = true
            mesh.userData.filled = true
          }
        }}
        args={[grain, chrome, ring.length]}
      />
    </group>
  )
}
