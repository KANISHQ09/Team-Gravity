import type { Body } from '@gravity/shared';

const BODY_STYLE: Record<Body, { fill: string; r: number; label: string }> = {
  earth: { fill: '#3b82f6', r: 26, label: 'Earth' },
  moon: { fill: '#9ca3af', r: 14, label: 'Moon' },
  mars: { fill: '#c2410c', r: 18, label: 'Mars' },
};

/**
 * 2D Mission Replay (FR-20): Earth → transfer → orbit around the target.
 * `progress` runs 0…1 across transfer and science operations.
 */
export function MissionReplay({
  target,
  transferShare,
  progress,
  failed,
}: {
  target: Body;
  /** Share of the timeline spent in transfer (0 for Earth orbit). */
  transferShare: number;
  progress: number;
  failed: boolean;
}) {
  const earthOnly = target === 'earth';
  const from = { x: 60, y: 120 };
  const to = earthOnly ? from : { x: 340, y: 120 };
  const t = BODY_STYLE[target];
  const orbitR = t.r + 18;

  let sc: { x: number; y: number };
  if (!earthOnly && progress < transferShare) {
    // Along a half-ellipse transfer arc.
    const f = transferShare > 0 ? progress / transferShare : 1;
    const angle = Math.PI * (1 - f);
    const cx = (from.x + to.x) / 2;
    const rx = (to.x - from.x) / 2;
    sc = { x: cx + rx * Math.cos(angle), y: 120 - 70 * Math.sin(angle) };
  } else {
    const f = earthOnly ? progress : (progress - transferShare) / Math.max(1e-6, 1 - transferShare);
    const angle = f * Math.PI * 2 * 24;
    sc = { x: to.x + orbitR * Math.cos(angle), y: to.y + orbitR * Math.sin(angle) };
  }

  const description = earthOnly
    ? `Spacecraft orbiting Earth, ${Math.round(progress * 100)}% through the mission.`
    : progress < transferShare
      ? `Spacecraft cruising from Earth to ${t.label}, ${Math.round((progress / Math.max(transferShare, 1e-6)) * 100)}% of the way.`
      : `Spacecraft in orbit around ${t.label}, ${Math.round(progress * 100)}% through the mission.`;

  return (
    <svg
      viewBox="0 0 400 220"
      role="img"
      aria-label={failed ? 'Mission replay: the mission ended early.' : description}
      className="w-full max-w-xl rounded-lg border border-slate-700 bg-slate-950"
    >
      {/* Stars (fixed positions) */}
      {[...Array(24)].map((_, i) => (
        <circle
          key={i}
          cx={(i * 97) % 400}
          cy={(i * 53) % 220}
          r={0.8}
          fill="#cbd5e1"
          opacity={0.5}
        />
      ))}
      {!earthOnly && (
        <path
          d={`M ${from.x} ${from.y} A ${(to.x - from.x) / 2} 70 0 0 1 ${to.x} ${to.y}`}
          fill="none"
          stroke="#475569"
          strokeDasharray="4 4"
        />
      )}
      <circle cx={from.x} cy={from.y} r={BODY_STYLE.earth.r} fill={BODY_STYLE.earth.fill} />
      <text x={from.x} y={from.y + 44} textAnchor="middle" fill="#cbd5e1" fontSize="11">
        Earth
      </text>
      {!earthOnly && (
        <>
          <circle cx={to.x} cy={to.y} r={t.r} fill={t.fill} />
          <text x={to.x} y={to.y + 44} textAnchor="middle" fill="#cbd5e1" fontSize="11">
            {t.label}
          </text>
        </>
      )}
      <circle cx={to.x} cy={to.y} r={orbitR} fill="none" stroke="#334155" />
      {!failed && <circle cx={sc.x} cy={sc.y} r={4} fill="#facc15" stroke="#fef08a" />}
      {failed && (
        <text x={200} y={30} textAnchor="middle" fill="#fda4af" fontSize="13">
          Mission ended early
        </text>
      )}
    </svg>
  );
}
