import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { PresenceIndicators } from './PresenceIndicators';

import { TooltipProvider } from '@/components/ui/tooltip';
import type { PresenceUser } from '@/types';

function makeUser(overrides: Partial<PresenceUser> & { userId: string }): PresenceUser {
  return {
    name: 'User',
    avatarUrl: null,
    state: 'viewing',
    ...overrides,
  };
}

function renderIndicators(users: PresenceUser[]) {
  return render(
    <TooltipProvider>
      <PresenceIndicators users={users} />
    </TooltipProvider>
  );
}

describe('PresenceIndicators', () => {
  it('renders nothing when users array is empty', () => {
    const { container } = renderIndicators([]);
    expect(container.innerHTML).toBe('');
  });

  it('renders a single avatar', () => {
    renderIndicators([makeUser({ userId: '1', name: 'Alice' })]);
    // UserAvatar renders initials as fallback
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('renders up to 3 avatars directly', () => {
    const users = [
      makeUser({ userId: '1', name: 'Alice' }),
      makeUser({ userId: '2', name: 'Bob' }),
      makeUser({ userId: '3', name: 'Charlie' }),
    ];
    renderIndicators(users);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
  });

  it('renders overflow badge when more than 3 users', () => {
    const users = [
      makeUser({ userId: '1', name: 'Alice' }),
      makeUser({ userId: '2', name: 'Bob' }),
      makeUser({ userId: '3', name: 'Charlie' }),
      makeUser({ userId: '4', name: 'Dave' }),
      makeUser({ userId: '5', name: 'Eve' }),
    ];
    renderIndicators(users);
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('does not show overflow badge with exactly 3 users', () => {
    const users = [
      makeUser({ userId: '1', name: 'Alice' }),
      makeUser({ userId: '2', name: 'Bob' }),
      makeUser({ userId: '3', name: 'Charlie' }),
    ];
    renderIndicators(users);
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
  });
});
