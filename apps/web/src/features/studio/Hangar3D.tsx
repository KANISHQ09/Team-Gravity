/* eslint-disable react-hooks/immutability -- Three.js objects and the 60 fps game state are mutated outside React on purpose (render loop), not during render. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Grid, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Body } from '@gravity/shared';
import type { CraftLayout } from '../../components/space3d/craftLayout.ts';
import { makeSpaceEnvironment } from '../../components/space3d/materials.ts';
import { Planet } from '../../components/space3d/Planet.tsx';
import { Spacecraft } from '../../components/space3d/Spacecraft.tsx';
import { SUN_DIR, SpaceBackdrop } from '../../components/space3d/SpaceBackdrop.tsx';

export type CameraPreset = 'iso' | 'front' | 'side' | 'top';
const PRESETS: Record<CameraPreset, [number, number, number]> = {
  iso: [2.5, 1.5, 2.9],
  front: [0, 0.35, 3.8],
  side: [3.8, 0.35, 0],
  top: [0, 4, 0.01],
};

export interface Hangar3DProps {
  layout: CraftLayout;
  body: Body;
  camera: { preset: CameraPreset; nonce: number };
  xray: boolean;
  autoRotate: boolean;
  /** performance.now() when a deployment test started, or null. */
  testStart: number | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

function Environment() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const rt = makeSpaceEnvironment(gl, SUN_DIR);
    scene.environment = rt.texture;
    return () => {
      scene.environment = null;
      rt.dispose();
    };
  }, [gl, scene]);
  return null;
}

function CameraRig({ preset, nonce }: { preset: CameraPreset; nonce: number }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const goal = useRef<THREE.Vector3 | null>(null);
  useEffect(() => {
    goal.current = new THREE.Vector3(...PRESETS[preset]);
  }, [preset, nonce]);
  useEffect(() => {
    if (!controls) return;
    const stop = () => (goal.current = null);
    controls.addEventListener('start', stop);
    return () => controls.removeEventListener('start', stop);
  }, [controls]);
  useFrame((_, dt) => {
    if (!goal.current) return;
    const k = 1 - Math.exp(-dt * 5);
    camera.position.lerp(goal.current, k);
    controls?.target.lerp(new THREE.Vector3(0, 0, 0), k);
    controls?.update();
    if (camera.position.distanceTo(goal.current) < 0.01) goal.current = null;
  });
  return null;
}

function HoloRing() {
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame((s) => {
    if (mat.current) mat.current.opacity = 0.25 + Math.sin(s.clock.elapsedTime * 2) * 0.12;
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.29, 0]}>
      <ringGeometry args={[1.55, 1.585, 96]} />
      <meshBasicMaterial
        ref={mat}
        color="#22d3ee"
        transparent
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );
}

/** Scales the craft so it always fills the hangar, easing between sizes. */
function FitCraft({
  radius,
  drift,
  children,
}: {
  radius: number;
  drift: boolean;
  children: React.ReactNode;
}) {
  const g = useRef<THREE.Group>(null);
  useFrame((s, dt) => {
    if (!g.current) return;
    const target = 1 / Math.max(0.05, radius);
    const cur = g.current.scale.x;
    g.current.scale.setScalar(cur + (target - cur) * (1 - Math.exp(-dt * 4)));
    const t = s.clock.elapsedTime;
    g.current.position.y = drift ? Math.sin(t * 1.4) * 0.05 : 0;
    g.current.rotation.z = drift ? Math.sin(t * 0.9) * 0.04 : 0;
  });
  return (
    <group ref={g} scale={1 / Math.max(0.05, radius)}>
      {children}
    </group>
  );
}

/** Drives the deployment-test animation: stow, unfold, spin up, hot-fire. */
function useTestTimeline(testStart: number | null) {
  const [t, setT] = useState<number | null>(null);
  useFrame(() => {
    if (testStart === null) {
      if (t !== null) setT(null);
      return;
    }
    const e = (performance.now() - testStart) / 1000;
    const next = e > 7 ? null : Math.round(e * 30) / 30;
    if (next !== t) setT(next);
  });
  if (t === null) return { deploy: 1, burn: 0, spin: false, scan: false, testing: false };
  const deploy = t < 1 ? 1 - t : t < 1.4 ? 0 : Math.min(1, (t - 1.4) / 2.2);
  const burn = t > 3.8 && t < 6 ? Math.min(1, (t - 3.8) * 3, (6 - t) * 3) : 0;
  return { deploy, burn, spin: t > 2.2, scan: t > 3.6 && t < 6.8, testing: true };
}

function Scene(props: Hangar3DProps) {
  const test = useTestTimeline(props.testStart);
  return (
    <>
      <Environment />
      <SpaceBackdrop starCount={6000} />
      <ambientLight intensity={0.06} />
      <hemisphereLight args={['#1b2a4a', '#000000', 0.5]} />
      <directionalLight
        position={SUN_DIR.clone().multiplyScalar(10)}
        intensity={3.2}
        color="#fff3e2"
      />
      <directionalLight position={[-4, -2, -3]} intensity={0.9} color="#22d3ee" />
      <Planet body={props.body} radius={16} sunDir={SUN_DIR} position={[-34, 4, -70]} spin={0.01} />
      {!test.testing && (
        <>
          <Grid
            position={[0, -1.3, 0]}
            args={[10, 10]}
            cellSize={0.25}
            cellThickness={0.6}
            cellColor="#0e4a5c"
            sectionSize={1}
            sectionThickness={1.1}
            sectionColor="#22d3ee"
            fadeDistance={7}
            fadeStrength={2.5}
            infiniteGrid
          />
          <HoloRing />
        </>
      )}
      <FitCraft radius={props.layout.radius} drift={test.testing}>
        <Spacecraft
          layout={props.layout}
          deploy={test.deploy}
          burn={test.burn}
          xray={props.xray}
          scan={test.scan}
          spinWheels={test.spin || props.xray}
          popIn
          selectedId={props.selectedId}
          onSelect={props.onSelect}
        />
      </FitCraft>
      <CameraRig preset={props.camera.preset} nonce={props.camera.nonce} />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        minDistance={1.6}
        maxDistance={7}
        autoRotate={props.autoRotate && !test.testing}
        autoRotateSpeed={0.7}
      />
    </>
  );
}

/** The 3D hangar canvas (lazy-loaded so the rest of the game stays light). */
export default function Hangar3D(props: Hangar3DProps) {
  const initial = useMemo(() => PRESETS.iso, []);
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: initial, fov: 40, near: 0.01, far: 3000 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onPointerMissed={() => props.onSelect(null)}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 1.1;
      }}
    >
      <Scene {...props} />
    </Canvas>
  );
}
