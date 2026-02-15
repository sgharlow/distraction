import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ShareButtons } from '@/components/ShareButtons';

describe('ShareButtons', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Mock window.location.origin
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://distractionindex.org' },
      writable: true,
    });
  });

  it('renders Share on X and Copy Link buttons', () => {
    render(<ShareButtons url="/week/2026-02-09" title="Week 7" />);
    expect(screen.getByText('Share on X')).toBeInTheDocument();
    expect(screen.getByText('Copy Link')).toBeInTheDocument();
  });

  it('generates correct X intent URL', () => {
    render(<ShareButtons url="/week/2026-02-09" title="Week 7: Feb 9 – 15" />);
    const link = screen.getByText('Share on X').closest('a');
    expect(link).toHaveAttribute('href');
    const href = link!.getAttribute('href')!;
    expect(href).toContain('https://x.com/intent/tweet');
    expect(href).toContain(encodeURIComponent('Week 7: Feb 9 – 15'));
    expect(href).toContain(encodeURIComponent('https://distractionindex.org/week/2026-02-09'));
  });

  it('opens X link in new tab', () => {
    render(<ShareButtons url="/week/2026-02-09" title="Test" />);
    const link = screen.getByText('Share on X').closest('a');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('copies link to clipboard and shows Copied! state', async () => {
    const writeText = vi.fn().mockResolvedValueOnce(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<ShareButtons url="/event/abc-123" title="Test Event" />);
    fireEvent.click(screen.getByText('Copy Link'));

    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });
    expect(writeText).toHaveBeenCalledWith('https://distractionindex.org/event/abc-123');
  });

  it('does not render Share... button when Web Share API is unavailable', () => {
    // navigator.share is not defined by default in jsdom
    render(<ShareButtons url="/week/2026-02-09" title="Test" />);
    expect(screen.queryByText('Share...')).not.toBeInTheDocument();
  });
});
