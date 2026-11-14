import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { NOISE_GLSL } from './glsl.ts';

/** Direction to the Sun, shared by every lit object in a scene. */
export const SUN_DIR = new THREE.Vector3(1, 0.25, 0.55).normalize();

const STAR_VERT = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
attribute float aPhase;
uniform float uTime;
uniform float uPixelRatio;
varying vec3 vColor;
varying float vTw;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float tw = 0.78 + 0.22 * sin(uTime * (0.6 + aPhase * 2.5) + aPhase * 40.0);
  vTw = tw;
  vColor = aColor;
  gl_PointSize = aSize * uPixelRatio * (0.9 + 0.2 * tw);
}
`;
const STAR_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vTw;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float core = exp(-d * d * 9.0);
  float halo = exp(-d * d * 2.5) * 0.25;
  gl_FragColor = vec4(vColor * (core + halo) * vTw, 1.0);
}
`;

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const SKY_FRAG = /* glsl */ `
varying vec3 vDir;
${NOISE_GLSL}
void main() {
  vec3 d = normalize(vDir);
  vec3 G = normalize(vec3(0.25, 0.85, 0.45));
  float b = dot(d, G);
  float band = exp(-b * b / 0.018);
  float wide = exp(-b * b / 0.12);
  float core = pow(max(dot(d, normalize(vec3(-0.6, -0.15, 0.78))), 0.0), 6.0);
  float detail = fbm(d * 5.0, 6);
  float dust = smoothstep(0.48, 0.7, fbm(d * 9.0 + 3.0, 6));
  vec3 tint = mix(vec3(0.42, 0.48, 0.75), vec3(0.85, 0.68, 0.5), fbm(d * 2.0 + 7.0, 3) + core);
  vec3 col = tint * (band * (0.35 + 0.9 * detail) + wide * 0.15 + core * band * 1.4) * (1.0 - 0.75 * dust * band);
  col += vec3(0.55, 0.16, 0.38) * pow(fbm(d * 3.0 + 9.0, 5), 5.0) * 0.6;
  col += vec3(0.1, 0.25, 0.5) * pow(fbm(d * 2.5 + 2.0, 5), 5.0) * 0.6;
  gl_FragColor = vec4(col * 0.055, 1.0);
}
`;

function makeGlowTexture(inner: string, outer: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, inner);
  grd.addColorStop(0.12, inner);
  grd.addColorStop(0.3, outer);
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let glowCache: { sun: THREE.CanvasTexture; soft: THREE.CanvasTexture } | null = null;
export function glowTextures() {
  glowCache ??= {
    sun: makeGlowTexture('rgba(255,255,250,1)', 'rgba(255,200,140,0.35)'),
    soft: makeGlowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0.15)'),
  };
  return glowCache;
}

/**
 * Stars, Milky Way and the Sun on a sky shell that follows the camera, so it
 * behaves like an infinitely distant background. Planets occlude the Sun.
 */
export function SpaceBackdrop({ starCount = 9000 }: { starCount?: number }) {
  const group = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);
  const dpr = useThree((s) => s.viewport.dpr);

  const stars = useMemo(() => {
    const R = 900;
    const pos = new Float32Array(starCount * 3);
    const col = new Float32Array(starCount * 3);
    const size = new Float32Array(starCount);
    const phase = new Float32Array(starCount);
    const G = new THREE.Vector3(0.25, 0.85, 0.45).normalize();
    const v = new THREE.Vector3();
    const palette = [
      new THREE.Color('#9db4ff'),
      new THREE.Color('#cad7ff'),
      new THREE.Color('#f8f7ff'),
      new THREE.Color('#fff4e8'),
      new THREE.Color('#ffd2a1'),
      new THREE.Color('#ffb56c'),
    ];
    for (let i = 0; i < starCount; i++) {
      // About 45% of stars crowd towards the galactic plane, like the real sky.
      for (;;) {
        v.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
        const l = v.length();
        if (l > 0.1 && l <= 1) break;
      }
      v.normalize();
      if (i % 20 < 9) {
        v.addScaledVector(G, -v.dot(G) * (0.85 + Math.random() * 0.15)).normalize();
      }
      pos.set([v.x * R, v.y * R, v.z * R], i * 3);
      const bright = Math.pow(Math.random(), 9);
      const c = palette[Math.floor(Math.random() * palette.length)]!;
      const k = 0.35 + bright * 2.2;
      col.set([c.r * k, c.g * k, c.b * k], i * 3);
      size[i] = 1.4 + bright * 5.5;
      phase[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: dpr } },
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    return { geo, mat };
  }, [starCount, dpr]);

  const sky = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    [],
  );

  useEffect(
    () => () => {
      stars.geo.dispose();
      stars.mat.dispose();
      sky.dispose();
    },
    [stars, sky],
  );

  useFrame((state) => {
    group.current?.position.copy(camera.position);
    stars.mat.uniforms.uTime!.value = state.clock.elapsedTime;
  });

  const { sun, soft } = glowTextures();
  const sunPos = SUN_DIR.clone().multiplyScalar(800);
  return (
    <group ref={group}>
      <mesh material={sky} renderOrder={-2}>
        <sphereGeometry args={[950, 64, 32]} />
      </mesh>
      <points geometry={stars.geo} material={stars.mat} renderOrder={-1} />
      <sprite position={sunPos} scale={[70, 70, 1]}>
        <spriteMaterial
          map={sun}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>
      <sprite position={sunPos} scale={[420, 420, 1]}>
        <spriteMaterial
          map={soft}
          color="#ffcf9a"
          opacity={0.22}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>
    </group>
  );
}
