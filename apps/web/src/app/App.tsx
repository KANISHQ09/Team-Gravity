import { Component, type ErrorInfo, type ReactNode, useEffect, useState } from 'react';
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
  // The phone menu belongs to the screen it was opened on, so any screen change closes it.
  const [menuFor, setMenuFor] = useState<Screen | null>(null);
  const menuOpen = menuFor === screen;
  const setMenuOpen = (open: boolean | ((o: boolean) => boolean)) =>
    setMenuFor((typeof open === 'function' ? open(menuOpen) : open) ? screen : null);

  // Close the phone menu on Escape (picking an item closes it too).
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuFor(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  // A distinct page title per screen helps screen-reader and tab users know where they are.
  useEffect(() => {
    const names: Record<Screen, string> = {
      home: 'Missions',
      mission: 'Design your mission',
      flight: 'Mission in flight',
      report: 'Mission report',
      glossary: 'Glossary',
      about: 'About',
    };
    document.title = `${names[screen]} · GRAVITY`;
  }, [screen]);

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

  const isHome = view.type === Home;

  return (
    <div className="min-h-screen bg-black text-slate-100">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-orange-500 focus:px-3 focus:py-2 focus:text-black"
      >
        Skip to content
      </a>
      <header
        className={cx(
          'z-40 w-full',
          isHome
            ? 'absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 to-transparent'
            : 'sticky top-0 border-b border-white/10 bg-black/95 backdrop-blur',
        )}
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-4">
          <button
            type="button"
            onClick={() => go('home')}
            className="flex items-center gap-2 text-xl font-black tracking-[0.25em] text-white"
          >
            <img src="/icon.svg" alt="" className="h-8 w-8" />
            GRAVITY
          </button>
          <nav aria-label="Main" className="hidden md:block">
            <ul className="flex flex-wrap gap-1">
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
          {/* Phones and small tablets: a hamburger menu. */}
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-black/60 text-white md:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span aria-hidden="true" className="relative block h-3.5 w-5">
              <span
                className={cx(
                  'absolute left-0 h-0.5 w-5 rounded bg-current transition',
                  menuOpen ? 'top-1.5 rotate-45' : 'top-0',
                )}
              />
              <span
                className={cx(
                  'absolute left-0 top-1.5 h-0.5 w-5 rounded bg-current transition',
                  menuOpen && 'opacity-0',
                )}
              />
              <span
                className={cx(
                  'absolute left-0 h-0.5 w-5 rounded bg-current transition',
                  menuOpen ? 'top-1.5 -rotate-45' : 'top-3',
                )}
              />
            </span>
          </button>
        </div>
        {menuOpen && (
          <nav
            id="mobile-menu"
            aria-label="Main menu"
            className="border-t border-white/10 bg-black/95 px-4 pb-5 pt-2 backdrop-blur md:hidden"
          >
            <ul className="space-y-1">
              {[
                ...(hasMission ? [{ screen: 'mission' as Screen, label: 'Current mission' }] : []),
                ...NAV,
              ].map((n) => (
                <li key={n.screen}>
                  <button
                    type="button"
                    aria-current={screen === n.screen ? 'page' : undefined}
                    onClick={() => {
                      go(n.screen);
                      setMenuOpen(false);
                    }}
                    className={cx(
                      'flex w-full items-center justify-between rounded-xl px-4 py-3.5 text-left text-base font-bold uppercase tracking-[0.2em]',
                      screen === n.screen ? 'bg-white text-black' : 'text-white hover:bg-white/10',
                    )}
                  >
                    {n.label}
                    <span aria-hidden="true">→</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>
      <main id="content" className={isHome ? '' : 'mx-auto max-w-7xl px-4 py-8'}>
        <ErrorBoundary>{view}</ErrorBoundary>
      </main>
      <footer className="border-t border-white/10 bg-black">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 text-sm md:grid-cols-[2fr_1fr_1fr]">
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-lg font-black tracking-[0.25em] text-white">
              <img src="/icon.svg" alt="" className="h-7 w-7" />
              GRAVITY
            </p>
            <p className="max-w-sm text-slate-400">
              A space mission design game for students, teachers and anyone curious about how
              missions really get built.
            </p>
          </div>
          <nav aria-label="Footer" className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              Explore
            </p>
            <ul className="space-y-1">
              {NAV.map((n) => (
                <li key={n.screen}>
                  <button
                    type="button"
                    onClick={() => go(n.screen)}
                    className="text-slate-300 hover:text-white hover:underline"
                  >
                    {n.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              Project
            </p>
            <p className="text-slate-400">
              Team Gravity · NASA Space Apps Challenge 2026 · MIT licence
            </p>
          </div>
        </div>
        <p className="border-t border-white/10 px-4 py-4 text-center text-xs text-slate-400">
          Independent project created for the NASA Space Apps Challenge; not a NASA product.
          Background video: AI-generated.
        </p>
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
        'rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em]',
        active ? 'bg-white text-black' : 'text-slate-200 hover:bg-white/10',
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
