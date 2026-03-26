import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { GitHubLoginButton } from './GitHubLoginButton';

vi.mock('@/lib/config', () => ({
  getGitHubClientId: vi.fn(),
}));

import { getGitHubClientId } from '@/lib/config';
const mockGetGitHubClientId = vi.mocked(getGitHubClientId);

describe('GitHubLoginButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders button when GitHub is configured', async () => {
    mockGetGitHubClientId.mockResolvedValue('test-client-id');

    render(<GitHubLoginButton />);

    const button = await screen.findByText('Sign in with GitHub');
    expect(button).toBeInTheDocument();
  });

  it('returns null when GitHub is not configured', async () => {
    mockGetGitHubClientId.mockResolvedValue('');

    const { container } = render(<GitHubLoginButton />);

    // Wait for effect to settle
    await vi.waitFor(() => {
      expect(container.innerHTML).toBe('');
    });
  });

  it('navigates to authorize endpoint on click', async () => {
    mockGetGitHubClientId.mockResolvedValue('test-client-id');

    // Mock window.location.href
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, href: '' },
    });

    render(<GitHubLoginButton />);

    const button = await screen.findByText('Sign in with GitHub');
    fireEvent.click(button);

    expect(window.location.href).toBe('/api/auth/github/authorize');

    // Restore
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  });
});
