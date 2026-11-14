import * as THREE from 'three';

/** Spacecraft materials and procedural textures, created once and shared. */

function crinkleNormalMap(): THREE.DataTexture {
  // Multi-layer insulation foil: random overlapping creases, turned into a normal map.
  const N = 256;
  const h = new Float32Array(N * N);
  for (let k = 0; k < 140; k++) {
    const x0 = Math.random() * N;
    const y0 = Math.random() * N;
    const a = Math.random() * Math.PI;
    const len = 20 + Math.random() * 70;
    const amp = (Math.random() - 0.5) * 2;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        // Distance to a crease segment (wrapping, so the texture tiles).
        let px = x - x0;
        let py = y - y0;
        px -= N * Math.round(px / N);
        py -= N * Math.round(py / N);
        const t = Math.max(-len, Math.min(len, px * dx + py * dy));
        const ex = px - t * dx;
        const ey = py - t * dy;
        const d = Math.sqrt(ex * ex + ey * ey);
        if (d < 6) h[y * N + x]! += amp * (1 - d / 6);
      }
    }
  }
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const l = h[y * N + ((x - 1 + N) % N)]!;
      const r = h[y * N + ((x + 1) % N)]!;
      const u = h[((y - 1 + N) % N) * N + x]!;
      const d = h[((y + 1) % N) * N + x]!;
      const v = new THREE.Vector3((l - r) * 0.6, (u - d) * 0.6, 1).normalize();
      const i = (y * N + x) * 4;
      data[i] = (v.x * 0.5 + 0.5) * 255;
      data[i + 1] = (v.y * 0.5 + 0.5) * 255;
      data[i + 2] = (v.z * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, N, N);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

function solarCellTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#c9ccd2';
  g.fillRect(0, 0, 512, 512);
  const n = 8;
  const s = 512 / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const grd = g.createLinearGradient(x * s, y * s, x * s + s, y * s + s);
      grd.addColorStop(0, '#1a2f6b');
      grd.addColorStop(0.5, '#0d1c47');
      grd.addColorStop(1, '#16285c');
      g.fillStyle = grd;
      g.fillRect(x * s + 3, y * s + 3, s - 6, s - 6);
      g.strokeStyle = 'rgba(190,200,220,0.35)';
      g.lineWidth = 1;
      for (let k = 1; k < 4; k++) {
        g.beginPath();
        g.moveTo(x * s + 3, y * s + (k * s) / 4);
        g.lineTo(x * s + s - 3, y * s + (k * s) / 4);
        g.stroke();
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

let cache: ReturnType<typeof build> | null = null;

function build() {
  const crinkle = crinkleNormalMap();
  const cells = solarCellTexture();
  return {
    gold: new THREE.MeshStandardMaterial({
      color: '#e0a83c',
      metalness: 1,
      roughness: 0.32,
      normalMap: crinkle,
      normalScale: new THREE.Vector2(0.8, 0.8),
    }),
    silverFoil: new THREE.MeshStandardMaterial({
      color: '#d5d9df',
      metalness: 1,
      roughness: 0.28,
      normalMap: crinkle,
      normalScale: new THREE.Vector2(0.6, 0.6),
    }),
    aluminium: new THREE.MeshStandardMaterial({
      color: '#a9b0b8',
      metalness: 0.9,
      roughness: 0.38,
    }),
    white: new THREE.MeshStandardMaterial({ color: '#ecebe6', metalness: 0.05, roughness: 0.6 }),
    radiator: new THREE.MeshStandardMaterial({ color: '#f4f4f0', metalness: 0.2, roughness: 0.25 }),
    dark: new THREE.MeshStandardMaterial({ color: '#1b1d22', metalness: 0.6, roughness: 0.45 }),
    lens: new THREE.MeshStandardMaterial({ color: '#03050a', metalness: 1, roughness: 0.04 }),
    cells: new THREE.MeshStandardMaterial({
      map: cells,
      metalness: 0.65,
      roughness: 0.22,
    }),
    panelBack: new THREE.MeshStandardMaterial({ color: '#d6d3cc', metalness: 0.3, roughness: 0.6 }),
    nozzle: new THREE.MeshStandardMaterial({
      color: '#7a7672',
      metalness: 1,
      roughness: 0.3,
      side: THREE.DoubleSide,
    }),
    ionGlow: new THREE.MeshBasicMaterial({ color: '#7fb4ff', toneMapped: false }),
  };
}

export function craftMaterials() {
  cache ??= build();
  return cache;
}

/**
 * A tiny "space" environment for reflections: black sky, a bright Sun and a
 * blue planet glow below. Gives metal and foil real highlights.
 */
export function makeSpaceEnvironment(gl: THREE.WebGLRenderer, sunDir: THREE.Vector3) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#000000');
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(6, 16, 8),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(40, 38, 34) }),
  );
  sun.position.copy(sunDir).multiplyScalar(60);
  scene.add(sun);
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(70, 32, 16, 0, Math.PI * 2, Math.PI * 0.6, Math.PI * 0.4),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.08, 0.16, 0.32), side: THREE.BackSide }),
  );
  scene.add(glow);
  const pmrem = new THREE.PMREMGenerator(gl);
  const rt = pmrem.fromScene(scene, 0.02);
  pmrem.dispose();
  sun.geometry.dispose();
  glow.geometry.dispose();
  return rt;
}
