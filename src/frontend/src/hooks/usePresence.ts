import { useEffect, useRef, useState, useCallback } from 'react';
import { HubConnectionState } from '@microsoft/signalr';
import { useAuthStore } from '@/store/authStore';
import { getPresenceConnection, startPresenceConnection } from '@/services/presenceService';
import type { PresenceUser } from '@/types';

const validStates = new Set<PresenceUser['state']>(['viewing', 'editing']);

// Stable reconnection handler — delegates to the latest ref.
// Registered once on the singleton connection to avoid accumulation.
let reconnectDelegateRegistered = false;
const reconnectRef: { current: (() => void) | null } = { current: null };

function ensureReconnectDelegate() {
  if (reconnectDelegateRegistered) return;
  const connection = getPresenceConnection();
  connection.onreconnected(() => reconnectRef.current?.());
  reconnectDelegateRegistered = true;
}

export function usePresence(entryId: string | undefined, isEditing: boolean) {
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);
  const currentUser = useAuthStore((s) => s.currentUser);
  const entryIdRef = useRef(entryId);
  const isEditingRef = useRef(isEditing);

  // Keep refs in sync for reconnection and visibility handlers
  entryIdRef.current = entryId;
  isEditingRef.current = isEditing;

  const invokeIfConnected = useCallback((method: string, ...args: unknown[]) => {
    const connection = getPresenceConnection();
    if (connection.state === HubConnectionState.Connected) {
      connection.invoke(method, ...args).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!entryId) return;

    const connection = getPresenceConnection();

    const onUserJoined = (user: PresenceUser) => {
      setPresenceUsers((prev) => [...prev.filter((u) => u.userId !== user.userId), user]);
    };

    const onUserLeft = (userId: string) => {
      setPresenceUsers((prev) => prev.filter((u) => u.userId !== userId));
    };

    const onUserStateChanged = (userId: string, state: string) => {
      if (!validStates.has(state as PresenceUser['state'])) return;
      setPresenceUsers((prev) =>
        prev.map((u) => (u.userId === userId ? { ...u, state: state as PresenceUser['state'] } : u))
      );
    };

    const onCurrentUsers = (users: PresenceUser[]) => {
      setPresenceUsers(users);
    };

    connection.on('UserJoined', onUserJoined);
    connection.on('UserLeft', onUserLeft);
    connection.on('UserStateChanged', onUserStateChanged);
    connection.on('CurrentUsers', onCurrentUsers);

    // Reconnection: use stable delegate to avoid accumulating handlers
    ensureReconnectDelegate();
    reconnectRef.current = () => {
      if (entryIdRef.current) {
        connection.invoke('JoinEntry', entryIdRef.current).catch(() => {});
        const state = isEditingRef.current ? 'editing' : 'viewing';
        connection.invoke('UpdateEditingState', entryIdRef.current, state).catch(() => {});
      }
    };

    // Tab visibility: switch to 'viewing' when tab is hidden
    const onVisibilityChange = () => {
      if (!entryIdRef.current) return;
      if (document.hidden) {
        invokeIfConnected('UpdateEditingState', entryIdRef.current, 'viewing');
      } else {
        const state = isEditingRef.current ? 'editing' : 'viewing';
        invokeIfConnected('UpdateEditingState', entryIdRef.current, state);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Browser close: server's OnDisconnectedAsync handles cleanup
    const onBeforeUnload = () => {
      if (connection.state === HubConnectionState.Connected) {
        connection.stop().catch(() => {});
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    // Connect and join
    startPresenceConnection()
      .then(() => {
        if (connection.state === HubConnectionState.Connected) {
          return connection.invoke('JoinEntry', entryId);
        }
      })
      .catch(() => {});

    return () => {
      if (connection.state === HubConnectionState.Connected) {
        connection.invoke('LeaveEntry', entryId).catch(() => {});
      }
      connection.off('UserJoined', onUserJoined);
      connection.off('UserLeft', onUserLeft);
      connection.off('UserStateChanged', onUserStateChanged);
      connection.off('CurrentUsers', onCurrentUsers);
      reconnectRef.current = null;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('beforeunload', onBeforeUnload);
      setPresenceUsers([]);
    };
  }, [entryId, invokeIfConnected]);

  // Sync editing state changes
  useEffect(() => {
    if (!entryId) return;
    invokeIfConnected('UpdateEditingState', entryId, isEditing ? 'editing' : 'viewing');
  }, [entryId, isEditing, invokeIfConnected]);

  // Filter out current user
  const otherUsers = presenceUsers.filter((u) => u.userId !== currentUser?.id);

  // Derived: first user actively editing (for soft lock)
  const activeEditor = otherUsers.find((u) => u.state === 'editing') ?? null;

  // Detect when a new user starts editing while we're also editing (for toast notification).
  // Uses a ref-based callback to avoid stale state and duplicate toasts.
  const prevEditingIdsRef = useRef<Set<string>>(new Set());
  const onEditorJoinedRef = useRef<((user: PresenceUser) => void) | null>(null);

  useEffect(() => {
    const currentEditingIds = new Set(otherUsers.filter((u) => u.state === 'editing').map((u) => u.userId));
    const prevIds = prevEditingIdsRef.current;

    if (isEditingRef.current) {
      for (const id of currentEditingIds) {
        if (!prevIds.has(id)) {
          const user = otherUsers.find((u) => u.userId === id);
          if (user) onEditorJoinedRef.current?.(user);
          break;
        }
      }
    }

    prevEditingIdsRef.current = currentEditingIds;
  }, [otherUsers]);

  return { presenceUsers: otherUsers, activeEditor, onEditorJoinedRef };
}
