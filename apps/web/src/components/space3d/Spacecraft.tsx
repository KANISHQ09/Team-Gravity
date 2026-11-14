import { type ReactNode, useEffect, useMemo, useRef } from 'react';
import { type ThreeEvent, createPortal, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { CraftLayout, InstrumentKind } from './craftLayout.ts';
import { Beam, EnginePlume } from './effects.tsx';
import { craftMaterials } from './materials.ts';

export interface SpacecraftProps {
  layout: CraftLayout;
  /** 0 = stowed for launch, 1 = fully deployed. */
  deploy: number;
  /** Main engine thrust 0…1. */
  burn?: number;
  xray?: boolean;
  scan?: boolean;
  spinWheels?: boolean;
  /** Animate parts popping in when they are added (builder). */
  popIn?: boolean;
  selectedId?: string | null;
  onSelect?: (partId: string) => void;
  /** Dark and lifeless (mission lost). */
  dead?: boolean;
}

const BOX = new THREE.BoxGeometry(1, 1, 1);
const SELECT_EDGES = new THREE.EdgesGeometry(BOX);

/** Groups one part's meshes so it can be clicked, highlighted and popped in. */
function PartGroup({
  id,
  children,
  popIn,
  onSelect,
  register,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}: {
  id: string;
  children: ReactNode;
  popIn: boolean;
  onSelect: ((id: string) => void) | undefined;
  register: (id: string, o: THREE.Object3D | null) => void;
  position?: [number, number, number];
  rotation?: [number, number, number];
}) {
  const ref = useRef<THREE.Group>(null);
  const born = useRef(popIn ? 0 : 1);
  useEffect(() => {
    register(id, ref.current);
    return () => register(id, null);
  }, [id, register]);
  useFrame((_, dt) => {
    if (!ref.current || born.current >= 1) return;
    born.current = Math.min(1, born.current + dt * 2.2);
    const t = born.current;
    // Ease-out-back: a little overshoot, like the part clicking into place.
    const s = 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
    ref.current.scale.setScalar(Math.max(0.001, s));
  });
  return (
    <group
      ref={ref}
      position={position}
      rotation={rotation}
      scale={popIn ? 0.001 : 1}
      {...(onSelect
        ? {
            onClick: (e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation();
              onSelect(id.split('#')[0]!);
            },
            onPointerOver: () => {
              document.body.style.cursor = 'pointer';
            },
            onPointerOut: () => {
              document.body.style.cursor = '';
            },
          }
        : {})}
    >
      {children}
    </group>
  );
}

function Nozzle({ size, burn, ion }: { size: number; burn: number; ion: boolean }) {
  const m = craftMaterials();
  const geo = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      pts.push(new THREE.Vector2(size * (0.18 + 0.32 * Math.pow(t, 0.7)), -t * size * 1.1));
    }
    return new THREE.LatheGeometry(pts, 32);
  }, [size]);
  useEffect(() => () => geo.dispose(), [geo]);
  if (ion) {
    return (
      <group>
        <mesh material={m.dark} position={[0, -size * 0.15, 0]}>
          <cylinderGeometry args={[size * 0.45, size * 0.5, size * 0.3, 32]} />
        </mesh>
        <mesh material={m.ionGlow} position={[0, -size * 0.31, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[size * 0.4, 32]} />
        </mesh>
        <group position={[0, -size * 0.32, 0]}>
          <EnginePlume radius={size * 0.42} length={size * 4} intensity={burn} color="#4f8dff" />
        </group>
      </group>
    );
  }
  return (
    <group>
      <mesh geometry={geo} material={m.nozzle} />
      <group position={[0, -size * 1.1, 0]}>
        <EnginePlume radius={size * 0.55} length={size * 5} intensity={burn} />
      </group>
    </group>
  );
}

