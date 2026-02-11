import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FrozenBadge } from '@/components/FrozenBadge';

describe('FrozenBadge', () => {
  it('renders nothing when not frozen', () => {
    const { container } = render(<FrozenBadge frozen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders when frozen is true', () => {
    const { container } = render(<FrozenBadge frozen={true} />);
    expect(container.firstChild).not.toBeNull();
  });

  it('shows version number when provided', () => {
    render(<FrozenBadge frozen={true} version={3} />);
    expect(screen.getByText(/v3/)).toBeInTheDocument();
  });

  it('does not show version when not provided', () => {
    const { container } = render(<FrozenBadge frozen={true} />);
    expect(container.textContent).not.toMatch(/v\d/);
  });
});
