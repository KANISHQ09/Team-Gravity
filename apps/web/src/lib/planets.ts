import type { Body } from '@gravity/shared';

/**
 * Real photographs (public domain, NASA; credits in docs/DATA_LEDGER.md):
 * Apollo 17 Earth, Galileo Moon, Viking Mars. The glow colour matches each world.
 */
export const PLANET_PHOTO: Record<Body, { src: string; glow: string; accent: string }> = {
  earth: { src: '/media/planets/earth.jpg', glow: 'rgba(96,165,250,0.35)', accent: '#60a5fa' },
  moon: { src: '/media/planets/moon.jpg', glow: 'rgba(226,232,240,0.22)', accent: '#e2e8f0' },
  mars: { src: '/media/planets/mars.jpg', glow: 'rgba(251,146,60,0.3)', accent: '#fb923c' },
};
