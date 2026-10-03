import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js'

const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Droplets orbiting the core. Each traces its own looping path (different
// speeds per axis), so they drift in, fuse with the core, and pull away again.
const DROPLETS = [
  { r: 0.2, sx: 0.9, sy: 1.3, sz: 0.7, p: 0.0, s: 0.55 },
  { r: 0.22, sx: 1.1, sy: 0.6, sz: 1.4, p: 1.7, s: 0.5 },
  { r: 0.18, sx: 0.7, sy: 1.6, sz: 1.0, p: 3.1, s: 0.45 },
  { r: 0.24, sx: 1.5, sy: 0.9, sz: 0.6, p: 4.4, s: 0.4 },
  { r: 0.16, sx: 1.2, sy: 1.1, sz: 1.7, p: 5.6, s: 0.45 },
  { r: 0.21, sx: 0.6, sy: 1.4, sz: 1.2, p: 2.4, s: 0.4 },
]

const haloVertex = /* glsl */ `
varying vec3 vNormal;
varying vec3 vView;
void main(){
  vec4 world = modelMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-(viewMatrix * world).xyz);
  gl_Position = projectionMatrix * viewMatrix * world;
}`

// Seen from inside (back faces), so the glow is strongest just around the
// orb and fades to nothing at the halo's edge.
const haloFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uEnergy;
uniform float uTime;
varying vec3 vNormal;
varying vec3 vView;
void main(){
  float f = pow(abs(dot(vNormal, vView)), 3.0);
  float pulse = 0.85 + 0.15 * sin(uTime * 1.6);
  f *= (0.18 + uEnergy * 0.2) * pulse;
  gl_FragColor = vec4(uColor * f, f);
}`

// Black liquid lit by the spotlight overhead: bright highlights on top, a
// faint rim below, everything else falls away to black.
const liquidVertex = /* glsl */ `
varying vec3 vN;
varying vec3 vPos;
varying vec3 vWorldN;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vPos = mv.xyz;
  vN = normalize(normalMatrix * normal);
  vWorldN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * mv;
}`

const liquidFragment = /* glsl */ `
uniform float uTime;
uniform float uEnergy;
varying vec3 vN;
varying vec3 vPos;
varying vec3 vWorldN;
float spec(vec3 N, vec3 V, vec3 L, float p){ return pow(max(dot(N, normalize(L + V)), 0.0), p); }
void main(){
  vec3 N = normalize(vN);
  vec3 V = normalize(-vPos);
  vec3 W = normalize(vWorldN);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 2.0);
  // The spotlight sits straight above: tops catch the light, bellies stay black.
  float top = max(W.y, 0.0);
  float key = (0.08 + 0.3 * top * top) * (0.8 + uEnergy * 0.5);
  vec3 col = vec3(0.015) + vec3(key);
  col += spec(N, V, normalize(vec3(0.0, 1.0, 0.25)), 140.0) * (1.6 + uEnergy);
  col += spec(N, V, normalize(vec3(-0.6, 0.6, 0.5)), 50.0) * 0.35;
  // Faint rim from the light bouncing off the floor pool.
  col += vec3(fres * (0.25 + 0.25 * max(-W.y, 0.0)));
  gl_FragColor = vec4(col, 1.0);
}`

const beamVertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vView;
void main(){
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`

// The cone's surface is brightest where you look through the most "air"
// (facing you) and fades toward the source and the floor, which reads as a
// beam of light in haze.
const beamFragment = /* glsl */ `
uniform float uEnergy;
uniform float uTime;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vView;
void main(){
  float facing = pow(abs(dot(normalize(vN), normalize(vView))), 2.0);
  float along = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.6, vUv.y);
  float flicker = 0.96 + 0.04 * sin(uTime * 7.0) * sin(uTime * 2.3);
  float a = facing * along * (0.11 + uEnergy * 0.09) * flicker;
  gl_FragColor = vec4(vec3(1.0), a);
}`

