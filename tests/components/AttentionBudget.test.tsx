import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AttentionBudget } from '@/components/AttentionBudget';

describe('AttentionBudget', () => {
  it('shows DISTRACTION label when B - A > 30', () => {
    render(<AttentionBudget aScore={20} bScore={55} />);
    expect(screen.getByText(/DISTRACTION/)).toBeInTheDocument();
  });

  it('shows UNDERCOVERED label when B - A < -30', () => {
    render(<AttentionBudget aScore={60} bScore={20} />);
    expect(screen.getByText(/UNDERCOVERED/)).toBeInTheDocument();
  });

  it('shows BALANCED label for values in between', () => {
    render(<AttentionBudget aScore={40} bScore={40} />);
    expect(screen.getByText(/BALANCED/)).toBeInTheDocument();
  });

  it('handles null scores by treating them as 0', () => {
    render(<AttentionBudget aScore={null} bScore={null} />);
    // 0 - 0 = 0, should be BALANCED
    expect(screen.getByText(/BALANCED/)).toBeInTheDocument();
  });

  it('shows positive sign for positive budget', () => {
    render(<AttentionBudget aScore={10} bScore={50} />);
    expect(screen.getByText(/\+40/)).toBeInTheDocument();
  });
});
