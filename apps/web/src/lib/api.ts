import type { Design, Difficulty } from '@gravity/shared';

/**
 * Optional online features (leaderboard). Solo play never depends on these:
 * every call fails soft and the UI shows the game as offline.
 */
const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
export const API_BASE = BASE;

export interface LeaderboardEntry {
  readonly rank: number;
  readonly total: number;
  readonly teamName: string;
  readonly playerCount: number;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  if (!BASE) throw new Error('The online service is not configured.');
  const res = await fetch(`${BASE}/api/v1${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const problem = (await res.json().catch(() => null)) as {
      detail?: string;
      title?: string;
    } | null;
    throw new Error(problem?.detail ?? problem?.title ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

let session: { token: string; guestId: string; expiresAt: number } | null = null;

/** Guest session (no personal data); renewed a minute before it expires. */
export async function guestSession(): Promise<{ token: string; guestId: string }> {
  if (session && session.expiresAt > Date.now() + 60_000) return session;
  const r = await call<{ accessToken: string; guestId: string; expiresIn: number }>('/auth/guest', {
    method: 'POST',
    credentials: 'include',
  });
  session = {
    token: r.accessToken,
    guestId: r.guestId,
    expiresAt: Date.now() + r.expiresIn * 1000,
  };
  return session;
}

const token = async () => (await guestSession()).token;

export async function createRoom(scenarioId: string, difficulty: Difficulty) {
  return call<{ code: string; roomId: string }>('/rooms', {
    method: 'POST',
    body: JSON.stringify({ scenarioId, difficulty }),
    headers: { authorization: `Bearer ${await token()}` },
  });
}

export async function submitScore(input: {
  design: Design;
  seed: number;
  teamName: string;
  playerCount: number;
}) {
  return call<{ total: number; rank: number }>('/scores', {
    method: 'POST',
    body: JSON.stringify(input),
    headers: { authorization: `Bearer ${await token()}` },
  });
}

export function fetchLeaderboard(scenarioId: string, difficulty: Difficulty) {
  return call<{ entries: LeaderboardEntry[] }>(
    `/leaderboards/${encodeURIComponent(scenarioId)}?difficulty=${encodeURIComponent(difficulty)}`,
  );
}

export const onlineConfigured = BASE !== '';