const poolFragment = /* glsl */ `
uniform float uEnergy;
varying vec2 vUv;
void main(){
  float d = length(vUv - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.0, d);
  a = a * a * (0.32 + uEnergy * 0.2);
  gl_FragColor = vec4(vec3(1.0), a);
}`

const poolVertex = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`

// A liquid "AI" orb under a spotlight: metaballs that keep merging and
// splitting. Hovering wakes it up: the droplets fly further out, move faster,
// and the light brightens.
export function Orb({ hovered }) {
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uEnergy: { value: 0 } }), [])
  const material = useMemo(
    () => new THREE.ShaderMaterial({ uniforms, vertexShader: liquidVertex, fragmentShader: liquidFragment }),
    [uniforms],
  )
  const liquid = useMemo(() => {
    const mc = new MarchingCubes(56, material, false, false, 80000)
    mc.isolation = 70
    mc.scale.setScalar(2.4)
    return mc
  }, [material])
  useEffect(() => () => liquid.geometry.dispose(), [liquid])

  const halo = useMemo(
    () => ({
      uColor: { value: new THREE.Color('#ffffff') },
      uEnergy: { value: 0 },
      uTime: { value: 0 },
    }),
    [],
  )
  const state = useMemo(() => ({ energy: 0, t: 0 }), [])
  const light = useRef()
  const parentTurn = useMemo(() => new THREE.Quaternion(), [])

  useFrame((frame, dt) => {
    state.energy = THREE.MathUtils.lerp(state.energy, hovered ? 1 : 0, 0.05)
    const e = state.energy
    state.t += reduceMotion ? 0 : dt * (0.6 + e * 0.9)
    const t = state.t
    halo.uEnergy.value = e
    halo.uTime.value = frame.clock.elapsedTime
    uniforms.uEnergy.value = e
    uniforms.uTime.value = frame.clock.elapsedTime

    // Field coordinates run 0..1 with the centre at 0.5.
    liquid.reset()
    const breathe = 1 + Math.sin(t * 1.3) * 0.04
    liquid.addBall(0.5, 0.5, 0.5, 0.9 * breathe, 12)
    const reach = 0.19 + e * 0.07
    for (const d of DROPLETS) {
      const a = t * d.s + d.p
      liquid.addBall(
        0.5 + Math.sin(a * d.sx) * (reach + d.r * 0.3),
        0.5 + Math.cos(a * d.sy) * (reach * 0.9),
        0.5 + Math.sin(a * d.sz + 1.3) * (reach * 0.8),
        0.3 + d.r * 0.5,
        12,
      )
    }
    liquid.update()
    liquid.rotation.y += reduceMotion ? 0 : dt * 0.15

    // The orb tilts toward the pointer; undo that for the light so the beam
    // always falls straight down.
    if (light.current?.parent) {
      light.current.parent.getWorldQuaternion(parentTurn)
      light.current.quaternion.copy(parentTurn.invert())
    }
  })

  const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }

  return (
    <group>
      <primitive object={liquid} />
      {/* Spotlight: a hazy cone from above and the pool of light it throws. */}
      <group ref={light}>
        <mesh position={[0, 2.6, 0]}>
          <cylinderGeometry args={[0.12, 2.1, 6.4, 64, 1, true]} />
          <shaderMaterial
            uniforms={uniforms}
            vertexShader={beamVertex}
            fragmentShader={beamFragment}
            side={THREE.DoubleSide}
            {...additive}
          />
        </mesh>
        <mesh position={[0, -2.0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[4.4, 4.4]} />
          <shaderMaterial uniforms={uniforms} vertexShader={poolVertex} fragmentShader={poolFragment} {...additive} />
        </mesh>
      </group>
      <mesh scale={1.7}>
        <sphereGeometry args={[1.2, 48, 48]} />
        <shaderMaterial
          uniforms={halo}
          vertexShader={haloVertex}
          fragmentShader={haloFragment}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  )
}
