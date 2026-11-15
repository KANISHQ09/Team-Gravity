import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { BALANCE_DESIGNS } from '../../../../packages/engine/tests/fixtures/designs.ts';
import { decodeDesign, encodeDesign, useGame } from '../store/game.ts';
import { App } from './App.tsx';

const lunar = BALANCE_DESIGNS['lunar-orbiter']![0]!.design;
const initial = useGame.getState();

beforeEach(() => {
  localStorage.clear();
  useGame.setState(initial, true);
});

describe('App shell', () => {
  it('renders the GRAVITY heading and the NASA disclaimer', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'GRAVITY' })).toBeInTheDocument();
    expect(screen.getByText(/not a NASA product/i)).toBeInTheDocument();
  });

  it('shows online multiplayer as coming soon when no game server is configured', () => {
    render(<App />);
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
    expect(screen.getByText(/Online multiplayer is coming soon/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create room' })).not.toBeInTheDocument();
  });

  it('opens the phone menu, navigates, and closes it', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const menu = screen.getByRole('navigation', { name: 'Main menu' });
    fireEvent.click(within(menu).getByRole('button', { name: /Glossary/ }));
    expect(screen.getByRole('heading', { name: 'Glossary' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main menu' })).not.toBeInTheDocument();
    // Escape closes it too.
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('navigation', { name: 'Main menu' })).not.toBeInTheDocument();
  });

  it('offers the three MVP scenarios and starts a mission at stage 1', () => {
    render(<App />);
    expect(
      screen.getByRole('button', { name: 'Start CubeSat Earth Observer' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Mars Orbiter' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start Lunar Orbiter' }));
    expect(screen.getByRole('heading', { name: 'Stage 1: Need & Goals' })).toBeInTheDocument();
    // Six live gauges are always visible.
    expect(screen.getAllByRole('meter')).toHaveLength(6);
  });

  it('exits the current mission only after confirming, keeping run history', () => {
    useGame.setState({ history: [] });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Start Lunar Orbiter' }));
    fireEvent.click(screen.getByRole('button', { name: 'Exit mission' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Exit this mission?' });
    // The safe choice has focus, and cancelling keeps the mission.
    expect(within(dialog).getByRole('button', { name: 'Keep playing' })).toHaveFocus();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep playing' }));
    expect(screen.getByRole('heading', { name: 'Stage 1: Need & Goals' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Exit mission' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, exit mission' }));
    expect(useGame.getState().design).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'GRAVITY' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Current mission' })).not.toBeInTheDocument();
  });

  it('analyses a design, auto-fixes it and goes to launch', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Start Lunar Orbiter' }));
    fireEvent.click(screen.getByRole('button', { name: 'Analyse my design' }));
    const panel = screen.getByRole('region', { name: 'Design analysis' });
    expect(within(panel).getByText('Launch blocked')).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: /Go to launch/ })).toBeDisabled();
    fireEvent.click(within(panel).getByRole('button', { name: 'Auto-fix my design' }));
    expect(await within(panel).findByText(/Auto-fix made \d+ changes/)).toBeInTheDocument();
    expect(within(panel).getByText('Ready to launch')).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: /Go to launch/ }));
    expect(screen.getByRole('heading', { name: 'Stage 6: Implement' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Launch mission' })).toBeInTheDocument();
  });

  it('updates the traceability matrix when a goal is selected (FR-02)', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Start Lunar Orbiter' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Find minerals and water ice/ }));
    const table = screen.getByRole('table');
    expect(within(table).getByText('spectroscopy')).toBeInTheDocument();
    expect(within(table).getByText('REQ-SCI-1')).toBeInTheDocument();
  });
});

describe('hot-seat co-op (FR-13a)', () => {
  it('turns edits outside your role into proposals the owner can accept', () => {
    const game = useGame.getState();
    game.startMission('lunar-orbiter', 'engineer', 2);
    // Player 1 is Mission Architect + Science Lead: a bus belongs to the Spacecraft Engineer.
    useGame.getState().edit({ type: 'addPart', partId: 'bus-medium', category: 'bus' });
    expect(useGame.getState().design?.partIds).toEqual([]);
    expect(useGame.getState().proposals).toHaveLength(1);
    // Player 1 cannot answer their own proposal.
    useGame.getState().respondToProposal(useGame.getState().proposals[0]!.id, true);
    expect(useGame.getState().design?.partIds).toEqual([]);
    useGame.getState().passDevice();
    useGame.getState().respondToProposal(useGame.getState().proposals[0]!.id, true);
    expect(useGame.getState().design?.partIds).toEqual(['bus-medium']);
    expect(useGame.getState().proposalsResolved).toBe(1);
  });
});

describe('full mission loop', () => {
  it('votes GO, launches, flies and shows a report with causes (AC-4)', () => {
    act(() => useGame.getState().loadDesign(lunar));
    act(() => useGame.getState().setStage('launch'));
    render(<App />);
    const launch = screen.getByRole('button', { name: 'Launch mission' });
    expect(launch).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'GO' }));
    expect(launch).toBeEnabled();
    fireEvent.click(launch);
    expect(screen.getByRole('heading', { name: /Mission in flight/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Skip to end' }));
    fireEvent.click(screen.getByRole('button', { name: 'See the mission report' }));
    expect(
      screen.getByRole('heading', { name: /Mission report: Lunar Orbiter/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Why it turned out this way' })).toBeInTheDocument();
    expect(screen.getAllByText(/^Because /).length).toBeGreaterThanOrEqual(3);
    expect(screen.getByRole('link', { name: /Lunar Reconnaissance Orbiter/ })).toHaveAttribute(
      'href',
      'https://science.nasa.gov/mission/lro/',
    );
  });

  it('blocks launch with a reason when the rocket is too small (AC-3)', () => {
    act(() => useGame.getState().loadDesign({ ...lunar, launchVehicleId: 'lv-small' }));
    act(() => useGame.getState().setStage('launch'));
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Launch is blocked' })).toBeInTheDocument();
    expect(screen.getAllByText(/Over launch capacity by 834.0 kg/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Launch mission' })).toBeDisabled();
  });
});

describe('design codes (SRS-SAV-02)', () => {
  it('round-trips a design and rejects garbage', () => {
    expect(decodeDesign(encodeDesign(lunar))).toEqual(lunar);
    expect(decodeDesign('not-a-code')).toBeNull();
  });
});

describe('trade space and sensitivity (FR-19)', () => {
  it('compares runs of the same scenario after a second launch', () => {
    act(() => useGame.getState().loadDesign(lunar));
    act(() => useGame.getState().launch());
    act(() => useGame.getState().redesign({ type: 'setGroundStations', count: 2 }));
    act(() => useGame.getState().launch());
    act(() => useGame.getState().go('report'));
    render(<App />);
    expect(screen.getByRole('heading', { name: /Trade space/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Trade space with 2 runs/ })).toBeInTheDocument();
    expect(screen.getByText('Run 2 (this run)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load the design of Run 1' })).toBeInTheDocument();
  });

  it('ranks single changes on the Build & Verify stage and applies one', () => {
    act(() => useGame.getState().loadDesign(lunar));
    act(() => useGame.getState().setStage('verify'));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Run what-if analysis' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply: Use 2 ground stations' }));
    expect(useGame.getState().design?.groundStations).toBe(2);
  });
});
