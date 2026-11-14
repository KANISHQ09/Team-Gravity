import { Button } from '../../components/ui.tsx';
import { fmt } from '../../lib/format.ts';
import { type RunRecord, useGame } from '../../store/game.ts';

const RISK_TEXT = { green: 'low risk', yellow: 'medium risk', red: 'high risk' } as const;

/** Marker shape encodes risk, so the chart does not rely on colour alone. */
function Marker({
  x,
  y,
  risk,
  current,
}: {
  x: number;
  y: number;
  risk: RunRecord['risk'];
  current: boolean;
}) {
  const stroke = current ? '#f8fafc' : 'none';
  const sw = current ? 2 : 0;
  if (risk === 'green')
    return <circle cx={x} cy={y} r={6} fill="#34d399" stroke={stroke} strokeWidth={sw} />;
  if (risk === 'yellow') {
    return (
      <polygon
        points={`${x},${y - 7} ${x + 7},${y + 6} ${x - 7},${y + 6}`}
        fill="#fbbf24"
        stroke={stroke}
        strokeWidth={sw}
      />
    );
  }
  return (
    <rect
      x={x - 6}
      y={y - 6}
      width={12}
      height={12}
      fill="#fb7185"
      stroke={stroke}
      strokeWidth={sw}
    />
  );
}

/** Trade space: every run of this scenario, cost vs science, marker = risk (SRS-TRD-01). */
export function TradeSpaceChart({
  scenarioId,
  currentId,
}: {
  scenarioId: string;
  currentId: string | null;
}) {
  const history = useGame((s) => s.history).filter((h) => h.scenarioId === scenarioId);
  const loadDesign = useGame((s) => s.loadDesign);
  if (history.length < 2) {
    return (
      <p className="text-sm text-slate-400">
        Fly this mission again with a different design to compare them here: cost against science,
        with risk shown by the marker shape.
      </p>
    );
  }
  const maxCost = Math.max(...history.map((h) => h.costM)) * 1.1;
  const maxSci = Math.max(...history.map((h) => h.science)) * 1.1 || 1;
  const x = (c: number) => 40 + (c / maxCost) * 340;
  const y = (s: number) => 160 - (s / maxSci) * 140;

  return (
    <div className="space-y-2">
      <svg
        viewBox="0 0 400 190"
        role="img"
        aria-label={`Trade space with ${history.length} runs. Details in the table below.`}
        className="w-full max-w-xl rounded-lg border border-slate-700 bg-slate-950"
      >
        <line x1={40} y1={160} x2={390} y2={160} stroke="#475569" />
        <line x1={40} y1={10} x2={40} y2={160} stroke="#475569" />
        <text x={215} y={182} textAnchor="middle" fontSize="11" fill="#94a3b8">
          Cost (M$) →
        </text>
        <text
          x={12}
          y={90}
          fontSize="11"
          fill="#94a3b8"
          transform="rotate(-90 12 90)"
          textAnchor="middle"
        >
          Science →
        </text>
        {history.map((h) => (
          <g key={h.id}>
            <Marker x={x(h.costM)} y={y(h.science)} risk={h.risk} current={h.id === currentId} />
            <text x={x(h.costM) + 9} y={y(h.science) + 4} fontSize="10" fill="#cbd5e1">
              {h.label}
            </text>
          </g>
        ))}
      </svg>
      <p className="text-xs text-slate-400">
        ● low risk · ▲ medium risk · ■ high risk · outlined = this run. Best designs sit top-left:
        more science for less money.
      </p>
      <table className="w-full text-left text-sm">
        <thead className="text-slate-400">
          <tr>
            <th className="py-1 pr-3">Run</th>
            <th className="py-1 pr-3 text-right">Cost</th>
            <th className="py-1 pr-3 text-right">Science</th>
            <th className="py-1 pr-3 text-right">Score</th>
            <th className="py-1 pr-3">Risk</th>
            <th className="py-1">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {history.map((h) => (
            <tr key={h.id} className="border-t border-slate-800">
              <td className="py-1 pr-3">
                {h.label}
                {h.id === currentId && ' (this run)'}
              </td>
              <td className="py-1 pr-3 text-right">{fmt(h.costM, 1)} M$</td>
              <td className="py-1 pr-3 text-right">{fmt(h.science)}</td>
              <td className="py-1 pr-3 text-right">{h.total}</td>
              <td className="py-1 pr-3">{RISK_TEXT[h.risk]}</td>
              <td className="py-1 text-right">
                {h.id !== currentId && (
                  <Button
                    variant="ghost"
                    onClick={() => loadDesign(h.design)}
                    aria-label={`Load the design of ${h.label}`}
                  >
                    Load design
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
