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

  // Backward compatibility — new props default to false
  it('does not show labels or severity by default', () => {
    render(<DualScore aScore={50} bScore={30} />);
    expect(screen.queryByText('Constitutional Damage')).not.toBeInTheDocument();
    expect(screen.queryByText('Media Hype')).not.toBeInTheDocument();
    expect(screen.queryByText('Significant')).not.toBeInTheDocument();
  });

  // showLabels prop
  it('renders "Constitutional Damage" and "Media Hype" when showLabels is true', () => {
    render(<DualScore aScore={50} bScore={30} showLabels />);
    expect(screen.getByText('Constitutional Damage')).toBeInTheDocument();
    expect(screen.getByText('Media Hype')).toBeInTheDocument();
  });

  // showSeverity prop — each threshold band
  it('renders severity label "Critical" for score >= 70', () => {
    render(<DualScore aScore={75} bScore={80} showSeverity />);
    const criticals = screen.getAllByText('Critical');
    expect(criticals).toHaveLength(2);
  });

  it('renders severity label "Significant" for score >= 50', () => {
    render(<DualScore aScore={55} bScore={60} showSeverity />);
    const significants = screen.getAllByText('Significant');
    expect(significants).toHaveLength(2);
  });

  it('renders severity label "Moderate" for score >= 30', () => {
    render(<DualScore aScore={35} bScore={40} showSeverity />);
    const moderates = screen.getAllByText('Moderate');
    expect(moderates).toHaveLength(2);
  });

  it('renders severity label "Low" for score < 30', () => {
    render(<DualScore aScore={10} bScore={20} showSeverity />);
    const lows = screen.getAllByText('Low');
    expect(lows).toHaveLength(2);
  });

  it('does not render severity for null scores even when showSeverity is true', () => {
    render(<DualScore aScore={null} bScore={null} showSeverity />);
    expect(screen.queryByText('Low')).not.toBeInTheDocument();
    expect(screen.queryByText('Moderate')).not.toBeInTheDocument();
  });
});
