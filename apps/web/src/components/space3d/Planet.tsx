import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Body } from '@gravity/shared';
import { NOISE_GLSL } from './glsl.ts';

const BODY_INDEX: Record<Body, number> = { earth: 0, moon: 1, mars: 2 };

/**
 * Procedural surfaces, baked once into equirectangular textures on the GPU.
 * Texture A: rgb = albedo, a = height. Texture B: r = ocean gloss, g = city lights, b = clouds.
 */
const BAKE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform int uBody;
uniform int uPass;
${NOISE_GLSL}

vec3 spherePoint(vec2 uv) {
  float phi = uv.x * 6.28318530718;
  float theta = (1.0 - uv.y) * 3.14159265359;
  return vec3(-cos(phi) * sin(theta), cos(theta), sin(phi) * sin(theta));
}

void earth(vec3 p, out vec4 A, out vec4 B) {
  vec3 q = p * 1.35;
  vec3 warp = vec3(fbm(q + 3.1, 4), fbm(q + 7.7, 4), fbm(q + 1.3, 4)) - 0.5;
  float c = fbm(q * 1.1 + warp * 1.7, 8);
  float lat = abs(p.y);
  float sea = 0.535;
  float land = smoothstep(sea, sea + 0.006, c);
  float elev = clamp((c - sea) / 0.2, 0.0, 1.0);
  float depth = clamp((sea - c) / 0.16, 0.0, 1.0);
  vec3 ocean = mix(vec3(0.02, 0.13, 0.22), vec3(0.004, 0.025, 0.075), pow(depth, 0.5));
  float moist = fbm(p * 3.0 + 11.0, 6);
  float desertBand = exp(-pow((lat - 0.42) / 0.16, 2.0));
  vec3 forest = mix(vec3(0.03, 0.09, 0.025), vec3(0.09, 0.15, 0.045), moist);
  vec3 desert = mix(vec3(0.47, 0.34, 0.19), vec3(0.62, 0.5, 0.33), fbm(p * 9.0, 4));
  float dry = smoothstep(0.35, 0.65, desertBand * 0.8 + (1.0 - moist) * 0.7 - 0.25);
  vec3 lc = mix(forest, desert, dry);
  lc = mix(lc, vec3(0.2, 0.17, 0.13), smoothstep(0.45, 0.8, elev));
  lc = mix(lc, vec3(0.8, 0.82, 0.86), smoothstep(0.82, 0.97, elev));
  lc = mix(lc, vec3(0.26, 0.25, 0.2), smoothstep(0.62, 0.78, lat));
  vec3 col = mix(ocean, lc, land);
  float ice = smoothstep(0.885, 0.9, lat + (fbm(p * 7.0, 4) - 0.5) * 0.14);
  col = mix(col, vec3(0.86, 0.9, 0.95), ice);
  float h = land * (0.35 + 0.65 * elev) * (1.0 - 0.6 * ice);

  float cities = land * (1.0 - ice) * smoothstep(0.55, 0.72, fbm(p * 7.0 + 2.0, 4))
    * smoothstep(0.45, 0.85, fbm(p * 90.0, 3)) * (1.0 - dry * 0.6) * (1.0 - smoothstep(0.6, 0.75, lat));
  vec3 cq = p * 2.4;
  vec3 cw = vec3(fbm(cq * 1.3 + 5.0, 4), fbm(cq * 1.3 + 9.0, 4), fbm(cq * 1.3 + 1.0, 4)) - 0.5;
  float band = 0.75 + 0.35 * cos(p.y * 9.0);
  float cl = fbm(cq + cw * 2.2, 8) * band;
  float clouds = smoothstep(0.5, 0.8, cl);
  A = vec4(col, h);
  B = vec4((1.0 - land) * (1.0 - ice), cities, clouds, 1.0);
}

