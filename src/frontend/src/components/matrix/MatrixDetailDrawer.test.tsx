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
    versions: [],
    selectedModelId: null as string | null,
    selectedVersionId: null as string | null,
    selectedCell: null,
    cells: {},
    versionContentLoading: false,
    fieldValues: {} as Record<string, string>,
    onSelectModel: vi.fn(),
    onParamChange: vi.fn(),
    collapsed: false,
    onToggleCollapse: vi.fn(),
    onExpandToSection: vi.fn(),
    setupProps: {
      versionPicker: { versions: [], tabs: [], onAddVersion: vi.fn(), addedVersionIds: new Set<string>() },
      modelPicker: { models: [], onAddModel: vi.fn(), addedModelIds: new Set<string>() },
      template: { templateFields: [], fieldValues: {}, setFieldValues: vi.fn(), isFillingTemplateFields: false },
      tools: { mcpServers: [], allTools: [], enabledServerIds: [] as string[], setEnabledServerIds: vi.fn(), excludedToolNames: [] as string[], setExcludedToolNames: vi.fn() },
    },
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

    it('renders tab navigation with Setup, Config, Preview, and Results tabs', () => {
      renderDrawer({ collapsed: false });
      expect(screen.getByRole('tab', { name: /setup/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /config/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /preview/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /results/i })).toBeInTheDocument();
    });

    it('defaults to Setup tab when expanded', () => {
      renderDrawer({ collapsed: false });
      const setupTab = screen.getByRole('tab', { name: /setup/i });
      expect(setupTab).toHaveAttribute('data-state', 'active');
    });

    it('calls onToggleCollapse when collapse button clicked', () => {
      const { props } = renderDrawer({ collapsed: false });
      fireEvent.click(screen.getByRole('button', { name: /collapse sidebar/i }));
      expect(props.onToggleCollapse).toHaveBeenCalled();
    });
  });
});
