import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { SoftLockBanner } from './SoftLockBanner';

import type { PresenceUser } from '@/types';

const mockEditor: PresenceUser = {
  userId: 'user-1',
  name: 'Alice',
  avatarUrl: null,
  state: 'editing',
};

function renderBanner(onOverride = vi.fn()) {
  return {
    onOverride,
    ...render(<SoftLockBanner activeEditor={mockEditor} onOverride={onOverride} />),
  };
}

describe('SoftLockBanner', () => {
  it("renders the active editor's name", () => {
    renderBanner();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText(/is currently editing this prompt/)).toBeInTheDocument();
  });

  it('renders the Edit anyway button', () => {
    renderBanner();
    expect(screen.getByRole('button', { name: /edit anyway/i })).toBeInTheDocument();
  });

  it('opens confirmation dialog when Edit anyway is clicked', () => {
    renderBanner();
    fireEvent.click(screen.getByRole('button', { name: /edit anyway/i }));
    expect(screen.getByText(/edit alongside alice/i)).toBeInTheDocument();
    expect(screen.getByText(/editing simultaneously may cause conflicts/i)).toBeInTheDocument();
  });

  it('calls onOverride when confirmation is accepted', () => {
    const { onOverride } = renderBanner();
    // Open dialog
    fireEvent.click(screen.getByRole('button', { name: /edit anyway/i }));
    // Confirm — the AlertDialogAction button inside the dialog also says "Edit anyway"
    const buttons = screen.getAllByRole('button', { name: /edit anyway/i });
    const confirmButton = buttons[buttons.length - 1]; // The one inside the dialog
    fireEvent.click(confirmButton);
    expect(onOverride).toHaveBeenCalledOnce();
  });

  it('does not call onOverride when dialog is canceled', () => {
    const { onOverride } = renderBanner();
    fireEvent.click(screen.getByRole('button', { name: /edit anyway/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onOverride).not.toHaveBeenCalled();
  });
});