function Dish({ diameter, deploy }: { diameter: number; deploy: number }) {
  const m = craftMaterials();
  const geo = useMemo(() => {
    const r = diameter / 2;
    const f = diameter * 0.4;
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 20; i++) {
      const x = (i / 20) * r;
      pts.push(new THREE.Vector2(x, (x * x) / (4 * f)));
    }
    return new THREE.LatheGeometry(pts, 48);
  }, [diameter]);
  useEffect(() => () => geo.dispose(), [geo]);
  const mast = diameter * 0.25;
  const s = 0.15 + 0.85 * deploy;
  return (
    <group>
      <mesh material={m.aluminium} position={[0, mast / 2, 0]}>
        <cylinderGeometry args={[diameter * 0.03, diameter * 0.04, mast, 12]} />
      </mesh>
      <group position={[0, mast, 0]} rotation={[0.35, 0, 0]} scale={[s, 1, s]}>
        <mesh geometry={geo} material={m.white} />
        {[0, 1, 2].map((i) => (
          <mesh
            key={i}
            material={m.aluminium}
            position={[
              Math.cos((i * Math.PI * 2) / 3) * diameter * 0.18,
              diameter * 0.2,
              Math.sin((i * Math.PI * 2) / 3) * diameter * 0.18,
            ]}
            rotation={[
              Math.sin((i * Math.PI * 2) / 3) * 0.6,
              0,
              -Math.cos((i * Math.PI * 2) / 3) * 0.6,
            ]}
          >
            <cylinderGeometry args={[diameter * 0.008, diameter * 0.008, diameter * 0.45, 6]} />
          </mesh>
        ))}
        <mesh material={m.gold} position={[0, diameter * 0.38, 0]}>
          <cylinderGeometry args={[diameter * 0.04, diameter * 0.06, diameter * 0.08, 16]} />
        </mesh>
      </group>
    </group>
  );
}

