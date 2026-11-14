import { act, cleanup, render } from '@testing-library/react';
import axe from 'axe-core';
import { BALANCE_DESIGNS } from '../../../../packages/engine/tests/fixtures/designs.ts';
import { STAGES, type StageId, useGame } from '../store/game.ts';
import { App } from './App.tsx';

const lunar = BALANCE_DESIGNS['lunar-orbiter']![0]!.design;
const initial = useGame.getState();

/**
 * Automated WCAG checks with axe-core on every screen (SRS-TST accessibility).
 * Colour contrast is excluded because jsdom cannot compute rendered colours;
 * it is checked manually and with Lighthouse in a real browser.
 */
async function violations(container: HTMLElement) {
  const result = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
    rules: {
      'color-contrast': { enabled: false },
      // The test renders App without the surrounding <html> document landmarks.
      region: { enabled: false },
    },
  });
  return result.violations.map(
    (v) => `${v.id}: ${v.help} (${v.nodes.length}×) ${v.nodes[0]?.html.slice(0, 120) ?? ''}`,
  );
}

beforeEach(() => {
  localStorage.clear();
  useGame.setState(initial, true);
});
afterEach(() => cleanup());

// axe walks the whole DOM; the larger landing page needs more than the 5 s default.
vi.setConfig({ testTimeout: 30_000 });

describe('accessibility (axe-core)', () => {
  it('home screen has no violations', async () => {
    const { container } = render(<App />);
    expect(await violations(container)).toEqual([]);
  });

  for (const stage of STAGES.map((s) => s.id) as StageId[]) {
    it(`mission stage "${stage}" has no violations`, async () => {
      act(() => useGame.getState().loadDesign(lunar));
      act(() => useGame.getState().setStage(stage));
      const { container } = render(<App />);
      expect(await violations(container)).toEqual([]);
    });
  }

  it('flight and report screens have no violations', async () => {
    act(() => useGame.getState().loadDesign(lunar));
    act(() => useGame.getState().launch());
    const flight = render(<App />);
    expect(await violations(flight.container)).toEqual([]);
    flight.unmount();
    act(() => useGame.getState().go('report'));
    const report = render(<App />);
    expect(await violations(report.container)).toEqual([]);
  });

  it('glossary and about pages have no violations', async () => {
    for (const screen of ['glossary', 'about'] as const) {
      act(() => useGame.getState().go(screen));
      const { container, unmount } = render(<App />);
      expect(await violations(container)).toEqual([]);
      unmount();
    }
  });
});

describe('axe check itself', () => {
  it('does catch real problems (guards against a silently passing check)', async () => {
    const { container } = render(
      <div>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- intentionally broken, to prove axe catches it */}
        <img src="x.png" />
        <button type="button" />
      </div>,
    );
    const found = await violations(container);
    expect(found.some((v) => v.startsWith('image-alt'))).toBe(true);
    expect(found.some((v) => v.startsWith('button-name'))).toBe(true);
  });
});
