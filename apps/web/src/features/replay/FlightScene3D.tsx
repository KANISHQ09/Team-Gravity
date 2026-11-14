/* eslint-disable react-hooks/immutability -- Three.js objects and the 60 fps game state are mutated outside React on purpose (render loop), not during render. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { catalog } from '@gravity/engine';
import type { Body, Part } from '@gravity/shared';
import { layoutCraft } from '../../components/space3d/craftLayout.ts';
import { EnginePlume } from '../../components/space3d/effects.tsx';
import { makeSpaceEnvironment, craftMaterials } from '../../components/space3d/materials.ts';
import { Planet } from '../../components/space3d/Planet.tsx';
import { Spacecraft } from '../../components/space3d/Spacecraft.tsx';
import { SUN_DIR, SpaceBackdrop, glowTextures } from '../../components/space3d/SpaceBackdrop.tsx';
import { type FlightSim, gameDone, stepGame } from '../pilot/flightSim.ts';
import {
  type InsertionState,
  insertionStart,
  insertionStep,
  predictPath,
} from '../pilot/insertionGame.ts';
import { CAPTURE_TARGET, earthOrbitRatio, visAlt } from './flightGeometry.ts';
import { type FlightTimeline, LAUNCH_FAILURE_DAY, shotAt } from './flightTimeline.ts';

/** World layout (schematic distances; sizes are not to scale with distances). */
export const EARTH_R = 10;
const TARGET: Record<Exclude<Body, 'earth'>, { pos: THREE.Vector3; r: number }> = {
  moon: { pos: new THREE.Vector3(160, 12, -70), r: 2.7 },
  mars: { pos: new THREE.Vector3(230, -20, -110), r: 5.3 },
};
const CRAFT_SIZE = 0.1;
const LAUNCH_ANGLE = 0.2;

function inclinationFor(orbitId: string): number {
  if (/sso|polar/.test(orbitId)) return 95;
  if (/iss/.test(orbitId)) return 51.6;
  if (/geo/.test(orbitId)) return 0;
  return 28;
}

interface Basis {
  c: THREE.Vector3;
  u: THREE.Vector3;
  v: THREE.Vector3;
  n: THREE.Vector3;
}
function makeBasis(center: THREE.Vector3, incDeg: number, along: THREE.Vector3): Basis {
  const u = along.clone().normalize();
  const n0 = new THREE.Vector3(0, 1, 0);
  const i = (incDeg * Math.PI) / 180;
  const n = n0
    .clone()
    .multiplyScalar(Math.cos(i))
    .addScaledVector(new THREE.Vector3().crossVectors(u, n0), Math.sin(i))
    .normalize();
  const v = new THREE.Vector3().crossVectors(n, u).normalize();
  return { c: center.clone(), u, v, n };
}
const onOrbit = (b: Basis, a: number, r: number, out = new THREE.Vector3()) =>
  out
    .copy(b.c)
    .addScaledVector(b.u, Math.cos(a) * r)
    .addScaledVector(b.v, Math.sin(a) * r);
const tangent = (b: Basis, a: number, out = new THREE.Vector3()) =>
  out.set(0, 0, 0).addScaledVector(b.u, -Math.sin(a)).addScaledVector(b.v, Math.cos(a));

export interface FlightScene3DProps {
  sim: FlightSim;
  day: number;
  timeline: FlightTimeline;
  partIds: readonly string[];
  orbitId: string;
  orbitAltKm: number;
  /** Called once when the active mini-game reports done. */
  onGameDone: () => void;
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

function Rocket({ throttle }: { throttle: number }) {
  const m = craftMaterials();
  return (
    <group>
      <mesh material={m.white} position={[0, 0.09, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 0.18, 16]} />
      </mesh>
      <mesh material={m.dark} position={[0, 0.19, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 0.02, 16]} />
      </mesh>
      <mesh material={m.white} position={[0, 0.24, 0]}>
        <cylinderGeometry args={[0.016, 0.018, 0.08, 16]} />
      </mesh>
      <mesh material={m.white} position={[0, 0.31, 0]}>
        <coneGeometry args={[0.016, 0.06, 16]} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          material={m.dark}
          position={[Math.cos((i * Math.PI) / 2) * 0.02, 0.012, Math.sin((i * Math.PI) / 2) * 0.02]}
          rotation={[0, (-i * Math.PI) / 2, 0]}
        >
          <boxGeometry args={[0.012, 0.03, 0.002]} />
        </mesh>
      ))}
      <EnginePlume radius={0.028} length={0.32} intensity={throttle} />
    </group>
  );
}

