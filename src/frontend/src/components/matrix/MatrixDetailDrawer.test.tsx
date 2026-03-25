import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { MatrixDetailDrawer } from './MatrixDetailDrawer';

import { TooltipProvider } from '@/components/ui/tooltip';
import type { MatrixModel } from '@/types/matrix';

const mockModel: MatrixModel = {
  modelId: 'gpt-5',
  displayName: 'gpt-5',
  providerName: 'OpenAI',
  temperature: 1.0,
  maxTokens: 4096,
  reasoningEffort: 'medium',
  isReasoning: false,
  showReasoning: false,
};

function renderDrawer(overrides: Partial<Parameters<typeof MatrixDetailDrawer>[0]> = {}) {
  const defaults = {
    entryId: 'entry-1',
    models: [mockModel],
    selectedModelId: null as string | null,
    selectedVersionId: null as string | null,
    versionContentLoading: false,
    fieldValues: {} as Record<string, string>,
    onSelectModel: vi.fn(),
    onParamChange: vi.fn(),
    collapsed: false,
    onToggleCollapse: vi.fn(),
    onExpandToSection: vi.fn(),
    ...overrides,
  };
  return {
    ...render(
      <TooltipProvider>
        <MatrixDetailDrawer {...defaults} />
      </TooltipProvider>,
    ),
    props: defaults,
  };
}

describe('MatrixDetailDrawer', () => {
  describe('collapsed state', () => {
    it('renders expand button when collapsed', () => {
      renderDrawer({ collapsed: true });
      expect(screen.getByRole('button', { name: /expand sidebar/i })).toBeInTheDocument();
    });

    it('renders Settings2 icon button with aria-label', () => {
      renderDrawer({ collapsed: true });
      expect(screen.getByRole('button', { name: /model parameters/i })).toBeInTheDocument();
    });

    it('does not render model list when collapsed', () => {
      renderDrawer({ collapsed: true });
      expect(screen.queryByText('gpt-5')).not.toBeInTheDocument();
    });

    it('calls onToggleCollapse when expand button clicked', () => {
      const { props } = renderDrawer({ collapsed: true });
      fireEvent.click(screen.getByRole('button', { name: /expand sidebar/i }));
      expect(props.onToggleCollapse).toHaveBeenCalled();
    });

    it('calls onExpandToSection when Settings2 clicked', () => {
      const { props } = renderDrawer({ collapsed: true });
      fireEvent.click(screen.getByRole('button', { name: /model parameters/i }));
      expect(props.onExpandToSection).toHaveBeenCalled();
    });
  });

  describe('expanded state', () => {
    it('renders collapse button when expanded', () => {
      renderDrawer({ collapsed: false });
      expect(screen.getByRole('button', { name: /collapse sidebar/i })).toBeInTheDocument();
    });

    it('renders model list when expanded and no model selected', () => {
      renderDrawer({ collapsed: false });
      expect(screen.getByText('gpt-5')).toBeInTheDocument();
      expect(screen.getByText('OpenAI')).toBeInTheDocument();
    });

    it('calls onToggleCollapse when collapse button clicked', () => {
      const { props } = renderDrawer({ collapsed: false });
      fireEvent.click(screen.getByRole('button', { name: /collapse sidebar/i }));
      expect(props.onToggleCollapse).toHaveBeenCalled();
    });
  });
});
