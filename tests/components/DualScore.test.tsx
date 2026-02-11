import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DualScore } from '@/components/DualScore';

describe('DualScore', () => {
  it('renders A and B labels', () => {
    render(<DualScore aScore={50} bScore={30} />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('renders formatted score values', () => {
    render(<DualScore aScore={50} bScore={30} />);
    expect(screen.getByText('50.0')).toBeInTheDocument();
    expect(screen.getByText('30.0')).toBeInTheDocument();
  });

  it('renders em dash for null A score', () => {
    render(<DualScore aScore={null} bScore={30} />);
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('renders em dash for null B score', () => {
    render(<DualScore aScore={50} bScore={null} />);
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('renders both null scores as em dashes', () => {
    render(<DualScore aScore={null} bScore={null} />);
    const dashes = screen.getAllByText('—');
    expect(dashes).toHaveLength(2);
  });

  it('renders without crashing in large size', () => {
    const { container } = render(<DualScore aScore={50} bScore={30} size="lg" />);
    expect(container.firstChild).toBeTruthy();
  });
});
