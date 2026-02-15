import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FirstVisitExplainer } from '@/components/FirstVisitExplainer';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

describe('FirstVisitExplainer', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders explainer when localStorage is empty', () => {
    render(<FirstVisitExplainer />);
    expect(screen.getByText('What is the Distraction Index?')).toBeInTheDocument();
  });

  it('is hidden when localStorage key exists', () => {
    localStorage.setItem('di-explainer-dismissed', '1');
    render(<FirstVisitExplainer />);
    expect(screen.queryByText('What is the Distraction Index?')).not.toBeInTheDocument();
  });

  it('clicking "Got it" hides the explainer and sets localStorage', () => {
    render(<FirstVisitExplainer />);
    expect(screen.getByText('What is the Distraction Index?')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Got it'));

    expect(screen.queryByText('What is the Distraction Index?')).not.toBeInTheDocument();
    expect(localStorage.getItem('di-explainer-dismissed')).toBe('1');
  });

  it('contains a link to methodology page', () => {
    render(<FirstVisitExplainer />);
    const link = screen.getByText('Full methodology');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', '/methodology');
  });
});
