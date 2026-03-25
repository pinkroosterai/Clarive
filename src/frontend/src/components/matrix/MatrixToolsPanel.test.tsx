import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { MatrixToolsPanel } from './MatrixToolsPanel';

import type { McpServer, ToolDescription } from '@/types';

const activeServer: McpServer = {
  id: 'srv-1',
  name: 'Tavily',
  url: 'https://tavily.example.com',
  hasBearerToken: false,
  isActive: true,
  toolCount: 2,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const inactiveServer: McpServer = {
  id: 'srv-2',
  name: 'GitHub',
  url: 'https://github.example.com',
  hasBearerToken: false,
  isActive: false,
  toolCount: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const tools: ToolDescription[] = [
  { id: 't1', name: 'web_search', toolName: 'web_search', description: 'Search the web', mcpServerName: 'Tavily' },
  { id: 't2', name: 'web_extract', toolName: 'web_extract', description: 'Extract web content', mcpServerName: 'Tavily' },
  { id: 't3', name: 'list_repos', toolName: 'list_repos', description: 'List repos', mcpServerName: 'GitHub' },
];

function renderPanel(overrides: Partial<Parameters<typeof MatrixToolsPanel>[0]> = {}) {
  const defaults = {
    mcpServers: [activeServer, inactiveServer],
    allTools: tools,
    enabledServerIds: ['srv-1'],
    setEnabledServerIds: vi.fn(),
    excludedToolNames: [] as string[],
    setExcludedToolNames: vi.fn(),
    ...overrides,
  };
  return { ...render(<MatrixToolsPanel {...defaults} />), props: defaults };
}

/** Expand the outer collapsible to reveal server rows */
function expandSection() {
  fireEvent.click(screen.getByRole('button', { name: /tools/i }));
}

describe('MatrixToolsPanel', () => {
  it('renders nothing when no servers are active', () => {
    const { container } = renderPanel({ mcpServers: [inactiveServer] });
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when mcpServers is empty', () => {
    const { container } = renderPanel({ mcpServers: [] });
    expect(container.firstChild).toBeNull();
  });

  it('shows active count badge', () => {
    renderPanel();
    expect(screen.getByText('1 active')).toBeInTheDocument();
  });

  it('is collapsed by default — server names not visible', () => {
    renderPanel();
    expect(screen.queryByText('Tavily')).not.toBeInTheDocument();
  });

  it('renders only active servers when expanded', () => {
    renderPanel();
    expandSection();
    expect(screen.getByText('Tavily')).toBeInTheDocument();
    expect(screen.queryByText('GitHub')).not.toBeInTheDocument();
  });

  it('calls setEnabledServerIds when toggling server off', () => {
    const { props } = renderPanel();
    expandSection();
    const toggle = screen.getByRole('switch', { name: /toggle tavily/i });
    fireEvent.click(toggle);
    expect(props.setEnabledServerIds).toHaveBeenCalledWith([]);
  });

  it('calls setEnabledServerIds when toggling server on', () => {
    const { props } = renderPanel({ enabledServerIds: [] });
    expandSection();
    const toggle = screen.getByRole('switch', { name: /toggle tavily/i });
    fireEvent.click(toggle);
    expect(props.setEnabledServerIds).toHaveBeenCalledWith(['srv-1']);
  });

  it('shows tool checkboxes when server row is expanded', () => {
    renderPanel();
    expandSection();
    // Click server name to expand tools
    fireEvent.click(screen.getByText('Tavily'));
    expect(screen.getByText('web_search')).toBeInTheDocument();
    expect(screen.getByText('web_extract')).toBeInTheDocument();
  });

  it('calls setExcludedToolNames when unchecking a tool', () => {
    const { props } = renderPanel();
    expandSection();
    fireEvent.click(screen.getByText('Tavily'));
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    expect(props.setExcludedToolNames).toHaveBeenCalledWith(['web_search']);
  });

  it('calls setExcludedToolNames when re-checking an excluded tool', () => {
    const { props } = renderPanel({ excludedToolNames: ['web_search'] });
    expandSection();
    fireEvent.click(screen.getByText('Tavily'));
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    expect(props.setExcludedToolNames).toHaveBeenCalledWith([]);
  });
});
