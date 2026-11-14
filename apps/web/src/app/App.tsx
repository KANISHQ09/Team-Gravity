import { Component, type ErrorInfo, type ReactNode } from 'react';
import { About } from '../features/education/About.tsx';
import { Glossary } from '../features/education/Glossary.tsx';
import { ReportScreen } from '../features/report/ReportScreen.tsx';
import { Home } from '../features/scenarios/Home.tsx';
import { FlightScreen } from '../features/simulation/FlightScreen.tsx';
import { cx } from '../lib/format.ts';
import { type Screen, useGame } from '../store/game.ts';
import { MissionLayout } from './MissionLayout.tsx';

const NAV: { screen: Screen; label: string }[] = [
  { screen: 'home', label: 'Missions' },
  { screen: 'glossary', label: 'Glossary' },
  { screen: 'about', label: 'About' },
];

export function App() {
  const screen = useGame((s) => s.screen);
  const go = useGame((s) => s.go);
  const hasMission = useGame((s) => s.design !== null);
  const hasResult = useGame((s) => s.result !== null);

  const view =
    screen === 'mission' && hasMission ? (
      <MissionLayout />
    ) : screen === 'flight' && hasResult ? (
      <FlightScreen />
    ) : screen === 'report' && hasResult ? (
      <ReportScreen />
    ) : screen === 'glossary' ? (
      <Glossary />
    ) : screen === 'about' ? (
      <About />
    ) : (
      <Home />
    );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:rounded focus:bg-sky-500 focus:px-3 focus:py-2 focus:text-slate-950"
      >
        Skip to content
      </a>
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <button
            type="button"
            onClick={() => go('home')}
            className="text-xl font-bold tracking-widest"
          >
            GRAVITY
          </button>
          <nav aria-label="Main">
            <ul className="flex gap-1">
              {hasMission && (
                <li>
                  <NavButton active={screen === 'mission'} onClick={() => go('mission')}>
                    Current mission
                  </NavButton>
                </li>
              )}
              {NAV.map((n) => (
                <li key={n.screen}>
                  <NavButton active={screen === n.screen} onClick={() => go(n.screen)}>
                    {n.label}
                  </NavButton>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main id="content" className="mx-auto max-w-7xl px-4 py-6">
        <ErrorBoundary>{view}</ErrorBoundary>
      </main>
      <footer className="border-t border-slate-800 px-4 py-4 text-center text-xs text-slate-400">
        Independent project created for the NASA Space Apps Challenge; not a NASA product.
      </footer>
    </div>
  );
}

function NavButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
      className={cx(
        'rounded-md px-3 py-1.5 text-sm',
        active ? 'bg-slate-800 text-sky-200' : 'text-slate-300 hover:bg-slate-800',
      )}
    >
      {children}
    </button>
  );
}

/** Top-level error boundary: the design is autosaved, so a reload restores it (SRS-ERR). */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('GRAVITY crashed', error, info.componentStack);
  }
  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        role="alert"
        className="mx-auto max-w-lg space-y-3 rounded-lg border border-rose-500 bg-rose-950/50 p-6"
      >
        <h2 className="text-xl font-semibold">Something went wrong</h2>
        <p className="text-slate-300">
          Your design was saved automatically. Reload the page to continue where you left off.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md bg-sky-500 px-3 py-2 text-slate-950"
        >
          Reload
        </button>
      </div>
    );
  }
}
