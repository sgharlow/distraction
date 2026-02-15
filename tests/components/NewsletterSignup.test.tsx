import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NewsletterSignup } from '@/components/NewsletterSignup';

describe('NewsletterSignup', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the signup form', () => {
    render(<NewsletterSignup />);
    expect(screen.getByText('WEEKLY BRIEFING — COMING SOON')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
    expect(screen.getByText('SUBSCRIBE')).toBeInTheDocument();
  });

  it('shows success state after subscribing', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      json: async () => ({ status: 'subscribed' }),
    } as Response);

    render(<NewsletterSignup />);
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByText('SUBSCRIBE'));

    await waitFor(() => {
      expect(screen.getByText("YOU'RE IN")).toBeInTheDocument();
    });
  });

  it('shows already-subscribed state', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      json: async () => ({ status: 'already_subscribed' }),
    } as Response);

    render(<NewsletterSignup />);
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByText('SUBSCRIBE'));

    await waitFor(() => {
      expect(screen.getByText('ALREADY SUBSCRIBED')).toBeInTheDocument();
    });
  });

  it('shows error state on failure', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    render(<NewsletterSignup />);
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByText('SUBSCRIBE'));

    await waitFor(() => {
      expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument();
    });
  });

  it('shows error state on non-success response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      json: async () => ({ status: 'error', message: 'Server error' }),
    } as Response);

    render(<NewsletterSignup />);
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'fail@example.com' },
    });
    fireEvent.click(screen.getByText('SUBSCRIBE'));

    await waitFor(() => {
      expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument();
    });
  });

  it('disables button while submitting', async () => {
    let resolvePromise: (value: Response) => void;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolvePromise = resolve;
    });
    vi.spyOn(global, 'fetch').mockReturnValueOnce(fetchPromise);

    render(<NewsletterSignup />);
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByText('SUBSCRIBE'));

    expect(screen.getByText('SENDING...')).toBeInTheDocument();

    resolvePromise!({ json: async () => ({ status: 'subscribed' }) } as Response);
    await waitFor(() => {
      expect(screen.getByText("YOU'RE IN")).toBeInTheDocument();
    });
  });
});
