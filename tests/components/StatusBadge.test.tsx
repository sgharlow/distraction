import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '@/components/StatusBadge';

describe('StatusBadge', () => {
  it('renders LIVE for live status', () => {
    render(<StatusBadge status="live" />);
    expect(screen.getByText(/LIVE/)).toBeInTheDocument();
  });

  it('renders FROZEN for frozen status', () => {
    render(<StatusBadge status="frozen" />);
    expect(screen.getByText(/FROZEN/)).toBeInTheDocument();
  });
});
