import { useEffect, useRef, useState } from 'react';

import { safeSessionGet } from '@/components/playground/utils';
import { usePlaygroundTools } from '@/hooks/usePlaygroundTools';

export function useMatrixPagePersistence(entryId: string | undefined) {
  // ── Tools ──
  const {
    enabledServerIds, setEnabledServerIds,
    excludedToolNames, setExcludedToolNames,
    mcpServers, allTools,
  } = usePlaygroundTools();

  // Restore tool config from sessionStorage (overrides hook's auto-enable)
  const didRestoreToolsRef = useRef(false);
  useEffect(() => {
    if (!entryId || didRestoreToolsRef.current || mcpServers.length === 0) return;
    const saved = safeSessionGet<{ enabledServerIds: string[]; excludedToolNames: string[] } | null>(
      `matrix_${entryId}_tools`, null,
    );
    if (saved) {
      didRestoreToolsRef.current = true;
      setEnabledServerIds(saved.enabledServerIds);
      setExcludedToolNames(saved.excludedToolNames);
    } else {
      // First visit — mark as restored so persist effect can start writing
      didRestoreToolsRef.current = true;
    }
  }, [entryId, mcpServers, setEnabledServerIds, setExcludedToolNames]);

  // Persist tool config to sessionStorage on change
  useEffect(() => {
    if (!entryId || !didRestoreToolsRef.current) return;
    sessionStorage.setItem(
      `matrix_${entryId}_tools`,
      JSON.stringify({ enabledServerIds, excludedToolNames }),
    );
  }, [entryId, enabledServerIds, excludedToolNames]);

  // ── Sidebar collapse ──
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    safeSessionGet<boolean>(`matrix_${entryId}_sidebar`, false),
  );
  useEffect(() => {
    if (!entryId) return;
    sessionStorage.setItem(`matrix_${entryId}_sidebar`, JSON.stringify(sidebarCollapsed));
  }, [entryId, sidebarCollapsed]);

  // ── History ──
  const [showHistory, setShowHistory] = useState(false);

  return {
    sidebarCollapsed,
    setSidebarCollapsed,
    showHistory,
    setShowHistory,
    enabledServerIds,
    setEnabledServerIds,
    excludedToolNames,
    setExcludedToolNames,
    mcpServers,
    allTools,
  };
}
