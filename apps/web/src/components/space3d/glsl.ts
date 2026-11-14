/** Shared GLSL helpers: hash-based value noise, fBm and Worley noise (our own code). */
export const NOISE_GLSL = /* glsl */ `
float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float vnoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = hash13(i);
  float b = hash13(i + vec3(1.0, 0.0, 0.0));
  float c = hash13(i + vec3(0.0, 1.0, 0.0));
  float d = hash13(i + vec3(1.0, 1.0, 0.0));
  float e = hash13(i + vec3(0.0, 0.0, 1.0));
  float f1 = hash13(i + vec3(1.0, 0.0, 1.0));
  float g = hash13(i + vec3(0.0, 1.0, 1.0));
  float h = hash13(i + vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(a, b, u.x), mix(c, d, u.x), u.y), mix(mix(e, f1, u.x), mix(g, h, u.x), u.y), u.z);
}
float fbm(vec3 p, int octaves) {
  float s = 0.0;
  float a = 0.5;
  float n = 0.0;
  for (int i = 0; i < 9; i++) {
    if (i >= octaves) break;
    s += a * vnoise(p);
    n += a;
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return s / n;
}
vec2 worley(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  float best = 8.0;
  float id = 0.0;
  for (int x = -1; x <= 1; x++)
  for (int y = -1; y <= 1; y++)
  for (int z = -1; z <= 1; z++) {
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 o = vec3(hash13(i + g), hash13(i + g + 17.1), hash13(i + g + 31.7));
    vec3 r = g + o - f;
    float dd = dot(r, r);
    if (dd < best) { best = dd; id = hash13(i + g + 5.3); }
  }
  return vec2(sqrt(best), id);
}
// Bowl-and-rim crater field: sums every nearby crater so there are no seams.
float craters(vec3 p, float scale, float density) {
  vec3 q = p * scale;
  vec3 i = floor(q);
  vec3 f = fract(q);
  float h = 0.0;
  for (int x = -1; x <= 1; x++)
  for (int y = -1; y <= 1; y++)
  for (int z = -1; z <= 1; z++) {
    vec3 g = vec3(float(x), float(y), float(z));
    float id = hash13(i + g + 5.3);
    if (id > density) continue;
    vec3 o = vec3(hash13(i + g), hash13(i + g + 17.1), hash13(i + g + 31.7));
    float r = 0.18 + 0.22 * fract(id * 13.7);
    float dist = length(g + o - f) / r;
    if (dist > 1.6) continue;
    float bowl = dist < 1.0 ? (dist * dist - 1.0) * 0.7 : 0.0;
    float rim = exp(-pow((dist - 1.0) * 3.5, 2.0)) * 0.35;
    h += (bowl + rim) * r;
  }
  return h / scale;
}
`;
