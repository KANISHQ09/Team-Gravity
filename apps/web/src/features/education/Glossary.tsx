import { useMemo, useState } from 'react';
import { catalog } from '@gravity/engine';
import { cx } from '../../lib/format.ts';

type Topic = 'orbits' | 'spacecraft' | 'communications' | 'mission';

const TOPICS: Record<Topic, { label: string; icon: string; blurb: string }> = {
  orbits: { label: 'Orbits & motion', icon: '🛰️', blurb: 'Where you fly and how you get there' },
  spacecraft: { label: 'Spacecraft', icon: '🔧', blurb: 'What the craft is made of' },
  communications: { label: 'Communications', icon: '📡', blurb: 'Getting data home' },
  mission: { label: 'Mission process', icon: '📋', blurb: 'How real teams plan and decide' },
};

/** Which topic each glossary term belongs to (presentation only; terms live in the catalog). */
const TERM_TOPIC: Record<string, Topic> = {
  'Δv (delta-v)': 'orbits',
  'Specific impulse (Isp)': 'orbits',
  'Low Earth orbit (LEO)': 'orbits',
  'Sun-synchronous orbit (SSO)': 'orbits',
  'Geostationary orbit (GEO)': 'orbits',
  Eclipse: 'orbits',
  'Launch period': 'orbits',
  Bus: 'spacecraft',
  Payload: 'spacecraft',
  'Radiation-hardened (rad-hard)': 'spacecraft',
  Reliability: 'spacecraft',
  'Data recorder': 'communications',
  Downlink: 'communications',
  'Link margin': 'communications',
  Margin: 'mission',
  'ConOps (Concept of Operations)': 'mission',
  'Science Traceability Matrix': 'mission',
  'Master Equipment List (MEL)': 'mission',
  'Baseline and Threshold': 'mission',
  'Concept Maturity Level (CML)': 'mission',
};

export function Glossary() {
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState<Topic | 'all'>('all');

  const terms = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.glossary
      .map((g) => ({ ...g, topic: TERM_TOPIC[g.term] ?? 'mission' }))
      .filter((g) => topic === 'all' || g.topic === topic)
      .filter(
        (g) => !q || g.term.toLowerCase().includes(q) || g.definition.toLowerCase().includes(q),
      )
      .sort((a, b) => a.term.localeCompare(b.term));
  }, [query, topic]);

  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(ellipse_at_top_right,#1e3a5f_0%,#000_65%)] p-6 md:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-400">
          Speak like mission control
        </p>
        <h2 className="mt-2 text-4xl font-black uppercase tracking-tight md:text-5xl">Glossary</h2>
        <p className="mt-3 max-w-2xl text-slate-300">
          {catalog.glossary.length} words you will meet while designing and flying your mission,
          explained in plain language.
        </p>
        <div className="mt-6 max-w-xl">
          <label htmlFor="glossary-search" className="sr-only">
            Search the glossary
          </label>
          <input
            id="glossary-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a word, e.g. orbit, battery, margin"
            className="w-full rounded-full border border-white/20 bg-black/60 px-5 py-3 text-sm text-white placeholder:text-slate-500 focus:border-orange-400 focus:outline-none"
          />
        </div>
      </header>

      <div role="group" aria-label="Filter by topic" className="flex flex-wrap gap-2">
        {(['all', ...Object.keys(TOPICS)] as (Topic | 'all')[]).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={topic === t}
            onClick={() => setTopic(t)}
            className={cx(
              'rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-widest transition',
              topic === t
                ? 'border-white bg-white text-black'
                : 'border-white/20 text-slate-200 hover:border-white/60',
            )}
          >
            {t === 'all' ? 'All topics' : `${TOPICS[t].icon} ${TOPICS[t].label}`}
          </button>
        ))}
      </div>

      <p aria-live="polite" className="text-sm text-slate-400">
        {terms.length === 0
          ? 'No words match your search.'
          : `${terms.length} word${terms.length === 1 ? '' : 's'}`}
      </p>

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {terms.map((g) => (
          <li
            key={g.term}
            className="group flex flex-col gap-2 rounded-xl border border-white/10 bg-gradient-to-b from-slate-900 to-black p-5 transition hover:border-orange-400/60"
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-orange-400">
              <span aria-hidden="true">{TOPICS[g.topic].icon} </span>
              {TOPICS[g.topic].label}
            </span>
            <h3 className="text-lg font-black tracking-tight text-white">{g.term}</h3>
            <p className="text-sm leading-relaxed text-slate-300">{g.definition}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
