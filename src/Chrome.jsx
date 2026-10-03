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

// How long each phase lasts, in seconds.
const PHASE = { assemble: 2.3, hold: 2.8, shake: 1.1, scatter: 2.4 }
const STAGGER = 0.045 // delay between blocks setting off when assembling
const FLY = 1.0 // how long one block takes to fly home

const clamp01 = (x) => Math.min(Math.max(x, 0), 1)
const easeInOut = (x) => x * x * (3 - 2 * x)
// Overshoots a little before settling: the "snap" of a magnet.
const easeOutBack = (x) => {
  const c = 1.9
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2)
}

// 27 chrome blocks on a loop: they fly in and snap into a cube, the cube
// turns and its top layer twists, it shakes harder and harder, then blows
// apart; the pieces drift and tumble until they are pulled back in.
//
// Every block keeps its real position, velocity and rotation, and each phase
// starts from wherever the last one left it, so nothing ever jumps.
// Tapping the finished cube skips straight to the shake.
export function Blocks({ hovered, taps = 0 }) {
  const chrome = useChrome({ roughness: 0.09 })
  const mesh = useRef()
  const geometry = useMemo(() => new RoundedBoxGeometry(0.6, 0.6, 0.6, 4, 0.07), [])
  const tick = useEnergy(hovered)

  const sim = useMemo(() => {
    const blocks = SLOTS.map(([x, y, z], i) => ({
      home: new THREE.Vector3(x, y, z).multiplyScalar(PITCH),
      top: y === 1,
      pos: new THREE.Vector3(x, y, z).multiplyScalar(PITCH * 4),
      quat: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 1, 0).normalize(), i),
      from: new THREE.Vector3(),
      fromQuat: new THREE.Quaternion(),
      vel: new THREE.Vector3(),
      spin: new THREE.Vector3(),
    }))
    const state = { blocks, phase: 'assemble', time: 0, round: 0, captured: false }
    if (import.meta.env.DEV) window.__blocks = state // for automated checks only
    return state
  }, [])

  const tmp = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
      p: new THREE.Vector3(),
      v: new THREE.Vector3(),
      one: new THREE.Vector3(1, 1, 1),
      yAxis: new THREE.Vector3(0, 1, 0),
      identity: new THREE.Quaternion(),
    }),
    [],
  )

  const enter = (phase) => {
    sim.phase = phase
    sim.time = 0
    sim.captured = false
  }

  // A tap only counts while the cube is whole.
  useEffect(() => {
    if (taps > 0 && sim.phase === 'hold') enter('shake')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taps])

  useFrame((_, dt) => {
    tick(dt)
    const g = mesh.current
    if (!g) return
    const step = reduceMotion ? 0 : Math.min(dt, 1 / 30) * (hovered ? 1.5 : 1)
    sim.time += step
    const t = sim.time
    const { m, q, p, v, one, yAxis, identity } = tmp

    if (sim.phase === 'assemble') {
      if (!sim.captured) {
        sim.blocks.forEach((b) => {
          b.from.copy(b.pos)
          b.fromQuat.copy(b.quat)
        })
        sim.captured = true
      }
      sim.blocks.forEach((b, i) => {
        const k = clamp01((t - i * STAGGER) / FLY)
        b.pos.copy(b.from).lerp(b.home, easeOutBack(k))
        b.quat.copy(b.fromQuat).slerp(identity, easeInOut(k))
      })
      if (t >= PHASE.assemble) {
        sim.blocks.forEach((b) => {
          b.pos.copy(b.home)
          b.quat.identity()
        })
        enter('hold')
      }
    } else if (sim.phase === 'hold') {
      // A quarter turn of the whole cube, then a quarter twist of the top
      // layer. Both end on a quarter turn, so the blocks land back in slots.
      const spin = easeInOut(clamp01((t - 0.3) / 1.0)) * (Math.PI / 2)
      const twist = easeInOut(clamp01((t - 1.5) / 0.8)) * (Math.PI / 2)
      sim.blocks.forEach((b) => {
        b.pos.copy(b.home)
        b.quat.identity()
        if (b.top) {
          b.pos.applyAxisAngle(yAxis, twist)
          b.quat.premultiply(q.setFromAxisAngle(yAxis, twist))
        }
        b.pos.applyAxisAngle(yAxis, spin)
        b.quat.premultiply(q.setFromAxisAngle(yAxis, spin))
      })
      if (t >= PHASE.hold) {
        // Re-home each block to the slot it now occupies, keeping its
        // current position and rotation exactly.
        sim.blocks.forEach((b) => b.home.copy(b.pos))
        enter('shake')
      }
    } else if (sim.phase === 'shake') {
      // Rumble that builds up until the cube can't hold together.
      const k = clamp01(t / PHASE.shake)
      const amp = 0.012 + k * k * 0.07
      sim.blocks.forEach((b, i) => {
        const w = t * 70 + i * 13.7
        p.set(Math.sin(w), Math.sin(w * 1.3 + 2), Math.sin(w * 0.9 + 4)).multiplyScalar(amp)
        b.pos.copy(b.home).addScaledVector(b.home, k * 0.06).add(p)
      })
      if (t >= PHASE.shake) {
        sim.round++
        sim.blocks.forEach((b, i) => {
          // Burst outward from the centre, with a per-round wobble so every
          // explosion is different.
          v.copy(b.home)
          v.x += (hash(sim.round, i, 1) - 0.5) * 0.9
          v.y += (hash(sim.round, i, 2) - 0.5) * 0.9
          v.z += (hash(sim.round, i, 3) - 0.5) * 0.9
          if (v.lengthSq() < 0.01) v.set(0, 1, 0)
          b.vel.copy(v.normalize()).multiplyScalar(5.5 + hash(sim.round, i, 4) * 2.5)
          b.spin.set(hash(sim.round, i, 5) - 0.5, hash(sim.round, i, 6) - 0.5, hash(sim.round, i, 7) - 0.5)
          b.spin.multiplyScalar(14)
        })
        enter('scatter')
      }
    } else if (sim.phase === 'scatter') {
      // Fly out and slow down (drag), tumbling as they go.
      const drag = Math.exp(-3.2 * step)
      sim.blocks.forEach((b) => {
        b.pos.addScaledVector(b.vel, step)
        b.vel.multiplyScalar(drag)
        b.spin.multiplyScalar(Math.exp(-1.2 * step))
        const angle = b.spin.length() * step
        if (angle > 0) b.quat.premultiply(q.setFromAxisAngle(v.copy(b.spin).normalize(), angle))
      })
      if (t >= PHASE.scatter) {
        // The cube reassembles in the plain grid layout.
        sim.blocks.forEach((b, i) => b.home.set(...SLOTS[i]).multiplyScalar(PITCH))
        enter('assemble')
      }
    }

    sim.blocks.forEach((b, i) => {
      m.compose(b.pos, b.quat, one)
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
