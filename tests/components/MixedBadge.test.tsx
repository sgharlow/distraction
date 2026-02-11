import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MixedBadge } from '@/components/MixedBadge';

describe('MixedBadge', () => {
  it('renders the MIXED text', () => {
    render(<MixedBadge />);
    expect(screen.getByText('MIXED')).toBeInTheDocument();
  });
});
