/* eslint-disable react-hooks/immutability -- Three.js objects and the 60 fps game state are mutated outside React on purpose (render loop), not during render. */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Flickering engine plume. Its base sits at the origin (the nozzle exit) and it
 * extends along -Y; it tapers like a flame and grows with `intensity`.
 */
export function EnginePlume({
  radius,
  length,
  intensity,
  color = '#ff9a3c',
  light = true,
}: {
  radius: number;
  length: number;
  /** 0 = off, 1 = full thrust. */
  intensity: number;
  color?: THREE.ColorRepresentation;
  light?: boolean;
}) {
  const scaler = useRef<THREE.Group>(null);
  const lamp = useRef<THREE.PointLight>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const f = 1 + Math.sin(t * 47) * 0.06 + Math.sin(t * 31 + 1) * 0.05;
    const k = Math.max(0, Math.min(1.5, intensity));
    if (scaler.current) {
      scaler.current.visible = k > 0.01;
      scaler.current.scale.set(f * (0.6 + 0.4 * k), Math.max(0.001, k * f), f * (0.6 + 0.4 * k));
    }
    if (lamp.current) lamp.current.intensity = k * 4 * f;
  });
  return (
    <group>
      <group ref={scaler}>
        <mesh position={[0, -length / 2, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[radius, length, 24, 1, true]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.45}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
        <mesh position={[0, -length * 0.275, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[radius * 0.5, length * 0.55, 16, 1, true]} />
          <meshBasicMaterial
            color="#fff6e0"
            transparent
            opacity={0.9}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      </group>
      {light && (
        <pointLight
          ref={lamp}
          position={[0, -length * 0.3, 0]}
          color={color}
          distance={length * 6}
          decay={2}
        />
      )}
    </group>
  );
}

const BEAM_VERT = /* glsl */ `
uniform float uLength;
varying float vT;
varying vec3 vN;
varying vec3 vView;
void main() {
  vT = clamp((uLength * 0.5 - position.y) / uLength, 0.0, 1.0);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;
const BEAM_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;
varying float vT;
varying vec3 vN;
varying vec3 vView;
void main() {
  float edge = 1.0 - abs(dot(normalize(vN), normalize(vView)));
  float fade = pow(1.0 - vT, 1.6);
  float scan = 0.75 + 0.25 * sin(vT * 40.0 - uTime * 8.0);
  gl_FragColor = vec4(uColor * uOpacity * fade * scan * (0.35 + edge), 1.0);
}
`;

/** A soft scanning cone of light along +Z that fades with distance. */
export function Beam({
  length,
  radius,
  color = '#5eead4',
  opacity = 0.5,
}: {
  length: number;
  radius: number;
  color?: THREE.ColorRepresentation;
  opacity?: number;
}) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: BEAM_VERT,
        fragmentShader: BEAM_FRAG,
        uniforms: {
          uLength: { value: length },
          uColor: { value: new THREE.Color(color) },
          uOpacity: { value: opacity },
          uTime: { value: 0 },
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [length, color, opacity],
  );
  useFrame((s) => {
    mat.uniforms.uTime!.value = s.clock.elapsedTime;
  });
  return (
    <mesh position={[0, 0, length / 2]} rotation={[-Math.PI / 2, 0, 0]} material={mat}>
      <coneGeometry args={[radius, length, 32, 1, true]} />
    </mesh>
  );
}
