let cached: boolean | null = null;

/** True when the browser can render WebGL. Tests (jsdom) and very old devices get the 2D views. */
export function canUse3D(): boolean {
  if (cached !== null) return cached;
  if (typeof window === 'undefined' || /jsdom/i.test(navigator.userAgent)) return (cached = false);
  try {
    const c = document.createElement('canvas');
    cached = !!(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    cached = false;
  }
  return cached;
}