function Instrument({ kind, size, scan }: { kind: InstrumentKind; size: number; scan: boolean }) {
  const m = craftMaterials();
  const s = size;
  const beam = scan ? <Beam length={s * 14} radius={s * 2.2} /> : null;
  switch (kind) {
    case 'camera':
    case 'altimeter':
      return (
        <group>
          <mesh
            material={kind === 'camera' ? m.dark : m.aluminium}
            position={[0, 0, s * 0.45]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[s * 0.32, s * 0.38, s * 0.9, 24]} />
          </mesh>
          <mesh material={m.dark} position={[0, 0, s * 1.0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[s * 0.42, s * 0.34, s * 0.25, 24, 1, true]} />
          </mesh>
          <mesh material={m.lens} position={[0, 0, s * 0.91]} rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[s * 0.3, 24]} />
          </mesh>
          {beam}
        </group>
      );
    case 'multispectral':
      return (
        <group>
          <mesh
            material={m.silverFoil}
            position={[0, 0, s * 0.3]}
            scale={[s * 0.9, s * 0.7, s * 0.6]}
            geometry={BOX}
          />
          {[-0.25, 0, 0.25].map((x) => (
            <mesh
              key={x}
              material={m.lens}
              position={[x * s, 0, s * 0.61]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[s * 0.1, s * 0.1, s * 0.05, 16]} />
            </mesh>
          ))}
          {beam}
        </group>
      );
    case 'spectrometer':
      return (
        <group>
          <mesh
            material={m.gold}
            position={[0, 0, s * 0.35]}
            scale={[s * 0.8, s * 0.8, s * 0.7]}
            geometry={BOX}
          />
          <mesh
            material={m.lens}
            position={[0, 0, s * 0.71]}
            scale={[s * 0.5, s * 0.06, s * 0.02]}
            geometry={BOX}
          />
          <mesh
            material={m.radiator}
            position={[s * 0.45, 0, s * 0.35]}
            scale={[s * 0.04, s * 0.7, s * 0.6]}
            geometry={BOX}
          />
          {beam}
        </group>
      );
    case 'radiation':
      return (
        <group>
          <mesh
            material={m.aluminium}
            position={[0, 0, s * 0.2]}
            scale={[s * 0.5, s * 0.5, s * 0.4]}
            geometry={BOX}
          />
          <mesh material={m.gold} position={[0, 0, s * 0.4]} rotation={[Math.PI / 2, 0, 0]}>
            <sphereGeometry args={[s * 0.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
        </group>
      );
    default:
      return null;
  }
}

/** One solar wing: a yoke and an accordion of panels that unfolds with `deploy`. */
function Wing({
  side,
  segmentSize,
  segments,
  gap,
  deploy,
}: {
  side: 1 | -1;
  segmentSize: number;
  segments: number;
  gap: number;
  deploy: number;
}) {
  const m = craftMaterials();
  const fold = 1 - deploy;
  const panelMats = useMemo(
    () => [m.aluminium, m.aluminium, m.aluminium, m.aluminium, m.cells, m.panelBack],
    [m],
  );
  const s = segmentSize;
  const panel = (i: number): ReactNode => {
    if (i >= segments) return null;
    const angle = i === 0 ? 0 : (i % 2 === 1 ? 1 : -1) * Math.PI * fold * 0.98;
    return (
      <group rotation={[0, angle * side, 0]}>
        <mesh
          material={panelMats}
          position={[(side * s) / 2, 0, 0]}
          scale={[s * 0.97, s, s * 0.025]}
          geometry={BOX}
        />
        <group position={[side * s, 0, 0]}>{panel(i + 1)}</group>
      </group>
    );
  };
  return (
    <group rotation={[0, (side * Math.PI * fold) / 2, 0]}>
      <mesh
        material={m.aluminium}
        position={[(side * gap) / 2, 0, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[s * 0.02, s * 0.02, gap, 8]} />
      </mesh>
      <group position={[side * gap, 0, 0]} rotation={[deploy * 0.0, 0, 0]}>
        {panel(0)}
      </group>
    </group>
  );
}

/** Procedural spacecraft built from the real parts list (see craftLayout.ts). */
export function Spacecraft({
  layout,
  deploy,
  burn = 0,
  xray = false,
  scan = false,
  spinWheels = false,
  popIn = false,
  selectedId = null,
  onSelect,
  dead = false,
}: SpacecraftProps) {
  const m = craftMaterials();
  const [w, h, d] = layout.bus.size;
  const objects = useRef(new Map<string, THREE.Object3D>());
  const register = useMemo(
    () => (id: string, o: THREE.Object3D | null) => {
      if (o) objects.current.set(id, o);
      else objects.current.delete(id);
    },
    [],
  );
  const wheels = useRef<THREE.Group>(null);
  const scene = useThree((s) => s.scene);
  const selBox = useRef<THREE.LineSegments>(null);
  const box3 = useMemo(() => new THREE.Box3(), []);

  const xrayMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#67e8f9',
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
        metalness: 0.2,
        roughness: 0.4,
        emissive: '#0e7490',
        emissiveIntensity: 0.4,
      }),
    [],
  );
  useEffect(() => () => xrayMat.dispose(), [xrayMat]);
  const busMats = useMemo(
    () =>
      xray
        ? xrayMat
        : layout.bus.cube
          ? [m.aluminium, m.aluminium, m.dark, m.dark, m.aluminium, m.aluminium]
          : [m.gold, m.gold, m.silverFoil, m.silverFoil, m.gold, m.gold],
    [xray, xrayMat, layout.bus.cube, m],
  );

  useFrame((_, dt) => {
    if (wheels.current && spinWheels) {
      for (const c of wheels.current.children) c.rotation.y += dt * 18;
    }
    let sel: THREE.Object3D | undefined;
    if (selectedId) {
      const wingKey = layout.solarIds.find((i) => i !== 'solar-body');
      const key =
        layout.wings &&
        wingKey &&
        layout.solarIds.includes(selectedId) &&
        selectedId !== 'solar-body'
          ? wingKey
          : selectedId;
      for (const [k, o] of objects.current) {
        if (k === key || k.startsWith(`${key}#`)) {
          sel = o;
          break;
        }
      }
      // Body-mounted cells and other unseen parts highlight the bus.
      sel ??= layout.busId ? objects.current.get(layout.busId) : undefined;
    }
    if (selBox.current) {
      selBox.current.visible = !!sel;
      if (sel) {
        box3.setFromObject(sel);
        if (!box3.isEmpty()) {
          const c = box3.getCenter(new THREE.Vector3());
          const sz = box3.getSize(new THREE.Vector3()).multiplyScalar(1.12).addScalar(0.002);
          selBox.current.position.copy(c);
          selBox.current.scale.copy(sz);
        }
      }
    }
  });

  if (!layout.bus.present) {
    return (
      <mesh geometry={BOX} scale={[w, h, d]}>
        <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.35} />
      </mesh>
    );
  }

  const pg = { popIn, onSelect, register };
  const busId = layout.busId!;
  const rail = Math.min(w, d) * 0.04;
  return (
    <group>
      <PartGroup id={busId} {...pg}>
        <mesh geometry={BOX} material={busMats} scale={[w, h, d]} />
        {!xray &&
          [
            [1, 1],
            [1, -1],
            [-1, 1],
            [-1, -1],
          ].map(([sx, sz]) => (
            <mesh
              key={`${sx}${sz}`}
              geometry={BOX}
              material={m.aluminium}
              position={[(sx! * w) / 2, 0, (sz! * d) / 2]}
              scale={[rail, h * 1.01, rail]}
            />
          ))}
        {!xray && !layout.bus.cube && (
          <mesh
            geometry={BOX}
            material={m.radiator}
            position={[0, 0, -d / 2 - 0.004]}
            scale={[w * 0.7, h * 0.6, 0.006]}
          />
        )}
        {!xray && (
          <mesh material={m.aluminium} position={[0, -h / 2 - h * 0.03, 0]}>
            <cylinderGeometry args={[Math.min(w, d) * 0.3, Math.min(w, d) * 0.32, h * 0.06, 32]} />
          </mesh>
        )}
        {layout.bodySolar &&
          !xray &&
          [
            [w / 2 + 0.003, 0, 0, 0, Math.PI / 2],
            [-w / 2 - 0.003, 0, 0, 0, -Math.PI / 2],
            [0, 0, -d / 2 - 0.003, 0, Math.PI],
          ].map(([x, y, z, , ry], i) => (
            <mesh key={i} position={[x!, y!, z!]} rotation={[0, ry!, 0]} material={m.cells}>
              <planeGeometry args={[i === 2 ? w * 0.92 : d * 0.92, h * 0.92]} />
            </mesh>
          ))}
      </PartGroup>

      {xray && layout.internals.length > 0 && (
        <group>
          {layout.internals.map((it, i) => (
            <PartGroup
              key={`${it.partId}-${i}`}
              id={`${it.partId}#internal${i}`}
              {...pg}
              position={it.position as [number, number, number]}
            >
              {it.kind === 'battery' && (
                <mesh geometry={BOX} scale={[it.size, it.size * 0.6, it.size]}>
                  <meshStandardMaterial
                    color="#334155"
                    emissive="#22c55e"
                    emissiveIntensity={0.25}
                  />
                </mesh>
              )}
              {it.kind === 'computer' && (
                <mesh geometry={BOX} scale={[it.size, it.size * 0.3, it.size]}>
                  <meshStandardMaterial
                    color="#14532d"
                    emissive="#4ade80"
                    emissiveIntensity={0.35}
                  />
                </mesh>
              )}
              {it.kind === 'tank' && (
                <mesh material={m.aluminium}>
                  <sphereGeometry args={[it.size, 32, 16]} />
                </mesh>
              )}
              {it.kind === 'wheels' && (
                <group ref={wheels}>
                  {[0, 1, 2, 3].map((k) => (
                    <group
                      key={k}
                      rotation={[0.6, (k * Math.PI) / 2, 0]}
                      position={[
                        Math.cos((k * Math.PI) / 2) * it.size * 0.6,
                        0,
                        Math.sin((k * Math.PI) / 2) * it.size * 0.6,
                      ]}
                    >
                      <mesh>
                        <cylinderGeometry
                          args={[it.size * 0.3, it.size * 0.3, it.size * 0.08, 24]}
                        />
                        <meshStandardMaterial
                          color="#cbd5e1"
                          metalness={0.9}
                          roughness={0.25}
                          emissive="#38bdf8"
                          emissiveIntensity={0.15}
                        />
                      </mesh>
                      <mesh position={[it.size * 0.2, it.size * 0.05, 0]}>
                        <boxGeometry args={[it.size * 0.1, it.size * 0.02, it.size * 0.05]} />
                        <meshBasicMaterial color="#f97316" />
                      </mesh>
                    </group>
                  ))}
                </group>
              )}
            </PartGroup>
          ))}
        </group>
      )}

      {layout.wings && (
        <PartGroup
          id={layout.solarIds.find((i) => i !== 'solar-body') ?? layout.solarIds[0]!}
          {...pg}
        >
          {([1, -1] as const).map((side) => (
            <group key={side} position={[(side * w) / 2, 0, 0]}>
              <Wing side={side} {...layout.wings!} deploy={deploy} />
            </group>
          ))}
        </PartGroup>
      )}

      {layout.antennas.map((a, i) => (
        <PartGroup
          key={`${a.partId}-${i}`}
          id={`${a.partId}#${i}`}
          {...pg}
          position={a.position as [number, number, number]}
        >
          {a.kind === 'dish' && <Dish diameter={a.diameter} deploy={deploy} />}
          {a.kind === 'patch' && (
            <group>
              <mesh
                geometry={BOX}
                material={m.white}
                scale={[a.diameter * 1.5, a.diameter * 0.15, a.diameter * 1.5]}
                position={[0, a.diameter * 0.075, 0]}
              />
              <mesh
                geometry={BOX}
                material={m.gold}
                scale={[a.diameter, a.diameter * 0.16, a.diameter]}
                position={[0, a.diameter * 0.08, 0]}
              />
            </group>
          )}
          {a.kind === 'whip' && (
            <mesh
              material={m.aluminium}
              rotation={[0, 0, 0]}
              position={[0, a.diameter * 3 * deploy, 0]}
              scale={[1, Math.max(0.05, deploy), 1]}
            >
              <cylinderGeometry args={[a.diameter * 0.06, a.diameter * 0.06, a.diameter * 6, 6]} />
            </mesh>
          )}
        </PartGroup>
      ))}

      {layout.instruments.map((it, i) => (
        <PartGroup
          key={`${it.partId}-${i}`}
          id={`${it.partId}#${i}`}
          {...pg}
          position={it.position as [number, number, number]}
        >
          <Instrument kind={it.kind} size={it.size} scan={scan} />
        </PartGroup>
      ))}

      {layout.radar && (
        <PartGroup id={layout.radar.partId} {...pg} position={[0, -h * 0.4, d * 0.3]}>
          {[1, -1].map((sx) => (
            <mesh
              key={sx}
              material={m.aluminium}
              position={[sx * (w / 2 + (layout.radar!.length * deploy) / 2), 0, 0]}
              rotation={[0, 0, Math.PI / 2]}
              scale={[1, Math.max(0.01, deploy), 1]}
            >
              <cylinderGeometry args={[w * 0.012, w * 0.012, layout.radar!.length, 6]} />
            </mesh>
          ))}
          <mesh geometry={BOX} material={m.gold} scale={[w * 0.3, h * 0.1, d * 0.2]} />
        </PartGroup>
      )}

      {layout.magnetometer && (
        <PartGroup id={layout.magnetometer.partId} {...pg} position={[w * 0.3, h * 0.3, -d / 2]}>
          <mesh
            material={m.aluminium}
            position={[0, 0, (-layout.magnetometer.length * deploy) / 2]}
            rotation={[Math.PI / 2, 0, 0]}
            scale={[1, Math.max(0.01, deploy), 1]}
          >
            <cylinderGeometry args={[w * 0.01, w * 0.01, layout.magnetometer.length, 6]} />
          </mesh>
          <mesh
            geometry={BOX}
            material={m.white}
            position={[0, 0, -layout.magnetometer.length * deploy]}
            scale={[w * 0.06, w * 0.06, w * 0.06]}
          />
        </PartGroup>
      )}

      {layout.engine && (
        <PartGroup id={layout.engine.partId} {...pg} position={[0, -h / 2 - h * 0.06, 0]}>
          {layout.engine.kind === 'cold-gas' ? (
            [
              [1, 1],
              [1, -1],
              [-1, 1],
              [-1, -1],
            ].map(([sx, sz]) => (
              <group key={`${sx}${sz}`} position={[(sx! * w) / 2.6, 0, (sz! * d) / 2.6]}>
                <Nozzle size={w * 0.08} burn={burn} ion={false} />
              </group>
            ))
          ) : (
            <Nozzle size={layout.engine.size} burn={burn} ion={layout.engine.kind === 'electric'} />
          )}
        </PartGroup>
      )}

      {layout.starTrackers && (
        <PartGroup id={`${layout.starTrackers}#trackers`} {...pg} position={[0, h / 2, -d / 2]}>
          {[1, -1].map((sx) => (
            <mesh
              key={sx}
              material={m.dark}
              position={[sx * w * 0.25, w * 0.06, -w * 0.02]}
              rotation={[-0.6, 0, sx * 0.3]}
            >
              <cylinderGeometry args={[w * 0.05, w * 0.035, w * 0.14, 16, 1, true]} />
            </mesh>
          ))}
        </PartGroup>
      )}

      {dead && <pointLight color="#ff3b3b" intensity={0} />}

      {createPortal(
        <lineSegments ref={selBox} geometry={SELECT_EDGES} visible={false}>
          <lineBasicMaterial color="#22d3ee" toneMapped={false} />
        </lineSegments>,
        scene,
      )}
    </group>
  );
}
