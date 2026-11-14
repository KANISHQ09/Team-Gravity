import { useState } from 'react';
import { catalog } from '@gravity/engine';
import { TEAM_ADJECTIVES, TEAM_NOUNS } from '@gravity/shared';
import { Button, Card, StatusBadge } from '../../components/ui.tsx';
import {
  fetchLeaderboard,
  type LeaderboardEntry,
  onlineConfigured,
  submitScore,
} from '../../lib/api.ts';
import { DIFFICULTY_LABEL, fmt } from '../../lib/format.ts';
import { useGame } from '../../store/game.ts';
import { MissionReplay } from '../replay/MissionReplay.tsx';
import { TradeSpaceChart } from '../trade-space/TradeSpaceChart.tsx';

/** Post-mission report: outcome, score, causes, suggestions (SRS-SCR-03…05). */
export function ReportScreen() {
  const result = useGame((s) => s.result);
  const redesign = useGame((s) => s.redesign);
  const go = useGame((s) => s.go);
  const history = useGame((s) => s.history);
  const pilot = useGame((s) => s.pilot);
  if (!result) return null;
  const { run, report } = result;
  const currentId =
    history.findLast((h) => h.design === run.design || h.id.endsWith(`-${run.seed}`))?.id ?? null;
  const scenario = catalog.scenarios.find((s) => s.id === run.design.scenarioId)!;
  const b = report.breakdown;
  const parts = [
    b.performance,
    b.science,
    b.efficiency,
    b.decisions,
    ...(b.collaboration ? [b.collaboration] : []),
  ];
  const names = [
    'Mission performance',
    'Science value',
    'Resource efficiency',
    'Decision quality',
    'Team collaboration',
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-semibold">Mission report: {scenario.name}</h2>
        <StatusBadge
          status={run.outcome === 'full' ? 'green' : run.outcome === 'partial' ? 'yellow' : 'red'}
          label={
            run.outcome === 'full'
              ? 'Full success'
              : run.outcome === 'partial'
                ? 'Partial success'
                : 'Failure'
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-3">
          <p className="text-4xl font-bold">
            {report.total}
            <span className="text-lg font-normal text-slate-400"> / 100</span>
          </p>
          <p className="text-sm text-slate-400">
            {DIFFICULTY_LABEL[run.design.difficulty]} multiplier ×{report.multiplier}
            {report.raw > 100 ? ` (raw ${report.raw})` : ''}
            {!b.collaboration &&
              ' · solo play: the 15 team points are shared across the other four parts'}
          </p>
          <table className="w-full text-sm">
            <tbody>
              {parts.map((p, i) => (
                <tr key={names[i]} className="border-t border-slate-800">
                  <th scope="row" className="py-1.5 pr-2 text-left font-medium">
                    {names[i]}
                  </th>
                  <td className="py-1.5 pr-2 text-right">
                    {p.points} / {p.max}
                  </td>
                  <td className="py-1.5 text-slate-400">{p.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <div className="space-y-3">
          <MissionReplay
            target={scenario.body}
            transferShare={0}
            progress={1}
            failed={!!run.failurePhase && run.failurePhase !== 'science'}
          />
          <ScienceChart
            samples={run.samples}
            baseline={run.baselineScience}
            threshold={run.thresholdScience}
          />
        </div>
      </div>

      {pilot && (
        <section
          aria-labelledby="pilot-heading"
          className="space-y-2 rounded-xl border border-amber-400/30 bg-gradient-to-br from-amber-950/40 to-black p-4"
        >
          <h3 id="pilot-heading" className="text-lg font-semibold">
            Pilot rating: {pilot.score}/100 · {pilot.title}
          </h3>
          <p className="text-sm text-slate-400">
            How well you flew the mission yourself. It is separate from the mission score above,
            which depends only on your design.
          </p>
          <ul className="space-y-1 text-sm">
            {pilot.games.map((g) => (
              <li
                key={g.id}
                className="flex flex-wrap justify-between gap-2 border-t border-white/5 pt-1"
              >
                <span>
                  <span className="font-medium">{g.label}</span>
                  {g.autopilot && <span className="text-slate-400"> (autopilot)</span>}
                  <span className="block text-xs text-slate-400">{g.summary}</span>
                </span>
                <span className="font-mono">{g.score}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="why-heading" className="space-y-2">
        <h3 id="why-heading" className="text-lg font-semibold">
          Why it turned out this way
        </h3>
        <ul className="list-disc space-y-1 pl-5">
          {report.causes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="try-heading" className="space-y-2">
        <h3 id="try-heading" className="text-lg font-semibold">
          Try changing…
        </h3>
        <ul className="space-y-2">
          {report.suggestions.map((s) => (
            <li key={s.text} className="flex flex-wrap items-center gap-2">
              <span>{s.text}</span>
              {s.edit && (
                <Button variant="primary" onClick={() => redesign(s.edit)}>
                  Apply and redesign
                </Button>
              )}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button onClick={() => redesign()}>Edit the design and fly again</Button>
          <Button variant="ghost" onClick={() => go('home')}>
            New mission
          </Button>
        </div>
      </section>

      <section aria-labelledby="goals-heading" className="space-y-2">
        <h3 id="goals-heading" className="text-lg font-semibold">
          Science goals
        </h3>
        <ul className="space-y-1">
          {run.goalScience.map((g) => (
            <li key={g.goalId} className="flex items-center gap-2">
              <StatusBadge status={g.met ? 'green' : 'red'} label={g.met ? 'Met' : 'Not met'} />
              {g.title}: {fmt(g.science)} points
            </li>
          ))}
        </ul>
        {run.descopedInstruments.length > 0 && (
          <p className="text-sm text-amber-200">
            Removed after a budget cut: {run.descopedInstruments.join(', ')}.
          </p>
        )}
      </section>

      {report.analogs.length > 0 && (
        <section aria-labelledby="analogs-heading" className="space-y-2">
          <h3 id="analogs-heading" className="text-lg font-semibold">
            Real NASA missions like yours
          </h3>
          <ul className="grid gap-3 md:grid-cols-2">
            {report.analogs.map((an) => (
              <li key={an.id}>
                <Card>
                  <a
                    href={an.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-sky-300 underline"
                  >
                    {an.name} ({an.launchYear})
                  </a>
                  <p className="mt-1 text-sm text-slate-300">{an.summary}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Source: NASA Science (opens in a new tab)
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="trade-heading" className="space-y-2">
        <h3 id="trade-heading" className="text-lg font-semibold">
          Trade space: compare your designs
        </h3>
        <TradeSpaceChart scenarioId={run.design.scenarioId} currentId={currentId} />
      </section>

      <Leaderboard />
    </div>
  );
}

function ScienceChart({
  samples,
  baseline,
  threshold,
}: {
  samples: readonly { day: number; science: number }[];
  baseline: number;
  threshold: number;
}) {
  if (samples.length < 2) return null;
  const maxDay = samples.at(-1)!.day;
  const maxSci = Math.max(baseline * 1.1, samples.at(-1)!.science);
  const x = (d: number) => 30 + (d / maxDay) * 360;
  const y = (s: number) => 150 - (s / maxSci) * 130;
  const points = samples.map((s) => `${x(s.day)},${y(s.science)}`).join(' ');
  return (
    <svg
      viewBox="0 0 400 170"
      role="img"
      aria-label={`Science over time: ${Math.round(samples.at(-1)!.science)} points by day ${maxDay}, Baseline ${baseline}.`}
      className="w-full max-w-xl rounded-lg border border-slate-700 bg-slate-950"
    >
      <line
        x1={30}
        x2={390}
        y1={y(baseline)}
        y2={y(baseline)}
        stroke="#34d399"
        strokeDasharray="4 3"
      />
      <text x={392} y={y(baseline) - 3} textAnchor="end" fontSize="10" fill="#34d399">
        Baseline
      </text>
      <line
        x1={30}
        x2={390}
        y1={y(threshold)}
        y2={y(threshold)}
        stroke="#fbbf24"
        strokeDasharray="4 3"
      />
      <text x={392} y={y(threshold) - 3} textAnchor="end" fontSize="10" fill="#fbbf24">
        Threshold
      </text>
      <polyline points={points} fill="none" stroke="#38bdf8" strokeWidth={2} />
      <text x={30} y={165} fontSize="10" fill="#94a3b8">
        Day 0
      </text>
      <text x={390} y={165} fontSize="10" fill="#94a3b8" textAnchor="end">
        Day {maxDay}
      </text>
    </svg>
  );
}

function Leaderboard() {
  const result = useGame((s) => s.result);
  const players = useGame((s) => s.players);
  const [adj, setAdj] = useState<string>(TEAM_ADJECTIVES[0]);
  const [noun, setNoun] = useState<string>(TEAM_NOUNS[0]);
  const [status, setStatus] = useState<string | null>(null);
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  if (!result) return null;
  if (!onlineConfigured) {
    return (
      <p className="text-sm text-slate-400">
        Leaderboard: offline (no server configured). Your mission and score stay on this device.
      </p>
    );
  }
  const { design } = result.run;
  const submit = async () => {
    setStatus('Submitting…');
    try {
      const r = await submitScore({
        design,
        seed: result.run.seed,
        teamName: `${adj} ${noun}`,
        playerCount: Math.max(1, players.length),
      });
      setStatus(`Submitted. The server recomputed your score: ${r.total} (rank ${r.rank}).`);
      setEntries((await fetchLeaderboard(design.scenarioId, design.difficulty)).entries);
    } catch (e) {
      setStatus(`Could not reach the leaderboard: ${(e as Error).message}`);
    }
  };
  return (
    <section aria-labelledby="lb-heading" className="space-y-2">
      <h3 id="lb-heading" className="text-lg font-semibold">
        Leaderboard
      </h3>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="block text-slate-400">Team name</span>
          <select
            value={adj}
            onChange={(e) => setAdj(e.target.value)}
            className="rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5"
          >
            {TEAM_ADJECTIVES.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="sr-only">Team noun</span>
          <select
            value={noun}
            onChange={(e) => setNoun(e.target.value)}
            className="rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5"
          >
            {TEAM_NOUNS.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <Button onClick={() => void submit()}>Submit score</Button>
      </div>
      {status && (
        <p role="status" className="text-sm text-slate-300">
          {status}
        </p>
      )}
      {entries && (
        <ol className="list-decimal pl-6 text-sm">
          {entries.map((e) => (
            <li key={`${e.rank}-${e.teamName}`}>
              {e.teamName}: {e.total} ({e.playerCount} player{e.playerCount > 1 ? 's' : ''})
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
