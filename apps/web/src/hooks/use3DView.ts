import { useCallback, useState } from 'react';
import { canUse3D } from '../components/space3d/webgl.ts';
import { useReducedMotion } from './useReducedMotion.ts';

const KEY = 'gravity-view-3d';

function read(): boolean | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === null ? null : v === '1';
  } catch {
    return null;
  }
}

/**
 * Whether to show the 3D views. Defaults to on when WebGL works and the player
 * has not asked for reduced motion; the choice is remembered on this device.
 */
export function use3DView(): { available: boolean; on: boolean; setOn: (on: boolean) => void } {
  const reduced = useReducedMotion();
  const available = canUse3D();
  const [pref, setPref] = useState<boolean | null>(read);
  const setOn = useCallback((on: boolean) => {
    setPref(on);
    try {
      localStorage.setItem(KEY, on ? '1' : '0');
    } catch {
      // Storage can be blocked; the choice then lasts for this visit only.
    }
  }, []);
  return { available, on: available && (pref ?? !reduced), setOn };
}