void moon(vec3 p, out vec4 A, out vec4 B) {
  float m = fbm(p * 1.4 + vec3(fbm(p * 2.0, 3)) * 0.8, 6);
  float mare = smoothstep(0.5, 0.58, m);
  float detail = fbm(p * 14.0, 5);
  vec3 col = mix(vec3(0.3, 0.295, 0.285), vec3(0.12, 0.12, 0.125), mare) * (0.8 + 0.4 * detail);
  float h = 0.25 * (1.0 - mare) + 0.15 * fbm(p * 5.0, 5);
  h += craters(p, 3.0, 0.55) * 1.6 + craters(p, 7.0, 0.65) + craters(p, 16.0, 0.8) * 0.8
    + craters(p, 38.0, 0.9) * 0.6;
  A = vec4(col, clamp(h + 0.5, 0.0, 1.0));
  B = vec4(0.0);
}

void mars(vec3 p, out vec4 A, out vec4 B) {
  vec3 warp = vec3(fbm(p * 2.0 + 4.0, 4), fbm(p * 2.0 + 8.0, 4), fbm(p * 2.0, 4)) - 0.5;
  float dark = smoothstep(0.47, 0.62, fbm(p * 1.7 + warp * 1.4, 7));
  float lat = abs(p.y);
  vec3 col = mix(vec3(0.55, 0.24, 0.1), vec3(0.24, 0.11, 0.06), dark * 0.85);
  col *= 0.85 + 0.3 * fbm(p * 12.0, 5);
  col = mix(col, vec3(0.7, 0.42, 0.26), smoothstep(0.6, 0.85, fbm(p * 4.0 + 20.0, 4)) * 0.4);
  float cap = smoothstep(0.9, 0.93, lat + (fbm(p * 8.0, 4) - 0.5) * 0.1);
  col = mix(col, vec3(0.88, 0.86, 0.84), cap);
  float canyon = 1.0 - smoothstep(0.0, 0.03, abs(p.y + 0.15 + 0.05 * sin(p.x * 6.0))) * 1.0;
  canyon *= smoothstep(0.2, 0.6, p.z) ;
  float h = 0.5 + 0.25 * (fbm(p * 3.0, 6) - 0.5) + craters(p, 6.0, 0.5) + craters(p, 15.0, 0.7) * 0.6
    - canyon * 0.25;
  col *= 1.0 - canyon * 0.35;
  A = vec4(col, clamp(h, 0.0, 1.0));
  B = vec4(0.0, 0.0, 0.0, 1.0);
}

void main() {
  vec3 p = spherePoint(vUv);
  vec4 A;
  vec4 B;
  if (uBody == 0) earth(p, A, B);
  else if (uBody == 1) moon(p, A, B);
  else mars(p, A, B);
  gl_FragColor = uPass == 0 ? A : B;
}
`;

const BAKE_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const SURFACE_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormalW;
varying vec3 vEastW;
varying vec3 vNorthW;
void main() {
  vUv = uv;
  vec3 n = normalize(position);
  vec3 east = normalize(cross(vec3(0.0, 1.0, 0.0), n) + vec3(1e-5));
  vec3 north = cross(n, east);
  mat3 m = mat3(modelMatrix);
  vNormalW = normalize(m * n);
  vEastW = normalize(m * east);
  vNorthW = normalize(m * north);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const SURFACE_FRAG = /* glsl */ `
uniform sampler2D uA;
uniform sampler2D uB;
uniform vec3 uSun;
uniform vec2 uTexel;
uniform float uBump;
uniform int uBody;
uniform vec3 uAtmo;
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormalW;
varying vec3 vEastW;
varying vec3 vNorthW;

