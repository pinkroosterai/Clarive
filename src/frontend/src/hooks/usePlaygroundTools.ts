import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { mcpServerService, toolService } from '@/services';

export function usePlaygroundTools() {
  const [enabledServerIds, setEnabledServerIds] = useState<string[]>([]);
  const [excludedToolNames, setExcludedToolNames] = useState<string[]>([]);

  const { data: mcpServers = [] } = useQuery({
    queryKey: ['mcp-servers'],
    queryFn: mcpServerService.list,
  });
  const { data: allTools = [] } = useQuery({
    queryKey: ['tools'],
    queryFn: toolService.getToolsList,
  });

  // Enable all active MCP servers by default on first load
  const didInitServers = useRef(false);
  useEffect(() => {
    if (!didInitServers.current && mcpServers.length > 0) {
      didInitServers.current = true;
      setEnabledServerIds(mcpServers.filter((s) => s.isActive).map((s) => s.id));
    }
  }, [mcpServers]);

  return {
    enabledServerIds,
    setEnabledServerIds,
    excludedToolNames,
    setExcludedToolNames,
    mcpServers,
    allTools,
  };
}
