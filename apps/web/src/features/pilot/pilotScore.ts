/** Pilot rating: separate from the mission score, which stays design-based. */

export type PilotGameId = 'launch' | 'insertion' | 'science' | `anomaly-${number}`;

export interface PilotGameResult {
  readonly id: PilotGameId;
  readonly label: string;
  readonly score: number;
  readonly summary: string;
  /** True when the player handed over to the autopilot. */
  readonly autopilot: boolean;
}

export interface PilotSummary {
  readonly score: number;
  readonly medal: 'gold' | 'silver' | 'bronze' | 'none';
  readonly title: string;
  readonly games: readonly PilotGameResult[];
}

/** Handing over to the autopilot still completes the phase, but earns few points. */
export const AUTOPILOT_SCORE = 40;

export function pilotSummary(games: readonly PilotGameResult[]): PilotSummary | null {
  if (games.length === 0) return null;
  const score = Math.round(games.reduce((s, g) => s + g.score, 0) / games.length);
  const medal = score >= 85 ? 'gold' : score >= 65 ? 'silver' : score >= 40 ? 'bronze' : 'none';
  const title =
    medal === 'gold'
      ? 'Ace flight director'
      : medal === 'silver'
        ? 'Steady hands'
        : medal === 'bronze'
          ? 'Mission specialist'
          : 'Trainee';
  return { score, medal, title, games };
}
