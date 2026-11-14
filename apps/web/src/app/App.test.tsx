import { render, screen } from '@testing-library/react';
import { App } from './App.tsx';

describe('App shell', () => {
  it('renders the GRAVITY heading', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'GRAVITY' })).toBeInTheDocument();
  });

  it('shows the NASA disclaimer', () => {
    render(<App />);
    expect(screen.getByText(/not a NASA product/i)).toBeInTheDocument();
  });
});
