import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'

const reduceMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const media = (file) => `${import.meta.env.BASE_URL}media/${file}`

function roundedRect(w, h, r) {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + h - r)
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  s.lineTo(x + r, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  return s
}

// ShapeGeometry's UVs are raw shape coordinates; rescale them to 0..1 so a
// texture spans the whole rounded rectangle.
function flatPanel(w, h, r) {
  const g = new THREE.ShapeGeometry(roundedRect(w, h, r), 24)
  const uv = g.attributes.uv
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / w + 0.5, uv.getY(i) / h + 0.5)
  return g
}

function loadTexture(file) {
  const t = new THREE.TextureLoader().load(media(file))
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

/* ---------- phone (same model as the Stay Focused showcase) ---------- */

const BODY = { w: 1.6, h: 3.43, d: 0.16, r: 0.24 }
const SCREEN = { w: 1.47, h: 3.3, r: 0.18 }

// Shows the poster still at once, then swaps to the looping app recording as
// soon as the video has a frame, so the screen is never blank.
function usePhoneScreen() {
  const material = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({ toneMapped: false })
    m.map = loadTexture('stay-focused.webp')
    return m
  }, [])
  useEffect(() => {
    const video = document.createElement('video')
    Object.assign(video, { src: media('stay-focused.mp4'), muted: true, loop: true, playsInline: true })
    video.setAttribute('playsinline', '')
    const texture = new THREE.VideoTexture(video)
    texture.colorSpace = THREE.SRGBColorSpace
    const onPlaying = () => {
      material.map = texture
      material.needsUpdate = true
    }
    video.addEventListener('playing', onPlaying)
    video.play().catch(() => {}) // autoplay refused: the poster stays up
    return () => {
      video.removeEventListener('playing', onPlaying)
      video.pause()
      texture.dispose()
    }
  }, [material])
  return material
}

export function Phone() {
  const screen = usePhoneScreen()
  const g = useMemo(() => {
    const bevel = 0.035
    const body = new THREE.ExtrudeGeometry(roundedRect(BODY.w - bevel * 2, BODY.h - bevel * 2, BODY.r - bevel), {
      depth: BODY.d - bevel * 2,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 6,
      curveSegments: 32,
    })
    body.center()
    return {
      body,
      glass: flatPanel(BODY.w - 0.03, BODY.h - 0.03, BODY.r - 0.015),
      screen: flatPanel(SCREEN.w, SCREEN.h, SCREEN.r),
      punch: new THREE.CircleGeometry(0.038, 32),
    }
  }, [])
  const front = BODY.d / 2
  const frame = '#2c2d33'
  return (
    <group scale={0.78}>
      <mesh geometry={g.body}>
        <meshPhysicalMaterial color={frame} metalness={1} roughness={0.28} clearcoat={0.6} envMapIntensity={1.3} />
      </mesh>
      <mesh geometry={g.glass} position={[0, 0, front + 0.002]}>
        <meshPhysicalMaterial color="#030304" roughness={0.08} clearcoat={1} envMapIntensity={1.4} />
      </mesh>
      <mesh geometry={g.screen} position={[0, 0, front + 0.004]} material={screen} />
      <mesh geometry={g.punch} position={[0, SCREEN.h / 2 - 0.055, front + 0.006]}>
        <meshBasicMaterial color="#000" />
      </mesh>
      {[
        [-1, 1.0, 0.16],
        [-1, 0.66, 0.26],
        [-1, 0.3, 0.26],
        [1, 0.6, 0.42],
      ].map(([side, y, len], i) => (
        <mesh key={i} position={[side * (BODY.w / 2 + 0.008), y, 0]}>
          <boxGeometry args={[0.025, len, 0.06]} />
          <meshStandardMaterial color={frame} metalness={1} roughness={0.3} />
        </mesh>
      ))}
    </group>
  )
}

/* ---------- monitor showing the VAL Checker site ---------- */

const MON = { w: 3.3, h: 2.06, bezel: 0.07, d: 0.09 }
const PAGE = { w: 1200, h: 1610 } // val-checker.webp
// Share of the page height the screen shows at once.
const VISIBLE = PAGE.w / (MON.w / MON.h) / PAGE.h

// One browse cycle in seconds: pause at the top, scroll down, pause, scroll up.
const HOLD = 3
const MOVE = 5
const CYCLE = (HOLD + MOVE) * 2

function scrollAt(t) {
  const c = t % CYCLE
  const ease = (x) => x * x * (3 - 2 * x)
  if (c < HOLD) return 0
  if (c < HOLD + MOVE) return ease((c - HOLD) / MOVE)
  if (c < HOLD * 2 + MOVE) return 1
  return 1 - ease((c - HOLD * 2 - MOVE) / MOVE)
}

// A monitor showing the VAL Checker app, scrolling slowly through the page
// as if someone were browsing it.
export function Monitor() {
  const screen = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({ toneMapped: false })
    m.map = loadTexture('val-checker.webp')
    m.map.repeat.set(1, VISIBLE)
    m.map.offset.y = 1 - VISIBLE
    return m
  }, [])
  useFrame((state) => {
    if (reduceMotion) return
    screen.map.offset.y = (1 - VISIBLE) * (1 - scrollAt(state.clock.elapsedTime))
  })
  const shell = '#1d1e24'
  return (
    <group scale={0.82} position={[0, 0.25, 0]}>
      {/* Thin-bezel panel with the site on its face. */}
      <RoundedBox args={[MON.w + MON.bezel * 2, MON.h + MON.bezel * 2, MON.d]} radius={0.04} smoothness={4}>
        <meshPhysicalMaterial color={shell} metalness={0.9} roughness={0.3} clearcoat={0.5} envMapIntensity={1.2} />
      </RoundedBox>
      <mesh position={[0, 0, MON.d / 2 + 0.002]} material={screen}>
        <planeGeometry args={[MON.w, MON.h]} />
      </mesh>
      {/* Neck and foot. */}
      <mesh position={[0, -MON.h / 2 - 0.42, -0.12]}>
        <boxGeometry args={[0.32, 0.9, 0.06]} />
        <meshStandardMaterial color={shell} metalness={1} roughness={0.25} envMapIntensity={1.3} />
      </mesh>
      <RoundedBox args={[1.3, 0.05, 0.75]} radius={0.02} position={[0, -MON.h / 2 - 0.87, -0.05]}>
        <meshStandardMaterial color={shell} metalness={1} roughness={0.25} envMapIntensity={1.3} />
      </RoundedBox>
    </group>
  )
}
