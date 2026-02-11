import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MechanismBadge } from '@/components/MechanismBadge';

describe('MechanismBadge', () => {
  it('renders nothing when mechanism is null', () => {
    const { container } = render(<MechanismBadge mechanism={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders mechanism label', () => {
    render(<MechanismBadge mechanism="policy_change" />);
    expect(screen.getByText('Policy Change')).toBeInTheDocument();
  });

  it('renders scope when provided', () => {
    render(<MechanismBadge mechanism="enforcement_action" scope="federal" />);
    expect(screen.getByText(/federal/)).toBeInTheDocument();
  });

  it('renders scope with affected population', () => {
    render(
      <MechanismBadge
        mechanism="enforcement_action"
        scope="federal"
        affectedPopulation="broad"
      />
    );
    expect(screen.getByText(/federal/)).toBeInTheDocument();
    expect(screen.getByText(/broad/)).toBeInTheDocument();
  });

  it('renders all mechanism types correctly', () => {
    const mechanisms = [
      'policy_change',
      'enforcement_action',
      'personnel_capture',
      'resource_reallocation',
      'election_admin_change',
      'judicial_legal_action',
      'norm_erosion_only',
      'information_operation',
    ] as const;

    for (const mech of mechanisms) {
      const { unmount } = render(<MechanismBadge mechanism={mech} />);
      // Should not crash for any mechanism type
      unmount();
    }
  });
});
