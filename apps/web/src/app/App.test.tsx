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
