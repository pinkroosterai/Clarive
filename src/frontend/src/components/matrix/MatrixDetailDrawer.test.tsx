import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { MatrixDetailDrawer } from './MatrixDetailDrawer';

import { TooltipProvider } from '@/components/ui/tooltip';
import type { McpServer, ToolDescription } from '@/types';
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

const activeServer: McpServer = {
  id: 'srv-1',
  name: 'Context7',
  url: 'https://context7.example.com',
  hasBearerToken: false,
  isActive: true,
  toolCount: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const mockTool: ToolDescription = {
  id: 't1',
  name: 'query-docs',
  toolName: 'query-docs',
  description: 'Query docs',
  mcpServerName: 'Context7',
};

function renderDrawer(overrides: Partial<Parameters<typeof MatrixDetailDrawer>[0]> = {}) {
  const defaults = {
    models: [mockModel],
    selectedModelId: null as string | null,
    onSelectModel: vi.fn(),
    onParamChange: vi.fn(),
    mcpServers: [activeServer],
    allTools: [mockTool],
    enabledServerIds: ['srv-1'],
    setEnabledServerIds: vi.fn(),
    excludedToolNames: [] as string[],
    setExcludedToolNames: vi.fn(),
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

    it('renders Wrench icon button when active MCP servers exist', () => {
      renderDrawer({ collapsed: true });
      expect(screen.getByRole('button', { name: /^tools$/i })).toBeInTheDocument();
    });

    it('hides Wrench button when no active MCP servers', () => {
      renderDrawer({ collapsed: true, mcpServers: [] });
      expect(screen.queryByRole('button', { name: /^tools$/i })).not.toBeInTheDocument();
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

    it('calls onExpandToSection with config when Settings2 clicked', () => {
      const { props } = renderDrawer({ collapsed: true });
      fireEvent.click(screen.getByRole('button', { name: /model parameters/i }));
      expect(props.onExpandToSection).toHaveBeenCalledWith('config');
    });

    it('calls onExpandToSection with tools when Wrench clicked', () => {
      const { props } = renderDrawer({ collapsed: true });
      fireEvent.click(screen.getByRole('button', { name: /^tools$/i }));
      expect(props.onExpandToSection).toHaveBeenCalledWith('tools');
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