void main() {
  vec4 a = texture2D(uA, vUv);
  vec4 b = texture2D(uB, vUv);
  float hx = texture2D(uA, vUv + vec2(uTexel.x, 0.0)).a - texture2D(uA, vUv - vec2(uTexel.x, 0.0)).a;
  float hy = texture2D(uA, vUv + vec2(0.0, uTexel.y)).a - texture2D(uA, vUv - vec2(0.0, uTexel.y)).a;
  vec3 nG = normalize(vNormalW);
  vec3 nW = normalize(nG - uBump * (hx * normalize(vEastW) + hy * normalize(vNorthW)));
  vec3 L = normalize(uSun);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float ndl = dot(nG, L);
  float day = smoothstep(-0.08, 0.22, ndl);
  float diff = max(dot(nW, L), 0.0);
  // Terminator reddening, as sunlight crosses more air at dawn and dusk.
  vec3 sunCol = mix(vec3(1.0, 0.55, 0.32), vec3(1.0, 0.97, 0.92), smoothstep(0.0, 0.35, ndl));
  vec3 col = a.rgb * sunCol * diff * 1.7 * day + a.rgb * 0.004;
  if (uBody == 0) {
    vec3 H = normalize(L + V);
    float glint = pow(max(dot(nG, H), 0.0), 90.0) * 1.6 + pow(max(dot(nG, H), 0.0), 12.0) * 0.08;
    col += vec3(1.0, 0.9, 0.75) * glint * b.r * day;
    float night = 1.0 - smoothstep(-0.2, 0.06, ndl);
    col += vec3(1.0, 0.68, 0.32) * b.g * night * 1.8;
    float cloudShade = b.b * 0.35;
    col *= 1.0 - cloudShade * day;
  }
  float fres = pow(1.0 - max(dot(nG, V), 0.0), 2.6);
  col += uAtmo * fres * smoothstep(-0.25, 0.45, ndl) * 1.4;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const CLOUD_FRAG = /* glsl */ `
uniform sampler2D uB;
uniform vec3 uSun;
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormalW;
void main() {
  float c = texture2D(uB, vUv).b;
  vec3 nG = normalize(vNormalW);
  float ndl = dot(nG, normalize(uSun));
  float day = smoothstep(-0.12, 0.25, ndl);
  vec3 sunCol = mix(vec3(1.0, 0.6, 0.4), vec3(1.0), smoothstep(0.0, 0.3, ndl));
  vec3 col = vec3(0.85) * sunCol * (0.1 + 1.05 * max(ndl, 0.0)) * day + vec3(0.006);
  gl_FragColor = vec4(col, c * 0.85);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const ATMO_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vWorldN;
void main() {
  vN = normalize(normalMatrix * normal);
  vWorldN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const ATMO_FRAG = /* glsl */ `
uniform vec3 uSun;
uniform vec3 uColor;
uniform float uInner;
varying vec3 vN;
varying vec3 vWorldN;
void main() {
  float d = -dot(normalize(vN), vec3(0.0, 0.0, 1.0));
  float glow = pow(smoothstep(0.0, uInner, d), 2.2);
  float ndl = dot(normalize(vWorldN), normalize(uSun));
  float lit = smoothstep(-0.35, 0.5, ndl);
  vec3 col = mix(vec3(1.0, 0.45, 0.2), uColor, smoothstep(-0.1, 0.4, ndl));
  gl_FragColor = vec4(col * glow * lit * 0.75, 1.0);
}
`;

const SETTINGS: Record<
  Body,
  {
    size: number;
    bump: number;
    atmo: THREE.ColorRepresentation | null;
    atmoScale: number;
    clouds: boolean;
  }
> = {
  earth: { size: 4096, bump: 2.5, atmo: '#4d8dff', atmoScale: 1.035, clouds: true },
  moon: { size: 2048, bump: 9, atmo: null, atmoScale: 1, clouds: false },
  mars: { size: 2048, bump: 6, atmo: '#d98a5c', atmoScale: 1.02, clouds: false },
};

/** Bake both surface textures for a body once per renderer. */
function useBakedSurface(body: Body) {
  const gl = useThree((s) => s.gl);
  const baked = useMemo(() => {
    const size = Math.min(SETTINGS[body].size, gl.capabilities.maxTextureSize);
    const make = () => {
      const rt = new THREE.WebGLRenderTarget(size, size / 2, {
        generateMipmaps: true,
        minFilter: THREE.LinearMipmapLinearFilter,
        magFilter: THREE.LinearFilter,
        wrapS: THREE.RepeatWrapping,
        anisotropy: Math.min(8, gl.capabilities.getMaxAnisotropy()),
      });
      return rt;
    };
    return { a: make(), b: make(), size };
  }, [body, gl]);

  useEffect(() => {
    const scene = new THREE.Scene();
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const mat = new THREE.ShaderMaterial({
      vertexShader: BAKE_VERT,
      fragmentShader: BAKE_FRAG,
      uniforms: { uBody: { value: BODY_INDEX[body] }, uPass: { value: 0 } },
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    scene.add(quad);
    const prev = gl.getRenderTarget();
    for (const [pass, rt] of [baked.a, baked.b].entries()) {
      mat.uniforms.uPass!.value = pass;
      gl.setRenderTarget(rt);
      gl.render(scene, cam);
    }
    gl.setRenderTarget(prev);
    quad.geometry.dispose();
    mat.dispose();
    return () => {
      baked.a.dispose();
      baked.b.dispose();
    };
  }, [baked, body, gl]);
  return baked;
}

export interface PlanetProps {
  body: Body;
  radius: number;
  sunDir: THREE.Vector3;
  position?: [number, number, number];
  /** Radians per second of spin. */
  spin?: number;
}

/** A lit, rotating procedural planet with clouds (Earth) and an atmosphere glow. */
export function Planet({ body, radius, sunDir, position = [0, 0, 0], spin = 0.004 }: PlanetProps) {
  const s = SETTINGS[body];
  const baked = useBakedSurface(body);
  const surface = useRef<THREE.Mesh>(null);
  const clouds = useRef<THREE.Mesh>(null);

  const surfaceMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: SURFACE_VERT,
        fragmentShader: SURFACE_FRAG,
        uniforms: {
          uA: { value: baked.a.texture },
          uB: { value: baked.b.texture },
          uSun: { value: sunDir },
          uTexel: { value: new THREE.Vector2(1 / baked.size, 2 / baked.size) },
          uBump: { value: s.bump },
          uBody: { value: BODY_INDEX[body] },
          uAtmo: {
            value: new THREE.Color(s.atmo ?? '#000000').multiplyScalar(s.atmo ? 0.55 : 0),
          },
        },
      }),
    [baked, body, s, sunDir],
  );
  const cloudMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: SURFACE_VERT,
        fragmentShader: CLOUD_FRAG,
        uniforms: { uB: { value: baked.b.texture }, uSun: { value: sunDir } },
        transparent: true,
        depthWrite: false,
      }),
    [baked, sunDir],
  );
  const atmoMat = useMemo(
    () =>
      s.atmo
        ? new THREE.ShaderMaterial({
            vertexShader: ATMO_VERT,
            fragmentShader: ATMO_FRAG,
            uniforms: {
              uSun: { value: sunDir },
              uColor: { value: new THREE.Color(s.atmo) },
              // Where the planet's own limb sits on the shell, as seen from far away.
              uInner: { value: Math.sqrt(1 - 1 / (s.atmoScale * s.atmoScale)) * 1.6 },
            },
            side: THREE.BackSide,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        : null,
    [s, sunDir],
  );
  useEffect(
    () => () => {
      surfaceMat.dispose();
      cloudMat.dispose();
      atmoMat?.dispose();
    },
    [surfaceMat, cloudMat, atmoMat],
  );

  useFrame((_, dt) => {
    if (surface.current) surface.current.rotation.y += spin * dt;
    if (clouds.current) clouds.current.rotation.y += spin * 1.25 * dt;
  });

  return (
    <group position={position}>
      <mesh ref={surface} material={surfaceMat}>
        <sphereGeometry args={[radius, 192, 96]} />
      </mesh>
      {s.clouds && (
        <mesh ref={clouds} material={cloudMat}>
          <sphereGeometry args={[radius * 1.008, 160, 80]} />
        </mesh>
      )}
      {atmoMat && (
        <mesh material={atmoMat} scale={s.atmoScale}>
          <sphereGeometry args={[radius, 96, 48]} />
        </mesh>
      )}
    </group>
  );
}