/** All moving parts of the flight, driven per frame from the sim and the clock. */
function FlightWorld(props: FlightScene3DProps) {
  const { sim, timeline } = props;
  const camera = useThree((s) => s.camera);
  const target = timeline.target === 'earth' ? null : TARGET[timeline.target];
  const parts = useMemo(
    () =>
      props.partIds
        .map((id) => catalog.parts.find((p) => p.id === id))
        .filter((p): p is Part => !!p),
    [props.partIds],
  );
  const layout = useMemo(() => layoutCraft(parts), [parts]);
  const craftScale = CRAFT_SIZE / Math.max(0.05, layout.radius);

  const earthOrbitR = EARTH_R * (1 + visAlt(timeline.target === 'earth' ? props.orbitAltKm : 200));
  const earthBasis = useMemo(
    () =>
      makeBasis(
        new THREE.Vector3(0, 0, 0),
        timeline.target === 'earth' ? inclinationFor(props.orbitId) : 28,
        new THREE.Vector3(0.6, 0, 0.8),
      ),
    [timeline.target, props.orbitId],
  );
  const targetBasis = useMemo(
    () =>
      target
        ? makeBasis(target.pos, /polar/.test(props.orbitId) ? 80 : 20, new THREE.Vector3(1, 0, 0.3))
        : null,
    [target, props.orbitId],
  );
  const captureStart = useMemo(() => insertionStart('capture', CAPTURE_TARGET), []);
  const circStart = useMemo(
    () => insertionStart('circularize', earthOrbitRatio(props.orbitAltKm)),
    [props.orbitAltKm],
  );

  // Mutable scene state.
  const st = useRef({
    day: props.day,
    snap: true,
    camPos: new THREE.Vector3(),
    camLook: new THREE.Vector3(),
    craftAngle: LAUNCH_ANGLE,
    craftR: earthOrbitR,
    aroundTarget: false,
    transfer: null as null | {
      p0: THREE.Vector3;
      p1: THREE.Vector3;
      p2: THREE.Vector3;
      p3: THREE.Vector3;
    },
    flyby: null as InsertionState | null,
    tumble: 0,
    explodeT: -1,
    lastCraftPos: new THREE.Vector3(),
    sciBase: null as number | null,
  });

  const rocket = useRef<THREE.Group>(null);
  const craft = useRef<THREE.Group>(null);
  const trailGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(600 * 3), 3));
    g.setDrawRange(0, 0);
    return g;
  }, []);
  const size = useThree((st2) => st2.size);
  const lines = useMemo(() => {
    const fat = (color: string, width: number, opacity = 1) => {
      const m = new LineMaterial({
        color,
        linewidth: width,
        transparent: true,
        opacity,
        toneMapped: false,
        worldUnits: false,
      });
      const l = new Line2(new LineGeometry(), m);
      l.frustumCulled = false;
      l.visible = false;
      return l;
    };
    const path = fat('#22d3ee', 3);
    const arc = fat('#7dd3fc', 2, 0.6);
    const ring = fat('#34d399', 2, 0.7);
    const circle: number[] = [];
    for (let i = 0; i <= 128; i++)
      circle.push(Math.cos((i / 128) * Math.PI * 2), Math.sin((i / 128) * Math.PI * 2), 0);
    ring.geometry.setPositions(circle);
    return { path, arc, ring };
  }, []);
  useEffect(() => {
    for (const l of Object.values(lines)) l.material.resolution.set(size.width, size.height);
  }, [lines, size]);
  const ringRef = useRef<Line2>(lines.ring);
  const explosion = useRef<THREE.Mesh>(null);
  const marker = useRef<THREE.Sprite>(null);
  const reticle = useRef<THREE.Sprite>(null);
  const beam = useRef<THREE.Mesh>(null);
  const targetSprites = useRef<(THREE.Sprite | null)[]>([]);
  const stationSprites = useRef<(THREE.Sprite | null)[]>([]);
  const shield = useRef<THREE.Mesh>(null);
  const alarm = useRef<THREE.PointLight>(null);
  const storm = useRef<THREE.Points>(null);
  const [anim, setAnim] = useState({
    deploy: 0,
    burn: 0,
    scan: false,
    throttle: 1,
    showCraft: false,
    dead: false,
  });
  const animRef = useRef(anim);

  const statusMats = useMemo(() => {
    const { soft } = glowTextures();
    const mk = (c: string, o = 1) =>
      new THREE.SpriteMaterial({
        map: soft,
        color: c,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: o,
        toneMapped: false,
      });
    return {
      waiting: mk('#fbbf24'),
      captured: mk('#34d399'),
      missed: mk('#64748b', 0.5),
      lost: mk('#f43f5e'),
      reticle: mk('#22d3ee'),
      station: mk('#e2e8f0', 0.8),
      marker: mk('#ffffff'),
    };
  }, []);
  const stormGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const n = 400;
    const a = new Float32Array(n * 3);
    // Deterministic scatter (no Math.random during render).
    const h = (k: number) => (Math.sin(k * 12.9898) * 43758.5453) % 1;
    for (let i = 0; i < n; i++)
      a.set(
        [Math.abs(h(i)) * 0.6 - 0.3, Math.abs(h(i + 0.5)) * 0.6 - 0.3, Math.abs(h(i + 0.25))],
        i * 3,
      );
    g.setAttribute('position', new THREE.BufferAttribute(a, 3));
    return g;
  }, []);

  useEffect(
    () => () => {
      trailGeo.dispose();
      stormGeo.dispose();
      Object.values(statusMats).forEach((m) => m.dispose());
      for (const l of Object.values(lines)) {
        l.geometry.dispose();
        l.material.dispose();
      }
    },
    [trailGeo, stormGeo, statusMats, lines],
  );

  const tmp = useMemo(
    () => ({
      a: new THREE.Vector3(),
      b: new THREE.Vector3(),
      c: new THREE.Vector3(),
      d: new THREE.Vector3(),
      q: new THREE.Quaternion(),
      up: new THREE.Vector3(0, 1, 0),
    }),
    [],
  );

  const launchPos = (alt: number, down: number, out: THREE.Vector3) => {
    const a = LAUNCH_ANGLE + (down / 700) * 0.45;
    const r = EARTH_R + 0.015 + (alt / 180) * (earthOrbitR - EARTH_R);
    return onOrbit(earthBasis, a, r, out);
  };

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const S = st.current;
    // Smooth the 10 Hz mission clock into continuous motion.
    const jump = Math.abs(props.day - S.day) > 20;
    S.day = jump ? props.day : S.day + (props.day - S.day) * (1 - Math.exp(-dt * 8));
    const day = S.day;
    const shot = shotAt(day, timeline).shot;
    const g = sim.game;

    if (g && g.started && !g.finished) {
      stepGame(g, sim.keys, dt * (g.auto ? 1.6 : 1));
      if (gameDone(g)) {
        g.finished = true;
        props.onGameDone();
      }
    }

    const camGoal = tmp.a.set(0, 0, 0);
    const lookGoal = tmp.b.set(0, 0, 0);
    // Screen "up" follows the local vertical so horizons look level.
    const upGoal = new THREE.Vector3(0, 1, 0);
    let craftVisible = false;
    let rocketVisible = false;
    let deploy = 1;
    let burn = 0;
    let scan = false;
    let throttle = 0;
    let pathCount = 0;
    let arcCount = 0;
    let markerOn = false;
    const craftPos = tmp.c;
    const craftQ = tmp.q.identity();

    const launchFailed = timeline.failurePhase === 'launch' && day >= LAUNCH_FAILURE_DAY;
    // ---------- Launch (mini-game or the moment before/after it) ----------
    if (g?.type === 'launch' || shot === 'prelaunch' || shot === 'ascent' || launchFailed) {
      const ls = g?.type === 'launch' ? g.s : null;
      const alt = ls ? ls.alt : (sim.launchEnd?.alt ?? 0);
      const down = ls ? ls.down : (sim.launchEnd?.down ?? 0);
      const pitch = ls ? ls.pitch : 90;
      throttle = ls ? (g?.started ? ls.throttle : 0) : 0;
      const pos = launchPos(alt, down, tmp.d);
      const a = LAUNCH_ANGLE + (down / 700) * 0.45;
      const rHat = craftPos.copy(pos).sub(earthBasis.c).normalize();
      const tHat = tangent(earthBasis, a, new THREE.Vector3());
      const dir = new THREE.Vector3()
        .addScaledVector(rHat, Math.sin((pitch * Math.PI) / 180))
        .addScaledVector(tHat, Math.cos((pitch * Math.PI) / 180))
        .normalize();
      if (rocket.current) {
        rocket.current.position.copy(pos);
        rocket.current.quaternion.setFromUnitVectors(tmp.up, dir);
      }
      rocketVisible = !launchFailed;
      if (ls && g?.started && throttle > 0) {
        const last = sim.trail[sim.trail.length - 1];
        if (!last || Math.hypot(last[0] - pos.x, last[1] - pos.y, last[2] - pos.z) > 0.01) {
          sim.trail.push([pos.x, pos.y, pos.z]);
          if (sim.trail.length > 600) sim.trail.shift();
        }
      }
      upGoal.copy(rHat);
      const pull = 1 + alt / 60;
      camGoal
        .copy(pos)
        .addScaledVector(tHat, -0.55 * pull)
        .addScaledVector(earthBasis.n, 0.45 * pull)
        .addScaledVector(rHat, 0.12 * pull);
      lookGoal.copy(pos).addScaledVector(tHat, 0.15 * pull);
      if (launchFailed) {
        if (S.explodeT < 0) S.explodeT = state.clock.elapsedTime;
        if (explosion.current) {
          const e = state.clock.elapsedTime - S.explodeT;
          explosion.current.visible = e < 4;
          explosion.current.position.copy(pos);
          explosion.current.scale.setScalar(0.05 + e * 0.35);
          (explosion.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - e / 4);
        }
      }
      craftPos.copy(pos);
    } else if (
      g?.type === 'insertion' ||
      (shot === 'ended' && timeline.failurePhase === 'insertion')
    ) {
      // ---------- Insertion burn (or the fly-by when it failed) ----------
      let s: InsertionState;
      if (g?.type === 'insertion') s = g.s;
      else {
        S.flyby ??= captureStart;
        S.flyby = insertionStep(S.flyby, false, dt);
        s = S.flyby;
      }
      const capture = s.kind === 'capture';
      const b = capture && targetBasis ? targetBasis : earthBasis;
      const R = capture && target ? target.r : EARTH_R;
      const rot = capture ? 0 : LAUNCH_ANGLE + 0.45 - Math.atan2(circStart.y, circStart.x);
      const toWorld = (x: number, y: number, out: THREE.Vector3) => {
        const ang = Math.atan2(y, x) + rot;
        return onOrbit(b, ang, Math.hypot(x, y) * R, out);
      };
      toWorld(s.x, s.y, craftPos);
      craftVisible = true;
      burn = g?.type === 'insertion' && s.burning ? 1 : 0;
      const vel = toWorld(s.x + s.vx * 0.01, s.y + s.vy * 0.01, new THREE.Vector3())
        .sub(craftPos)
        .normalize();
      craftQ.setFromUnitVectors(tmp.up, capture ? vel.clone().negate() : vel);
      const path = predictPath(s);
      const flat: number[] = [];
      for (const [x, y] of path) {
        const p = toWorld(x, y, tmp.d);
        flat.push(p.x, p.y, p.z);
      }
      pathCount = path.length;
      if (pathCount > 1) {
        lines.path.geometry.dispose();
        lines.path.geometry = new LineGeometry();
        lines.path.geometry.setPositions(flat);
      }
      const bound = (s.vx * s.vx + s.vy * s.vy) / 2 - 1 / Math.hypot(s.x, s.y) < 0;
      lines.path.material.color.set(bound ? '#22d3ee' : '#fb923c');
      if (ringRef.current) {
        ringRef.current.visible = true;
        ringRef.current.position.copy(b.c);
        ringRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), b.n);
        ringRef.current.scale.setScalar(s.target * R);
      }
      // Frame both the planet and the spacecraft from above the orbit plane.
      const mid = new THREE.Vector3().copy(b.c).lerp(craftPos, 0.5);
      const span = Math.max(R * 4, b.c.distanceTo(craftPos) * 1.15);
      camGoal
        .copy(mid)
        .addScaledVector(b.n, span)
        .addScaledVector(b.v, -span * 0.45);
      lookGoal.copy(mid);
      upGoal.copy(b.v);
      S.aroundTarget = capture;
      S.craftAngle = Math.atan2(s.y, s.x) + rot;
      S.craftR = capture && target ? target.r * CAPTURE_TARGET : earthOrbitR;
    } else if (shot === 'transfer' && target && targetBasis) {
      // ---------- Cruise ----------
      if (!S.transfer) {
        const p0 = onOrbit(earthBasis, S.craftAngle, earthOrbitR, new THREE.Vector3());
        const t0 = tangent(earthBasis, S.craftAngle, new THREE.Vector3());
        const p3 = new THREE.Vector3()
          .copy(targetBasis.c)
          .addScaledVector(targetBasis.u, captureStart.x * target.r)
          .addScaledVector(targetBasis.v, captureStart.y * target.r);
        const D = p0.distanceTo(p3);
        S.transfer = {
          p0,
          p1: p0.clone().addScaledVector(t0, D * 0.4),
          p2: p3.clone().addScaledVector(targetBasis.u, -D * 0.35),
          p3,
        };
        const curve = new THREE.CubicBezierCurve3(
          S.transfer.p0,
          S.transfer.p1,
          S.transfer.p2,
          S.transfer.p3,
        );
        lines.arc.geometry.setPositions(curve.getPoints(120).flatMap((p) => [p.x, p.y, p.z]));
      }
      arcCount = 121;
      const T = S.transfer;
      const p = Math.max(0, Math.min(1, (day - 1) / Math.max(0.1, timeline.transfer - 2)));
      const e = p * p * (3 - 2 * p);
      new THREE.CubicBezierCurve3(T.p0, T.p1, T.p2, T.p3).getPoint(e, craftPos);
      craftVisible = true;
      markerOn = true;
      const mid = new THREE.Vector3().addVectors(T.p0, T.p3).multiplyScalar(0.5);
      const far = 6 + 70 * Math.sin(Math.PI * e);
      camGoal
        .copy(craftPos)
        .addScaledVector(earthBasis.n, far * 0.7)
        .addScaledVector(new THREE.Vector3().subVectors(T.p3, T.p0).normalize(), -far * 0.6);
      lookGoal.copy(craftPos).lerp(mid, Math.sin(Math.PI * e) * 0.6);
      upGoal.copy(earthBasis.n);
    } else {
      // ---------- In orbit: separation, parking, science, anomalies, end ----------
      // After the cruise the spacecraft is around the target body (derived from the clock, so it survives remounts).
      const around =
        !!target && !!targetBasis && timeline.transfer > 0 && day >= timeline.transfer - 0.5;
      S.craftR = around ? target.r * CAPTURE_TARGET : earthOrbitR;
      const b = around ? targetBasis! : earthBasis;
      const R = around ? target!.r : EARTH_R;
      const sep = shot === 'separation';
      if (sep && sim.launchEnd) {
        const a0 = LAUNCH_ANGLE + (sim.launchEnd.down / 700) * 0.45;
        if (S.craftAngle < a0) S.craftAngle = a0;
      }
      const sg = g?.type === 'science' ? g.s : null;
      const omega = (2 * Math.PI) / (around ? 32 : 40);
      if (!sg) {
        S.craftAngle += omega * dt;
        S.sciBase = null;
      } else if (S.sciBase === null) {
        // Start the science pass just before the point under the Sun, so the targets are in daylight.
        const sunA = Math.atan2(SUN_DIR.dot(b.v), SUN_DIR.dot(b.u));
        S.sciBase = sunA - 0.9;
      }
      const scienceBase = S.sciBase ?? S.craftAngle;
      const angle = sg ? scienceBase + sg.track * 0.5 : S.craftAngle;
      if (sg) S.craftAngle = angle;
      const r = sep
        ? THREE.MathUtils.lerp(earthOrbitR * 0.995, earthOrbitR, Math.min(1, (day + 0.4) / 0.6))
        : S.craftR;
      onOrbit(b, angle, r, craftPos);
      craftVisible = !launchFailed;
      deploy = sep ? Math.max(0, Math.min(1, (day - 0.05) / 0.5)) : 1;
      const rHat = new THREE.Vector3().subVectors(craftPos, b.c).normalize();
      const tHat = tangent(b, angle, new THREE.Vector3());
      upGoal.copy(rHat);
      // Instruments (+Z) face the ground, top deck (+Y) faces along the orbit.
      const m = new THREE.Matrix4().makeBasis(
        new THREE.Vector3().crossVectors(tHat, rHat.clone().negate()),
        tHat,
        rHat.clone().negate(),
      );
      craftQ.setFromRotationMatrix(m);
      const ended = shot === 'ended';
      const dead = ended && timeline.outcome === 'failure';
      if (dead) {
        S.tumble += dt;
        craftQ.multiply(
          new THREE.Quaternion().setFromEuler(
            new THREE.Euler(S.tumble * 0.7, S.tumble * 0.4, S.tumble * 0.2),
          ),
        );
      }
      scan = (shot === 'science' || !!sg) && !dead;
      // Rocket upper stage drifting away after separation.
      if (sep && sim.launchEnd && rocket.current) {
        rocketVisible = true;
        const lp = launchPos(sim.launchEnd.alt, sim.launchEnd.down, tmp.d);
        rocket.current.position.copy(lp).addScaledVector(rHat, -0.05 * Math.max(0, day + 0.4));
        throttle = 0;
      }
      if (sg) {
        // Science targets, reticle, stations, beam.
        const surf = (along: number, cross: number, out: THREE.Vector3) => {
          const a2 = scienceBase + along * 0.5;
          out
            .set(0, 0, 0)
            .addScaledVector(b.u, Math.cos(a2))
            .addScaledVector(b.v, Math.sin(a2))
            .addScaledVector(b.n, cross * 0.12)
            .normalize();
          return out.multiplyScalar(R * 1.004).add(b.c);
        };
        sg.targets.forEach((t, i) => {
          const sp = targetSprites.current[i];
          if (!sp) return;
          sp.visible = true;
          surf(t.along, t.cross, sp.position);
          sp.material = statusMats[t.status];
          const pulse =
            t.status === 'waiting' ? 1 + Math.sin(state.clock.elapsedTime * 6 + i) * 0.2 : 1;
          sp.scale.setScalar(R * 0.06 * pulse);
        });
        if (reticle.current) {
          reticle.current.visible = true;
          surf(sg.track, sg.pointer, reticle.current.position);
          reticle.current.scale.setScalar(R * 0.08);
        }
        if (beam.current && reticle.current) {
          beam.current.visible = true;
          const from = craftPos;
          const to = reticle.current.position;
          beam.current.position.copy(from).add(to).multiplyScalar(0.5);
          beam.current.scale.set(1, from.distanceTo(to), 1);
          beam.current.quaternion.setFromUnitVectors(
            tmp.up,
            new THREE.Vector3().subVectors(to, from).normalize(),
          );
        }
        if (timeline.target === 'earth') {
          sg.stations.forEach((w, i) => {
            const sp = stationSprites.current[i];
            if (!sp) return;
            sp.visible = true;
            surf((w.from + w.to) / 2, 0.55, sp.position);
            sp.scale.setScalar(R * (sg.downlinking ? 0.09 : 0.05));
          });
        }
        const ahead = surf(sg.track + 0.35, 0, new THREE.Vector3());
        camGoal
          .copy(craftPos)
          .addScaledVector(rHat, R * 0.16)
          .addScaledVector(tHat, -R * 0.24)
          .addScaledVector(b.n, R * 0.05);
        lookGoal.copy(ahead);
      } else if (g?.type === 'anomaly') {
        const as = g.s;
        if (as.kind === 'stabilize') {
          craftQ.multiply(
            new THREE.Quaternion().setFromEuler(new THREE.Euler(as.ey * 0.9, 0, -as.ex * 0.9)),
          );
        }
        const cam = new THREE.Vector3().copy(SUN_DIR).cross(rHat).normalize();
        camGoal
          .copy(craftPos)
          .addScaledVector(cam, 0.32)
          .addScaledVector(rHat, 0.12)
          .addScaledVector(tHat, -0.12);
        lookGoal.copy(craftPos);
      } else {
        // Cinematic: cycle chase, close orbit and wide shots every ~9 s.
        const cycle = Math.floor(state.clock.elapsedTime / 9) % 3;
        if (sep || cycle === 0) {
          camGoal
            .copy(craftPos)
            .addScaledVector(tHat, -0.35)
            .addScaledVector(rHat, 0.12)
            .addScaledVector(b.n, 0.08);
          lookGoal.copy(craftPos).addScaledVector(rHat, -0.05);
        } else if (cycle === 1) {
          const t = state.clock.elapsedTime * 0.25;
          camGoal
            .copy(craftPos)
            .addScaledVector(tHat, Math.cos(t) * 0.3)
            .addScaledVector(b.n, Math.sin(t) * 0.3)
            .addScaledVector(rHat, 0.08);
          lookGoal.copy(craftPos);
        } else {
          camGoal
            .copy(b.c)
            .addScaledVector(rHat, R * 2.6)
            .addScaledVector(b.n, R * 1.2)
            .addScaledVector(tHat, -R * 1.2);
          lookGoal.copy(b.c).lerp(craftPos, 0.5);
          markerOn = true;
        }
      }
    }

    // ---------- Apply ----------
    if (rocket.current) rocket.current.visible = rocketVisible;
    if (craft.current) {
      craft.current.visible = craftVisible;
      craft.current.position.copy(craftPos);
      craft.current.quaternion.copy(craftQ);
    }
    S.lastCraftPos.copy(craftPos);
    if (marker.current) {
      marker.current.visible = markerOn && craftVisible;
      marker.current.position.copy(craftPos);
    }
    const tArr = trailGeo.getAttribute('position') as THREE.BufferAttribute;
    sim.trail.forEach((p, i) => tArr.setXYZ(i, p[0], p[1], p[2]));
    tArr.needsUpdate = true;
    trailGeo.setDrawRange(0, rocketVisible || g?.type === 'launch' ? sim.trail.length : 0);
    lines.path.visible = pathCount > 1;
    lines.arc.visible = arcCount > 0;
    if (ringRef.current && pathCount === 0) ringRef.current.visible = false;
    if (!g || g.type !== 'science') {
      targetSprites.current.forEach((s) => s && (s.visible = false));
      stationSprites.current.forEach((s) => s && (s.visible = false));
      if (reticle.current) reticle.current.visible = false;
      if (beam.current) beam.current.visible = false;
    }
    // Anomaly effects.
    const ag = g?.type === 'anomaly' ? g : null;
    if (shield.current) {
      shield.current.visible = !!ag && ag.s.kind === 'reflex' && ag.s.actedAt !== null;
      shield.current.position.copy(craftPos);
    }
    if (alarm.current) {
      alarm.current.position.copy(craftPos);
      alarm.current.intensity =
        ag && !ag.finished ? (Math.sin(state.clock.elapsedTime * 10) > 0 ? 0.6 : 0) : 0;
    }
    if (storm.current) {
      const on = !!ag && ag.s.kind === 'reflex' && ag.info.title.startsWith('Solar');
      storm.current.visible = on;
      if (on && ag) {
        storm.current.position.copy(craftPos).addScaledVector(SUN_DIR, 2.2 * (1 - ag.s.wave));
        storm.current.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          SUN_DIR.clone().negate(),
        );
      }
    }
    if (explosion.current && !launchFailed) explosion.current.visible = false;

    // Camera.
    if (S.snap) {
      S.camPos.copy(camGoal);
      S.camLook.copy(lookGoal);
      S.snap = false;
    } else {
      const k = 1 - Math.exp(-dt * 2.6);
      S.camPos.lerp(camGoal, k);
      S.camLook.lerp(lookGoal, k);
    }
    camera.up.lerp(upGoal, S.snap ? 1 : 1 - Math.exp(-dt * 2.6)).normalize();
    camera.position.copy(S.camPos);
    camera.lookAt(S.camLook);

    // Re-render the spacecraft only when its animation visibly changes.
    const q = (n: number) => Math.round(n * 20) / 20;
    const next = {
      deploy: q(deploy),
      burn: q(burn),
      scan,
      throttle: q(throttle),
      showCraft: craftVisible,
      dead: shot === 'ended' && timeline.outcome === 'failure',
    };
    const prev = animRef.current;
    if (
      next.deploy !== prev.deploy ||
      next.burn !== prev.burn ||
      next.scan !== prev.scan ||
      next.throttle !== prev.throttle ||
      next.dead !== prev.dead
    ) {
      animRef.current = next;
      setAnim(next);
    }
  });

  const { soft } = glowTextures();
  return (
    <>
      <Planet body="earth" radius={EARTH_R} sunDir={SUN_DIR} spin={0.002} />
      {target && (
        <Planet
          body={timeline.target}
          radius={target.r}
          sunDir={SUN_DIR}
          position={target.pos.toArray() as [number, number, number]}
          spin={0.001}
        />
      )}

      <group ref={rocket} scale={0.55}>
        <Rocket throttle={anim.throttle} />
      </group>
      <points geometry={trailGeo}>
        <pointsMaterial
          size={0.035}
          color="#ffd9a8"
          transparent
          opacity={0.5}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </points>

      <group ref={craft}>
        <group scale={craftScale}>
          <Spacecraft
            layout={layout}
            deploy={anim.deploy}
            burn={anim.burn}
            scan={anim.scan}
            spinWheels
            dead={anim.dead}
          />
        </group>
      </group>
      <sprite ref={marker} material={statusMats.marker} scale={[1.6, 1.6, 1]} />

      <primitive object={lines.path} />
      <primitive object={lines.arc} />
      <primitive object={lines.ring} />

      {Array.from({ length: 12 }, (_, i) => (
        <sprite
          key={`t${i}`}
          ref={(s) => (targetSprites.current[i] = s)}
          material={statusMats.waiting}
          visible={false}
        />
      ))}
      {Array.from({ length: 3 }, (_, i) => (
        <sprite
          key={`s${i}`}
          ref={(s) => (stationSprites.current[i] = s)}
          material={statusMats.station}
          visible={false}
        />
      ))}
      <sprite ref={reticle} material={statusMats.reticle} visible={false} />
      <mesh ref={beam} visible={false}>
        <cylinderGeometry args={[0.004, 0.004, 1, 6]} />
        <meshBasicMaterial
          color="#5eead4"
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      <mesh ref={explosion} visible={false}>
        <sphereGeometry args={[1, 32, 16]} />
        <meshBasicMaterial
          color="#ffb347"
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={shield} visible={false}>
        <sphereGeometry args={[0.16, 32, 16]} />
        <meshBasicMaterial
          color="#34d399"
          transparent
          opacity={0.18}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <pointLight ref={alarm} color="#ff2a2a" distance={1} intensity={0} />
      <points ref={storm} geometry={stormGeo} visible={false}>
        <pointsMaterial
          map={soft}
          size={0.03}
          color="#fdba74"
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </points>
    </>
  );
}

/** The 3D mission flight (lazy-loaded). */
export default function FlightScene3D(props: FlightScene3DProps) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ fov: 50, near: 0.005, far: 3000, position: [0, 0, 30] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 1.1;
      }}
    >
      <Environment />
      <SpaceBackdrop />
      <ambientLight intensity={0.04} />
      <hemisphereLight args={['#1b2a4a', '#000000', 0.35]} />
      <directionalLight
        position={SUN_DIR.clone().multiplyScalar(50)}
        intensity={3.2}
        color="#fff3e2"
      />
      <FlightWorld {...props} />
    </Canvas>
  );
}
