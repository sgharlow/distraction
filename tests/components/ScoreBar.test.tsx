import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScoreBar } from '@/components/ScoreBar';

describe('ScoreBar', () => {
  it('renders the label', () => {
    render(<ScoreBar label="Election Integrity" value={3} color="damage" />);
    expect(screen.getByText('Election Integrity')).toBeInTheDocument();
  });

  it('renders the score value', () => {
    render(<ScoreBar label="Test" value={3.5} color="damage" />);
    expect(screen.getByText('3.5/5')).toBeInTheDocument();
  });

  it('clamps value to max', () => {
    render(<ScoreBar label="Test" value={8} max={5} color="damage" />);
    expect(screen.getByText('5.0/5')).toBeInTheDocument();
  });

  it('clamps negative values to 0', () => {
    render(<ScoreBar label="Test" value={-3} color="damage" />);
    expect(screen.getByText('0.0/5')).toBeInTheDocument();
  });

  it('renders weight when provided', () => {
    render(<ScoreBar label="Test" value={3} color="damage" weight={0.22} />);
    expect(screen.getByText(/0.22/)).toBeInTheDocument();
  });

  it('does not render weight when not provided', () => {
    const { container } = render(<ScoreBar label="Test" value={3} color="damage" />);
    // The multiplication sign should not be present
    expect(container.textContent).not.toContain('\u00d7');
  });

  it('uses custom max', () => {
    render(<ScoreBar label="Test" value={75} max={100} color="distraction" />);
    expect(screen.getByText('75.0/100')).toBeInTheDocument();
  });

  it('renders with different color variants', () => {
    const { container: c1 } = render(<ScoreBar label="A" value={3} color="damage" />);
    const { container: c2 } = render(<ScoreBar label="B" value={3} color="distraction" />);
    const { container: c3 } = render(<ScoreBar label="C" value={3} color="noise" />);
    const { container: c4 } = render(<ScoreBar label="D" value={3} color="mixed" />);

    // Each should render without error
    expect(c1.querySelector('.bg-damage')).toBeTruthy();
    expect(c2.querySelector('.bg-distraction')).toBeTruthy();
    expect(c3.querySelector('.bg-noise')).toBeTruthy();
    expect(c4.querySelector('.bg-mixed')).toBeTruthy();
  });
});
