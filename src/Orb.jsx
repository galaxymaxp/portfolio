import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Ashima/stegu 3D simplex noise, used to ripple the orb's surface.
const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`

const vertexShader = /* glsl */ `
uniform float uTime;
uniform float uEnergy;
varying vec3 vNormal;
varying vec3 vView;
varying float vNoise;
${NOISE}
void main(){
  float n = snoise(normal * 1.6 + vec3(uTime * 0.35));
  float fine = snoise(normal * 4.0 - vec3(uTime * 0.6)) * 0.2;
  vNoise = n + fine;
  vec3 pos = position + normal * vNoise * (0.07 + uEnergy * 0.12);
  vec4 world = modelMatrix * vec4(pos, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-(viewMatrix * world).xyz);
  gl_Position = projectionMatrix * viewMatrix * world;
}`

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform float uEnergy;
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uC;
varying vec3 vNormal;
varying vec3 vView;
varying float vNoise;
void main(){
  float fres = pow(1.0 - max(dot(vNormal, vView), 0.0), 2.2);
  // Colours drift across the surface with the noise, like something thinking.
  float t = 0.5 + 0.5 * sin(vNoise * 2.4 + uTime * 0.8);
  vec3 base = mix(uA, uB, t);
  base = mix(base, uC, smoothstep(0.35, 1.0, vNoise) * 0.8);
  vec3 col = base * (0.18 + 0.5 * (1.0 - fres)) + mix(uB, vec3(1.0), 0.35) * fres * (1.4 + uEnergy);
  // Thin bright bands where the surface folds.
  col += uC * smoothstep(0.92, 1.0, sin(vNoise * 9.0 + uTime)) * (0.25 + uEnergy * 0.5);
  gl_FragColor = vec4(col, 1.0);
}`

const haloFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uEnergy;
varying vec3 vNormal;
varying vec3 vView;
void main(){
  // Seen from inside (back faces), so the glow is strongest just around the
  // orb and fades to nothing at the halo's edge.
  float f = pow(abs(dot(vNormal, vView)), 3.0) * (0.55 + uEnergy * 0.45);
  gl_FragColor = vec4(uColor * f, f);
}`

const haloVertex = /* glsl */ `
varying vec3 vNormal;
varying vec3 vView;
void main(){
  vec4 world = modelMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-(viewMatrix * world).xyz);
  gl_Position = projectionMatrix * viewMatrix * world;
}`

// A softly rippling "AI" orb with a fresnel glow, a halo and two orbiting
// rings. Hovering raises its energy: bigger ripples, brighter glow.
export function Orb({ hovered }) {
  const core = useRef()
  const halo = useRef()
  const rings = useRef()
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uEnergy: { value: 0 },
      uA: { value: new THREE.Color('#1b1f6b') },
      uB: { value: new THREE.Color('#7c8cff') },
      uC: { value: new THREE.Color('#5ee7ff') },
    }),
    [],
  )
  const haloUniforms = useMemo(
    () => ({ uColor: { value: new THREE.Color('#7c8cff') }, uEnergy: uniforms.uEnergy }),
    [uniforms],
  )

  useFrame((state, dt) => {
    uniforms.uTime.value = state.clock.elapsedTime
    uniforms.uEnergy.value = THREE.MathUtils.lerp(uniforms.uEnergy.value, hovered ? 1 : 0, 0.06)
    if (rings.current) {
      rings.current.children[0].rotation.z += dt * 0.4
      rings.current.children[1].rotation.z -= dt * 0.25
    }
  })

  return (
    <group>
      <mesh ref={core}>
        <icosahedronGeometry args={[1.2, 48]} />
        <shaderMaterial uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader} />
      </mesh>
      <mesh ref={halo} scale={1.45}>
        <sphereGeometry args={[1.2, 48, 48]} />
        <shaderMaterial
          uniforms={haloUniforms}
          vertexShader={haloVertex}
          fragmentShader={haloFragment}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
        />
      </mesh>
      <group ref={rings}>
        <mesh rotation={[1.2, 0.3, 0]}>
          <torusGeometry args={[1.75, 0.008, 8, 160]} />
          <meshBasicMaterial color="#9aa6ff" transparent opacity={0.7} toneMapped={false} />
        </mesh>
        <mesh rotation={[1.9, -0.5, 0]}>
          <torusGeometry args={[1.95, 0.006, 8, 160]} />
          <meshBasicMaterial color="#5ee7ff" transparent opacity={0.45} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}
